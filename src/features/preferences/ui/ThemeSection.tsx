import { View } from 'react-native';
import { ThemePreviewCard, useTheme, useThemeMode } from '@/shared/ui';
import { THEME_IDS, type ThemeId } from '@/shared/lib/appPreferences';
import { useI18n, type I18nKey } from '@/shared/i18n';

const LABEL_KEY: Record<ThemeId, I18nKey> = {
  whiteBlue: 'theme.whiteBlue',
  darkBlue: 'theme.darkBlue',
  steppeSky: 'theme.steppeSky',
  sageGrowth: 'theme.sageGrowth',
};
const DESC_KEY: Record<ThemeId, I18nKey> = {
  whiteBlue: 'theme.whiteBlue.desc',
  darkBlue: 'theme.darkBlue.desc',
  steppeSky: 'theme.steppeSky.desc',
  sageGrowth: 'theme.sageGrowth.desc',
};

/** Theme chooser — a 2-column grid of live preview cards. Picking applies immediately + persists. */
export function ThemeSection() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const { themeId, setThemeId } = useThemeMode();

  // Pair up into rows of two for a tidy grid.
  const rows: ThemeId[][] = [];
  for (let i = 0; i < THEME_IDS.length; i += 2) rows.push(THEME_IDS.slice(i, i + 2));

  return (
    <View style={{ gap: t.spacing.sm }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {row.map((id) => (
            <ThemePreviewCard
              key={id}
              themeId={id}
              label={tr(LABEL_KEY[id])}
              description={tr(DESC_KEY[id])}
              selected={themeId === id}
              onPress={() => setThemeId(id)}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
