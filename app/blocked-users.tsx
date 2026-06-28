import { Alert, FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { useMyBlocks, useUnblockUser } from '@/features/moderation';
import type { Block } from '@/entities';

// Thin route — list of users the current viewer has blocked + Unblock button per row.
// The `blocks` table doesn't store profile info, so for MVP we render the user id (a UUID)
// as the fallback identifier. Profile-name resolution can be added later via a SECURITY
// DEFINER RPC that returns minimal display info for a list of ids.
export default function BlockedUsersScreen() {
  const blocks = useMyBlocks();
  const t = useTheme();
  const { t: tr } = useI18n();

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: tr('blocked.title') }} />
      <FlatList
        data={blocks.data ?? []}
        keyExtractor={(b) => b.blockedId}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}
        ListEmptyComponent={
          blocks.isPending ? (
            <Text variant="muted">{tr('common.loading')}</Text>
          ) : blocks.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {blocks.error instanceof Error ? blocks.error.message : tr('blocked.loadError')}
            </Text>
          ) : (
            <Text variant="muted">{tr('blocked.emptyBody')}</Text>
          )
        }
        renderItem={({ item }) => <BlockedRow block={item} />}
        refreshing={blocks.isFetching && !blocks.isPending}
        onRefresh={() => void blocks.refetch()}
      />
    </Screen>
  );
}

function BlockedRow({ block }: { block: Block }) {
  const t = useTheme();
  const { t: tr, fmtDate } = useI18n();
  const unblock = useUnblockUser();

  const confirmUnblock = () => {
    Alert.alert(
      tr('blocked.unblockTitle'),
      tr('blocked.unblockBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('blocked.unblock'),
          onPress: () =>
            unblock.mutate(block.blockedId, {
              onError: (e: unknown) =>
                Alert.alert(tr('blocked.couldNotUnblock'), e instanceof Error ? e.message : tr('common.error')),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Card>
      <View style={{ gap: t.spacing.xs }}>
        <Text variant="muted">{tr('blocked.userId')}</Text>
        <Text variant="body" style={{ fontFamily: 'monospace' }}>
          {block.blockedId}
        </Text>
        <Text variant="caption">{tr('blocked.blockedOn', { date: fmtDate(block.createdAt) })}</Text>
        <View style={{ marginTop: t.spacing.sm }}>
          <Button
            label={unblock.isPending ? tr('blocked.unblocking') : tr('blocked.unblock')}
            variant="secondary"
            size="sm"
            onPress={confirmUnblock}
            loading={unblock.isPending}
            disabled={unblock.isPending}
          />
        </View>
      </View>
    </Card>
  );
}
