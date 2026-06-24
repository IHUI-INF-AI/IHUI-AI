"""Phase D: Edu Demo Data Seeder

Seeds:
- 1 demo teacher user + 1 demo student user + 1 demo admin user
- 1 sample EduMember per user
- 2 sample courses with chapters/sections
- 1 sample Ask question + 1 sample Circle + 2 sample Circle posts
- 1 sample Live room (scheduled)
- 1 sample PointAccount + some PointRecords

Usage:
    cd G:\\IHUI-AI\\server
    python scripts/seed_demo_data.py [--reset]

Requires the SQLite dev DB to be initialized (just start uvicorn once).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make app importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionFactory1, engine1, Base
from app.models.edu_models import (
    EDU_MODELS, EduAskQuestion, EduCircle, EduCircleMember, EduCirclePost,
    EduLiveRoom, EduMember, EduPointAccount, EduPointRecord,
    EduCourse, EduCourseChapter, EduCourseSection,
)
from app.models.user_models import User, UserAuthInfo


def get_or_create(session, model, defaults=None, **kwargs):
    """Get or create a row by unique field lookup."""
    obj = session.query(model).filter_by(**kwargs).first()
    if obj:
        return obj
    obj = model(**kwargs, **(defaults or {}))
    session.add(obj)
    session.flush()
    return obj


def seed_users(session):
    """Create 3 demo users: admin, teacher, student.

    Note: User model uses uuid (String 64) as PK, with phone as the
    practical unique identifier. No 'username' field on User.
    """
    print("[1/6] Seeding demo users...")
    admin = get_or_create(
        session, User,
        defaults={"phone": "13800000001", "nickname": "Demo Admin",
                  "status": 1, "is_vip": 0, "gender": 0},
        uuid="edu-admin-0001",
    )
    teacher = get_or_create(
        session, User,
        defaults={"phone": "13800000002", "nickname": "Demo Teacher",
                  "status": 1, "is_vip": 0, "gender": 1},
        uuid="edu-teacher-0001",
    )
    student = get_or_create(
        session, User,
        defaults={"phone": "13800000003", "nickname": "Demo Student",
                  "status": 1, "is_vip": 0, "gender": 2},
        uuid="edu-student-0001",
    )
    session.commit()
    print(f"  - admin  uuid={admin.uuid} phone={admin.phone}")
    print(f"  - teacher uuid={teacher.uuid} phone={teacher.phone}")
    print(f"  - student uuid={student.uuid} phone={student.phone}")
    return {"admin": admin, "teacher": teacher, "student": student}


def seed_members(session, users):
    print("[2/6] Seeding EduMember profiles...")
    for role, user in users.items():
        m = get_or_create(
            session, EduMember,
            defaults={
                "real_name": f"Demo {role.capitalize()}",
                "member_type": "student" if role == "student" else "teacher",
                "school": "智汇示范学校",
                "grade": "G3" if role == "student" else None,
                "class_name": "Class A" if role == "student" else None,
                "student_no": f"S{user.uuid:05d}" if role == "student" else None,
                "points": 100 if role == "student" else 0,
                "level": 1,
            },
            user_id=user.uuid,
        )
        print(f"  - {role:8s} member_id={m.id} points={m.points}")
    session.commit()


def seed_courses(session, users):
    print("[3/6] Seeding sample courses...")
    teacher = users["teacher"]

    # Course 1
    c1 = get_or_create(
        session, EduCourse,
        defaults={
            "subtitle": "从零开始掌�?FastAPI + Vue3 + PostgreSQL",
            "description": "本课程系统讲�?Web 全栈开发的关键技术�?,
            "category_id": 1,
            "price": 99.00,
            "original_price": 199.00,
            "student_count": 12,
            "lesson_count": 0,
            "duration_minutes": 0,
            "difficulty": "beginner",
            "is_free": False,
            "is_published": True,
            "published_at": datetime.now(timezone.utc),
            "rating": 4.5,
        },
        teacher_id=teacher.id,
        title="全栈开发实�?,
    )
    # Course 2
    c2 = get_or_create(
        session, EduCourse,
        defaults={
            "subtitle": "AI Agent �?RAG 检索增强生成技�?,
            "description": "深入理解 LLM Agent �?RAG 原理与实践�?,
            "category_id": 2,
            "price": 199.00,
            "original_price": 399.00,
            "student_count": 8,
            "lesson_count": 0,
            "duration_minutes": 0,
            "difficulty": "intermediate",
            "is_free": False,
            "is_published": True,
            "published_at": datetime.now(timezone.utc),
            "rating": 4.8,
        },
        teacher_id=teacher.id,
        title="AI Agent 进阶",
    )

    # Chapters + Sections for course 1
    ch1 = get_or_create(
        session, EduCourseChapter,
        defaults={"sort_order": 1, "description": "环境搭建与基础语法"},
        course_id=c1.id,
        title="�?1 �? FastAPI 基础",
    )
    ch2 = get_or_create(
        session, EduCourseChapter,
        defaults={"sort_order": 2, "description": "SQLAlchemy + Alembic"},
        course_id=c1.id,
        title="�?2 �? 数据�?,
    )

    sec1 = get_or_create(
        session, EduCourseSection,
        defaults={"video_url": "https://example.com/v1.mp4", "duration_seconds": 1800,
                  "resource_url": "https://example.com/v1.pdf", "sort_order": 1,
                  "is_free_preview": True},
        chapter_id=ch1.id,
        course_id=c1.id,
        title="1.1 安装与环�?,
    )
    sec2 = get_or_create(
        session, EduCourseSection,
        defaults={"video_url": "https://example.com/v2.mp4", "duration_seconds": 2400,
                  "resource_url": "https://example.com/v2.pdf", "sort_order": 2,
                  "is_free_preview": False},
        chapter_id=ch1.id,
        course_id=c1.id,
        title="1.2 路由与请�?,
    )
    sec3 = get_or_create(
        session, EduCourseSection,
        defaults={"video_url": "https://example.com/v3.mp4", "duration_seconds": 2700,
                  "resource_url": None, "sort_order": 1, "is_free_preview": False},
        chapter_id=ch2.id,
        course_id=c1.id,
        title="2.1 模型定义",
    )

    # Update course aggregates
    total_seconds = sum(s.duration_seconds for s in [sec1, sec2, sec3])
    c1.lesson_count = 3
    c1.duration_minutes = total_seconds // 60
    session.commit()

    print(f"  - Course 1: {c1.title} (id={c1.id}, lessons=3)")
    print(f"  - Course 2: {c2.title} (id={c2.id})")
    return {"course1": c1, "course2": c2}


def seed_ask(session, users):
    print("[4/6] Seeding Ask Q&A...")
    student = users["student"]
    teacher = users["teacher"]

    q1 = get_or_create(
        session, EduAskQuestion,
        defaults={
            "content": "我用的是 PostgreSQL 14,启动�?alembic 报错:sqlalchemy.exc.NoReferencedColumnError。请教如何解�?",
            "tags": "alembic,postgresql,sqlalchemy",
            "view_count": 5,
            "answer_count": 0,
            "is_resolved": False,
        },
        user_id=student.id,
        title="Alembic migrate 时报�?NoReferencedColumnError?",
    )
    print(f"  - Q1: {q1.title} (id={q1.id}, resolved={q1.is_resolved})")
    session.commit()
    return q1


def seed_circle(session, users):
    print("[5/6] Seeding Circle community...")
    teacher = users["teacher"]
    student = users["student"]

    circle = get_or_create(
        session, EduCircle,
        defaults={
            "description": "讨论全栈开发、AI Agent 与职业发展�?,
            "cover": "https://example.com/circle-cover.jpg",
            "category": "study",
            "is_public": True,
            "member_count": 0,
            "post_count": 0,
        },
        owner_id=teacher.id,
        name="智汇开发者社�?,
    )
    # Add teacher (owner) + student as members
    get_or_create(
        session, EduCircleMember,
        defaults={"role": "owner"},
        circle_id=circle.id,
        user_id=teacher.id,
    )
    get_or_create(
        session, EduCircleMember,
        defaults={"role": "member"},
        circle_id=circle.id,
        user_id=student.id,
    )

    # Posts
    post1 = get_or_create(
        session, EduCirclePost,
        defaults={
            "content": "欢迎加入智汇开发者社�?这里我们分享技术、讨论项目、寻找合作伙伴�?,
            "images": None,
            "like_count": 5,
            "comment_count": 0,
        },
        circle_id=circle.id,
        user_id=teacher.id,
    )
    post2 = get_or_create(
        session, EduCirclePost,
        defaults={
            "content": "刚学�?FastAPI 实战课程,推荐给大�?讲师讲得很清晰�?,
            "images": None,
            "like_count": 2,
            "comment_count": 0,
        },
        circle_id=circle.id,
        user_id=student.id,
    )

    circle.member_count = 2
    circle.post_count = 2
    session.commit()

    print(f"  - Circle: {circle.name} (id={circle.id}, members={circle.member_count}, posts={circle.post_count})")
    return circle


def seed_live(session, users):
    print("[6/6] Seeding Live room...")
    teacher = users["teacher"]
    room = get_or_create(
        session, EduLiveRoom,
        defaults={
            "description": "本周公开�? AI Agent 实战�?,
            "cover": "https://example.com/live-cover.jpg",
            "scheduled_start": datetime.now(timezone.utc) + timedelta(days=2),
            "scheduled_end": datetime.now(timezone.utc) + timedelta(days=2, hours=1),
            "status": "scheduled",
            "stream_url": "rtmp://example.com/live/edu-demo",
            "playback_url": None,
            "max_attendees": 100,
            "attendee_count": 0,
        },
        teacher_id=teacher.id,
        title="公开�? AI Agent 实战入门",
    )
    session.commit()
    print(f"  - Live room: {room.title} (id={room.id}, scheduled={room.scheduled_start})")
    return room


def seed_points(session, users):
    """Seed point accounts + a sample record for student."""
    student = users["student"]
    account = get_or_create(
        session, EduPointAccount,
        defaults={"balance": 100, "frozen": 0, "total_earned": 150, "total_spent": 50},
        user_id=student.id,
    )
    record = get_or_create(
        session, EduPointRecord,
        defaults={
            "change_type": "earn",
            "amount": 100,
            "balance_after": 100,
            "source": "course_signup",
            "remark": "Enrolled in 全栈开发实�?,
        },
        user_id=student.id,
    )
    session.commit()
    print(f"  - Student point account: balance={account.balance}, total_earned={account.total_earned}")


def main():
    parser = argparse.ArgumentParser(description="Phase D Edu Demo Seeder")
    parser.add_argument("--reset", action="store_true",
                        help="Drop and recreate all edu tables first (WARNING: destructive)")
    args = parser.parse_args()

    if args.reset:
        print("[RESET] Dropping edu tables...")
        # Drop only edu tables, preserve other tables
        for model in EDU_MODELS:
            try:
                model.__table__.drop(engine1, checkfirst=True)
            except Exception as e:
                print(f"  Warning dropping {model.__tablename__}: {e}")
        # Recreate all
        for model in EDU_MODELS:
            try:
                model.__table__.create(engine1, checkfirst=True)
            except Exception as e:
                print(f"  Warning creating {model.__tablename__}: {e}")

    # Create only the edu tables that don't exist (no-op if exists)
    print("[INIT] Ensuring edu tables exist...")
    # First, import all models so SQLAlchemy metadata knows about them
    import app.models  # noqa: F401  - registers User, etc.
    import app.models.user_models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    # SQLite dev mode: TenantBase uses __tenant_schema__ = 'public'.
    # Strip the schema for SQLite so tables are created without prefix.
    import os as _os
    if engine1.dialect.name == "sqlite":
        # Strip schema from all tables for SQLite
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None
        print("  [INIT] SQLite mode: stripped schemas from all tables")
    # Create ALL tables (idempotent via checkfirst=True)
    try:
        Base.metadata.create_all(engine1, checkfirst=True)
        print("  [INIT] All tables created/verified")
    except Exception as e:
        print(f"  [INIT] Warning: {e}")
    # Explicitly create edu tables
    for model in EDU_MODELS:
        try:
            model.__table__.create(engine1, checkfirst=True)
        except Exception as e:
            print(f"  Warning creating {model.__tablename__}: {e}")

    session = SessionFactory1()
    try:
        users = seed_users(session)
        seed_members(session, users)
        seed_courses(session, users)
        seed_ask(session, users)
        seed_circle(session, users)
        seed_live(session, users)
        seed_points(session, users)
        session.commit()
        print("\n=== Edu demo seed completed successfully ===")
        print("\nDemo accounts (use these to login at http://127.0.0.1:8000/docs):")
        print("  - edu_admin   / (set password via /api/v1/edu/auth/change-password)")
        print("  - edu_teacher / (set password via /api/v1/edu/auth/change-password)")
        print("  - edu_student / (set password via /api/v1/edu/auth/change-password)")
        print("\nTo login: POST /api/v1/edu/auth/login {\"username\":\"...\",\"password\":\"...\"}")
        print("(Default users have empty password_hash; run update_passwords.py to set demo password 'demo123')")
    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
