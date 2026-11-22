# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""「不自动写入长期记忆」用户选择的读取闸(2026-10-03 数据出域合规整改立)。

这个开关之前**只有 UI 没接线**,而接线时发现的现状比"没接线"更糟
--------------------------------------------------------------------
`apps/web/app/(main)/settings/privacy/page.tsx` 写的是键 ``autoMemoryOptOut``,
语义是 **opt-out**(:49 默认 `false`,:71 读 `=== 'true'`,即 `true` = 用户已关闭)。
而后端 `memory_service._is_auto_memory_enabled` 读的是**另一个键** ``autoMemory``,
语义是 **opt-in**(:1149 `key = 'autoMemory'`,:1153 `!= "false"` 才算开启,
:1154 无记录即 True)。后者由 `apps/web/app/(main)/memory/page.tsx` 写。

两个键**极性相反、键名不同**,于是:用户在隐私页把"不自动写入长期记忆"打开
⇒ 只写进 ``autoMemoryOptOut='true'`` ⇒ 后端查 ``autoMemory`` 查不到 ⇒ 返回默认
True ⇒ **记忆照常提炼、照常落库、LLM 照常调用**。这正是任务书里点名的
"假开关(比没有更糟)"。本模块把两侧口径接成一份。

三态判定链(唯一实现,`resolve()`)
--------------------------------
| 优先级 | 证据                                    | 判定    |
|--------|-----------------------------------------|---------|
| 1      | ``autoMemoryOptOut='true'``(新键,隐私页) | 关闭     |
| 2      | ``autoMemoryOptOut='false'``             | 开启     |
| 3      | ``autoMemory`` 有记录(旧键,记忆页)      | 按其值   |
| 4      | 全局默认 ``IHUI_AUTO_MEMORY``            | 按其值   |
| 5      | 读库失败 / userId 为空 / 键全缺          | **开启** |

**新键优先于旧键**:隐私页是 2026-10-03 整改新增的合规面,记忆页是更早的
功能面;两者都表态时以新键为准,否则用户在隐私页重新打开后会被旧键的
`'false'` 悄悄压回去(用户明明在新界面做了决定)。旧键仍然被读,是为了
**不让已用记忆页关过记忆的用户被这次上线反向恢复**。

**per-user 压过全局**(与本仓 `raw-retention-optout` / `code_index_consent` 同一
纪律):第 1-3 步命中即返回,根本不看第 4 步的 env。

为什么读库失败降级为"开启"(与本仓其它 fail-closed 闸门方向相反)
--------------------------------------------------------------
这里刻意**不**倒向"关闭",理由与 `apps/api/src/services/raw-retention-optout.ts`
文件头同源,在此复述以免下一个来"统一口径"的人把它改反:
1. "开启"就是**改动前的行为**。合规整改的第一条纪律是"开关上线不能让任何人
   的行为突然改变";读库抖动导致某个用户的记忆提取忽然停摆,本身就是一次
   用户可感知的行为跳变,而跳变比"多提炼了几条"更难解释。
2. 提取是**写入侧**动作,写错的代价是"多存了几条本该不存的记忆",而这批数据
   另有保留期兜底(`agent_longterm_memory._RETENTION_DAYS` 默认 180 天)且用户
   可在记忆页自行删除;反过来把提取整体停掉会让"记忆功能看起来坏了"。
3. 真正需要 fail-closed 的是**出域**(代码/原文外发),那类闸门本仓一律倒向
   "不出域"(`code_index_consent`)。本开关是"留存"而非"出域",方向本就不同。

**读不到 userId 的路径一律走第 5 步(按默认开启)**,不猜、不阻断。逐条路径的
userId 可得性见 `memory_service.py` / `memory.py` / `routers/agent_memory.py`
中各闸门处的注释(那里写清了"拿不到"的具体来源),测试见
`tests/test_auto_memory_optout.py::TestUserIdUnavailable`。

为什么不做内存缓存(与 `raw-retention-optout.ts` 的形态有意不同)
-------------------------------------------------------------
`raw-retention-optout.ts` 用"内存缓存 + 启动预热",因为**写入口与读入口在同一个
进程**(apps/api 的设置路由写库后立刻调 `setRawRetentionOptOut` 更新内存),进程
内不会读到脏值。ai-service 不是那个进程:**唯一的写入口在 apps/api**
(前端 PUT `/settings/privacy` → 通用 upsert,`settings-routes.ts:76-98`),
ai-service 只能读。若照搬预热式缓存,用户在浏览器里点完开关,ai-service 进程
**永远看不到**——那不是缓存,是把假开关固化并提速。故本模块直读库、不缓存。

直读的代价可控:调用点是**每轮对话一次**(consolidate / save_insights /
add_with_extraction / 抽候选),不是每 token 一次,单次是一次按
(user_id, group, key) 索引的单行查询,不在任何热路径上。
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# 隐私设置分组(该列在表里叫 `group`,不是 `category` —— 与
# apps/api/src/services/raw-retention-optout.ts 的 GROUP_PRIVACY 同值)。
GROUP_PRIVACY = "privacy"

#: 新键:隐私页"不自动写入长期记忆"开关,**opt-out** 语义('true' = 已关闭)。
KEY_AUTO_MEMORY_OPT_OUT = "autoMemoryOptOut"

#: 旧键:记忆页"自动记忆"开关,**opt-in** 语义('false' = 已关闭)。
#: 保留读取是为了不把已关过记忆的用户反向恢复(见模块 docstring)。
KEY_AUTO_MEMORY_LEGACY = "autoMemory"

#: 部署方全局默认。默认**开启**(= 改动前行为)。仅字面量 "0" / "false" / "off"
#: 视为关闭(与本仓其它 env 开关同一口径:只有明确的否定字面量才生效)。
ENV_GLOBAL_DEFAULT = "IHUI_AUTO_MEMORY"

#: 判定链第 5 步的兜底:开启(= 现状行为)。
DEFAULT_ENABLED = True

#: 关闭的字面量集合(opt-out 键视角:命中即"用户已关闭")。
_FALSEY = frozenset({"true"})


def _env_global_default() -> bool:
    """读部署方全局默认。只有明确的否定字面量才关闭,其余(含未设置)为开启。"""
    return os.environ.get(ENV_GLOBAL_DEFAULT, "").strip().lower() not in {
        "0",
        "false",
        "off",
    }


def _row_value(row: Any) -> str | None:
    """从 asyncpg.Record / 映射里取 ``value`` 列,取不到或为 NULL 返回 None。"""
    if row is None:
        return None
    try:
        value = row["value"]
    except (KeyError, IndexError, TypeError):
        return None
    if value is None:
        return None
    return str(value)


def resolve(
    *,
    opt_out_value: str | None,
    legacy_value: str | None,
    global_default: bool | None = None,
) -> tuple[bool, str]:
    """三态判定链的**纯函数**部分(无 IO,可独立测)。

    Args:
        opt_out_value: ``autoMemoryOptOut`` 的原始值;None = 该键无记录。
        legacy_value:  ``autoMemory`` 的原始值;None = 该键无记录。
        global_default: 覆盖全局默认(仅测试用;生产传 None 走 env)。

    Returns:
        ``(是否允许自动记忆提取, 判定依据标签)``。标签会进日志,便于事后
        回答"这条记忆为什么被/没被提炼"。
    """
    if opt_out_value is not None:
        # 新键优先:隐私页的表态就是最终表态,不受旧键与全局默认影响。
        if opt_out_value.strip().lower() in _FALSEY:
            return False, "opt_out_key"
        return True, "opt_out_key"

    if legacy_value is not None:
        # 旧键(opt-in 语义):'false' = 关闭,其余 = 开启。
        if legacy_value.strip().lower() == "false":
            return False, "legacy_key"
        return True, "legacy_key"

    gdef = _env_global_default() if global_default is None else bool(global_default)
    return gdef, "global_default"


async def _fetch_prefs(user_id: str) -> tuple[str | None, str | None]:
    """读两个键的原始值,返回 ``(opt_out_value, legacy_value)``;任一缺失为 None。

    两次 ``fetchrow`` 而非一次 ``fetch``:与本仓既有实现
    (``memory_service._is_auto_memory_enabled`` 原写法)保持同款调用形态,
    少一处 mock 形状差异。查询走共享 asyncpg pool(与 memory_service 同一份),
    不新增连接、不新增依赖。
    """
    # 延迟导入:避免与 memory_service 的模块级 import 形成环
    # (memory_service 会 import 本模块)。
    from .memory_service import _get_pool

    pool = await _get_pool()
    async with pool.acquire() as conn:
        opt_out_row = await conn.fetchrow(
            """SELECT value FROM user_preferences
               WHERE user_id = $1::uuid AND "group" = $2 AND key = $3""",
            user_id,
            GROUP_PRIVACY,
            KEY_AUTO_MEMORY_OPT_OUT,
        )
        legacy_row = await conn.fetchrow(
            """SELECT value FROM user_preferences
               WHERE user_id = $1::uuid AND "group" = $2 AND key = $3""",
            user_id,
            GROUP_PRIVACY,
            KEY_AUTO_MEMORY_LEGACY,
        )
    return _row_value(opt_out_row), _row_value(legacy_row)


async def is_auto_memory_enabled(user_id: str | None) -> bool:
    """该用户是否允许自动提炼长期记忆。

    判定链见模块 docstring。要点:
    * **默认 True**(= 改动前行为),开关上线不改变任何人的现状。
    * per-user 显式表态压过全局 ``IHUI_AUTO_MEMORY``。
    * ``user_id`` 为空 / 非 UUID / 读库失败 ⇒ 一律 True(降级不阻断),并在
      warning 里带出原因 —— 这些是"需要人知道"的异常态,静默吞掉会让
      "用户的开关没生效"变成一件查不出来的事。
    """
    if not user_id or not str(user_id).strip():
        # 拿不到属主 ⇒ 无从查他的偏好 ⇒ 按现状行为(开启)放行。
        # 逐条路径为何拿不到,见各调用点注释;此处不猜、不阻断。
        return DEFAULT_ENABLED

    uid = str(user_id).strip()
    try:
        opt_out_value, legacy_value = await _fetch_prefs(uid)
    except Exception as exc:
        logger.warning(
            "[auto-memory-optout] 读取用户偏好失败,按默认开启处理"
            "(user=%s, 降级方向的理由见模块 docstring): %s",
            uid,
            exc,
        )
        return DEFAULT_ENABLED

    enabled, reason = resolve(opt_out_value=opt_out_value, legacy_value=legacy_value)
    if reason != "global_default":
        logger.info(
            "[auto-memory-optout] user=%s 自动长期记忆=%s(依据=%s)", uid, enabled, reason
        )
    return enabled
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
