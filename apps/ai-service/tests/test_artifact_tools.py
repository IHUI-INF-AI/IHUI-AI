# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

"""G3 create_artifact 交付物工具测试(2026-10-30 立)。

覆盖:建卡(落盘 + 元数据 + checksum)、锚点必填、kind/payload 校验、
版本递增(旧版保留、跨会话拒绝)、会话结构化 JSON 附件登记(artifacts_store)。
产物目录经 env IHUI_ARTIFACTS_DIR 重定向到 tmp_path,不碰仓库 tmp/。
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest

from app.tools.artifact_tools import create_artifact


@pytest.fixture(autouse=True)
def _redirect_artifacts_dir(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("IHUI_ARTIFACTS_DIR", str(tmp_path / "artifacts"))


def _args(**overrides):
    base = {
        "kind": "html_report",
        "title": "运营周报",
        "content": "<!DOCTYPE html><html><body>报告正文</body></html>",
        "message_id": "msg-42",
        "__user_id": "user-1",
        "__session_id": "sess-001",
    }
    base.update(overrides)
    return base


def _artifact_dir() -> Path:
    import os

    return Path(os.environ["IHUI_ARTIFACTS_DIR"])


class TestCreate:
    async def test_html_report_created(self):
        res = await create_artifact(_args())
        assert res["ok"] is True
        art = res["artifact"]
        assert art["kind"] == "html_report"
        assert art["version"] == 1
        assert art["status"] == "draft"
        assert art["session_id"] == "sess-001"
        assert art["turn_anchor"] == {"message_id": "msg-42"}
        # payload 落盘 + checksum/size 与字节一致
        payload_file = _artifact_dir() / art["id"] / "v1.html"
        assert payload_file.is_file()
        data = payload_file.read_bytes()
        assert art["checksum"] == hashlib.sha256(data).hexdigest()
        assert art["size_bytes"] == len(data)
        # 归属 sidecar(generate_chart 同契约)+ 目录级 owner.json
        assert (Path(str(payload_file) + ".owner")).is_file()
        owner = json.loads((_artifact_dir() / art["id"] / "owner.json").read_text(encoding="utf-8"))
        assert owner == {"user_id": "user-1", "session_id": "sess-001"}
        # artifact.json 与返回值一致
        stored = json.loads((_artifact_dir() / art["id"] / "artifact.json").read_text(encoding="utf-8"))
        assert stored["id"] == art["id"]

    async def test_anchor_required(self):
        for missing in ("message_id", "__session_id"):
            args = _args()
            args.pop(missing)
            res = await create_artifact(args)
            assert res["ok"] is False
            assert res["errorCode"] == ("MISSING_ANCHOR" if missing == "message_id" else "MISSING_SESSION")

    async def test_blank_anchor_rejected(self):
        res = await create_artifact(_args(message_id="   "))
        assert res["ok"] is False and res["errorCode"] == "MISSING_ANCHOR"

    async def test_invalid_kind_title_content(self):
        assert (await create_artifact(_args(kind="pdf")))["errorCode"] == "INVALID_KIND"
        assert (await create_artifact(_args(title="  ")))["errorCode"] == "MISSING_TITLE"
        assert (await create_artifact(_args(content="")))["errorCode"] == "MISSING_CONTENT"
        assert (await create_artifact(_args(status="published")))["errorCode"] == "INVALID_STATUS"
        assert (await create_artifact(_args(anchor_index=-1)))["errorCode"] == "INVALID_ANCHOR_INDEX"


class TestPayloadValidation:
    async def test_slides_deck_valid_and_invalid(self):
        deck = {"slides": [{"title": "总览", "bullets": ["一", "二"], "notes": "备注"}]}
        res = await create_artifact(_args(kind="slides", content=json.dumps(deck, ensure_ascii=False)))
        assert res["ok"] is True
        assert res["artifact"]["mime"] == "application/json"
        # 空页 / 非 JSON / 缺 bullets 均拒收
        assert (await create_artifact(_args(kind="slides", content='{"slides":[]}')))["errorCode"] == "INVALID_PAYLOAD"
        assert (await create_artifact(_args(kind="slides", content="not-json")))["errorCode"] == "INVALID_PAYLOAD"
        bad = {"slides": [{"title": "t"}]}
        assert (await create_artifact(_args(kind="slides", content=json.dumps(bad))))["errorCode"] == "INVALID_PAYLOAD"

    async def test_sheet_and_video_ref(self):
        sheet = {"columns": ["姓名", "得分"], "rows": [["张三", 95], [None, 60]]}
        assert (await create_artifact(_args(kind="sheet", content=json.dumps(sheet, ensure_ascii=False))))["ok"] is True
        assert (await create_artifact(_args(kind="sheet", content='{"columns":[],"rows":[]}')))["errorCode"] == "INVALID_PAYLOAD"
        assert (await create_artifact(_args(kind="video_ref", content='{"url":"https://v/1"}')))["ok"] is True
        assert (await create_artifact(_args(kind="video_ref", content='{"url":""}')))["errorCode"] == "INVALID_PAYLOAD"


class TestVersioning:
    async def test_update_bumps_version_keeps_old_payload(self):
        first = await create_artifact(_args())
        aid = first["artifact"]["id"]
        second = await create_artifact(_args(artifact_id=aid, content="<html>v2</html>", status="final"))
        assert second["ok"] is True
        art2 = second["artifact"]
        assert art2["version"] == 2
        assert art2["status"] == "final"
        assert art2["created_at"] == first["artifact"]["created_at"]
        d = _artifact_dir() / aid
        assert (d / "v1.html").is_file() and (d / "v2.html").is_file()  # 旧版保留

    async def test_update_rejects_foreign_session_and_kind_change(self):
        first = await create_artifact(_args())
        aid = first["artifact"]["id"]
        res = await create_artifact(_args(artifact_id=aid, __session_id="sess-999"))
        assert res["ok"] is False and res["errorCode"] == "NOT_FOUND"
        res2 = await create_artifact(_args(artifact_id=aid, kind="doc", content="正文"))
        assert res2["ok"] is False and res2["errorCode"] == "KIND_MISMATCH"
        assert (await create_artifact(_args(artifact_id="not-a-uuid")))["errorCode"] == "INVALID_ARTIFACT_ID"


class TestSessionAttachment:
    async def test_metadata_registered_as_structured_json_attachment(self):
        from app.services.artifacts_store import artifacts_store  # 模块单例(工具写入的那一份)

        res = await create_artifact(_args())
        art = res["artifact"]
        assert art.get("attachment_id")
        listed = await artifacts_store.list("sess-001")
        mine = [a for a in listed["artifacts"] if a.get("metadata", {}).get("artifact", {}).get("id") == art["id"]]
        assert len(mine) == 1
        assert mine[0]["type"] == "file"
        assert mine[0]["metadata"]["deliverable"] == "artifact"
        # 更新复用同一 attachment(不堆积)
        res2 = await create_artifact(_args(artifact_id=art["id"], content="<html>v2</html>"))
        assert res2["artifact"]["attachment_id"] == art["attachment_id"]
        listed2 = await artifacts_store.list("sess-001")
        mine2 = [a for a in listed2["artifacts"] if a.get("metadata", {}).get("artifact", {}).get("id") == art["id"]]
        assert len(mine2) == 1
        assert mine2[0]["metadata"]["artifact"]["version"] == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
