# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""上下文压缩按用户百分比灰度(P1 1-3,2026-09-08 立)。

现状痛点:压缩只有 env 级全局开关(AGENT_COMPACTION_ENABLED /
req.context_limit),一旦打开即全量生效,无法渐进放量观察真实任务成功率
与回捞命中率(H7 验收项)。本模块提供确定性按用户灰度:

- env `CONTEXT_COMPACTION_ROLLOUT_PERCENT`(0-100,默认 100 = 全量,
  与现状逐零差异,可一键回滚到 100 或 0)。
- `is_user_rollout_enabled(user_id)`:md5 稳定哈希把用户分到 [0,100)
  桶,桶 < 百分比即命中。同一 user_id 跨进程/重启结果稳定(不依赖
  PYTHONHASH_SEED),不同 user_id 均匀散列。
- user_id 缺失(匿名/内部调用)时保守策略:仅 100% 全量时命中,
  部分灰度期间匿名流量不压缩(宁可多耗 token 不引入未观察行为)。

接线点:routers/llm.py(/llm/complete 与 /llm/complete/stream 的
context_limit 压缩分支)、agent_loop_v2._maybe_compact_context。
本模块零第三方依赖,不触碰压缩行为本身。
"""

from __future__ import annotations

import hashlib
import os

_ENV_NAME = "CONTEXT_COMPACTION_ROLLOUT_PERCENT"
_DEFAULT_PERCENT = 100


def rollout_percent() -> int:
    """读取灰度百分比(env CONTEXT_COMPACTION_ROLLOUT_PERCENT,0-100,默认 100)。"""
    raw = os.environ.get(_ENV_NAME, str(_DEFAULT_PERCENT))
    try:
        return max(0, min(100, int(float(raw))))
    except ValueError:
        return _DEFAULT_PERCENT


def user_rollout_bucket(user_id: str) -> int:
    """把 user_id 稳定映射到 [0,100) 桶。

    md5 前 8 位十六进制(确定性,不依赖 PYTHONHASH_SEED)。
    """
    digest = hashlib.md5(user_id.encode("utf-8", errors="replace")).hexdigest()
    return int(digest[:8], 16) % 100


def is_user_rollout_enabled(user_id: str | None, *, percent: int | None = None) -> bool:
    """判断该用户是否命中压缩灰度。

    - percent 显式传入时优先(测试用);否则读 env。
    - user_id 为空:仅 percent >= 100(全量)时命中(部分灰度期间匿名不压缩)。
    """
    p = rollout_percent() if percent is None else max(0, min(100, int(percent)))
    if p >= 100:
        return True
    if p <= 0:
        return False
    if not user_id:
        return False
    return user_rollout_bucket(user_id) < p


__all__ = ["rollout_percent", "user_rollout_bucket", "is_user_rollout_enabled"]
