import { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Card, Icon, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { pendingVerificationsQueryKey, usePendingVerifications } from '@/features/home';

// "Verify proofs" inbox — group proofs awaiting the caller's vote. Tapping a row opens the
// per-submission verify screen. Reached from the Home "Verify a friend" button.
export default function VerificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { t: tr } = useI18n();
  const q = usePendingVerifications();

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: pendingVerificationsQueryKey });
    }, [qc]),
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(v) => v.submissionId}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
        ListEmptyComponent={
          q.isPending ? (
            <Text variant="muted">{tr('common.loading')}</Text>
          ) : q.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {q.error instanceof Error ? q.error.message : tr('verify.couldNotLoad')}
            </Text>
          ) : (
            <Text variant="muted">{tr('verify.empty')}</Text>
          )
        }
        renderItem={({ item }) => {
          const who = item.authorDisplayName ?? (item.authorUsername ? `@${item.authorUsername}` : tr('common.member'));
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/verify/[submissionId]', params: { submissionId: item.submissionId } })
              }
            >
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                  <Avatar name={who} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="subtitle" numberOfLines={1}>
                      {who}
                    </Text>
                    <Text variant="caption" numberOfLines={1}>
                      {item.challengeTitle} · {tr('day.n', { n: item.challengeDay + 1 })}
                    </Text>
                  </View>
                  <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
