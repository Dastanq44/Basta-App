import { Stack } from 'expo-router';
import { useAppStackScreenOptions } from '@/shared/ui';

// Group layout for the (auth) flow: sign-in / sign-up / verify-email / forgot+reset password.
// Headers visible so each screen can set its own title via <Stack.Screen options=…>. The header
// chrome (flat chevron back, centered themed title, transparent bar) is the SAME shared config the
// root stack uses, so the back button on e.g. forgot/reset password matches the rest of the app.
export default function AuthLayout() {
  const headerOptions = useAppStackScreenOptions();
  return <Stack screenOptions={{ headerShown: true, headerTitle: '', ...headerOptions }} />;
}
