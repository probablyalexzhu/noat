import { initDatabase } from "@/lib/database";
import { Stack } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);
  return <Stack screenOptions={{ headerShown: false }} />;
}
