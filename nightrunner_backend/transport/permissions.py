"""Request-level permission checks built on `models/user_roles.py`.

Every write endpoint that is limited to certain roles calls `require_event_role`
so the rule is enforced here and not only in the frontend's menus, which any
signed-in user can bypass by calling the API directly.
"""

import falcon

from nightrunner_backend.models.user_roles import has_event_role, has_role_on_any_event


def _caller(req: falcon.Request):
    user = getattr(req.context, "user", None) or {}
    roles = getattr(req.context, "roles", None) or []
    return user, roles


def require_event_role(req: falcon.Request, event_id, allowed, title, description) -> dict:
    """Rejects the request unless the caller holds one of ``allowed`` for the event.

    :returns: the caller's user record, for endpoints that record who acted.
    :raises falcon.HTTPForbidden: when the caller lacks the role.
    """
    user, roles = _caller(req)

    if has_event_role(roles, bool(user.get("is_admin")), event_id, allowed):
        return user

    raise falcon.HTTPForbidden(title=title, description=description)


def require_role_on_any_event(req: falcon.Request, allowed, title, description) -> dict:
    """Like `require_event_role`, for records shared across events."""
    user, roles = _caller(req)

    if has_role_on_any_event(roles, bool(user.get("is_admin")), allowed):
        return user

    raise falcon.HTTPForbidden(title=title, description=description)
