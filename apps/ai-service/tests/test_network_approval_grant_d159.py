# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""D159 网络放行三档 + 审批载荷的执行环境事实(2026-09-30 用户批"三档到底")。

三条不可漂在本文件里各有一条对应用例:
① **显示"沙箱内"而实际 plain = 误导用户放行** ⇒ 读不到必须是 ``available:false``,
   且断言整个载荷里**不出现** ``inSandbox`` 这个键(不是"出现但为 false");
② **授权主体只从承载层取** ⇒ 落规则/命中/撤销全按传入的 ``owner``,回传体里没有
   target 这一格(帧上的目标与库里落的那条结构上同源),越权撤销与"没这条"同形
   且必须**断言副作用没发生**(别人那条规则仍能在库里查到,不是只看 200/ok);
③ **与 D158 共面板共 API** ⇒ 网络目标走同一对 ``GET/DELETE /llm/approval-grants``,
   这里断言列表里两种 kind 同时出现且撤销仍按同一把手。

全程独立 SQLite(tmp_path),不触生产库/Redis(AGENTS §5 测试隔离铁律)。
"""

from __future__ import annotations

import asyncio
import importlib
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import approval_persistence as ap
from app.services import network_approval as na

SVC = Path(__file__).resolve().parents[1]  # apps/ai-service(本服务源码根)
REPO = Path(__file__).resolve().parents[3]  # 仓库根(packages/ 在那一侧)

A = "11111111-1111-4111-8111-111111111111"
B = "22211111-2222-4222-8222-222222222222"
PUB = "https://api.example.com:8443/v1/echo"


@pytest.fixture()
def db(tmp_path, monkeypatch):
    """独立 SQLite;与既有 approval_grants 测试同法(绝不连生产库)。"""
    monkeypatch.setattr(ap, "_DB_PATH", tmp_path / "d159_grants.db")
    ap.close()
    yield ap
    ap.close()


@pytest.fixture()
def mod():
    return importlib.import_module("app.routers.llm")


@pytest.fixture()
def env_on(monkeypatch):
    """显式开档(默认就是开),避免继承上一次用例或本机 env 留下的关档。"""
    monkeypatch.setenv("IHUI_APPROVAL_ENV_REPORT", "1")
    yield


# ---------------------------------------------------------------------------
# ① 执行环境:读不到 ⇒ available:false,且绝不出现"沙箱"宣称键
# ---------------------------------------------------------------------------


def test_命令族按分派字段报事实_docker是沙箱内_local是沙箱外(env_on):
    dock = ap.describe_exec_environment("run_command", {"sandbox_backend": "docker"})
    assert dock is not None
    assert dock["inSandbox"] is True
    assert dock["backend"] == "docker"
    # docker 是 `--network=none`(sandbox.py 现读),这条是"网络不通"的真事实
    assert dock["networkIsolated"] is True

    local = ap.describe_exec_environment("run_command", {})
    assert local is not None
    # **这就是本票买的东西**:缺省档报"沙箱外",不报"沙箱内"
    assert local["inSandbox"] is False
    assert local["networkIsolated"] is False


def test_后端名不认识就不编事实(env_on):
    """未知后端名 ⇒ None(不猜一个 plain 冒充"沙箱外",也不冒充"沙箱内")。"""
    assert ap.describe_exec_environment("run_command", {"sandbox_backend": "landmock"}) is None


def test_读不到就整字段不给沙箱宣称_反向对照(env_on):
    """反向对照(票第 8 栏爆炸半径):非命令族工具**不得**产出任何"在不在沙箱"的字样。

    把这条判据写成"断言 inSandbox is False"是错的 —— 那等于承认"我读到了:不在沙箱",
    而事实是"这个工具没有可读的执行环境"。所以断言的是**键不存在**。
    """
    payload = na.approval_env_payload("write_file", {"path": "a.md"}, owner=A)
    env = payload.get("exec_environment")
    assert isinstance(env, dict), "开关开着 ⇒ 必须上报'读不到'这一态,而不是静默缺字段"
    assert env.get("available") is False
    assert "inSandbox" not in env
    assert "backend" not in env
    assert "networkIsolated" not in env
    assert "network_target" not in payload


def test_关档时一个新字段都不发(monkeypatch):
    """回退开关:IHUI_APPROVAL_ENV_REPORT=0 ⇒ 整块不发(前端整块不渲染,不是渲染成未上报)。"""
    monkeypatch.setenv("IHUI_APPROVAL_ENV_REPORT", "0")
    assert na.approval_env_payload("run_command", {}, owner=A) == {}
    assert ap.describe_exec_environment("run_command", {"sandbox_backend": "docker"}) is None


def test_未知后端时不下发网络那一行(env_on):
    """ssh/modal 等没有可读的隔离语义 ⇒ 该字段缺席(界面那一行也不渲染),不猜。"""
    ssh = ap.describe_exec_environment("run_command", {"sandbox_backend": "ssh"})
    assert ssh is not None and ssh["inSandbox"] is True
    assert "networkIsolated" not in ssh


# ---------------------------------------------------------------------------
# ② 网络目标:主体只从入参来;客户端拿不到把手;撤销断言"库里真没了"
# ---------------------------------------------------------------------------


def test_目标事实_display是host_port_且不给前端归一键(env_on):
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None
    assert (fact.host, fact.port, fact.protocol) == ("api.example.com", 8443, "https")
    assert fact.display == "api.example.com:8443"
    wire = fact.to_event_payload()
    assert wire["display"] == "api.example.com:8443"
    # 服务端把手不进载荷:给了就等于让客户端自报一个键去 DELETE / 去指认放行对象
    assert "cache_key" not in wire and "owner_bound_key" not in wire
    # 公网目标此刻**没被拦** —— "还没有规则"是这条审批要问的事,不是被拦的事实
    assert fact.reason is None


def test_本地目标才算被静态策略判死(env_on):
    local = na.describe_network_target("http://127.0.0.1:8080/x", owner=A)
    assert local is not None
    assert local.reason == na.DENIAL_REASON_NOT_ALLOWED_LOCAL
    assert local.display == "127.0.0.1:8080"
    assert na.describe_network_target("   ", owner=A) is None


def test_三档_once不落库_session与always各自落(db, env_on):
    once = na.describe_network_target(PUB, owner=A)
    assert once is not None
    assert na.grant_network_target(once, "once") is True
    # 副作用没发生:库里一条网络规则都没有(不是只看返回 True)
    assert db.list_keys("network") == []

    assert na.grant_network_target(once, "session") is True
    assert na.check_network_grant(once) == "session"

    always_fact = na.describe_network_target(PUB, owner=A)
    assert na.grant_network_target(always_fact, "always") is True
    assert na.check_network_grant(always_fact) == "always"
    # always 的寿命 = 90 天(票面预填口径),落进 expires_at 而不是永久
    row = db._get_conn().execute(
        "SELECT expires_at FROM approval_grants WHERE kind='network' AND scope='always'"
    ).fetchone()
    assert row is not None and row["expires_at"] is not None
    assert na.NETWORK_ALWAYS_TTL_DAYS == 90

    assert na.grant_network_target(once, "nonsense-scope") is False


def test_缺主体不落规则(db, env_on):
    """owner 缺失 ⇒ 不落库(fail-closed)。断言库里没有新增行,不是只看 False。"""
    fact = na.describe_network_target(PUB, owner=None)
    assert fact is not None and fact.owner_bound_key is None
    assert na.grant_network_target(fact, "always") is False
    assert db.list_keys("network") == []


def test_A的规则不替B放行_正向对照也在(db, env_on):
    fact_a = na.describe_network_target(PUB, owner=A)
    assert fact_a is not None and na.grant_network_target(fact_a, "always") is True

    fact_b = na.describe_network_target(PUB, owner=B)
    assert fact_b is not None
    assert na.check_network_grant(fact_b) is None  # B 不命中 A 的规则
    assert na.check_network_grant(fact_a) == "always"  # 别把修复做成永远不命中


def test_撤销后库里真没了(db, env_on):
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None and na.grant_network_target(fact, "always") is True
    assert na.revoke_network_grant(fact) is True
    assert na.check_network_grant(fact) is None
    assert db.list_keys("network") == []


# ---------------------------------------------------------------------------
# ③ 共面板共 API:GET/DELETE /llm/approval-grants 同时覆盖两种 kind
# ---------------------------------------------------------------------------


def _req(uid, **query):
    return SimpleNamespace(state=SimpleNamespace(user_id=uid), query_params=query)


def test_列表含网络目标行_前缀显示host_port(mod, db, env_on):
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None
    mod._persist_network_grant(fact, "approve", "always", "sess-A", A)
    resp = asyncio.run(mod.list_approval_grants(_req(A)))
    assert resp["ok"] is True
    rows = {g["kind"]: g for g in resp["grants"]}
    assert set(rows) == {"network"}, f"只该看到自己主体的网络规则,实得 {list(rows)}"
    assert rows["network"]["prefix"] == "api.example.com:8443"
    assert "\x1f" not in rows["network"]["prefix"]  # 绝不把归一键/哈希端给人看
    # B 的面板看不到
    assert asyncio.run(mod.list_approval_grants(_req(B)))["grants"] == []


def test_撤销端点_他人撤销no_op且原规则存活(mod, db, env_on):
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None and fact.owner_bound_key is not None
    db.grant("always", fact.owner_bound_key, "network", ttl_days=90)

    out_b = asyncio.run(
        mod.revoke_approval_grant(_req(B, cache_key=fact.owner_bound_key, kind="network"))
    )
    assert out_b["ok"] is True  # 与"没这条"同形,不做存在性探针
    # 但**副作用没发生**:A 的规则仍在库里、仍可命中
    assert na.check_network_grant(fact) == "always"

    out_a = asyncio.run(
        mod.revoke_approval_grant(_req(A, cache_key=fact.owner_bound_key, kind="network"))
    )
    assert out_a["ok"] is True
    assert na.check_network_grant(fact) is None
    assert db.list_keys("network") == []


def test_撤销端点_未确认成功必须报失败(mod, db, env_on):
    """把 revoke 换成"查而不删"的形态,端点必须回 ok:False(不是照旧 ok:True)。"""
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None and fact.owner_bound_key is not None
    db.grant("always", fact.owner_bound_key, "network", ttl_days=90)

    def _noop_revoke(_key: str, _kind: str) -> None:
        return None

    monkey = db.revoke
    db.revoke = _noop_revoke  # type: ignore[assignment]
    try:
        out = asyncio.run(
            mod.revoke_approval_grant(_req(A, cache_key=fact.owner_bound_key, kind="network"))
        )
    finally:
        db.revoke = monkey  # type: ignore[assignment]
    assert out["ok"] is False
    assert na.check_network_grant(fact) == "always"


def test_非白名单kind不许从这对路由撤(mod, db, env_on):
    """kind 白名单只管这对路由的撤销口;mcp_tool 那类键不得从这里被摘。"""
    from fastapi.responses import JSONResponse

    key = db.scoped_cache_key(A, "some-tool-key")
    db.grant("always", key, "mcp_tool")
    out = asyncio.run(mod.revoke_approval_grant(_req(A, cache_key=key, kind="mcp_tool")))
    assert isinstance(out, JSONResponse) and out.status_code == 422
    # 副作用没发生:那条 mcp_tool 规则仍在
    assert db.check(key, "mcp_tool") == "always"


def test_条目里的目标决定落库_非approve与缺主体都不落(mod, db, env_on):
    fact = na.describe_network_target(PUB, owner=A)
    assert fact is not None
    # 拒绝 ⇒ 什么都不写
    mod._persist_network_grant(fact, "reject", "always", "s", A)
    assert db.list_keys("network") == []
    # 缺主体 ⇒ 什么都不写(与 D158 同一退化)
    mod._persist_network_grant(fact, "approve", "always", "s", None)
    assert db.list_keys("network") == []
    # once ⇒ 不落库
    mod._persist_network_grant(fact, "approve", "once", "s", A)
    assert db.list_keys("network") == []
    # 条目里没有目标(非出站工具) ⇒ 不动
    mod._persist_network_grant(None, "approve", "always", "s", A)
    assert db.list_keys("network") == []
    # 正方向:always 真的落了
    mod._persist_network_grant(fact, "approve", "always", "s", A)
    assert db.list_keys("network") == [fact.owner_bound_key]


# ---------------------------------------------------------------------------
# ④ 命中侧(免弹窗读点):三档落库后必须**真的**决定下一次弹不弹
# ---------------------------------------------------------------------------


def test_命中侧_once不免弹_session与always免弹_撤销后恢复弹窗(mod, db, env_on):
    """`_network_grant_hits` 与 `_persist_network_grant` 成套 —— 只有写入没有读取,
    "始终允许该目标(90 天后失效)"就是一条没人查的死规则,下一轮照弹(票"三档到底")。"""
    args = {"url": PUB}
    # 起点:没有任何规则 ⇒ 必弹
    assert mod._network_grant_hits(args, A) is False
    # once ⇒ 不落库 ⇒ 不免弹(最小特权档每次都问)
    mod._persist_network_grant(na.network_target_from_args(args, owner=A), "approve", "once", "s", A)
    assert mod._network_grant_hits(args, A) is False
    # session ⇒ 免弹(本对话)
    mod._persist_network_grant(
        na.network_target_from_args(args, owner=A), "approve", "session", "s", A
    )
    assert mod._network_grant_hits(args, A) is True
    # 撤销必须"库/内存真没了"⇒ 下一轮恢复弹窗(只回 ok 不算撤干净)
    assert na.revoke_network_grant(na.network_target_from_args(args, owner=A)) is True
    assert db.list_keys("network") == []
    assert mod._network_grant_hits(args, A) is False
    # 同一时刻 B 绝不因 A 的 session 规则免弹(批 52 无主体键面也不并入本判据)
    mod._persist_network_grant(
        na.network_target_from_args(args, owner=A), "approve", "always", "s", A
    )
    assert mod._network_grant_hits(args, A) is True
    assert mod._network_grant_hits(args, B) is False


def test_命中侧_多目标只命中其一不得免弹_缺主体与无目标照弹(mod, db, env_on):
    """部分命中免弹 = 把用户从未见过的第二个目标静默连出去(与"批 A 连 B"同方向)。"""
    two = {"url": PUB, "webhook_url": "https://other.example.com/hook"}
    one = {"url": PUB}
    fact = na.network_target_from_args(two, owner=A)
    assert fact is not None
    mod._persist_network_grant(fact, "approve", "always", "s", A)  # 只放了**第一个**目标
    assert mod._network_grant_hits(two, A) is False  # 第二个没批 ⇒ 照弹
    assert mod._network_grant_hits(one, A) is True  # 单目标调用则免弹
    assert mod._network_grant_hits(one, None) is False  # 缺主体 fail-closed
    assert mod._network_grant_hits({"path": "a.md"}, A) is False  # 非出站工具不受影响


def test_命中侧真的接在审批门前_装车锁(mod):
    """函数在而免弹窗块没调 = 没有(守门 70/76/81 同型)。

    判据必须是**抑制条件的形状**而不是"名字出现次数":第一版锁写成
    ``count("_network_grant_hits(") >= 2``,拿 ``if False and _network_grant_hits(``
    一突变就蒙混过关(实测绿 ⇒ 那把锁无牙,已就地加强)。名字计数连"死代码守卫"都
    拦不住,更拦不住"写在函数里但没人调"。
    """
    import inspect

    src = inspect.getsource(mod)
    assert "if _approval_needed and _network_grant_hits(\n" in src, (
        "免弹窗块里没有这个抑制条件(必须直接以 `_approval_needed and` 打头,"
        "任何 `False and` / 注释里的同名都不算接线)"
    )
    gate = src[src.index("_grant_scope = _grant_lookup(") :]
    assert "if _approval_needed and _network_grant_hits(" in gate[: gate.index("if _approval_needed:\n")], (
        "命中侧不在发帧之前的免弹窗块里(接在发帧之后就等于没接)"
    )


# ---------------------------------------------------------------------------
# 装车锁:字段清单两侧同形 + 生产调用点在位(函数在而没人调 = 没有)
# ---------------------------------------------------------------------------

_NEW_FIELDS = ("exec_environment", "network_target", "blocked_network_targets")


def test_契约两份字段清单都登记了新字段():
    py = (SVC / "app/core/sse_contract.py").read_text(encoding="utf-8")
    ts = (REPO / "packages/shared/src/sse/contract.ts").read_text(encoding="utf-8")
    start = py.index('SSEEventContract(\n        "tool-approval"')
    arm = py[start:]
    arm = arm[: arm.index("),")]
    for field in _NEW_FIELDS:
        assert field in arm, f"sse_contract.py 的 tool-approval 字段清单漏了 {field}"
        assert field in ts, f"contract.ts 的 tool-approval 帧漏了 {field}"


def test_事件名一个都没加_本票不新增帧():
    py = (SVC / "app/core/sse_contract.py").read_text(encoding="utf-8")
    ts = (REPO / "packages/shared/src/sse/contract.ts").read_text(encoding="utf-8")
    for forbidden in ("approval-environment", "network-approval", "tool-approval-env"):
        assert forbidden not in py
        assert forbidden not in ts


def test_llm路由真的调了这三个出口():
    """源码级装车锁(守门 70/76/81 同型):判据住在 helper 而调用点没接,就等于没有。"""
    src = (SVC / "app/routers/llm.py").read_text(encoding="utf-8")
    assert "**_approval_env_fields(" in src, "审批帧没接环境字段出口"
    assert '"net_fact": _approval_network_fact(' in src, "待决条目没记网络目标"
    assert "_persist_network_grant(" in src, "结算侧没接三档落库出口"
    assert '"exec_prefix", "network"' in src, "列表/撤销的 kind 白名单没放开 network"


def test_agent任务流也把环境事实挂上了事件():
    src = (SVC / "app/services/agent_loop_v2.py").read_text(encoding="utf-8")
    assert "approval_env_payload" in src
    # 原判据钉的是字面量 `exec_environment=env_facts.get("exec_environment")`。
    # 本枚把三个字段统一成"先绑变量再 isinstance 收窄"(mypy 只对**名字**收窄,不对**调用表达式**收窄,
    # 原写法在守门 35 上判 `Any | object` 不兼容),那条字面量因此必然消失。
    # **要守的不变量从来没变**:实参位真的把这个字段递出去了,且值来自唯一出口、形状窄过。
    # 所以判据换成形状无关的三条,而不是把旧字面量改回来(那等于为了让测试绿而退回类型洞)。
    assert "exec_environment=" in src, "审批帧实参没接执行环境字段(造好没装车)"
    assert 'exec_env = env_facts.get("exec_environment")' in src, "环境事实必须取自 approval_env_payload 那份"
    assert "isinstance(exec_env, dict)" in src, "不得把未收窄的值直接递进实参位"
    assert "blocked_net = env_facts.get(" in src and "isinstance(blocked_net, list)" in src, (
        "三个字段一条规矩:blocked_network_targets 也必须先绑变量再收窄,不许两个窄一个不窄"
    )


def test_网络键的算法只有一份实现():
    """禁止在路由里再抄一份"网络键怎么算" —— 两处算同一件事必漂移(AGENTS §5 同条)。"""
    src = (SVC / "app/routers/llm.py").read_text(encoding="utf-8")
    assert "normalize_net_key" not in src, "路由不得自己算网络键(出口在 network_approval)"
    body = Path(na.__file__).read_text(encoding="utf-8")
    assert body.count("def grant_network_target") == 1
    assert "ttl_days=NETWORK_ALWAYS_TTL_DAYS" in body
    assert str(na.NETWORK_ALWAYS_TTL_DAYS) == "90"

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
