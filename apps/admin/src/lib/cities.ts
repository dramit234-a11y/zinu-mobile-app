export interface City {
  id: string;
  code: string;
  name: string;
  state: string;
  timezone: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  centerLat: number;
  centerLng: number;
  createdAt: string;
}

export const statusPill = (s: string) => (s === 'ACTIVE' ? 'pill' : s === 'PAUSED' ? 'pill warn' : 'pill grey');
