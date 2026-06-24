"""Phase D: Edu Demo Data Seeder (v4 - minimal).

Seeds only AskQuestion, Circle+CirclePost, LiveRoom (which are edu_*
tables in IHUI-AI's ask_models/circle_models/live_models). Skips
EduCourse (Lesson table) which has schema inconsistencies in dev DB.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionFactory1, engine1, Base
from app.models.edu_models import (
    EDU_MODELS, EduAskQuestion, EduCircle, EduCirclePost,
    EduLiveRoom,
)


def init_tables():
    """Create only ask/circle/live tables (skip lesson which has schema issues)."""
    print("[INIT] Ensuring tables exist...")
    import app.models
    import app.models.user_models
    import app.models.edu_models
    if engine1.dialect.name == "sqlite":
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    # Only create ask/circle/live models (skip lesson)
    from app.models.edu_models import (
        EduAskQuestion, EduAskAnswer, EduAskCategory,
        EduCircle, EduCirclePost, EduCircleMember,
        EduLiveRoom, EduLiveAttendance,
    )
    target_tables = [
        EduAskQuestion.__table__,
        EduAskAnswer.__table__,
        EduAskCategory.__table__,
        EduCircle.__table__,
        EduCirclePost.__table__,
        EduCircleMember.__table__,
        EduLiveRoom.__table__,
        EduLiveAttendance.__table__,
    ]
    for t in target_tables:
        try:
            t.create(engine1, checkfirst=True)
        except Exception as e:
            print(f"  Warning creating {t.name}: {e}")
    print("  [INIT] ask/circle/live tables created/verified")


def seed_circle(session):
    """Seed 1 sample circle + 1 post."""
    print("[1/3] Seeding sample circle...")
    existing = session.query(EduCircle).filter_by(
        name="iHui Developer Community (Demo)"
    ).first()
    if existing:
        print(f"  - Circle already exists: id={existing.id}")
        return existing
    circle = EduCircle(
        name="iHui Developer Community (Demo)",
        description="Demo circle for integration testing.",
        avatar="https://example.com/circle-avatar.jpg",
        cover="https://example.com/circle-cover.jpg",
        owner_id="edu-teacher-0001",
        owner_name="Demo Teacher",
        member_num=1,
        post_num=1,
        status=1,
    )
    session.add(circle)
    session.flush()
    post = EduCirclePost(
        circle_id=circle.id,
        user_id="edu-teacher-0001",
        content="Welcome to the demo circle!",
        images=None,
        like_num=5,
        comment_num=0,
    )
    session.add(post)
    session.commit()
    print(f"  - Circle: {circle.name} (id={circle.id}, members=1, posts=1)")
    return circle


def seed_ask(session):
    """Seed 1 sample ask question."""
    print("[2/3] Seeding sample ask question...")
    existing = session.query(EduAskQuestion).filter_by(
        title="Sample Q: How to use the migration?"
    ).first()
    if existing:
        print(f"  - Question already exists: id={existing.id}")
        return existing
    q = EduAskQuestion(
        title="Sample Q: How to use the migration?",
        content="This is a demo question seeded by seed_demo_data.py for integration testing.",
        member_id="edu-student-0001",
        member_name="Demo Student",
        image=None,
        watch_num=10,
        answer_num=0,
        comment_num=0,
        like_num=0,
        favorite_num=0,
        status="published",
        is_top=False,
        is_essence=False,
        deleted=False,
    )
    session.add(q)
    session.commit()
    print(f"  - Question: {q.title} (id={q.id}, views={q.watch_num})")
    return q


def seed_live(session):
    """Seed 1 sample live room."""
    print("[3/3] Seeding sample live room...")
    from datetime import datetime, timezone, timedelta
    existing = session.query(EduLiveRoom).filter_by(
        title="Demo Live: AI Agent Workshop"
    ).first()
    if existing:
        print(f"  - Live room already exists: id={existing.id}")
        return existing
    room = EduLiveRoom(
        title="Demo Live: AI Agent Workshop",
        description="Demo live session for integration testing.",
        cover="https://example.com/live-cover.jpg",
        host_id="edu-teacher-0001",
        host_name="Demo Teacher",
        push_url="rtmp://example.com/live/edu-demo",
        pull_url="https://example.com/live/edu-demo.m3u8",
        play_url_hls="https://example.com/live/edu-demo.m3u8",
        play_url_rtmp="rtmp://example.com/live/edu-demo",
        status=0,  # 0=scheduled
        type=1,    # 1=public
        price=0,
        is_record=True,
        like_num=0,
        comment_num=0,
        plan_start_time=datetime.now(timezone.utc) + timedelta(days=2),
        start_time=None,
        end_time=None,
    )
    session.add(room)
    session.commit()
    print(f"  - Live room: {room.title} (id={room.id}, status=scheduled)")
    return room


def main():
    print("=== Phase D Edu Demo Seeder (v4) ===")
    print()
    init_tables()
    print()

    session = SessionFactory1()
    try:
        seed_circle(session)
        seed_ask(session)
        seed_live(session)
        session.commit()
        print()
        print("=== Edu demo seed completed successfully ===")
        print()
        print("Test the endpoints:")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/circle/circles?page=1&size=10'")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/ask/questions?page=1&size=10'")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/live/rooms?page=1&size=10'")
    except Exception as e:
        session.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
