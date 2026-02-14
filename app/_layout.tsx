import { Stack } from 'expo-router';
import { initDatabase } from '@/lib/data/database';
import { useCloudSync } from '@/hooks/useCloudSync';

initDatabase();

export default function RootLayout() {
  useCloudSync();

  return <Stack screenOptions={{ headerShown: false }} />;
}
