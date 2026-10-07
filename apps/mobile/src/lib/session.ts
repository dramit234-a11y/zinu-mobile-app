import { Role, RoleStatus, type MeDto } from '@zinu/shared';
import { create } from 'zustand';
import { PrefKeys, prefs } from './storage';

export type Mode = 'passenger' | 'driver';

interface SessionState {
  user: MeDto | null;
  mode: Mode;
  setUser(user: MeDto | null): void;
  setMode(mode: Mode): Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  mode: 'passenger',
  setUser: (user) => set({ user }),
  setMode: async (mode) => {
    set({ mode });
    await prefs.set(PrefKeys.activeMode, mode);
  },
}));

export const roleOf = (user: MeDto | null, role: Role) => user?.roles.find((r) => r.role === role);

export const hasActivePassenger = (u: MeDto | null) => roleOf(u, Role.PASSENGER)?.status === RoleStatus.ACTIVE;
/** Driver mode is reachable during onboarding and suspension (to see status); going online needs APPROVED. */
export const hasDriverRole = (u: MeDto | null) => !!roleOf(u, Role.DRIVER);
/** Spec §2: switching is offered only when both roles are approved/active. */
export const canSwitchRoles = (u: MeDto | null) => hasActivePassenger(u) && roleOf(u, Role.DRIVER)?.status === RoleStatus.ACTIVE;

/** Where a signed-in user belongs right now. */
export function homeRoute(user: MeDto, preferred: Mode): '/account-type' | '/passenger' | '/driver' {
  const passenger = hasActivePassenger(user);
  const driver = hasDriverRole(user);
  if (!passenger && !driver) return '/account-type';
  if (driver && (!passenger || preferred === 'driver')) return '/driver';
  return '/passenger';
}
