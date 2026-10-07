'use client';

import type { Permission } from '@zinu/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { adminFetch } from './api';

export interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: Permission[];
}

const StaffContext = createContext<Staff | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  useEffect(() => {
    adminFetch<{ staff: Staff }>('/v1/admin/auth/me').then((r) => setStaff(r.staff), () => {});
  }, []);
  if (!staff) return <div className="center muted">Loading…</div>;
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error('useStaff outside StaffProvider');
  return staff;
}

export const can = (staff: Staff, p: Permission) => staff.permissions.includes(p);
