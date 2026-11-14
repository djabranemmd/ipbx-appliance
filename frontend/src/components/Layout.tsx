import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';

// one entry per page of the interface, new pages are added here
const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/extensions', label: 'Extensions', end: false },
  { to: '/users', label: 'Users', end: false },
  { to: '/ranges', label: 'Numbering plan', end: false },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  if (!admin) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col bg-slate-900 md:flex">
        <div className="px-5 py-5 text-lg font-semibold text-white">IPBX Appliance</div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-slate-200 bg-white px-6 py-3">
          <span className="font-semibold text-slate-900 md:hidden">IPBX Appliance</span>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{admin.fullName}</div>
              <div className="text-xs text-slate-500 capitalize">{admin.role}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}