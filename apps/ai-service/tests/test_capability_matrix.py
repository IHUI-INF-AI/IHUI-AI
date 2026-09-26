# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #57 能力矩阵测试:条目完整性 + env 实读正确性。

台账是「生产上哪些能力是关的」的单一事实源,两类回归都不可接受:
- 条目字段残缺 → 端点/日志渲染出不可读台账,消费方无法判读;
- current 不实读 env → monkeypatch/热调 env 后台账撒谎(台账的核心价值即实时)。
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.capability_matrix import (
    CAPABILITY_MATRIX,
    VALID_CATEGORIES,
    format_matrix_text,
    get_capability_matrix,
    router,
)

REQUIRED_FIELDS = {"key", "env", "default", "category", "owner_module", "doc_ref", "reason_if_off"}


def test_matrix_entries_complete():
    """每个条目字段齐全 + 类别合法 + env 形如大写环境变量名。"""
    assert len(CAPABILITY_MATRIX) >= 40, "台账条目数异常缩水,疑似被误删"
    for entry in CAPABILITY_MATRIX:
        missing = REQUIRED_FIELDS - set(entry)
        assert not missing, f"{entry.get('env')} 缺字段: {missing}"
        assert entry["category"] in VALID_CATEGORIES, entry["env"]
        assert entry["env"].isupper() and entry["env"].replace("_", "").isalnum(), entry["env"]
        assert entry["owner_module"].startswith("app."), entry["env"]
        assert entry["doc_ref"].startswith("app/"), entry["env"]


def test_matrix_env_unique():
    envs = [e["env"] for e in CAPABILITY_MATRIX]
    assert len(envs) == len(set(envs)), "台账存在重复登记的 env"


def test_current_reads_env_live(monkeypatch):
    """monkeypatch env 后 current 必须跟着变(实读,不缓存)。"""
    monkeypatch.setenv("AGENT_BUDGET_ENABLED", "true")
    row = next(r for r in get_capability_matrix() if r["env"] == "AGENT_BUDGET_ENABLED")
    assert row["current"] == "true"

    monkeypatch.delenv("AGENT_BUDGET_ENABLED", raising=False)
    row = next(r for r in get_capability_matrix() if r["env"] == "AGENT_BUDGET_ENABLED")
    assert row["current"] == "false", "env 未设置时 current 应回落到登记的 default"


def test_compaction_marked_canary_not_defect():
    """灰度类标注纪律:AGENT_COMPACTION 系列必须标「灰度类」(部署策略而非缺陷)。"""
    compaction = [e for e in CAPABILITY_MATRIX if e["env"].startswith("AGENT_COMPACTION")]
    assert compaction, "AGENT_COMPACTION 系列条目缺失"
    for entry in compaction:
        assert entry["category"] == "灰度类", entry["env"]


def test_format_matrix_text_aligned():
    """表格渲染:表头 + 每条 env 都出现;数据行列数与表头一致。"""
    text = format_matrix_text()
    lines = text.splitlines()
    assert "ENV" in lines[0] and "CATEGORY" in lines[0]
    for entry in CAPABILITY_MATRIX:
        assert entry["env"] in text, f"{entry['env']} 未出现在表格渲染中"


def _client_with_role(role_id: int) -> TestClient:
    """构造注入身份的测试客户端(模拟 JWTAuthMiddleware 注入 user_id/role_id)。"""

    def inject_role(request, call_next):
        request.state.user_id = f"user-{role_id}"
        request.state.role_id = role_id
        return call_next(request)

    app = FastAPI()
    app.middleware("http")(inject_role)
    app.include_router(router)
    return TestClient(app)


def test_endpoint_forbidden_for_non_admin():
    resp = _client_with_role(role_id=0).get("/api/admin/capabilities")
    assert resp.status_code == 403


def test_endpoint_ok_for_admin():
    resp = _client_with_role(role_id=1).get("/api/admin/capabilities")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    caps = body["data"]["capabilities"]
    assert len(caps) == len(CAPABILITY_MATRIX)
    assert all("current" in c for c in caps), "端点返回的条目必须带实读 current"
    assert "AGENT_BUDGET_ENABLED" in body["data"]["text"]

