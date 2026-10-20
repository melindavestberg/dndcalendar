-- When a member last opened the calendar and last saved availability. Only admins can read these.
ALTER TABLE calendar_members ADD COLUMN last_seen_at TEXT;
ALTER TABLE calendar_members ADD COLUMN last_edit_at TEXT;

-- Approximate: availability rows only keep created_at, so later toggles are not reflected.
UPDATE calendar_members SET last_edit_at = (
  SELECT MAX(a.created_at) FROM availability a
  WHERE a.calendar_id = calendar_members.calendar_id AND a.user_id = calendar_members.user_id
);
