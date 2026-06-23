#!/usr/bin/env python
"""AI 编程教学资源数据导入脚本.

功能:
  - 读取指定目录下的所有 JSON 教学资源文件
  - 将数据导入到数据库中对应的表 (zhs_resources / ai_news)
  - 支持增量导入 (基于 URL 去重，避免重复导入)
  - 提供详细的导入日志和统计

数据映射:
  - clawdbot-import-articles.json  -> ai_news (文章含完整正文)
  - clawdbot-import-resources.json -> zhs_resources (资源链接)
  - clawdbot-resources.json        -> zhs_resources (汇总资源)
  - mcp-tutorials.json             -> zhs_resources
  - vibe-coding-tutorials.json     -> zhs_resources
  - cursor-skills-tutorials.json   -> zhs_resources
  - claude-code-tutorials.json     -> zhs_resources
  - ai-agent-tutorials.json        -> zhs_resources
  - prompt-engineering-tutorials.json -> zhs_resources
  - ai-coding-communities.json     -> zhs_resources (社区资源)
  - ai-coding-tools-comparison.json -> zhs_resources (工具对比)
  - init_lesson_data.sql           -> 跳过 (MySQL 语法，与 PostgreSQL 不兼容)

用法:
  python -m scripts.import_edu_data                            # 默认导入
  python -m scripts.import_edu_data --data-dir H:\\edu\\data   # 指定数据目录
  python -m scripts.import_edu_data --dry-run                  # 预览模式 (不写入数据库)
  python -m scripts.import_edu_data --force                    # 强制重新导入 (跳过去重检查)
  python -m scripts.import_edu_data --data-dir H:\\edu\\data --dry-run --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# 添加项目根目录到 Python 路径
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
from sqlalchemy import func, select

from app.database import SessionFactory1, create_all_per_db
from app.models.app_content_models import AiNews
from app.models.resource_models import ZhsResources

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

DEFAULT_DATA_DIR = r"H:\edu\data"

# 教程类 JSON 文件 (统一结构: metadata + videoResources + articleResources + ...)
TUTORIAL_FILES = [
    "clawdbot-resources.json",
    "mcp-tutorials.json",
    "vibe-coding-tutorials.json",
    "cursor-skills-tutorials.json",
    "claude-code-tutorials.json",
    "ai-agent-tutorials.json",
    "prompt-engineering-tutorials.json",
]

# 导入格式 JSON 文件 (结构不同)
IMPORT_ARTICLES_FILE = "clawdbot-import-articles.json"
IMPORT_RESOURCES_FILE = "clawdbot-import-resources.json"

# 社区和工具对比文件
COMMUNITIES_FILE = "ai-coding-communities.json"
TOOLS_FILE = "ai-coding-tools-comparison.json"

# 跳过的文件
SKIPPED_FILES = ["init_lesson_data.sql", "README.md"]

# 资源类型映射
RESOURCE_TYPE_MAP = {
    "video": "video",
    "article": "article",
    "course_platform": "article",
    "official_doc": "document",
    "document": "document",
    "community": "community",
    "tool": "tool",
    "discord": "community",
    "github": "community",
}


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass
class ImportStats:
    """导入统计信息."""

    files_processed: int = 0
    files_skipped: int = 0
    resources_total: int = 0
    resources_inserted: int = 0
    resources_skipped: int = 0
    resources_failed: int = 0
    articles_total: int = 0
    articles_inserted: int = 0
    articles_skipped: int = 0
    articles_failed: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        """生成统计摘要字符串."""
        lines = [
            "",
            "=" * 60,
            "  导入统计摘要",
            "=" * 60,
            f"  文件处理: {self.files_processed} 个 (跳过 {self.files_skipped} 个)",
            f"  资源总计: {self.resources_total}",
            f"    - 新增: {self.resources_inserted}",
            f"    - 跳过(已存在): {self.resources_skipped}",
            f"    - 失败: {self.resources_failed}",
            f"  文章总计: {self.articles_total}",
            f"    - 新增: {self.articles_inserted}",
            f"    - 跳过(已存在): {self.articles_skipped}",
            f"    - 失败: {self.articles_failed}",
        ]
        if self.errors:
            lines.append(f"  错误数: {len(self.errors)}")
            for err in self.errors[:10]:
                lines.append(f"    - {err}")
            if len(self.errors) > 10:
                lines.append(f"    ... 还有 {len(self.errors) - 10} 条错误")
        lines.append("=" * 60)
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# JSON 文件读取
# ---------------------------------------------------------------------------


def load_json(file_path: Path) -> dict[str, Any] | None:
    """读取 JSON 文件并返回字典.

    Args:
        file_path: JSON 文件路径

    Returns:
        解析后的字典，失败返回 None
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"JSON 解析失败: {file_path.name} - {e}")
        return None
    except OSError as e:
        logger.error(f"文件读取失败: {file_path.name} - {e}")
        return None


# ---------------------------------------------------------------------------
# 资源提取 (从不同 JSON 结构中提取统一格式的资源)
# ---------------------------------------------------------------------------


def extract_resources_from_tutorial(data: dict[str, Any], filename: str) -> list[dict[str, str]]:
    """从教程类 JSON 文件中提取资源.

    教程文件结构: metadata + videoResources + articleResources + officialDocs + communityResources
    """
    resources: list[dict[str, str]] = []
    topic = data.get("metadata", {}).get("topic", filename)

    # 视频资源
    for item in data.get("videoResources", []):
        resources.append({
            "resource_name": item.get("title", ""),
            "resource_type": "video",
            "resource_url": item.get("url", ""),
            "category": topic,
        })

    # 文章资源
    for item in data.get("articleResources", []):
        resources.append({
            "resource_name": item.get("title", ""),
            "resource_type": "article",
            "resource_url": item.get("url", ""),
            "category": topic,
        })

    # 官方文档
    for item in data.get("officialDocs", []):
        resources.append({
            "resource_name": item.get("title", ""),
            "resource_type": "document",
            "resource_url": item.get("url", ""),
            "category": topic,
        })

    # 社区资源
    for item in data.get("communityResources", []):
        name = item.get("name", item.get("title", ""))
        resources.append({
            "resource_name": name,
            "resource_type": "community",
            "resource_url": item.get("url", ""),
            "category": topic,
        })

    return resources


def extract_resources_from_import_resources(data: dict[str, Any]) -> list[dict[str, str]]:
    """从 clawdbot-import-resources.json 中提取资源."""
    resources: list[dict[str, str]] = []
    for item in data.get("resources", []):
        resources.append({
            "resource_name": item.get("title", ""),
            "resource_type": item.get("type", "resource"),
            "resource_url": item.get("externalUrl", ""),
            "category": "Clawdbot",
        })
    return resources


def extract_resources_from_communities(data: dict[str, Any]) -> list[dict[str, str]]:
    """从 ai-coding-communities.json 中提取社区资源."""
    resources: list[dict[str, str]] = []

    for item in data.get("communities", []):
        resources.append({
            "resource_name": item.get("name", ""),
            "resource_type": "community",
            "resource_url": item.get("url", ""),
            "category": "AI编程社区",
        })

    for item in data.get("discordServers", []):
        name = item.get("name", "")
        url = item.get("url", item.get("inviteUrl", ""))
        resources.append({
            "resource_name": name,
            "resource_type": "community",
            "resource_url": url,
            "category": "Discord",
        })

    return resources


def extract_resources_from_tools(data: dict[str, Any]) -> list[dict[str, str]]:
    """从 ai-coding-tools-comparison.json 中提取工具资源."""
    resources: list[dict[str, str]] = []
    for item in data.get("tools", []):
        resources.append({
            "resource_name": item.get("name", ""),
            "resource_type": "tool",
            "resource_url": item.get("url", ""),
            "category": "AI编程工具",
        })
    return resources


def extract_articles_from_import(data: dict[str, Any]) -> list[dict[str, Any]]:
    """从 clawdbot-import-articles.json 中提取文章数据.

    文章包含完整正文内容，导入到 ai_news 表.
    """
    articles: list[dict[str, Any]] = []
    for item in data.get("articles", []):
        articles.append({
            "title": item.get("title", ""),
            "subtitle": item.get("summary", ""),
            "content": item.get("content", ""),
            "cover_image": item.get("cover", ""),
            "author": item.get("author", ""),
            "category": "Clawdbot",
            "tags": item.get("tags", []),
            "source": item.get("source", ""),
            "original_url": item.get("originalUrl", ""),
        })
    return articles


# ---------------------------------------------------------------------------
# 数据库操作 (同步，通过 asyncio.to_thread 调用)
# ---------------------------------------------------------------------------


def _ensure_tables() -> None:
    """确保数据库表存在."""
    try:
        create_all_per_db()
        logger.info("数据库表已确保存在")
    except Exception as e:
        logger.warning(f"创建表时出现警告 (可能已存在): {e}")


def _get_existing_urls(db, urls: list[str]) -> set[str]:
    """查询数据库中已存在的资源 URL 集合."""
    if not urls:
        return set()
    stmt = select(ZhsResources.resource_url).where(
        ZhsResources.resource_url.in_(urls)
    )
    result = db.execute(stmt)
    return {row[0] for row in result.fetchall()}


def _get_existing_article_keys(db, keys: list[tuple[str, str]]) -> set[tuple[str, str]]:
    """查询数据库中已存在的文章 (title + author) 集合."""
    if not keys:
        return set()
    titles = [k[0] for k in keys]
    stmt = select(AiNews.title, AiNews.author).where(AiNews.title.in_(titles))
    result = db.execute(stmt)
    return {(row[0], row[1] or "") for row in result.fetchall()}


def _insert_resources_sync(
    resources: list[dict[str, str]],
    force: bool,
    dry_run: bool,
    stats: ImportStats,
) -> None:
    """同步插入资源到 zhs_resources 表."""
    if not resources:
        return

    stats.resources_total += len(resources)

    # 过滤无效数据 (URL 为空的跳过)
    valid_resources = [r for r in resources if r.get("resource_url")]
    invalid_count = len(resources) - len(valid_resources)
    if invalid_count > 0:
        logger.warning(f"跳过 {invalid_count} 条无 URL 的资源")

    if not valid_resources:
        return

    with SessionFactory1() as db:
        # 增量导入: 检查已存在的 URL
        if not force:
            all_urls = [r["resource_url"] for r in valid_resources]
            existing_urls = _get_existing_urls(db, all_urls)
            new_resources = [
                r for r in valid_resources if r["resource_url"] not in existing_urls
            ]
            stats.resources_skipped += len(valid_resources) - len(new_resources)
            if existing_urls:
                logger.info(f"增量导入: 跳过 {len(existing_urls)} 条已存在的资源")
        else:
            new_resources = valid_resources
            logger.warning("强制模式: 跳过去重检查，可能产生重复数据")

        if dry_run:
            logger.info(f"[DRY-RUN] 将导入 {len(new_resources)} 条资源 (不实际写入)")
            stats.resources_inserted += len(new_resources)
            return

        # 批量插入
        for res in new_resources:
            try:
                record = ZhsResources(
                    resource_name=res["resource_name"][:200],
                    resource_type=res.get("resource_type", "resource")[:50],
                    resource_url=res["resource_url"][:500],
                    status=1,
                )
                db.add(record)
                stats.resources_inserted += 1
            except Exception as e:
                stats.resources_failed += 1
                stats.errors.append(f"资源插入失败: {res['resource_name']} - {e}")
                logger.error(f"资源插入失败: {res['resource_name']} - {e}")

        db.commit()
        logger.info(f"资源导入完成: 新增 {stats.resources_inserted} 条")


def _insert_articles_sync(
    articles: list[dict[str, Any]],
    force: bool,
    dry_run: bool,
    stats: ImportStats,
) -> None:
    """同步插入文章到 ai_news 表."""
    if not articles:
        return

    stats.articles_total += len(articles)

    with SessionFactory1() as db:
        # 增量导入: 检查已存在的文章 (title + author)
        if not force:
            keys = [(a["title"], a.get("author", "")) for a in articles]
            existing_keys = _get_existing_article_keys(db, keys)
            new_articles = [
                a for a in articles
                if (a["title"], a.get("author", "")) not in existing_keys
            ]
            stats.articles_skipped += len(articles) - len(new_articles)
            if existing_keys:
                logger.info(f"增量导入: 跳过 {len(existing_keys)} 篇已存在的文章")
        else:
            new_articles = articles
            logger.warning("强制模式: 跳过去重检查，可能产生重复数据")

        if dry_run:
            logger.info(f"[DRY-RUN] 将导入 {len(new_articles)} 篇文章 (不实际写入)")
            stats.articles_inserted += len(new_articles)
            return

        # 逐条插入
        for art in new_articles:
            try:
                # 将 tags 数组转为逗号分隔字符串
                tags_str = ", ".join(art.get("tags", [])) if art.get("tags") else None

                # 将 source 和 original_url 信息附加到 content 末尾
                content = art.get("content", "")
                source_info = []
                if art.get("source"):
                    source_info.append(f"\n\n**来源**: {art['source']}")
                if art.get("original_url"):
                    source_info.append(f"**原文链接**: {art['original_url']}")
                if source_info:
                    content = content + "\n".join(source_info)

                record = AiNews(
                    title=art["title"][:300],
                    subtitle=art.get("subtitle", "")[:500] if art.get("subtitle") else None,
                    content=content,
                    cover_image=art.get("cover_image", "")[:500] or None,
                    author=art.get("author", "")[:100] if art.get("author") else None,
                    category=art.get("category", "")[:50] if art.get("category") else None,
                    view_count=0,
                    status=1,
                    publish_time=datetime.now(),
                    sort=0,
                )
                db.add(record)
                stats.articles_inserted += 1
            except Exception as e:
                stats.articles_failed += 1
                stats.errors.append(f"文章插入失败: {art.get('title', '?')} - {e}")
                logger.error(f"文章插入失败: {art.get('title', '?')} - {e}")

        db.commit()
        logger.info(f"文章导入完成: 新增 {stats.articles_inserted} 篇")


def _count_existing() -> dict[str, int]:
    """统计数据库中已有的资源/文章数量."""
    counts = {"resources": 0, "articles": 0}
    try:
        with SessionFactory1() as db:
            res_count = db.execute(
                select(func.count()).select_from(ZhsResources)
            ).scalar()
            counts["resources"] = res_count or 0

            art_count = db.execute(
                select(func.count()).select_from(AiNews)
            ).scalar()
            counts["articles"] = art_count or 0
    except Exception as e:
        logger.warning(f"统计已有数据时出错: {e}")
    return counts


# ---------------------------------------------------------------------------
# 异步包装层
# ---------------------------------------------------------------------------


async def insert_resources(
    resources: list[dict[str, str]],
    force: bool,
    dry_run: bool,
    stats: ImportStats,
) -> None:
    """异步插入资源."""
    await asyncio.to_thread(
        _insert_resources_sync, resources, force, dry_run, stats
    )


async def insert_articles(
    articles: list[dict[str, Any]],
    force: bool,
    dry_run: bool,
    stats: ImportStats,
) -> None:
    """异步插入文章."""
    await asyncio.to_thread(
        _insert_articles_sync, articles, force, dry_run, stats
    )


async def ensure_tables() -> None:
    """异步确保表存在."""
    await asyncio.to_thread(_ensure_tables)


async def count_existing() -> dict[str, int]:
    """异步统计已有数据."""
    return await asyncio.to_thread(_count_existing)


# ---------------------------------------------------------------------------
# 文件处理
# ---------------------------------------------------------------------------


async def process_file(
    file_path: Path,
    force: bool,
    dry_run: bool,
    stats: ImportStats,
) -> None:
    """处理单个 JSON 文件."""
    filename = file_path.name
    logger.info(f"处理文件: {filename}")

    data = load_json(file_path)
    if data is None:
        stats.files_skipped += 1
        stats.errors.append(f"文件解析失败: {filename}")
        return

    stats.files_processed += 1

    # 根据文件名选择提取策略
    all_resources: list[dict[str, str]] = []
    all_articles: list[dict[str, Any]] = []

    if filename == IMPORT_ARTICLES_FILE:
        # 文章导入文件 -> ai_news 表
        articles = extract_articles_from_import(data)
        all_articles.extend(articles)
        logger.info(f"  提取文章: {len(articles)} 篇")

    elif filename == IMPORT_RESOURCES_FILE:
        # 资源导入文件 -> zhs_resources 表
        resources = extract_resources_from_import_resources(data)
        all_resources.extend(resources)
        logger.info(f"  提取资源: {len(resources)} 条")

    elif filename == COMMUNITIES_FILE:
        # 社区资源文件 -> zhs_resources 表
        resources = extract_resources_from_communities(data)
        all_resources.extend(resources)
        logger.info(f"  提取社区资源: {len(resources)} 条")

    elif filename == TOOLS_FILE:
        # 工具对比文件 -> zhs_resources 表
        resources = extract_resources_from_tools(data)
        all_resources.extend(resources)
        logger.info(f"  提取工具资源: {len(resources)} 条")

    elif filename in TUTORIAL_FILES:
        # 教程类文件 -> zhs_resources 表
        resources = extract_resources_from_tutorial(data, filename)
        all_resources.extend(resources)
        topic = data.get("metadata", {}).get("topic", filename)
        logger.info(f"  主题: {topic}")
        logger.info(f"  提取资源: {len(resources)} 条")

    else:
        logger.warning(f"  未知文件类型，跳过: {filename}")
        stats.files_skipped += 1
        return

    # 异步插入数据库
    if all_resources:
        await insert_resources(all_resources, force, dry_run, stats)

    if all_articles:
        await insert_articles(all_articles, force, dry_run, stats)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def setup_logging(verbose: bool = False) -> None:
    """配置日志."""
    logger.remove()
    level = "DEBUG" if verbose else "INFO"
    logger.add(
        sys.stderr,
        level=level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | {message}",
    )


async def run_import(data_dir: str, dry_run: bool, force: bool) -> ImportStats:
    """执行导入主流程.

    Args:
        data_dir: 数据目录路径
        dry_run: 预览模式 (不实际写入)
        force: 强制模式 (跳过去重检查)

    Returns:
        导入统计信息
    """
    stats = ImportStats()
    dir_path = Path(data_dir)

    # 验证数据目录
    if not dir_path.exists():
        logger.error(f"数据目录不存在: {data_dir}")
        stats.errors.append(f"数据目录不存在: {data_dir}")
        return stats

    if not dir_path.is_dir():
        logger.error(f"路径不是目录: {data_dir}")
        stats.errors.append(f"路径不是目录: {data_dir}")
        return stats

    logger.info("=" * 60)
    logger.info("  AI 编程教学资源数据导入")
    logger.info("=" * 60)
    logger.info(f"  数据目录: {data_dir}")
    logger.info(f"  预览模式: {'是' if dry_run else '否'}")
    logger.info(f"  强制模式: {'是' if force else '否'}")
    logger.info("=" * 60)

    # 确保数据库表存在
    if not dry_run:
        logger.info("正在确保数据库表存在...")
        await ensure_tables()

    # 导入前统计
    logger.info("正在统计数据库已有数据...")
    before_counts = await count_existing()
    logger.info(
        f"  导入前: 资源 {before_counts['resources']} 条, 文章 {before_counts['articles']} 篇"
    )

    # 收集所有 JSON 文件
    json_files = sorted(dir_path.glob("*.json"))
    if not json_files:
        logger.warning("数据目录中没有 JSON 文件")
        return stats

    logger.info(f"找到 {len(json_files)} 个 JSON 文件")

    # 标记跳过的文件
    for skipped in SKIPPED_FILES:
        skipped_path = dir_path / skipped
        if skipped_path.exists():
            stats.files_skipped += 1
            if skipped.endswith(".sql"):
                logger.info(f"跳过 SQL 文件 (MySQL 语法不兼容): {skipped}")
            elif skipped.endswith(".md"):
                logger.info(f"跳过说明文件: {skipped}")

    # 逐个处理 JSON 文件
    for file_path in json_files:
        if file_path.name in SKIPPED_FILES:
            continue
        try:
            await process_file(file_path, force, dry_run, stats)
        except Exception as e:
            stats.errors.append(f"文件处理异常: {file_path.name} - {e}")
            logger.error(f"文件处理异常: {file_path.name} - {e}")

    # 导入后统计 (仅非 dry-run 模式)
    if not dry_run:
        logger.info("正在统计导入后数据...")
        after_counts = await count_existing()
        logger.info(
            f"  导入后: 资源 {after_counts['resources']} 条, 文章 {after_counts['articles']} 篇"
        )
        logger.info(
            f"  新增: 资源 {after_counts['resources'] - before_counts['resources']} 条, "
            f"文章 {after_counts['articles'] - before_counts['articles']} 篇"
        )

    return stats


# ---------------------------------------------------------------------------
# 命令行入口
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """解析命令行参数."""
    parser = argparse.ArgumentParser(
        description="AI 编程教学资源数据导入脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m scripts.import_edu_data                            # 默认导入
  python -m scripts.import_edu_data --data-dir H:\\edu\\data   # 指定目录
  python -m scripts.import_edu_data --dry-run                  # 预览模式
  python -m scripts.import_edu_data --force                    # 强制重新导入
  python -m scripts.import_edu_data --dry-run --force          # 预览+强制
        """,
    )
    parser.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help=f"数据目录路径 (默认: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="预览模式: 只显示将要导入的数据，不实际写入数据库",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制模式: 跳过去重检查，允许重复导入",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="详细日志模式 (DEBUG 级别)",
    )
    return parser.parse_args()


def main() -> None:
    """脚本入口."""
    args = parse_args()
    setup_logging(verbose=args.verbose)

    stats = asyncio.run(
        run_import(
            data_dir=args.data_dir,
            dry_run=args.dry_run,
            force=args.force,
        )
    )

    # 打印统计摘要
    print(stats.summary())

    # 退出码: 有失败则返回 1
    if stats.resources_failed > 0 or stats.articles_failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
