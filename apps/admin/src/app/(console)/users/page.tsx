'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';
import { can, useStaff } from '../../../lib/session';

interface UserRow {
  id: string;
  phone: string | null;
  fullName: string | null;
  status: string;
  language: string;
  createdAt: string;
  roles: string[];
}

export default function UsersPage() {
  const staff = useStaff();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string, after?: string) => {
    try {
      const params = new URLSearchParams({ limit: '25', ...(query ? { q: query } : {}), ...(after ? { cursor: after } : {}) });
      const page = await adminFetch<{ items: UserRow[]; nextCursor: string | null }>(`/v1/admin/users?${params}`);
      setRows((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load('');
  }, [load]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    load(q);
  };

  const toggleBlock = async (u: UserRow) => {
    const action = u.status === 'BLOCKED' ? 'unblock' : 'block';
    if (action === 'block' && !confirm(`Block ${u.fullName ?? u.phone}? They will be signed out on all devices.`)) return;
    try {
      await adminFetch(`/v1/admin/users/${u.id}/${action}`, { method: 'POST' });
      setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, status: action === 'block' ? 'BLOCKED' : 'ACTIVE' } : r)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Passengers & Drivers</h1>
          <div className="muted">One account per mobile number; roles show what each person uses ZINU for.</div>
        </div>
      </div>
      <form className="form grid" onSubmit={search} style={{ marginBottom: 16 }} role="search">
        <label>
          Search name or phone
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 98765 or Asha" />
        </label>
        <button className="btn secondary">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Roles</th>
              <th>Language</th>
              <th>Status</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName ?? <span className="muted">Profile incomplete</span>}</td>
                <td>{u.phone}</td>
                <td>
                  {u.roles.length === 0 && <span className="muted">—</span>}
                  {u.roles.map((r) => {
                    const [role, status] = r.split(':');
                    return (
                      <span key={r} className={status === 'ACTIVE' ? 'pill' : 'pill warn'} style={{ marginRight: 4 }}>
                        {role} · {status}
                      </span>
                    );
                  })}
                </td>
                <td>{u.language.toUpperCase()}</td>
                <td>{u.status === 'BLOCKED' ? <span className="pill danger">BLOCKED</span> : <span className="pill">ACTIVE</span>}</td>
                <td className="muted">{fmtDate(u.createdAt)}</td>
                <td style={{ textAlign: 'right' }}>
                  {can(staff, 'users.manage') && (
                    <button className={u.status === 'BLOCKED' ? 'btn secondary' : 'btn danger'} onClick={() => toggleBlock(u)}>
                      {u.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No users found.</p>}
      </div>
      {cursor && (
        <button className="btn secondary" onClick={() => load(q, cursor)}>
          Load more
        </button>
      )}
    </>
  );
}
