import { Redirect } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { registerForPush } from '../lib/push';
import { useSession } from '../lib/session';

/** Sends cold starts / deep links without a loaded session back through the splash bootstrap. */
export function RequireUser({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  useEffect(() => {
    if (user) registerForPush();
  }, [user]);
  if (!user) return <Redirect href="/" />;
  return children;
}
