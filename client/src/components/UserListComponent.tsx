import './UserListComponent.css';
import { CalendarMember } from '../types';

interface UserListComponentProps {
  members?: CalendarMember[];
  currentUserId?: string;
  onUpdateColor?: (color: string) => void;
  updatingUserId?: string | null;
  isOwner?: boolean;
  onKickMember?: (userId: string, username: string) => void;
}

function UserListComponent({
  members = [],
  currentUserId,
  onUpdateColor,
  updatingUserId,
  isOwner = false,
  onKickMember
}: UserListComponentProps) {

  if (members.length === 0) {
    return <p style={{ color: '#888', fontSize: '0.9rem' }}>No members yet.</p>;
  }

  return (
    <div className="user-list">
      {members.map((member) => {
        const user = member.userId || ({} as CalendarMember['userId']);
        const userId = user.id;
        const canEdit = String(currentUserId) === String(userId);

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
              <span className="user-list-name">
                {user.username || 'Unknown user'}
              </span>
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
              {isOwner && !canEdit && onKickMember && (
                <button
                  className="user-list-kick-btn"
                  onClick={() => onKickMember(userId, user.username || 'this member')}
                  title="Remove from calendar"
                >
                  Kick
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default UserListComponent;
