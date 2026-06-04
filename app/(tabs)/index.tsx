import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Avatar, Button, Card, Icon, Screen, StatTile, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useChallenges } from '@/features/challenges';
import { useMyGroups } from '@/features/groups';

// Today tab: a styled "home" — greeting, momentum hero, quick stats (real counts), quick actions.
// Stats are bound to real data (active challenges / groups), not a fake XP/level system (D-006).
export default function TodayScreen() {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const challenges = useChallenges();
  const groups = useMyGroups();

  const email = session.session?.user.email ?? '';
  const name = (email ? email.split('@')[0] : '') || 'there';
  const activeCount = challenges.data?.length ?? 0;
  const groupCount = groups.data?.length ?? 0;

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
        {/* Greeting header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Avatar name={name} size={46} />
            <View>
              <Text variant="caption">Welcome back</Text>
              <Text variant="heading">Hi, {name} 👋</Text>
            </View>
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: t.colors.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" size={22} color={t.colors.foreground} />
          </View>
        </View>

        {/* Momentum hero */}
        <Card style={{ backgroundColor: t.colors.primary, borderColor: t.colors.primary }}>
          <Text variant="label" style={{ color: '#FFFFFF', opacity: 0.85 }}>
            YOUR MOMENTUM
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: t.fontSize.xl, fontWeight: '800', marginTop: 4 }}>
            Keep the streak alive
          </Text>
          <Text style={{ color: '#FFFFFF', opacity: 0.9, marginTop: 4, marginBottom: t.spacing.md }}>
            Submit today&apos;s proof to stay on track with your friends.
          </Text>
          <Button label="Start a challenge" variant="secondary" onPress={() => router.push('/challenge/new')} />
        </Card>

        {/* Quick stats (real counts) */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <StatTile value={activeCount} label="Active challenges" tone="primary" icon="🎯" />
          <StatTile value={groupCount} label="Your groups" tone="success" icon="👥" />
        </View>

        {/* Quick actions */}
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Quick actions</Text>
          <QuickAction label="New challenge" hint="Solo or group" onPress={() => router.push('/challenge/new')} />
          <QuickAction
            label="Create or join a group"
            hint="Invite friends with a code"
            onPress={() => router.push('/group/join-or-create' as Href)}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuickAction({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="subtitle">{label}</Text>
            <Text variant="caption">{hint}</Text>
          </View>
          <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
        </View>
      </Card>
    </Pressable>
  );
}
