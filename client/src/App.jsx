import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import { useAuth } from './store/auth';
import Login from './pages/Login';
import MyExams from './pages/candidate/MyExams';
import ExamPage from './pages/candidate/ExamPage';
import ProctorHome from './pages/proctor/ProctorHome';
import SessionDetail from './pages/proctor/SessionDetail';
import AdminExams from './pages/admin/AdminExams';
import Fingerprints from './pages/admin/Fingerprints';

const HOME_BY_ROLE = { CANDIDATE: '/candidate', PROCTOR: '/proctor', ADMIN: '/admin' };
const Console = lazy(() => import('./pages/proctor/Console'));
const Report = lazy(() => import('./pages/proctor/Report'));

function RouteLoading() {
  return <div className="rounded-2xl border border-slate-700 bg-surface p-6 text-sm text-slate-300">Loading monitoring data…</div>;
}

function RoleRedirect() {
  const user = useAuth((s) => s.user);
  return <Navigate to={user ? HOME_BY_ROLE[user.role] || '/login' : '/login'} replace />;
}

// Route map is final. Owners replace the page files, not this file.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route element={<ProtectedRoute roles={['CANDIDATE']} />}>
        <Route element={<AppShell />}>
          <Route path="/candidate" element={<MyExams />} />
        </Route>
        {/* Exam page is full-screen (no nav) */}
        <Route path="/candidate/exam/:examId" element={<ExamPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['PROCTOR']} />}>
        <Route element={<AppShell />}>
          <Route path="/proctor" element={<ProctorHome />} />
          <Route path="/proctor/exam/:examId" element={<Suspense fallback={<RouteLoading />}><Console /></Suspense>} />
          <Route path="/proctor/exam/:examId/report" element={<Suspense fallback={<RouteLoading />}><Report /></Suspense>} />
          <Route path="/proctor/session/:sessionId" element={<SessionDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminExams />} />
          <Route path="/admin/fingerprints" element={<Fingerprints />} />
          <Route path="/admin/exams/:examId/report" element={<Suspense fallback={<RouteLoading />}><Report /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
