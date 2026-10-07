import { Permission, PERMISSIONS } from '@zinu/shared';

/** System staff roles. Permissions can be extended per phase without code changes to existing roles. */
export const SYSTEM_ROLES: { name: string; description: string; permissions: string[] }[] = [
  { name: 'Super Admin', description: 'Full access to every module', permissions: PERMISSIONS },
  {
    name: 'City Manager',
    description: 'Manages cities, zones and users in assigned cities',
    permissions: [Permission.DASHBOARD_VIEW, Permission.CITIES_VIEW, Permission.CITIES_MANAGE, Permission.ZONES_MANAGE, Permission.USERS_VIEW],
  },
  {
    name: 'Support Agent',
    description: 'Views users and helps resolve issues',
    permissions: [Permission.DASHBOARD_VIEW, Permission.USERS_VIEW, Permission.CITIES_VIEW],
  },
  {
    name: 'Analyst',
    description: 'Read-only access to dashboards and audit logs',
    permissions: [Permission.DASHBOARD_VIEW, Permission.CITIES_VIEW, Permission.USERS_VIEW, Permission.AUDIT_VIEW],
  },
];

/**
 * Initial pilot city. The service-area polygon is an APPROXIMATE rectangle around central Ranchi
 * for development only — redraw the real service zones (Harmu, Morabadi, Kanke, ...) in the admin dashboard.
 */
export const RANCHI = {
  code: 'RNC',
  name: 'Ranchi',
  state: 'Jharkhand',
  timezone: 'Asia/Kolkata',
  centerLat: 23.3441,
  centerLng: 85.3096,
  pilotArea: {
    name: 'Ranchi Pilot Area (approximate)',
    boundary: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [85.25, 23.3],
          [85.4, 23.3],
          [85.4, 23.43],
          [85.25, 23.43],
          [85.25, 23.3],
        ] as [number, number][],
      ],
    },
  },
};
