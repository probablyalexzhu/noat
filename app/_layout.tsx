import { initDatabase } from '@/lib/database';
import { Stack } from 'expo-router';

initDatabase();

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
