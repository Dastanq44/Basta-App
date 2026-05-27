# Design System Reference — shadcn mindset, native implementation

shadcn/ui is a web library (React + Tailwind + Radix → DOM). Do not add it as a
runtime dependency in a native app. Port the **mindset**, which is the valuable
part:

1. **Open code** — you copy components into your repo and own them, rather than
   importing a black-box package. You can read and change every line.
2. **Composition over inheritance** — small primitives compose; no deep prop
   inheritance or config objects.
3. **Semantic design tokens** in background/foreground pairs — components reference
   `primary` / `primary-foreground`, never raw hex.
4. **A variant API** — a component exposes `variant` and `size`; styles are looked
   up from tokens by variant, not hand-written per usage.
5. **Light/dark by overriding the same tokens** — one component, two token sets.

## Semantic token set (mirror shadcn's, adapted to native)

Use the same names so the mental model transfers and AI tooling stays consistent:

```
background / foreground         app surface + text
card / card-foreground          elevated surfaces
popover / popover-foreground    sheets, menus, tooltips
primary / primary-foreground    high-emphasis actions, brand
secondary / secondary-foreground lower-emphasis filled actions
muted / muted-foreground        subtle surfaces + subdued text
accent / accent-foreground      pressed/active states
destructive / *-foreground      errors, destructive actions
border                          dividers
input                           form control borders
ring                            focus rings (accessibility!)
radius                          base corner radius (derive sm/md/lg)
```

Plus chart-1..5 if you render progress/leaderboard charts.

## React Native — option A: NativeWind + react-native-reusables (closest to shadcn)

- **NativeWind** brings Tailwind classes to RN (`className`), so the token model
  and utility ergonomics match the web shadcn workflow.
- **react-native-reusables** is a community shadcn-style port: you copy components
  in, they use the same semantic token names and variant API. This is the most
  faithful "shadcn for mobile" path — use it when the team already thinks in
  Tailwind/shadcn.

Tokens live as CSS variables in a global stylesheet; `.dark` overrides them, same
as web. Components read `bg-primary text-primary-foreground`.

## React Native — option B: hand-rolled token module + cva-style variants

Use when you want zero Tailwind/className indirection and full TS control. This is
the variant API without the web layer:

```ts
// shared/ui/theme/tokens.ts
export const lightTokens = {
  background: '#FFFFFF', foreground: '#0A0A0A',
  primary: '#4F46E5',   primaryForeground: '#FFFFFF',
  muted: '#F4F4F5',     mutedForeground: '#71717A',
  destructive: '#DC2626', destructiveForeground: '#FFFFFF',
  border: '#E4E4E7', ring: '#4F46E5',
  radius: 12,
} as const;
export const darkTokens: typeof lightTokens = {
  background: '#0A0A0A', foreground: '#FAFAFA',
  primary: '#6366F1',   primaryForeground: '#FFFFFF',
  muted: '#27272A',     mutedForeground: '#A1A1AA',
  destructive: '#EF4444', destructiveForeground: '#FFFFFF',
  border: '#27272A', ring: '#6366F1',
  radius: 12,
};
// useTheme() returns the active set based on Appearance / user override.
```

```tsx
// shared/ui/Button.tsx — variant API, semantic tokens, a11y baked in
import { Pressable, type PressableProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export function Button({ variant = 'primary', size = 'md', label, ...rest }:
  PressableProps & { variant?: Variant; size?: Size; label: string }) {
  const t = useTheme();
  const bg = {
    primary: t.primary, secondary: t.muted,
    ghost: 'transparent', destructive: t.destructive,
  }[variant];
  const fg = {
    primary: t.primaryForeground, secondary: t.foreground,
    ghost: t.foreground, destructive: t.destructiveForeground,
  }[variant];
  const py = { sm: 8, md: 12, lg: 16 }[size];

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => ({
        backgroundColor: bg, paddingVertical: py, paddingHorizontal: 16,
        borderRadius: t.radius, minHeight: 44,          // a11y tap target
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
      {...rest}
    >
      <Text style={{ color: fg, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
```

The `{variant: value}[variant]` lookup IS the cva pattern, minus the web layer —
a typed map from variant to token. Add a `cn`-style helper only if you adopt
NativeWind.

## Flutter mapping

Same principles via the framework's idioms:

- Tokens → a `ThemeExtension<AppTokens>` carrying the semantic colors + radius,
  registered in `ThemeData.extensions`. Light/dark = two extension instances.
- Variant API → a `BastaButton({required variant, required size})` widget that
  reads `Theme.of(context).extension<AppTokens>()` and switches on the variant
  enum. Same lookup-by-variant pattern as the RN map above.
- Open code → you still own the widget; you're not subclassing a vendor button.

## Mobile UI rules (regardless of stack)

Thumb-friendly (primary actions in the bottom third), ≥44pt targets, labels on
every icon-only control, respect dynamic type / text scaling, honor safe areas and
the notch, and design for one-handed use. Do NOT lay it out like a desktop
dashboard scaled down. Reach for bottom sheets and full-screen modals over hover
menus and tooltips — there is no hover on touch.
