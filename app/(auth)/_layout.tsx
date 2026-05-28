import { Stack } from 'expo-router';

// Group layout for the (auth) flow: sign-in / sign-up / verify-email.
// Headers visible so each screen can set its own title via <Stack.Screen options=…>.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: true, headerTitle: '' }} />;
}
