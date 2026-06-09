// dispatch-pushes — T-050B Supabase Edge Function (Deno).
//
// WHAT: Drains `notification_outbox` and sends pushes via the Expo Push Service.
//
// FLOW:
//   1. Call `claim_pending_notifications(50)`. The RPC moves rows from pending →
//      processing under FOR UPDATE SKIP LOCKED. We get back one row per (outbox,
//      active push token) pair — plus one row per outbox with `expo_token=NULL`
//      when that user has no active tokens left (those rows get marked failed below
//      so we don't spin on them).
//   2. Group rows by outbox_id (one outbox can have multiple devices/tokens).
//   3. POST to https://exp.host/--/api/v2/push/send in batches of ≤100 messages.
//      Include the `Authorization: Bearer <EXPO_ACCESS_TOKEN>` header when the
//      function secret is set (raises the rate ceiling for production traffic).
//   4. Parse Expo tickets:
//      * status='ok'                → mark_notification_sent (first ok per outbox).
//      * details.error='DeviceNotRegistered' → revoke_push_token + mark failed
//        non-retryable if no other device for this outbox succeeded.
//      * status='error', other code (MessageRateExceeded, MessageTooBig, etc.) →
//        mark failed retryable for transient codes, non-retryable otherwise.
//   5. Handle HTTP-level conditions:
//      * fetch network error → mark all batch outboxes failed retryable.
//      * HTTP 429 or 5xx     → mark all batch outboxes failed retryable.
//      * HTTP 4xx (≠429)     → mark all batch outboxes failed non-retryable.
//      * 2xx with malformed body → mark all batch outboxes failed retryable.
//   6. Return a JSON summary { claimed, sent, failed, retryable, revokedTokens }.
//
// AUTHENTICATION: this function uses the project's service-role key (provided via
// Edge Function secrets — NEVER bundled with the mobile app). The dispatch RPCs are
// granted to `service_role` only (see migration W-033).
//
// IDEMPOTENCY:
//   * `mark_notification_sent` only writes when status='processing', so a duplicate
//     OK ticket from a second device is a no-op.
//   * `mark_notification_failed` is similarly status='processing' gated.
//   * `revoke_push_token` is conditional on `revoked_at is null`.

import { createClient } from 'npm:@supabase/supabase-js@2';

type ClaimedRow = {
  outbox_id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
  expo_token: string | null;
  platform: string | null;
};

type ExpoTicketOk = { status: 'ok'; id: string };
type ExpoTicketError = {
  status: 'error';
  message?: string;
  details?: { error?: string };
};
type ExpoTicket = ExpoTicketOk | ExpoTicketError;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CLAIM_LIMIT = 50;
const PUSH_BATCH = 100;

const RETRYABLE_TICKET_ERRORS = new Set([
  'MessageRateExceeded',
  'MismatchSenderId', // transient FCM config races
]);

Deno.serve(async (req) => {
  // The function can be invoked by a scheduled job (pg_cron in T-050C) or via a
  // manual POST. Either way, we don't read the body — the work to do lives entirely
  // in the outbox table.
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    // 1. Claim pending rows.
    const { data: rows, error: claimErr } = await supabase.rpc(
      'claim_pending_notifications',
      { p_limit: CLAIM_LIMIT },
    );
    if (claimErr) {
      console.error('dispatch-pushes: claim failed:', claimErr.message);
      return jsonResponse(500, { error: 'claim failed', detail: claimErr.message });
    }

    const claimed = (rows ?? []) as ClaimedRow[];
    if (claimed.length === 0) {
      return jsonResponse(200, summary(0, 0, 0, 0, 0));
    }

    // 2. Split off rows with no active tokens — those get marked failed up front.
    const messages: ClaimedRow[] = [];
    const noTokenOutboxes = new Set<string>();
    for (const r of claimed) {
      if (!r.expo_token) noTokenOutboxes.add(r.outbox_id);
      else messages.push(r);
    }

    let failed = 0;
    for (const id of noTokenOutboxes) {
      const { error } = await supabase.rpc('mark_notification_failed', {
        p_outbox_id: id,
        p_error: 'no_active_tokens',
        p_retryable: false,
      });
      if (!error) failed++;
      else console.warn('dispatch-pushes: mark_failed (no_tokens) error:', error.message);
    }

    let sent = 0;
    let retryable = 0;
    let revokedTokens = 0;

    // Track which outboxes already had at least one OK ticket — used so a partial
    // success across multiple devices doesn't get marked failed.
    const outboxAlreadySent = new Set<string>();

    // 3. Send in chunks of PUSH_BATCH.
    for (let i = 0; i < messages.length; i += PUSH_BATCH) {
      const batch = messages.slice(i, i + PUSH_BATCH);
      const expoMessages = batch.map((m) => ({
        to: m.expo_token!,
        title: m.title,
        body: m.body,
        sound: 'default',
        data: m.data,
      }));

      let httpRes: Response;
      try {
        httpRes = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(expoMessages),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('dispatch-pushes: fetch error:', msg);
        retryable += await markBatch(supabase, batch, outboxAlreadySent, `fetch_error: ${msg}`, true);
        continue;
      }

      // HTTP-level error handling.
      if (httpRes.status === 429 || (httpRes.status >= 500 && httpRes.status < 600)) {
        retryable += await markBatch(
          supabase,
          batch,
          outboxAlreadySent,
          `http_${httpRes.status}`,
          true,
        );
        continue;
      }
      if (!httpRes.ok) {
        failed += await markBatch(
          supabase,
          batch,
          outboxAlreadySent,
          `http_${httpRes.status}`,
          false,
        );
        continue;
      }

      let body: { data?: ExpoTicket[] };
      try {
        body = await httpRes.json();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        retryable += await markBatch(supabase, batch, outboxAlreadySent, `body_parse: ${msg}`, true);
        continue;
      }

      const tickets = body?.data;
      if (!Array.isArray(tickets) || tickets.length !== batch.length) {
        retryable += await markBatch(
          supabase,
          batch,
          outboxAlreadySent,
          'unexpected_response_shape',
          true,
        );
        continue;
      }

      // Per-ticket processing.
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        const msg = batch[j];

        if (ticket.status === 'ok') {
          if (!outboxAlreadySent.has(msg.outbox_id)) {
            const { error } = await supabase.rpc('mark_notification_sent', {
              p_outbox_id: msg.outbox_id,
              p_ticket_id: ticket.id ?? null,
            });
            if (!error) {
              sent++;
              outboxAlreadySent.add(msg.outbox_id);
            } else {
              console.warn('dispatch-pushes: mark_sent error:', error.message);
            }
          }
          continue;
        }

        // ticket.status === 'error'
        const code = ticket.details?.error;

        if (code === 'DeviceNotRegistered') {
          const { error: revokeErr } = await supabase.rpc('revoke_push_token', {
            p_expo_token: msg.expo_token!,
            p_reason: 'DeviceNotRegistered',
          });
          if (!revokeErr) revokedTokens++;
          else console.warn('dispatch-pushes: revoke_push_token error:', revokeErr.message);

          // If no other device already accepted this outbox, mark it failed
          // non-retryable. (A later sibling success in the same batch will be
          // accepted by the idempotent mark_notification_sent.)
          if (!outboxAlreadySent.has(msg.outbox_id)) {
            const { error } = await supabase.rpc('mark_notification_failed', {
              p_outbox_id: msg.outbox_id,
              p_error: `DeviceNotRegistered:${msg.expo_token}`,
              p_retryable: false,
            });
            if (!error) failed++;
          }
          continue;
        }

        if (code && RETRYABLE_TICKET_ERRORS.has(code)) {
          if (!outboxAlreadySent.has(msg.outbox_id)) {
            const { error } = await supabase.rpc('mark_notification_failed', {
              p_outbox_id: msg.outbox_id,
              p_error: code,
              p_retryable: true,
            });
            if (!error) retryable++;
          }
          continue;
        }

        // Unknown / non-retryable ticket error.
        if (!outboxAlreadySent.has(msg.outbox_id)) {
          const { error } = await supabase.rpc('mark_notification_failed', {
            p_outbox_id: msg.outbox_id,
            p_error: code ?? ticket.message ?? 'unknown_ticket_error',
            p_retryable: false,
          });
          if (!error) failed++;
        }
      }
    }

    return jsonResponse(200, summary(claimed.length, sent, failed, retryable, revokedTokens));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('dispatch-pushes: top-level error:', msg);
    return jsonResponse(500, { error: 'internal', detail: msg });
  }
});

/** Mark every outbox in `batch` failed with the given error, except those already
 *  marked sent via another device. Returns the count of rows actually updated. */
async function markBatch(
  supabase: ReturnType<typeof createClient>,
  batch: ClaimedRow[],
  outboxAlreadySent: Set<string>,
  error: string,
  retryable: boolean,
): Promise<number> {
  // Dedup per outbox in this batch (multiple device rows share an outbox).
  const distinct = new Set<string>();
  for (const m of batch) {
    if (!outboxAlreadySent.has(m.outbox_id)) distinct.add(m.outbox_id);
  }
  let n = 0;
  for (const id of distinct) {
    const { error: err } = await supabase.rpc('mark_notification_failed', {
      p_outbox_id: id,
      p_error: error,
      p_retryable: retryable,
    });
    if (!err) n++;
  }
  return n;
}

function summary(
  claimedCount: number,
  sent: number,
  failed: number,
  retryable: number,
  revokedTokens: number,
) {
  return { claimed: claimedCount, sent, failed, retryable, revokedTokens };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
