import { Navigate, Route, Routes } from 'react-router';
import RequireAuth from './auth/RequireAuth';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ExtensionsPage from './pages/extensions/ExtensionsPage';
import LoginPage from './pages/LoginPage';
import RangesPage from './pages/ranges/RangesPage';
import SetupPage from './pages/SetupPage';
import UsersPage from './pages/users/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="ranges" element={<RangesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}