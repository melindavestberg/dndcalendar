import { useEffect, useState } from 'react';
import './UserListComponent.css';
import { CalendarMember, Role, RANK, can } from '../types';

interface UserListComponentProps {
  members?: CalendarMember[];
  currentUserId?: string;
  onUpdateColor?: (color: string) => void;
  updatingUserId?: string | null;
  myRole?: Role;
  onKickMember?: (userId: string, username: string) => void;
  onSetRole?: (userId: string, username: string, role: 'admin' | 'member') => void;
  onTransfer?: (userId: string, username: string) => void;
}

const timeAgo = (iso?: string | null): string => {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

function UserListComponent({
  members = [],
  currentUserId,
  onUpdateColor,
  updatingUserId,
  myRole = 'member',
  onKickMember,
  onSetRole,
  onTransfer
}: UserListComponentProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  if (members.length === 0) {
    return <p style={{ color: '#888', fontSize: '0.9rem' }}>No members yet.</p>;
  }

  return (
    <div className="user-list">
      {members.map((member) => {
        const user = member.userId || ({} as CalendarMember['userId']);
        const userId = user.id;
        const canEdit = String(currentUserId) === String(userId);
        const name = user.username || 'this member';
        const showActivity = can(myRole, 'members.viewActivity');

        // To add a manage action, add one entry here; the menu and its visibility follow.
        const actions: { label: string; danger?: boolean; run: () => void }[] = [];
        if (!canEdit) {
          if (onSetRole && can(myRole, 'members.setRole') && member.role !== 'owner') {
            actions.push(
              member.role === 'admin'
                ? { label: 'Remove admin', run: () => onSetRole(userId, name, 'member') }
                : { label: 'Make admin', run: () => onSetRole(userId, name, 'admin') }
            );
          }
          if (onTransfer && can(myRole, 'calendar.transfer') && member.role === 'admin') {
            actions.push({ label: 'Make owner', run: () => onTransfer(userId, name) });
          }
          if (onKickMember && can(myRole, 'members.kick') && RANK[member.role] < RANK[myRole]) {
            actions.push({ label: 'Kick', danger: true, run: () => onKickMember(userId, name) });
          }
        }

        return (
          <div key={userId} className="user-list-item">
            <span
              className="user-list-dot"
              style={{ backgroundColor: user.color || '#9ca3af' }}
              title={user.username || 'Member'}
            >
              {(user.username || '?')[0].toUpperCase()}
            </span>
            <div className="user-list-info">
              <span className="user-list-title">
                <span className="user-list-name">{user.username || 'Unknown user'}</span>
                {member.role !== 'member' && myRole !== 'member' && <span className={`badge ${member.role}`}>{member.role === 'owner' ? 'Owner' : 'Admin'}</span>}
              </span>
              {showActivity && (
                <span className="user-list-activity">
                  <span>Last online {timeAgo(member.lastSeenAt)}</span>
                  <span className={member.lastEditAt ? undefined : 'none'}>
                    {!member.lastEditAt && '● '}Last edit {timeAgo(member.lastEditAt)}
                  </span>
                </span>
              )}
              {canEdit && (
                <label className="user-list-color-picker-wrap">
                  <span className="user-list-color-label">Color:</span>
                  <input
                    type="color"
                    className="user-list-color-picker"
                    value={user.color || '#9ca3af'}
                    aria-label="Choose your color"
                    title="Choose your color"
                    disabled={updatingUserId === userId}
                    onChange={(e) => onUpdateColor && onUpdateColor(e.target.value)}
                  />
                </label>
              )}
              {actions.length > 0 && (
                <div className="user-list-manage">
                  <button
                    className="user-list-role-btn"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === userId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === userId ? null : userId);
                    }}
                  >
                    Manage ▾
                  </button>
                  {openMenuId === userId && (
                    <div className="user-list-menu" role="menu">
                      {actions.map((a) => (
                        <button
                          key={a.label}
                          role="menuitem"
                          className={a.danger ? 'danger' : undefined}
                          onClick={() => a.run()}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default UserListComponent;
