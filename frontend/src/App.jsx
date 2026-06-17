import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import LoginPage from './pages/auth/Login';
import FacultyLayout from './components/layout/FacultyLayout';
import DeanLayout from './components/layout/DeanLayout';

import FacultyDashboard from './pages/faculty/Dashboard';
import NewClaim         from './pages/faculty/NewClaim';
import MyClaims         from './pages/faculty/MyClaims';
import ClaimDetail      from './pages/faculty/ClaimDetails';

import DeanDashboard    from './pages/dean/Dashboard';
import PendingClaims    from './pages/dean/PendingClaims';
import AllClaims        from './pages/dean/AllClaims';
import ClaimReview      from './pages/dean/ClaimReview';

const ProtectedRoute = ({ children, role }) => {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'FACULTY')  return <Navigate to="/faculty" replace />;
  if (user.role === 'DEAN')     return <Navigate to="/dean" replace />;
  if (user.role === 'ACCOUNTS') return <Navigate to="/accounts" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"      element={<RoleRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/faculty" element={
          <ProtectedRoute role="FACULTY"><FacultyLayout /></ProtectedRoute>
        }>
          <Route index         element={<FacultyDashboard />} />
          <Route path="claims/new" element={<NewClaim />} />
          <Route path="claims"     element={<MyClaims />} />
          <Route path="claims/:id" element={<ClaimDetail />} />
        </Route>

        <Route path="/dean" element={
          <ProtectedRoute role="DEAN"><DeanLayout /></ProtectedRoute>
        }>
          <Route index           element={<DeanDashboard />} />
          <Route path="pending"  element={<PendingClaims />} />
          <Route path="all-claims" element={<AllClaims />} />
          <Route path="claims/:id" element={<ClaimReview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}