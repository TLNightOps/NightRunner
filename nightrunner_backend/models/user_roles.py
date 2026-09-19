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


# Roles that may create, edit or delete patrols within an event. Scoring roles
# are deliberately absent: the scoring team reads patrol data but does not own
# it. Mirrors `isPatrolManager` in the frontend's UserService.
PATROL_WRITE_ROLES = ("event-admin", "patrol-management")

# Roles that carry system-wide authority regardless of event.
GLOBAL_ADMIN_ROLES = ("admin", "system-admin")


def can_manage_patrols(roles, is_admin=False, event_id=None):
    """Whether a user may create, edit or delete patrols in an event.

    Reads are open to any authenticated user; only mutation is restricted.

    :param roles: iterable of stored role strings, as `req.context.roles` holds.
    :param is_admin: the user's system administrator flag.
    :param event_id: the event whose patrols are being changed.
    :returns: True if the user may change the event's patrols.
    """
    if is_admin:
        return True

    roles_map = roles_to_map(roles)

    if any(role in roles_map for role in GLOBAL_ADMIN_ROLES):
        return True

    if not event_id:
        return False

    return roles_map.get(event_id) in PATROL_WRITE_ROLES
