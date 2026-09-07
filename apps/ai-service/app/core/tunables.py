# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""杀手锏常量单一真源(跨端唯一真源)。

**跨端唯一真源 / 跨端唯一真源**:以下常量为 web / cli / miniapp 与 Python(ai-service) 之间
必须逐值一致的杀手锏级参数。TS 侧只读镜像位于 packages/shared/src/constants.ts —— 凡改动
本文件任一常量,必须同步更新对应 TS 镜像,否则 tests/test_killer_parity.py 会以
"漂移即失败"的方式拦截。

本模块零第三方依赖(仅标准库),避免引入任何 import 环。各 service 通过
`from app.core.tunables import ...` 引用,行为等价、语义/默认值与原散点定义完全一致。
"""

from __future__ import annotations

import os

# ==================== 杀手锏常量段 1:快照/步骤基础设施 ====================
# 原散点:agent_step_recorder.py / agent_checkpoint.py / file_editor.py
MAX_STEPS_PER_RUN = 2000  # 单 run 保留步数上限(超出丢最旧,防超长运行撑爆文件)
DEFAULT_CHECKPOINT_TTL = 24 * 60 * 60  # agent loop checkpoint 默认 TTL(24 小时 = 86400s)
FILE_VERSION_REDIS_TTL = 24 * 60 * 60  # 文件版本 Redis 持久化 TTL(与 checkpoint 对齐,24 小时)

# ==================== 杀手锏常量段 2:上下文压缩阈值 / 保留策略 ====================
# 原散点:app/core/context_compaction.py(与 @ihui/context-compaction / cli 端一致)
DEFAULT_TRIGGER_RATIO = 0.88  # 触发压缩的占用率(跨端统一 0.88 = 88%)
DEFAULT_TARGET_RATIO = 0.6  # 压缩后的目标占用率(压缩到 60% 留出空间继续对话)
DEFAULT_KEEP_RECENT = 6  # 尾部保留的 non-system 消息数
DEFAULT_MIN_MESSAGES = 2  # 与 TS 共享包一致(2026-08-16 起):仅 system+1 条即可压缩

# ==================== 杀手锏常量段 3:MCP 协议版本协商 ====================
# 原散点:mcp_client.py(初始化握手 params.protocolVersion 只携带单值,先发旧兼容版)
DEFAULT_PROTOCOL_VERSION = "2025-03-26"
SUPPORTED_PROTOCOL_VERSIONS: tuple[str, ...] = (
    "2024-11-05",
    "2025-03-26",
    "2025-06-18",
    "2025-11-25",
)

# ==================== 杀手锏常量段 4:压缩质量自证(灰度 / 产品化开关) ====================
# 把 compaction_quality.py 的"保留率评估 + 自动降级 + EMA 灰发布 gate"接入真实压缩
# 提交通道时的全局开关。关闭时压缩生产路径行为与现在完全一致(不评估、不附加 quality
# 字段、不降级),保证灰度可控、可一键回滚。
AGENT_COMPACTION_QUALITY_ENABLED = os.environ.get(
    "AGENT_COMPACTION_QUALITY_ENABLED", "true"
).strip().lower() in ("1", "true", "yes", "on")
# 保留率低于该阈值触发 auto_degrade(与 compaction_quality.DEFAULT_RETENTION_THRESHOLD
# 对齐;此处集中为跨端唯一真源,改动需同步 web / cli 镜像)。
# P3-11 同构:DEFAULT 标量供 tests/test_killer_parity.py 与 TS 镜像做"漂移即失败"断言
# (env 解析值随环境变化不可作 parity 断言基线,故显式沉淀默认值常量)。
AGENT_COMPACTION_QUALITY_THRESHOLD_DEFAULT = 0.5
AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS_DEFAULT = 4
AGENT_COMPACTION_QUALITY_THRESHOLD = float(
    os.environ.get(
        "AGENT_COMPACTION_QUALITY_THRESHOLD",
        str(AGENT_COMPACTION_QUALITY_THRESHOLD_DEFAULT),
    )
)
# 触发降级时回退的"更保守截断式压缩"保留条数 = 默认 keep_recent 上浮的偏移量。
AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS = int(
    os.environ.get(
        "AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS",
        str(AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS_DEFAULT),
    )
)
