import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Icon, Input, Text, useTheme, VisibilityToggle } from '@/shared/ui';
// Relative imports keep this free of a self-cycle once `index.ts` re-exports ui.
import { createGroupInput, groupDescriptionSchema, INVITE_CODE_LENGTH, joinGroupInput } from '../model';
import { useCreateGroup, useJoinGroup, useUpdateGroupMeta } from '../hooks';
import { uploadGroupAvatar } from '../api';
import { GroupAvatarPicker } from './GroupAvatarPicker';

export type Mode = 'create' | 'join';

export type GroupCreateOrJoinFormProps = {
  /** Called after a successful create. Receives the new group id. */
  onCreated: (groupId: string) => void | Promise<void>;
  /** Called after a successful join. Receives the joined group id. */
  onJoined: (groupId: string) => void | Promise<void>;
  /** Optional initial mode (defaults to 'create'). */
  initialMode?: Mode;
  /** Optional extra header copy above the toggle (onboarding uses this to explain the step). */
  headerCopy?: string;
};

/**
 * Reusable create-or-join form. Owns local state + zod validation + RPC mutations,
 * but defers post-success behavior to the parent. On create it also (best-effort) uploads
 * the chosen avatar + sets the description — the group is created regardless, so this works
 * even before the W-030 migration / group-avatars bucket exist.
 */
export function GroupCreateOrJoinForm({
  onCreated,
  onJoined,
  initialMode = 'create',
  headerCopy,
}: GroupCreateOrJoinFormProps) {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  // Default public (groups are public unless the user opts out).
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreateGroup();
  const join = useJoinGroup();
  const updateMeta = useUpdateGroupMeta();
  const submitting = create.isPending || join.isPending || updateMeta.isPending;

  const activeError = mode === 'create' ? create.error : join.error;
  const submitError = activeError instanceof Error ? activeError.message : null;

  const onSubmit = async () => {
    setFieldError(null);
    if (mode === 'create') {
      const parsed = createGroupInput.safeParse({ name });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Invalid group name');
        return;
      }
      const descParsed = groupDescriptionSchema.safeParse(description);
      if (!descParsed.success) {
        setFieldError(descParsed.error.issues[0]?.message ?? 'Invalid description');
        return;
      }
      try {
        const group = await create.mutateAsync({ name: parsed.data.name, isPublic });
        // Best-effort: avatar + description need W-030 + the bucket. The group exists either way.
        try {
          let avatarPath: string | null = null;
          if (avatarUri) avatarPath = await uploadGroupAvatar(group.id, avatarUri);
          const desc = descParsed.data.trim();
          if (avatarPath || desc.length > 0) {
            await updateMeta.mutateAsync({
              groupId: group.id,
              name: parsed.data.name,
              description: desc || null,
              avatarPath,
            });
          }
        } catch (e) {
          console.error('[basta] group avatar/description failed (group still created):', e);
        }
        await onCreated(group.id);
      } catch {
        /* surfaced via submitError */
      }
    } else {
      const parsed = joinGroupInput.safeParse({ code });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Invalid invite code');
        return;
      }
      try {
        const groupId = await join.mutateAsync(parsed.data.code);
        await onJoined(groupId);
      } catch {
        /* surfaced via submitError */
      }
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
    >
      {headerCopy ? <Text variant="muted">{headerCopy}</Text> : null}

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === 'create' ? (
        <>
          <GroupAvatarPicker uri={avatarUri} onPick={setAvatarUri} />
          <Input
            label="Group name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="e.g. Morning runners"
            error={fieldError ?? undefined}
            editable={!submitting}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group about?"
            multiline
            maxLength={280}
            editable={!submitting}
          />
          <View
            style={{
              backgroundColor: t.colors.card,
              borderRadius: t.radius.xl,
              borderWidth: 1,
              borderColor: t.colors.border,
              padding: t.spacing.lg,
            }}
          >
            <VisibilityToggle
              value={!isPublic}
              onValueChange={(next) => setIsPublic(!next)}
              title="Private group"
              description="Private groups do not appear in Global. Invite codes are never shown publicly."
              disabled={submitting}
            />
          </View>
        </>
      ) : (
        <Input
          label="Invite code"
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, '').slice(0, INVITE_CODE_LENGTH))}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={INVITE_CODE_LENGTH}
          placeholder="12-character code"
          error={fieldError ?? undefined}
          editable={!submitting}
        />
      )}

      {submitError ? (
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {submitError}
        </Text>
      ) : null}

      <Button
        label={
          submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Joining…'
            : mode === 'create'
              ? 'Create group'
              : 'Join group'
        }
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </ScrollView>
  );
}

/** Create vs Join presented as two deliberate choice cards (not a thin toggle) — each with an
 *  icon, title, and one-line description; the selected card gets a primary border + soft fill. */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { value: Mode; icon: 'plus' | 'groups'; title: string; sub: string }[] = [
    { value: 'create', icon: 'plus', title: 'Create a group', sub: 'Start your own and invite friends' },
    { value: 'join', icon: 'groups', title: 'Join with a code', sub: 'Enter an invite code from a friend' },
  ];
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => (
        <ModeChoiceCard
          key={o.value}
          icon={o.icon}
          title={o.title}
          sub={o.sub}
          selected={o.value === mode}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

function ModeChoiceCard({
  icon,
  title,
  sub,
  selected,
  onPress,
}: {
  icon: 'plus' | 'groups';
  title: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        padding: t.spacing.md,
        minHeight: t.minTapTarget + 16,
        borderRadius: t.radius.lg,
        borderWidth: 1.5,
        borderColor: selected ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.primarySoft : t.colors.card,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: t.radius.md,
          backgroundColor: selected ? t.colors.primary : t.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={selected ? t.colors.primaryForeground : t.colors.mutedForeground} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subtitle" style={{ color: selected ? t.colors.primary : t.colors.foreground }}>{title}</Text>
        <Text variant="caption">{sub}</Text>
      </View>
      {/* Radio indicator. */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? t.colors.primary : t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary }} /> : null}
      </View>
    </Pressable>
  );
}
