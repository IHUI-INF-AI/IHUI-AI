# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2026-11-01 安全强化:`/api/context` 进"永不公开"地板,并证明这条禁令**射程里有真端点**。

判两件事,各配反证:

1) **地板在位**。`app/core/jwt_auth.py` 的 `_NEVER_PUBLIC_ROOTS` 必须含 `/api/context`。
   立因是现读的:那张 router(`app/services/context_engine.py` 里的 `router = APIRouter()`,
   挂于 `main.py` 的 `include_router(context_engine_router, prefix="/api/context")`)**7 个端点
   无一处带端点级身份依赖**,身份全靠调用方自报 `userId`;`GET/DELETE /memory`、`GET /visualization`
   连自报值都不看,缓存键只按 `conversationId` 派生。部署 .env 的 `JWT_PUBLIC_PATHS` 是**整串替换**
   而非增量 —— 一份陈旧配置就能把这族面静默重开成匿名可读(2026-10-29 的 trigger-refresh /
   scheduler-status 与 /api/agents 是同一形态)。
2) **不是空禁令**。同一轮把"这条前缀确实罩住了那些端点"钉住:逐条取真 router 的 path 与
   main 里的挂载前缀合成,断言合成后的完整路径都被判据收下。只写名单不验射程 = 假绿。

**本票刻意没有做的**(写清楚,免得下一个人以为已收口):没有给这些端点加 `Depends` 身份、
没有把主体并进缓存键。原因是现读的:api→ai-service 这一腿 8 处调用**全部传 `request=null`**,
`aiServiceFetch` 因此送的是系统票(`getSystemAccessToken()`),在 ai-service 侧收主体只会把所有人
归一到同一个 system 主体 —— 比现在更糟。真要收口得先改出站形态,那是一整票(含"会话归属判据
不复制第二份"的约束:`apps/api/src/db/chat-conversation-access.ts` 是唯一出口)。

测试隔离(AGENTS §5):不建连接、不起服务;只 import 判据与 router 对象。
"""

from __future__ import annotations

import pytest

from app.core import jwt_auth

# main.py 里 context router 的挂载前缀(现读 `include_router(context_engine_router, prefix=...)`)
CONTEXT_PREFIX = "/api/context"


class TestContextNeverPublicFloor:
    def test_context_root_is_never_public(self) -> None:
        assert "/api/context" in jwt_auth._NEVER_PUBLIC_ROOTS

    @pytest.mark.parametrize(
        "entry",
        [
            "/api/context",
            "/api/context/",
            "/api/context/memory",
            "/api/context/visualization",
            "/api/context/enrich",
            "/api/context/sources",
        ],
    )
    def test_config_cannot_reopen_it(self, entry: str) -> None:
        """真配置形态喂进解析口:写了 ⇒ 剔除(不是"写了就放行")。"""
        assert jwt_auth._is_never_public(entry) is True

    def test_mutation_proof_other_roots_still_pass_through(self) -> None:
        """同一把尺子对非禁令条目必须保持"不收":否则这条判据只是"什么都拒绝"的假绿。"""
        assert jwt_auth._is_never_public("/api/health") is False
        assert jwt_auth._is_never_public("/api/memory") is False


class TestFloorCoversRealEndpoints:
    """禁令必须罩在真存在的端点上 —— 名单对着空气写就是第二份假绿。"""

    def _full_paths(self) -> list[str]:
        from app.services.context_engine import router as context_router

        out: list[str] = []
        for route in context_router.routes:
            path = getattr(route, "path", "")
            if not path:
                continue
            out.append(f"{CONTEXT_PREFIX}{path}")
        return out

    def test_router_actually_has_endpoints(self) -> None:
        paths = self._full_paths()
        assert len(paths) >= 7, f"context router 现读端点数异常({len(paths)})⇒ 本尺的射程判不出"

    def test_every_mounted_endpoint_is_covered(self) -> None:
        uncovered = [p for p in self._full_paths() if jwt_auth._is_never_public(p) is not True]
        assert not uncovered, f"以下端点落在禁令射程外 ⇒ 一条陈旧 .env 就能匿名重开:{uncovered}"

    def test_mount_prefix_matches_main(self) -> None:
        """挂载前缀不许漂:漂了以后这条地板罩的就是另一条路。

        用源码文本而不是 import app.main —— 后者会在收集期真去建应用(连 DB/Redis),
        违反测试隔离(AGENTS §5)。
        """
        from pathlib import Path

        main_src = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(
            encoding="utf-8"
        )
        assert f'prefix="{CONTEXT_PREFIX}"' in main_src, (
            f"main.py 里找不到 `prefix=\"{CONTEXT_PREFIX}\"` ⇒ 挂载前缀已漂或本面已撤装,"
            "本票的地板就成了对着空气写的禁令"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
