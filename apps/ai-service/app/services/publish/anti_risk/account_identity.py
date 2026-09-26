# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""反风控账号身份键的**唯一出口**。

为什么要有这个模块:身份键决定三件事 —— 浏览器持久化画像目录名、由它派生的
UA/视口/地理位置/Canvas 种子、以及 device_graph 里的绑定归属。同一账号必须**永远**
拿到同一个键。旧实现(散在 7 个适配器 + 2 个服务里各自手搓)是
`md5(第一个非空凭证值)`,而凭证值正是"刷新 token/续期 cookie"时**会变的那一列**
⇒ 一刷新就换一张脸、新开一个画像目录,旧脸仍留在图谱里与新生共用同一个出口 IP
⇒ 联动判定 100/100 ⇒ 自动冷却 1h。用户报的"刷新没几次就风控我"就是这个机制。

优先级(从高到低,只用**与凭证内容无关**或**本身不轮换**的量):
1. ``db_account_id`` —— publish_accounts 行 id,由调度器/验证入口显式传入,唯一稳定锚点
2. 凭证里**不轮换的身份字段**(UserName / uid_tt / wxuin / webId / app_id / open_id / user_id)
3. 兜底:首个非空凭证值的哈希 —— **必须大声告警**,因为这一档就是换脸的老路;
   走到这里说明调用方没传行 id,属接线缺失,不是正常形态。
"""

from __future__ import annotations

import hashlib
from collections.abc import Mapping
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

#: 凭证里可以当稳定身份用的字段(顺序即优先级)。刻意排除 session/token/cookie 这类轮换值。
STABLE_IDENTITY_FIELDS: tuple[str, ...] = (
    "account_id",
    "UserName",
    "uid_tt",
    "wxuin",
    "webId",
    "app_id",
    "open_id",
    "user_id",
)


def _short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]  # noqa: S324 - 身份标签,非安全用途


def resolve_account_id(
    platform: str,
    credentials: Mapping[str, Any],
    db_account_id: int | str | None = None,
) -> str:
    """返回该账号跨会话**恒定**的反风控身份键。

    Args:
        platform: 平台 id(如 ``zhihu``)
        credentials: 解密后的凭证字典
        db_account_id: publish_accounts 行 id;由调度器/验证入口传入时优先采用

    键形态按档位区分,便于从图谱/目录名直接看出身份来源:
    ``<platform>_db<行id>`` / ``<platform>_<字段名>-<12位哈希>`` / ``<platform>_legacy-<8位哈希>``。
    """
    if db_account_id is not None and str(db_account_id).strip():
        return f"{platform}_db{str(db_account_id).strip()}"

    for field in STABLE_IDENTITY_FIELDS:
        raw = credentials.get(field)
        if isinstance(raw, str) and raw.strip():
            return f"{platform}_{field}-{_short_hash(raw.strip())}"
        if isinstance(raw, (int, float)) and str(raw).strip():
            return f"{platform}_{field}-{_short_hash(str(raw))}"

    first = next((v for v in credentials.values() if v), "default")
    key = f"{platform}_legacy-{hashlib.md5(str(first).encode()).hexdigest()[:8]}"  # noqa: S324
    logger.warning(
        "[account_identity] 平台 %s 未传 db_account_id 且凭证里没有不轮换身份字段,"
        "落到「首个凭证值哈希」兜底档(%s)—— 该档会随 token 刷新换脸,"
        "调用方应显式传入 publish_accounts 行 id",
        platform,
        key,
    )
    return key


__all__ = ["STABLE_IDENTITY_FIELDS", "resolve_account_id"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
