# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`scripts/audit_principal_consumed.py` 的判据测试(2026-09-27 批 64)。

只测**纯函数 + 构造面**:不依赖仓库此刻有哪些端点(那会把瞬时状态当恒定前提,
本仓记过多次),也不去 spawn 真仓扫描(那由 CLI 级装车例证明)。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from scripts.audit_principal_consumed import audit_text

AI = Path(__file__).resolve().parents[1]

IGNORES_PRINCIPAL = """
from fastapi import Depends
from app.core.jwt_auth import get_current_user_id

@router.get("/x")
async def get_x(thread_id: str, user_id: str = Depends(get_current_user_id)):
    return store.read(thread_id)
"""

USES_PRINCIPAL = """
from fastapi import Depends
from app.core.jwt_auth import get_current_user_id

@router.get("/x")
async def get_x(thread_id: str, user_id: str = Depends(get_current_user_id)):
    return store.read(thread_id, owner_user_id=user_id)
"""

TWO_CHANNEL_REQUEST = """
from fastapi import Depends, Request
from app.core.jwt_auth import get_current_user_id

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=_owner_filter(request))
"""

NO_DEPENDS = """
def helper(x: int) -> int:
    return x + 1
"""


def test_ignoring_handler_is_flagged() -> None:
    rows = audit_text("app/routers/x.py", IGNORES_PRINCIPAL)
    assert [r["func"] for r in rows] == ["get_x"], rows
    assert rows[0]["params"] == ["user_id"]


def test_consuming_handler_is_not_flagged() -> None:
    assert audit_text("app/routers/x.py", USES_PRINCIPAL) == []


def test_two_channel_shape_is_reported_and_is_a_known_limitation() -> None:
    """经 `request.state.user_id` 消费身份的写法**当前仍会被报**。

    这是刻意钉住的一条"已知假阳性"锁:工具头注把"升 blocking 前置③ = 补第二判据
    (`request.state.user_id` 通道)"写成了条件;哪天有人不加第二判据就把默认档翻成
    判红,这条用例会喊出来 —— 而 hooks.py 有 15 条正是这一型,不补就接进提交链
    等于造一台恒红门(§12e 同型)。
    """
    rows = audit_text("app/routers/hooks.py", TWO_CHANNEL_REQUEST)
    assert [r["func"] for r in rows] == ["list_logs"], rows


def test_plain_function_is_ignored() -> None:
    assert audit_text("app/services/y.py", NO_DEPENDS) == []


def test_cli_json_is_parseable_and_root_default_is_the_app_dir(tmp_path: Path) -> None:
    """CLI 级装车证明:`--json` 可 parse、缺省 root 落在 `apps/ai-service`(不是 `apps/`)。"""
    out = subprocess.run(
        [sys.executable, str(AI / "scripts" / "audit_principal_consumed.py"), "--json"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert out.returncode == 0, out.stderr[:400]
    payload = json.loads(out.stdout)
    assert payload["scanned"] > 100, payload["scanned"]
    assert isinstance(payload["findings"], list)
    # 缺省 root 必须是 ai-service:parent[2] 会把范围错扩到整个 apps/(本票真踩过一次)
    assert all(f["file"].startswith("app/") for f in payload["findings"]), payload["findings"][:2]


def test_empty_enumeration_is_not_reported_as_clean(tmp_path: Path) -> None:
    """根不可当仓问 ⇒ 退出码 2 + "判据失明",绝不回空清单冒充"没有问题"。"""
    out = subprocess.run(
        [
            sys.executable,
            str(AI / "scripts" / "audit_principal_consumed.py"),
            "--root",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert out.returncode == 2, (out.returncode, out.stdout[:200])
    assert "判据失明" in out.stdout or "0 个" in out.stdout


def test_console_codepage_cannot_change_the_verdict(tmp_path: Path) -> None:
    """输出面的编码问题**不得**把结论面打死(本机 GBK 控制台实测踩到过的崩溃)。

    第一版"枚举到 0 个 ⇒ 判据失明"那一行里有个 `⇒`,在 GBK 代码页上直接抛
    `UnicodeEncodeError`,退出码从 2 退成 1 —— 一台"拒绝出合格证"的尺子把自己
    伪装成了"被测对象有别的毛病"。强制 `PYTHONIOENCODING=gbk` 让这一格在
    UTF-8 的 CI 上也照样可复现,而不是只在我这台机上红。
    """
    env = {**os.environ, "PYTHONIOENCODING": "gbk"}
    out = subprocess.run(
        [
            sys.executable,
            str(AI / "scripts" / "audit_principal_consumed.py"),
            "--root",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert "UnicodeEncodeError" not in (out.stderr or ""), out.stderr[:400]
    assert out.returncode == 2, (out.returncode, out.stdout[:200], out.stderr[:200])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
