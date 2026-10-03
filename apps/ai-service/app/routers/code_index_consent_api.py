# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代码索引出域同意的**跨进程同步端点**(2026-10-03 数据出域合规整改)。

为什么需要这个端点(以及它为什么长这样)
----------------------------------------
`code_index_consent` 的同意表存在**本进程**的 `.data/code_index_consent.json`。
用户改开关的动作发生在 **apps/api**(`PUT /settings/privacy` 写 `user_preferences`),
而读同意闸的 `_code_index_egress_allowed` 在 **apps/ai-service** —— 两个独立进程、
两份内存、两份持久化。api 把键写进数据库,并不会让 ai-service 看到。

于是本次整改面对的是一个**跨进程可见性**问题,而不是"再加一个 if"。可选形态:

  A. ai-service 每次判定时**直读** `user_preferences`(asyncpg)。
     代价不只是"多一次 IO":判定函数 `_code_index_egress_allowed` 是**同步**的
     (它被 `mcp_server` 的两处闸门直接调用),要直读就得把它改成 async ——
     而 `mcp_server.py` 本次**不可改**(一万行模块,有他人在途改动)。
     且 `code_index_consent` 刻意做成"同步、纯本地、可在热路径上无阻塞调用"
     (见其文件头"对外接口");直读 asyncpg 会把这个性质整个推翻,并给一个
     刻意零新依赖的模块引入 DB 依赖方向。
     ⇒ 形态 A 与本模块既有设计直接冲突。
  B. **api 写完库后推一把**给 ai-service(本端点),ai-service 更新自己的同意表。
     形态 B 是本仓**既有的跨进程范式**:`codebase_indexer` 写库、
     `im_bridge`/`api_tools_bridge` 调 api,全都走这条内部服务通道
     (见 `docs/SECURITY.md`)。本端点复用同一条通道。
  C. 共享存储(Redis/DB)当闸门状态源。
     与 A 同样破坏"同步纯本地",还要给这个闸新增一个强依赖。

⇒ 选 B。

鉴权:为什么是"用户 JWT",而不是共享密钥
----------------------------------------
**这一条是实现时实测出来的,故留档**:本端点第一版按"内部服务共享密钥
(`AI_CALLBACK_SECRET` + `X-Internal-Secret`)"写 —— 与 `apps/api/src/routes/ai-callback.ts`
的入站回调同一形态。起真实 app 用 TestClient 打过来,结果是:

    POST /api/code-index-consent/sync  →  401 {"message": "Authentication required"}

原因:`app/core/jwt_auth.py` 的 `JWTAuthMiddleware` 是 **BaseHTTPMiddleware**,在
**路由处理函数之前**执行,没有 `Authorization: Bearer` 就直接 401 —— 共享密钥那套
压根没机会跑到。要让它过去必须把本路径挂进 `PUBLIC_PATHS`(`JWT_PUBLIC_PATHS`
配置),那是全局鉴权白名单,而白名单是**匿名**的:把一个"能写同意状态"的端点
放进去,等于允许任何人给任意用户写"已授权出域"。这是明显更差的安全形态,
不为省一次 JWT 验证而换。

⇒ 改为**端点级用户身份**:`Depends(require_request_user_id)`,即本仓 MCP 工具
(`routers/mcp.py`)、记忆族端点(`app/api/memory.py`)统一在用的那个依赖。
它比共享密钥**更强**,不是更弱:

  * 身份来自**已验签的用户 JWT**,`user_id` 由中间件注入 `request.state`;端点
    **不接受**调用方在 body 里自称是谁 —— `ConsentSyncRequest` 里刻意没有
    `user_id` 字段。共享密钥方案里,任何持有密钥的进程都能给任意 user_id 写
    "已授权代码出域";这里做不到。
  * 用户只能改**自己**的同意状态。
  * 不动全局鉴权配置、不新增密钥、不新增鉴权契约。

代价:api 侧必须带**该用户自己的 JWT** 来调(系统 token 的 sub 是 `system-worker`,
身份对不上)。这正是 `apps/api/src/utils/ai-service-fetch.ts` 的
`aiServiceFetch(request, ...)` 在做的事(透传 `request.headers.authorization`),
故调用侧直接复用它,不自己拼头。

启动自愈:不走本端点
--------------------
"ai-service 容器重建 ⇒ `.data` 丢失 ⇒ 已 opt-out 的用户被静默重置"这个洞由
**ai-service 自己的 lifespan** 补:直读 `user_preferences` 把已 opt-out 的用户
重新登记(见 `code_index_consent.preload_opt_outs_from_db`,与
`auto_memory_optout._fetch_prefs` 同一形态)。不走本端点 —— 启动期没有
"某个用户"的 JWT 可用,而且让 ai-service 主动读库比让 api 猜"该重推给谁"可靠。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.jwt_auth import require_request_user_id
from app.services import code_index_consent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/code-index-consent", tags=["code-index-consent"])


class ConsentSyncRequest(BaseModel):
    """一次同意状态同步请求。"""

    #: 隐私页那个键的值(**opt-out** 语义:True = 用户要求阻止代码出域)。
    #:
    #: 这里**刻意没有** `user_id` 字段:身份一律从 JWT 拿(见文件头"鉴权")。
    #: 若 body 里能自称 user_id,又回到"任何调用方能替别人授权"的老形态。
    opted_out: bool = Field(..., description="用户是否选择阻止代码语义索引外发")
    #: 表态来源标识,进同意表供事后审计(与 `grant`/`revoke` 的 source 同一用途)。
    source: str = Field("user_settings", max_length=64, description="表态来源标识(审计用)")


@router.post("/sync")
async def sync_own_consent(
    payload: ConsentSyncRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """把**调用者自己**的 `codeIndexEgressOptOut` 开关同步进本进程的同意表。

    幂等:同一份设置重复推送结果相同(设置页是"读-改-写",重放很常见)。

    极性由 `code_index_consent.apply_user_opt_out` 单点收口:`opted_out=True`
    ⇒ 显式拒绝(压过全局开启);`opted_out=False` ⇒ **清除表态**回到未表态,
    **绝不是** `grant()`。本端点不做任何极性推导,避免两处各推导一次。
    """
    code_index_consent.apply_user_opt_out(
        user_id,
        payload.opted_out,
        source=payload.source or "user_settings",
    )
    state = code_index_consent.get_state(user_id)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "opted_out": payload.opted_out,
            # 回带判定结果,让 api 侧日志能直接落"闸门现在怎么看",而不必再猜一次。
            "has_consent": code_index_consent.has_consent(user_id),
            "granted": state.granted,
        },
    }


@router.get("/state")
async def read_own_consent_state(
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """只读:查**调用者自己**当前在本进程里的同意状态(排障/自愈核对用)。

    它能区分"未表态"与"显式拒绝",这是同意表里最敏感的一格 —— 故只允许问自己
    (同一把 `require_request_user_id`,不给"查别人"的口子)。
    """
    state = code_index_consent.get_state(user_id)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "granted": state.granted,
            "decided_at": state.decided_at,
            "source": state.source,
            "global_default": state.global_default,
            "has_consent": code_index_consent.has_consent(user_id),
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
