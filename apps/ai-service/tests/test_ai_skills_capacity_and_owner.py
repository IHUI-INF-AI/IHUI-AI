# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""技能库导入/评分面的容量与归属硬化(2026-11-01 安全强化)。

回源确认的三件事:
 1. `SkillImportData` 只有 `name` 有 max_length,`description` / `promptTemplate` /
    `sourceUrl` / `tags` 全无限长,而它们被写进**进程级内存字典** ⇒ 单账号循环导入即 OOM;
 2. `_imported_skills` 与 `_rating_store` 都没有总量上限,也没有"每人份额";
 3. `rate` 的 docstring 写着"同一用户多次评分(取最新)",实现却**不记主体、一路 append**
    ⇒ 一个人能给同一技能刷无限条 5 星,把 `stats.average` 拉成自己想要的数
    (评分是别人选技能的依据 ⇒ 完整性缺陷,不只是统计噪声),同时无界增长。
反向牙:摘掉上限 / 摘掉主体归属,对应用例即红;正向对照证明正常导入与正常改评照常工作。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.middleware.input_sanitizer import RATE_RULES
from app.routers import ai_skills as m
from app.routers.ai_skills import (
    RatingRequest,
    SkillImportData,
    import_ai_skill,
    rate_ai_skill,
)


@pytest.fixture(autouse=True)
def _isolate_stores(monkeypatch):
    """清场 + 把份额/容量压到可测的小值(默认值本身是富余量,不是拿来打满的)。"""
    m._imported_skills.clear()
    m._rating_store.clear()
    monkeypatch.setattr(m, "MAX_IMPORTED_SKILLS_PER_OWNER", 2)
    monkeypatch.setattr(m, "MAX_IMPORTED_SKILLS_TOTAL", 2000)
    monkeypatch.setattr(m, "MAX_RATINGS_PER_SKILL", 5000)
    yield
    m._imported_skills.clear()
    m._rating_store.clear()


def _data(**kw) -> SkillImportData:
    base = {"name": "Test Skill", "description": "d", "promptTemplate": "p"}
    base.update(kw)
    return SkillImportData(**base)


# ------------------------------------------------------------------ 字段上限


def test_import_field_limits_reject_oversized_payloads() -> None:
    with pytest.raises(ValidationError):
        SkillImportData(name="x", promptTemplate="a" * 20001)
    with pytest.raises(ValidationError):
        SkillImportData(name="x", description="a" * 2001)
    with pytest.raises(ValidationError):
        SkillImportData(name="x", sourceUrl="u" * 513)
    with pytest.raises(ValidationError):
        SkillImportData(name="x", tags=["t"] * 21)


async def test_positive_control_normal_import_still_works() -> None:
    """收容量不许顺手砍掉正常能力:常规大小的导入照常成功。"""
    res = await import_ai_skill(
        _data(tags=["a", "b"], sourceUrl="https://example.com/s"), user_id="u1"
    )
    assert res["data"]["id"] == "test-skill"
    assert res["data"]["tags"] == ["a", "b"]


# ------------------------------------------------------------------ 归属与份额


async def test_import_records_the_verified_owner() -> None:
    await import_ai_skill(_data(), user_id="alice")
    rec = m._imported_skills["test-skill"]
    assert rec["ownerUserId"] == "alice", "写入没有主体 ⇒ 既限不了份额也做不了归属收口"


async def test_per_owner_quota_is_enforced_but_not_cross_account() -> None:
    for i in range(2):
        await import_ai_skill(_data(name=f"Skill {i}"), user_id="bob")
    with pytest.raises(HTTPException) as caught:
        await import_ai_skill(_data(name="Skill 2"), user_id="bob")
    assert caught.value.status_code == 429
    # 别人的份额不受 bob 影响(判据是"每人份额",不是把功能全局封死)
    ok = await import_ai_skill(_data(name="Skill 2"), user_id="carol")
    assert ok["code"] == 0


async def test_global_capacity_is_enforced(monkeypatch) -> None:
    monkeypatch.setattr(m, "MAX_IMPORTED_SKILLS_TOTAL", 2)
    await import_ai_skill(_data(name="A"), user_id="u1")
    await import_ai_skill(_data(name="B"), user_id="u2")
    with pytest.raises(HTTPException) as caught:
        await import_ai_skill(_data(name="C"), user_id="u3")
    assert caught.value.status_code == 429


async def test_import_rejects_non_http_source_url_and_overlong_tag() -> None:
    with pytest.raises(HTTPException) as caught:
        await import_ai_skill(_data(name="X1", sourceUrl="javascript:alert(1)"), user_id="u")
    assert caught.value.status_code == 422
    with pytest.raises(HTTPException) as caught2:
        await import_ai_skill(_data(name="X2", tags=["t" * 60]), user_id="u")
    assert caught2.value.status_code == 422


# ------------------------------------------------------------------ 评分面


async def test_same_owner_rerating_takes_latest_instead_of_appending() -> None:
    """docstring 承诺的"取最新"到本枚才真的成立(原先是一路 append,且不记主体)。"""
    await import_ai_skill(_data(name="Rateable"), user_id="owner")
    sid = "rateable"
    await rate_ai_skill(sid, RatingRequest(rating=5, comment="first"), user_id="voter")
    await rate_ai_skill(sid, RatingRequest(rating=1, comment="second"), user_id="voter")
    records = m._rating_store[sid]
    assert len(records) == 1, "同一主体改评又追加一条 ⇒ 单人也能把均值拉偏"
    assert records[0]["rating"] == 1
    assert records[0]["userId"] == "voter"
    assert records[0].get("firstRatedAt"), "覆盖时保留了首次评分时刻"


async def test_different_owners_each_keep_one_record() -> None:
    await import_ai_skill(_data(name="Rateable2"), user_id="owner")
    sid = "rateable2"
    for who, star in (("a", 5), ("b", 4), ("c", 2)):
        await rate_ai_skill(sid, RatingRequest(rating=star), user_id=who)
    assert len(m._rating_store[sid]) == 3
    assert sorted(r["userId"] for r in m._rating_store[sid]) == ["a", "b", "c"]


async def test_rating_capacity_is_bounded(monkeypatch) -> None:
    monkeypatch.setattr(m, "MAX_RATINGS_PER_SKILL", 2)
    await import_ai_skill(_data(name="Rateable3"), user_id="owner")
    sid = "rateable3"
    await rate_ai_skill(sid, RatingRequest(rating=5), user_id="a")
    await rate_ai_skill(sid, RatingRequest(rating=5), user_id="b")
    with pytest.raises(HTTPException) as caught:
        await rate_ai_skill(sid, RatingRequest(rating=5), user_id="c")
    assert caught.value.status_code == 429
    # 已存在的主体改评不受容量限制影响(容量只拦"新增条目",不惩罚正常改评)
    ok = await rate_ai_skill(sid, RatingRequest(rating=2), user_id="a")
    assert ok["code"] == 0


async def test_rate_unknown_skill_still_404() -> None:
    """正向对照:存在性校验语义未被改动。"""
    with pytest.raises(HTTPException) as caught:
        await rate_ai_skill("nope-not-here", RatingRequest(rating=3), user_id="u")
    assert caught.value.status_code == 404


# ------------------------------------------------------------------ 限流面


def test_global_mutation_endpoint_is_rate_limited() -> None:
    """reload 是登录用户可点的**全局重扫**(web 技能库的按钮)⇒ 按钮不能砍,那就限频率。"""
    rules = {p: (n, w) for p, n, w in RATE_RULES}
    assert "/api/ai-skills/reload" in rules
    n, w = rules["/api/ai-skills/reload"]
    assert 1 <= n <= 30 and w > 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
