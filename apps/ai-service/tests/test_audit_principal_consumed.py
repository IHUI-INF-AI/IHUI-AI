# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""`scripts/audit_principal_consumed.py` 的判据测试(2026-09-27 G-261 扩第二判据)。

只测**纯函数 + 构造面**:不依赖仓库此刻有哪些端点(那会把瞬时状态当恒定前提,
本仓记过多次),也不去 spawn 真仓扫描(CLI 级装车例单独证)。正反成对是硬要求:
每条"不判"都必须配一条"必须判" —— 否则判据漂绿与判据失明在账面上长得一样。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from scripts.audit_principal_consumed import (
    IDENTITY_STATE_ATTRS,
    PRINCIPAL_EXEMPTIONS,
    audit_text,
    build_index,
    partition_findings,
)

AI = Path(__file__).resolve().parents[1]

HEADER = """
from fastapi import Depends, Request
from app.core.jwt_auth import get_current_user_id, require_request_user_id
"""

IGNORES_PRINCIPAL = (
    HEADER
    + """
@router.get("/x")
async def get_x(thread_id: str, user_id: str = Depends(get_current_user_id)):
    return store.read(thread_id)
"""
)

USES_PRINCIPAL = (
    HEADER
    + """
@router.get("/x")
async def get_x(thread_id: str, user_id: str = Depends(get_current_user_id)):
    return store.read(thread_id, owner_user_id=user_id)
"""
)

# —— 判据二正例(必须不判)—————————————————————————————

DELEGATE_LOCAL_HELPER = (
    HEADER
    + """
def _owner_filter(request: Request, principal: str | None = None) -> str | None:
    if principal is not None:
        return principal
    return getattr(request.state, "user_id", None)

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=_owner_filter(request))
"""
)

DIRECT_GETATTR_FORM = (
    HEADER
    + """
@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=getattr(request.state, "user_id", None))
"""
)

DIRECT_ATTR_CHAIN_FORM = (
    HEADER
    + """
@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=request.state.user_id)
"""
)

# —— 判据二反例(必须仍判红;第二判据没被放宽的证明)——————————

LOG_ONLY_MODULE = (
    HEADER
    + """
import logging

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    logging.info("req arrived: %s", request)
    return engine.list_all()
"""
)

LOG_ONLY_UNBOUND_LOGGER = (
    HEADER
    + """
@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    logger.info("req arrived: %s", request)
    return engine.list_all()
"""
)

ROLE_ID_IS_NOT_PRINCIPAL = (
    HEADER
    + """
@router.get("/caps")
async def get_caps(request: Request, _user_id: str = Depends(require_request_user_id)):
    role_id = int(getattr(request.state, "role_id", 0) or 0)
    return {"admin": role_id >= 1}
"""
)

HELPER_RESOLVED_BUT_QUIET = (
    HEADER
    + """
def _stamp(request: Request) -> str:
    return request.headers.get("x-trace", "")

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(trace=_stamp(request))
"""
)

NESTED_CLOSURE_CONSUMES_PRINCIPAL = (
    HEADER
    + """
@router.get("/x")
async def get_x(user_id: str = Depends(get_current_user_id)):
    def _inner():
        return print(user_id)
    return {"scheduled": True}
"""
)

NO_DEPENDS = """
def helper(x: int) -> int:
    return x + 1
"""


def _rows(src: str, rel: str = "app/routers/x.py") -> list[dict]:
    return audit_text(rel, src)


def test_ignoring_handler_is_flagged() -> None:
    rows = _rows(IGNORES_PRINCIPAL)
    assert [r["func"] for r in rows] == ["get_x"], rows
    assert rows[0]["params"] == ["user_id"]
    assert rows[0]["status"] == "unused"


def test_consuming_handler_is_not_flagged() -> None:
    assert _rows(USES_PRINCIPAL) == []


# —— 判据二:正例(委托/直读 ⇒ 不判)——————————————————————


def test_local_helper_delegation_is_recognized() -> None:
    """`_owner_filter(request)` 一跳解析到本地 def 且其体内读 request.state.user_id ⇒ 不判。

    这条取代 G-261 之前钉"两通道写法仍会被报(已知假阳性)"的锁:第二判据落地后,
    hooks.py 那 11 处委托必须由判据自动认出 —— 哪天判据漂了,这条会喊。
    """
    assert _rows(DELEGATE_LOCAL_HELPER) == []


def test_direct_getattr_and_attr_chain_forms_are_recognized() -> None:
    assert _rows(DIRECT_GETATTR_FORM) == []
    assert _rows(DIRECT_ATTR_CHAIN_FORM) == []


def test_cross_file_delegation_is_recognized_via_index() -> None:
    """沿 `from .helpers import guard` 一跳解析到别文件的 def ⇒ 不判。"""
    api = (
        HEADER
        + """
from .helpers import guard

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=guard(request))
"""
    )
    helpers = """
from fastapi import Request

def guard(request: Request) -> str | None:
    return getattr(request.state, "user_id", None)
"""
    idx = build_index({"app/routers/x.py": api, "app/routers/helpers.py": helpers})
    assert audit_text("app/routers/x.py", api, idx) == []


# —— 判据二:反例(必须仍判红,证明"用 request 干别的"洗不成已消费)——


def test_logging_request_still_flagged() -> None:
    """变异取证①:只把 request 拿去打日志 ⇒ 仍判红、且不得冒出"未判定"。

    两种形态都必须红:`logging.info(…)`(绑定明确是仓外 stdlib)与
    `logger.info(…)`(无任何导入绑定,不在"本仓 helper"候选集)。
    若哪天把"未解析 ⇒ 一律未判定"写宽了,这两条会以"多了未判定行"翻红。
    """
    rows = _rows(LOG_ONLY_MODULE)
    assert [r["func"] for r in rows] == ["list_logs"], rows
    assert rows[0]["status"] == "unused"
    rows2 = _rows(LOG_ONLY_UNBOUND_LOGGER)
    assert [r["func"] for r in rows2] == ["list_logs"], rows2
    assert rows2[0]["status"] == "unused"


def test_role_id_read_is_not_identity_consumption() -> None:
    """role_id 不在名字清单里:只查角色的端点仍判红(由豁免登记处置,不由判据放行)。"""
    assert IDENTITY_STATE_ATTRS == ("user_id",)  # 清单锁:加名字必须是有意的、配对用例先行
    rows = _rows(ROLE_ID_IS_NOT_PRINCIPAL)
    assert [r["status"] for r in rows] == ["unused"], rows


def test_resolved_nonhelper_delegate_still_flagged() -> None:
    """解析到定义处、但被调函数不读身份 ⇒ 委托≠消费 ⇒ 判红,不记债。"""
    rows = _rows(HELPER_RESOLVED_BUT_QUIET)
    assert [r["status"] for r in rows] == ["unused"], rows


def test_nested_closure_reference_counts_under_current_semantics() -> None:
    """语义锁(不是愿望):引用面含嵌套 def —— 与判据一落地时逐字同形。

    G-261 只加第二判据,不动判据一。实测把"闭包引用不算消费"顺手做进来会新增
    第 19 条红(agents.py `execute_agent_stream` 经嵌套 event_generator 消费主体),
    那是改存量口径的独立收紧提案,须单独立票先清偿再收紧(§12f)。
    配对:同一段**删掉**嵌套里的引用 ⇒ 必须判红(证明这条锁有牙,不是恒绿)。
    """
    rows = _rows(NESTED_CLOSURE_CONSUMES_PRINCIPAL)
    assert rows == []  # 当前语义:嵌套引用算引用
    no_ref = NESTED_CLOSURE_CONSUMES_PRINCIPAL.replace("print(user_id)", "print('x')")
    rows2 = _rows(no_ref)
    assert [r["status"] for r in rows2] == ["unused"], rows2


# —— 未判定(仓内解析不到定义处)—————————————————————————


def test_unresolvable_repo_import_becomes_undetermined_not_red() -> None:
    """`from app.ghost import guard`(模块没被审到)+ `guard(request)` ⇒ 未判定,不冒红。"""
    src = (
        HEADER
        + """
from app.ghost import guard

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=guard(request))
"""
    )
    rows = _rows(src)
    assert [r["status"] for r in rows] == ["undetermined"], rows
    assert "guard" in rows[0]["callee"]
    assert rows[0]["reason"]  # 未判定必须带原因


def test_plain_function_is_ignored() -> None:
    assert _rows(NO_DEPENDS, rel="app/services/y.py") == []


# —— 显式豁免登记(纯函数级取证,不依赖仓库此刻的形态)—————


def test_partition_requires_reason_and_never_directory_scoped() -> None:
    rows = [
        {
            "file": "app/x.py",
            "line": 1,
            "func": "ep",
            "params": ["user_id"],
            "status": "unused",
        }
    ]
    # 无理由 ⇒ 拒绝(豁免必须带理由,这条不许漂)
    try:
        partition_findings(rows, ledger=[{"file": "app/x.py", "func": "ep", "reason": "  "}])
        raise AssertionError("空理由豁免必须抛错")
    except ValueError:
        pass
    out = partition_findings(rows, ledger=[{"file": "app/x.py", "func": "ep", "reason": "公共面"}])
    assert out["findings"] == [] and len(out["exempted"]) == 1
    # 按目录整片放行不允许:键必须 file+func 全等
    out2 = partition_findings(rows, ledger=[{"file": "app", "func": "*", "reason": "整片"}])
    assert len(out2["findings"]) == 1 and len(out2["exempted"]) == 0


def test_partition_flags_stale_and_undetermined_is_not_exemptible() -> None:
    und = [{
        "file": "app/x.py",
        "line": 3,
        "func": "ep2",
        "callee": "guard",
        "reason": "…",
        "status": "undetermined",
    }]
    out = partition_findings(und, ledger=[{"file": "app/x.py", "func": "ep2", "reason": "r"}])
    # 未判定不被豁免吞掉:它仍然在 undetermined 里,且 stale 只按"判红命中"算
    assert len(out["undetermined"]) == 1
    assert out["findings"] == [] and out["exempted"] == []
    assert out["stale_exemptions"] == ["app/x.py:ep2"]  # 豁免盖不住未判定 ⇒ 条目腐烂


def test_shipped_ledger_entries_are_all_keyed_and_reasoned() -> None:
    for e in PRINCIPAL_EXEMPTIONS:
        assert e["file"].endswith(".py") and "/" in e["file"] and e["func"]
        assert len(e["reason"].strip()) >= 20, e


# —— CLI 级装车证明 ————————————————————————————————————————


def test_cli_json_is_parseable_and_root_default_is_the_app_dir() -> None:
    """`--json` 可 parse、缺省 root 落在 `apps/ai-service`(不是 `apps/`)。"""
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
    assert isinstance(payload["exempted"], list)
    assert isinstance(payload["undetermined"], list)
    # 缺省 root 必须是 ai-service:parent[2] 会把范围错扩到整个 apps/(本票真踩过一次)
    assert all(f["file"].startswith("app/") for f in payload["findings"]), payload["findings"][:2]
    assert all(f["file"].startswith("app/") for f in payload["exempted"]), payload["exempted"][:2]


def test_cli_strict_exits_2_when_delegation_is_unresolvable(tmp_path: Path) -> None:
    """端到端:构造"仓内 import 但定义处不可得"的临时 git 仓 ⇒ 缺省 0、--strict 2。

    这是"拒绝出合格证"分支的装车证明 —— 只在纯函数级测三态、不证明 CLI 退出码接得上
    (守门 118/103 那一族:"有人跑它的那一刻才成立")。
    """
    (tmp_path / "app").mkdir()
    src = (
        HEADER
        + """
from app.ghost_module import guard

@router.get("/logs")
async def list_logs(request: Request, user_id: str = Depends(get_current_user_id)):
    return engine.list(owner_id=guard(request))
"""
    )
    f = tmp_path / "app" / "x.py"
    f.write_text(src, encoding="utf-8")
    common = ["git", "-c", "safe.directory=*", "-c", "init.defaultBranch=main"]
    subprocess.run(common + ["init", "-q", str(tmp_path)], check=True, capture_output=True)
    subprocess.run(common + ["add", "app/x.py"], cwd=tmp_path, check=True, capture_output=True)

    def run(extra: list[str]) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(AI / "scripts" / "audit_principal_consumed.py"), "--root", str(tmp_path), *extra],
            capture_output=True,
            text=True,
            check=False,
        )

    default = run(["--json"])
    assert default.returncode == 0, default.stdout[:200]
    payload = json.loads(default.stdout)
    assert payload["findings"] == []  # 未判定不冒红
    assert len(payload["undetermined"]) == 1
    assert run(["--json", "--strict"]).returncode == 2  # 拒绝出合格证


def test_cli_ledger_applies_on_constructed_shape(tmp_path: Path) -> None:
    """豁免台账对**构造面**同样生效:复刻 get_capabilities 的 role 闸形态 ⇒ exempted 计数。

    真仓此刻的样子不是恒定前提(§22c 教训),所以台账的"判红→豁免"分流必须在
    自己造的文件上被端到端证明,而不是只观察真仓的既有行。
    """
    (tmp_path / "app" / "core").mkdir(parents=True)
    src = """
from fastapi import Depends, Request
from app.core.jwt_auth import require_request_user_id

async def get_capabilities(
    request: Request,
    _user_id: str = Depends(require_request_user_id),
):
    role_id = int(getattr(request.state, "role_id", 0) or 0)
    return {"admin": role_id >= 1}
"""
    (tmp_path / "app" / "core" / "capability_matrix.py").write_text(src, encoding="utf-8")
    common = ["git", "-c", "safe.directory=*", "-c", "init.defaultBranch=main"]
    subprocess.run(common + ["init", "-q", str(tmp_path)], check=True, capture_output=True)
    subprocess.run(
        common + ["add", "app/core/capability_matrix.py"], cwd=tmp_path, check=True, capture_output=True
    )
    out = subprocess.run(
        [sys.executable, str(AI / "scripts" / "audit_principal_consumed.py"), "--root", str(tmp_path), "--json"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert out.returncode == 0, out.stderr[:200]
    payload = json.loads(out.stdout)
    assert payload["findings"] == []
    assert [e["func"] for e in payload["exempted"]] == ["get_capabilities"]
    assert payload["exempted"][0]["reason"]


def test_empty_enumeration_is_not_reported_as_clean(tmp_path: Path) -> None:
    """根不可当仓问 ⇒ 退出码 2 + "判据失明",绝不回空清单冒充"没有问题"。

    (2026-09-27:--json 载荷改纯 ASCII 转义 —— 重定向时控制台码页会先把下游解码打死,
    见脚本 main 内注释;所以这条断言按 JSON 结构判,不再按中文字符串面判。)
    """
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
    payload = json.loads(out.stdout)
    assert "error" in payload and "0" in payload["error"], payload


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
