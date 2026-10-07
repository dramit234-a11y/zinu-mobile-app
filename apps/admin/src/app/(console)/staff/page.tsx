'use client';

import { useEffect, useState } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';

interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  role: string;
  lastLoginAt: string | null;
}
interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminFetch<StaffRow[]>('/v1/admin/staff'), adminFetch<Role[]>('/v1/admin/staff-roles')]).then(
      ([s, r]) => {
        setStaff(s);
        setRoles(r);
      },
      (e) => setError(e.message),
    );
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Staff & Permissions</h1>
          <div className="muted">
            Staff accounts are created with the secure CLI (<code>pnpm --filter @zinu/api staff:create</code>), which issues the authenticator secret.
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.fullName}</td>
                <td>{s.email}</td>
                <td>{s.role}</td>
                <td>
                  <span className={s.status === 'ACTIVE' ? 'pill' : 'pill grey'}>{s.status}</span>
                </td>
                <td className="muted">{fmtDate(s.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Roles</h2>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.description}
                  </div>
                </td>
                <td>
                  {r.permissions.map((p) => (
                    <code key={p} style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>
                      {p}
                    </code>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
