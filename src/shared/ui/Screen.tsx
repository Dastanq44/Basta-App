import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export type ScreenProps = {
  children: ReactNode;
  /** Safe-area edges to apply. Tab screens usually omit 'bottom' (the tab bar handles it). */
  edges?: readonly Edge[];
  padded?: boolean;
  style?: ViewStyle;
};

/** Screen container: background token + safe-area insets. Keeps route files thin. */
export function Screen({ children, edges = ['top', 'bottom'], padded = true, style }: ScreenProps) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={[{ flex: 1, padding: padded ? t.spacing.lg : 0 }, style]}>{children}</View>
    </SafeAreaView>
  );
}
