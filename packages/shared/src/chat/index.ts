// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话渲染模型 barrel(W6 立;web / extension / mobile-rn 共用纯函数出口)
export * from './render-model'
// 任务进度状态条派生层(跨端单一真相源:纯函数,无平台依赖)
export * from './task-status'
// 工具码名 → i18n 键展示映射(界面禁止直显英文工具码名)
export * from './tool-display'
export * from './tool-activity'
// D83 MCP 工具活动的 server × tool × 是否带上下文 三层措辞层(回落链唯一实现,链尾交回 tool-activity)
export * from './mcp-tool-activity'
// D81 类目聚合双时态(文件/图片/搜索/思考/自定义)——与 tool-activity 共用 taskStatus 双时态词表,不另建
export * from './tool-category'
// 流式失败的跨端标记规则(error 词汇单一真相:标记 / 尾位定位 / 失败轮判定 / 重发目标)
export * from './stream-error'
// 工作区权限档展示(D111:档位行取词,web/extension/miniapp-taro/mobile-rn 共用)
export * from './permission-tier'
// D79 等待态文案池(分象限×分阶段轮换,seed 取模确定性,跨端共用)
export * from './waiting-pool'
// D55 步骤决策词汇表(15 个后端字面量的唯一映射,跨端共用;认不出不编造)
export * from './step-decision'
// D36 会话内输入历史栈(纯逻辑:push/去重/50 上限/游标导航;平台无关,web 接线在 use-prompt-history)
export * from './prompt-history'
// D105 PR 检查状态与动作卡(六态 + 聚合三态/空态的唯一判定层;不取数,数据面复用既有 PR 通道)
export * from './pr-checks'
// D103 流内多智能体批量动作卡的动作矩阵(六动作 × 三态;相位与实例状态两个正交维度各只有一个定义处)
export * from './agent-actions'
// D99 消息串内富文本动作锚点(标签白名单 + 跨端唯一解析器;非白名单一律按文本,严禁打开裸 HTML)
export * from './rich-anchors'
// D72 Worktree 生命周期八态(创建中/已创建/初始化失败/超时/已清理/恢复中/已恢复/无法恢复;与 §12d
// 收编三阶段 cherry-pick→remove→prune 状态一致,含单写者守卫;不为卡片取数,onAction 注入)
export * from './worktree-lifecycle'
// D96 对话内写作块三动作(accept/acceptAll/revert)+ 失败态;撤销可逆,复用 artifact-canvas 版本栈
export * from './writing-block'
// D82 就地润色与失败保稿四相位(成功替换草稿 / 失败草稿字节级不变 / 二次可重试;不新建提示词栈)
export * from './prompt-polish'
// D71 十态 turn 状态词汇表(排队中/准备中/思考中/使用工具/等待确认/后台执行中/正在停止/已完成/失败/已停止;
// 等待确认 waitsUser 与后台执行中 offTurn 十态各唯一,不得退化成思考中/运行中的别名)
export * from './turn-status'
// D71 errorCode → 中文标题 + 建议动作 映射表(104 条,分类复用 D92 ViewFailureKind 不另立第二套;
// 未收录返回 null,零「未知错误」兜底;覆盖率由 scripts/check-error-code-coverage.mjs 守)
export * from './error-catalog'
// D94 失败诊断脱敏交接包四段式(诊断方法/已尝试步骤/已脱敏证据/产品界面;脱敏走 shared/utils/redact.ts,
// 本地确定性规则优先,外部服务 down 仅作辅助信号;无网络时降级不阻断)
export * from './handoff-package'
// D75 侧边任务生命周期四态(running/completed/expired/cleaned,仅 cleaned 为终态)+ 临时性显式声明
// + 过期批量清理 + 并行运行位置 + 文件变更计数 + 关闭前确认判据;不触碰 /side 队列语义(W27 预备消息优先)
export * from './side-task-lifecycle'
// D100 计费自助状态机(开关四态/保存/确认门 —— 凡自动扣款必先说明性确认,跳过确认不得触发 enable/
// 逐字段校验 minimumDifference 等/价格三态/首充失败恢复两形状;不取数,onAction 注入)
export * from './auto-topup'
// D102 对话移交工作树(四条分支名校验固定顺序:required→trailingSlash→defaultBranch→alreadyExists/
// existing 目标免 alreadyExists/运行中禁止复用 D71 isActiveTurnState 不另立第二套)
export * from './move-to-worktree'
// D66 编辑并重新发送 = 文件回退组合操作(十相位/四组失败态逐一落名/部分回退警示
// 「部分修改未被检查点完整记录,回退结果可能不完整」/编排失败即停报告步骤;回退走既有 checkpoint 通道,不新建)
export * from './edit-resend-rollback'
// budget 额度分档告警的跨端措辞装配(三条硬规则:载荷没给的不说 / 无 detail 不留悬空冒号 /
// 未知档位不静默)。规则收在此处而非逐端复写 —— web 曾无条件播报"明日 0 点重置"(resetAt 可选)
// 并把 85300 印成「8.5 万」(该单位在 en/ja/ko 不成立),复写两份漂移即由此来
export * from './budget-note'
// D62 语音字幕与讨论纪要(麦克风四类错误/录音↔播报互斥/静音≠隐藏字幕/双视图;复用 voice 栈不新建录音栈)
export * from './voice-subtitles'
// D91 四类文档批注锚点分型(PDF/PPTX/DOCX/XLSX 坐标逐字对齐原文;四类共用单一状态机,禁止各写一套)
export * from './annotation-anchors'
// D67 额度归属分型与折扣倒计时(四型归属 + 三动作族 + 「不充值可用心智」机器判据:免费档可用时判定层剔除付费动作;
// 与 D71 error-catalog 两道闸协同,映射不到不硬塞)
export * from './quota-ownership'
// D43 / D36 / D35 这三个模块(voice-note、prompt-drafts、history-projection)在全仓任何 ref 上
// 都不存在,而 `export * from` 一个解析不到的路径会让 @ihui/shared 的根出口整体不可用 —— 28 个
// 走 `from '@ihui/shared'` 根 barrel 的 web 文件因此整片无法构建(部署环卡在 next build)。
// 模块落地后逐行去掉注释即可恢复出口。
// D43 会话内快捷笔记(录音 12 phase 状态机逐字对齐 Qoder recordingNote;转写复用既有 voice 栈,归档纯逻辑)
// export * from './voice-note'
// D36 会话内输入草稿(截断上限/安全读取;分桶 key 由调用方决定,形态对齐 prompt-history)
// export * from './prompt-drafts'
// D35 长会话分页投影(turn 分片纯函数:keyset cursor 往返一致 + 流追加后旧页稳定=增量回放语义)
// 2026-09-26 落地并接线(消费点:packages/api-client getConversationHistory +
// apps/web/src/hooks/use-chat-history-projection.ts);此前这行是注释态而服务端端点已入库,
// 即"数据面在、投影层无人实现"。上方"三个模块都不存在"的说明对 voice-note / prompt-drafts
// 也已失真(两者文件在 HEAD 面存在),但那两行的归属不在本票,此处只动 history-projection。
export * from './history-projection'
// D65 Hook 失败可见性(定档 C:hook_engine 失败信息内存有/SSE 通道无/DLQ 消费出口无 ⇒ 本票仅契约先行
// 六态词汇表含 resultNotRecorded 终态缺省;attachment stderr/command 过 shared/utils/redact;渲染位待 D34 补事件)
export * from './hook-failures'
// D69 输入区文案族(压缩不可用三类原因因/果成对 + 排队许可纯函数 canReorder/canUndo/canInterject +
// deniedNotice 组合矩阵非法组合 null;只读不写不碰 W27;交互本体归 D38)
export * from './input-notices'
// D89 输入源与队列小项(智能快照三态+首用引导+三源分流 / 队列命令化+Undo 三态与 W27 只读纪律 /
// 记忆引用计数空态 + goal 成就耗时复用 formatDurationHuman)
export * from './input-sources'
// D77 对话流业务表单卡(email/calendarEvent 两类 schema 与 form_request 事件形状对齐 + 判定层校验
// + 动作成对硬约束 approve↔reject 拒绝路径零副作用;复用 ui-react 表单件,不取数 onAction 注入)
export * from './business-forms'
// D97 云端聊天互操作活动卡(五动作 × active/completed/following 三态 = 15 格矩阵穷尽;
// 数据面复用 /api/task-messages + W2 abort,CloudChatOpEntry 为 D50 投递层唯一对接载荷,零新增传输)
export * from './cloud-chat-ops'
// D59 模型负载与排队条(负载三级 + 排队五态 + waitBucket 四档边界 + 排位插值;
// 与 D71 turn-status 正交(turn 阶段/负载等待两维度);isInducementRisk 对齐 D67 口径;
// 数据面 model_queue 帧归 D34 批次,帧落地前渲染件恒 null 不用假数据占位)
export * from './model-load'
// D76 产物归属 turn 派生层(分型判据 + originating turn 序列 + 轮次序号 + 产物锚点→轮下标;
// 纯函数零平台依赖,web 渲染层 artifact-turn-badge 原样 re-export,残余票 2026-09-25 自端内提取)
export * from './artifact-turn'
// D20 会话组织纯逻辑层(chat/conversation-org.ts)刻意不从本 barrel 导出:根 barrel 已由
// utils/conversation-org(单一正主)导出同名符号,此处再导出会触发 TS2308 二义,使
// @ihui/shared 整体 typecheck 红。文件本体保留 —— conversation-pin.ts 深路径依赖其
// sortPinnedFirst;消费方一律走 @ihui/shared/chat/conversation-pin(RN 即此用法),
// org 组织函数的跨端出口统一为 utils 版,严禁两份同名符号同时漏到根 barrel。
