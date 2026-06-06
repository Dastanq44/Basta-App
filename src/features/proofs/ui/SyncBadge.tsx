import { View } from 'react-native';
import type { SyncStatus } from '@/entities';
import { Text, useTheme, useThemeMode } from '@/shared/ui';

type Tone = 'neutral' | 'pending' | 'success' | 'danger';

const CONFIG: Record<SyncStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'pending' },
  uploading: { label: 'Uploading…', tone: 'pending' },
  synced: { label: 'Sent', tone: 'success' },
  // Shortened from "Pending verification" — paired with the new muted-amber palette
  // below it reads "in review" without competing with the row's heading text.
  pending_verification: { label: 'Pending', tone: 'pending' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Failed — tap to retry', tone: 'danger' },
  offline_retry: { label: 'Will retry when online', tone: 'pending' },
};

/**
 * Compact status pill — pulls semantic colors from the theme. Used in lists + headers.
 *
 * Pending tone uses a muted amber palette that's distinct from the theme's bright
 * `warning` token (kept for streaks/medals) and is mode-aware: pale cream + dark amber
 * text on light, dark warm + bright amber text on dark. Same gold-family hue as the
 * STATUS_AMBER used on the challenge detail status box.
 */
export function SyncBadge({ status }: { status: SyncStatus }) {
  const t = useTheme();
  const { scheme } = useThemeMode();
  const isDark = scheme === 'dark';
  const conf = CONFIG[status];

  const pending = isDark
    ? { bg: '#3B2D10', fg: '#F4C56B' }
    : { bg: '#FFF1C7', fg: '#7A5C0D' };

  const palette: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.muted, fg: t.colors.mutedForeground },
    pending,
    success: { bg: t.colors.success, fg: t.colors.successForeground },
    danger: { bg: t.colors.destructive, fg: t.colors.destructiveForeground },
  };
  const c = palette[conf.tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 4,
        borderRadius: t.radius.full,
        backgroundColor: c.bg,
      }}
    >
      {/* Smaller (xs vs sm) so the pill stays compact in dense rows. */}
      <Text style={{ color: c.fg, fontSize: t.fontSize.xs, fontWeight: '600' }}>{conf.label}</Text>
    </View>
  );
}
