'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';
import { statusPill, type City } from '../../../lib/cities';
import { can, useStaff } from '../../../lib/session';

export default function CitiesPage() {
  const staff = useStaff();
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', state: 'Jharkhand', code: '', centerLat: '', centerLng: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => adminFetch<City[]>('/v1/admin/cities').then(setCities, (e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/v1/admin/cities', {
        method: 'POST',
        body: { ...form, code: form.code.toUpperCase(), centerLat: Number(form.centerLat), centerLng: Number(form.centerLng) },
      });
      setForm({ name: '', state: 'Jharkhand', code: '', centerLat: '', centerLng: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Cities & Zones</h1>
          <div className="muted">Every city has its own zones, and later its own pricing, vehicle categories and plans.</div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Code</th>
              <th>State</th>
              <th>Status</th>
              <th>Centre</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/cities/${c.id}`}>{c.name}</Link>
                </td>
                <td>
                  <code>{c.code}</code>
                </td>
                <td>{c.state}</td>
                <td>
                  <span className={statusPill(c.status)}>{c.status}</span>
                </td>
                <td className="muted">
                  {c.centerLat.toFixed(4)}, {c.centerLng.toFixed(4)}
                </td>
                <td className="muted">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {can(staff, 'cities.manage') && (
        <>
          <h2>Add a city</h2>
          <form className="panel form grid" onSubmit={create}>
            <label>
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              State
              <input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </label>
            <label>
              Code (3–6 letters)
              <input required pattern="[A-Za-z]{3,6}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label>
              Centre latitude
              <input required type="number" step="any" value={form.centerLat} onChange={(e) => setForm({ ...form, centerLat: e.target.value })} />
            </label>
            <label>
              Centre longitude
              <input required type="number" step="any" value={form.centerLng} onChange={(e) => setForm({ ...form, centerLng: e.target.value })} />
            </label>
            <button className="btn" disabled={busy}>
              Create city (as Draft)
            </button>
          </form>
        </>
      )}
    </>
  );
}
