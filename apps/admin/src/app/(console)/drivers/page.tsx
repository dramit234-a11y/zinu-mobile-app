'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';
import { STATUS_LABELS, statusClass } from '../../../lib/drivers';

interface Row {
  id: string;
  fullName: string | null;
  phone: string | null;
  status: string;
  submittedAt: string | null;
  city: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  pendingDocuments: number;
}

const QUEUE = ['PROFILE_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'SUSPENDED', 'REJECTED', 'NOT_SUBMITTED'];

/** Driver Verification queue (spec §27, §55). New submissions first. */
export default function DriversPage() {
  const [status, setStatus] = useState('PROFILE_SUBMITTED');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (st: string, query: string, after?: string) => {
    try {
      const params = new URLSearchParams({ limit: '25', ...(st ? { status: st } : {}), ...(query ? { q: query } : {}), ...(after ? { cursor: after } : {}) });
      const page = await adminFetch<{ items: Row[]; nextCursor: string | null; counts: Record<string, number> }>(`/v1/admin/drivers?${params}`);
      setRows((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setCounts(page.counts);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load(status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, load]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    load(status, q);
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Driver Verification</h1>
          <div className="muted">Review applications, check each document, then approve, ask for more information or reject. Every action is audited.</div>
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Filter by status">
        {QUEUE.map((s) => (
          <button key={s} className="tab" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {STATUS_LABELS[s]} ({counts[s] ?? 0})
          </button>
        ))}
        <button className="tab" aria-pressed={status === ''} onClick={() => setStatus('')}>
          All
        </button>
      </div>
      <form className="form grid" onSubmit={search} role="search" style={{ marginBottom: 16 }}>
        <label>
          Search name, phone or vehicle number
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Raju or JH01AB1234" />
        </label>
        <button className="btn secondary">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Phone</th>
              <th>City</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Pending docs</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/drivers/${r.id}`}>{r.fullName ?? 'Unnamed applicant'}</Link>
                </td>
                <td>{r.phone}</td>
                <td>{r.city ?? '—'}</td>
                <td>{r.vehicleNumber ? `${r.vehicleNumber} · ${r.vehicleType}` : '—'}</td>
                <td>
                  <span className={statusClass(r.status)}>{STATUS_LABELS[r.status] ?? r.status}</span>
                </td>
                <td>{r.pendingDocuments > 0 ? <span className="pill warn">{r.pendingDocuments}</span> : '—'}</td>
                <td className="muted">{fmtDate(r.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No drivers in this status.</p>}
      </div>
      {cursor && (
        <button className="btn secondary" onClick={() => load(status, q, cursor)}>
          Load more
        </button>
      )}
    </>
  );
}
