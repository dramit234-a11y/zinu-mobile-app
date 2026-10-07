'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/api';
import { can, useStaff } from '../../../lib/session';

interface Rule {
  code: string;
  label: string;
  ownerType: string;
  required: boolean;
  requiresNumber: boolean;
  requiresExpiry: boolean;
  minFiles: number;
  maxFiles: number;
  blockOnlineWhenExpired: boolean;
  reminderDays: number[];
  fuelTypes: string[] | null;
}

/** Spec §41: which documents are required, which expiries block going online, and when reminders go out. */
export default function DocumentRulesPage() {
  const staff = useStaff();
  const editable = can(staff, 'document_rules.manage');
  const [rules, setRules] = useState<Rule[]>([]);
  const [days, setDays] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    adminFetch<Rule[]>('/v1/admin/document-types').then((r) => {
      setRules(r);
      setDays(Object.fromEntries(r.map((x) => [x.code, x.reminderDays.join(', ')])));
    }, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const update = async (code: string, body: Partial<Pick<Rule, 'required' | 'blockOnlineWhenExpired' | 'reminderDays'>>) => {
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/v1/admin/document-types/${code}`, { method: 'PATCH', body });
      setNotice('Saved');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runNow = async () => {
    setError(null);
    try {
      const r = await adminFetch<{ checked: number; reminders: number; expired: number }>('/v1/admin/jobs/document-expiry/run', { method: 'POST' });
      setNotice(`Expiry check done: ${r.checked} documents checked, ${r.reminders} reminders sent, ${r.expired} marked expired.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Document Rules</h1>
          <div className="muted">Expiry is checked every day at 06:00 IST. Reminders go out once at each threshold.</div>
        </div>
        {editable && (
          <button className="btn secondary" onClick={runNow}>
            Run expiry check now
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Applies to</th>
              <th>Required</th>
              <th>Block going online when expired</th>
              <th>Reminder days before expiry</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.code}>
                <td>
                  <strong>{r.label}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.minFiles === r.maxFiles ? r.minFiles : `${r.minFiles}–${r.maxFiles}`} photo(s){r.requiresNumber ? ' · number' : ''}
                    {r.requiresExpiry ? ' · expiry date' : ''}
                  </div>
                </td>
                <td>
                  {r.ownerType === 'DRIVER' ? 'Driver' : 'Vehicle'}
                  {r.fuelTypes ? <div className="muted" style={{ fontSize: 12 }}>{r.fuelTypes.join(', ')} only</div> : null}
                </td>
                <td>
                  <input type="checkbox" aria-label={`${r.label} required`} checked={r.required} disabled={!editable} onChange={(e) => update(r.code, { required: e.target.checked })} />
                </td>
                <td>
                  {r.requiresExpiry ? (
                    <input type="checkbox" aria-label={`Block online when ${r.label} expires`} checked={r.blockOnlineWhenExpired} disabled={!editable} onChange={(e) => update(r.code, { blockOnlineWhenExpired: e.target.checked })} />
                  ) : (
                    <span className="muted">No expiry</span>
                  )}
                </td>
                <td>
                  {r.requiresExpiry ? (
                    <form
                      style={{ display: 'flex', gap: 8 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const list = (days[r.code] ?? '').split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0);
                        update(r.code, { reminderDays: list });
                      }}
                    >
                      <input aria-label={`${r.label} reminder days`} value={days[r.code] ?? ''} disabled={!editable} onChange={(e) => setDays({ ...days, [r.code]: e.target.value })} style={{ width: 140 }} />
                      {editable && <button className="btn secondary" style={{ minHeight: 34 }}>Save</button>}
                    </form>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
