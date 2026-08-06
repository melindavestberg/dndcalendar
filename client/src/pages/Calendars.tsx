import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import './Calendars.css';
import LinkIcon from '../icons/link.svg?react';
import CopyIcon from '../icons/copy.svg?react';
import { CalendarMeta, User } from '../types';

function Calendars() {
  const [calendars, setCalendars] = useState<CalendarMeta[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const token = localStorage.getItem('token');
  const currentUser: User | null = JSON.parse(localStorage.getItem('user') || 'null');
  const navigate = useNavigate();

  const getErrorMessage = (err: unknown, fallback: string): string =>
    (axios.isAxiosError(err) && err.response?.data?.error) || fallback;

  const flashSuccess = (message: string, timeout = 3000) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), timeout);
  };

  const fetchCalendars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/calendars/mine', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (typeof res.data === 'string' && res.data.trim().startsWith('<!doctype html>')) {
        console.error('Received HTML instead of JSON. The API request might be hitting the frontend routing (SPA) instead of the backend.');
        setCalendars([]);
        setError('Server returned invalid content (HTML). Please check if the backend is running.');
        return;
      }
      if (Array.isArray(res.data)) {
        setCalendars(res.data);
      } else {
        console.error('Expected array for calendars, got:', res.data);
        setCalendars([]);
        setError('Received invalid data from server');
      }
    } catch (err) {
      console.error('Error fetching calendars:', err);
      setError('Failed to load calendars');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await api.post(
        '/api/calendars/create',
        { name: newName.trim(), description: newDesc.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendars((prev) => [res.data, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      flashSuccess('Calendar created!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create calendar'));
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const res = await api.post(
        '/api/calendars/join',
        { joinCode: joinCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendars((prev) => {
        const exists = prev.find((c) => c.id === res.data.id);
        return exists ? prev : [res.data, ...prev];
      });
      setJoinCode('');
      setShowJoin(false);
      flashSuccess(`Joined "${res.data.name}"!`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to join calendar'));
    }
  };

  const handleLeave = async (calendarId: string, calendarName: string) => {
    if (!window.confirm(`Leave "${calendarName}"?`)) return;
    try {
      await api.post(
        `/api/calendars/${calendarId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendars((prev) => prev.filter((c) => c.id !== calendarId));
      flashSuccess('Left calendar');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to leave calendar'));
    }
  };

  const handleDelete = async (calendarId: string, calendarName: string) => {
    if (!window.confirm(`Delete "${calendarName}" permanently? All availability data will be lost.`)) return;
    try {
      await api.delete(`/api/calendars/${calendarId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendars((prev) => prev.filter((c) => c.id !== calendarId));
      flashSuccess('Calendar deleted');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete calendar'));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    flashSuccess(`Join code "${code}" copied!`, 2500);
  };

  return (
      <div className="calendars-page container">
        <h1> My Calendars</h1>

        {error && <div className="error" onClick={() => setError('')}>{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Action buttons */}
        <div className="calendars-actions">
          <button className="btn btn-primary" onClick={() => { setShowCreate((v) => !v); setShowJoin(false); }}>
            {showCreate ? 'Cancel' : '+ Create Calendar'}
          </button>
          <button className="btn btn-secondary" onClick={() => { setShowJoin((v) => !v); setShowCreate(false); }}>
            {showJoin ? 'Cancel' : <>
              <LinkIcon className="icon"/>Join with Code</>}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form className="calendar-form" onSubmit={handleCreate}>
            <h2>Create a New Calendar</h2>
            <div className="form-group">
              <label>Calendar Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Friday Night Campaign"
                required
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Lost Mines of Phandelver"
              />
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        )}

        {/* Join form */}
        {showJoin && (
          <form className="calendar-form" onSubmit={handleJoin}>
            <h2>Join a Calendar</h2>
            <div className="form-group">
              <label>Join Code *</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A3F9B2"
                maxLength={6}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">Join</button>
          </form>
        )}

        {/* Calendar list */}
        {loading ? (
          <p className="text-muted text-center">Loading calendars...</p>
        ) : calendars.length === 0 ? (
          <div className="empty-state">
            <p>You haven't joined any calendars yet.</p>
            <p>Create one or ask your DM for a join code!</p>
          </div>
        ) : (
          <div className="calendars-grid">
            {calendars.map((cal) => {
              const isOwner = cal.owner.id === currentUser?.id;
              return (
                <div key={cal.id} className="calendar-card-item">
                  <div className="calendar-card-header">
                    <div>
                      <h2>{cal.name}</h2>
                      {cal.description && <p className="cal-desc">{cal.description}</p>}
                    </div>
                    <div className="calendar-card-badges">
                      {isOwner && <span className="badge owner">Owner</span>}
                    </div>
                  </div>

                  {/* Members dots */}
                  <div className="calendar-members">
                    {cal.members.map((m) => (
                      <span
                        key={m.userId?.id}
                        className="member-dot"
                        style={{ backgroundColor: m.userId?.color || '#9ca3af' }}
                        title={m.userId?.username || 'Member'}
                      >
                        {(m.userId?.username || '?')[0].toUpperCase()}
                      </span>
                    ))}
                    <span className="member-count">{cal.members.length} member{cal.members.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Join code */}
                  <div className="join-code-row">
                    <span className="join-code-label">Join code:
                    <code className="join-code">{cal.join_code}</code>
                      </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyCode(cal.join_code)}
                      title="Copy join code"
                    >
                      <CopyIcon className="icon"/>Copy
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="calendar-card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/calendar/${cal.id}`)}
                    >
                      Open Calendar
                    </button>
                    {isOwner ? (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(cal.id, cal.name)}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleLeave(cal.id, cal.name)}
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}

export default Calendars;
