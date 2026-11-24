# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2026-11-01 安全强化:/api/rules 那张 router 的五格裸端点补身份依赖 + 公开名单地板。

判两件事,各配反证:

1) **端点级身份**。`resolve-conflicts`(LLM 仲裁)、`{id}/test`、`{id}/predict-effect`(LLM 预测)、
   `{id}/learn-feedback`(写反馈)、`match`(规则应用)这五格此前不带任何 Depends —— 同文件另外
   四格(create/update/delete/auto-generate)却是有票的。缺身份的后果不是"读不到数据"那么轻:
   前四格会消耗模型额度、第五格写规则面,而"谁干的"没有主。这里用结构断言把"依赖装在路由对象上"
   钉住 —— 结构比响应码更难伪装:摘掉 Depends,`dependant.dependencies` 立刻少一枚。
2) **公开名单地板**。`_NEVER_PUBLIC_ROOTS` 里加 `/api/rules`:部署 .env 的 `JWT_PUBLIC_PATHS` 是
   **整串替换**而非增量,一份陈旧配置就能把这张无端点级鉴权(修前)的 router 静默重开成匿名面
   —— 2026-10-29 那两条 admin 端点已经踩过同一条路。反证档用真配置形态喂进解析口,证明
   "写了也剔除"而不是"写了就放行"。

测试隔离(AGENTS §5):`asyncpg.create_pool` 打成抛错,零生产 PG(8810)/Redis(8811) 触达。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.routing import APIRoute

from app.core import jwt_auth
from app.core.config import settings
from app.core.jwt_auth import require_request_user_id
from app.routers import rules as rules_router

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-rules-identity-only"

#: 本票补上身份依赖的五格(路径按 router 自身写法,不含 /api 前缀)
GUARDED = [
    ("/rules/resolve-conflicts", "POST"),
    ("/rules/{rule_id}/test", "POST"),
    ("/rules/{rule_id}/predict-effect", "POST"),
    ("/rules/{rule_id}/learn-feedback", "POST"),
    ("/rules/match", "POST"),
]


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("身份依赖回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


def _route(path: str, method: str) -> APIRoute:
    for r in rules_router.router.routes:
        if isinstance(r, APIRoute) and r.path == path and method in r.methods:
            return r
    raise AssertionError(f"路由不在面上:{method} {path}(改名/挪层=本票射程失效,判死而不是判绿)")


def _dependency_calls(route: APIRoute) -> list[Any]:
    out: list[Any] = []

    def walk(dep: Any) -> None:
        out.append(dep.call)
        for sub in getattr(dep, "dependencies", []):
            walk(sub)

    for d in route.dependant.dependencies:
        walk(d)
    return out


class TestEndpointIdentity:
    @pytest.mark.parametrize("path,method", GUARDED)
    def test_identity_dependency_is_wired(self, path: str, method: str) -> None:
        route = _route(path, method)
        assert require_request_user_id in _dependency_calls(route), (
            f"{method} {path} 没有端点级身份依赖 —— 会消耗模型额度/写规则面却无主可循"
        )

    def test_positive_control_already_guarded_route_still_guarded(self) -> None:
        """正向对照:本票之前就带票的那格必须仍带 —— 防止"结构断言全体为假却全绿"。"""
        route = _route("/rules/auto-generate", "POST")
        assert require_request_user_id in _dependency_calls(route)

    def test_reverse_control_unrelated_route_is_not_the_probe(self) -> None:
        """反例档:这张 router 里确实存在过"没有依赖"的形状,判据必须能分辨出差别。"""
        guarded = {p for p, _ in GUARDED}
        unguarded_before = "/rules/{rule_id}"  # DELETE 早就带票,不该被本票的清单覆盖
        assert unguarded_before not in guarded
        route = _route(unguarded_before, "DELETE")
        assert require_request_user_id in _dependency_calls(route)


class TestNeverPublicFloor:
    def test_rules_root_is_never_public(self) -> None:
        assert "/api/rules" in jwt_auth._NEVER_PUBLIC_ROOTS

    @pytest.mark.parametrize(
        "entry",
        ["/api/rules", "/api/rules/", "/api/rules/match"],
    )
    def test_config_cannot_reopen_it(self, entry: str) -> None:
        """真配置形态喂进解析口:写了 ⇒ 剔除(不是"写了就放行")。"""
        assert jwt_auth._is_never_public(entry) is True

    def test_mutation_proof_other_roots_still_pass_through(self) -> None:
        """同一把尺子对非禁令条目必须保持"不收":否则这条判据只是"什么都拒绝"的假绿。"""
        assert jwt_auth._is_never_public("/api/health") is False
        assert jwt_auth._is_never_public("/api/memory") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
