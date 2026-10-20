-- Per-calendar roles: member < admin < owner. Additive; owner_user_id stays until a later migration.
ALTER TABLE calendar_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','owner'));

-- An owner who is missing from calendar_members would end up with no owner row; add them back.
INSERT INTO calendar_members (calendar_id, user_id, color, joined_at, role)
SELECT c.id, c.owner_user_id, '#6b7280', c.created_at, 'member'
FROM calendars c
WHERE NOT EXISTS (SELECT 1 FROM calendar_members m WHERE m.calendar_id = c.id AND m.user_id = c.owner_user_id);

-- Double-clicking Join could have created duplicate rows if the table has no primary key; keep one per user.
DELETE FROM calendar_members WHERE rowid NOT IN (SELECT MIN(rowid) FROM calendar_members GROUP BY calendar_id, user_id);

UPDATE calendar_members SET role = 'owner'
WHERE EXISTS (SELECT 1 FROM calendars c WHERE c.id = calendar_members.calendar_id AND c.owner_user_id = calendar_members.user_id);

CREATE UNIQUE INDEX one_owner_per_calendar ON calendar_members(calendar_id) WHERE role = 'owner';
