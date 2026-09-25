"""Shared fixtures for transport tests that drive auth for real.

Signed tokens plus seeded `users` / `user_roles` rows, rather than patching the
middleware. Falcon binds middleware when the App is constructed, so patching
`AuthMiddleware` after import silently leaves the real one in place and every
request runs as the dev admin.
"""

import time

import falcon.testing
import jwt
import pytest

from nightrunner_backend.main import app, register_routes


@pytest.fixture
async def test_client():
    register_routes(app)
    async with falcon.testing.ASGITestClient(app) as client:
        yield client


@pytest.fixture
def as_role(test_database, rsa_keypair):
    """Builds auth headers for a freshly seeded user holding the given roles.

    Event roles are stored as ``"<event_id>:<role>"`` in a single column; see
    `models/user_roles.py`.
    """
    private_pem, _ = rsa_keypair
    counter = {"n": 0}

    async def _make(roles=(), is_admin=False):
        counter["n"] += 1
        external_id = "perm-user-{}".format(counter["n"])
        user_id = "user-" + external_id

        await test_database.execute(
            """
            INSERT INTO users (id, external_id, username, email, display_name, is_admin, status)
            VALUES (:id, :ext_id, :username, :email, :display_name, :is_admin, 'active')
            """,
            {
                "id": user_id,
                "ext_id": external_id,
                "username": external_id,
                "email": external_id + "@test.local",
                "display_name": external_id,
                "is_admin": is_admin,
            },
        )

        for role in roles:
            await test_database.execute(
                "INSERT INTO user_roles (user_id, role) VALUES (:uid, :role)",
                {"uid": user_id, "role": role},
            )

        payload = {
            "sub": external_id,
            "iss": "http://test-issuer",
            "aud": "test-audience",
            "exp": int(time.time() + 3600),
        }
        token = jwt.encode(payload, private_pem, algorithm="RS256")

        return {
            "Authorization": "Bearer " + token,
            "X-Forwarded-Authorization": "Bearer " + token,
        }

    return _make
