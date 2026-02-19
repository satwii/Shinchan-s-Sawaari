import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import FairSharePage from './pages/FairSharePage';
import DriveShareEntry from './pages/DriveShareEntry';

// DriveShare — Driver pages
import DriverDashboard from './pages/DriverDashboard';
import CreateTrip from './pages/CreateTrip';
import DriverTrips from './pages/DriverTrips';
import DriverBookings from './pages/DriverBookings';

// DriveShare — Rider pages
import RiderDashboard from './pages/RiderDashboard';
import TripBooking from './pages/TripBooking';
import MyBookings from './pages/MyBookings';

// ─── Route Guards ──────────────────────────────────────────────────────────────

function PrivateRoute({ children, requiredRole }) {
  const { user, token, loading } = useAuth();
  if (loading) return null;
  if (!token || !user) return <Navigate to="/" replace />;
  // If a specific DriveShare role is required but user doesn't have it,
  // send them to the DriveShare entry page (role selection)
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/driveshare" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/home" replace />;
  return children;
}

// ─── App ───────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicRoute><AuthPage /></PublicRoute>} />

      {/* Protected — all logged-in users */}
      <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      {/* FairShare — Public Transport Sharing (accessible to all, no role needed) */}
      <Route path="/fairshare" element={<PrivateRoute><FairSharePage /></PrivateRoute>} />
      <Route path="/chat/:rideId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />

      {/* Legacy redirect: /carpooling → /fairshare */}
      <Route path="/carpooling" element={<Navigate to="/fairshare" replace />} />

      {/* DriveShare — Role Selection Entry Point */}
      <Route path="/driveshare" element={<PrivateRoute><DriveShareEntry /></PrivateRoute>} />

      {/* DriveShare — Driver-only routes */}
      <Route path="/driver/dashboard" element={<PrivateRoute requiredRole="driver"><DriverDashboard /></PrivateRoute>} />
      <Route path="/driver/create-trip" element={<PrivateRoute requiredRole="driver"><CreateTrip /></PrivateRoute>} />
      <Route path="/driver/trips" element={<PrivateRoute requiredRole="driver"><DriverTrips /></PrivateRoute>} />
      <Route path="/driver/bookings" element={<PrivateRoute requiredRole="driver"><DriverBookings /></PrivateRoute>} />

      {/* DriveShare — Rider-only routes */}
      <Route path="/rider/dashboard" element={<PrivateRoute requiredRole="rider"><RiderDashboard /></PrivateRoute>} />
      <Route path="/rider/book/:id" element={<PrivateRoute requiredRole="rider"><TripBooking /></PrivateRoute>} />
      <Route path="/rider/bookings" element={<PrivateRoute requiredRole="rider"><MyBookings /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
