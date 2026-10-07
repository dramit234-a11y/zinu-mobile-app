'use client';

import { Sidebar } from '../../components/Sidebar';
import { StaffProvider } from '../../lib/session';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffProvider>
      <div className="shell">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </StaffProvider>
  );
}
