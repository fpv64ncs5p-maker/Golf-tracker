import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="session" />
      <Stack.Screen name="round" />
      <Stack.Screen name="round-hole" />
      <Stack.Screen name="round-complete" />
      <Stack.Screen name="round-detail" />
      <Stack.Screen name="round-import" />
      <Stack.Screen name="courses" />
    </Stack>
  );
}
