"""把 skills/{content_engine,koubo_workflow}/已发布内容记忆.json 迁移到 self_media_published 表。

用法:
  python -m app.scripts.migrate_self_media_history            # 直连默认 DB
  python -m app.scripts.migrate_self_media_history --dry-run  # 只打印不写库
  DATABASE_URL=postgresql://... python -m app.scripts.migrate_self_media_history

迁移规则:
1. content_engine/已发布内容记忆.json 的 published[*] → category='wechat',title+date
2. koubo_workflow/materials/已发布内容记忆.json 的 published[*] → category='koubo',title+date
3. 重复 title + category 跳过(onConflictDoNothing 语义)
4. date 字段(YYYY-MM-DD) → created_at(用 date + 12:00:00Z),updatedAt 同
5. status='published',topic_keyword=digest(若有)
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# 让脚本可独立运行(不依赖 app 包导入)
ROOT = Path(__file__).resolve().parent.parent.parent  # apps/ai-service/
sys.path.insert(0, str(ROOT))

CONTENT_ENGINE_JSON = ROOT / "app" / "skills" / "content_engine" / "已发布内容记忆.json"
KOUBO_JSON = ROOT / "app" / "skills" / "koubo_workflow" / "materials" / "已发布内容记忆.json"


def _parse_date(s: str) -> str:
    """把 YYYY-MM-DD 或 YYYY/MM/DD 转为 ISO timestamp;失败返回当前时间。"""
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            d = datetime.strptime(s, fmt)
            return d.replace(hour=12, minute=0, second=0).isoformat() + "Z"
        except ValueError:
            continue
    return datetime.utcnow().isoformat() + "Z"


def _load_published(path: Path) -> list[dict[str, Any]]:
    """从 json 文件读 published 数组(容错:文件不存在/格式异常返回空)。"""
    if not path.is_file():
        print(f"[warn] 文件不存在: {path}")
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[warn] JSON 解析失败 {path}: {e}")
        return []
    pub = data.get("published", [])
    if not isinstance(pub, list):
        return []
    return [p for p in pub if isinstance(p, dict) and p.get("title")]


async def _ensure_table(conn: "asyncpg.Connection") -> None:
    """确保 self_media_published 表存在(若 migration 未跑过则手工建)。"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS self_media_published (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category VARCHAR(16) NOT NULL,
            title VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'published',
            draft_id VARCHAR(128),
            topic_keyword VARCHAR(200),
            payload JSONB,
            author_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_self_media_published_category
            ON self_media_published(category)
    """)
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_self_media_published_created_at
            ON self_media_published(created_at DESC)
    """)


async def _insert_records(conn: "asyncpg.Connection", category: str, records: list[dict[str, Any]]) -> tuple[int, int]:
    """插入记录,返回 (inserted, skipped)。重复 (category, title) 跳过。"""
    inserted = 0
    skipped = 0
    for r in records:
        title = (r.get("title") or "").strip()[:200]
        if not title:
            skipped += 1
            continue
        date_str = _parse_date(r.get("date", ""))
        topic = (r.get("digest") or r.get("topic") or "").strip()[:200]
        payload = json.dumps(r, ensure_ascii=False)
        try:
            result = await conn.execute(
                """
                INSERT INTO self_media_published
                    (category, title, status, topic_keyword, payload, created_at, updated_at)
                VALUES ($1, $2, 'published', $3, $4::jsonb, $5::timestamptz, $5::timestamptz)
                ON CONFLICT DO NOTHING
                """,
                category, title, topic or None, payload, date_str,
            )
            # asyncpg execute 返回 "INSERT 0 1" 表示插入 1 行,"INSERT 0 0" 表示跳过
            if result.endswith(" 1"):
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"[warn] 插入失败 (cat={category} title={title[:40]}): {e}")
            skipped += 1
    return inserted, skipped


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只打印,不写库")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""), help="PostgreSQL DSN")
    args = parser.parse_args()

    wechat_records = _load_published(CONTENT_ENGINE_JSON)
    koubo_records = _load_published(KOUBO_JSON)
    print(f"[info] 加载公众号历史: {len(wechat_records)} 条")
    print(f"[info] 加载口播稿历史: {len(koubo_records)} 条")

    if args.dry_run:
        for r in wechat_records[:5]:
            print(f"  [wechat] {r.get('date', '?')} | {r.get('title', '')[:60]}")
        for r in koubo_records[:5]:
            print(f"  [koubo ] {r.get('date', '?')} | {r.get('title', '')[:60]}")
        print(f"[dry-run] 不写库,实际会插入 {len(wechat_records) + len(koubo_records)} 条(去重后可能更少)")
        return 0

    dsn = args.database_url or os.environ.get("DATABASE_URL", "")
    if not dsn:
        # 从 app 配置兜底
        try:
            from app.core.config import settings
            dsn = settings.database_url
        except Exception:
            pass
    if not dsn:
        print("[error] DATABASE_URL 未配置,无法写库")
        return 1

    try:
        import asyncpg
    except ImportError:
        print("[error] asyncpg 未安装,无法写库。请先 pip install asyncpg")
        return 1

    conn = await asyncpg.connect(dsn=dsn)
    try:
        await _ensure_table(conn)
        wi, ws = await _insert_records(conn, "wechat", wechat_records)
        ki, ks = await _insert_records(conn, "koubo", koubo_records)
        print(f"[done] wechat: 插入 {wi} 条,跳过 {ws} 条")
        print(f"[done] koubo : 插入 {ki} 条,跳过 {ks} 条")
        print(f"[done] 合计: 插入 {wi + ki} 条,跳过 {ws + ks} 条")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
