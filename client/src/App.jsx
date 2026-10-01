import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProctorHome from './pages/proctor/ProctorHome';
import Console from './pages/proctor/Console';
import SessionDetail from './pages/proctor/SessionDetail';
import Report from './pages/proctor/Report';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/proctor" replace />} />
      <Route path="/proctor" element={<ProctorHome />} />
      <Route path="/proctor/console/:examId" element={<Console />} />
      <Route path="/proctor/console" element={<Console />} />
      <Route path="/proctor/session/:id" element={<SessionDetail />} />
      <Route path="/proctor/report/:examId" element={<Report />} />
      <Route path="/proctor/report" element={<Report />} />
      <Route path="*" element={<Navigate to="/proctor" replace />} />
    </Routes>
  );
}
