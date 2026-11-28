# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""内容级复盘聚合:同题同日跨平台合并,跨天同名不合并。"""

from __future__ import annotations

from datetime import UTC, datetime

from app.services.publish.top_content import group_top_content_rows

DAY1 = datetime(2026, 11, 26, 7, 43, tzinfo=UTC)
DAY1_LATE = datetime(2026, 11, 26, 8, 46, tzinfo=UTC)
DAY2 = datetime(2026, 11, 27, 9, 0, tzinfo=UTC)


def _row(
    *,
    task_id: str,
    platform: str,
    title: str,
    views: int,
    likes: int = 0,
    published_at: datetime = DAY1,
    url: str | None = None,
) -> dict:
    return {
        "task_id": task_id,
        "platform": platform,
        "title": title,
        "views": views,
        "likes": likes,
        "comments": 0,
        "shares": 0,
        "finished_at": published_at,
        "created_at": published_at,
        "published_url": url,
    }


def test_same_title_same_day_merges_across_platforms() -> None:
    rows = [
        _row(task_id="t-csdn", platform="csdn", title="AI热点日报：GPT-5语音实测", views=200,
             likes=1, url="https://csdn.example/a"),
        _row(task_id="t-juejin-1", platform="juejin", title="AI热点日报：GPT-5语音实测", views=7,
             url="https://juejin.example/a"),
        _row(task_id="t-juejin-2", platform="juejin", title="AI热点日报：GPT-5语音实测", views=6,
             url="https://juejin.example/b"),
        _row(task_id="t-xhs", platform="xiaohongshu", title="GPT-5语音延迟终验", views=18,
             published_at=DAY1_LATE),
        _row(task_id="t-day2", platform="csdn", title="AI热点日报：GPT-5语音实测", views=5,
             published_at=DAY2),
        _row(task_id="t-empty", platform="csdn", title="   ", views=10),
    ]

    items = group_top_content_rows(rows, limit=10)

    assert len(items) == 3
    top = items[0]
    assert top["title"] == "AI热点日报：GPT-5语音实测"
    assert top["views"] == 213
    assert top["likes"] == 1
    assert top["posts"] == 3
    assert top["platformCount"] == 2
    assert top["platform"] == "csdn / juejin"
    assert top["platformKeys"] == ["csdn", "juejin"]
    assert top["publishedUrl"] == "https://csdn.example/a"
    juejin = next(p for p in top["platforms"] if p["platform"] == "juejin")
    assert juejin["views"] == 13
    assert juejin["posts"] == 2

    # 同名跨天不能合并
    assert items[2]["views"] == 5
    assert items[1]["title"] == "GPT-5语音延迟终验"


def test_limit_is_applied_after_grouping() -> None:
    rows = [
        _row(task_id="t1", platform="csdn", title="A", views=200),
        _row(task_id="t2", platform="juejin", title="A", views=7),
        _row(task_id="t3", platform="csdn", title="B", views=18),
    ]

    items = group_top_content_rows(rows, limit=1)

    assert len(items) == 1
    assert items[0]["views"] == 207
    assert items[0]["posts"] == 2
