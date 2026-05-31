import { View } from 'react-native';
import type { SyncStatus } from '@/entities';
import { Text, useTheme } from '@/shared/ui';

type Tone = 'neutral' | 'pending' | 'success' | 'danger';

const CONFIG: Record<SyncStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'pending' },
  uploading: { label: 'Uploading…', tone: 'pending' },
  synced: { label: 'Sent', tone: 'success' },
  pending_verification: { label: 'Pending verification', tone: 'pending' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Failed — tap to retry', tone: 'danger' },
  offline_retry: { label: 'Will retry when online', tone: 'pending' },
};

/** Compact status pill — pulls semantic colors from the theme. Used in lists + headers. */
export function SyncBadge({ status }: { status: SyncStatus }) {
  const t = useTheme();
  const conf = CONFIG[status];
  const palette: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.muted, fg: t.colors.mutedForeground },
    pending: { bg: t.colors.accent, fg: t.colors.accentForeground },
    success: { bg: t.colors.primary, fg: t.colors.primaryForeground },
    danger: { bg: t.colors.destructive, fg: t.colors.destructiveForeground },
  };
  const c = palette[conf.tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 4,
        borderRadius: t.radius.sm,
        backgroundColor: c.bg,
      }}
    >
      <Text style={{ color: c.fg, fontSize: t.fontSize.sm, fontWeight: '600' }}>{conf.label}</Text>
    </View>
  );
}
