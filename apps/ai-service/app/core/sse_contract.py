# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 事件契约 —— Python 侧单一事实源(#25)。

与 packages/shared/src/sse/contract.ts 的 SSE_EVENTS 保持集合完全一致,
由 scripts/check-agent-event-parity.mjs 断言对齐。

本模块不承担序列化职责,但它**确实被运行时依赖**:全仓运行时 import 现读为
SSE-CONTRACT-IMPORT-SITES = 1(app/routers/llm.py 函数内 import SSE_EVENT_CONTRACTS)。
这里曾写过一句"零行为变化、运行时不需要它"的自述,与上面那行 grep 结果矛盾 —— 模块自述的
依赖关系一旦与实况分叉,读注释的人就会以为改它没有影响。该等式由
apps/ai-service/tests/test_sse_contract_self_description.py 现读核(声明数 != 现读数即失败),
新增/删除 import 点时必须同步改上面那个数。
"""

from dataclasses import dataclass, field

# SSE 事件名集合(单一事实源)。值即实际 wire 上的事件判别名。
# 顺序无关,frozenset 用于不可变 + 集合运算。
SSE_EVENTS: frozenset[str] = frozenset(
    {
        "chunk",
        "reasoning",
        "tool-call-start",
        "tool-result",
        "tool-delegate",
        "tool-summary",
        "citations",
        "question",
        "subagent_spawn",
        "subagent_progress",
        "subagent_end",
        "plan-step",
        "thinking",
        "plan_updated",
        "terminal_start",
        "terminal_end",
        # V3 #48(2026-09-26):补登两个一直在生产、契约却漏登的漂移事件。
        # terminal_delta 由 agent_events.SSE_TERMINAL_DELTA 定义、mcp_server 的
        # _emit_terminal_delta 以 {"type": "terminal_delta"} dict 形态产出、llm.py
        # 终端工具直投;此前 parity 门只扫 _sse(...) / event: 形态,dict 形态漏网
        # 造成「生产 ⊆ 契约」断言假绿。
        "terminal_delta",
        # D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」):命令停在"等键盘输入"时
        # 的一帧。生产点 mcp_server._await_terminal_input(经 llm.py 注入的 push 通道直投,
        # 与 terminal_delta 同一承载面),载荷
        # {type, terminalId, sessionId, promptTail, waitingSinceMs, inputMode, maxInputChars, messageId?}。
        # sessionId 是**必需**字段:上行出口的路径里带 {session_id},帧不给会话 id 前端就只能猜,
        # 而猜错的表现是"点了发送什么都没发生"——不报错,最难查的那一型。
        # 键入送回是**上行** POST /llm/complete/stream/{session_id}/terminal-input
        # (snake_case terminal_id/text),与 form_response 同族,**不进**本集合。
        # 必须与 packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        "terminal_interaction",
        # start 由 agent_events.SSE_START 定义、agents.py:1011 的
        # {"type": SSE_START, "task_id", "session_id", "resume_from"} 产出。
        "start",
        # V3 #58(2026-09-26):主聊天流工具审批门(llm.py 工具执行前拦截)。
        # 需要审批时发本帧(payload 与 agent 任务流的 tool-approval 同形:
        # type/approval_id/tool_name/tool_call_id/args_preview/danger_level/session_id),
        # 前端 ToolApprovalDialog 弹窗,决策经
        # POST /llm/complete/stream/{session_id}/approval-response 回传;
        # deny/超时产出 errorCode=TOOL_APPROVAL_DENIED / TOOL_APPROVAL_TIMEOUT 的失败
        # tool-result,工具不执行。bypassPermissions 档不拦截。
        "tool-approval",
        # D113(2026-09-27,G-227):文件写类工具流中 diff 预览帧。
        # 在 tool-call-start 之后、工具实际执行期间逐帧下发,载荷
        # {toolCallId, seq, partialText, truncated?};partialText 为截至当前的
        # 预览文本(累积式,前端整帧替换渲染),seq 单调递增保证重放幂等。
        # tool-result 到达即清预览(最终 diff 以 tool-result 落库面为准,本帧不入库)。
        # 必须与 packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        "tool-delta",
        # V3 #63(2026-09-27 落地生产者):对话流业务表单**下行**帧。
        # 生产点 app/routers/llm.py 工具循环内的 request_business_form 拦截位,载荷
        # {type, requestId, sessionId, kind, fields, actions, messageId}
        # —— 字段名按**线格式 camelCase**(api-client 的 tryParseFormRequest 读的就是
        # requestId/sessionId/messageId 这三个 camel 键,写成 snake 会被整帧丢弃)。
        # 同族的 `form_response` 是**上行**应答(POST
        # /llm/complete/stream/{session_id}/form-response),不是 SSE 事件,故**不进**本集合;
        # 该判据原文与理由见 contract.ts 的 FORM_FRAME_EVENTS 注释第③条。
        "form_request",
        # D152(2026-09-29 立,用户拍板「服务化但存会话元数据、不建新表」):会话目标
        # 状态的下行帧。**单帧带 status:'cleared'**(不建 goal_cleared 第二帧 —— 拍板
        # 口径:少一名就少一处会腐烂的清单)。载荷
        # {type, sessionId, status, objective?, elapsedMs?, tokenUsage?, updatedAt?};
        # sessionId 必需(上行出口路径带 {session_id},不带前端只能猜,而猜错的表现是
        # "点了什么都没发生且不报错" —— D151 同一课)。
        # 状态六档 active|paused|blocked|done|usageLimited|budgetLimited 是**第三个域**,
        # 与 AGENT_TASK_STATUSES(Kanban)/WORKSPACE_AGENT_TASK_STATUSES 不得并集,
        # 同名值 blocked/done 属同词不同义;判据见
        # scripts/check-agent-status-vocabulary-parity.mjs 与 AGENTS §30。
        # 上行出口 POST /llm/sessions/{session_id}/goal(action=set|pause|resume|clear)
        # 是 REST 不是 SSE 事件,**不进**本集合。
        # 必须与 packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        "goal_updated",
        "done",
        "error",
        "fallback",
        "usage",
        "compaction",
        "steer",
        "budget",
        # G-815976(2026-10-04 收口入契约):流式中断标记。生产点 llm_gateway.py
        # astream 异常中断分支(已发过 chunk、不可换 provider/重试);消费
        # api-client onPartialDone。必须与 packages/shared/src/sse/contract.ts 同步。
        "partial_done",
        # D34(2026-09-22,G-40/G-44):运行环境交代两帧。事件名为我方协议自定
        # (与 plan_updated/terminal_end 同族 snake_case);竞品实证部分只有**字段形状**
        # (kind 八枚举 / collapsed+可展开全文 / attempt+maxRetries+retryInMs+httpStatus)。
        # 必须与 packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        #
        # 收回记录(2026-09-22 第 36 轮自查:上两批我多加了两帧,判定为契约设计错误,不留空心帧)
        # - terminal_output:与既有 terminal_end 重复(后者已带 output/exitCode/durationMs);
        #   其唯一新增语义 formattedOutput/truncated 改为 terminal_end 的字段,不再单列事件。
        # - settings_applied:服务端没有"流中途改设置"的触发点(模型与 personality 切换在
        #   web 客户端状态与 HTTP 变更接口,降级由 fallback 帧承担);竞品侧 Codex 的
        #   thread_settings_applied 在我方 importer 里亦按"非对话项"忽略
        #   (app/services/importers/codex.py:20)。改登记为 D43/R 层:前端把用户切换
        #   写成流内留痕条并支持撤销,不再是协议事件。
        #
        # V3 #48(2026-09-26)再收回一帧:
        # - token:全仓零生产点(ai-service 的 llm.py / agent_events.py、apps/api 的
        #   ai-chat-stream / agent-runtime / agent-langgraph 全部查过)。此前契约里它与
        #   chunk 双写同一语义("增量 token 的两种命名"),真正在用的是 chunk。前端
        #   use-agent-stream.ts 的 'token' 消费分支为死分支,同批拆除。
        "injection_applied",
        "retry_scheduled",
    }
)

# V3 #48(2026-09-26):Anthropic Messages API 兼容面事件,单列不入对话流契约。
# 它们由 llm.py 的 Anthropic 兼容端点产出(agent_events.py:88-93 的 SSE_MESSAGE_START
# 等六个常量是单一事实源),wire 形态与 Anthropic 官方一致;语义上不是对话流 UI 事件,
# 混进 SSE_EVENTS 会让前端监听对账与文档都失真。parity 门对两份集合分别做双端一致断言。
SSE_COMPAT_EVENTS: frozenset[str] = frozenset(
    {
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
    }
)

# ── D174(2026-09-30 立)帧级关联键 traceId ────────────────────────────────────
# 它**不是某一帧的字段**,而是每一帧都带的顶层键,所以它不进各条目的 payload_fields:
# 那份清单被 `app/routers/llm.py::_sse()` 的契约诊断当"必填"来查(missing ⇒ 告警),
# 把"本轮没有有效 trace ⇒ 整字段缺席"这一合法形态列进去,就等于让诊断对合法帧恒告警
# —— 与 TS 侧的处理同形:那边把它记在 `SSEEventMeta`(每个事件的共享元信息/顶层注入
# 字段),而不是逐个判别成员里抄一遍。
#
# 值规则(小写 32 hex / 全 0 非法 / 无有效 trace 时整字段缺席)住在
# `app/core/trace_context.py::sse_frame_trace_id`;键名的唯一真相源在这里。
#
# ⚠️ **SSE_COMPAT_EVENTS 不带这个键**:上面那段自己写的原话是"wire 形态与 Anthropic
# 官方一致",往里加我方自定键是单方面改那个协议。所以生产点按"事件名 ∈ 兼容集 ⇒ 不注入"
# 分流,兼容帧保持逐字节旧形状。
SSE_TRACE_ID_PAYLOAD_KEY: str = "traceId"

#: 顶层注入的帧级元信息键(与本模块的 payload_fields 分属两层,理由见上方注释)。
SSE_FRAME_META_FIELDS: frozenset[str] = frozenset({SSE_TRACE_ID_PAYLOAD_KEY})


@dataclass(frozen=True)
class SSEEventContract:
    """SSE 事件契约清单(文档性,非运行时校验)。

    仅描述每个事件的判别名与待收紧 payload 字段,供跨端对齐参考。
    不要求 Pydantic 化,保持零行为变化。
    """

    name: str
    # 待收紧 payload 字段(当前多为宽松 dict,后续逐步结构化)
    payload_fields: tuple[str, ...] = field(default_factory=tuple)
    # 是否为 agent 绑定流上会注入 agentId 顶层字段的事件
    injects_agent_id: bool = True
    # D174(2026-09-30):是否为**每一帧**注入顶层 traceId 的事件。
    # 默认 True —— 本清单里 32 条全是对话流帧,生产点 `llm.py::_sse()` 是唯一注入处;
    # Anthropic 兼容面(SSE_COMPAT_EVENTS)不在本清单里,因此也不会被这条误认成带 traceId。
    # 只有"确实不该带"(例如某帧改走兼容协议)才显式写 False,并在那里写明理由。
    injects_trace_id: bool = True


# 事件清单(注释性文档;payload_fields 为待收紧字段提示)
SSE_EVENT_CONTRACTS: tuple[SSEEventContract, ...] = (
    SSEEventContract("chunk", ("content",)),
    SSEEventContract("reasoning", ("content",)),
    SSEEventContract("thinking", ("content",)),
    SSEEventContract("tool-call-start", ("toolCallId", "name", "args")),
    SSEEventContract("tool-result", ("toolCallId", "result")),
    SSEEventContract("tool-delegate", ("payload",)),
    SSEEventContract("tool-summary", ("summary",)),
    SSEEventContract("citations", ("citations",)),
    SSEEventContract("question", ("question",)),
    SSEEventContract("subagent_spawn", ("payload",)),
    SSEEventContract("subagent_progress", ("payload",)),
    SSEEventContract("subagent_end", ("payload",)),
    SSEEventContract("plan-step", ("payload",)),
    SSEEventContract("plan_updated", ("plan", "explanation", "timestamp", "messageId")),
    SSEEventContract("terminal_start", ("terminalId", "command", "status", "startedAt", "messageId")),
    # V3 #48(2026-09-26)补登:终端命令逐行增量(mcp_server._emit_terminal_delta 实时产出)
    SSEEventContract("terminal_delta", ("terminalId", "stream", "text")),
    # D151(2026-09-29):命令在等键盘输入。messageId 与 terminal_start/terminal_delta 同律
    # (上下文带才带,不是恒在字段),故列在末位并在那里说明可缺。
    SSEEventContract(
        "terminal_interaction",
        (
            "terminalId",
            "sessionId",
            "promptTail",
            "waitingSinceMs",
            "inputMode",
            "maxInputChars",
            "messageId",
        ),
    ),
    SSEEventContract(
        "terminal_end",
        (
            "terminalId",
            "status",
            "endedAt",
            "durationMs",
            "output",
            "exitCode",
            "messageId",
            # D34 收回 terminal_output 后,截断语义并到本帧(第 39 轮补齐生产点):
            # truncated 仅在真被截断时为 true,totalChars 恒为原始长度。
            # formattedOutput 已删 —— 它只有竞品形状、我方无生产点也无消费方(后端不做排版,
            # stdout/stderr 的结构化在 tool-result 帧里已分开),不留空壳字段。
            "truncated",
            "totalChars",
            # D151(2026-09-29):本轮被用户代答过几次。仅 >0 时下发(零交互的旧帧形状不变)——
            # 计数原本只活在 tool-result 里,模型看得见、用户看不见,而"我替它答过一次"是
            # 用户复盘这条命令的第一个问题(票面验收②"不得静默")。
            "interactionCount",
        ),
    ),
    # V3 #48(2026-09-26)补登:agent 流执行开始(agents.py,断点续跑时带 resume_from)
    SSEEventContract("start", ("task_id", "session_id", "resume_from")),
    # D34(2026-09-22,G-40/G-43/G-44/G-52):运行环境交代四帧。
    # 事件名为我方协议自定;字段形状取自竞品一手观察(报告 §1.1 / §16.1)。
    SSEEventContract("injection_applied", ("kind", "collapsed", "fullText", "count")),
    SSEEventContract("retry_scheduled", ("attempt", "maxRetries", "retryInMs", "httpStatus")),
    SSEEventContract("done", ("usage", "model", "stub")),
    # 消息级计量帧(D7/D1 全链路,2026-09-19 立):llm.py 流结束前发出
    SSEEventContract(
        "usage",
        ("messageId", "usage", "timing", "model", "costUsd"),
    ),
    SSEEventContract("error", ("message", "errorCode")),
    # 模型降级通知(P4-2,2026-09-19 入契约):llm_gateway 主模型失败切换备用模型时
    # yield,llm.py tool loop 两处 astream 循环 + 非 tool-loop 兜底路径转发
    SSEEventContract("fallback", ("primary_model", "backup_model", "reason")),
    SSEEventContract(
        "compaction",
        ("triggered", "tokensBefore", "tokensAfter", "removedCount", "usageRatio", "trigger"),
    ),
    # 中途引导注入确认(Steer,2026-09-19 立):llm.py tool loop 注入用户引导文本时发出。
    # G-815975(2026-10-07):phase 两个值 —— injected(注入确认)/ dropped(流收口时
    # 该条引导未消费的显式回报,点名该条目,不再静默丢弃);kind 为条目类型轴
    # (guide=普通引导可 inline / control=设置轮不可 inline,吸收循环遇它即停)。
    SSEEventContract("steer", ("phase", "text", "timestamp", "messageId", "kind")),
    # V3 #58(2026-09-26):主聊天流工具审批帧(与 agent 任务流 tool-approval 同形,
    # 前端同一弹窗消费;approval_id 为流内唯一标识,decision 回传走流级端点)
    #
    # D159(2026-09-30 立,用户批"三档到底")后三个是**新增可选字段**,不是新帧:
    # - exec_environment:这次调用**在哪儿跑**的逐请求事实。组装只有一份实现
    #   (``services/network_approval.py::approval_env_payload`` ←
    #   ``services/approval_persistence.py::describe_exec_environment``),
    #   读不到 ⇒ 发 ``{"available": false}``(**不是**省略、**不是**发一个默认值)——
    #   显示"沙箱内"而实际 plain 等于误导用户放行,比不显示更糟(票第 8 栏爆炸半径)。
    # - network_target:本次要连的目标 ``{host, port, protocol, display, reason?}``。
    #   ``display`` 恒为 ``host:port`` 原样(票面:弹窗不显示哈希/归一键)。
    # - blocked_network_targets:同一次调用里**已被静态策略判死**的目标清单。
    #   "还没有规则覆盖"不算被拦 —— 那是这条审批本身要问的事,写成被拦就是把一个
    #   决策偷装成事实陈述。
    # 三个字段在 ``IHUI_APPROVAL_ENV_REPORT=0`` 时**整块不发**(回退形态 = 本票落地前)。
    SSEEventContract(
        "tool-approval",
        (
            "approval_id",
            "tool_name",
            "tool_call_id",
            "args_preview",
            "danger_level",
            "session_id",
            "exec_environment",
            "network_target",
            "blocked_network_targets",
        ),
    ),
    # D113(2026-09-27,G-227)入集合时漏登记的契约条目 —— 本清单与 SSE_EVENTS 由
    # tests/test_sse_contract.py::test_contracts_align_with_events 严格双射,少一条即红
    # (2026-09-27 由 V3 #63 那票补上:它是**已入库的记账缺口**,不是本票引入的)。
    SSEEventContract("tool-delta", ("toolCallId", "seq", "partialText", "truncated")),
    # V3 #63(2026-09-27 立):对话流业务表单下行帧。字段名 camelCase 是**线格式**,
    # 权威消费方 packages/api-client/src/client.ts 的 tryParseFormRequest(缺 requestId /
    # fields 空 / actions 不成对 ⇒ 整帧丢弃)。
    SSEEventContract(
        "form_request",
        ("type", "requestId", "sessionId", "kind", "fields", "actions", "messageId"),
    ),
    # D152(2026-09-29 立):会话目标状态单帧(cleared 由 status 承载,不建第二帧)。
    # 生产点 app/routers/llm.py 的 POST /llm/sessions/{session_id}/goal —— 写入
    # 服务端主副本(session_store.set_thread_goal_state,唯一合法写口)后经
    # agent_events.publish_goal_update 推进该会话当前所有活跃流;同一份状态也在
    # **流首**带出(新接入的端不必等下一次 set 就看到当前目标)。
    # sessionId 恒在且必须是字符串:上行出口的路径里带 {session_id}。
    SSEEventContract(
        "goal_updated",
        ("type", "sessionId", "status", "objective", "elapsedMs", "tokenUsage", "updatedAt"),
    ),
    # 预算档位提醒(2026-09-19 立,网关发):流首按当日用量分档软提醒
    # (80%~95% warning / 95%~100% critical);>=100% 走 HTTP 429
    # errorCode=BUDGET_EXHAUSTED 硬中断。
    # V3 #48(2026-09-26)补注生产点精确位置:apps/api/src/routes/ai-chat-stream.ts
    # 的 checkTokenBudget 三态分流(block→429 / warning,critical→extraFirstEvents
    # 流首命名帧,两处 :776 与 :1039)。2026-09-26 对标轮曾误判本帧"零生产点"——
    # 只查了 ai-service 的 llm_gateway 没查 apps/api 网关层,教训:**跨端事件先查网关**。
    SSEEventContract("budget", ("level", "percent", "usedTokens", "limitTokens", "tier", "resetAt")),
    # 流式中断标记(G-815976 收口入契约,2026-10-04):llm_gateway.py astream 异常
    # 中断且已发出过 chunk 时 yield(此后流终止,不会有 done)。此前只有生产者,
    # 客户端解析层对它静默返回 null —— 半截回答与完整回答在端上完全同形。
    # 消费:api-client onPartialDone → web send-message.ts 告知截断。
    SSEEventContract("partial_done", ("fallback_applied", "reason", "model")),
)


# ── b76-08a 票3(2026-09-30 立):流式摄入的"ACK≠base"与缺口恢复分级 ────────────
#
# 上游机制(zcode zcodeTaskIndexSyncer):
#   · ACK 只证明 admission,epoch/seq 必须等**首个 logical frame 原子 apply** 后才当
#     resume base(`has_applied_base`)—— "ACK 已到但首帧未齐"期间任何 delta 都不得
#     被当成基线;
#   · 无 base 时 delta 一律不得建立 cold baseline(只有 owned snapshot 能证明完整状态);
#   · gap 三档处置:同代订阅连续性断 ⇒ resync;纪元/代际变 ⇒ 升级 force-snapshot;
#     订阅换代 ⇒ resubscribe(新代订阅);
#   · 恢复 flight 期间的 online delta **不计水位**,只记 `post_recovery_gap_pending`;
#   · 恢复有 assembly_timeout 截止(由调用方带 deadline 调 `begin_recovery`)。
#
# 本段是生产侧(出站组装/水位判定)的唯一判据出口;消费侧(TS)按同一张判例表对齐
# (packages/shared/src/sse 的 readFrameWatermark / isFrameGap,b76-13 票1)。
# 纯数据 + 纯函数,不承担序列化职责,不引入 I/O —— 与本模块零行为纪律同族。

#: snapshot 帧 fromSeq 恒 0(与上游 controller 一致;非 0 即畸形帧)
WATERMARK_SNAPSHOT_SEQ: int = 0

#: 逻辑帧种类(snapshot / delta)
FRAME_KIND_SNAPSHOT: str = "snapshot"
FRAME_KIND_DELTA: str = "delta"

#: gap 三档处置动作(与 resync/forceSnapshot/resubscribe 一一对应)
ACTION_APPLY: str = "apply"
ACTION_RESYNC: str = "resync"
ACTION_FORCE_SNAPSHOT: str = "force-snapshot"
ACTION_RESUBSCRIBE: str = "resubscribe"
ACTION_REJECT_NO_BASE: str = "reject-no-base"
ACTION_DEFER_RECOVERY: str = "defer-recovery"
ACTION_REJECT_INVALID_FRAME: str = "reject-invalid-frame"


@dataclass
class StreamWatermark:
    """一条订阅流的水位/纪元状态(生产侧唯一状态承载)。

    `has_applied_base=False` 期间,**任何** delta 都只是 admission 后的候选,
    不得建立基线 —— ACK 与 base 是两件事,把它们合成一件事就是"账面绿而没人
    知道那一步发生了什么"那一型。
    """

    subscription_id: str | None = None
    has_applied_base: bool = False
    log_epoch: int | None = None
    last_seq: int | None = None
    admission_acked: bool = False
    recovering: bool = False
    post_recovery_gap_pending: bool = False
    #: 恢复 flight 的 assembly_timeout 截止(epoch ms);None = 调用方未设(自有守时)
    assembly_deadline_ms: float | None = None


@dataclass(frozen=True)
class WatermarkDecision:
    """单帧处置结论(字段级,调用方按 action 分流,不再读文案猜)。"""

    action: str
    applied: bool
    reason: str
    has_applied_base: bool
    log_epoch: int | None
    last_seq: int | None
    post_recovery_gap_pending: bool = False


def mark_admission_acked(state: StreamWatermark) -> None:
    """ACK 到达:只登记 admission,**不建立 base**(ACK≠base 是本票第一格)。"""
    state.admission_acked = True


def begin_recovery(state: StreamWatermark, *, deadline_ms: float | None = None) -> None:
    """进入恢复 flight(deadline_ms 为 assembly_timeout 截止,由调用方守时)。

    恢复期间到达的 online delta 走 defer 分支:不计水位、不推进 seq,只置
    `post_recovery_gap_pending` —— 否则恢复面与增量面互相污染,水位就是假话。
    """
    state.recovering = True
    state.assembly_deadline_ms = deadline_ms



def end_recovery(state: StreamWatermark) -> None:
    state.recovering = False


def apply_frame(
    state: StreamWatermark,
    *,
    frame_kind: str,
    log_epoch: int,
    from_seq: int,
    to_seq: int,
    subscription_id: str | None = None,
) -> WatermarkDecision:
    """对一帧做原子判定:返回处置结论;状态只在该帧确实可 apply 时推进。

    判序(逐条短路,与票面机制同序):
      ① 恢复 flight 中的 online delta ⇒ defer(只记 pending,不碰水位);
      ② snapshot:fromSeq 恒 0,否则畸形帧整帧拒绝;合法 snapshot 原子 apply
         (base/epoch/seq 一次写入 —— 半 apply 就是"有 base 没数据"的假基线);
      ③ 无 base 的 delta ⇒ reject-no-base(**不得**建立 cold baseline);
      ④ 纪元变 ⇒ force-snapshot(升级档);
      ⑤ 订阅代际变 ⇒ resubscribe(新代订阅);
      ⑥ `cursor.seq !== frame.from_seq` ⇒ resync(同代重同步,该帧不落水位);
      ⑦ 其余 ⇒ apply,水位推进到 `to_seq`。
    """
    if state.recovering and frame_kind == FRAME_KIND_DELTA:
        # 记 pending 必须落在状态上(不是只在结论里带过):恢复结束后要凭这一位
        # 知道"flight 期间漏了哪些增量",只写在结论里等于没记。
        state.post_recovery_gap_pending = True
        return WatermarkDecision(
            action=ACTION_DEFER_RECOVERY,
            applied=False,
            reason="恢复 flight 期间的 online delta 不计水位,只记 postRecoveryGapPending",
            has_applied_base=state.has_applied_base,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
            post_recovery_gap_pending=True,
        )

    if frame_kind == FRAME_KIND_SNAPSHOT:
        if from_seq != WATERMARK_SNAPSHOT_SEQ:
            return WatermarkDecision(
                action=ACTION_REJECT_INVALID_FRAME,
                applied=False,
                reason="snapshot 帧 fromSeq 恒 0,非 0 即畸形帧,不得当基线",
                has_applied_base=state.has_applied_base,
                log_epoch=state.log_epoch,
                last_seq=state.last_seq,
            )
        # 原子 apply:base、纪元、水位一次写入
        state.has_applied_base = True
        state.log_epoch = log_epoch
        state.last_seq = to_seq
        if subscription_id is not None:
            state.subscription_id = subscription_id
        state.recovering = False
        return WatermarkDecision(
            action=ACTION_APPLY,
            applied=True,
            reason="owned snapshot 原子 apply,成为 resume base",
            has_applied_base=True,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
        )

    # delta 路径
    if not state.has_applied_base:
        return WatermarkDecision(
            action=ACTION_REJECT_NO_BASE,
            applied=False,
            reason="ACK≠base:首个 logical frame 尚未原子 apply,delta 不得建立 cold baseline",
            has_applied_base=False,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
        )
    if state.log_epoch != log_epoch:
        return WatermarkDecision(
            action=ACTION_FORCE_SNAPSHOT,
            applied=False,
            reason="纪元变:旧纪元 delta 不得续写,升级 forceSnapshot",
            has_applied_base=state.has_applied_base,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
        )
    if (
        subscription_id is not None
        and state.subscription_id is not None
        and subscription_id != state.subscription_id
    ):
        return WatermarkDecision(
            action=ACTION_RESUBSCRIBE,
            applied=False,
            reason="订阅代际变:当前订阅作废,按新代重新订阅",
            has_applied_base=state.has_applied_base,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
        )
    if state.last_seq != from_seq:
        return WatermarkDecision(
            action=ACTION_RESYNC,
            applied=False,
            reason="连续性证明断(cursor.seq != frame.fromSeq),该 delta 不写入 summaries/水位",
            has_applied_base=state.has_applied_base,
            log_epoch=state.log_epoch,
            last_seq=state.last_seq,
        )
    state.last_seq = to_seq
    if subscription_id is not None:
        state.subscription_id = subscription_id
    return WatermarkDecision(
        action=ACTION_APPLY,
        applied=True,
        reason="连续帧,水位推进到 toSeq",
        has_applied_base=state.has_applied_base,
        log_epoch=state.log_epoch,
        last_seq=state.last_seq,
    )


# ── b76-13 票2(2026-09-30 立):帧的字段级 schema + 装饰载荷的降级隔离 ─────────
#
# 出站侧的**结构不变量**判据(纯函数,不承担序列化):枚举闭合、必要字段对、
# 跨字段成对判据。校验失败 ⇒ 产 typed fault 信息(调用方据此拒发/告警),
# 不是静默丢帧、更不是放行。**装饰性**字段(output/args_preview 等展示数据)
# 坏型只降级那一档展示,不进入 fault 判据 —— 展示数据坏了只让那张卡退化成
# 纯文本,不决定 row/帧/订阅的生死。
#
# 与 TS 侧同表:`packages/shared/src/sse/contract.ts` 的 SSE_FRAME_SCHEMAS /
# SSE_DECORATIVE_FIELDS(两侧清单逐字同族,漂移由两侧测试钉住,先例:D174)。
# 出站组装点(`app/routers/llm.py::_sse()` 族)接入本判据属 llm.py 现场,不在
# 本票文件射程;判据先落唯一出口,接线由主会话统一排期。

#: 装饰性字段登记(点号路径 frame.field):坏型只降级展示,不杀帧
SSE_DECORATIVE_FIELDS: frozenset[str] = frozenset(
    {
        "terminal_end.output",
        "terminal_end.totalChars",
        "injection_applied.collapsed",
        "injection_applied.fullText",
        "tool-approval.args_preview",
    }
)

#: 枚举闭合判据:frame -> (字段, 合法值集)
SSE_FRAME_ENUMS: dict[str, tuple[str, tuple[str, ...]]] = {
    "terminal_end": ("status", ("completed", "failed")),
}

#: 必要字段对判据:frame -> (条件字段, 条件成立时必须同时在场的字段, 该字段的合法型)
SSE_FRAME_REQUIRED_PAIRS: dict[str, tuple[str, str, type]] = {
    # truncated=true 而 totalChars 缺席/坏型 = "截断了却不知道截掉多少"的假话帧
    "terminal_end": ("truncated", "totalChars", int),
}

#: 跨字段成对判据(上行 form_response,与 contract.ts FormResponseWireBody 逐字同族):
#: approve 带 values 不带理由;reject 带理由不带 values(拒绝零副作用)。
_SSE_FORM_ACTION_PAIRS: dict[str, tuple[bool, bool]] = {
    # action -> (values 必须在场, reject_reason 必须在场)
    "approve": (True, False),
    "reject": (False, True),
}


def sse_frame_schema_fault(event: str, payload: object) -> list[str]:
    """出站帧的字段级校验唯一出口:返回 fault 清单(空 = 通过)。

    判序:载荷必须是 dict(表内帧非 dict 直接 fault)→ 枚举闭合 → 必要字段对 →
    跨字段成对。装饰性字段不判(SSE_DECORATIVE_FIELDS,坏型由序列化处按缺省处理)。
    表外事件名返回空清单 —— 不在本尺子射程,不冒充判过。
    """
    if event not in SSE_FRAME_ENUMS and event not in SSE_FRAME_REQUIRED_PAIRS:
        # form_response 的成对判据只对含 action 键的载荷生效(它没有独立枚举登记)
        if event != "form_response":
            return []
    if not isinstance(payload, dict):
        return [f"{event}: 帧载荷必须是 dict,实得 {type(payload).__name__}"]
    issues: list[str] = []

    enum_rule = SSE_FRAME_ENUMS.get(event)
    if enum_rule is not None:
        field, allowed = enum_rule
        value = payload.get(field)
        if value not in allowed:
            issues.append(f"{event}.{field}: 枚举闭合破坏,实得 {value!r},合法档 {allowed}")

    pair_rule = SSE_FRAME_REQUIRED_PAIRS.get(event)
    if pair_rule is not None:
        cond_field, required_field, expected_type = pair_rule
        if payload.get(cond_field) is True and not isinstance(payload.get(required_field), expected_type):
            issues.append(
                f"{event}.{cond_field}=true 必须携带 {required_field}(必要字段对)"
            )

    if event == "form_response":
        action = payload.get("action")
        pair = _SSE_FORM_ACTION_PAIRS.get(action) if isinstance(action, str) else None
        if pair is None:
            issues.append(f"form_response.action: 枚举闭合破坏,实得 {action!r}")
        else:
            want_values, want_reason = pair
            if want_values and "values" not in payload:
                issues.append("form_response: action=approve 必须带 values")
            if not want_values and "values" in payload:
                issues.append("form_response: action=reject 不得带 values(拒绝零副作用)")
            if want_reason and "reject_reason" not in payload:
                issues.append("form_response: action=reject 必须带 reject_reason")
            if not want_reason and "reject_reason" in payload:
                issues.append("form_response: action=approve 不得带 reject_reason")

    return issues
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
