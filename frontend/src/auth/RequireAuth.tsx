import { Navigate, Outlet, useLocation } from 'react-router';
import Spinner from '../components/Spinner';
import { useAuth } from './AuthContext';

// wraps every page that needs a signed-in administrator
export default function RequireAuth() {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}