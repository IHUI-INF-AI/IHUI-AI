// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  TerminalSquare,
  History,
  ShieldCheck,
  Search,
  Blocks,
  MessageSquareCode,
  KeyRound,
  FolderLock,
  Layers,
  Workflow,
  Users,
  Boxes,
  Cpu,
  Database,
  Mic,
  FileText,
  Cable,
  FileCode,
  Server,
  ArrowUpNarrowWide,
  Puzzle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { PluginViewManifest } from '@/lib/plugin-view-runtime'

/**
 * IHUI 能力矩阵(静态数据)。
 *
 * 单一真相源:每条能力只记录名称、分类、成熟度与 IHUI 落位路径；
 * 不携带任何外部程序或证据信息。
 * `view` 复用 F 类 `PluginViewManifest`(单一真相源,勿在此重定义第二份沙箱契约)。
 */

export const IHUI_CATEGORIES = [
  'terminal',
  'snapshot',
  'permission',
  'code-intel',
  'plugin',
  'ipc',
  'secret',
  'agent-runtime',
  'agent-team',
  'sandbox-fs',
  'process-governance',
  'local-model',
  'session-log',
  'document',
  'mcp',
] as const
export type IhuiCategory = (typeof IHUI_CATEGORIES)[number]

export interface IhuiCapability {
  /** 稳定 id,匹配 ^[a-z0-9-]+$/。 */
  id: string
  name: string
  category: IhuiCategory
  icon: LucideIcon
  /** 一句话价值(目录卡副标题)。 */
  summary: string
  /** 落地形态:A=已落地 B=适配中 C=规划中。 */
  maturity: 'A' | 'B' | 'C'
  /** IHUI 落位(package/file)。 */
  target: string
  /** 挂载的插件视图 manifest(F 类契约);无视图省略。 */
  view?: PluginViewManifest
}

export const IHUI_CAPABILITIES: IhuiCapability[] = [
  {
    id: 'terminal-exec',
    name: '终端执行层 terminal.exec',
    category: 'terminal',
    icon: TerminalSquare,
    summary:
      '真实 PTY 终端(node-pty/conpty)。IHUI terminal-service.ts(1296 行)已用同款 @lydell/node-pty,自研价值=复用现有能力。',
    maturity: 'A',
    target: 'apps/api/src/services/terminal-service.ts(已有)',
  },
  {
    id: 'terminal-fileops',
    name: '文件操作层 file_ops.*',
    category: 'terminal',
    icon: TerminalSquare,
    summary: 'read/write/edit/list 原语,edit 带唯一性校验防误替换。',
    maturity: 'A',
    target: 'apps/ai-service/services/file_ops_service.py',
  },
  {
    id: 'terminal-permcheck',
    name: '权限校验 permission_check',
    category: 'terminal',
    icon: ShieldCheck,
    summary: '执行前查工作区边界,越界命令先拦后放;配 workspace 参数注入。',
    maturity: 'A',
    target: 'apps/ai-service/services/permission_service.py',
  },
  {
    id: 'snapshot-rollback',
    name: '快照回滚 checkpoint.*',
    category: 'snapshot',
    icon: History,
    summary: 'checkpoint.create/list/restore/diff;危险命令前自动快照可回滚。',
    maturity: 'A',
    target: 'apps/api/src/services/checkpoint-service.ts',
  },
  {
    id: 'perm-sandbox',
    name: '权限沙箱三档模型',
    category: 'permission',
    icon: ShieldCheck,
    summary: 'allow/deny/ask 三档 × workspace 边界,密钥正则脱敏。',
    maturity: 'B',
    target: 'packages/auth + apps/ai-service/services/sandbox_service.py',
  },
  {
    id: 'code-knowledge-graph',
    name: '代码知识图 get_code_knowledge_graph',
    category: 'code-intel',
    icon: Search,
    summary:
      '结构化符号关系替代无预算 grep;搜索预算防失控空转。远程方案本地仅 17 文件纯 UI 壳、AI 全在远程,此能力按 IHUI 插件化架构规划。',
    maturity: 'C',
    target: '(规划中) apps/ai-service/services/code_graph_service.py',
  },
  {
    id: 'plugin-view-runtime',
    name: '插件视图运行时 plugin_view_runtime',
    category: 'plugin',
    icon: Blocks,
    summary: '断源 iframe + postMessage 消息桥,插件视图隔离渲染(已落 154 行)。',
    maturity: 'A',
    target: 'apps/web/src/lib/plugin-view-runtime.ts',
    view: {
      id: 'ihui-plugin-view',
      title: 'IHUI 插件视图运行时',
      src: 'https://aizhs.top/developer/capabilities',
      capabilities: ['plugin:view', 'plugin:postMessage'],
    },
  },
  {
    id: 'ipc-decode',
    name: 'IM/进程间解码(慎用)',
    category: 'ipc',
    icon: MessageSquareCode,
    summary: 'Electron/IM 结构化解码,按规范规划通道协议,不接用户 IM 凭据。',
    maturity: 'C',
    target: '(规划中) apps/desktop IPC 协议设计',
  },
  {
    id: 'secret-redaction',
    name: '密钥脱敏 redactSecrets',
    category: 'secret',
    icon: KeyRound,
    summary: '日志/工具输出四级脱敏(env/json/string/key),防凭据落日志。',
    maturity: 'B',
    target: 'packages/shared/src/utils/redact.ts',
  },
  {
    id: 'sandbox-filesystem',
    name: '文件系统沙箱 allow/deny 写路径',
    category: 'sandbox-fs',
    icon: FolderLock,
    summary: 'bash_sandbox 的 allowWrite/denyWrite 路径策略,执行前限定可写边界。',
    maturity: 'B',
    target: 'packages/auth + apps/ai-service/services/sandbox_fs_service.py',
  },
  {
    id: 'subagent-budget',
    name: '子代理并发/预算/深度治理',
    category: 'agent-runtime',
    icon: Layers,
    summary: 'maxConcurrentSubagents + spawnBudget + subagentDepth,防子代理失控空转。',
    maturity: 'B',
    target: 'apps/ai-service/services/subagent_governance.py',
  },
  {
    id: 'job-broker-runtime',
    name: '长驻进程 job broker 治理',
    category: 'agent-runtime',
    icon: Workflow,
    summary: 'claimWorker/planCrashResume/spawnInner + respawn 预算,长任务可恢复。',
    maturity: 'B',
    target: 'apps/ai-service/services/job_broker_service.py',
  },
  {
    id: 'team-runtime-registry',
    name: 'team runtime 成员注册表',
    category: 'agent-team',
    icon: Users,
    summary: 'TeamMemberRegistry 多代理编队:register/notifyStateChange + leader 权限传导。',
    maturity: 'C',
    target: '(规划中) apps/api/src/services/agent-teams-service.ts',
  },
  {
    id: 'os-keychain',
    name: 'OS keychain 原生密钥库 keytar',
    category: 'secret',
    icon: KeyRound,
    summary:
      'keytar 7.9.0 把凭据存进 OS keychain(Windows Credential Manager/Mac Keychain),优于手搓 node:crypto 加密存库。IHUI carrier-login.ts 现为自实现加密,存在安全差距。',
    maturity: 'B',
    target: 'packages/auth/src/keychain-service.ts',
  },
  {
    id: 'ripgrep-search',
    name: 'ripgrep 代码搜索集成',
    category: 'code-intel',
    icon: Search,
    summary: '自托管 ripgrep 二进制做代码搜索,替代无预算 grep;含下载/初始化。',
    maturity: 'B',
    target: 'apps/ai-service/services/ripgrep_search_service.py',
  },
  {
    id: 'windows-job-object',
    name: 'Windows Job Object 防孤儿原语 job-object.node',
    category: 'process-governance',
    icon: Boxes,
    summary:
      '原生 Windows Job Object(killOnClose)绑定:子进程/孙进程挂到同一 Job,CLI 宿主退出即整组回收,根治孤儿进程。嵌套 Job + MSYS breakaway 回归测试齐全。IHUI terminal-service.ts 现仅靠 node-pty spawn,无 Job 治理。',
    maturity: 'B',
    target: 'apps/api/src/services/process-governance-service.ts',
  },
  {
    id: 'local-model-governance',
    name: '本地大模型治理 远程方案:local-model:*',
    category: 'local-model',
    icon: Cpu,
    summary:
      '本地 LLM 生命周期管理面:list / start-download / pause-download / deployment-plan / llama-status / set-engine-keep-alive / toggle-enabled / delete-model。含 llama.cpp 引擎独立下载与常驻控制。',
    maturity: 'B',
    target: 'apps/api/src/services/local-model-service.ts',
  },
  {
    id: 'acl-capability-sandbox',
    name: 'capability-SID ACL 沙箱(目录级写白名单)',
    category: 'permission',
    icon: ShieldCheck,
    summary:
      'OS 级目录写白名单:capability-SID allow ACE + 从 world SID 剥 FILE_DELETE_CHILD 的 Deny ACE + Low no-write-up 强制标签,三次编辑合并进一次 SetNamedSecurityInfoW。IHUI os_sandbox.py 现仅有 DISABLE_MAX_PRIVILEGE 剥特权,无 capability-SID 目录级白名单与跨根隔离 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/services/os_sandbox.py(补 capability-SID 写根 ACL 层)',
  },
  {
    id: 'ckg-vector-search',
    name: '代码知识图内嵌向量检索 sqlite_vec',
    category: 'code-intel',
    icon: Search,
    summary:
      'CKG 代码知识图内置 local_embedding + sqlite_vec 向量库(:50000),符号关系 + 语义向量检索一体,替代无预算 grep。IHUI code_symbol_graph.py / knowledge_graph.py 有符号图但无内嵌向量检索 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/code_symbol_graph.py(补 sqlite-vec 语义检索)',
  },
  {
    id: 'sandbox-network-policy',
    name: '沙箱网络策略 network_allow/deny',
    category: 'sandbox-fs',
    icon: FolderLock,
    summary:
      '沙箱化 toolhost 执行工具时施加 network_allow/deny 策略,云代理按租户 gated。IHUI sandbox_policy.py 已有 allow_network 布尔,但缺 allow/deny 双清单与四模式代理(cloud/system/manual/direct)双重应用。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/sandbox_policy.py(allow_network 布尔 → allow/deny 清单)',
  },
  {
    id: 'ihui-sandbox-vm',
    name: '沙箱 VM 本体(aha_sbox_v1:aiep_vm/aiep_sbox/aiep_ipc)',
    category: 'sandbox-fs',
    icon: Boxes,
    summary:
      '字节系 Rust 原生沙箱 SDK(aha_sbox_v1):vm_sdk.dll + sbox_sdk.dll + aiep_vm/aiep_sbox/aiep_ipc.dll 全 x64/x86,把工具执行放进 VM 级隔离环境(非单进程 sandbox),run_helper.exe 启动子进程。与 sandbox-network-policy(网络策略层)互补 —— 那条是策略,这条是隔离本体。IHUI exec_policy 是权限检查,不是 VM 级隔离。',
    maturity: 'C',
    target: '(规划中) apps/ai-service 沙箱隔离层(exec_policy → VM 级)',
  },
  {
    id: 'ihui-process-orchestration',
    name: '进程化 agent 运行时(harness/ai_agent/toolhost socket 编排)',
    category: 'agent-runtime',
    icon: Workflow,
    summary:
      '字节系把 AI 主体整块下沉到 Rust 原生层,拆成三个巨型 DLL 独立进程:harness.dll(263MB,Agent 编排/会话主控) + ai_agent.dll(285MB,Agent 主体/工具循环) + toolhost.dll(99MB,工具宿主/执行沙箱化),用 socket 端口编排通信。阶段化日志标签 stage=... 便于追踪。IHUI agent 是服务进程内组合,无进程化拆分与 socket 编排。',
    maturity: 'C',
    target: '(规划中) apps/ai-service agent 进程化拆分(服务进程内 → 独立进程 socket 编排)',
  },
  {
    id: 'longtask-observability',
    name: '渲染长任务/心跳观测 perf:renderer-*',
    category: 'process-governance',
    icon: Workflow,
    summary:
      '渲染进程长任务栈回传 + 心跳观测:perf:renderer-longtask-stack 抓阻塞主线程的调用栈,perf:renderer-heartbeat 探活。IHUI sandbox_metrics.py 测沙箱资源,但无渲染进程 long task 阻塞栈回传。',
    maturity: 'C',
    target: '(规划中) apps/desktop 渲染进程性能观测',
  },
  {
    id: 'app-file-sandbox',
    name: '应用文件沙箱 plugin-app:read-local-*',
    category: 'sandbox-fs',
    icon: FolderLock,
    summary:
      '第三方 Buddy 应用宿主的本地文件沙箱:受限目录/ZIP 只读访问 + 调试目录监视(watch/unwatch)+ HTTPS handler 注入。IHUI sandbox-filesystem 管 agent 写路径,此条是插件应用宿主的只读文件桥,互不重复。',
    maturity: 'C',
    target: '(规划中) apps/desktop 插件应用宿主文件桥',
  },
  {
    id: 'session-log-eventsourcing',
    name: '事件溯源会话日志 session-log(append-only + replay/fork)',
    category: 'session-log',
    icon: Database,
    summary:
      '每条模型可见事实以 append-only 会话日志记录并从中推导历史,支持 inspect/replay/fork/flush 而保留历史事件;compaction 只隐藏被取代条目不删除;persistence 可选,checkpoint 等后端就绪。IHUI 已复现核心:app/core/session_event_log.py(2026-11-15 R11,append 原子性+JSON 安全+重放投影+fork/compaction,15 测试钉住)。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/session_event_log.py(已落地 append-only 事件日志 + 重放投影)',
  },
  {
    id: 'sandbox-escalation-ladder',
    name: '沙箱权限提升阶梯 escalation(严格更宽 + 执行前人审批)',
    category: 'permission',
    icon: ArrowUpNarrowWide,
    summary:
      '严格更宽阶梯表 + 参数配对校验 + 模型可见拒绝/提示标记 + approveEscalation 有序 fail-closed 序列,在执行任何东西前经用户审批通道裁决 sandbox_permissions 请求。IHUI 权限模型无"运行时申请更宽模式 + 人审批"阶梯 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/services/os_sandbox.py(补 escalation 阶梯 + 审批通道)',
  },
  {
    id: 'local-asr-sensevoice',
    name: '本地语音转文字 ASR(sherpa-onnx + sensevoice,非云)',
    category: 'local-model',
    icon: Mic,
    summary:
      '宿主端本地语音识别:sensevoice 模型经 sherpa-onnx 原生插件(sherpa-onnx-win-x64.node)离线转写,实验性 API + voice-input bundle,不经云端。IHUI realtime_voice_session.py 走云端,无本地 ASR 能力 —— 真缺。',
    maturity: 'C',
    target: 'apps/ai-service/app/core/(补本地 ASR 通道,与云端并存)',
  },
  {
    id: 'office-render-kit',
    name: 'Office 文档渲染套件(LibreOffice 原生 + WASM 兜底)',
    category: 'document',
    icon: FileText,
    summary:
      '宿主端把 Office 文档渲染为 PDF/PNG、互转格式、重算工作簿;声明了原生 LibreOffice 引擎的目标用它,其余用 Node WASM;预览支持 DOC/DOCX/XLS/XLSX/PPT/PPTX,操作另收 OpenDocument,OOXML 返回缺失字体名。IHUI 无宿主 Office 渲染/重算 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/services/(补 office 渲染/重算通道)',
  },
  {
    id: 'subagent-unified-providers',
    name: 'subagent 统一编排(local spawn/fork + ACP + 远程方案+ 远程 CLI)',
    category: 'agent-team',
    icon: Users,
    summary:
      '经命名 provider 委派并收集受管 activation 结果:local spawn 与 fork 子进程保留持久会话可续消息,ACP/外部实现 SDK/远程方案/远程 CLI 单次执行;每个子进程共享 admission/取消/所有权/发现。IHUI subagent_cascade.py 仅本地级联,无多 provider 统一编排 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/subagent_cascade.py(补多 provider 编排)',
  },
  {
    id: 'ptc-programmatic-tool-calls',
    name: 'PTC 程序化工具调用 run_code(模型写代码调工具)',
    category: 'agent-runtime',
    icon: FileCode,
    summary:
      '模型写 TS/Python 程序经 run_code 调用 agent 可见工具,程序在原生并发契约下调度的嵌套执行;每个子 dispatch 记日志供重建,仅外层 curated 结果进模型历史。IHUI 无"程序化工具调用"传输 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/agents_md.py(补 PTC run_code 传输)',
  },
  {
    id: 'acp-agent-protocol',
    name: 'ACP Agent 客户端协议(跨进程 subagent,JSON-RPC stdio)',
    category: 'mcp',
    icon: Cable,
    summary:
      '经标准 ACP(Agent Client Protocol)自动化持久 agent:创建/恢复会话、选模型与推理档、挂 MCP server、提交/取消任务、收语义更新、独立关闭会话;面向 out-of-process subagent、测试 runner、脚本控制器。IHUI 无跨进程 agent 客户端协议 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/routers/(补 ACP stdio server)',
  },
  {
    id: 'token-meter-replay-aware',
    name: '重放感知 token 计量 ctx.tokenMeter(provider 分桶 + 上下文压力)',
    category: 'process-governance',
    icon: Layers,
    summary:
      '重放持久会话日志估算请求/上下文压力或单条消息定价,确定性且不调模型,使 compaction/占用显示/遥测共享同一结果;provider 上报 usage 仅在请求信封完全一致时复用;reasoning 输出跨桶去重。IHUI token_baseline.py/turn_token_usage.py 无重放感知 + 分桶去重 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/token_baseline.py(补重放感知计量 + 分桶去重)',
  },
  {
    id: 'computer-use-registry',
    name: 'computer-use 单驱动注册表(原生 CUA + Cua Driver)',
    category: 'agent-runtime',
    icon: Cpu,
    summary:
      '单驱动一次一个 computer-use provider:加载第二个 provider 报已注册名失败;原生 CUA 与 Cua Driver 适配器共用此注册表,各 provider 自带工具与桌面操作。IHUI desktop 端无 computer-use provider 注册表 —— 真缺。',
    maturity: 'C',
    target: '(规划中) apps/desktop computer-use provider 注册表',
  },
  {
    id: 'ihui-mcp-stack',
    name: 'MCP 协议栈全家桶(hono + SDK server/client/core)',
    category: 'mcp',
    icon: Server,
    summary:
      'asar 内嵌完整 MCP SDK(sdk/server/client/core 近 900 文件)+ hono web 框架 + node-pty 终端 + mammoth/pdfjs 文档处理;主 chunk 为 obfuscator.io 字符串数组混淆但 import 签名清晰可读。IHUI 已有 mcp 基座,可对照其 server/client 拓扑。',
    maturity: 'C',
    target: '(规划中) apps/ai-service MCP server/client 拓扑',
  },
  {
    id: 'sandbox-failure-attribution',
    name: '沙箱失败跨后端归因表(denial 方言 + exit-gate 防误判)',
    category: 'sandbox-fs',
    icon: ShieldCheck,
    summary:
      '把一条受限命令的 (exit_code, stderr) 归因为 denied/runner_fatal/business_failure/oom 四态:每后端一套否认方言(bwrap read-only fs / seatbelt operation not permitted / windows-acl access denied),runner 自身致命规则带退出码 gate(防"命令仅打印签名"被误判成"没跑起来"),各后端声明执行完整性(bwrap/seatbelt=full, windows-acl=partial 因 NTFS 硬链接别名+读不设限,landlock 经 probe 定 full/partial)。IHUI os_sandbox.py 1831 行仅靠 exit code + 一处 MemoryError 字符串判断,退出码非 0 无法区分"被沙箱拒"vs"launcher 崩"vs"业务失败" —— 真缺,已复现 sandbox_failure_classifier.py(17 测试全过)。',
    maturity: 'A',
    target:
      'apps/ai-service/app/core/sandbox_failure_classifier.py(已复现,classify_sandbox_failure 纯函数)',
  },
  {
    id: 'plugin-host-vm-sandbox',
    name: '双半插件宿主运行时(node:vm 沙箱 + 扣留 API 重定向)',
    category: 'plugin',
    icon: Puzzle,
    summary:
      "动态包 host half 源码在全新 node:vm realm 求值:故意扣留 require/fetch/计时器(调用即抛带 插件宿主 服务重定向指引:inject['fs']/['web']/['bash']),只保留 tagged console/harness 注册对/编码原语;vm timeout 只限同步段(async 逃逸是接受的信任立场);跨 realm SyntaxError 判定必须用 error.name 而非 instanceof(vm 在沙箱 realm 构造错误,宿主 instanceof 静默 false)。定位:架构件(权威 gap-matrix §12 判「不复制」——IHUI 服务进程内组合,单机插件调试面不适配多租户平台),复现其沙箱边界以供借鉴 + 借扣留表/跨 realm 判定两处通用安全机制。已复现 plugin_host_vm_sandbox.py(13 测试)。",
    maturity: 'C',
    target:
      '(规划中) apps/ai-service/app/core/plugin_host_vm_sandbox.py(沙箱构造 + 失败归类纯函数)',
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
