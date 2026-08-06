import { useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Calendar from './pages/Calendar';
import Calendars from './pages/Calendars';
import Settings from './pages/Settings';
import Navigation from './components/Navigation';
import api from './api';
import { User } from './types';
import './App.css';

function ProtectedRoute({ user, children }: { user: User | null; children: ReactNode }) {
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ user, children }: { user: User | null; children: ReactNode }) {
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Validate token by calling the /me endpoint
          const response = await api.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Update user data with fresh data from server
          localStorage.setItem('user', JSON.stringify(response.data));
          setUser(response.data);
        } catch (error) {
          // Token is invalid or expired, clear auth data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  // Listen for logout events from the API interceptor
  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleUserUpdate = (userData: User) => {
    setUser(userData);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        {user && <Navigation user={user} onLogout={handleLogout} />}
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute user={user}>
                <Login onLogin={handleLogin} />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute user={user}>
                <Register onLogin={handleLogin} />
              </GuestRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute user={user}>
                <Calendars />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar/:calendarId"
            element={
              <ProtectedRoute user={user}>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute user={user}>
                {user && <Settings user={user} onUserUpdate={handleUserUpdate} />}
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
