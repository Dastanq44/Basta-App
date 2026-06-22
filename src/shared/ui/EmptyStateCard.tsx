import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from './theme';

export type EmptyStateCardProps = {
  title: string;
  /** Explains what will appear here + how to get content. */
  body?: string;
  icon?: ReactNode | string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Consistent empty-state card: optional emoji/icon, a title, an explanatory body, and an optional
 *  primary action — so empty states aren't bare text and tell the user how to get content. */
export function EmptyStateCard({ title, body, icon, actionLabel, onAction }: EmptyStateCardProps) {
  const t = useTheme();
  return (
    <Card style={{ gap: t.spacing.sm }}>
      {icon ? (
        <View style={{ alignItems: 'center' }}>
          {typeof icon === 'string' ? <Text style={{ fontSize: 30 }}>{icon}</Text> : icon}
        </View>
      ) : null}
      <Text variant="subtitle" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? <Text variant="muted" style={{ textAlign: 'center' }}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}
