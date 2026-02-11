import { Stack } from 'expo-router';
import { initDatabase } from '@/lib/database';

initDatabase();

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
