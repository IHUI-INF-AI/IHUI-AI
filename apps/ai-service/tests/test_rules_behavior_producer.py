# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-805 接线回归:规则动作 → 行为样本 → 自动草稿这条链必须真的通(2026-09-29 立)。

立项事实(现读,非引用旧档):
  - `RulesEngine._track_behavior` 是读链 `_get_behaviors` → `_extract_patterns` →
    `auto_generate_rules` 唯一的数据源生产者,全仓生产面**零调用点**
    (`git grep -n "_track_behavior"` 只命中 def 本身);
  - 读侧在 `len(behaviors) < _PATTERN_MIN_SAMPLES` 那一格直接 `return []`,
    降级统计 `_extract_patterns_statistical` 也在这道门之后 —— 样本为零时两者都够不到;
  - ⇒ `POST /api/rules/auto-generate` 对任何用户都静态返回 `[]`(票面"空草稿")。

本文件的判据分工(每条正向都配一条会翻红的对照,防"永远绿的断言"):
  A. 生产者写的键 = 读者读的键(内存档 + Redis 档各一条,Redis 档逐字用常量拼键名)。
  B. 全链路:新用户做完 create/update/delete 后,经 HTTP 拿到的草稿**非空**。
  C. 对照①:一条动作都不记 → 仍 `[]`(证明 B 的非空不是夹具白送的)。
  D. 对照②:把生产出口摘掉、动作照做 → 回到 `[]`(证明 B 靠的是这次接的那根线)。
  E. 跨用户隔离:内存降级面是进程级共享列表,必须按主体过滤,否则 A 的样本进 B 的草稿。
  F. 身份只认令牌主体 + 身份未验证一律不写(幽灵键会污染共享降级面)。
  G. 埋点失败不得让用户的写操作失败(best-effort 是本出口的契约,不是可选行为)。

测试隔离(AGENTS.md §5 铁律):零生产 PG(8810)/ Redis(8811) 触达 ——
asyncpg 建池直接抛、LLM 出口与编排事件总线 monkeypatch 成内存桩、
引擎用 `tmp_path` 自建实例并强制内存档,绝不碰仓库真实规则目录。
"""

from __future__ import annotations

import inspect
import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.params import Depends as DependsMarker
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.routers import rules as rules_router
from app.services import rules_engine as re_module
from app.services.rules_engine import (
    _BEHAVIOR_KEY_PREFIX,
    _PATTERN_MIN_SAMPLES,
    RulesEngine,
    record_rule_action_behavior,
)

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-rules-behavior-only"
USER_A = "user-a-rules-behavior"
USER_B = "user-b-rules-behavior"

API_BASE = "http://rules-behavior.test"
CREATE_PATH = "/api/rules"
AUTOGEN_PATH = "/api/rules/auto-generate"


def _token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "ihui-ai-users",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


class _FakeSyncRedis:
    """够用的 sync Redis 替身:只实现行为 hash 用到的 5 个命令。

    存在理由:内存档与 Redis 档是 `_track_behavior`/`_get_behaviors` 的两条取径,
    只测内存档就等于没测"生产上真正走的那一条"键名对不对。
    """

    def __init__(self) -> None:
        self.hashes: dict[str, dict[str, str]] = {}

    def hset(self, key: str, field: str, value: str) -> int:
        self.hashes.setdefault(key, {})[field] = value
        return 1

    def hlen(self, key: str) -> int:
        return len(self.hashes.get(key, {}))

    def hkeys(self, key: str) -> list[str]:
        return list(self.hashes.get(key, {}).keys())

    def hdel(self, key: str, *fields: str) -> int:
        bucket = self.hashes.get(key, {})
        removed = 0
        for f in fields:
            if f in bucket:
                del bucket[f]
                removed += 1
        return removed

    def hgetall(self, key: str) -> dict[str, str]:
        return dict(self.hashes.get(key, {}))


# ---------------------------------------------------------------------------
# 夹具:零生产依赖 + 自建引擎(同时钉到 router 面与生产者出口面)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("行为样本回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:非空 jwt_secret ⇒ auth_globally_enforced() 为真,不允许 dev 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


@pytest.fixture(autouse=True)
def _no_llm_no_eventbus(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """LLM 出口回空串、编排事件总线改内存记录器。

    LLM 回空串是**必要的**而非省事:`_extract_patterns` 会先试 LLM、失败/空才走
    降级统计;真调网关既打网络又不可复现。空串这一档恰好让判据落在
    `_extract_patterns_statistical` 上 —— 也就是本票真正接线的降级路径。
    """

    async def _empty_complete(*args: object, **kwargs: object) -> str:
        return ""

    emitted: list[dict[str, Any]] = []

    async def _record_emit(*args: Any, **kwargs: Any) -> None:
        emitted.append(dict(kwargs))

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.complete", _empty_complete)
    monkeypatch.setattr(
        "app.services.orchestration_hub.orchestration_hub.emit", _record_emit
    )
    return emitted


@pytest.fixture
def engine(tmp_path, monkeypatch: pytest.MonkeyPatch) -> RulesEngine:
    """tmp 目录里的自建引擎 + 内存档,并同时钉住两个被审名字。

    为什么要 patch 两处:`record_rule_action_behavior` 在调用时读的是
    `app.services.rules_engine.rules_engine` 这个**模块全局**,而端点读的是
    `app.routers.rules.rules_engine`(import 时的绑定名)。只 patch 一处就会出现
    "端点写进真单例、断言读自建实例"的分裂账,而两边看起来都绿。
    """
    eng = RulesEngine(rules_dir=str(tmp_path / "rules"))
    eng._use_redis = False  # 强制内存档:零 Redis(8811) 触达,且不卡 socket_connect_timeout
    eng._redis = None
    eng._behavior_fallback.clear()
    monkeypatch.setattr(re_module, "rules_engine", eng)
    monkeypatch.setattr(rules_router, "rules_engine", eng)
    return eng


def _rules_app() -> FastAPI:
    """最小装配:真实 rules router + 真实 JWT 中间件,前缀同 main.py。"""
    app = FastAPI()
    app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(rules_router.router, prefix="/api")
    return app


@pytest.fixture
async def client() -> Any:
    transport = ASGITransport(app=_rules_app())
    async with AsyncClient(transport=transport, base_url=API_BASE) as ac:
        yield ac


# ---------------------------------------------------------------------------
# 辅助:走 HTTP 制造 N 条 create 动作(不绕过任何一个被审环节)
# ---------------------------------------------------------------------------


async def _create_rules_via_http(ac: Any, user_id: str, count: int) -> None:
    for i in range(count):
        resp = await ac.post(
            CREATE_PATH,
            headers=_auth(user_id),
            json={"name": f"behavior-rule-{i}", "content": f"禁止示例 {i}"},
        )
        assert resp.status_code == 200, f"建规则被误拒(实得 {resp.status_code})"
        assert resp.json()["code"] == 0


async def _drafts_via_http(ac: Any, user_id: str) -> list[dict[str, Any]]:
    resp = await ac.post(AUTOGEN_PATH, headers=_auth(user_id))
    assert resp.status_code == 200, f"auto-generate 被误拒(实得 {resp.status_code})"
    body = resp.json()
    assert body["code"] == 0, f"auto-generate 返回异常信封:{body}"
    data = body["data"]
    assert isinstance(data, list), f"data 不是列表:{data!r}"
    return data


# ---------------------------------------------------------------------------
# A. 生产者写的键 = 读者读的键
# ---------------------------------------------------------------------------


async def test_producer_and_reader_share_the_memory_namespace(engine: RulesEngine) -> None:
    """内存档:出口写入的样本必须能被同一个 user_id 读回来。

    这条是"接上了"的最小存在性证明 —— 只测 HTTP 全链路的话,键名/字段名写歪
    也可能被两侧同时写歪而互相抵消(本仓记过多次"两处算同一件事必漂移")。
    """
    await record_rule_action_behavior(USER_A, "create", "r-1", {"scope": "global"})

    behaviors = await engine._get_behaviors(USER_A)
    assert len(behaviors) == 1, f"样本没落到读侧:实得 {behaviors!r}"
    entry = behaviors[0]
    assert entry["action"] == "create"
    assert entry["rule_id"] == "r-1"
    assert entry["details"] == {"scope": "global"}
    assert entry["user_id"] == USER_A, "降级面靠这个字段分区,丢了它 E 组用例就是空判据"


async def test_redis_path_uses_the_key_the_reader_reads(engine: RulesEngine) -> None:
    """Redis 档:键名必须逐字等于 `_BEHAVIOR_KEY_PREFIX + user_id`。

    用常量拼而不是硬写字符串 —— 硬写会把"前缀改了两侧一起改错"读成通过。
    """
    fake = _FakeSyncRedis()
    engine._use_redis = True
    engine._redis_inited = True
    engine._redis = fake

    await record_rule_action_behavior(USER_A, "update", "r-2", {"scope": "agent"})

    expected_key = f"{_BEHAVIOR_KEY_PREFIX}{USER_A}"
    assert set(fake.hashes) == {expected_key}, (
        f"生产者写到没人读的键:实得 {sorted(fake.hashes)},期望 [{expected_key}]"
    )
    assert len(await engine._get_behaviors(USER_A)) == 1
    assert await engine._get_behaviors(USER_B) == []


# ---------------------------------------------------------------------------
# B + C + D:全链路正向,与两条必须翻红的对照
# ---------------------------------------------------------------------------


async def test_new_user_gets_nonempty_drafts_after_rule_actions(
    client: AsyncClient, engine: RulesEngine
) -> None:
    """票面的正面结论:这条链不再静态返回空草稿。

    7 条同 (action, scope) 样本 → 降级统计 confidence = 7/10 = 0.7 > 0.6 才出草稿
    (`auto_generate_rules` 的过滤线),所以取 7 而不是 5。
    """
    assert await _drafts_via_http(client, USER_A) == [], "起点必须是零草稿"

    await _create_rules_via_http(client, USER_A, 7)

    samples = await engine._get_behaviors(USER_A)
    assert len(samples) == 7, f"动作没被记成样本:实得 {len(samples)} 条"

    drafts = await _drafts_via_http(client, USER_A)
    assert drafts, "记满样本后仍返回空草稿 —— 接线没生效"
    draft = drafts[0]
    assert set(draft) == {"pattern", "draft_rule", "confidence"}
    assert set(draft["draft_rule"]) == {"name", "description", "content", "scope"}
    assert draft["confidence"] > 0.6, f"草稿没越过过滤线:{draft}"


async def test_drafts_stay_empty_without_any_recorded_action(
    client: AsyncClient, engine: RulesEngine
) -> None:
    """对照①:一条动作都不记 ⇒ 仍 `[]`。

    少了这条,B 的"非空"就可能来自夹具残留或桩返回值,而不是来自那 7 次 create。
    """
    assert len(await engine._get_behaviors(USER_A)) == 0
    assert await _drafts_via_http(client, USER_A) == []


async def test_drafts_empty_when_producer_disconnected(
    client: AsyncClient, engine: RulesEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """对照②:动作照做,但把生产出口摘掉 ⇒ 必回 `[]`。

    这是 B 的变异对照 —— 证明"非空"靠的是 `record_rule_action_behavior` 这一次接线,
    而不是 router 里别的东西顺手写了样本。摘线 = 退回票面描述的旧状态。
    """

    async def _disconnected(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(rules_router, "record_rule_action_behavior", _disconnected)

    await _create_rules_via_http(client, USER_A, 7)

    assert await engine._get_behaviors(USER_A) == []
    assert await _drafts_via_http(client, USER_A) == []


async def test_below_min_samples_yields_no_draft(
    client: AsyncClient, engine: RulesEngine
) -> None:
    """对照③:样本数不足 `_PATTERN_MIN_SAMPLES` ⇒ `[]`(读侧的门在,没被绕过)。

    与 B 成对:B 证明"够格就出",这条证明"不够格就不出" —— 只留前者,
    读侧那道门被误删也测不出来。
    """
    assert _PATTERN_MIN_SAMPLES > 1
    await _create_rules_via_http(client, USER_A, _PATTERN_MIN_SAMPLES - 1)

    assert len(await engine._get_behaviors(USER_A)) == _PATTERN_MIN_SAMPLES - 1
    assert await _drafts_via_http(client, USER_A) == []


# ---------------------------------------------------------------------------
# E. 跨用户隔离(生产者一接,内存降级面就从"理论可达"变成"实际可达")
# ---------------------------------------------------------------------------


async def test_other_user_does_not_inherit_drafts(
    client: AsyncClient, engine: RulesEngine
) -> None:
    """A 的动作样本不得出现在 B 的草稿里(共享降级面的分区判据)。

    立因:`_behavior_fallback` 是**进程级一张列表**,而 `_get_behaviors` 旧写法
    `return list(self._behavior_fallback)` 无视 user_id —— 生产者在时这是死代码,
    本票把它接上之后它就是活的跨用户串味路径,所以必须同笔收口。
    """
    await _create_rules_via_http(client, USER_A, 7)

    assert await engine._get_behaviors(USER_B) == [], "降级面未按主体分区"
    assert await _drafts_via_http(client, USER_B) == []
    # 正向对照:A 自己照旧拿得到(证明隔离不是把两侧一起判空)
    assert len(await engine._get_behaviors(USER_A)) == 7
    assert await _drafts_via_http(client, USER_A) != []


# ---------------------------------------------------------------------------
# F. 身份:只认令牌主体,未验证身份一律不写
# ---------------------------------------------------------------------------


async def test_update_and_delete_are_recorded_with_token_principal(
    client: AsyncClient, engine: RulesEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PATCH/DELETE 两个动作点的入参必须是 (令牌主体, 动作, 规则 id)。

    记录器替换的是**出口函数本身**(router 名字面上的那个绑定),所以这里断言的是
    "router 到底喂了什么",而不是"引擎里最后躺了什么" —— 两者可分别失效。
    """
    seen: list[tuple[Any, str, str]] = []

    async def _spy(user_id: Any, action: str, rule_id: str, *args: Any) -> None:
        seen.append((user_id, action, rule_id))

    monkeypatch.setattr(rules_router, "record_rule_action_behavior", _spy)

    created = await client.post(
        CREATE_PATH,
        headers=_auth(USER_A),
        json={"name": "behavior-rule-x", "content": "c"},
    )
    assert created.status_code == 200
    rule_id = created.json()["data"]["id"]

    patched = await client.patch(
        f"/api/rules/{rule_id}", headers=_auth(USER_A), json={"priority": 70}
    )
    assert patched.status_code == 200
    deleted = await client.delete(f"/api/rules/{rule_id}", headers=_auth(USER_B))
    assert deleted.status_code == 200

    assert seen == [
        (USER_A, "create", rule_id),
        (USER_A, "update", rule_id),
        (USER_B, "delete", rule_id),
    ], f"身份/动作/对象三者有一不吻合:{seen}"


async def test_unverified_identity_records_nothing(engine: RulesEngine) -> None:
    """身份不是已验证字符串 ⇒ 一条都不写(幽灵键会污染进程级共享降级面)。

    三种形态都是"拿不到主体"的现实写法:None(匿名分支)、空串、以及以裸函数方式
    调用端点时 FastAPI 传进来的 `Depends` 占位对象 —— 旧写法会把它们 `str()` 成一个
    没人读的键,同时在共享内存列表里留下一条对所有用户可见的样本。
    """
    for bad in (None, "", object(), DependsMarker(None)):
        await record_rule_action_behavior(bad, "create", "r-ghost", {"scope": "global"})

    assert engine._behavior_fallback == [], (
        f"未验证身份仍落了样本:{engine._behavior_fallback!r}"
    )


def test_action_endpoints_take_identity_from_the_shared_exit() -> None:
    """结构性判据:三个动作点的身份只能来自 `require_request_user_id`。

    防的是"后来者顺手把 principal 改成可选/自报字段"—— 本票把身份引到写面,
    身份来源就必须和读侧(/rules/auto-generate)钉在同一份出口上。
    """
    for fn in (
        rules_router.create_rule,
        rules_router.update_rule,
        rules_router.delete_rule,
    ):
        params = inspect.signature(fn).parameters
        assert "principal" in params, f"{fn.__name__} 丢了端点级身份"
        default = params["principal"].default
        assert isinstance(default, DependsMarker), (
            f"{fn.__name__} 的 principal 不是依赖注入:{default!r}"
        )
        assert default.dependency is jwt_auth.require_request_user_id, (
            f"{fn.__name__} 用了第二份身份判定:{default.dependency}"
        )


# ---------------------------------------------------------------------------
# G. 埋点契约:失败不得外溢到用户的写操作
# ---------------------------------------------------------------------------


async def test_tracking_failure_does_not_fail_user_write(
    client: AsyncClient, engine: RulesEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """样本落不下(例如引擎内部炸)时,建规则仍必须 200 —— best-effort 是契约。

    反过来不成立:这条不是"可以静默失败"的许可证,`record_rule_action_behavior`
    自身会把异常记 debug 日志,而 B/E 两组用例负责证明"正常路径真的落了样本"。
    """

    async def _boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("redis exploded")

    monkeypatch.setattr(engine, "_track_behavior", _boom)

    resp = await client.post(
        CREATE_PATH,
        headers=_auth(USER_A),
        json={"name": "behavior-rule-boom", "content": "c"},
    )
    assert resp.status_code == 200, f"埋点把用户写操作带崩了:{resp.status_code}"
    assert resp.json()["code"] == 0
    assert len(engine.list_rules()) == 1, "规则本体也没写成 —— 那不是埋点该背的锅"
    assert await engine._get_behaviors(USER_A) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
