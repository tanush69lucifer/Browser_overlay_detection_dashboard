import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function ProtectedRoute({ roles }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
