import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import Button from '../ui/Button';

const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/admin', label: 'Exams' },
    { to: '/admin/fingerprints', label: 'Fingerprints' },
    { to: '/proctor', label: 'Proctor' },
  ],
  PROCTOR: [{ to: '/proctor', label: 'My exams' }],
  CANDIDATE: [{ to: '/candidate', label: 'My exams' }],
};

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);

  const links = NAV_BY_ROLE[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-base text-text">
      <header className="sticky top-0 z-40 border-b border-slate-700/80 bg-slate-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-lg font-bold text-primary">P</div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Overlay Proctor</div>
              <div className="text-sm font-semibold text-white">Monitoring console</div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    'rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-surface text-white shadow-inner shadow-primary/20' : 'text-slate-300 hover:bg-slate-800/80',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm sm:flex">
              <span className="h-2.5 w-2.5 rounded-full bg-ok" />
              <span className="text-slate-200">{user?.name || 'User'}</span>
            </div>
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={handleLogout}>
              Logout
            </Button>
            <button
              type="button"
              className="inline-flex rounded-xl border border-slate-700 p-2 text-lg text-slate-200 md:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Menu"
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-700 bg-slate-950 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    [
                      'rounded-xl px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-surface text-white' : 'text-slate-300',
                    ].join(' ')
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <Button variant="ghost" className="mt-2 w-full" onClick={handleLogout}>
                Logout
              </Button>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
