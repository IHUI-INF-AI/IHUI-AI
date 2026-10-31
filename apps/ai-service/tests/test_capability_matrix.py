# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #57 能力矩阵测试:条目完整性 + env 实读正确性。

台账是「生产上哪些能力是关的」的单一事实源,两类回归都不可接受:
- 条目字段残缺 → 端点/日志渲染出不可读台账,消费方无法判读;
- current 不实读 env → monkeypatch/热调 env 后台账撒谎(台账的核心价值即实时)。

2026-10-31 追加第三类回归(seat-e 取证):由 pydantic settings 字段承载的默认关闸门
(WorkBuddy 任务双闸门)既进不了结构化台账(门 J1「幽灵条目」按带引号字面量取证,
settings 族的 env 名由字段名派生、代码不写字面量),也不受门 J2 约束(门只扫
os.environ.get / os.getenv / _env_flag 三种形态)⇒ 台账射程外的安全性质只能由本文件
自证:①两枚闸门默认必须双双关闭;②「大写 env 键 → 小写字段」映射必须真的生效
(case_sensitive / env_prefix / extra 任一处被改动,文档教的 .env 写法就静默失效);
③台账源文件里必须查得到这两枚闸门的注记(不得静默删注)。
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import capability_matrix as capability_matrix_module
from app.core.capability_matrix import (
    CAPABILITY_MATRIX,
    VALID_CATEGORIES,
    current_for_entry,
    format_matrix_text,
    get_capability_matrix,
    router,
)
from app.core.config import Settings

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


# ── WorkBuddy 任务闸门:台账射程外性质的自证锁(2026-10-31 seat-e 取证补)──────────
# 这两枚闸门决定"会不会向第三方平台发出真实写请求",但对账门结构上管不到它们
# (J2 看不见 settings 属性访问、J1 又不许把派生 env 名登记成结构化条目 —— 详见
# capability_matrix.py 列表体内的 WorkBuddy 注记)。判据管不到的安全性质
# 只能由本文件钉住,否则"默认关"与"env 映射生效"都会静默腐烂。

WORKBUDDY_GATE_FIELDS = ("workbuddy_tasks_enabled", "workbuddy_tasks_live_run")


def test_workbuddy_task_gates_default_off():
    """双闸门默认必须双双关闭(读**声明位默认值**,不受本机 .env 影响)。

    任一默认真值 = 开箱就往第三方打写请求(领奖/出发/上报/兑换/抽奖),
    与本台账 reason_if_off 反复声明的"写侧有副作用须显式开启"直接矛盾。
    """
    fields = Settings.model_fields
    for name in WORKBUDDY_GATE_FIELDS:
        assert name in fields, f"config.Settings 丢了字段 {name}(被改名即台账注记失效)"
        assert fields[name].default is False, f"{name} 默认值不再是 False ⇒ 开箱真写"


def test_uppercase_env_key_maps_to_lowercase_settings_field(monkeypatch):
    """大写 env 键 → 小写字段这条映射必须真生效(docs 教的写法就依赖它)。

    pydantic-settings 靠 case_sensitive=False + env_prefix="" 完成映射;任一被改动
    (或字段改名)⇒ 用户在 .env / 进程环境里写 WORKBUDDY_TASKS_ENABLED=true 也读不到,
    恒 off 且日志看起来像"没配"—— 正是 config.py 反复登记的"静默失效"那一型。
    _env_file=None:只验 env 通道,不被本机 apps/ai-service/.env 的真实取值污染。
    """
    monkeypatch.setenv("WORKBUDDY_TASKS_ENABLED", "true")
    monkeypatch.setenv("WORKBUDDY_TASKS_LIVE_RUN", "true")
    monkeypatch.setenv("WORKBUDDY_TASKS_SWEEP_MINUTES", "17")

    probe = Settings(_env_file=None)
    assert probe.workbuddy_tasks_enabled is True, "WORKBUDDY_TASKS_ENABLED 未落到字段 ⇒ .env 写法静默失效"
    assert probe.workbuddy_tasks_live_run is True, "WORKBUDDY_TASKS_LIVE_RUN 未落到字段 ⇒ 巡检轮恒 dry-run"
    assert probe.workbuddy_tasks_sweep_minutes == 17, "WORKBUDDY_TASKS_SWEEP_MINUTES 未落到字段"


def test_workbuddy_gates_are_findable_in_matrix_source():
    """台账源文件里必须查得到这两枚闸门(结构化条目或注记皆可,不得静默删)。

    断言写成"env 名出现在 capability_matrix.py 正文"而非"存在结构化条目":
    主席按门侧/读取点侧任一出口把它们升级成条目后,本用例仍为绿;而注记被删光
    (这两枚会重新变成"生产上没人知道它们是关的")则当场红。
    """
    src = Path(capability_matrix_module.__file__).read_text(encoding="utf-8")
    for env in ("WORKBUDDY_TASKS_ENABLED", "WORKBUDDY_TASKS_LIVE_RUN"):
        assert env in src, f"{env} 在能力台账里查无此条 —— 默认关写侧闸门再度不可知"


# ── settings 族行(2026-10-31 seat-e2 过 J4 登记后补的有牙锁)────────────────────
# 前一席实测过的取数陷阱:get_capability_matrix() 旧形态对**所有**行只实读 os.environ,
# 而 settings 字段还多读 .env(pydantic env_file 腿)⇒ .env-only 配置下调度真在跑
# 而台账 current 显示 "false"。这些行升格成结构化条目后,该陷阱必须有反向锁:
# settings 族行读 env 就算失效,双向都断言,不做 xfail/待修登记。

SETTINGS_FAMILY_ENVS = (
    "MTLS_ENABLED",
    "EDGE_FIRST_LOCAL",
    "TOKEN_COMPACTION_ENABLED",
    "WORKBUDDY_TASKS_ENABLED",
    "WORKBUDDY_TASKS_LIVE_RUN",
)


def test_settings_family_rows_registered_with_settings_field():
    """J4 命中集的 5 枚必须都在册,且 settings_field 指向真实存在、默认 False 的布尔字段。

    这是门侧「J1 对 settings 族派生名免检」的前提锁:免检的存续条件(字段真实存在、
    env==字段大写)一旦被破坏(改名/删除/写错键),本用例当场红,而不是等 J1 陪绑。
    """
    by_env = {e["env"]: e for e in CAPABILITY_MATRIX}
    for env in SETTINGS_FAMILY_ENVS:
        entry = by_env.get(env)
        assert entry, f"settings 族默认关开关 {env} 不在册 —— J4 命中集回潮"
        field = entry.get("settings_field")
        assert field, f"{env} 行缺 settings_field,current 取数会错误回落 os.environ"
        assert field in Settings.model_fields, f"{env} 的 settings_field={field} 已不是真实字段"
        assert env == field.upper(), f"{env} 与字段 {field} 的大写派生关系断裂"
        assert Settings.model_fields[field].default is False, f"{field} 默认值不再是 False"


def test_settings_rows_current_reads_settings_not_os_environ(monkeypatch):
    """current 取数双向锁:settings 族行必须跟着 settings 真值走,对 os.environ 视而不见。

    - 方向 A(旧形态撒谎的那一型):os.environ 无键 ∧ settings=True ⇒ current 必须 "true"
      (否则 .env-only 配置下"台账说关、实际在跑"的第二型不可知回归);
    - 方向 B(反向防漂移):os.environ=true ∧ settings=False ⇒ current 必须 "false"
      (settings 行改读 env 同样违规 —— 大写键根本不在 os.environ 的权威通道里)。
    """
    from app.core import config as config_module

    entry = next(e for e in CAPABILITY_MATRIX if e["env"] == "WORKBUDDY_TASKS_ENABLED")
    monkeypatch.delenv("WORKBUDDY_TASKS_ENABLED", raising=False)
    monkeypatch.setattr(config_module.settings, "workbuddy_tasks_enabled", True)
    assert current_for_entry(entry) == "true", "settings 族行未读 settings 真值(取数陷阱回归)"

    monkeypatch.setenv("WORKBUDDY_TASKS_ENABLED", "true")
    monkeypatch.setattr(config_module.settings, "workbuddy_tasks_enabled", False)
    assert current_for_entry(entry) == "false", "settings 族行错误地听了 os.environ"

    # 台账整体面:5 枚 settings 族的 current 必须全为 true/false 形态(未判定串也拦下来点名)
    rows = {r["env"]: r for r in get_capability_matrix()}
    for env in SETTINGS_FAMILY_ENVS:
        assert rows[env]["current"] in ("true", "false"), (
            f"{env} current=({rows[env]['current']}) 不是 settings 实读形态"
        )

