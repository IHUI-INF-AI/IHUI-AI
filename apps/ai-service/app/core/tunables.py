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

# ==================== 杀手锏常量段 4b:旧工具结果回收 / 压缩有效性守卫阈值 ====================
# 与 TS 共享包 packages/context-compaction/src/{reclaim,validity-guards}.ts 逐值一致。
# 说明:回收动作本身当前只在 TS 侧(agent runtime)执行,Python 侧尚未实现同名行为;
# 这里按"阈值常量必须两侧同值"的约束先把真值沉淀在本真源并纳入对账,避免 Python
# 端将来接入时各写一套数字(即"改了手机上 web 没改"的同型债)。
# 对账入口:consistency-fixtures.json 的 strategy_constants + test_killer_parity.py。
RECLAIM_KEEP_RECENT_ROUNDS = 3  # 最近 N 轮(assistant round)内的工具结果不回收
RECLAIM_MIN_SAVED_TOKENS = 600  # 最小收益门槛:节省不足就不改写(不白破前缀缓存)
RECLAIM_WINDOW_RATIO_TRIGGER = 0.6  # 双触发之一:占窗口比例达该值即回收
RECLAIM_IDLE_TRIGGER_MS = 120000  # 双触发之二:会话空闲超过该毫秒数即回收
RECLAIM_MIN_RESULT_TOKENS = 120  # 单条结果正文的回收下限(太短不值得改写)
REFILL_QUICK_WINDOW_ROUNDS = 2  # 压缩后 ≤N 轮内又满记一次"快速回填"
REFILL_BREAKER_MAX_CONSECUTIVE = 3  # 连续快速回填上限:达上限终止自动压缩并出诊断
OVERFLOW_DROP_MAX_ROUNDS = 6  # 极端溢出时按完整轮次整组丢弃的重试上限
NEXT_TURN_GROWTH_TOKENS = 1200  # 真值复测时预测"下一轮增量"的保守估计

# ==================== 杀手锏常量段 5:P1-② 决策链保留(压缩时保留推理链) ====================
# 背景:压缩会把 head 段 assistant 的推理(reasoning,即"为什么调这个工具")摘要化,
# 规则摘要仅留 120-200 字符、LLM 语义摘要可能整段遗漏,后续轮次 LLM 失去决策依据。
# 决策链蒸馏(head → 结构化决策条目 → 注入摘要消息)纯确定性、零 LLM 调用、零额外
# 成本,默认开启;AGENT_DECISION_CHAIN_ENABLED=off 一键回滚(关闭时压缩产物与现状
# 逐零差异)。属 ai-service 内部增强(TS 共享包压缩无此层),不入 KILLER_CONSTANTS
# parity 集;DEFAULT 标量供测试与报告引用。
AGENT_DECISION_CHAIN_ENABLED = os.environ.get(
    "AGENT_DECISION_CHAIN_ENABLED", "true"
).strip().lower() in ("1", "true", "yes", "on")
# 决策链最大条数(超出丢最旧:近期决策权重高,远期决策由摘要正文兜底)
AGENT_DECISION_CHAIN_MAX_ENTRIES_DEFAULT = 12
# 单条决策保留的推理字符数(超出截断;工具名与结果状态标记不计入)
AGENT_DECISION_CHAIN_REASONING_CHARS_DEFAULT = 160
AGENT_DECISION_CHAIN_MAX_ENTRIES = int(
    os.environ.get(
        "AGENT_DECISION_CHAIN_MAX_ENTRIES",
        str(AGENT_DECISION_CHAIN_MAX_ENTRIES_DEFAULT),
    )
)
AGENT_DECISION_CHAIN_REASONING_CHARS = int(
    os.environ.get(
        "AGENT_DECISION_CHAIN_REASONING_CHARS",
        str(AGENT_DECISION_CHAIN_REASONING_CHARS_DEFAULT),
    )
)

# ==================== 杀手锏常量段 6:goal 独立校验的收口阈值 ====================
# 原散点:app/services/goal_completion_gate.py
# 背景:AGENTS.md §8 第 4 步写着"连续 3 轮 no 无进展 → blocked",第 6 步红线写着
# "单目标最大自动迭代 20 轮",但仓库里从未有过承担这个计数的代码 —— 于是"校验不通过"
# 与"目标收口"之间没有确定关系,goal 可以无限重跑并以"未判定"状态冒充进行中。
# 这里沉淀的是**判定口径**,不是实现细节,改动即改变 goal 生命周期,故入唯一真源。
# 属 ai-service 服务端生命周期常量(TS 端不自行计数,只透传服务端给的 goal_status),
# 因此刻意不进 KILLER_CONSTANTS parity 集 —— 在 TS 侧再抄一份数字反而会造出两个真相。
# 2026-09-26 补(实测逼出来的口径澄清):CLI 的 `ihui agent --goal` 跑的是**它自己的**循环,
# 本服务的 gate 管不到它的轮次,所以计数确实发生在端内;为免"端内抄一份数字"这条本注释
# 反对的形态,`POST /api/agent/goal-verify` 现在把本值随响应回送,端内镜像常量
# (`packages/shared/src/constants.ts` 同名导出)只在服务端没给时兜底 —— 权威仍在这里。
GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES = 3
# 送给独立校验轮的"执行轨迹摘要"字符上限。摘要只含**工具调用与结果**(可观察副作用),
# 不含执行模型的自述正文(那是 executor_claim,§8 禁止作为判定输入)。超限即截断并标
# truncated,让 judge 依 JUDGE_SYSTEM_PROMPT 第 3 条自行判 unmet,而不是静默丢证据。
GOAL_RUN_DIGEST_MAX_CHARS = 6000
