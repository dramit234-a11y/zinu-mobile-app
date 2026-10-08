import type { PricingValues } from '@zinu/shared';

export interface CityCategory {
  code: string;
  name: string;
  description: string;
  capacity: number;
  vehicleTypes: string[];
  perSeat: boolean;
  enabled: boolean;
  citySortOrder: number;
  pricing: (PricingValues & { id: string; version: number; note: string | null; createdAt: string }) | null;
}

export const rupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, '');
export const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100);
export const pct = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export async function firstCityId(fetcher: <T>(p: string) => Promise<T>) {
  const cities = await fetcher<{ id: string; name: string; status: string }[]>('/v1/admin/cities');
  return { cities, defaultId: (cities.find((c) => c.status === 'ACTIVE') ?? cities[0])?.id ?? null };
}
