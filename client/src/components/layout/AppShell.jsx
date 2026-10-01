import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import Button from '../ui/Button';

const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/admin', label: 'Exams' },
    { to: '/admin/fingerprints', label: 'Fingerprints' },
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
  const initials = (user?.name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="isolate min-h-screen bg-base text-text">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.10),_transparent_48%)]"
      />
      <header className="sticky top-0 z-40 border-b border-slate-700/80 bg-slate-950/90 shadow-lg shadow-slate-950/10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-lg font-bold text-primary shadow-inner shadow-primary/10">P</div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Overlay Proctor</div>
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
                    'rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive ? 'border-primary/20 bg-primary/10 text-white shadow-inner shadow-primary/10' : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 hover:text-white',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-indigo-200">
                {initials}
              </span>
              <span className="max-w-36">
                <span className="block truncate text-slate-100">{user?.name || 'User'}</span>
                <span className="block text-[10px] uppercase tracking-wider text-slate-500">{user?.role || 'Account'}</span>
              </span>
            </div>
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={handleLogout}>
              Logout
            </Button>
            <button
              type="button"
              className="inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-lg text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div id="mobile-navigation" className="border-t border-slate-700 bg-slate-950/95 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    [
                      'rounded-xl border px-3 py-2.5 text-sm font-medium',
                      isActive ? 'border-primary/20 bg-primary/10 text-white' : 'border-transparent text-slate-300 hover:bg-slate-800/70',
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

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
