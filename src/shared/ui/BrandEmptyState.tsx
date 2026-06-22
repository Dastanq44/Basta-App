import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { OrnamentMedallion } from './OrnamentMedallion';
import { Text } from './Text';
import { useTheme } from './theme';

export type BrandEmptyStateProps = {
  title: string;
  /** Explains what will appear here + how to get content. */
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Override the default steppe medallion glyph. */
  icon?: ReactNode;
  /** Medallion tint (defaults to primary). Ignored when `icon` is provided. */
  tone?: string;
};

/**
 * Branded empty state — a centered steppe medallion (subtle ornament) over a title, body, and
 * optional action. Same role as EmptyStateCard but with the Kazakh-inspired accent for
 * higher-visibility surfaces (tabs, previews). One medallion, never a tiled background.
 */
export function BrandEmptyState({ title, body, actionLabel, onAction, icon, tone }: BrandEmptyStateProps) {
  const t = useTheme();
  return (
    <Card style={{ gap: t.spacing.md, alignItems: 'center', paddingVertical: t.spacing.xl }}>
      {icon ?? <OrnamentMedallion size={64} color={tone} />}
      <View style={{ gap: t.spacing.xs, alignItems: 'center' }}>
        <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
        {body ? <Text variant="muted" style={{ textAlign: 'center' }}>{body}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </Card>
  );
}
