# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""AIS-077 回归:知识卡片必须有用户命名空间,不得跨租户读/覆盖。

票面缺陷:卡库落盘路径只由 `workspace_root + slug(project_id)` 决定,`user_id` 虽然
被端点拿到却**不参与任何判据**。后果两条,都是同一根因:
- 读:同一 workspace 下他人用 `project_id` + `workspace_path` 就能读到别人的卡,
  投毒内容进而可被注入其 LLM 上下文(prompt 注入面);
- 写:`POST /knowledge/compile` 直接覆盖,原属主的卡库被替换后读不回来。

修法(票面方案二,不动路径以免既有卡库整体失联):属主写进卡片元数据 `owner_user_id`,
读**和**写两端都按它校验;旧卡无该字段 ⇒ 读侧不可见、写侧不许覆盖(fail-closed)。

本文件正反成对:
① 属主写入:编译出的卡带 `owner_user_id`;
② 读取裁剪:他人 / 旧无主卡不可见,本人可见;
③ 写侧拒绝:他人卡库拒绝覆盖(抛 KnowledgeCardsForbidden),原文件逐字节不变;
④ 不误伤:本人重复编译仍然幂等覆盖(源指纹相同 ⇒ compiled_at 不变)。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.knowledge_compiler import (
    KnowledgeCardsForbidden,
    compile_project,
    load_active_cards,
    slugify,
)


def _sources() -> dict[str, list[dict[str, object]]]:
    return {
        "codebase": [
            {"file_path": "src/app.ts", "line_start": 10, "content": "export function boot() {}"},
        ],
        "summaries": [],
    }


async def _compile(root: Path, project_id: str, owner: str) -> dict[str, object]:
    return await compile_project(
        project_id,
        root,
        user_id=owner,
        sources=_sources(),
        ttl_days=30,
    )


def _cards_file(root: Path, project_id: str) -> Path:
    from app.services.knowledge_compiler import _CARDS_SUBDIR

    return root / _CARDS_SUBDIR / f"{slugify(project_id)}.json"


@pytest.mark.asyncio
async def test_compiled_cards_carry_owner(tmp_path: Path) -> None:
    """① 卡片元数据必须写属主 —— 否则后续两端都无从校验。"""
    await _compile(tmp_path, "proj_a", "user-a")
    data = json.loads(_cards_file(tmp_path, "proj_a").read_text(encoding="utf-8"))
    assert data, "应产出至少一张卡"
    assert all(c.get("owner_user_id") == "user-a" for c in data)


@pytest.mark.asyncio
async def test_owner_sees_own_cards(tmp_path: Path) -> None:
    await _compile(tmp_path, "proj_a", "user-a")
    cards = load_active_cards(tmp_path, slugify("proj_a"), owner_user_id="user-a", require_owner=True)
    assert len(cards) > 0


@pytest.mark.asyncio
async def test_other_user_cannot_read(tmp_path: Path) -> None:
    """② 他人读同一 project_id:不可见(漏过滤就是跨用户泄漏)。"""
    await _compile(tmp_path, "proj_a", "user-a")
    cards = load_active_cards(tmp_path, slugify("proj_a"), owner_user_id="user-b", require_owner=True)
    assert cards == []


@pytest.mark.asyncio
async def test_legacy_cards_without_owner_are_invisible(tmp_path: Path) -> None:
    """旧卡(无 owner 字段)对带主体的调用方不可见 —— fail-closed。"""
    await _compile(tmp_path, "proj_a", "user-a")
    path = _cards_file(tmp_path, "proj_a")
    data = json.loads(path.read_text(encoding="utf-8"))
    for c in data:
        c.pop("owner_user_id", None)
    path.write_text(json.dumps(data), encoding="utf-8")

    assert load_active_cards(tmp_path, slugify("proj_a"), owner_user_id="user-a", require_owner=True) == []


@pytest.mark.asyncio
async def test_other_user_cannot_overwrite(tmp_path: Path) -> None:
    """③ 写侧拒绝:他人卡库不得被覆盖,且原文件逐字节不变。"""
    await _compile(tmp_path, "proj_a", "user-a")
    path = _cards_file(tmp_path, "proj_a")
    before = path.read_bytes()

    with pytest.raises(KnowledgeCardsForbidden):
        await _compile(tmp_path, "proj_a", "user-b")

    assert path.read_bytes() == before, "拒绝路径必须零写入"


@pytest.mark.asyncio
async def test_owner_can_recompile_idempotently(tmp_path: Path) -> None:
    """④ 本人重复编译仍然幂等(不得把正常重编译挡成越权)。"""
    await _compile(tmp_path, "proj_a", "user-a")
    path = _cards_file(tmp_path, "proj_a")
    first = json.loads(path.read_text(encoding="utf-8"))

    await _compile(tmp_path, "proj_a", "user-a")
    second = json.loads(path.read_text(encoding="utf-8"))

    assert second[0]["compiled_at"] == first[0]["compiled_at"], "同源重编译应沿用旧 compiled_at"
    assert all(c.get("owner_user_id") == "user-a" for c in second)


@pytest.mark.asyncio
async def test_dry_run_does_not_trip_owner_gate(tmp_path: Path) -> None:
    """dry_run 只算不写盘,不构成覆盖 ⇒ 不该被他人卡库挡住(否则预演失去意义)。"""
    await _compile(tmp_path, "proj_a", "user-a")
    path = _cards_file(tmp_path, "proj_a")
    before = path.read_bytes()

    result = await compile_project(
        "proj_a", tmp_path, user_id="user-b", sources=_sources(), dry_run=True
    )
    assert result["cards"], "dry_run 仍应算出卡片"
    assert path.read_bytes() == before
