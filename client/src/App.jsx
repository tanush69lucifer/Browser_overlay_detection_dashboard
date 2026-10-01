import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import { useAuth } from './store/auth';
import Login from './pages/Login';
import MyExams from './pages/candidate/MyExams';
import ExamPage from './pages/candidate/ExamPage';
import ProctorHome from './pages/proctor/ProctorHome';
import Console from './pages/proctor/Console';
import SessionDetail from './pages/proctor/SessionDetail';
import Report from './pages/proctor/Report';
import AdminExams from './pages/admin/AdminExams';
import Fingerprints from './pages/admin/Fingerprints';

const HOME_BY_ROLE = { CANDIDATE: '/candidate', PROCTOR: '/proctor', ADMIN: '/admin' };

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

      <Route element={<ProtectedRoute roles={['PROCTOR', 'ADMIN']} />}>
        <Route element={<AppShell />}>
          <Route path="/proctor" element={<ProctorHome />} />
          <Route path="/proctor/exam/:examId" element={<Console />} />
          <Route path="/proctor/exam/:examId/report" element={<Report />} />
          <Route path="/proctor/session/:sessionId" element={<SessionDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminExams />} />
          <Route path="/admin/fingerprints" element={<Fingerprints />} />
        </Route>
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
