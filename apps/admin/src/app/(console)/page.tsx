'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../lib/api';

interface Dashboard {
  activeUsers: number;
  newUsersLast24h: number;
  passengers: number;
  drivers: number;
  driversByVerificationStatus: Record<string, number>;
  activeCities: number;
  activeZones: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Dashboard>('/v1/admin/dashboard').then(setData, (e) => setError(e.message));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="muted">Platform overview. Live operations (drivers online, active rides, SOS) arrive with the ride phases.</div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="cards">
            <Stat label="Active accounts" value={data.activeUsers} />
            <Stat label="New in last 24h" value={data.newUsersLast24h} />
            <Stat label="Passengers" value={data.passengers} />
            <Stat label="Driver applicants" value={data.drivers} />
            <Stat label="Active cities" value={data.activeCities} />
            <Stat label="Active zones" value={data.activeZones} />
          </div>
          <h2>Drivers by verification status</h2>
          <div className="panel">
            {Object.keys(data.driversByVerificationStatus).length === 0 ? (
              <span className="muted">No driver applications yet.</span>
            ) : (
              <table>
                <tbody>
                  {Object.entries(data.driversByVerificationStatus).map(([status, n]) => (
                    <tr key={status}>
                      <td>
                        <span className="pill grey">{status}</span>
                      </td>
                      <td>{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString('en-IN')}</div>
    </div>
  );
}
