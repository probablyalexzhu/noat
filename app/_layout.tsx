import { Stack } from 'expo-router';
import { initDatabase } from '@/lib/database';
import { useEffect } from 'react';
import { startAutoSync, stopAutoSync } from '@/lib/sync';

initDatabase();

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
    startAutoSync(5000); // sync every 5 seconds
    return () => stopAutoSync();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
