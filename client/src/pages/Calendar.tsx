import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import CalendarComponent from '../components/CalendarComponent';
import UserListComponent from '../components/UserListComponent';
import './Calendar.css';
import KeyIcon from '../icons/key.svg?react';
import CopyIcon from '../icons/copy.svg?react';
import { AvailabilityByDate, AvailabilityRecord, CalendarMeta, DisabledDateRecord, User } from '../types';

function Calendar() {
  const { calendarId } = useParams<{ calendarId: string }>();
  const navigate = useNavigate();
  const currentUser: User | null = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  const [calendarMeta, setCalendarMeta] = useState<CalendarMeta | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [myAvailabilities, setMyAvailabilities] = useState<AvailabilityRecord[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = useState<AvailabilityByDate>({});
  const [disabledDates, setDisabledDates] = useState<DisabledDateRecord[]>([]);
  const [adminDisableMode, setAdminDisableMode] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedDateForInspect, setSelectedDateForInspect] = useState<string | null>(null);
  const [updatingColorUserId, setUpdatingColorUserId] = useState<string | null | undefined>(null);
  const [pendingToggleDateKey, setPendingToggleDateKey] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getErrorMessage = (err: unknown, fallback: string): string =>
    (axios.isAxiosError(err) && err.response?.data?.error) || fallback;

  const fetchAvailability = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!calendarId) return;

    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const response = await api.get(
        `/api/availability/${calendarId}/month/${year}/${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMyAvailabilities(response.data.myAvailabilities || []);
      setAvailabilityByDate(response.data.availabilityByDate || {});
      setDisabledDates(response.data.disabledDates);
    } catch {
      setError('Failed to fetch availability');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [calendarId, year, month, token]);

  // Load calendar metadata (name, owner, members)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await api.get(`/api/calendars/${calendarId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCalendarMeta(res.data);
      } catch {
        setError('Calendar not found or you are not a member.');
      }
    };
    fetchMeta();
  }, [calendarId, token]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    if (!inspectMode) {
      setSelectedDateForInspect(null);
    }
  }, [inspectMode]);

  useEffect(() => {
    setSelectedDateForInspect(null);
  }, [month, year]);

  const handleToggleDate = async (dateKey: string) => {
    if (pendingToggleDateKey === dateKey) return;

    try {
      setPendingToggleDateKey(dateKey);
      await api.post(
        `/api/availability/${calendarId}/toggle`,
        { date: dateKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAvailability({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to toggle date'));
    } finally {
      setPendingToggleDateKey(null);
    }
  };

  const handleAdminToggleDate = async (dateKey: string, isCurrentlyDisabled: boolean) => {
    try {
      const endpoint = isCurrentlyDisabled
        ? `/api/admin/${calendarId}/enable-date`
        : `/api/admin/${calendarId}/disable-date`;
      const payload = isCurrentlyDisabled
        ? { date: dateKey }
        : { date: dateKey, reason: 'Disabled from calendar by owner' };

      await api.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchAvailability({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update date'));
    }
  };

  const handleUpdateMyColor = async (color: string) => {
    try {
      setUpdatingColorUserId(currentUser?.id);
      const res = await api.patch(
        `/api/calendars/${calendarId}/color`,
        { color },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedUser = res.data.user;

      setCalendarMeta((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((member) => {
            const user = member.userId;
            if (String(user.id) !== String(currentUser?.id)) {
              return member;
            }
            return {
              ...member,
              userId: {
                ...user,
                color: updatedUser.color
              }
            };
          })
        };
      });

      setAvailabilityByDate((prev) => {
        const next: AvailabilityByDate = {};
        Object.entries(prev).forEach(([dateKey, users]) => {
          next[dateKey] = users.map((user) =>
            String(user.userId) === String(currentUser?.id)
              ? { ...user, color: updatedUser.color }
              : user
          );
        });
        return next;
      });

      const storedUser: User | null = JSON.parse(localStorage.getItem('user') || 'null');
      if (storedUser?.id === updatedUser.id) {
        localStorage.setItem('user', JSON.stringify({ ...storedUser, color: updatedUser.color }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update color'));
    } finally {
      setUpdatingColorUserId(null);
    }
  };

  const handleKickMember = async (userId: string, username: string) => {
    if (!window.confirm(`Remove ${username} from this calendar?`)) return;
    try {
      const res = await api.post(
        `/api/calendars/${calendarId}/kick`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendarMeta(res.data);
      fetchAvailability({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove member'));
    }
  };

  const handlePreviousMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); }
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); }
  };

  const isOwner = calendarMeta && currentUser && calendarMeta.owner?.id === currentUser.id;

  return (
      <div className="calendar-card">
        {/* Back + title */}
        <div className="calendar-page-header">
          <div className="back-button">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
              ← Back
            </button>
          </div>
          <div>
            <h1>{calendarMeta ? calendarMeta.name : 'Loading...'}</h1>
            {calendarMeta?.description && (
              <p className="cal-subtitle">{calendarMeta.description}</p>
            )}
          </div>
          {calendarMeta && (
            <div className="join-code-pill" title="Share this code with your party">
              <KeyIcon className="icon"/>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(calendarMeta.join_code);
                }}
                title="Copy join code"
              ><CopyIcon className="icon"/>Copy
                </button>
            </div>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        {/* Month navigation */}
        <div className="month-controls">
          <button onClick={handlePreviousMonth} className="btn btn-secondary">← </button>
          <h2>{new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
          <button onClick={handleNextMonth} className="btn btn-secondary"> →</button>
        </div>

          <CalendarComponent
            month={month}
            year={year}
            myAvailabilities={myAvailabilities}
            availabilityByDate={availabilityByDate}
            disabledDates={disabledDates}
            onToggleDate={handleToggleDate}
            onAdminToggleDate={handleAdminToggleDate}
            adminDisableMode={adminDisableMode}
            inspectMode={inspectMode}
            selectedDateForInspect={selectedDateForInspect}
            onSelectDateForInspect={setSelectedDateForInspect}
          />

        <div className="options">
          {/* Admin disable mode toggle (owners only) */}
          {isOwner && (
              <div className="admin-toggle-row">
                Block Mode
                <label className="switch">
                  <input type="checkbox"
                         id="adminDisableMode"
                         checked={adminDisableMode}
                         onChange={(e) => setAdminDisableMode(e.target.checked)}/>
                  <span className="slider round"></span>
                </label>
              </div>
          )}

          {/* Inspect mode toggle */}
          <div className="inspect-toggle-row">
            Inspect Mode
            <label className="switch">
              <input type="checkbox"
                     id="inspectMode"
                     checked={inspectMode}
                     onChange={(e) => setInspectMode(e.target.checked)}/>
              <span className="slider round"></span>
            </label>
          </div>
        </div>
        {/* Available users for selected date */}
        {inspectMode && selectedDateForInspect && (
          <div className="inspect-result">
            <h3>Available on {new Date(selectedDateForInspect + 'T00:00:00').toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <div className="available-users">
              {availabilityByDate[selectedDateForInspect] && availabilityByDate[selectedDateForInspect].length > 0 ? (
                <ul>
                  {availabilityByDate[selectedDateForInspect].map((user) => (
                    <li key={user.userId} style={{ borderLeftColor: user.color }}>
                      <span className="user-color-dot" style={{ backgroundColor: user.color }}></span>
                      <span className="user-name">{user.username}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-availability">No one marked as available on this date.</p>
              )}
            </div>
          </div>
        )}
        {/* Legend */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-box available"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-box unavailable"></div>
            <span>Unavailable</span>
          </div>
          <div className="legend-item">
            <div className="legend-box disabled"></div>
            <span>Blocked</span>
          </div>
          <div className="legend-item">
            <div className="legend-dots-sample">
              <span className="legend-dot" style={{ background: '#75db70' }}></span>
              <span className="legend-dot" style={{ background: '#449cc2' }}></span>
              <span className="legend-dot" style={{ background: '#ba4390' }}></span>
            </div>
            <span>Player dots</span>
          </div>
        </div>

        {/* Members sidebar */}
        {calendarMeta && (
          <div className="members-section">
            <h3>Party Members</h3>
            <UserListComponent
              members={calendarMeta.members}
              currentUserId={currentUser?.id}
              onUpdateColor={handleUpdateMyColor}
              updatingUserId={updatingColorUserId}
              isOwner={Boolean(isOwner)}
              onKickMember={handleKickMember}
            />
          </div>
        )}
    </div>
  );
}

export default Calendar;
