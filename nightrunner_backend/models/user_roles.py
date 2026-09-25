"""Helpers for interpreting the role strings stored in `user_roles.role`.

Event roles are persisted as a single string in the form `"<event_id>:<role>"`
(for example `"0198ab...:event-admin"`). Global roles such as `"admin"` or
`"system-admin"` carry no event prefix.

The frontend consumes roles as an `{eventId: role}` map, so every endpoint that
returns roles to a client has to unpack them the same way. Keeping that logic
here stops `/me` and `/users` from disagreeing about the shape.
"""


def roles_to_map(roles):
    """Unpacks stored role strings into an ``{event_id: role}`` mapping.

    Roles without an event prefix are keyed by themselves, so a global
    ``"admin"`` role becomes ``{"admin": "admin"}``.

    :param roles: iterable of stored role strings, or None.
    :returns: dict mapping event ID (or global role name) to role name.
    """
    roles_map = {}

    for role in roles or []:
        if not role:
            continue

        if ":" in role:
            event_id, role_name = role.split(":", 1)
            roles_map[event_id] = role_name
        else:
            roles_map[role] = role

    return roles_map


# Event roles, as the User Manager assigns them. The role plan (#236) is the
# matrix in docs/USER_ROLES_AND_PERMISSIONS.md; the frontend mirrors these in
# src/lib/roles.js, so change both together.
EVENT_ADMIN = "event-admin"
SCORING_TEAM = "scoring-team"
STATION_LEAD = "station-lead"
STATION_VOLUNTEER = "station-volunteer"
COMMAND_CENTER = "command-center"
GATE_CHECKIN = "gate-checkin"
PATROL_MANAGEMENT = "patrol-management"

# Enter, correct and reopen scores, and finalize results. Scores are entered at
# the scoring center by the scoring team, not in the field.
SCORING_ROLES = (EVENT_ADMIN, SCORING_TEAM)

# Check a patrol in or out at any station.
STATION_CHECKIN_ROLES = (EVENT_ADMIN, SCORING_TEAM, STATION_LEAD, STATION_VOLUNTEER)

# Create, edit or delete patrols. Scoring and station roles read patrol data
# but do not own it.
PATROL_WRITE_ROLES = (EVENT_ADMIN, PATROL_MANAGEMENT, COMMAND_CENTER)

# Roles that carry system-wide authority regardless of event.
GLOBAL_ADMIN_ROLES = ("admin", "system-admin")


def has_event_role(roles, is_admin=False, event_id=None, allowed=()):
    """Whether a user holds one of ``allowed`` for an event.

    System admins, and holders of a global admin role, pass for every event.

    :param roles: iterable of stored role strings, as `req.context.roles` holds.
        These are ``"<event_id>:<role>"`` strings, so never test them with
        ``in`` directly -- that is the bug this helper replaces.
    :param is_admin: the user's system administrator flag.
    :param event_id: the event being acted on.
    :param allowed: role names that grant the action.
    :returns: True if the user may act on the event.
    """
    if is_admin:
        return True

    roles_map = roles_to_map(roles)

    if any(role in roles_map for role in GLOBAL_ADMIN_ROLES):
        return True

    if not event_id:
        return False

    return roles_map.get(event_id) in allowed


def can_manage_patrols(roles, is_admin=False, event_id=None):
    """Whether a user may create, edit or delete patrols in an event.

    Reads are open to any authenticated user; only mutation is restricted.
    """
    return has_event_role(roles, is_admin, event_id, PATROL_WRITE_ROLES)


def has_role_on_any_event(roles, is_admin=False, allowed=()):
    """Whether a user holds one of ``allowed`` on at least one event.

    For records that are not tied to one event, such as troops, which are
    shared across events.
    """
    if is_admin:
        return True

    roles_map = roles_to_map(roles)

    if any(role in roles_map for role in GLOBAL_ADMIN_ROLES):
        return True

    return any(role in allowed for role in roles_map.values())
