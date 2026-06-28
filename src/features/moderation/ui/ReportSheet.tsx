import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, Card, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n, type I18nKey } from '@/shared/i18n';
import type { ReportTargetType } from '@/entities';
import { REPORT_REASONS, reportInput, type ReportReason } from '../model';
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
export function ReportSheet({ visible, onClose, targetType, targetId }: ReportSheetProps) {
  const t = useTheme();
  const { t: tr } = useI18n();
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
      setFieldError(tr('report.pickReason'));
      return;
    }
    const parsed = reportInput.safeParse({
      targetType,
      targetId,
      reason,
      details: details.trim() || undefined,
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? tr('common.error'));
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
      {/* Re-provide safe-area insets INSIDE the modal — RN Modals render in a separate native
          host where the outer SafeAreaProvider's insets aren't applied, so without this the
          header overlapped the status bar / notch. */}
      <SafeAreaProvider>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Screen>
          <ScrollView contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title">{tr('report.title')}</Text>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
                <Text variant="muted">{tr('common.close')}</Text>
              </Pressable>
            </View>

            <Text variant="muted">{tr('report.intro')}</Text>

            <View style={{ gap: t.spacing.xs }}>
              <Text variant="caption">{tr('report.reason')}</Text>
              <View style={{ gap: t.spacing.xs }}>
                {REPORT_REASONS.map((r) => (
                  <ReasonRow
                    key={r}
                    label={tr(`report.reason.${r}` as I18nKey)}
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
              label={tr('report.details')}
              value={details}
              onChangeText={setDetails}
              placeholder={tr('report.detailsPlaceholder')}
              multiline
              numberOfLines={3}
              editable={!mutation.isPending && !mutation.isSuccess}
            />

            {mutation.isError ? (
              <Text variant="caption" style={{ color: t.colors.destructive }}>
                {mutation.error instanceof Error ? mutation.error.message : tr('report.couldNotSubmit')}
              </Text>
            ) : null}

            {mutation.isSuccess ? (
              <Card>
                <Text variant="heading">{tr('report.thanksTitle')}</Text>
                <Text variant="muted">{tr('report.thanksBody')}</Text>
              </Card>
            ) : (
              <Button
                label={mutation.isPending ? tr('report.submitting') : tr('report.submit')}
                onPress={onSubmit}
                loading={mutation.isPending}
                disabled={mutation.isPending}
              />
            )}
          </ScrollView>
        </Screen>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

function ReasonRow({
  label,
  selected,
  onPress,
}: {
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
    </Pressable>
  );
}
