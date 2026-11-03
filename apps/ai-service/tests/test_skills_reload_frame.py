# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""控制帧 `reload_skills`:宿主可调的技能重载口 + 差额回报。

为什么单独立这一份(D141 正本 + D202 防翻案注记):
`services/skills.py` 此前只有 mtime 驱动的 `reload_auto`(引擎自扫描、对宿主零回报),
所以"改完 SKILL.md 要重启服务才生效"是真实缺口。补上之后必须成立的三条,本文件逐条钉住:

① 新增 / 修改 / 删除都要进差额名单 —— 只加不删会把已删技能永久留在注册表;
② `force=True` 必须绕过 mtime —— 同 mtime 重写是编辑器常见行为,只认 mtime 会把
   "改了但没生效"报成"没有变化",这条正是那格防翻案注记点名的失效方向;
③ 幂等重载不得虚报 —— 第二次 reload 的 added/changed 必须为空,否则前端会把
   每次点击都渲染成"有更新",用户再也分不清哪次真生效。
"""
from __future__ import annotations

import os

import pytest

from app.services.skills import SkillRegistry

_SKILL_MD = """---
name: {name}
description: {desc}
---
# 步骤
{body}
"""


@pytest.fixture()
def scan_root(tmp_path, monkeypatch):
    """把扫描面收窄到临时目录:不碰仓库里 app/skills/auto 的真实技能。"""
    root = tmp_path / "skills"
    root.mkdir()
    monkeypatch.setenv("IHUI_SKILL_SCAN_ROOTS", str(root))
    return root


def _write(root, filename, name, desc="初始描述", body="执行步骤"):
    path = root / filename
    path.write_text(_SKILL_MD.format(name=name, desc=desc, body=body), encoding="utf-8")
    return path


class TestReloadDiff:
    def test_added_then_idempotent(self, scan_root):
        reg = SkillRegistry()
        _write(scan_root, "alpha.md", "alpha-skill")

        first = reg.reload(force=True)
        assert "alpha-skill" in first["added"], "新增文件必须进 added"
        assert first["changed"] == [] and first["removed"] == []
        assert first["total"] >= first["auto"] >= 1

        second = reg.reload(force=True)
        assert second["added"] == [] and second["removed"] == [] and second["changed"] == []
        assert second["unchanged"] == second["auto"], "幂等重载不许虚报变化"

    def test_changed_detected_even_with_same_mtime(self, scan_root):
        path = _write(scan_root, "beta.md", "beta-skill", desc="旧描述")
        reg = SkillRegistry()
        reg.reload(force=True)

        stat = path.stat()
        path.write_text(
            _SKILL_MD.format(name="beta-skill", desc="新描述", body="新步骤"), encoding="utf-8"
        )
        # 把 mtime 按回原值 == 编辑器"保留 mtime"那条通道
        os.utime(path, (stat.st_atime, stat.st_mtime))

        incremental = reg.reload(force=False)
        assert "beta-skill" not in incremental["changed"], (
            "mtime 未变时增量档看不见改动 —— 这不是缺陷,而是 force 必须存在的理由"
        )

        forced = reg.reload(force=True)
        assert "beta-skill" in forced["changed"], "force 必须绕过 mtime 判据重读"

    def test_removed_when_file_deleted(self, scan_root):
        path = _write(scan_root, "gamma.md", "gamma-skill")
        reg = SkillRegistry()
        reg.reload(force=True)
        assert reg.get("gamma-skill") is not None

        path.unlink()
        result = reg.reload(force=True)
        assert "gamma-skill" in result["removed"], "删除文件必须进 removed"
        assert reg.get("gamma-skill") is None, "删除必须真的从注册表摘掉(只加不删 = 旧技能永生)"

    def test_builtin_skills_untouched(self, scan_root):
        """重载只动 auto 来源:builtin / ai-top 一个都不许被扫面误删。"""
        reg = SkillRegistry()
        before = {s.name for s in reg.list_skills() if s.source != "auto"}
        reg.reload(force=True)
        after = {s.name for s in reg.list_skills() if s.source != "auto"}
        assert before == after


class TestReloadEndpoint:
    def test_endpoint_returns_envelope_with_diff(self, scan_root):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.ai_skills import router

        _write(scan_root, "delta.md", "delta-skill")
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        resp = client.post("/ai-skills/reload", json={"force": True})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["code"] == 0, body
        data = body["data"]
        for key in ("total", "auto", "added", "removed", "changed", "unchanged", "forced"):
            assert key in data, f"信封缺字段 {key}:{data}"
        assert isinstance(data["added"], list) and isinstance(data["changed"], list)

    def test_endpoint_defaults_to_force(self, scan_root):
        """省略 body 时按 force=true 处理 —— 前端最常这么调,不许退化成增量档。"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.ai_skills import router

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        resp = client.post("/ai-skills/reload")
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["forced"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
