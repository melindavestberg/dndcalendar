import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import './Auth.css';
import './Settings.css';
import { User } from '../types';

interface SettingsProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

function Settings({ user, onUserUpdate }: SettingsProps) {
  const navigate = useNavigate();

  const [username, setUsername] = useState(user.username);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const [email, setEmail] = useState(user.email);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');
    setUsernameLoading(true);

    try {
      const response = await api.patch('/api/auth/me/username', { username }, authHeaders());
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate(updatedUser);
      setUsernameSuccess('Username updated');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setUsernameError(message || 'Failed to update username');
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);

    try {
      const response = await api.patch('/api/auth/me/email', { email }, authHeaders());
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate(updatedUser);
      setEmailSuccess('Email updated');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setEmailError(message || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.patch('/api/auth/me/password', { currentPassword, newPassword }, authHeaders());
      setPasswordSuccess('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setPasswordError(message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="auth-container settings-container">
      <div className="auth-card settings-card">
        <div className="back-button settings-back">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>
        <h1>Settings</h1>

        <section className="settings-section">
          <h2>Username</h2>
          {usernameError && <div className="error">{usernameError}</div>}
          {usernameSuccess && <div className="success">{usernameSuccess}</div>}
          <form onSubmit={handleUsernameSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={usernameLoading}>
              {usernameLoading ? 'Saving...' : 'Save username'}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h2>Email</h2>
          {emailError && <div className="error">{emailError}</div>}
          {emailSuccess && <div className="success">{emailSuccess}</div>}
          <form onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={emailLoading}>
              {emailLoading ? 'Saving...' : 'Save email'}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h2>Password</h2>
          {passwordError && <div className="error">{passwordError}</div>}
          {passwordSuccess && <div className="success">{passwordSuccess}</div>}
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
              {passwordLoading ? 'Saving...' : 'Save password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Settings;
