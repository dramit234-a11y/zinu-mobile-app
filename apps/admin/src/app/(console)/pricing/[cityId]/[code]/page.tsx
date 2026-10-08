'use client';

import { calculateFare, formatRupees, type PricingValues } from '@zinu/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminFetch, fmtDate } from '../../../../../lib/api';
import { pct, rupees, toPaise, type CityCategory } from '../../../../../lib/pricing';
import { can, useStaff } from '../../../../../lib/session';

const LINE_LABELS: Record<string, string> = {
  BASE_FARE: 'Base fare',
  DISTANCE: 'Distance charge',
  TIME: 'Time charge',
  MIN_FARE_ADJUSTMENT: 'Minimum fare adjustment',
  NIGHT_SURCHARGE: 'Night charge',
  PLATFORM_FEE: 'Platform fee',
  TAX: 'Tax',
  DISCOUNT: 'Discount',
  ROUNDING: 'Rounding',
};

type Form = Record<'base' | 'baseKm' | 'perKm' | 'perMin' | 'min' | 'platform' | 'taxPct' | 'nightPct' | 'nightStart' | 'nightEnd' | 'note', string>;

const toForm = (p: PricingValues | null): Form => ({
  base: p ? rupees(p.baseFarePaise) : '',
  baseKm: p ? String(p.baseDistanceM / 1000) : '0',
  perKm: p ? rupees(p.perKmPaise) : '',
  perMin: p ? rupees(p.perMinPaise) : '0',
  min: p ? rupees(p.minFarePaise) : '',
  platform: p ? rupees(p.platformFeePaise) : '0',
  taxPct: p ? String(p.taxBps / 100) : '0',
  nightPct: p ? String(p.nightSurchargeBps / 100) : '0',
  nightStart: p ? String(p.nightStartHour) : '22',
  nightEnd: p ? String(p.nightEndHour) : '6',
  note: '',
});

const toValues = (f: Form): PricingValues => ({
  baseFarePaise: toPaise(f.base),
  baseDistanceM: Math.round(parseFloat(f.baseKm || '0') * 1000),
  perKmPaise: toPaise(f.perKm),
  perMinPaise: toPaise(f.perMin),
  minFarePaise: toPaise(f.min),
  platformFeePaise: toPaise(f.platform),
  taxBps: Math.round(parseFloat(f.taxPct || '0') * 100),
  nightSurchargeBps: Math.round(parseFloat(f.nightPct || '0') * 100),
  nightStartHour: parseInt(f.nightStart || '0', 10),
  nightEndHour: parseInt(f.nightEnd || '0', 10),
});

/** Edit a category's fare as a new version, with a live fare simulator using the same engine as the app. */
export default function FareEditor() {
  const { cityId, code } = useParams<{ cityId: string; code: string }>();
  const staff = useStaff();
  const editable = can(staff, 'pricing.manage');
  const [category, setCategory] = useState<CityCategory | null>(null);
  const [history, setHistory] = useState<(PricingValues & { id: string; version: number; note: string | null; createdAt: string })[]>([]);
  const [form, setForm] = useState<Form>(toForm(null));
  const [sim, setSim] = useState({ km: '6', min: '20', hour: '12' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const cats = await adminFetch<CityCategory[]>(`/v1/admin/cities/${cityId}/ride-categories`);
      const c = cats.find((x) => x.code === code) ?? null;
      setCategory(c);
      setForm(toForm(c?.pricing ?? null));
      setHistory(await adminFetch(`/v1/admin/cities/${cityId}/pricing/${code}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [cityId, code]);
  useEffect(() => {
    load();
  }, [load]);

  const values = useMemo(() => toValues(form), [form]);
  const simulated = useMemo(() => {
    // Simulated time of day in IST (UTC+5:30).
    const at = new Date(Date.UTC(2026, 0, 15, parseInt(sim.hour || '12', 10), 0) - 330 * 60_000);
    return calculateFare(values, { distanceM: parseFloat(sim.km || '0') * 1000, durationS: parseFloat(sim.min || '0') * 60, at });
  }, [values, sim]);

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!confirm(`Publish new ${category?.name} fare? New quotes will use it immediately.`)) return;
    try {
      const rule = await adminFetch<{ version: number }>(`/v1/admin/cities/${cityId}/pricing/${code}`, { method: 'POST', body: { ...values, note: form.note || undefined } });
      setNotice(`Published version ${rule.version}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const field = (key: keyof Form, label: string, props: { step?: string; min?: number; max?: number; suffix?: string } = {}) => (
    <label>
      {label}
      <input type="number" step={props.step ?? '0.01'} min={props.min ?? 0} max={props.max} required value={form[key]} disabled={!editable} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/pricing">← Pricing</Link>
      </p>
      <div className="topbar">
        <div>
          <h1>{category?.name ?? code} fare</h1>
          <div className="muted">
            {category?.pricing ? `Current: version ${category.pricing.version}` : 'No fare yet'}
            {category?.perSeat ? ' · priced per seat' : ''}
          </div>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}

      <div className="grid2">
        <form className="panel form" onSubmit={publish} aria-label="New fare version">
          <strong>{editable ? 'New version' : 'Current fare (read-only)'}</strong>
          <div className="form grid">
            {field('base', 'Base fare (₹)')}
            {field('baseKm', 'Distance included in base (km)', { step: '0.1' })}
            {field('perKm', 'Per km after that (₹)')}
            {field('perMin', 'Per minute (₹)')}
            {field('min', 'Minimum fare (₹)')}
            {field('platform', 'Platform fee (₹)')}
            {field('taxPct', 'Tax (%)', { max: 50 })}
            {field('nightPct', 'Night surcharge (%)', { max: 200 })}
            {field('nightStart', 'Night starts (hour, IST)', { step: '1', max: 23 })}
            {field('nightEnd', 'Night ends (hour, IST)', { step: '1', max: 23 })}
          </div>
          <label>
            Note (why this change)
            <input value={form.note} maxLength={200} disabled={!editable} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Tax applies to fare + night charge + platform fee. Confirm the correct GST treatment with your CA before launch.
          </p>
          {editable && (
            <div>
              <button className="btn">Publish new version</button>
            </div>
          )}
        </form>

        <section className="panel" aria-label="Fare simulator">
          <strong>Fare simulator</strong>
          <p className="muted" style={{ fontSize: 13 }}>Uses the values on the left, with the same calculation the app uses.</p>
          <div className="form grid">
            <label>
              Distance (km)
              <input type="number" step="0.1" min={0} value={sim.km} onChange={(e) => setSim({ ...sim, km: e.target.value })} />
            </label>
            <label>
              Duration (min)
              <input type="number" step="1" min={0} value={sim.min} onChange={(e) => setSim({ ...sim, min: e.target.value })} />
            </label>
            <label>
              Hour of day (IST)
              <input type="number" step="1" min={0} max={23} value={sim.hour} onChange={(e) => setSim({ ...sim, hour: e.target.value })} />
            </label>
          </div>
          <table style={{ marginTop: 12 }}>
            <tbody>
              {simulated.lines.map((l) => (
                <tr key={l.code}>
                  <td>{LINE_LABELS[l.code]}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupees(l.amountPaise)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Passenger pays</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{formatRupees(simulated.totalPaise)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <h2>Version history</h2>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Published</th>
              <th>Base</th>
              <th>Per km</th>
              <th>Per min</th>
              <th>Minimum</th>
              <th>Platform</th>
              <th>Tax</th>
              <th>Night</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>v{h.version}</td>
                <td className="muted">{fmtDate(h.createdAt)}</td>
                <td>₹{rupees(h.baseFarePaise)} ({(h.baseDistanceM / 1000).toFixed(1)} km)</td>
                <td>₹{rupees(h.perKmPaise)}</td>
                <td>₹{rupees(h.perMinPaise)}</td>
                <td>₹{rupees(h.minFarePaise)}</td>
                <td>₹{rupees(h.platformFeePaise)}</td>
                <td>{pct(h.taxBps)}</td>
                <td>{pct(h.nightSurchargeBps)}</td>
                <td className="muted">{h.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
