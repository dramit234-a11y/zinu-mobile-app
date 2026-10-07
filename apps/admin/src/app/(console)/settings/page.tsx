'use client';

import { useEffect, useState } from 'react';
import { adminFetch, fmtDate } from '../../../lib/api';

interface Version {
  platform: string;
  minSupported: string;
  latest: string;
  updatedAt: string;
}

/** App version gate used by the mobile splash screen (force update below the minimum). */
export default function SettingsPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => adminFetch<Version[]>('/v1/admin/app-versions').then(setVersions, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const save = async (v: Version) => {
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/v1/admin/app-versions/${v.platform}`, { method: 'PUT', body: { minSupported: v.minSupported, latest: v.latest } });
      setNotice(`${v.platform} versions saved`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const update = (platform: string, field: 'minSupported' | 'latest', value: string) =>
    setVersions((prev) => prev.map((v) => (v.platform === platform ? { ...v, [field]: value } : v)));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <div className="muted">Mobile app versions. Users below the minimum version are asked to update before continuing.</div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      {versions.map((v) => (
        <form
          key={v.platform}
          className="panel form grid"
          onSubmit={(e) => {
            e.preventDefault();
            save(v);
          }}
        >
          <div>
            <strong style={{ textTransform: 'capitalize' }}>{v.platform}</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              Updated {fmtDate(v.updatedAt)}
            </div>
          </div>
          <label>
            Minimum supported
            <input pattern="\d+\.\d+\.\d+" value={v.minSupported} onChange={(e) => update(v.platform, 'minSupported', e.target.value)} />
          </label>
          <label>
            Latest
            <input pattern="\d+\.\d+\.\d+" value={v.latest} onChange={(e) => update(v.platform, 'latest', e.target.value)} />
          </label>
          <button className="btn">Save</button>
        </form>
      ))}
    </>
  );
}
