import { Permission, PERMISSIONS } from '@zinu/shared';

/** System staff roles. Permissions can be extended per phase without code changes to existing roles. */
export const SYSTEM_ROLES: { name: string; description: string; permissions: string[] }[] = [
  { name: 'Super Admin', description: 'Full access to every module', permissions: PERMISSIONS },
  {
    name: 'City Manager',
    description: 'Manages cities, zones, users and driver suspensions in assigned cities',
    permissions: [
      Permission.DASHBOARD_VIEW,
      Permission.CITIES_VIEW,
      Permission.CITIES_MANAGE,
      Permission.ZONES_MANAGE,
      Permission.USERS_VIEW,
      Permission.DRIVERS_VIEW,
      Permission.DRIVERS_SUSPEND,
    ],
  },
  {
    name: 'Verification Officer',
    description: 'Reviews driver documents and approves or rejects driver applications',
    permissions: [Permission.DASHBOARD_VIEW, Permission.USERS_VIEW, Permission.DRIVERS_VIEW, Permission.DRIVERS_VERIFY, Permission.DOCUMENTS_VIEW_FILES],
  },
  {
    name: 'Support Agent',
    description: 'Views users and helps resolve issues',
    permissions: [Permission.DASHBOARD_VIEW, Permission.USERS_VIEW, Permission.CITIES_VIEW, Permission.DRIVERS_VIEW],
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

const NON_ELECTRIC = ['PETROL', 'DIESEL', 'CNG', 'LPG'];

/**
 * Default document requirements (spec §26, §41). Inserted once; admins can then change "required",
 * "block online when expired" and reminder days without a deploy.
 */
export const DOCUMENT_TYPES = [
  { code: 'PROFILE_PHOTO', label: 'Profile photo', ownerType: 'DRIVER', required: true, requiresNumber: false, requiresExpiry: false, minFiles: 1, maxFiles: 1, blockOnlineWhenExpired: false, sortOrder: 10 },
  { code: 'DRIVING_LICENCE', label: 'Driving licence', ownerType: 'DRIVER', required: true, requiresNumber: true, requiresExpiry: true, minFiles: 2, maxFiles: 2, blockOnlineWhenExpired: true, sortOrder: 20 },
  { code: 'VEHICLE_RC', label: 'Registration certificate (RC)', ownerType: 'VEHICLE', required: true, requiresNumber: true, requiresExpiry: true, minFiles: 1, maxFiles: 2, blockOnlineWhenExpired: true, sortOrder: 30 },
  { code: 'INSURANCE', label: 'Vehicle insurance', ownerType: 'VEHICLE', required: true, requiresNumber: true, requiresExpiry: true, minFiles: 1, maxFiles: 3, blockOnlineWhenExpired: true, sortOrder: 40 },
  { code: 'PUC', label: 'Pollution certificate (PUC)', ownerType: 'VEHICLE', required: true, requiresNumber: false, requiresExpiry: true, minFiles: 1, maxFiles: 1, blockOnlineWhenExpired: true, sortOrder: 50, fuelTypes: NON_ELECTRIC },
  { code: 'PERMIT', label: 'Permit', ownerType: 'VEHICLE', required: false, requiresNumber: true, requiresExpiry: true, minFiles: 1, maxFiles: 2, blockOnlineWhenExpired: true, sortOrder: 60 },
  { code: 'VEHICLE_PHOTOS', label: 'Vehicle photos (front and back with number plate)', ownerType: 'VEHICLE', required: true, requiresNumber: false, requiresExpiry: false, minFiles: 2, maxFiles: 4, blockOnlineWhenExpired: false, sortOrder: 70 },
];
