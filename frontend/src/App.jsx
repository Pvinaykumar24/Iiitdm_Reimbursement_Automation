import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import LoginPage    from './pages/auth/Login';
import RegisterPage from './pages/auth/Register';
import FacultyLayout from './components/layout/FacultyLayout';
import SricLayout   from './components/layout/SricLayout';
import DeanLayout   from './components/layout/DeanLayout';

import FacultyDashboard from './pages/faculty/Dashboard';
import NewClaim         from './pages/faculty/NewClaim';
import MyClaims         from './pages/faculty/MyClaims';
import ClaimDetail      from './pages/faculty/ClaimDetails';
import FacultyProfile   from './pages/faculty/Profile';

import SricDashboard     from './pages/sric/Dashboard';
import SricPendingClaims from './pages/sric/PendingClaims';
import SricAllClaims     from './pages/sric/AllClaims';
import SricClaimReview   from './pages/sric/ClaimReview';
import FacultyProfileView from './pages/sric/FacultyProfile';

import DeanDashboard     from './pages/dean/Dashboard';
import DeanPendingClaims from './pages/dean/PendingClaims';
import DeanAllClaims     from './pages/dean/AllClaims';
import DeanClaimReview   from './pages/dean/ClaimReview';
import DeanFacultyProfileView from './pages/dean/FacultyProfile';

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
  if (user.role === 'SRIC')     return <Navigate to="/sric" replace />;
  if (user.role === 'DEAN')     return <Navigate to="/dean" replace />;
  if (user.role === 'ACCOUNTS') return <Navigate to="/accounts" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"      element={<RoleRedirect />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/faculty" element={
          <ProtectedRoute role="FACULTY"><FacultyLayout /></ProtectedRoute>
        }>
          <Route index         element={<FacultyDashboard />} />
          <Route path="claims/new" element={<NewClaim />} />
          <Route path="claims"     element={<MyClaims />} />
          <Route path="claims/:id" element={<ClaimDetail />} />
          <Route path="profile"    element={<FacultyProfile />} />
        </Route>

        <Route path="/sric" element={
          <ProtectedRoute role="SRIC"><SricLayout /></ProtectedRoute>
        }>
          <Route index           element={<SricDashboard />} />
          <Route path="pending"  element={<SricPendingClaims />} />
          <Route path="all-claims" element={<SricAllClaims />} />
          <Route path="claims/:id" element={<SricClaimReview />} />
          <Route path="faculty/:id" element={<FacultyProfileView />} />
        </Route>

        <Route path="/dean" element={
          <ProtectedRoute role="DEAN"><DeanLayout /></ProtectedRoute>
        }>
          <Route index           element={<DeanDashboard />} />
          <Route path="pending"  element={<DeanPendingClaims />} />
          <Route path="all-claims" element={<DeanAllClaims />} />
          <Route path="claims/:id" element={<DeanClaimReview />} />
          <Route path="faculty/:id" element={<DeanFacultyProfileView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}