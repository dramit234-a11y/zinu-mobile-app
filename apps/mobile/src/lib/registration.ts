import type { DriverRegistrationDto } from '@zinu/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useSession } from './session';

export const REGISTRATION_KEY = ['driver-registration'];

export function useRegistration() {
  return useQuery({ queryKey: REGISTRATION_KEY, queryFn: api.registration });
}

/** Stores a fresh registration returned by a mutation and keeps the session's driver status in sync. */
export function useSetRegistration() {
  const qc = useQueryClient();
  return (dto: DriverRegistrationDto) => {
    qc.setQueryData(REGISTRATION_KEY, dto);
    const user = useSession.getState().user;
    if (user?.driver && user.driver.verificationStatus !== dto.status)
      useSession.getState().setUser({ ...user, driver: { ...user.driver, verificationStatus: dto.status, statusReason: dto.statusReason } });
  };
}

export type DocEntry = DriverRegistrationDto['documents'][number];

/** What the driver should see for a document: its latest version, or "expired" when the one in force lapsed. */
export function docState(e: DocEntry): 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' {
  if (!e.current) return 'NONE';
  return e.current.status;
}
