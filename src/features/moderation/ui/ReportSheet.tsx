import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Input, Screen, Text, useTheme } from '@/shared/ui';
import type { ReportTargetType } from '@/entities';
import { REPORT_REASON_LABELS, REPORT_REASONS, reportInput, type ReportReason } from '../model';
import { useReport } from '../hooks';

export type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Optional friendly label that shows what's being reported (e.g. "this proof"). */
  targetLabel?: string;
};

/**
 * Modal report form. Presents the canonical reason list + optional details. Submits via
 * `report_target` RPC. On success we show a brief "Thanks" state and auto-dismiss.
 */
export function ReportSheet({ visible, onClose, targetType, targetId, targetLabel }: ReportSheetProps) {
  const t = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useReport();

  // Reset form whenever the sheet opens fresh.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setFieldError(undefined);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onSubmit = () => {
    setFieldError(undefined);
    if (!reason) {
      setFieldError('Pick a reason');
      return;
    }
    const parsed = reportInput.safeParse({
      targetType,
      targetId,
      reason,
      details: details.trim() || undefined,
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    mutation.mutate(parsed.data, {
      onSuccess: () => {
        // Brief success state, then auto-close.
        setTimeout(onClose, 1200);
      },
    });
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Screen>
          <ScrollView contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title">Report</Text>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
                <Text variant="muted">Close</Text>
              </Pressable>
            </View>

            <Text variant="muted">
              Reporting {targetLabel ?? `this ${targetType}`}. Our team reviews reports and
              takes action where appropriate.
            </Text>

            <View style={{ gap: t.spacing.xs }}>
              <Text variant="caption">Reason</Text>
              <View style={{ gap: t.spacing.xs }}>
                {REPORT_REASONS.map((r) => (
                  <ReasonRow
                    key={r}
                    value={r}
                    label={REPORT_REASON_LABELS[r]}
                    selected={reason === r}
                    onPress={() => setReason(r)}
                  />
                ))}
              </View>
              {fieldError ? (
                <Text variant="caption" style={{ color: t.colors.destructive }}>
                  {fieldError}
                </Text>
              ) : null}
            </View>

            <Input
              label="Details (optional)"
              value={details}
              onChangeText={setDetails}
              placeholder="Anything else moderators should know?"
              multiline
              numberOfLines={3}
              editable={!mutation.isPending && !mutation.isSuccess}
            />

            {mutation.isError ? (
              <Text variant="caption" style={{ color: t.colors.destructive }}>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Could not submit report.'}
              </Text>
            ) : null}

            {mutation.isSuccess ? (
              <Card>
                <Text variant="heading">Thanks for flagging this.</Text>
                <Text variant="muted">
                  Our team will review it. You can close this now.
                </Text>
              </Card>
            ) : (
              <Button
                label={mutation.isPending ? 'Sending…' : 'Submit report'}
                onPress={onSubmit}
                loading={mutation.isPending}
                disabled={mutation.isPending}
              />
            )}
          </ScrollView>
        </Screen>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReasonRow({
  value,
  label,
  selected,
  onPress,
}: {
  value: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={{
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: selected ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.accent : 'transparent',
      }}
    >
      <Text style={{ color: selected ? t.colors.accentForeground : t.colors.foreground, fontWeight: '600' }}>
        {label}
      </Text>
      <Text variant="caption" style={{ marginTop: 2 }}>
        {value}
      </Text>
    </Pressable>
  );
}
