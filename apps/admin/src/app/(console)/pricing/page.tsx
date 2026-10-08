'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CityPicker } from '../../../components/CityPicker';
import { adminFetch, fmtDate } from '../../../lib/api';
import { firstCityId, pct, rupees, type CityCategory } from '../../../lib/pricing';

/** Spec §13: every fare component is configured here, per city and category. */
export default function PricingPage() {
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
  useEffect(() => {
    if (cityId) adminFetch<CityCategory[]>(`/v1/admin/cities/${cityId}/ride-categories`).then(setRows, (e) => setError(e.message));
  }, [cityId]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Pricing</h1>
          <div className="muted">Fares are versioned: publishing creates a new version for new quotes; earlier quotes keep their version.</div>
        </div>
        <CityPicker cities={cities} value={cityId} onChange={setCityId} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Base (incl.)</th>
              <th>Per km</th>
              <th>Per min</th>
              <th>Minimum</th>
              <th>Platform fee</th>
              <th>Tax</th>
              <th>Night</th>
              <th>Version</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const p = c.pricing;
              return (
                <tr key={c.code}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.perSeat && <div className="muted" style={{ fontSize: 12 }}>per seat</div>}
                    {!c.enabled && <div><span className="pill grey">Not offered</span></div>}
                  </td>
                  {p ? (
                    <>
                      <td>
                        ₹{rupees(p.baseFarePaise)} <span className="muted">({(p.baseDistanceM / 1000).toFixed(1)} km)</span>
                      </td>
                      <td>₹{rupees(p.perKmPaise)}</td>
                      <td>₹{rupees(p.perMinPaise)}</td>
                      <td>₹{rupees(p.minFarePaise)}</td>
                      <td>₹{rupees(p.platformFeePaise)}</td>
                      <td>{pct(p.taxBps)}</td>
                      <td>
                        {pct(p.nightSurchargeBps)} <span className="muted">{p.nightStartHour}:00–{p.nightEndHour}:00</span>
                      </td>
                      <td>
                        v{p.version}
                        <div className="muted" style={{ fontSize: 12 }}>{fmtDate(p.createdAt)}</div>
                        {p.note && <div className="muted" style={{ fontSize: 12 }}>{p.note}</div>}
                      </td>
                    </>
                  ) : (
                    <td colSpan={8} className="muted">
                      No fare yet — this category cannot be quoted.
                    </td>
                  )}
                  <td>
                    <Link className="btn secondary" style={{ minHeight: 34 }} href={`/pricing/${cityId}/${c.code}`}>
                      {p ? 'Edit / history' : 'Set fare'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
