// app/index.tsx
import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  // Instead of router.replace, just render a Redirect
  return <Redirect href="/login" />;
}
