import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import FairSharePage from './pages/FairSharePage';
import RideDetailPage from './pages/RideDetailPage';
import TrackRidePage from './pages/TrackRidePage';
import ChatPage from './pages/ChatPage';

// DriveShare / Carpooling pages
import DriveShareEntry from './pages/DriveShareEntry';
import DriverDashboard from './pages/DriverDashboard';
import RiderDashboard from './pages/RiderDashboard';
import SawaariAI from './components/SawaariAI';

// Lazy-load optional sub-pages (they may or may not exist)
let CreateTrip, DriverTrips, DriverBookings, TripBooking, MyBookings;
try { CreateTrip = require('./pages/CreateTrip').default; } catch { CreateTrip = null; }
try { DriverTrips = require('./pages/DriverTrips').default; } catch { DriverTrips = null; }
try { DriverBookings = require('./pages/DriverBookings').default; } catch { DriverBookings = null; }
try { TripBooking = require('./pages/TripBooking').default; } catch { TripBooking = null; }
try { MyBookings = require('./pages/MyBookings').default; } catch { MyBookings = null; }

function PrivateRoute({ children }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to="/home" replace />;
  return children;
}

function RoleRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<PublicRoute><AuthPage /></PublicRoute>} />

          {/* Public tracking (no auth) */}
          <Route path="/track/:token" element={<TrackRidePage />} />

          {/* Protected — Core */}
          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/fairshare" element={<PrivateRoute><FairSharePage /></PrivateRoute>} />
          <Route path="/ride/:id" element={<PrivateRoute><RideDetailPage /></PrivateRoute>} />
          <Route path="/chat/:rideId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />

          {/* DriveShare / Carpooling — Role Selection */}
          <Route path="/driveshare" element={<PrivateRoute><DriveShareEntry /></PrivateRoute>} />

          {/* Driver routes */}
          <Route path="/driver/dashboard" element={
            <PrivateRoute><RoleRoute role="driver"><DriverDashboard /></RoleRoute></PrivateRoute>
          } />
          {CreateTrip && (
            <Route path="/driver/create-trip" element={
              <PrivateRoute><RoleRoute role="driver"><CreateTrip /></RoleRoute></PrivateRoute>
            } />
          )}
          {DriverTrips && (
            <Route path="/driver/trips" element={
              <PrivateRoute><RoleRoute role="driver"><DriverTrips /></RoleRoute></PrivateRoute>
            } />
          )}
          {DriverBookings && (
            <Route path="/driver/bookings" element={
              <PrivateRoute><RoleRoute role="driver"><DriverBookings /></RoleRoute></PrivateRoute>
            } />
          )}

          {/* Rider routes */}
          <Route path="/rider/dashboard" element={
            <PrivateRoute><RoleRoute role="rider"><RiderDashboard /></RoleRoute></PrivateRoute>
          } />
          {TripBooking && (
            <Route path="/rider/book/:tripId" element={
              <PrivateRoute><RoleRoute role="rider"><TripBooking /></RoleRoute></PrivateRoute>
            } />
          )}
          {MyBookings && (
            <Route path="/rider/bookings" element={
              <PrivateRoute><RoleRoute role="rider"><MyBookings /></RoleRoute></PrivateRoute>
            } />
          )}

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SawaariAI />
      </Router>
    </AuthProvider>
  );
}
