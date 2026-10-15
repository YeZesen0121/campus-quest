"""Explicitly fictional mentor and operator fixtures, real HTTP and PostgreSQL."""

from uuid import uuid4

from tests.integration.innovation.talent_support import client as client
from tests.integration.innovation.talent_support import clock as clock
from tests.integration.innovation.test_achievement_review_operations import account

OPS = "/api/v1/ie/operations/mentors"
ME = "/api/v1/ie/me/mentor"
PUBLIC = "/api/v1/ie/mentors"


def fields():
    return {
        "name": "模拟导师（演示）",
        "unit": "模拟学院",
        "introduction": "仅用于演示授权流程",
        "directions": "AI 学习",
        "achievements": "模拟课程实验",
        "project_types": "学习实践",
        "contacts": [{"channel": "EMAIL", "value": "mentor@example.com"}],
    }


def command(row):
    return {"request_id": str(uuid4()), "version": row["version"]}


async def prepared(client, db, clock):
    operator, oh = await account(db, clock, operator=True)
    mentor, mh = await account(db, clock, role="MENTOR")
    viewer, vh = await account(db, clock)
    await db.commit()
    response = await client.post(
        OPS,
        headers=oh,
        json={
            "request_id": str(uuid4()),
            "mentor_username": mentor.username,
            "fields": fields(),
        },
    )
    assert response.status_code == 200, response.text
    return operator, oh, mentor, mh, viewer, vh, response.json()["current"]


async def confirm(client, headers, row, **overrides):
    response = await client.post(
        ME + "/confirm",
        headers=headers,
        json={
            **command(row),
            "confirm_profile": True,
            "contact_channels": ["EMAIL"],
            "authorized_fields": ["introduction", "directions"],
            "accepting_contact": True,
            **overrides,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["current"]
