// dispatch-pushes — T-050B Supabase Edge Function (Deno).
//
// WHAT: Drains `notification_outbox` and sends pushes via the Expo Push Service.
//
// PROTECTION: deployed with `--no-verify-jwt` (so cron + service-role callers
// don't need to mint a user JWT), so we gate the endpoint behind a shared secret
// instead. Callers MUST send the header `x-dispatch-secret: <DISPATCH_PUSH_SECRET>`
// matching the function's secret. Missing/mismatched → 401. Missing on the function
// side → 500 (deliberate hard fail rather than silent allow-all). Set the secret with:
//   npx supabase secrets set DISPATCH_PUSH_SECRET=<long-random-secret>
// To check the function compiles cleanly outside of deploy:
//   deno check supabase/functions/dispatch-pushes/index.ts
//
// FLOW:
//   1. Header check → 401 fast.
//   2. `claim_pending_notifications(50)` moves rows from pending → processing
//      (FOR UPDATE SKIP LOCKED). Result is one row per (outbox, active push token)
//      pair — plus one row per outbox with `expo_token=NULL` when that user has no
//      active tokens.
//   3. **Phase 1 — collect**: send batches of ≤100 messages to
//      `https://exp.host/--/api/v2/push/send`, but ONLY accumulate per-outbox
//      results into an in-memory map. No DB writes during the loop.
//   4. **Phase 2 — commit**: for each outbox, write ONE final status:
//        * any token returned `ok` → `mark_notification_sent` (with the first OK
//          ticket id).
//        * else if ALL errors were retryable → `mark_notification_failed(..., retryable=true)`
//          (RPC bounces back to pending until attempts hits 3).
//        * else → `mark_notification_failed(..., retryable=false)` (terminal).
//      `DeviceNotRegistered` still revokes the token but never decides the outbox
//      status on its own — a sibling token's OK wins.
//   5. Revoke all collected DeviceNotRegistered tokens.
//   6. Return JSON summary { claimed, sent, failed, retryable, revokedTokens }.

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

type OutboxAgg = {
  /** First OK ticket id seen for this outbox (null = no OK yet). Truthy implies sent. */
  firstOkTicketId: string | null;
  /** All errors observed across this outbox's tokens. Used only when no OK is recorded. */
  errors: { code: string; retryable: boolean }[];
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CLAIM_LIMIT = 50;
const PUSH_BATCH = 100;

const RETRYABLE_TICKET_ERRORS = new Set([
  'MessageRateExceeded',
  'MismatchSenderId',
]);

Deno.serve(async (req) => {
  // 1. Shared-secret gate. The function is deployed with --no-verify-jwt because
  //    pg_cron + manual `supabase functions invoke` shouldn't need a user JWT.
  //    Without this header check, anyone hitting the function URL could drain the
  //    outbox.
  const expected = Deno.env.get('DISPATCH_PUSH_SECRET');
  if (!expected) {
    console.error('dispatch-pushes: DISPATCH_PUSH_SECRET not set on the function');
    return jsonResponse(500, { error: 'DISPATCH_PUSH_SECRET not configured' });
  }
  const provided = req.headers.get('x-dispatch-secret');
  if (!provided || provided !== expected) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    // 2. Claim pending rows.
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

    // Split off "no active tokens" outboxes — they get marked failed at the end with
    // no Expo round-trip. Track them in a Set so a stray duplicate doesn't double-fail.
    const noTokenOutboxIds = new Set<string>();
    const messages: ClaimedRow[] = [];
    for (const r of claimed) {
      if (!r.expo_token) noTokenOutboxIds.add(r.outbox_id);
      else messages.push(r);
    }

    const perOutbox = new Map<string, OutboxAgg>();
    const tokensToRevoke = new Map<string, string>();
    for (const m of messages) ensureAgg(perOutbox, m.outbox_id);

    // 3. Phase 1 — send batches, accumulate results into perOutbox / tokensToRevoke.
    //    Crucially: NO DB writes inside this loop. Earlier the per-ticket loop
    //    short-circuited mark_failed before a sibling token's OK could land, which
    //    permanently failed multi-device outboxes whose first ticket was
    //    DeviceNotRegistered. Now the final status is computed after ALL tickets
    //    across ALL batches have been seen.
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
        recordBatchError(perOutbox, batch, `fetch_error: ${msg}`, true);
        continue;
      }

      if (httpRes.status === 429 || (httpRes.status >= 500 && httpRes.status < 600)) {
        recordBatchError(perOutbox, batch, `http_${httpRes.status}`, true);
        continue;
      }
      if (!httpRes.ok) {
        recordBatchError(perOutbox, batch, `http_${httpRes.status}`, false);
        continue;
      }

      let body: { data?: ExpoTicket[] };
      try {
        body = await httpRes.json();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        recordBatchError(perOutbox, batch, `body_parse: ${msg}`, true);
        continue;
      }

      const tickets = body?.data;
      if (!Array.isArray(tickets) || tickets.length !== batch.length) {
        recordBatchError(perOutbox, batch, 'unexpected_response_shape', true);
        continue;
      }

      // Per-ticket recording.
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        const msg = batch[j];
        if (!ticket || !msg) continue;
        const agg = ensureAgg(perOutbox, msg.outbox_id);

        if (ticket.status === 'ok') {
          if (agg.firstOkTicketId === null) agg.firstOkTicketId = ticket.id;
          continue;
        }

        const code = ticket.details?.error;

        if (code === 'DeviceNotRegistered') {
          tokensToRevoke.set(msg.expo_token!, 'DeviceNotRegistered');
          agg.errors.push({ code: 'DeviceNotRegistered', retryable: false });
          continue;
        }

        if (code && RETRYABLE_TICKET_ERRORS.has(code)) {
          agg.errors.push({ code, retryable: true });
          continue;
        }

        // Unknown / non-retryable.
        const msgText = (ticket as ExpoTicketError).message;
        agg.errors.push({
          code: code ?? msgText ?? 'unknown_ticket_error',
          retryable: false,
        });
      }
    }

    // 4. Phase 2 — commit one final status per outbox.
    let sent = 0;
    let failed = 0;
    let retryable = 0;

    for (const [outboxId, agg] of perOutbox) {
      if (agg.firstOkTicketId !== null) {
        const { error } = await supabase.rpc('mark_notification_sent', {
          p_outbox_id: outboxId,
          p_ticket_id: agg.firstOkTicketId,
        });
        if (!error) sent++;
        else console.warn('dispatch-pushes: mark_sent error:', error.message);
        continue;
      }

      const errs = agg.errors;
      const allRetryable = errs.length > 0 && errs.every((e) => e.retryable);
      const code = errs[0]?.code ?? 'no_tickets';
      const { error } = await supabase.rpc('mark_notification_failed', {
        p_outbox_id: outboxId,
        p_error: code,
        p_retryable: allRetryable,
      });
      if (!error) {
        if (allRetryable) retryable++;
        else failed++;
      } else {
        console.warn('dispatch-pushes: mark_failed error:', error.message);
      }
    }

    // 5. Mark no-token outboxes failed non-retryable. (Doing this AFTER perOutbox
    //    keeps the loop above simple; these outboxes never had a Phase 1 entry.)
    for (const id of noTokenOutboxIds) {
      const { error } = await supabase.rpc('mark_notification_failed', {
        p_outbox_id: id,
        p_error: 'no_active_tokens',
        p_retryable: false,
      });
      if (!error) failed++;
      else console.warn('dispatch-pushes: mark_failed (no_tokens) error:', error.message);
    }

    // 6. Revoke all collected DeviceNotRegistered tokens. Done LAST so a sibling
    //    OK ticket on the same outbox (different device) has already won.
    let revokedTokens = 0;
    for (const [token, reason] of tokensToRevoke) {
      const { error } = await supabase.rpc('revoke_push_token', {
        p_expo_token: token,
        p_reason: reason,
      });
      if (!error) revokedTokens++;
      else console.warn('dispatch-pushes: revoke_push_token error:', error.message);
    }

    return jsonResponse(200, summary(claimed.length, sent, failed, retryable, revokedTokens));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('dispatch-pushes: top-level error:', msg);
    return jsonResponse(500, { error: 'internal', detail: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureAgg(map: Map<string, OutboxAgg>, id: string): OutboxAgg {
  let a = map.get(id);
  if (!a) {
    a = { firstOkTicketId: null, errors: [] };
    map.set(id, a);
  }
  return a;
}

/** Push a batch-wide error onto every outbox in `batch` (one entry per outbox row).
 *  Multiple device rows for the same outbox collapse into one entry — duplicating
 *  the error doesn't help the "allRetryable" decision. */
function recordBatchError(
  map: Map<string, OutboxAgg>,
  batch: ClaimedRow[],
  code: string,
  retryable: boolean,
): void {
  const seen = new Set<string>();
  for (const m of batch) {
    if (seen.has(m.outbox_id)) continue;
    seen.add(m.outbox_id);
    ensureAgg(map, m.outbox_id).errors.push({ code, retryable });
  }
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
