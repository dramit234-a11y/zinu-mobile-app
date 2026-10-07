import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session';

/** Sends cold starts / deep links without a loaded session back through the splash bootstrap. */
export function RequireUser({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (!user) return <Redirect href="/" />;
  return children;
}
