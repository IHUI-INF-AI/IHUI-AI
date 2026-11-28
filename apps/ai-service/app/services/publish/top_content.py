# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""内容级复盘聚合:同一标题同一天的多平台快照合并成一条内容。

标题按空白归一 + casefold 比较,并带发布日期作为第二键,避免把
“AI热点日报”这种连续日更的同名系列跨天合成一条。
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any


def _as_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _as_iso(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value:
        return str(value)
    return None


def group_top_content_rows(
    rows: Iterable[Mapping[str, Any]],
    limit: int = 5,
) -> list[dict[str, Any]]:
    """把 task+platform 快照按“归一标题 + 发布日”聚成内容级条目。

    `platform` 保留为可读的合并标签(如 `csdn / juejin`),同时给出
    `platformKeys`、`platforms` 明细;单平台内容保持原平台名不变。
    """
    safe_limit = max(1, min(20, int(limit or 5)))
    groups: dict[tuple[str, str], dict[str, Any]] = {}

    for row in rows:
        title = " ".join(str(row.get("title") or "").split())
        if not title:
            continue
        platform = str(row.get("platform") or "").strip()
        if not platform:
            continue
        published_at = _as_iso(row.get("finished_at") or row.get("created_at"))
        day = published_at[:10] if published_at else ""
        key = (title.casefold(), day)

        group = groups.get(key)
        if group is None:
            group = {
                "title": title,
                "views": 0,
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "posts": 0,
                "publishedAt": published_at,
                "platforms": {},
            }
            groups[key] = group

        views = _as_int(row.get("views"))
        likes = _as_int(row.get("likes"))
        comments = _as_int(row.get("comments"))
        shares = _as_int(row.get("shares"))
        group["views"] += views
        group["likes"] += likes
        group["comments"] += comments
        group["shares"] += shares
        group["posts"] += 1
        if published_at and (not group["publishedAt"] or published_at > group["publishedAt"]):
            group["publishedAt"] = published_at

        platform_row = group["platforms"].get(platform)
        if platform_row is None:
            platform_row = {
                "platform": platform,
                "taskId": str(row.get("task_id") or ""),
                "views": 0,
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "posts": 0,
                "publishedAt": published_at,
                "publishedUrl": row.get("published_url"),
            }
            group["platforms"][platform] = platform_row
        platform_row["views"] += views
        platform_row["likes"] += likes
        platform_row["comments"] += comments
        platform_row["shares"] += shares
        platform_row["posts"] += 1
        if published_at and (
            not platform_row["publishedAt"] or published_at >= platform_row["publishedAt"]
        ):
            platform_row["publishedAt"] = published_at
            platform_row["taskId"] = str(row.get("task_id") or "")
            platform_row["publishedUrl"] = row.get("published_url")

    items: list[dict[str, Any]] = []
    for group in groups.values():
        platforms = sorted(
            group["platforms"].values(),
            key=lambda p: (-p["views"], p["platform"]),
        )
        primary = platforms[0]
        label = " / ".join(p["platform"] for p in platforms)
        if group["posts"] > len(platforms):
            label = f"{label} · {group['posts']} 次发布"
        items.append(
            {
                "taskId": primary["taskId"],
                "title": group["title"],
                "platform": label,
                "platformKeys": [p["platform"] for p in platforms],
                "platformCount": len(platforms),
                "posts": group["posts"],
                "views": group["views"],
                "likes": group["likes"],
                "comments": group["comments"],
                "shares": group["shares"],
                "publishedAt": group["publishedAt"],
                "publishedUrl": primary["publishedUrl"],
                "platforms": platforms,
            }
        )

    items.sort(
        key=lambda item: (
            -item["views"],
            -item["likes"],
            -item["posts"],
            item["title"],
        )
    )
    return items[:safe_limit]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
