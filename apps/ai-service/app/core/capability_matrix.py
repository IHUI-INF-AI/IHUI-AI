# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #57 能力矩阵:默认关能力台账 + 开机自检。

背景(2026-09-26 立):
    ai-service 存在多个「移植完成但 env 默认关」的能力(AGENT_COMPACTION 系列、
    AGENT_SELF_HEALING / AGENT_BUDGET / AGENT_TEAM_RELAY、ENGINE_* 元数据开关、
    各调度器开关等),散落在 core/services/routers 各处,无人能一句话说清
    「生产上哪些能力是关的」。本模块把全部 feature env 收敛成单一事实源。

category 三值语义(必须如实区分,**不许把灰度类标注为缺陷**):
    - 开关类:功能已移植完成,env 默认关,等待显式放量(部署策略而非缺陷);
    - 灰度类:AGENT_COMPACTION 系列专属 —— 有完整灰度放量体系
      (services/compaction_canary.py,MODE off/ratio/full + CANARY_PERCENT
      按 session_id 稳定哈希),「默认关/未设置」是其设计语义(legacy 路径);
    - 门控类:行为护栏,默认开(可临时关)或默认关(可临时开),
      如 file_watcher / elicitation pause / 工具审批。

条目来源:2026-09-26 全量 grep ``os.environ.get`` / ``os.getenv`` 于 app/ 下
枚举所得(对账判据见 scripts/check-capability-matrix.mjs),不凭记忆登记。
静态对账门保证:矩阵登记的 env 在代码里真实存在;代码里新增的默认关 env
未登记进矩阵即红(防止绕过台账)。

对外接口:
    - ``CAPABILITY_MATRIX``:静态登记(key/env/default/category/owner_module/
      doc_ref/reason_if_off);
    - ``get_capability_matrix()``:每次调用实读 env 生成 current 字段
      (绝不缓存 —— 台账必须反映当前进程真实状态);
    - ``format_matrix_text()``:对齐文本表格,供启动日志与端点共用;
    - ``log_capability_matrix()``:lifespan 启动阶段调用,logger.info 输出台账;
    - ``router``:GET /api/admin/capabilities,role_id >= 1 才可读
      (沿用 main.py audit_recent 的管理员判据;ai-service 既有 /api/admin/*
      路由多只依赖 JWTAuthMiddleware 全局认证,本端点取更严的一档)。
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.core.jwt_auth import require_request_user_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 静态台账。default 字段 = 代码中字面默认值;current 由 get_capability_matrix()
# 每次实读 os.environ 生成。doc_ref 指向 env 的权威读取点。
# ---------------------------------------------------------------------------
CAPABILITY_MATRIX: list[dict[str, str]] = [
    # ============ 灰度类(AGENT_COMPACTION 系列灰度放量体系,compaction_canary.py)============
    {
        "key": "agent_compaction",
        "env": "AGENT_COMPACTION_ENABLED",
        "default": "false",
        "category": "灰度类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1083",
        "reason_if_off": "灰度放量体系设计语义:legacy 路径,AGENT_COMPACTION_MODE 未放量时保持关闭",
    },
    {
        "key": "agent_compaction_llm",
        "env": "AGENT_COMPACTION_LLM_ENABLED",
        "default": "false",
        "category": "灰度类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1094",
        "reason_if_off": "灰度放量体系设计语义:LLM 压缩仅在 MODE=full 时生效",
    },
    {
        "key": "agent_compaction_mode",
        "env": "AGENT_COMPACTION_MODE",
        "default": "(未设置=legacy)",
        "category": "灰度类",
        "owner_module": "app.services.compaction_canary",
        "doc_ref": "app/services/compaction_canary.py:142",
        "reason_if_off": "灰度总闸 off/ratio/full,未设置即 legacy 行为(默认与现状逐零差异)",
    },
    {
        "key": "agent_compaction_canary_percent",
        "env": "AGENT_COMPACTION_CANARY_PERCENT",
        "default": "100(MODE 未设置时不生效)",
        "category": "灰度类",
        "owner_module": "app.services.compaction_canary",
        "doc_ref": "app/services/compaction_canary.py:153",
        "reason_if_off": "灰度比例,仅 MODE 设置后按 session 稳定哈希生效",
    },
    {
        "key": "agent_compaction_context_limit",
        "env": "AGENT_COMPACTION_CONTEXT_LIMIT",
        "default": "0",
        "category": "灰度类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1105",
        "reason_if_off": "0=不启用压缩触发阈值,随灰度体系一并放量",
    },
    {
        "key": "agent_compaction_retention_budget",
        "env": "AGENT_COMPACTION_RETENTION_BUDGET_ENABLED",
        "default": "false",
        "category": "灰度类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1137",
        "reason_if_off": "保留区逐组预算精修,随压缩灰度体系一并放量",
    },
    {
        "key": "agent_compaction_retention_image_budget",
        "env": "AGENT_COMPACTION_RETENTION_IMAGE_BUDGET",
        "default": "false",
        "category": "灰度类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1215",
        "reason_if_off": "保留区图像预算精修,随压缩灰度体系一并放量",
    },
    # ============ 开关类(默认关,移植完成待放量)============
    {
        # V3 #52:RRF 融合常数 k —— 唯一真实 env 读取点在 rag.py:76
        # (二段重排在实现里是构造入参 `rag_llm_rerank_enabled` 而非 env,故不登记成 env 条目)。
        "key": "rag_rrf_k",
        "env": "RAG_RRF_K",
        "default": "60",
        "category": "开关类",
        "owner_module": "app.services.rag",
        "doc_ref": "app/services/rag.py:76",
        "reason_if_off": "非开关而是融合常数:未设置即用论文默认 60,非法/非正数回退默认",
    },
    {
        "key": "agent_budget",
        "env": "AGENT_BUDGET_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:262",
        "reason_if_off": "预算治理(RBCT)默认关,显式开启后生效",
    },
    {
        "key": "agent_team_relay",
        "env": "AGENT_TEAM_RELAY_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:349",
        "reason_if_off": "跨会话接力默认关,显式开启后生效",
    },
    {
        "key": "agent_self_healing",
        "env": "AGENT_SELF_HEALING_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:756",
        "reason_if_off": "工具失败自愈重试默认关(消耗 LLM tokens),显式开启后生效",
    },
    {
        "key": "agent_exec_policy_amendments",
        "env": "AGENT_EXEC_POLICY_AMENDMENTS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:1703",
        "reason_if_off": "执行策略修正案默认关,显式开启后生效",
    },
    {
        "key": "ab_test",
        "env": "AB_TEST_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.ab_test_scheduler",
        "doc_ref": "app/services/ab_test_scheduler.py:115",
        "reason_if_off": "A/B 测试 shadow call 消耗 LLM tokens,默认关",
    },
    {
        "key": "dream",
        "env": "DREAM_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.dream_scheduler",
        "doc_ref": "app/services/dream_scheduler.py:94",
        "reason_if_off": "梦境固化消耗 LLM tokens,默认关",
    },
    {
        "key": "meta_learner",
        "env": "META_LEARNER_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.meta_learner_scheduler",
        "doc_ref": "app/services/meta_learner_scheduler.py:99",
        "reason_if_off": "元学习调度消耗 LLM tokens,默认关",
    },
    {
        "key": "news_cron",
        "env": "NEWS_CRON_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.news_scheduler",
        "doc_ref": "app/services/news_scheduler.py:115",
        "reason_if_off": "资讯每日自动刷新消耗 LLM tokens,默认关",
    },
    {
        "key": "self_media_cron",
        "env": "SELF_MEDIA_CRON_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.self_media_scheduler",
        "doc_ref": "app/services/self_media_scheduler.py:108",
        "reason_if_off": "自媒体定时发布默认关,显式开启后生效",
    },
    {
        "key": "skill_evolution",
        "env": "SKILL_EVOLUTION_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.skill_evolution_scheduler",
        "doc_ref": "app/services/skill_evolution_scheduler.py:89",
        "reason_if_off": "Skill 自进化迭代消耗 LLM tokens,默认关",
    },
    {
        "key": "self_eval",
        "env": "SELF_EVAL_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.skill_scheduler",
        "doc_ref": "app/services/skill_scheduler.py:200",
        "reason_if_off": "Skill 自评估消耗 LLM tokens,默认关",
    },
    {
        "key": "cookie_refresh",
        "env": "COOKIE_REFRESH_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.publish.cookie_refresh_daemon",
        "doc_ref": "app/services/publish/cookie_refresh_daemon.py:55",
        "reason_if_off": "Cookie 自动保活(Playwright headless)默认关",
    },
    {
        "key": "engine_git_metadata",
        "env": "ENGINE_GIT_METADATA_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:463",
        "reason_if_off": "git 工作区元数据注入默认关,显式开启后生效",
    },
    {
        "key": "engine_thread_originator",
        "env": "ENGINE_THREAD_ORIGINATOR_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:474",
        "reason_if_off": "线程来源标注默认关,显式开启后生效",
    },
    {
        "key": "engine_installation_id",
        "env": "ENGINE_INSTALLATION_ID_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:486",
        "reason_if_off": "安装标识注入默认关,显式开启后生效",
    },
    {
        "key": "engine_turn_metadata",
        "env": "ENGINE_TURN_METADATA_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:497",
        "reason_if_off": "回合元数据注入默认关,显式开启后生效",
    },
    {
        "key": "engine_message_history",
        "env": "ENGINE_MESSAGE_HISTORY_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:508",
        "reason_if_off": "消息历史注入默认关,显式开启后生效",
    },
    {
        "key": "engine_rollout_archive",
        "env": "ENGINE_ROLLOUT_ARCHIVE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:519",
        "reason_if_off": "rollout 归档默认关,显式开启后生效",
    },
    {
        "key": "engine_rollout_truncation",
        "env": "ENGINE_ROLLOUT_TRUNCATION_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:530",
        "reason_if_off": "rollout 截断默认关,显式开启后生效",
    },
    {
        "key": "engine_feature_flags",
        "env": "ENGINE_FEATURE_FLAGS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:553",
        "reason_if_off": "feature flags 注入默认关,显式开启后生效",
    },
    {
        "key": "agents_md_state",
        "env": "IHUI_AGENTS_MD_STATE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:441",
        "reason_if_off": "AGENTS.md 状态回写默认关,显式开启后生效",
    },
    {
        "key": "turn_token_usage",
        "env": "IHUI_TURN_TOKEN_USAGE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:452",
        "reason_if_off": "回合 token 用量事件默认关,显式开启后生效",
    },
    {
        "key": "retained_context",
        "env": "IHUI_RETAINED_CONTEXT_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:2360",
        "reason_if_off": "保留上下文默认关,显式开启后生效",
    },
    {
        "key": "mcp_model_tools",
        "env": "MCP_MODEL_TOOLS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.background_tasks",
        "doc_ref": "app/services/background_tasks.py:46",
        "reason_if_off": "模型工具桥默认关,显式开启后生效",
    },
    {
        "key": "sse_contract_validate",
        "env": "SSE_CONTRACT_VALIDATE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.routers.llm",
        "doc_ref": "app/routers/llm.py:365",
        "reason_if_off": "SSE 契约校验默认关(生产性能考量),显式开启后生效",
    },
    {
        "key": "llm_responses_headers",
        "env": "LLM_RESPONSES_HEADERS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.core.llm_gateway",
        "doc_ref": "app/core/llm_gateway.py:420",
        "reason_if_off": "Responses 头装配默认关,显式开启后生效",
    },
    {
        "key": "llm_responses_assembly",
        "env": "LLM_RESPONSES_ASSEMBLY_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.core.llm_gateway",
        "doc_ref": "app/core/llm_gateway.py:431",
        "reason_if_off": "Responses 请求装配默认关,显式开启后生效",
    },
    {
        "key": "llm_provider_config",
        "env": "LLM_PROVIDER_CONFIG_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.core.llm_gateway",
        "doc_ref": "app/core/llm_gateway.py:442",
        "reason_if_off": "provider 动态配置默认关,显式开启后生效",
    },
    {
        "key": "patch_diff",
        "env": "PATCH_DIFF_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.patch_engine",
        "doc_ref": "app/services/patch_engine.py:35",
        "reason_if_off": "补丁 diff 引擎默认关,显式开启后生效",
    },
    {
        "key": "exec_shell_detect",
        "env": "EXEC_SHELL_DETECT_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.sandbox",
        "doc_ref": "app/services/sandbox.py:36",
        "reason_if_off": "shell 探测默认关,显式开启后生效",
    },
    {
        "key": "exec_capture_policy",
        "env": "EXEC_CAPTURE_POLICY_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.sandbox",
        "doc_ref": "app/services/sandbox.py:47",
        "reason_if_off": "捕获策略默认关,显式开启后生效",
    },
    {
        "key": "media_task_poller",
        "env": "MEDIA_TASK_POLLER_ENABLED",
        "default": "0",
        "category": "开关类",
        "owner_module": "app.services.media_tasks",
        "doc_ref": "app/services/media_tasks.py:597",
        "reason_if_off": "媒体任务收尾轮询默认关(与官方 webhook 互补),=1 开启",
    },
    {
        "key": "session_relay_llm_refine",
        "env": "IHUI_SESSION_RELAY_LLM_REFINE",
        "default": "0",
        "category": "开关类",
        "owner_module": "app.services.session_relay",
        "doc_ref": "app/services/session_relay.py:146",
        "reason_if_off": "接力摘要 LLM 精修消耗 tokens,默认关",
    },
    {
        "key": "mcp_export",
        "env": "ENABLE_MCP_EXPORT",
        "default": "(未设置=关)",
        "category": "开关类",
        "owner_module": "app.services.mcp_export",
        "doc_ref": "app/services/mcp_export.py:145",
        "reason_if_off": "对外 MCP Server 导出默认关(不启动额外 listener),显式开启后生效",
    },
    {
        "key": "agent_rollout_budget_tokens",
        "env": "AGENT_ROLLOUT_BUDGET_TOKENS",
        "default": "0",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:274",
        "reason_if_off": "0=不启用 rollout token 预算,随 AGENT_BUDGET 一并放量",
    },
    {
        "key": "agent_reasoning_effort_pin",
        "env": "AGENT_REASONING_EFFORT_PIN_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1167",
        "reason_if_off": "reasoning effort 按模型钉扎默认关,显式开启后生效",
    },
    {
        "key": "agent_auto_compact_window",
        "env": "AGENT_AUTO_COMPACT_WINDOW_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1245",
        "reason_if_off": "自动压缩窗口默认关,显式开启后生效",
    },
    {
        "key": "agent_tool_call_trace",
        "env": "AGENT_TOOL_CALL_TRACE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1269",
        "reason_if_off": "工具调用链路追踪默认关,显式开启后生效",
    },
    {
        "key": "agent_world_state_sections",
        "env": "AGENT_WORLD_STATE_SECTIONS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1280",
        "reason_if_off": "世界状态分节注入默认关,显式开启后生效",
    },
    {
        "key": "agent_additional_context",
        "env": "AGENT_ADDITIONAL_CONTEXT_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1291",
        "reason_if_off": "附加上下文注入默认关,显式开启后生效",
    },
    {
        "key": "agent_context_fragments",
        "env": "AGENT_CONTEXT_FRAGMENTS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1302",
        "reason_if_off": "上下文片段注入默认关,显式开启后生效",
    },
    {
        "key": "agent_session_prefix",
        "env": "AGENT_SESSION_PREFIX_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1313",
        "reason_if_off": "会话前缀复用默认关,显式开启后生效",
    },
    {
        "key": "agent_instructional_fragments",
        "env": "AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1324",
        "reason_if_off": "指导性片段注入默认关,显式开启后生效",
    },
    {
        "key": "agent_startup_prewarm",
        "env": "AGENT_STARTUP_PREWARM_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1335",
        "reason_if_off": "启动预热默认关,显式开启后生效",
    },
    {
        "key": "agent_stream_events",
        "env": "AGENT_STREAM_EVENTS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1346",
        "reason_if_off": "流式事件增强默认关,显式开启后生效",
    },
    {
        "key": "agent_executed_tool_calls",
        "env": "AGENT_EXECUTED_TOOL_CALLS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1687",
        "reason_if_off": "已执行工具调用记录注入默认关,显式开启后生效",
    },
    {
        "key": "agent_guardian_review_reminder",
        "env": "AGENT_GUARDIAN_REVIEW_REMINDER",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:1710",
        "reason_if_off": "guardian 复审提醒默认关,显式开启后生效",
    },
    {
        "key": "agent_network_rule_amendments",
        "env": "AGENT_NETWORK_RULE_AMENDMENTS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.network_approval",
        "doc_ref": "app/services/network_approval.py:271",
        "reason_if_off": "网络规则修正案默认关,显式开启后生效",
    },
    {
        "key": "engine_voice_realtime_context",
        "env": "ENGINE_VOICE_REALTIME_CONTEXT",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.routers.engine_voice",
        "doc_ref": "app/routers/engine_voice.py:56",
        "reason_if_off": "语音回合实时上下文注入默认关,显式开启后生效",
    },
    {
        "key": "llm_concurrent_reasoning_summaries",
        "env": "LLM_CONCURRENT_REASONING_SUMMARIES",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.core.llm_gateway",
        "doc_ref": "app/core/llm_gateway.py:482",
        "reason_if_off": "并发 reasoning 摘要默认关,显式开启后生效",
    },
    {
        "key": "remote_compact_v2",
        "env": "REMOTE_COMPACT_V2_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.token_compaction",
        "doc_ref": "app/services/token_compaction.py:93",
        "reason_if_off": "远端压缩 v2 默认关,显式开启后生效",
    },
    {
        "key": "mcp_openai_file_rewrite",
        "env": "MCP_OPENAI_FILE_REWRITE_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:124",
        "reason_if_off": "OpenAI 文件改写工具默认关,显式开启后生效",
    },
    {
        "key": "mcp_world_state_tools",
        "env": "MCP_WORLD_STATE_TOOLS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:135",
        "reason_if_off": "世界状态工具默认关,显式开启后生效",
    },
    {
        "key": "mcp_permission_profiles",
        "env": "MCP_PERMISSION_PROFILES_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:146",
        "reason_if_off": "权限档案注入默认关,显式开启后生效",
    },
    {
        "key": "mcp_permissions_instructions",
        "env": "MCP_PERMISSIONS_INSTRUCTIONS_ENABLED",
        "default": "false",
        "category": "开关类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:157",
        "reason_if_off": "权限说明注入默认关,显式开启后生效",
    },
    {
        "key": "user_trial_daily_tokens",
        "env": "USER_TRIAL_DAILY_TOKENS",
        "default": "0",
        "category": "开关类",
        "owner_module": "app.services.user_quota",
        "doc_ref": "app/services/user_quota.py:44",
        "reason_if_off": "0=不启用试用日额度(试用能力默认关)",
    },
    # ============ 门控类(默认关的行为护栏,可临时开)============
    {
        "key": "engine_file_watcher",
        "env": "ENGINE_FILE_WATCHER_ENABLED",
        "default": "false",
        "category": "门控类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:542",
        "reason_if_off": "file_watcher 事件门控默认关(对标 Codex 文件监视),显式开启后生效",
    },
    {
        "key": "mcp_elicitation_pause",
        "env": "MCP_ELICITATION_PAUSE_ENABLED",
        "default": "false",
        "category": "门控类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:113",
        "reason_if_off": "elicitation 计数暂停门控默认关(对标 codex ElicitationService)",
    },
    # ============ 门控类(默认开,可临时关的行为护栏)============
    {
        "key": "tool_approval",
        "env": "TOOL_APPROVAL_ENABLED",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.services.agent_loop_v2",
        "doc_ref": "app/services/agent_loop_v2.py:231",
        "reason_if_off": "",
    },
    {
        "key": "tool_deferral",
        "env": "TOOL_DEFERRAL",
        "default": "on",
        "category": "门控类",
        "owner_module": "app.routers.agents",
        "doc_ref": "app/routers/agents.py:139",
        "reason_if_off": "",
    },
    {
        "key": "agent_supertool",
        "env": "AGENT_SUPERTOOL_ENABLED",
        "default": "on",
        "category": "门控类",
        "owner_module": "app.routers.agents",
        "doc_ref": "app/routers/agents.py:151",
        "reason_if_off": "",
    },
    {
        "key": "control_autonomy",
        "env": "CONTROL_AUTONOMY",
        "default": "on",
        "category": "门控类",
        "owner_module": "app.services.control_autonomy",
        "doc_ref": "app/services/control_autonomy.py:134",
        "reason_if_off": "",
    },
    {
        "key": "page_control_tools",
        "env": "PAGE_CONTROL_TOOLS",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.services.page_control_bridge",
        "doc_ref": "app/services/page_control_bridge.py:224",
        "reason_if_off": "",
    },
    {
        "key": "ui_action_tools",
        "env": "UI_ACTION_TOOLS",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.services.ui_action_bridge",
        "doc_ref": "app/services/ui_action_bridge.py:327",
        "reason_if_off": "",
    },
    {
        "key": "app_ui_tools",
        "env": "APP_UI_TOOLS",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.services.ui_action_bridge",
        "doc_ref": "app/services/ui_action_bridge.py:487",
        "reason_if_off": "",
    },
    {
        "key": "dangerous_command_blocked",
        "env": "DANGEROUS_COMMAND_BLOCKED",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.services.mcp_server",
        "doc_ref": "app/services/mcp_server.py:282",
        "reason_if_off": "",
    },
    {
        "key": "llm_model_router_wiring",
        "env": "LLM_MODEL_ROUTER_WIRING_ENABLED",
        "default": "true",
        "category": "门控类",
        "owner_module": "app.core.llm_gateway",
        "doc_ref": "app/core/llm_gateway.py:975",
        "reason_if_off": "",
    },
    {
        "key": "agent_engine_persist",
        "env": "AGENT_ENGINE_PERSIST",
        "default": "on",
        "category": "门控类",
        "owner_module": "app.services.agent_engine",
        "doc_ref": "app/services/agent_engine.py:1927",
        "reason_if_off": "",
    },
    {
        "key": "agent_checkpoint_reconcile",
        "env": "IHUI_CHECKPOINT_RECONCILE",
        "default": "1",
        "category": "门控类",
        "owner_module": "app.services.agent_checkpoint",
        "doc_ref": "app/services/agent_checkpoint.py:180",
        "reason_if_off": "",
    },
]

# 合法类别集合(测试与对账门共同引用的语义域)
VALID_CATEGORIES = ("开关类", "灰度类", "门控类")


def get_capability_matrix() -> list[dict[str, Any]]:
    """返回台账并逐条实读 env 生成 current 字段。

    为什么不缓存:台账的意义是「当前进程真实状态」—— env 可能在进程运行期间
    被改(测试 monkeypatch / 运维热调),缓存台账会撒谎。每次调用全量实读。
    """
    rows: list[dict[str, Any]] = []
    for entry in CAPABILITY_MATRIX:
        row = dict(entry)
        row["current"] = os.environ.get(entry["env"], entry["default"])
        rows.append(row)
    return rows


def format_matrix_text() -> str:
    """渲染对齐文本表格(按字符数对齐,供启动日志单条输出)。"""
    rows = get_capability_matrix()
    headers = ("CATEGORY", "KEY", "ENV", "DEFAULT", "CURRENT", "OWNER_MODULE", "REASON_IF_OFF")
    keys = ("category", "key", "env", "default", "current", "owner_module", "reason_if_off")
    widths = [len(h) for h in headers]
    str_rows: list[list[str]] = []
    for row in rows:
        cells = [str(row.get(k, "")) for k in keys]
        str_rows.append(cells)
        for i, cell in enumerate(cells):
            widths[i] = max(widths[i], len(cell))

    def render(cells: list[str]) -> str:
        parts = []
        for i, cell in enumerate(cells):
            last = i == len(cells) - 1
            parts.append(cell if last else cell.ljust(widths[i]))
        return " | ".join(parts)

    lines = [" | ".join(h.ljust(widths[i]) for i, h in enumerate(headers))]
    lines.append("-+-".join("-" * w for w in widths))
    for cells in str_rows:
        lines.append(render(cells))
    return "\n".join(lines)


def log_capability_matrix() -> None:
    """启动自检入口:lifespan 调用一次,把台账打进启动日志。"""
    matrix = get_capability_matrix()
    logger.info(
        "[capability_matrix] 能力台账共 %d 条(灰度 %d / 开关 %d / 门控 %d),当前默认关能力如下:\n%s",
        len(matrix),
        sum(1 for r in matrix if r["category"] == "灰度类"),
        sum(1 for r in matrix if r["category"] == "开关类"),
        sum(1 for r in matrix if r["category"] == "门控类"),
        format_matrix_text(),
    )


router = APIRouter(prefix="/api/admin/capabilities", tags=["capability-matrix"])


@router.get("", response_model=None)
async def get_capabilities(
    request: Request,
    _user_id: str = Depends(require_request_user_id),
) -> dict[str, Any] | JSONResponse:
    """能力台账只读端点(管理员可读,role_id >= 1)。

    鉴权现状:ai-service 既有 /api/admin/* 路由(news / meta-learner)只依赖
    JWTAuthMiddleware 全局认证,无端点级管理员判据;main.py 的 audit_recent
    采用 role_id >= 1。本端点取更严的一档:require_request_user_id(生产缺身份
    即 401)+ role_id >= 1(非管理员 403)。
    """
    role_id = int(getattr(request.state, "role_id", 0) or 0)
    if role_id < 1:
        return JSONResponse(
            status_code=403,
            content={"code": 403, "message": "仅管理员可读能力台账", "data": None},
        )
    return {
        "code": 200,
        "message": "ok",
        "data": {
            "capabilities": get_capability_matrix(),
            "text": format_matrix_text(),
        },
    }

