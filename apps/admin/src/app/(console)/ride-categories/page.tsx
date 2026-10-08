'use client';

import { useCallback, useEffect, useState } from 'react';
import { CityPicker } from '../../../components/CityPicker';
import { adminFetch } from '../../../lib/api';
import { firstCityId, type CityCategory } from '../../../lib/pricing';
import { can, useStaff } from '../../../lib/session';

/** Spec §12, §55: which ride categories each city offers. A category is bookable only when enabled and priced. */
export default function RideCategoriesPage() {
  const staff = useStaff();
  const editable = can(staff, 'pricing.manage');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [rows, setRows] = useState<CityCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firstCityId(adminFetch).then(({ cities, defaultId }) => {
      setCities(cities);
      setCityId(defaultId);
    }, (e) => setError(e.message));
  }, []);
  const load = useCallback(() => {
    if (cityId) adminFetch<CityCategory[]>(`/v1/admin/cities/${cityId}/ride-categories`).then(setRows, (e) => setError(e.message));
  }, [cityId]);
  useEffect(load, [load]);

  const update = async (code: string, body: { enabled?: boolean; sortOrder?: number }) => {
    setError(null);
    try {
      await adminFetch(`/v1/admin/cities/${cityId}/ride-categories/${code}`, { method: 'PATCH', body });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Ride Categories</h1>
          <div className="muted">Passengers see a category only when it is enabled here and has a fare in Pricing.</div>
        </div>
        <CityPicker cities={cities} value={cityId} onChange={setCityId} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Seats</th>
              <th>Served by</th>
              <th>Priced</th>
              <th>Order</th>
              <th>Offered in this city</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {c.description}
                    {c.perSeat ? ' · priced per seat' : ''}
                  </div>
                </td>
                <td>{c.capacity}</td>
                <td>{c.vehicleTypes.join(', ')}</td>
                <td>{c.pricing ? <span className="pill">v{c.pricing.version}</span> : <span className="pill warn">No fare</span>}</td>
                <td>
                  <input type="number" min={0} max={100} defaultValue={c.citySortOrder} disabled={!editable} style={{ width: 70 }} aria-label={`${c.name} display order`} onBlur={(e) => Number(e.target.value) !== c.citySortOrder && update(c.code, { sortOrder: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="checkbox" checked={c.enabled} disabled={!editable} aria-label={`Offer ${c.name}`} onChange={(e) => update(c.code, { enabled: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
