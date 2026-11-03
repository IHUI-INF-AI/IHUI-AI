# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workbook_agent 凭据(2026-11-02 立,N 席收尾)。

对照取证:`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md` §B
—— 对照件 Qoder 内置 `xlsx-sidecar.exe` 的 sidecar 协议里 `read_formula_cells` / `save_archive` /
`recalc_cells` 三格。本仓只对齐 `open / read_range / write_cells / save / close`,
`recalc_cells` 按红线**刻意不对齐**(判据见 `apps/api/src/services/workbook-service.ts` 头注)。

**契约真相源 = apps/api,不是想象中的形状**:
- 路径面逐字对 `apps/api/src/routes/index.ts` 的 `prefix: '/api/workbook'` + `routes/workbook.ts` 的五条子路由;
- 响应壳对 `utils/response.ts` 的 `{code, message, data}` 与 `routes/workbook.ts` `send()` 注入的 `protocolVersion`;
- 错误码对 `workbook-service.ts` 的 `WorkbookErrorCode` 封闭集;
- 路由身份键集**从 `packages/types/src/tool-contract.ts` 现读**(§0.6 单一真相源,本文件不复制第二份清单)。

测试隔离(AGENTS §5):全程 monkeypatch `httpx.AsyncClient`,**不连 apps/api、不连 PG 8810/Redis 8811**;
断言一律落在「请求有没有发出 / 发了几条 / 发到了哪条路径 / 头里带的是谁」这类**副作用面**,
不断言文案(文案是可改的,副作用不是)。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.services.mcp_server import (
    _TOOL_HANDLERS,
    _TOOLS,
    _tool_workbook_close,
    _tool_workbook_open,
    _tool_workbook_read_range,
    _tool_workbook_write_cells,
)
from app.services.workbook_agent import _COMMAND_PATHS, workbook_agent

BASE = "http://api.test"
_AGENT_SRC = Path(__file__).resolve().parents[1] / "app" / "services" / "workbook_agent.py"
UID_A = "11111111-2222-3333-4444-555555555555"
UID_B = "99999999-8888-7777-6666-555555555555"
FID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
NEW_FID = "ffffffff-1111-2222-3333-444455555555"
HANDLE = "0123456789abcdef0123456789abcdef"
SOURCE_SHA = "aa" * 32

_OPEN_DATA: dict[str, Any] = {
    "handle": HANDLE,
    "fileId": FID,
    "name": "报表.xlsx",
    "sha256": SOURCE_SHA,
    "sheets": [{"name": "Sheet1", "rowCount": 10, "columnCount": 4}],
    "formulaCellCount": 1,
    "hasFormulas": True,
    "formulaScanTruncated": False,
    "protocolVersion": 1,
}

# api 侧 readCell 对公式格的既定形状(workbook-service.ts:375-382):
# value 恒 null + 公式原文 + state='formula-uncomputed' + cachedValueWithheld=true。
_READ_DATA: dict[str, Any] = {
    "sheet": "Sheet1",
    "range": "A1:B1",
    "cellCount": 2,
    "formulaCellCount": 1,
    "cells": [
        {"address": "A1", "kind": "value", "value": 7},
        {
            "address": "B1",
            "kind": "formula",
            "value": None,
            "formula": "SUM(A1:A9)",
            "state": "formula-uncomputed",
            "cachedValueWithheld": True,
        },
    ],
    "protocolVersion": 1,
}

_WRITE_DATA: dict[str, Any] = {
    "sheet": "Sheet1",
    "writtenCells": 1,
    "hasFormulas": True,
    "recalcUnsupported": True,
    "staleFormulaCells": [
        {"sheet": "Sheet1", "address": "B1", "formula": "SUM(A1:A9)", "via": "range-ref"}
    ],
    "formulaScanTruncated": False,
    "protocolVersion": 1,
}

_SAVE_DATA: dict[str, Any] = {
    "savedFileId": NEW_FID,
    "name": "报表-改.xlsx",
    "bytes": 6213,
    "sourceFileId": FID,
    "sourceSha256Before": SOURCE_SHA,
    "sourceSha256After": SOURCE_SHA,
    "sourceUntouched": True,
    "hasFormulas": True,
    "recalcUnsupported": True,
    "staleFormulaCells": _WRITE_DATA["staleFormulaCells"],
    "formulaScanTruncated": False,
    "protocolVersion": 1,
}


def ok(body: dict[str, Any]) -> dict[str, Any]:
    """apps/api 成功面:success() 的 {code:0, message, data}(utils/response.ts:22)。"""
    return {"code": 0, "message": "success", "data": body}


def err(status: int, message: str, code: str) -> dict[str, Any]:
    """apps/api 失败面:routes/workbook.ts:106 的 {code, message, errorCode, detail}。"""
    return {"code": status, "message": message, "errorCode": code, "detail": None}


class _Resp:
    def __init__(self, status_code: int, body: dict[str, Any]) -> None:
        self.status_code = status_code
        self._body = body
        self.content = b"{}" if body else b""

    def json(self) -> dict[str, Any]:
        return self._body


class FakeClient:
    """httpx.AsyncClient 替身:按 path 路由应答表,并把每一次出站请求留痕。"""

    routes: dict[str, tuple[int, dict[str, Any]]] = {}
    seen: list[tuple[str, dict[str, Any], dict[str, str]]] = []
    break_paths: set[str] = set()

    def __init__(self, **_kw: Any) -> None:
        pass

    async def __aenter__(self) -> FakeClient:
        return self

    async def __aexit__(self, *_a: Any) -> None:
        return None

    async def post(
        self, url: str, headers: dict[str, str] | None = None, json: Any = None
    ) -> _Resp:
        path = str(url).replace(BASE, "")
        self.seen.append((path, dict(json or {}), dict(headers or {})))
        if path in self.break_paths:
            raise httpx.ConnectError("simulated unreachable")
        status, body = self.routes.get(path, (404, err(404, "no fake route", "NO_ROUTE")))
        return _Resp(status, body)


@pytest.fixture()
def fake_http(monkeypatch: pytest.MonkeyPatch) -> type[FakeClient]:
    FakeClient.routes = {}
    FakeClient.seen = []
    FakeClient.break_paths = set()
    # 顺序纪律:setenv 在发起调用前生效 —— _secret() 每次调用现读 env
    monkeypatch.setenv("API_INTERNAL_BASE_URL", BASE)
    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-secret")
    monkeypatch.setattr("httpx.AsyncClient", FakeClient)
    return FakeClient


def routing_identity_keys() -> set[str]:
    """从 TS 单源现读 ROUTING_IDENTITY_KEYS —— 本文件不复制第二份键清单(§0.6)。"""
    src = (
        Path(__file__).resolve().parents[3] / "packages" / "types" / "src" / "tool-contract.ts"
    ).read_text(encoding="utf-8")
    m = re.search(r"ROUTING_IDENTITY_KEYS\s*=\s*\[(.*?)\]\s*as const", src, re.S)
    assert m is not None, "ROUTING_IDENTITY_KEYS not found in its single source"
    keys = set(re.findall(r"'([^']+)'", m.group(1)))
    assert len(keys) >= 8, f"parsed {sorted(keys)} —— source shape drifted"
    return keys


def workbook_tool_names() -> set[str]:
    return {t.name for t in _TOOLS if t.name.startswith("workbook_")}


# ---------------------------------------------------------------------------
# ① 归属主体只认承载层注入的 __user_id;模型自报的身份不进 schema
# ---------------------------------------------------------------------------


async def test_identity_never_in_schema_even_in_positive_call(
    fake_http: type[FakeClient],
) -> None:
    """正向对照:合法注入时请求**确实发出**且头里带的就是注入的那个人。"""
    fake_http.routes["/api/workbook/open"] = (200, ok(_OPEN_DATA))
    out = await _tool_workbook_open({"file_id": FID, "__user_id": UID_A})
    assert out["ok"] is True, f"out={out}"
    assert len(fake_http.seen) == 1, f"expected exactly 1 request, got {fake_http.seen}"
    path, body, headers = fake_http.seen[0]
    assert path == "/api/workbook/open"
    assert headers.get("x-user-id") == UID_A, f"identity header wrong: {headers}"
    assert "x-internal-service-token" in headers, f"no credential sent: {headers}"
    # body 里没有身份字段:api 侧 openSchema 只认 fileId
    assert set(body.keys()) == {"fileId"}, f"body leaked fields: {body}"


async def test_model_self_reported_identity_is_ignored(fake_http: type[FakeClient]) -> None:
    """模型往 args 里塞 user_id/userId ⇒ 出站头仍是宿主注入值,且自报值一个字节都不出去。"""
    fake_http.routes["/api/workbook/open"] = (200, ok(_OPEN_DATA))
    out = await _tool_workbook_open(
        {"file_id": FID, "__user_id": UID_A, "user_id": UID_B, "userId": UID_B}
    )
    assert out["ok"] is True, f"out={out}"
    _path, body, headers = fake_http.seen[0]
    assert headers.get("x-user-id") == UID_A
    assert UID_B not in str(body) and UID_B not in str(headers), "self-reported subject escaped"


async def test_missing_principal_makes_zero_requests(fake_http: type[FakeClient]) -> None:
    out = await _tool_workbook_open({"file_id": FID})
    assert out["ok"] is False and out["errorCode"] == "PRINCIPAL_REQUIRED", f"out={out}"
    assert out["status"] == "refused", "no principal is a decision, not an inability to judge"
    assert fake_http.seen == [], f"requests went out without a principal: {fake_http.seen}"


def test_workbook_schemas_carry_no_routing_identity_keys() -> None:
    """schema 面:工作簿工具入参键集与 ROUTING_IDENTITY_KEYS 不相交,也不含宿主注入位。"""
    forbidden = routing_identity_keys() | {"__user_id", "__session_id", "__user_role"}
    by_name = {t.name: t for t in _TOOLS if t.name.startswith("workbook_")}
    assert by_name, "no workbook_* tool declared"
    for name, tool in by_name.items():
        props = set((tool.input_schema or {}).get("properties", {}))
        assert props, f"{name}: empty schema hides the leak, it does not prevent it"
        assert not (props & forbidden), f"{name} exposes identity keys {props & forbidden}"


# ---------------------------------------------------------------------------
# ② read_range:公式单元格不得把缓存值当当前值返回(原票红线)
# ---------------------------------------------------------------------------


async def test_formula_cell_has_no_current_value_only_uncomputed(
    fake_http: type[FakeClient],
) -> None:
    fake_http.routes["/api/workbook/read"] = (200, ok(_READ_DATA))
    out = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "A1:B1", "__user_id": UID_A}
    )
    assert out["ok"] is True, f"out={out}"
    by_addr = {c["address"]: c for c in out["cells"]}
    assert by_addr["A1"]["value"] == 7, "plain value cell must keep its value"
    formula = by_addr["B1"]
    assert formula["kind"] == "formula"
    assert formula["value"] is None, f"formula cell returned a value: {formula}"
    assert formula["state"] == "formula-uncomputed", f"missing uncomputed marker: {formula}"
    assert formula.get("cachedValueWithheld") is True, "cache-withheld must be stated"
    assert formula["formula"] == "SUM(A1:A9)", "formula text must survive the hop"
    assert "cachedValue" not in formula and "cached_value" not in formula
    assert out["formulaCellCount"] == 1, "formula count passthrough drifted"


async def test_client_does_not_invent_values_when_api_sends_a_stale_cache(
    fake_http: type[FakeClient],
) -> None:
    """即使上游误带了一个缓存数,客户端也不得把它抬成"当前值"(不补、不洗、不改 kind)。"""
    drifted = dict(_READ_DATA)
    drifted["cells"] = [
        {
            "address": "B1",
            "kind": "formula",
            "value": None,
            "formula": "SUM(A1:A9)",
            "state": "formula-uncomputed",
            "legacyCachedValue": 42,
        }
    ]
    fake_http.routes["/api/workbook/read"] = (200, ok(drifted))
    out = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "B1", "__user_id": UID_A}
    )
    cell = out["cells"][0]
    assert cell["value"] is None and cell["state"] == "formula-uncomputed"
    assert cell["legacyCachedValue"] == 42, "client must not silently drop upstream fields"


# ---------------------------------------------------------------------------
# ③ 写操作落新档不覆盖原档
# ---------------------------------------------------------------------------


async def test_write_lands_a_new_file_and_carries_the_untouched_proof(
    fake_http: type[FakeClient],
) -> None:
    fake_http.routes["/api/workbook/write"] = (200, ok(_WRITE_DATA))
    fake_http.routes["/api/workbook/save"] = (200, ok(_SAVE_DATA))
    out = await _tool_workbook_write_cells(
        {
            "handle": HANDLE,
            "sheet": "Sheet1",
            "cells": [{"address": "A2", "value": 9}],
            "__user_id": UID_A,
        }
    )
    assert out["ok"] is True, f"out={out}"
    assert [p for p, _b, _h in fake_http.seen] == [
        "/api/workbook/write",
        "/api/workbook/save",
    ], f"unexpected call sequence: {fake_http.seen}"
    # 非破坏式的凭据是**两个 sha 相等 + 新档 id ≠ 原档 id**,不是客户端的一句"我没覆盖"
    assert out["sourceFileId"] == FID and out["savedFileId"] == NEW_FID
    assert out["savedFileId"] != out["sourceFileId"]
    assert out["sourceSha256Before"] == SOURCE_SHA == out["sourceSha256After"]
    assert out["sourceUntouched"] is True
    assert out["protocolVersion"] == 1
    # save 的入参结构上**点不出任何文件**:只有 handle(+ 可选 name)
    save_body = fake_http.seen[1][1]
    assert set(save_body.keys()) <= {"handle", "name"}, f"save could target a file: {save_body}"
    assert FID not in str(save_body), "original file id must never be a save parameter"
    # 覆盖原档需要 PUT/PATCH/DELETE;本客户端只会 POST 五条命令路径
    assert all(p in _COMMAND_PATHS.values() for p, _b, _h in fake_http.seen)


async def test_save_denied_is_reported_as_written_not_saved_not_as_success(
    fake_http: type[FakeClient],
) -> None:
    """write 成功、save 被拒 ⇒ 整单不得报成 ok(改了没存 = 半成功必须显式)。"""
    fake_http.routes["/api/workbook/write"] = (200, ok(_WRITE_DATA))
    fake_http.routes["/api/workbook/save"] = (
        409,
        err(409, "原档在本次打开之后被别处改动", "WORKBOOK_SOURCE_CHANGED"),
    )
    out = await _tool_workbook_write_cells(
        {
            "handle": HANDLE,
            "sheet": "Sheet1",
            "cells": [{"address": "A2", "value": 9}],
            "__user_id": UID_A,
        }
    )
    assert out["ok"] is False, f"half-success reported as success: {out}"
    assert out["errorCode"] == "WORKBOOK_SOURCE_CHANGED"
    assert out["subStatus"] == "written_not_saved", f"out={out}"
    # 上游作出了否定结论 ⇒ refused,不是 unjudged
    assert out["status"] == "refused"
    assert "savedFileId" not in out, f"a failed save must not report a new file: {out}"


# ---------------------------------------------------------------------------
# ④ 跨主体访问被拒且没有产生新文件/新查询(成对留正向对照)
# ---------------------------------------------------------------------------


async def test_cross_subject_read_is_denied_with_zero_side_effects(
    fake_http: type[FakeClient],
) -> None:
    fake_http.routes["/api/workbook/read"] = (
        403,
        err(403, "该会话不属于当前主体", "WORKBOOK_FORBIDDEN_OWNER"),
    )
    out = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "A1:B1", "__user_id": UID_B}
    )
    assert out["ok"] is False and out["errorCode"] == "WORKBOOK_FORBIDDEN_OWNER", f"out={out}"
    assert out["status"] == "refused", "ownership denial is a verdict, not an unjudged"
    assert len(fake_http.seen) == 1, f"extra queries: {fake_http.seen}"
    assert out.get("cells") is None, "denied read must not yield any cell payload"


async def test_cross_subject_write_denied_issues_no_save(fake_http: type[FakeClient]) -> None:
    """正向对照在同一枚断言里:同形状换成本人主体 ⇒ write+save 两条都发出。"""
    fake_http.routes["/api/workbook/write"] = (
        403,
        err(403, "该会话不属于当前主体", "WORKBOOK_FORBIDDEN_OWNER"),
    )
    fake_http.routes["/api/workbook/save"] = (200, ok(_SAVE_DATA))
    out = await _tool_workbook_write_cells(
        {
            "handle": HANDLE,
            "sheet": "Sheet1",
            "cells": [{"address": "A2", "value": 9}],
            "__user_id": UID_B,
        }
    )
    assert out["ok"] is False and out["errorCode"] == "WORKBOOK_FORBIDDEN_OWNER"
    assert [p for p, _b, _h in fake_http.seen] == ["/api/workbook/write"], (
        f"save ran after a denied write: {fake_http.seen}"
    )
    assert "savedFileId" not in out, f"denied write reported a new file: {out}"

    # 正向对照:换回句柄的真正主人,两条命令都必须发出去
    fake_http.seen.clear()
    fake_http.routes["/api/workbook/write"] = (200, ok(_WRITE_DATA))
    good = await _tool_workbook_write_cells(
        {
            "handle": HANDLE,
            "sheet": "Sheet1",
            "cells": [{"address": "A2", "value": 9}],
            "__user_id": UID_A,
        }
    )
    assert good["ok"] is True, f"positive control failed: {good}"
    assert [p for p, _b, _h in fake_http.seen] == ["/api/workbook/write", "/api/workbook/save"]
    assert fake_http.seen[0][2].get("x-user-id") == UID_A


async def test_cross_subject_open_is_indistinguishable_from_missing(
    fake_http: type[FakeClient],
) -> None:
    """api 侧把"别人的档"与"没有这份档"回成同一个码(可枚举性收口),客户端不得改写。"""
    fake_http.routes["/api/workbook/open"] = (
        404,
        err(404, "工作簿文件不存在", "WORKBOOK_FILE_NOT_FOUND"),
    )
    out = await _tool_workbook_open({"file_id": FID, "__user_id": UID_B})
    assert out["ok"] is False and out["errorCode"] == "WORKBOOK_FILE_NOT_FOUND"
    assert out["status"] == "refused"
    assert "handle" not in out, f"a denied open must hand back no session: {out}"


# ---------------------------------------------------------------------------
# ⑤ 非法句柄 / 会话已关 / 上游不可达 ⇒ 具名错误码 + 未判定(不用 0 或空结果冒充)
# ---------------------------------------------------------------------------


async def test_unknown_handle_is_unjudged_not_empty(fake_http: type[FakeClient]) -> None:
    fake_http.routes["/api/workbook/read"] = (
        410,
        err(410, "句柄不存在或已失效", "WORKBOOK_HANDLE_UNDETERMINED"),
    )
    out = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "A1", "__user_id": UID_A}
    )
    assert out["ok"] is False and out["errorCode"] == "WORKBOOK_HANDLE_UNDETERMINED"
    assert out["status"] == "unjudged", f"an undetermined handle must not read as a verdict: {out}"
    assert out.get("cells") is None and out.get("cellCount") is None, "must not fake an empty read"


async def test_upstream_unreachable_is_unjudged_and_names_no_write(fake_http: type[FakeClient]) -> None:
    fake_http.routes["/api/workbook/close"] = (200, ok({"closed": True, "savedFileIds": [NEW_FID]}))
    fake_http.break_paths.add("/api/workbook/close")
    out = await _tool_workbook_close({"handle": HANDLE, "__user_id": UID_A})
    assert out["ok"] is False and out["errorCode"] == "UPSTREAM_UNAVAILABLE", f"out={out}"
    assert out["status"] == "unjudged"
    assert out.get("closed") is not True, f"unreachable upstream must not claim a close: {out}"


async def test_two_xx_without_a_data_shell_is_unjudged(fake_http: type[FakeClient]) -> None:
    """200 但 data 不是对象 ⇒ 未判定。原实现在这里回落 {} ⇒ cells=[] 冒充"读过了"。"""
    fake_http.routes["/api/workbook/read"] = (200, {"code": 0, "message": "success", "data": None})
    out = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "A1:B1", "__user_id": UID_A}
    )
    assert out["ok"] is False, f"empty success masquerading as a read: {out}"
    assert out["errorCode"] == "UPSTREAM_REPLY_UNDETERMINED"
    assert out["status"] == "unjudged"
    assert "cells" not in out, "must not surface an empty cell list"


async def test_no_credential_at_all_is_named_and_sends_zero_requests(
    fake_http: type[FakeClient],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """既签不出票、又没配常驻密钥 ⇒ 具名 CREDENTIAL_UNAVAILABLE,一次都不发。

    不发是对的;但把它发出去再拿回 401 也是错的 —— 那会被读成"这人没权限",
    而真问题是本机没配凭据(§0.3「没判绝不写成判过」的出站面形态)。
    `jwt_secret_for_ticket` 先读 settings 快照再读 env,所以这里按"未启用"这一真状态
    打桩它本身,而不是 delenv(delenv 打不动已导入的 settings)。
    """
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.setattr("app.core.internal_ticket.jwt_secret_for_ticket", lambda: "")
    out = await _tool_workbook_open({"file_id": FID, "__user_id": UID_A})
    assert out["ok"] is False and out["errorCode"] == "CREDENTIAL_UNAVAILABLE", f"out={out}"
    assert out["status"] == "unjudged"
    assert fake_http.seen == [], f"a credential-less request went out: {fake_http.seen}"


async def test_closed_session_reports_named_code_through_close(fake_http: type[FakeClient]) -> None:
    """close 之后再拿同一句柄:api 判「未判定」,客户端原样透传,不缓存成"已经关好了"。"""
    fake_http.routes["/api/workbook/close"] = (
        410,
        err(410, "句柄不存在或已失效", "WORKBOOK_HANDLE_UNDETERMINED"),
    )
    out = await _tool_workbook_close({"handle": HANDLE, "__user_id": UID_A})
    assert out["errorCode"] == "WORKBOOK_HANDLE_UNDETERMINED" and out["status"] == "unjudged"
    assert out.get("savedFileIds") is None, f"denied close must not report saved files: {out}"


async def test_non_list_cells_names_the_real_shape_and_sends_nothing(
    fake_http: type[FakeClient],
) -> None:
    """模型把 cells 写成对象 ⇒ 必须点名"收到的是 dict",不能被折成空数组后报"不能为空"。

    这条同时锁住承载层:mcp_server 的 handler 原先 `isinstance(cells, list) else []`
    就把这一格判没了 —— 结论换了型,该修的方向也跟着被带偏(§0.3/§0.10)。
    """
    out = await _tool_workbook_write_cells(
        {
            "handle": HANDLE,
            "sheet": "Sheet1",
            "cells": {"address": "A1", "value": 1},
            "__user_id": UID_A,
        }
    )
    assert out["ok"] is False, f"a malformed cells payload must not report success: {out}"
    assert out["errorCode"] == "WORKBOOK_INVALID_INPUT", f"wrong code: {out}"
    assert "dict" in out["error"], f"must name the received shape: {out}"
    assert fake_http.seen == [], f"malformed write still touched the api: {fake_http.seen}"


# ---------------------------------------------------------------------------
# 形状锁:双射注册不半边 + 路径表与 api 挂载面对齐
# ---------------------------------------------------------------------------


async def test_upstream_exception_text_does_not_reach_the_model_face(
    fake_http: type[FakeClient],
) -> None:
    """api 的 detail.reason 是 exceljs 抛出的原文(给运维看的),本通道的收件人是模型。

    正向对照在下面那枚:结构性 detail 键(cellCount/limit)**必须**原样留着 ——
    剥的只有原文异常串,不是把整坨 detail 吞掉(吞掉就没有可整改性,§5e-1)。
    """
    fake_http.routes["/api/workbook/open"] = (
        415,
        {
            "code": 415,
            "message": "xlsx 解析失败(非工作簿或已损坏)",
            "errorCode": "WORKBOOK_FORMAT_UNSUPPORTED",
            "detail": {"reason": "Cannot read properties of undefined (reading 'sheets') at Workbook.<anonymous>"},
        },
    )
    out = await _tool_workbook_open({"file_id": FID, "__user_id": UID_A})
    assert out["ok"] is False and out["errorCode"] == "WORKBOOK_FORMAT_UNSUPPORTED"
    assert out["status"] == "refused"
    assert "Cannot read properties" not in str(out), f"raw upstream stack leaked: {out}"
    assert "reason" not in (out.get("detail") or {})
    assert "xlsx" in out["error"], "api 的具名回话本身必须留住"

    fake_http.routes["/api/workbook/read"] = (
        413,
        {
            "code": 413,
            "message": "区域过大",
            "errorCode": "WORKBOOK_RANGE_TOO_LARGE",
            "detail": {"cellCount": 99999, "limit": 20000},
        },
    )
    kept = await _tool_workbook_read_range(
        {"handle": HANDLE, "sheet": "Sheet1", "range": "A1:ZZZ999", "__user_id": UID_A}
    )
    assert kept["detail"] == {"cellCount": 99999, "limit": 20000}, f"structural detail dropped: {kept}"


def test_workbook_tools_are_bijections_not_half_tables() -> None:
    """_TOOLS 与 _TOOL_HANDLERS 里的工作簿工具名**成对出现**(只声明不接线 = 模型看得见
    点了就炸;只接线不声明 = 判据进了代码却没有任何一面能调到它)。"""
    declared = workbook_tool_names()
    wired = {n for n in _TOOL_HANDLERS if n.startswith("workbook_")}
    assert declared, "no workbook tool declared in _TOOLS"
    assert declared == wired, f"declared-only={declared - wired} handler-only={wired - declared}"
    assert declared == {"workbook_open", "workbook_read_range", "workbook_write_cells", "workbook_close"}
    for name in declared:
        assert callable(_TOOL_HANDLERS[name]), f"{name} is wired to a non-callable"


def test_command_paths_match_the_mounted_api_surface() -> None:
    """`prefix(/api/workbook)` ∪ `routes/workbook.ts` 的五条子路由逐字对齐(装错一条 = 生产 404)。"""
    assert set(_COMMAND_PATHS) == {"open", "read", "write", "save", "close"}
    assert set(_COMMAND_PATHS.values()) == {
        "/api/workbook/open",
        "/api/workbook/read",
        "/api/workbook/write",
        "/api/workbook/save",
        "/api/workbook/close",
    }


def test_workbook_client_imports_cleanly_and_exposes_no_local_judgment() -> None:
    """形状锁:客户端不得自带第二份地址/区域判据(§0.6 单源在 workbook-service.ts),
    也不许长出 recalc/convert 的影子(红线是"不假装重算",不是"先把口子留着")。"""
    src = _AGENT_SRC.read_text(encoding="utf-8")
    assert "from __future__ import annotations" in src
    for drifted in ("parseCellRef", "parseRangeRef", "parseFormulaRefs", "colToNumber", "CELL_RE"):
        assert drifted not in src, f"api-side judgment {drifted} replicated into the client"
    assert not any(k in _COMMAND_PATHS for k in ("recalc", "convert")), "recalc/convert crept in"
    assert "def recalc" not in src and "def convert" not in src
    assert workbook_agent is not None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
