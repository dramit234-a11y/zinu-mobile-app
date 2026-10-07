'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Permission } from '@zinu/shared';
import { adminFetch } from '../lib/api';
import { can, useStaff } from '../lib/session';

type Item = { label: string; href?: string; perm?: Permission; phase?: number };

/** Every admin module from spec §55. Modules arrive phase by phase; future ones are listed but inactive. */
const SECTIONS: { title: string; items: Item[] }[] = [
  { title: 'Overview', items: [{ label: 'Dashboard', href: '/', perm: 'dashboard.view' }, { label: 'Live Trips', phase: 4 }] },
  {
    title: 'People',
    items: [
      { label: 'Passengers & Drivers', href: '/users', perm: 'users.view' },
      { label: 'Driver Verification', href: '/drivers', perm: 'drivers.view' },
      { label: 'Corporate Accounts', phase: 12 },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { label: 'Document Rules', href: '/document-rules', perm: 'drivers.view' },
      { label: 'Vehicles', phase: 4 },
      { label: 'ZINU Vehicles', phase: 11 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Cities & Zones', href: '/cities', perm: 'cities.view' },
      { label: 'Pricing', phase: 3 },
      { label: 'Ride Categories', phase: 3 },
      { label: 'Trips', phase: 4 },
      { label: 'Scheduled Rides', phase: 8 },
      { label: 'Shared Routes', phase: 10 },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Payments', phase: 5 },
      { label: 'Driver Payouts', phase: 5 },
      { label: 'Subscriptions', phase: 9 },
      { label: 'Promotions', phase: 12 },
    ],
  },
  {
    title: 'Safety & Support',
    items: [
      { label: 'SOS Incidents', phase: 6 },
      { label: 'Complaints', phase: 6 },
      { label: 'Support', phase: 6 },
      { label: 'Notifications', phase: 6 },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Reports', phase: 13 },
      { label: 'Staff & Permissions', href: '/staff', perm: 'staff.manage' },
      { label: 'Settings', href: '/settings', perm: 'settings.manage' },
      { label: 'Audit Logs', href: '/audit', perm: 'audit.view' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const staff = useStaff();

  const logout = async () => {
    await adminFetch('/v1/admin/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  return (
    <nav className="sidebar" aria-label="Admin navigation">
      <div className="brand">
        <div className="brand-mark">Z</div> ZINU
      </div>
      <div className="nav">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
            {section.items.map((item) =>
              item.href && (!item.perm || can(staff, item.perm)) ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={(item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) ? 'active' : ''}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <span key={item.label} aria-disabled="true">
                  {item.label}
                  {item.phase && <em className="phase">Phase {item.phase}</em>}
                </span>
              ),
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, padding: '0 8px', fontSize: 13 }}>
        <div>{staff.fullName}</div>
        <div style={{ color: '#9fb3aa' }}>{staff.role}</div>
        <button className="btn secondary" style={{ marginTop: 12, minHeight: 34 }} onClick={logout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
