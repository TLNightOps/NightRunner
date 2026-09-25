-- drivers/migrations/027_rename_event_roles.sql
--
-- Role plan agreed 2026-09-24 (#236):
--   event-ops                    -> gate-checkin
--   scoring-lead, scoring-center -> scoring-team
--   scorer, volunteer            -> station-volunteer
--
-- Roles are stored as "<event_id>" + colon + "<role>", so each rename swaps the
-- suffix and keeps the event prefix. The SQL deliberately contains no colon
-- and no percent sign: the Postgres driver rewrites a colon followed by a word
-- into a bind parameter, and psycopg reads a percent sign as a placeholder.
-- Suffixes are matched with SUBSTR and LENGTH instead of LIKE for the same
-- reason. No semicolons in comments either, since the runner splits on them.
--
-- (user_id, role) is the primary key, so a user holding both roles of a merged
-- pair for the same event would collide on rename. Drop the second one first.

DELETE FROM user_roles
WHERE LENGTH(role) >= 14
  AND SUBSTR(role, LENGTH(role) - 13) = 'scoring-center'
  AND EXISTS (
      SELECT 1 FROM user_roles other
      WHERE other.user_id = user_roles.user_id
        AND other.role = SUBSTR(user_roles.role, 1, LENGTH(user_roles.role) - 14) || 'scoring-lead'
  );

DELETE FROM user_roles
WHERE LENGTH(role) >= 9
  AND SUBSTR(role, LENGTH(role) - 8) = 'volunteer'
  AND EXISTS (
      SELECT 1 FROM user_roles other
      WHERE other.user_id = user_roles.user_id
        AND other.role = SUBSTR(user_roles.role, 1, LENGTH(user_roles.role) - 9) || 'scorer'
  );

UPDATE user_roles
SET role = SUBSTR(role, 1, LENGTH(role) - 9) || 'gate-checkin'
WHERE LENGTH(role) >= 9
  AND SUBSTR(role, LENGTH(role) - 8) = 'event-ops';

UPDATE user_roles
SET role = SUBSTR(role, 1, LENGTH(role) - 12) || 'scoring-team'
WHERE LENGTH(role) >= 12
  AND SUBSTR(role, LENGTH(role) - 11) = 'scoring-lead';

UPDATE user_roles
SET role = SUBSTR(role, 1, LENGTH(role) - 14) || 'scoring-team'
WHERE LENGTH(role) >= 14
  AND SUBSTR(role, LENGTH(role) - 13) = 'scoring-center';

UPDATE user_roles
SET role = SUBSTR(role, 1, LENGTH(role) - 6) || 'station-volunteer'
WHERE LENGTH(role) >= 6
  AND SUBSTR(role, LENGTH(role) - 5) = 'scorer';

UPDATE user_roles
SET role = SUBSTR(role, 1, LENGTH(role) - 9) || 'station-volunteer'
WHERE LENGTH(role) >= 9
  AND SUBSTR(role, LENGTH(role) - 8) = 'volunteer'
  AND SUBSTR(role, LENGTH(role) - 16) <> 'station-volunteer'
