# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目录台账 → operations → 能力探测覆盖引擎测试(2026-11-24 立)。

覆盖:
- 台账缺失/损坏 ⇒ unjudged,不回落空目录或假数据
- 分片守恒:每片 ≤200、并集=选中全集、dropped 计数
- 平台码/HTTP 状态 → 探测状态归类映射
- 探测执行器:read_only 默认跳过写操作、limit 截断、结果落库往返
- 路由:GET /coverage、POST /{key}/probe(limit 越界 400)、POST /{key}/coverage/plan

隔离:台账目录用 tmp_path 注入;PG 用内存 fake 会话;不连真实网络。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.jwt_auth import require_request_user_id
from app.routers import connectors as connectors_router
from app.services import connector_store
from app.services.connectors import coverage, coverage_probe
from app.services.connectors.base import ConnectorOperation
from app.services.tenant_scope import ConnectorScope
from tests._connector_fake import FakeSession

USER_A = "user-a"
TENANT = "2306401f-4b6d-4436-8f5c-aa36d25da676"

FIXTURE_CATALOG: dict[str, Any] = {
    "platform": "feishu",
    "label": "飞书",
    "source": {
        "index_url": "https://example.com/feishu-index",
        "fetched_at": "2026-11-24T00:00:00+00:00",
        "declared_total": 3,
        "enumeration_method": "docs-index",
    },
    "apis": [
        {
            "id": "list_chats",
            "domain": "im",
            "name": "列出群聊",
            "method": "GET",
            "path": "/im/v1/chats",
            "auth": "feishu_tenant",
            "scope": "im:chat",
            "read": True,
            "event": False,
            "doc_url": "https://example.com/a",
        },
        {
            "id": "send_msg",
            "domain": "im",
            "name": "发送消息",
            "method": "POST",
            "path": "/im/v1/messages",
            "auth": "feishu_tenant",
            "scope": "im:message:send",
            "read": False,
            "event": False,
        },
        {
            "id": "list_users",
            "domain": "contact",
            "name": "查询通讯录",
            "method": "GET",
            "path": "/contact/v3/users",
            "read": True,
        },
    ],
}


def _write_catalog(tmp_path: Any, platform: str, catalog: dict[str, Any]) -> str:
    path = tmp_path / f"{platform}.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    return str(tmp_path)


def _api(api_id: str, domain: str, method: str = "GET", read: bool = True) -> dict[str, Any]:
    return {
        "id": api_id,
        "domain": domain,
        "name": api_id,
        "method": method,
        "path": f"/{api_id}",
        "auth": "",
        "scope": "",
        "read": read,
        "event": False,
        "doc_url": "",
        "query": {},
        "body": None,
    }


# ---------------------------------------------------------------------------
# 台账加载与未判定
# ---------------------------------------------------------------------------


def test_missing_catalog_is_unjudged_not_empty(tmp_path):
    """台账文件不存在 ⇒ unjudged;视图不得给空目录/假数据。"""
    view = coverage.build_coverage("feishu", catalog_dir=str(tmp_path))
    assert view["catalog_state"] == "unjudged"
    assert view["apis"] == []
    assert view["domains"] == []
    assert view["totals"]["apis"] == 0
    assert view["totals"]["domains"] == 0
    assert view["unjudged_reason"]


def test_broken_catalog_is_unjudged(tmp_path):
    (tmp_path / "feishu.json").write_text("{不是合法 json", encoding="utf-8")
    bundle = coverage.load_catalog("feishu", catalog_dir=str(tmp_path))
    assert bundle.state == "unjudged"
    assert "解析失败" in bundle.reason


def test_catalog_loads_and_view_shape(tmp_path):
    catalog_dir = _write_catalog(tmp_path, "feishu", FIXTURE_CATALOG)
    bundle = coverage.load_catalog("feishu", catalog_dir=catalog_dir)
    assert bundle.state == "ok"
    assert len(bundle.apis) == 3
    view = coverage.build_coverage("feishu", catalog_dir=catalog_dir)
    assert view["catalog_state"] == "ok"
    assert view["totals"]["apis"] == 3
    assert view["totals"]["domains"] == 2
    assert view["source"]["declared_total"] == 3
    api_ids = [a["id"] for a in view["apis"]]
    assert api_ids == ["list_chats", "send_msg", "list_users"]
    for api in view["apis"]:
        assert api["status"]["state"] == "unprobed"
        assert api["status"]["probed_at"] is None
    im_domain = next(d for d in view["domains"] if d["key"] == "im")
    assert im_domain["count"] == 2
    assert im_domain["complete"] is False


def test_unknown_platform_unjudged():
    bundle = coverage.load_catalog("slack")
    assert bundle.state == "unjudged"


def test_catalog_events_overrides_and_null_total(tmp_path):
    """events 单列计数、base_url_override 进 operation、declared_total=null 仍 ok。"""
    catalog: dict[str, Any] = {
        "platform": "dingtalk",
        "label": "钉钉",
        "source": {
            "index_url": "",
            "fetched_at": "",
            "declared_total": None,
            "enumeration_method": "",
        },
        "domains": [{"key": "im", "label": "消息", "complete": True, "reason": "已展开"}],
        "unenumerated_domains": [{"key": "biz", "label": "审批", "reason": "未展开"}],
        "apis": [
            {
                "id": "a1",
                "domain": "im",
                "name": "列消息",
                "method": "POST",
                "path": "/topapi/message/list",
                "read": True,
                "base_url_override": "https://oapi.dingtalk.com",
                "verified": True,
                "notes": "自由文本,应被忽略",
            },
            {
                "id": "a2",
                "domain": "im",
                "name": "发消息",
                "method": "POST",
                "path": "/topapi/message/send",
                "read": False,
            },
        ],
        "events": [
            {
                "id": "e1",
                "domain": "im",
                "name": "回调事件",
                "method": "",
                "path": "",
                "read": False,
                "event": True,
            }
        ],
    }
    catalog_dir = _write_catalog(tmp_path, "dingtalk", catalog)
    bundle = coverage.load_catalog("dingtalk", catalog_dir=catalog_dir)
    assert bundle.state == "ok"
    assert len(bundle.apis) == 2
    assert len(bundle.events) == 1  # 事件不进 apis
    assert bundle.unenumerated_domains == [
        {"key": "biz", "label": "审批", "reason": "未展开"}
    ]
    assert bundle.domain_meta["im"]["label"] == "消息"
    assert bundle.source["declared_total"] == 0  # null 归一为 0,不判 unjudged

    view = coverage.build_coverage("dingtalk", catalog_dir=catalog_dir)
    assert view["totals"]["apis"] == 2  # events 不混进 totals.apis
    assert view["events"]["count"] == 1
    event_item = view["events"]["items"][0]
    assert event_item["event"] is True
    assert event_item["read"] is False
    # 空 method/path 的事件条目被容忍,缺省 POST 占位
    assert bundle.events[0]["method"] == "POST"
    assert view["unenumerated_domains"][0]["key"] == "biz"
    im_domain = next(d for d in view["domains"] if d["key"] == "im")
    assert im_domain["complete"] is True  # 台账域元数据优先
    assert im_domain["label"] == "消息"

    # base_url_override 必须进入 operation,并经 ConnectorOperation 往返不丢
    op = coverage.api_to_operation(bundle.apis[0])
    assert op["base_url"] == "https://oapi.dingtalk.com"
    parsed = ConnectorOperation.from_dict(op)
    assert parsed.base_url == "https://oapi.dingtalk.com"
    # 事件条目不生成可执行 operation
    event_op = coverage.api_to_operation(bundle.events[0])
    assert event_op["capability"] == "action"
    assert event_op["disabled"] is True


# ---------------------------------------------------------------------------
# 归类映射
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "platform,http_code,body,expected_state,expected_scope",
    [
        ("feishu", 403, {"code": 99991672, "msg": "no scope", "missing_scopes": ["im:chat"]},
         "permission_denied", "im:chat"),
        ("feishu", 400, {"code": 99991663, "msg": "invalid token"}, "need_user_token", ""),
        ("feishu", 403, {"code": 99991661}, "need_admin", ""),
        ("wecom", 400, {"errcode": 40014, "errmsg": "invalid access_token"}, "need_user_token", ""),
        ("dingtalk", 403, {"errcode": 88, "errmsg": "需要管理员"}, "need_admin", ""),
        ("wecom", 403, {"errcode": 48001}, "permission_denied", ""),
        ("feishu", 404, {"code": 404}, "unsupported", ""),
        ("feishu", 500, {"code": 12345, "msg": "未知错误码"}, "error", ""),
        ("feishu", 200, {"code": 0, "data": {}}, "available", ""),
    ],
)
def test_classify_outcome(platform, http_code, body, expected_state, expected_scope):
    outcome = coverage_probe.classify_outcome(platform, http_code, body)
    assert outcome["state"] == expected_state
    assert outcome["missing_scope"] == expected_scope
    if expected_state != "available":
        # 非 available 必须保留平台原始码,不得清空
        assert outcome["platform_code"] != "" or http_code is not None


def test_unknown_code_never_available():
    outcome = coverage_probe.classify_outcome("dingtalk", 200, {"errcode": 999999})
    assert outcome["state"] == "error"
    assert outcome["platform_code"] == "999999"


# ---------------------------------------------------------------------------
# 分片规划守恒
# ---------------------------------------------------------------------------


def _big_catalog() -> list[dict[str, Any]]:
    apis: list[dict[str, Any]] = []
    apis.extend(_api(f"im-{i}", "im") for i in range(250))
    apis.extend(_api(f"contact-{i}", "contact") for i in range(30))
    apis.extend(_api(f"docs-{i}", "docs") for i in range(10))
    return apis


def test_plan_shards_conservation():
    apis = _big_catalog()
    plan = coverage.plan_shards("feishu", apis, shard_size=200)
    assert plan["selected"] == 290
    assert plan["dropped"] == 0
    shard_ids = [api_id for shard in plan["connectors"] for api_id in shard["api_ids"]]
    assert len(shard_ids) == 290
    assert set(shard_ids) == {api["id"] for api in apis}
    assert all(len(shard["api_ids"]) <= 200 for shard in plan["connectors"])
    im_shards = [s for s in plan["connectors"] if s["domain"] == "im"]
    assert len(im_shards) == 2  # 250 ⇒ 200 + 50,同域连续编号不跨域混片
    assert im_shards[0]["key"] == "feishu-im-1"
    assert im_shards[1]["key"] == "feishu-im-2"


def test_plan_shards_dropped_unknown_ids():
    apis = _big_catalog()
    plan = coverage.plan_shards(
        "feishu", apis, domains=["im"], api_ids=["im-1", "not-exist"]
    )
    # im-1 命中;not-exist 匹配不上 ⇒ dropped=1
    assert plan["dropped"] == 1
    assert plan["selected"] == 1


def test_plan_shards_domain_filter():
    apis = _big_catalog()
    plan = coverage.plan_shards("feishu", apis, domains=["contact"])
    assert plan["selected"] == 30
    assert all(shard["domain"] == "contact" for shard in plan["connectors"])


# ---------------------------------------------------------------------------
# 探测执行器(注入 fake executor / persist)
# ---------------------------------------------------------------------------


async def test_probe_read_only_skips_write():
    apis = [_api("r1", "im", read=True), _api("w1", "im", method="POST", read=False)]
    calls: list[str] = []
    persisted: list[str] = []

    async def fake_exec(record: dict[str, Any], op: dict[str, Any]) -> dict[str, Any]:
        calls.append(op["id"])
        return {
            "state": "available",
            "http_code": 200,
            "platform_code": "",
            "reason": "ok",
            "missing_scope": "",
        }

    def fake_persist(
        tenant: str, scope: str, key: str, platform: str, api_id: str, outcome: dict[str, Any]
    ) -> None:
        persisted.append(api_id)

    out = await coverage_probe.probe_apis(
        record={"key": "feishu:managed", "type": "feishu", "tenant_id": "t1", "scope": "u1"},
        platform="feishu",
        apis=apis,
        read_only=True,
        limit=50,
        executor=fake_exec,
        persist=fake_persist,
    )
    assert out["probed"] == 1
    assert out["skipped"] == 1
    assert calls == ["r1"]
    assert persisted == ["r1"]


async def test_probe_read_only_false_includes_write():
    apis = [_api("r1", "im", read=True), _api("w1", "im", method="POST", read=False)]
    calls: list[str] = []

    async def fake_exec(record: dict[str, Any], op: dict[str, Any]) -> dict[str, Any]:
        calls.append(op["id"])
        return {
            "state": "available",
            "http_code": 200,
            "platform_code": "",
            "reason": "ok",
            "missing_scope": "",
        }

    out = await coverage_probe.probe_apis(
        record={"key": "feishu:managed", "type": "feishu", "tenant_id": "t1", "scope": "u1"},
        platform="feishu",
        apis=apis,
        read_only=False,
        limit=50,
        executor=fake_exec,
        persist=lambda *a: None,
    )
    assert out["probed"] == 2
    assert out["skipped"] == 0
    assert sorted(calls) == ["r1", "w1"]


async def test_probe_limit_truncates():
    apis = [_api(f"r{i}", "im") for i in range(5)]

    async def fake_exec(record: dict[str, Any], op: dict[str, Any]) -> dict[str, Any]:
        return {
            "state": "available",
            "http_code": 200,
            "platform_code": "",
            "reason": "ok",
            "missing_scope": "",
        }

    out = await coverage_probe.probe_apis(
        record={"key": "feishu:managed", "type": "feishu", "tenant_id": "t1", "scope": "u1"},
        platform="feishu",
        apis=apis,
        read_only=True,
        limit=2,
        executor=fake_exec,
        persist=lambda *a: None,
    )
    assert out["probed"] == 2
    assert out["skipped"] == 3


# ---------------------------------------------------------------------------
# 持久化往返(PG fake 会话)
# ---------------------------------------------------------------------------


class _FakeProbeSession:
    """最小内存会话面:execute upsert / fetchall 读回。"""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> str:
        tenant, _scope, _key, platform, api_id, state, http_code, code, reason, scope = params
        for row in self.rows:
            if (
                row["tenant_id"] == tenant
                and row["platform"] == platform
                and row["api_id"] == api_id
            ):
                row.update(
                    state=state,
                    http_code=http_code,
                    platform_code=code,
                    reason=reason,
                    missing_scope=scope,
                )
                return "UPDATE 1"
        self.rows.append(
            {
                "tenant_id": tenant,
                "platform": platform,
                "api_id": api_id,
                "state": state,
                "http_code": http_code,
                "platform_code": code,
                "reason": reason,
                "missing_scope": scope,
                "probed_at": None,
            }
        )
        return "INSERT 1"

    def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        tenant, platform = params[0], params[1]
        return [
            dict(row)
            for row in self.rows
            if row["tenant_id"] == tenant and row["platform"] == platform
        ]


def test_probe_persistence_roundtrip(monkeypatch):
    fake = _FakeProbeSession()
    monkeypatch.setattr(coverage_probe, "_pg_session", lambda: fake)

    outcome = {
        "state": "permission_denied",
        "http_code": 403,
        "platform_code": "99991672",
        "reason": "no scope",
        "missing_scope": "im:chat",
    }
    coverage_probe.upsert_result("t1", "u1", "feishu:managed", "feishu", "r1", outcome)
    loaded = coverage_probe.load_results("t1", "feishu")
    assert loaded["r1"]["state"] == "permission_denied"
    assert loaded["r1"]["http_code"] == 403
    assert loaded["r1"]["platform_code"] == "99991672"
    assert loaded["r1"]["missing_scope"] == "im:chat"

    # 幂等覆盖:同一 api_id 只留一行,状态更新为 available
    coverage_probe.upsert_result(
        "t1",
        "u1",
        "feishu:managed",
        "feishu",
        "r1",
        {
            "state": "available",
            "http_code": 200,
            "platform_code": "",
            "reason": "ok",
            "missing_scope": "",
        },
    )
    loaded = coverage_probe.load_results("t1", "feishu")
    assert len(loaded) == 1
    assert loaded["r1"]["state"] == "available"


# ---------------------------------------------------------------------------
# 路由层
# ---------------------------------------------------------------------------


def _build_app(owner: str, fake: FakeSession, monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(settings, "platform_default_tenant_id", TENANT)
    app = FastAPI()
    app.include_router(connectors_router.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: owner
    app.dependency_overrides[connectors_router.connector_context] = lambda: ConnectorScope(
        scope=owner, tenant_id=TENANT, role="owner", tenant_mode=False
    )
    return app


async def test_coverage_endpoint_unjudged(tmp_path, monkeypatch):
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", str(tmp_path))
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/connectors/coverage", params={"platform": "feishu"})
    assert res.status_code == 200
    body = res.json()
    assert body["catalog_state"] == "unjudged"
    assert body["apis"] == []


async def test_coverage_endpoint_with_catalog(tmp_path, monkeypatch):
    catalog_dir = _write_catalog(tmp_path, "feishu", FIXTURE_CATALOG)
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", catalog_dir)
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/connectors/coverage", params={"platform": "feishu"})
    assert res.status_code == 200
    body = res.json()
    assert body["catalog_state"] == "ok"
    assert body["totals"]["apis"] == 3


async def test_probe_limit_out_of_range_400(monkeypatch):
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/feishu:managed/probe", json={"limit": 201, "read_only": True}
        )
    assert res.status_code == 400
    assert "limit" in res.json()["error"]


async def test_probe_happy_path(tmp_path, monkeypatch):
    fake = FakeSession()
    app = _build_app(USER_A, fake, monkeypatch)

    connector_store.save(
        USER_A,
        {
            "key": "feishu:managed",
            "type": "feishu",
            "name": "飞书",
            "app_id": "",
            "app_secret": "",
            "extra": {},
            "mode": "preset",
            "spec": {"base_url": "https://open.feishu.cn/open-apis", "auth_kind": "feishu_tenant"},
            "operations": [],
            "enabled": True,
            "managed": True,
            "credential_source": "platform_env",
            "installed_at": "2026-11-24T00:00:00+00:00",
            "updated_at": "2026-11-24T00:00:00+00:00",
            "last_sync_at": "",
            "last_error": "",
            "sync_items": [],
        },
        tenant_id=TENANT,
    )

    async def fake_probe(**kwargs: Any) -> dict[str, Any]:
        apis = kwargs["apis"]
        return {
            "probed": len(apis),
            "skipped": 0,
            "summary": {"available": len(apis)},
            "results": [
                {
                    "api_id": api["id"],
                    "state": "available",
                    "http_code": 200,
                    "platform_code": "",
                    "reason": "",
                    "missing_scope": "",
                }
                for api in apis
            ],
        }

    monkeypatch.setattr(coverage_probe, "probe_apis", fake_probe)
    monkeypatch.setattr(connectors_router.managed, "hydrate", lambda record, scope=None: record)
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", _write_catalog(tmp_path, "feishu", FIXTURE_CATALOG))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/feishu:managed/probe",
            json={"api_ids": [], "domains": [], "limit": 50, "read_only": True},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["probed"] == 3
    assert body["skipped"] == 0
    assert len(body["results"]) == 3


async def test_coverage_plan_endpoint(tmp_path, monkeypatch):
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", _write_catalog(tmp_path, "feishu", FIXTURE_CATALOG))
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/feishu:managed/coverage/plan",
            json={"platform": "feishu", "domains": ["im"], "api_ids": []},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["selected"] == 2
    assert body["dropped"] == 0
    assert body["connectors"][0]["domain"] == "im"
    assert body["connectors"][0]["operations"] == 2


def test_plan_shards_operation_defs_conservation():
    """每片 operation_defs 与计数一致、≤200,method/path 与台账逐字一致。"""
    apis = _big_catalog()
    plan = coverage.plan_shards("feishu", apis, default_base_url="https://example.com")
    by_id = {api["id"]: api for api in apis}
    all_def_ids: list[str] = []
    for shard in plan["connectors"]:
        assert len(shard["operation_defs"]) == shard["operations"]
        assert shard["operations"] <= 200
        for op in shard["operation_defs"]:
            src = by_id[op["id"]]
            assert op["method"] == src["method"]
            assert op["path"] == src["path"]
            assert op["base_url"] == "https://example.com"
            all_def_ids.append(op["id"])
    assert set(all_def_ids) == {api["id"] for api in apis}

    # 写操作:confirm=true 且默认 disabled;读操作 confirm=false、enabled
    write_op = coverage.api_to_operation(_api("w1", "im", method="POST", read=False), "https://x")
    assert write_op["confirm"] is True
    assert write_op["disabled"] is True
    read_op = coverage.api_to_operation(_api("r1", "im", read=True), "https://x")
    assert read_op["confirm"] is False
    assert read_op["disabled"] is False


async def test_config_expand_by_api_ids(tmp_path, monkeypatch):
    """POST /config 按 api_ids 从台账展开 operations;GET 列表可见真实操作数。"""
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", _write_catalog(tmp_path, "feishu", FIXTURE_CATALOG))
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/config",
            json={
                "key": "feishu:im-1",
                "type": "feishu",
                "name": "飞书消息",
                "mode": "preset",
                "platform": "feishu",
                "api_ids": ["list_chats", "list_users"],
                "domains": [],
            },
        )
    assert res.status_code == 200
    body = res.json()
    assert body["operation_count"] == 2
    assert {op["id"] for op in body["operations"]} == {"list_chats", "list_users"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        list_res = await client.get("/api/connectors")
    items = list_res.json()["connectors"]
    match = next(item for item in items if item["key"] == "feishu:im-1")
    assert match["operation_count"] == 2
    # 分片连接器默认不开写权限
    assert match["spec"]["allow_write"] is False


async def test_config_expand_missing_catalog_fails(tmp_path, monkeypatch):
    """台账缺失时展开必须显式 400,不许静默存空壳连接器。"""
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    monkeypatch.setenv("IHUI_CONNECTOR_CATALOG_DIR", str(empty_dir))
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/config",
            json={
                "key": "feishu:im-1",
                "type": "feishu",
                "name": "飞书消息",
                "mode": "preset",
                "platform": "feishu",
                "api_ids": ["list_chats"],
            },
        )
    assert res.status_code == 400
    assert "台账未判定" in res.json()["error"] or "目录展开失败" in res.json()["error"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        list_res = await client.get("/api/connectors")
    assert list_res.json()["connectors"] == []


async def test_probe_instance_not_found_404(monkeypatch):
    """探测必须带已接入实例 key;实例不存在显式 404,不做免实例兜底探测。"""
    app = _build_app(USER_A, FakeSession(), monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/connectors/feishu:missing/probe",
            json={"limit": 50, "read_only": True},
        )
    assert res.status_code == 404
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
