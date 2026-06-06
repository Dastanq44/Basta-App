import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Card,
  Icon,
  Screen,
  SegmentedControl,
  Text,
  useTheme,
} from '@/shared/ui';
import { useSession, useSignOut } from '@/features/auth';
import { useProfile, userAvatarUrl } from '@/features/onboarding';
import { useRequestAccountDeletion } from '@/features/moderation';
import { SyncBadge, useMyRecentSubmissions } from '@/features/proofs';
import type { Submission } from '@/entities';

type Tab = 'submissions' | 'ranking';

// Profile tab — personal, decorative. Header is the user's name (not "Profile"). All
// settings/account/danger-zone moved behind the 3-dot button (top right of the in-screen
// header), opening a slide-up BottomSheet. Body has avatar + name + description, then a
// SegmentedControl with Submissions and World ranking tabs.
export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();
  const profile = useProfile();
  const submissions = useMyRecentSubmissions();
  const deletionRequest = useRequestAccountDeletion();

  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('submissions');
  const [deletionDone, setDeletionDone] = useState(false);

  const email = session.session?.user.email;
  const user = profile.data;
  const displayName = user?.displayName || user?.username || email?.split('@')[0] || 'You';
  const username = user?.username ? `@${user.username}` : null;
  const avatarRemoteUrl = useMemo(() => userAvatarUrl(user?.avatarUrl ?? null), [user?.avatarUrl]);

  const confirmDeletion = () => {
    setMenuOpen(false);
    Alert.alert(
      'Request account deletion?',
      'This marks your account for deletion. Your data will be removed by an admin process. ' +
        'This is irreversible — sign in again only if you change your mind before processing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () =>
            deletionRequest.mutate(undefined, {
              onSuccess: () => {
                setDeletionDone(true);
                Alert.alert(
                  'Deletion requested',
                  'Your request is in the queue. You can sign out now or stay signed in.',
                  [
                    { text: 'Stay signed in', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
                  ],
                );
              },
              onError: (e: unknown) =>
                Alert.alert('Could not request deletion', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmSignOut = () => {
    setMenuOpen(false);
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
    ]);
  };

  return (
    <Screen padded={false} edges={['top']}>
      {/* In-screen header. The Tabs layout disables the native header, so the 3-dot
          button lives here directly. Custom Pressable with opacity dip (not native
          highlight) so taps don't flash colors (fix C). */}
      <View
        style={{
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.sm,
          paddingBottom: t.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="title" numberOfLines={1} style={{ flex: 1, marginRight: t.spacing.sm }}>
          Profile
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon name="settings" size={22} color={t.colors.foreground} />
        </Pressable>
      </View>

      {/* Header content (avatar/name/description) + tab bar + Submissions list all share
          the same scroll surface so the page feels like one piece. */}
      {tab === 'submissions' ? (
        <FlatList
          data={submissions.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xxl }}
          ListHeaderComponent={
            <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
              <ProfileHeader
                avatarUrl={avatarRemoteUrl}
                displayName={displayName}
                username={username}
                description={user?.description ?? undefined}
                email={email}
              />
              <ActivityHeatmap submissions={submissions.data ?? []} />
              <SegmentedControl
                options={
                  [
                    { label: 'Submissions', value: 'submissions' },
                    { label: 'World ranking', value: 'ranking' },
                  ] as const
                }
                value={tab}
                onChange={setTab}
              />
            </View>
          }
          ListEmptyComponent={
            submissions.isPending ? (
              <Text variant="muted">Loading…</Text>
            ) : (
              <Card>
                <Text variant="subtitle">No submissions yet</Text>
                <Text variant="muted">Your proofs will appear here as you submit them.</Text>
              </Card>
            )
          }
          renderItem={({ item }) => <SubmissionListRow submission={item} onPress={() => router.push(`/submission/${item.id}` as Href)} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <ProfileHeader
            avatarUrl={avatarRemoteUrl}
            displayName={displayName}
            username={username}
            description={user?.description ?? undefined}
            email={email}
          />
          <ActivityHeatmap submissions={submissions.data ?? []} />
          <SegmentedControl
            options={
              [
                { label: 'Submissions', value: 'submissions' },
                { label: 'World ranking', value: 'ranking' },
              ] as const
            }
            value={tab}
            onChange={setTab}
          />
          <Card>
            <Text variant="subtitle">World ranking</Text>
            <Text variant="muted">Coming soon. Global ranking across all groups will live here.</Text>
          </Card>
        </ScrollView>
      )}

      {/* 3-dot settings sheet (slides up as one body). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label="Edit profile"
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/edit' as Href);
          }}
        />
        <BottomSheetMenuItem
          label="Appearance"
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/appearance' as Href);
          }}
        />
        <BottomSheetMenuItem
          label="Blocked users"
          onPress={() => {
            setMenuOpen(false);
            router.push('/blocked-users' as Href);
          }}
        />
        {deletionDone ? null : (
          <BottomSheetMenuItem
            label={deletionRequest.isPending ? 'Requesting…' : 'Request account deletion'}
            destructive
            onPress={confirmDeletion}
          />
        )}
        <BottomSheetMenuItem
          label={signOut.isPending ? 'Signing out…' : 'Sign out'}
          destructive
          onPress={confirmSignOut}
        />
        <BottomSheetMenuItem label="Cancel" onPress={() => setMenuOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function ProfileHeader({
  avatarUrl,
  displayName,
  username,
  description,
  email,
}: {
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  description: string | undefined;
  email: string | undefined;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: 128, height: 128, borderRadius: 64 }} />
      ) : (
        <Avatar name={displayName} size={128} />
      )}
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {displayName}
      </Text>
      {username ? (
        <Text variant="muted" style={{ textAlign: 'center' }}>
          {username}
        </Text>
      ) : null}
      {description ? (
        <Text variant="body" style={{ textAlign: 'center', paddingHorizontal: t.spacing.md }}>
          {description}
        </Text>
      ) : null}
      {!description && !username ? (
        <Text variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
          {email ?? ''}
        </Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityHeatmap — GitHub-style daily activity calendar, last 90 days.
//
// Grid: 13 columns (weeks) × 7 rows (days, Sun..Sat). Newest week on the right.
// Each cell is colored by the count of submissions on that local-date. Counting is
// "any submission" — verified, pending, and rejected all count toward the heat.
// Tradeoff: the strictest variant (verified only) would mirror streak math, but the
// user picked the inclusive version so even a still-pending day visually registers.
// ─────────────────────────────────────────────────────────────────────────────

const HEATMAP_WEEKS = 13;
const HEATMAP_DAYS = 7;
const HEATMAP_CELL = 14; // px
const HEATMAP_GAP = 3; // px

function ActivityHeatmap({ submissions }: { submissions: Submission[] }) {
  const t = useTheme();

  // Compute cell dates + per-day counts.
  const { cells, counts, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start grid on the Sunday (HEATMAP_WEEKS - 1) weeks before this week's Sunday so the
    // rightmost column is the current week.
    const startSunday = new Date(today);
    startSunday.setDate(today.getDate() - today.getDay() - (HEATMAP_WEEKS - 1) * 7);

    const cellArr: { date: Date; key: string; inRange: boolean }[] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      for (let d = 0; d < HEATMAP_DAYS; d++) {
        const date = new Date(startSunday);
        date.setDate(startSunday.getDate() + w * 7 + d);
        const key = toLocalYMD(date);
        // inRange: not in the future relative to today.
        cellArr.push({ date, key, inRange: date.getTime() <= today.getTime() });
      }
    }

    const countMap = new Map<string, number>();
    for (const s of submissions) {
      const key = toLocalYMD(new Date(s.createdAt));
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    let mx = 0;
    for (const v of countMap.values()) if (v > mx) mx = v;
    return { cells: cellArr, counts: countMap, maxCount: mx };
  }, [submissions]);

  const colorFor = (count: number, inRange: boolean): string => {
    if (!inRange) return t.colors.muted; // future days: blank tone
    if (count <= 0) return t.colors.muted;
    if (count === 1) return t.colors.primarySoft;
    // Two more steps between primarySoft and primary based on relative intensity.
    const ratio = maxCount > 1 ? count / maxCount : 1;
    if (ratio < 0.5) return blendPrimary(t.colors.primarySoft, t.colors.primary, 0.4);
    if (ratio < 0.85) return blendPrimary(t.colors.primarySoft, t.colors.primary, 0.7);
    return t.colors.primary;
  };

  return (
    <View style={{ gap: t.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>
          ACTIVITY · LAST 90 DAYS
        </Text>
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
          {submissions.length} submissions
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: HEATMAP_GAP,
          padding: t.spacing.sm,
          backgroundColor: t.colors.card,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.colors.border,
          alignSelf: 'flex-start',
        }}
      >
        {Array.from({ length: HEATMAP_WEEKS }, (_, col) => (
          <View key={col} style={{ gap: HEATMAP_GAP }}>
            {Array.from({ length: HEATMAP_DAYS }, (_, row) => {
              const cell = cells[col * HEATMAP_DAYS + row];
              if (!cell) return null;
              const count = counts.get(cell.key) ?? 0;
              return (
                <View
                  key={row}
                  style={{
                    width: HEATMAP_CELL,
                    height: HEATMAP_CELL,
                    borderRadius: 3,
                    backgroundColor: colorFor(count, cell.inRange),
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Linear blend two hex colors (#RRGGBB) by ratio 0..1. Used to build the two mid-intensity
// shades of the heatmap from the existing primarySoft and primary tokens without adding
// new theme entries.
function blendPrimary(aHex: string, bHex: string, ratio: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return aHex;
  const r = Math.round(a.r + (b.r - a.r) * ratio);
  const g = Math.round(a.g + (b.g - a.g) * ratio);
  const bb = Math.round(a.b + (b.b - a.b) * ratio);
  return `#${[r, g, bb].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

// "Jun 5, 2026, 9:25 AM" — explicitly no seconds (user's request). `toLocaleString()`
// without options shows ":SS" on some locales, so we pass an explicit minutes-resolution
// format.
const DATE_FMT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function SubmissionListRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  const title = submission.challengeTitle?.trim() || 'Challenge';
  const dateLabel = new Date(submission.createdAt).toLocaleString(undefined, DATE_FMT);
  const subline = submission.challengeGroupName
    ? `${dateLabel} · ${submission.challengeGroupName}`
    : dateLabel;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: t.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="muted" numberOfLines={1}>
              {subline}
            </Text>
            {submission.comment ? (
              <Text variant="caption" numberOfLines={2}>
                {submission.comment}
              </Text>
            ) : null}
          </View>
          {/* Right column: gray (Day N) above the verification badge. */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
              (Day {submission.challengeDay + 1})
            </Text>
            <SyncBadge status={submission.status} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
