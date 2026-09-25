"""Migration 027 renames event roles to the #236 role plan.

CI runs SQLite but production runs Postgres, and the Postgres driver rewrites a
colon followed by a word into a bind parameter (`_map_sql`) while psycopg reads
a percent sign as a placeholder. Either would break the migration on Postgres
only, and a failed migration stops the backend from starting. The static test
below is the only guard a SQLite-backed suite can offer.
"""

import os
import re

import pytest


MIGRATION = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "nightrunner_backend", "drivers", "migrations",
    "027_rename_event_roles.sql",
)


def _statements():
    with open(MIGRATION, encoding="utf-8") as f:
        sql = f.read()
    code = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    return [s.strip() for s in code.split(";") if s.strip()]


def test_migration_sql_is_postgres_safe():
    # The runner sends each semicolon-separated chunk as-is, comments included,
    # so check the raw file with the same pattern `_map_sql` uses.
    with open(MIGRATION, encoding="utf-8") as f:
        sql = f.read()

    assert not re.search(r"(?<!:):([a-zA-Z_]\w*)", sql)
    assert "%" not in sql


async def _seed(db, user_id, roles):
    await db.execute(
        "INSERT INTO users (id, external_id, username, email, display_name) "
        "VALUES (:id, :id, :id, :email, :id)",
        {"id": user_id, "email": user_id + "@test.local"},
    )
    for role in roles:
        await db.execute(
            "INSERT INTO user_roles (user_id, role) VALUES (:uid, :role)",
            {"uid": user_id, "role": role},
        )


async def _roles(db, user_id):
    rows = await db.execute(
        "SELECT role FROM user_roles WHERE user_id = :uid ORDER BY role", {"uid": user_id}
    )
    return [r["role"] for r in rows]


@pytest.mark.asyncio
async def test_old_roles_are_renamed_and_keep_their_event(test_database):
    db = test_database
    await _seed(db, "u-gate", ["evt-1:event-ops"])
    await _seed(db, "u-lead", ["evt-1:scoring-lead", "evt-2:scoring-center"])
    await _seed(db, "u-vol", ["evt-1:scorer", "evt-2:volunteer"])
    await _seed(db, "u-keep", ["evt-1:event-admin", "evt-2:station-lead", "evt-3:patrol-management"])

    for stmt in _statements():
        await db.execute(stmt)

    assert await _roles(db, "u-gate") == ["evt-1:gate-checkin"]
    assert await _roles(db, "u-lead") == ["evt-1:scoring-team", "evt-2:scoring-team"]
    assert await _roles(db, "u-vol") == ["evt-1:station-volunteer", "evt-2:station-volunteer"]
    assert await _roles(db, "u-keep") == [
        "evt-1:event-admin",
        "evt-2:station-lead",
        "evt-3:patrol-management",
    ]


@pytest.mark.asyncio
async def test_merged_pair_on_one_event_does_not_collide(test_database):
    # (user_id, role) is the primary key, so two roles that merge into one for
    # the same event would fail the UPDATE without the DELETE that runs first.
    db = test_database
    await _seed(db, "u-both", [
        "evt-1:scoring-lead", "evt-1:scoring-center",
        "evt-2:scorer", "evt-2:volunteer",
    ])

    for stmt in _statements():
        await db.execute(stmt)

    assert await _roles(db, "u-both") == ["evt-1:scoring-team", "evt-2:station-volunteer"]
