'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';

interface AuditRow {
  id: number;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after?: string) => {
    try {
      const page = await adminFetch<{ items: AuditRow[]; nextCursor: string | null }>(`/v1/admin/audit-logs?limit=50${after ? `&cursor=${after}` : ''}`);
      setRows((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Audit Logs</h1>
          <div className="muted">Append-only record of staff actions and sensitive account events.</div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{fmtDate(r.createdAt)}</td>
                <td>
                  <span className="pill grey">{r.actorType}</span> <code>{r.actorId?.slice(-8) ?? 'system'}</code>
                </td>
                <td>
                  <code>{r.action}</code>
                </td>
                <td>{r.entityType ? `${r.entityType} ${r.entityId?.slice(-8) ?? ''}` : '—'}</td>
                <td className="muted">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor && (
        <button className="btn secondary" onClick={() => load(cursor)}>
          Load more
        </button>
      )}
    </>
  );
}
