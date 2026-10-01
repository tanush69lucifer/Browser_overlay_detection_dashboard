import { Outlet } from 'react-router-dom';

// OWNER: Tanisha. Placeholder: replace with responsive nav + logout.
export default function AppShell() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
