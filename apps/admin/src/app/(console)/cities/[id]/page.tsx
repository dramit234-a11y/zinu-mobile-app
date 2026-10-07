'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '../../../../lib/api';
import { can, useStaff } from '../../../../lib/session';
import { statusPill, type City } from '../../../../lib/cities';

interface Zone {
  id: string;
  name: string;
  type: string;
  active: boolean;
  areaSqKm: number;
  boundary: { type: 'Polygon'; coordinates: number[][][] };
}

const ZONE_TYPES = ['SERVICE', 'PREFERRED', 'AIRPORT', 'RAILWAY', 'RESTRICTED'];
const EXAMPLE = JSON.stringify({ type: 'Polygon', coordinates: [[[85.3, 23.36], [85.32, 23.36], [85.32, 23.38], [85.3, 23.38]]] });

export default function CityPage() {
  const { id } = useParams<{ id: string }>();
  const staff = useStaff();
  const [city, setCity] = useState<City | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [zone, setZone] = useState({ name: '', type: 'SERVICE', boundary: '' });
  const [probe, setProbe] = useState({ lat: '', lng: '' });
  const [probeResult, setProbeResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCity(await adminFetch<City>(`/v1/admin/cities/${id}`));
      setZones(await adminFetch<Zone[]>(`/v1/admin/cities/${id}/zones`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createZone = (e: FormEvent) => {
    e.preventDefault();
    let boundary: unknown;
    try {
      boundary = JSON.parse(zone.boundary);
    } catch {
      return setError('Boundary must be valid GeoJSON');
    }
    run(async () => {
      await adminFetch(`/v1/admin/cities/${id}/zones`, { method: 'POST', body: { name: zone.name, type: zone.type, boundary } });
      setZone({ name: '', type: 'SERVICE', boundary: '' });
    }, 'Zone created');
  };

  const checkPoint = async (e: FormEvent) => {
    e.preventDefault();
    const hits = await adminFetch<{ name: string; type: string }[]>(`/v1/admin/cities/${id}/zones-at?lat=${probe.lat}&lng=${probe.lng}`);
    setProbeResult(hits.length ? hits.map((h) => `${h.name} (${h.type})`).join(', ') : 'Outside all active zones');
  };

  if (!city) return <p className="muted">{error ?? 'Loading…'}</p>;
  const manageCity = can(staff, 'cities.manage');
  const manageZones = can(staff, 'zones.manage');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>
            {city.name} <span className={statusPill(city.status)}>{city.status}</span>
          </h1>
          <div className="muted">
            {city.state} · <code>{city.code}</code> · {city.timezone}
          </div>
        </div>
        {manageCity && (
          <div style={{ display: 'flex', gap: 8 }}>
            {(['ACTIVE', 'PAUSED', 'DRAFT'] as const)
              .filter((s) => s !== city.status)
              .map((s) => (
                <button key={s} className="btn secondary" onClick={() => run(() => adminFetch(`/v1/admin/cities/${id}`, { method: 'PATCH', body: { status: s } }), `City set to ${s}`)}>
                  Set {s}
                </button>
              ))}
          </div>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}

      <h2>Zones</h2>
      <div className="panel">
        {zones.length === 0 ? (
          <span className="muted">No zones yet.</span>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Area</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>{z.name}</td>
                  <td>
                    <span className="pill grey">{z.type}</span>
                  </td>
                  <td>{z.areaSqKm} km²</td>
                  <td>{z.active ? <span className="pill">Active</span> : <span className="pill warn">Inactive</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {manageZones && (
                      <button className="btn secondary" onClick={() => run(() => adminFetch(`/v1/admin/zones/${z.id}`, { method: 'PATCH', body: { active: !z.active } }), 'Zone updated')}>
                        {z.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2>Check a location</h2>
      <form className="panel form grid" onSubmit={checkPoint}>
        <label>
          Latitude
          <input required type="number" step="any" value={probe.lat} onChange={(e) => setProbe({ ...probe, lat: e.target.value })} />
        </label>
        <label>
          Longitude
          <input required type="number" step="any" value={probe.lng} onChange={(e) => setProbe({ ...probe, lng: e.target.value })} />
        </label>
        <button className="btn secondary">Which zones contain this point?</button>
        {probeResult && <div role="status">{probeResult}</div>}
      </form>

      {manageZones && (
        <>
          <h2>Add a zone</h2>
          <form className="panel form" onSubmit={createZone}>
            <div className="form grid">
              <label>
                Zone name
                <input required value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} placeholder="e.g. Harmu" />
              </label>
              <label>
                Type
                <select value={zone.type} onChange={(e) => setZone({ ...zone, type: e.target.value })}>
                  {ZONE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Boundary (GeoJSON Polygon, [longitude, latitude] pairs)
              <textarea required value={zone.boundary} onChange={(e) => setZone({ ...zone, boundary: e.target.value })} placeholder={EXAMPLE} />
            </label>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Tip: draw the area at geojson.io and paste the polygon geometry. An on-map zone editor arrives with the maps phase.
            </p>
            <div>
              <button className="btn">Create zone</button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
