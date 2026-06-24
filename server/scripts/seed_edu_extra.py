"""Phase E: seed learn + exam + resource for full demo data.

Uses actual IHUI-AI ORM field names from learn_models.py / exam_models.py.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionFactory1, engine1, Base
from app.models.edu_models import (
    EduCourse, EduCourseChapter, EduCourseSection,
    EduPaper, EduQuestion, EduResource,
)


def init_tables():
    print("[INIT] Ensuring learn/exam/resource tables exist...")
    import app.models
    import app.models.user_models
    import app.models.edu_models
    if engine1.dialect.name == "sqlite":
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    target_models = [
        EduCourse, EduCourseChapter, EduCourseSection,
        EduPaper, EduQuestion, EduResource,
    ]
    for m in target_models:
        try:
            m.__table__.create(engine1, checkfirst=True)
        except Exception as e:
            print(f"  Warning creating {m.__tablename__}: {e}")
    print("  [INIT] Done")


def seed_courses(session):
    print("[1/3] Seeding sample courses...")
    existing = session.query(EduCourse).filter_by(name="Full-Stack Web Dev (Demo)").first()
    if existing:
        print(f"  - Course 1 already exists: id={existing.id}")
        return existing
    c = EduCourse(
        name="Full-Stack Web Dev (Demo)",
        code="DEMO-101",
        image="https://example.com/course-cover.jpg",
        status=1,  # 1=published
        phrase="From zero to full-stack web dev",
        introduction="Comprehensive course on FastAPI + Vue3 + PostgreSQL.",
        price=9900,  # in fen (分)
        create_user_id="edu-teacher-0001",
    )
    session.add(c)
    session.flush()
    print(f"  - Course 1: {c.name} (id={c.id}, code={c.code}, status=published)")

    # Chapter 1
    ch1 = EduCourseChapter(
        lesson_id=c.id,
        title="Chapter 1: FastAPI Fundamentals",
        sort_order=1,
        phrase="Setup and basics",
    )
    session.add(ch1)
    session.flush()

    # Sections
    for i, (title, duration) in enumerate([
        ("1.1 Setup and Environment", 1800),
        ("1.2 Routes and Requests", 2400),
    ], start=1):
        sec = EduCourseSection(
            lesson_chapter_id=ch1.id,
            title=title,
            type="video",
            url="https://example.com/v" + str(i) + ".mp4",
            total_time=duration,
            sort_order=i,
        )
        session.add(sec)
    session.commit()
    return c


def seed_papers(session):
    print("[2/3] Seeding sample exam papers...")
    from app.models.exam_models import ExamQuestion
    existing = session.query(EduPaper).filter_by(title="Edu Sample Exam Paper").first()
    if existing:
        print(f"  - Paper already exists: id={existing.id}")
        return existing
    p = EduPaper(
        title="Edu Sample Exam Paper",
        description="Demo exam paper for integration testing.",
        duration=60,
        total_score=100,
        pass_score=60,
        question_num=2,
        status=1,  # 1=published
        difficulty=2,  # 2=medium
    )
    session.add(p)
    session.flush()

    # Add 2 questions using ExamQuestion (not Question - which is question bank)
    for i, (qtype_int, stem, correct, score) in enumerate([
        (1, "What is the capital of France?", "Paris", 50),  # 1=single
        (3, "FastAPI is built on Starlette.", "True", 50),    # 3=judge
    ], start=1):
        q = ExamQuestion(
            paper_id=p.id,
            type=qtype_int,
            title=stem,
            answer=correct,
            score=score,
            difficulty=2,
        )
        session.add(q)
    session.commit()
    print(f"  - Paper: {p.title} (id={p.id}, questions=2)")
    return p


def seed_resources(session):
    print("[3/3] Seeding sample resources...")
    existing = session.query(EduResource).filter_by(resource_name="Sample PDF Notes").first()
    if existing:
        print(f"  - Resource already exists: id={existing.id}")
        return existing
    r = EduResource(
        resource_name="Sample PDF Notes",
        resource_type="pdf",
        resource_url="https://example.com/sample.pdf",
        status=1,
    )
    session.add(r)
    session.commit()
    print(f"  - Resource: {r.resource_name} (id={r.id}, type={r.resource_type})")
    return r


def main():
    print("=== Phase E Edu Extra Seeder (learn + exam + resource) ===")
    print()
    init_tables()
    print()

    session = SessionFactory1()
    try:
        seed_courses(session)
        seed_papers(session)
        seed_resources(session)
        session.commit()
        print()
        print("=== Edu extra seed completed ===")
        print()
        print("Test the new endpoints:")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/learn/courses?page=1&size=10'")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/exam/papers?page=1&size=10'")
        print("  curl 'http://127.0.0.1:8000/api/v1/edu/resource/resources?page=1&size=10'")
    except Exception as e:
        session.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()