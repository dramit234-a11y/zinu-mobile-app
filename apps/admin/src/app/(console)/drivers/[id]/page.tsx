'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch, fmtDate } from '../../../../lib/api';
import { STATUS_LABELS, statusClass, type DocVersion, type DriverDetail } from '../../../../lib/drivers';
import { can, useStaff } from '../../../../lib/session';

type Dialog = null | { kind: 'request-info' | 'reject' | 'suspend' } | { kind: 'reject-doc'; doc: DocVersion; label: string } | { kind: 'reject-payout' };

const fmtDay = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }) : '—');

export default function DriverReviewPage() {
  const { id } = useParams<{ id: string }>();
  const staff = useStaff();
  const [d, setD] = useState<DriverDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const [markDocs, setMarkDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(() => adminFetch<DriverDetail>(`/v1/admin/drivers/${id}`).then(setD, (e) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, body: unknown, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setD(await adminFetch<DriverDetail>(path, { method: 'POST', body }));
      setNotice(success);
      setDialog(null);
      setText('');
      setMarkDocs([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <p className="muted">{error ?? 'Loading…'}</p>;
  const verify = can(staff, 'drivers.verify');
  const suspend = can(staff, 'drivers.suspend');
  const s = d.status;
  const reviewing = s === 'PROFILE_SUBMITTED' || s === 'DOCUMENTS_UNDER_REVIEW';
  const pendingDocs = d.documents.filter((x) => x.current?.status === 'PENDING');

  const submitDialog = (e: FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.kind === 'request-info') act(`/v1/admin/drivers/${id}/request-info`, { message: text, documentIds: markDocs }, 'Sent back to the driver for more information');
    if (dialog.kind === 'reject') act(`/v1/admin/drivers/${id}/reject`, { reason: text }, 'Application rejected');
    if (dialog.kind === 'suspend') act(`/v1/admin/drivers/${id}/suspend`, { reason: text }, 'Driver suspended');
    if (dialog.kind === 'reject-doc') act(`/v1/admin/documents/${dialog.doc.id}/reject`, { reason: text }, `${dialog.label} rejected`);
    if (dialog.kind === 'reject-payout' && d.payout) act(`/v1/admin/payout-accounts/${d.payout.id}/reject`, { reason: text }, 'Payout details rejected');
  };

  return (
    <>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/drivers">← Driver Verification</Link>
      </p>
      <div className="topbar">
        <div>
          <h1>
            {d.personal.fullName ?? 'Unnamed applicant'} <span className={statusClass(s)}>{STATUS_LABELS[s] ?? s}</span>
          </h1>
          <div className="muted">
            {d.phone} · {d.city?.name ?? 'No city'} · submitted {fmtDate(d.submittedAt)}
            {d.approvedAt ? ` · approved ${fmtDate(d.approvedAt)}` : ''}
          </div>
        </div>
      </div>

      <div className="sticky-actions actions" aria-label="Decision">
        {verify && s === 'PROFILE_SUBMITTED' && (
          <button className="btn secondary" disabled={busy} onClick={() => act(`/v1/admin/drivers/${id}/start-review`, {}, 'Review started')}>
            Start review
          </button>
        )}
        {verify && reviewing && (
          <button className="btn" disabled={busy} onClick={() => act(`/v1/admin/drivers/${id}/approve`, {}, 'Driver approved')}>
            Approve driver
          </button>
        )}
        {verify && reviewing && (
          <button className="btn secondary" onClick={() => setDialog({ kind: 'request-info' })}>
            Request more info
          </button>
        )}
        {verify && (reviewing || s === 'ADDITIONAL_INFO_REQUIRED') && (
          <button className="btn danger" onClick={() => setDialog({ kind: 'reject' })}>
            Reject application
          </button>
        )}
        {suspend && s === 'APPROVED' && (
          <button className="btn danger" onClick={() => setDialog({ kind: 'suspend' })}>
            Suspend
          </button>
        )}
        {suspend && s === 'SUSPENDED' && (
          <button className="btn" disabled={busy} onClick={() => act(`/v1/admin/drivers/${id}/reinstate`, {}, 'Driver reinstated')}>
            Reinstate
          </button>
        )}
        {!reviewing && s !== 'APPROVED' && s !== 'SUSPENDED' && s !== 'ADDITIONAL_INFO_REQUIRED' && <span className="muted">No decision needed until the driver submits.</span>}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {d.statusReason && (
        <p className="panel">
          <strong>Message to driver:</strong> {d.statusReason}
        </p>
      )}

      {dialog && (
        <form className="panel form" onSubmit={submitDialog} aria-label="Reason">
          <strong>
            {dialog.kind === 'request-info' && 'Ask the driver for more information'}
            {dialog.kind === 'reject' && 'Reject this application'}
            {dialog.kind === 'suspend' && 'Suspend this driver'}
            {dialog.kind === 'reject-doc' && `Reject ${dialog.label}`}
            {dialog.kind === 'reject-payout' && 'Reject payout details'}
          </strong>
          <label>
            {dialog.kind === 'request-info' ? 'Message shown to the driver' : 'Reason shown to the driver'}
            <textarea required minLength={5} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'inherit', fontSize: 14, minHeight: 80 }} />
          </label>
          {dialog.kind === 'request-info' && pendingDocs.length > 0 && (
            <fieldset style={{ border: 'none', padding: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Documents the driver must upload again</legend>
              {pendingDocs.map((x) => (
                <label key={x.current!.id} style={{ display: 'flex', gap: 8, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={markDocs.includes(x.current!.id)}
                    onChange={(e) => setMarkDocs((m) => (e.target.checked ? [...m, x.current!.id] : m.filter((i) => i !== x.current!.id)))}
                  />
                  {x.type.label}
                </label>
              ))}
            </fieldset>
          )}
          <div className="actions">
            <button className={dialog.kind === 'request-info' ? 'btn' : 'btn danger'} disabled={busy}>
              Confirm
            </button>
            <button type="button" className="btn secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid2">
        <section className="panel" aria-labelledby="elig">
          <h2 id="elig" style={{ marginTop: 0 }}>
            Can go online
          </h2>
          {d.eligibility.canGoOnline ? (
            <span className="pill">Yes</span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {d.eligibility.reasons.map((r) => (
                <li key={r.code + r.message}>{r.message}</li>
              ))}
            </ul>
          )}
          <h2>Checklist</h2>
          {Object.entries(d.checklist).map(([k, ok]) => (
            <div key={k}>
              {ok ? '✓' : '✗'} {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </div>
          ))}
        </section>
        <section className="panel" aria-labelledby="personal">
          <h2 id="personal" style={{ marginTop: 0 }}>
            Personal
          </h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{d.personal.fullName ?? '—'}</dd>
            <dt>Date of birth</dt>
            <dd>{fmtDay(d.personal.dateOfBirth)}</dd>
            <dt>Address</dt>
            <dd>{d.personal.address ?? '—'}</dd>
            <dt>Language</dt>
            <dd>{d.language.toUpperCase()}</dd>
            <dt>Emergency</dt>
            <dd>{d.emergencyContacts.map((c) => `${c.name}${c.relation ? ` (${c.relation})` : ''} ${c.phone}`).join(', ') || '—'}</dd>
          </dl>
        </section>
        <section className="panel" aria-labelledby="vehicle">
          <h2 id="vehicle" style={{ marginTop: 0 }}>
            Vehicle
          </h2>
          {d.vehicle ? (
            <dl className="kv">
              <dt>Number</dt>
              <dd>
                <code>{d.vehicle.registrationNumber}</code>
              </dd>
              <dt>Type / fuel</dt>
              <dd>
                {d.vehicle.vehicleType} · {d.vehicle.fuelType}
              </dd>
              <dt>Ownership</dt>
              <dd>
                {d.vehicle.ownershipType.replace(/_/g, ' ').toLowerCase()}
                {d.vehicle.fleetPartnerName ? ` (${d.vehicle.fleetPartnerName})` : ''}
              </dd>
              <dt>Make / model</dt>
              <dd>{[d.vehicle.make, d.vehicle.model, d.vehicle.colour].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Status</dt>
              <dd>{d.vehicle.status}</dd>
            </dl>
          ) : (
            <span className="muted">Not added</span>
          )}
        </section>
        <section className="panel" aria-labelledby="payout">
          <h2 id="payout" style={{ marginTop: 0 }}>
            Payout
          </h2>
          {d.payout ? (
            <>
              <dl className="kv">
                <dt>Method</dt>
                <dd>{d.payout.method}</dd>
                <dt>Holder</dt>
                <dd>{d.payout.holderName}</dd>
                <dt>Details</dt>
                <dd>{d.payout.maskedLabel}</dd>
                <dt>Status</dt>
                <dd>
                  <span className={statusClass(d.payout.status)}>{d.payout.status.replace(/_/g, ' ')}</span>
                </dd>
              </dl>
              {verify && d.payout.status !== 'VERIFIED' && (
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn secondary" disabled={busy} onClick={() => act(`/v1/admin/payout-accounts/${d.payout!.id}/verify`, {}, 'Payout details verified')}>
                    Mark verified
                  </button>
                  <button className="btn danger" onClick={() => setDialog({ kind: 'reject-payout' })}>
                    Reject
                  </button>
                </div>
              )}
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Full account details are encrypted and never shown. Automatic bank verification arrives with payments.
              </p>
            </>
          ) : (
            <span className="muted">Not added</span>
          )}
        </section>
      </div>

      <h2>Documents</h2>
      <div className="grid2">
        {d.documents.map((x) => (
          <DocumentCard
            key={x.type.code}
            label={x.type.label}
            required={x.type.required}
            current={x.current}
            inForce={x.inForce}
            older={x.versions.filter((v) => v.id !== x.current?.id && v.id !== x.inForce?.id)}
            canDecide={verify && (reviewing || s === 'APPROVED' || s === 'SUSPENDED')}
            busy={busy}
            onApprove={(doc) => act(`/v1/admin/documents/${doc.id}/approve`, {}, `${x.type.label} approved`)}
            onReject={(doc) => setDialog({ kind: 'reject-doc', doc, label: x.type.label })}
            onOpen={setLightbox}
            canViewFiles={can(staff, 'documents.view_files')}
          />
        ))}
      </div>

      <h2>History</h2>
      <div className="panel">
        <ul className="timeline">
          {d.history.map((h) => (
            <li key={h.id}>
              <span className="muted">{fmtDate(h.createdAt)}</span> · <code>{h.action}</code> by {h.actorType.toLowerCase()}
              {h.after && typeof h.after === 'object' && 'reason' in h.after ? ` — ${String(h.after.reason)}` : ''}
            </li>
          ))}
        </ul>
      </div>

      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Document photo" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Document photo, full size" />
        </div>
      )}
    </>
  );
}

function DocumentCard(props: {
  label: string;
  required: boolean;
  current: DocVersion | null;
  inForce: DocVersion | null;
  older: DocVersion[];
  canDecide: boolean;
  canViewFiles: boolean;
  busy: boolean;
  onApprove: (d: DocVersion) => void;
  onReject: (d: DocVersion) => void;
  onOpen: (url: string) => void;
}) {
  const { current, inForce } = props;
  const shown = current ?? inForce;
  return (
    <section className="doc" aria-label={props.label}>
      <div className="doc-head">
        <strong>
          {props.label}
          {!props.required && <span className="muted"> (optional)</span>}
        </strong>
        {shown ? <span className={statusClass(shown.status)}>{shown.status}</span> : <span className="pill grey">NOT ADDED</span>}
      </div>
      {shown && <VersionView doc={shown} canViewFiles={props.canViewFiles} onOpen={props.onOpen} />}
      {current && current.status === 'PENDING' && props.canDecide && (
        <div className="actions">
          <button className="btn" disabled={props.busy} onClick={() => props.onApprove(current)}>
            Approve
          </button>
          <button className="btn danger" onClick={() => props.onReject(current)}>
            Reject
          </button>
        </div>
      )}
      {current && inForce && current.id !== inForce.id && (
        <details style={{ marginTop: 12 }}>
          <summary>Version in force ({inForce.status.toLowerCase()})</summary>
          <VersionView doc={inForce} canViewFiles={props.canViewFiles} onOpen={props.onOpen} />
        </details>
      )}
      {props.older.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="muted">{props.older.length} earlier version(s)</summary>
          {props.older.map((v) => (
            <div key={v.id} style={{ fontSize: 13, marginTop: 6 }}>
              {fmtDate(v.createdAt)} · {v.status}
              {v.superseded ? ' · replaced' : ''}
              {v.rejectionReason ? ` · ${v.rejectionReason}` : ''}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function VersionView({ doc, canViewFiles, onOpen }: { doc: DocVersion; canViewFiles: boolean; onOpen: (u: string) => void }) {
  const [urls, setUrls] = useState<{ url: string; contentType: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Loading photos is an audited view of personal data, so it is an explicit action.
  const show = async () => {
    try {
      setUrls(await Promise.all(doc.fileIds.map((f) => adminFetch<{ url: string; contentType: string }>(`/v1/admin/uploads/${f}/url`))));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div>
      <dl className="kv" style={{ marginTop: 12 }}>
        {doc.documentNumber && (
          <>
            <dt>Number</dt>
            <dd>
              <code>{doc.documentNumber}</code>
            </dd>
          </>
        )}
        {doc.expiresOn && (
          <>
            <dt>Valid until</dt>
            <dd>{fmtDay(doc.expiresOn)}</dd>
          </>
        )}
        <dt>Uploaded</dt>
        <dd>{fmtDate(doc.createdAt)}</dd>
        {doc.rejectionReason && (
          <>
            <dt>Rejected</dt>
            <dd className="error">{doc.rejectionReason}</dd>
          </>
        )}
      </dl>
      {urls ? (
        <div className="thumbs">
          {urls.map((u, i) =>
            u.contentType === 'application/pdf' ? (
              <a key={i} className="thumb" href={u.url} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} className="thumb" src={u.url} alt={`Photo ${i + 1}`} onClick={() => onOpen(u.url)} />
            ),
          )}
        </div>
      ) : canViewFiles ? (
        <button className="btn secondary" style={{ margin: '12px 0', minHeight: 34 }} onClick={show}>
          View {doc.fileIds.length} photo{doc.fileIds.length === 1 ? '' : 's'}
        </button>
      ) : (
        <p className="muted">You do not have permission to view document photos.</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
