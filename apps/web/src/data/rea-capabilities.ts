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
 * REA 逆向能力目录(静态数据,2026-11-15 立,同日深挖扩至 37 条;2026-11-19 清退 1 条
 * acl-capability-sandbox —— 其 evidence 指向 `.archify/deepseek-sandbox-acl-src/src__acl.ts`,
 * 该取证产物从未入库且 `.archify/` 是本地忽略目录,任何干净检出上都无法复验 ⇒ 按本目录
 * "证据必须可回读"的准入删条,现 36 条)。
 *
 * 单一真相源:逆向证据 = REA(js_app_map)对四个 app.asar 的现场取证,
 * evidence_id 形如 `ev_<hex>`(本会话已存,core_evidence_browse 可回放)。
 * 每条 `evidence.probe` 必须是实测的 evidence_id / 函数名 / IPC 通道名,
 * **不写臆测**(先前摘要里的 `*_impl` 臆测名已全部清退)。
 * `view` 复用 F 类 `PluginViewManifest`(单一真相源,勿在此重定义第二份沙箱契约)。
 *
 * 深挖结论(2026-11-15,同日二次深挖扩至 23 条):
 *  - WorkBuddy 5.11.3 是唯一命名完整富矿(CLI agent 运行时 codebuddy-lite-wb.mjs,
 *    2234 bundle 模块 / 12.8MB,函数名未混淆)—— 挖出 agent-runtime / agent-team /
 *    secret-redaction / sandbox-fs 四个 IHUI 缺失维度;二次深挖补 longtask 观测 + 应用文件沙箱。
 *  - Trae CN 1.107.1 提供 ripgrep 代码搜索 + git checkpoint 命令确证;二次深挖补
 *    CKG 内嵌向量检索(sqlite_vec) + 沙箱网络策略(network_allow/deny)。
 *  - Qoder 0.5.6 主 chunk 为 obfuscator.io 字符串数组混淆(非 V8 字节码,import 签名清晰);
 *    4513 清晰 node_modules 暴露 MCP SDK 全家桶 + hono + node-pty,补 qoder-mcp-stack 条。
 *  - DeepSeek Harness 0.2.2-rc.2 **不是纯 UI 壳**(先前误判):199M asar 内嵌 335 个
 *    @deepseek-ai 独立命名包 + 20523 文件带 sha256 清单 + 原始 .ts 源码(非打包),
 *    是全场最大富矿 —— 三次深挖补 session-log-eventsourcing / sandbox-escalation-ladder /
 *    local-asr-sensevoice / office-render-kit / subagent-unified-providers /
 *    ptc-programmatic-tool-calls / acp-agent-protocol / token-meter-replay-aware /
 *    computer-use-registry 共 9 条。
 *  - 三次深挖结论(2026-11-15):DSH 核心架构是 session-log 事件溯源 —— 沙箱模式/审批/
 *    agent 状态全为 log-only 事件,重启靠 replay 重建无外部 config;源码提取器
 *    .box-agent-scratch/dsh-rev/asar_extract.py(纯 Python 解 asar JSON header,不依赖 CLI)。
 *  - 四次深挖(2026-11-15 R11/R12)补 sandbox-failure-attribution(跨后端失败归因表 +
 *    exit-gate 防误判)+ plugin-host-vm-sandbox(cordis 双半插件 host,node:vm 扣留 API 重定向)。
 *  - 五次深挖(2026-11-15 R13,逐程序对账非 DSH 程序)补 Trae 两处真遗漏:trae-sandbox-vm
 *    (aha_sbox_v1 沙箱 VM 本体)+ trae-process-orchestration(harness/ai_agent/toolhost
 *    socket 端口编排)。教训:不能拿只覆盖 DSH 的 gap-matrix 宣称全收口,WorkBuddy/Trae/Qoder
 *    须各自逐项对账。
 */

export const REA_SOURCES = ['qoder', 'trae', 'workbuddy', 'deepseek', 'rea'] as const
export type ReaSource = (typeof REA_SOURCES)[number]

export const REA_CATEGORIES = [
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
export type ReaCategory = (typeof REA_CATEGORIES)[number]

/** 逆向证据引用:全部为 2026-11-15 用 REA(js_app_map)对 app.asar 的现场取证。 */
export interface ReaEvidence {
  /** 源程序(取证里 subject.name + 版本)。 */
  program: ReaSource
  /** 实测标识:取证的 saved evidence_id(js_app_map 记录)。 */
  probe: string
  /** 取证目标 asar 绝对路径。 */
  file: string
  /** 程序版本(取证 subject)。 */
  version: string
  /** asar sha256(取证 subject.sha256 前 8 位)。 */
  sha8: string
  /** 实测要点:源文件数 / IPC paired 数等 js_app_map 实测值。 */
  measured: string
}

export interface ReaCapability {
  /** 稳定 id,匹配 ^[a-z0-9-]+$/。 */
  id: string
  name: string
  category: ReaCategory
  source: ReaSource
  icon: LucideIcon
  /** 一句话价值(目录卡副标题)。 */
  summary: string
  /** 复用形态:A=可直接移植 B=需适配 C=仅借鉴(慎用标注见 ipc/secret)。 */
  maturity: 'A' | 'B' | 'C'
  /** IHUI 落位(package/file)。 */
  target: string
  evidence: ReaEvidence
  /** 挂载的插件视图 manifest(F 类契约);无视图省略。 */
  view?: PluginViewManifest
}

export const REA_CAPABILITIES: ReaCapability[] = [
  {
    id: 'terminal-exec',
    name: '终端执行层 terminal.exec',
    category: 'terminal',
    source: 'qoder',
    icon: TerminalSquare,
    summary:
      '真实 PTY 终端(node-pty/conpty)。IHUI terminal-service.ts(1296 行)已用同款 @lydell/node-pty,逆向价值=对照差异而非移植。',
    maturity: 'A',
    target: 'apps/api/src/services/terminal-service.ts(已有)',
    evidence: {
      program: 'qoder',
      probe: 'ev_39335d5e + unpacked node_modules/@lydell/node-pty(pty.node/conpty.node)',
      file: 'G:\\Qoder CN\\.qoder-versions\\0.5.7\\resources\\app.asar.unpacked',
      version: '0.5.7',
      sha8: '47862150',
      measured:
        'asar 主 chunk 为 V8 字节码混淆不可读;但 unpacked 实测确证 PTY 栈:@lydell/node-pty-win32-x64(conpty.node + conpty_console_list.node)+ node-pty/build/Release/pty.node —— 与 IHUI terminal-service.ts 现有 node-pty 同源',
    },
  },
  {
    id: 'terminal-fileops',
    name: '文件操作层 file_ops.*',
    category: 'terminal',
    source: 'qoder',
    icon: TerminalSquare,
    summary: 'read/write/edit/list 原语,edit 带唯一性校验防误替换。',
    maturity: 'A',
    target: 'apps/ai-service/services/file_ops_service.py',
    evidence: {
      program: 'qoder',
      probe: 'ev_39335d5e (js_app_map)',
      file: 'G:\\Qoder CN\\resources\\app.asar',
      version: '0.5.6',
      sha8: '47862150',
      measured:
        '637 源文件 · 0 paired IPC(5 动态) · 37 endpoint · 154 route · browserify/esbuild/tsc/vite',
    },
  },
  {
    id: 'terminal-permcheck',
    name: '权限校验 permission_check',
    category: 'terminal',
    source: 'qoder',
    icon: ShieldCheck,
    summary: '执行前查工作区边界,越界命令先拦后放;配 workspace 参数注入。',
    maturity: 'A',
    target: 'apps/ai-service/services/permission_service.py',
    evidence: {
      program: 'qoder',
      probe: 'ev_39335d5e (js_app_map)',
      file: 'G:\\Qoder CN\\resources\\app.asar',
      version: '0.5.6',
      sha8: '47862150',
      measured:
        '637 源文件 · 0 paired IPC(5 动态) · 37 endpoint · 154 route · browserify/esbuild/tsc/vite',
    },
  },
  {
    id: 'snapshot-rollback',
    name: '快照回滚 checkpoint.*',
    category: 'snapshot',
    source: 'trae',
    icon: History,
    summary: 'checkpoint.create/list/restore/diff;危险命令前自动快照可回滚。',
    maturity: 'A',
    target: 'apps/api/src/services/checkpoint-service.ts',
    evidence: {
      program: 'trae',
      probe: 'ev_ac41c4bd (js_app_map)',
      file: 'G:\\Trae CN\\resources\\app',
      version: '1.107.1',
      sha8: '46868f54',
      measured:
        '383 源文件 · 71 IPC(2 paired) · 20 window · 289 endpoint · 109 route · browserify/esbuild/tsc/webpack',
    },
  },
  {
    id: 'perm-sandbox',
    name: '权限沙箱三档模型',
    category: 'permission',
    source: 'workbuddy',
    icon: ShieldCheck,
    summary: 'allow/deny/ask 三档 × workspace 边界,密钥正则脱敏。',
    maturity: 'B',
    target: 'packages/auth + apps/ai-service/services/sandbox_service.py',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_4046d0b4 (js_app_map)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '3866 源文件 · 120 IPC(55 paired) · 20 window · 878 endpoint · 54 route · babel/browserify/esbuild/tsc/vite/webpack',
    },
  },
  {
    id: 'code-knowledge-graph',
    name: '代码知识图 get_code_knowledge_graph',
    category: 'code-intel',
    source: 'deepseek',
    icon: Search,
    summary:
      '结构化符号关系替代无预算 grep;搜索预算防失控空转。DeepSeek 本地仅 17 文件纯 UI 壳、AI 全在远程,此能力为设计意图借鉴,无本地实现可逆向。',
    maturity: 'C',
    target: '(仅借鉴设计) apps/ai-service/services/code_graph_service.py',
    evidence: {
      program: 'deepseek',
      probe: 'ev_da289341 (js_app_map)',
      file: 'G:\\Apps\\DeepSeekHarness\\resources\\app.asar',
      version: '0.2.2-rc.2',
      sha8: '49fd1b08',
      measured:
        '实测 17 源文件全为 UI 壳(welcome/update/window),0 paired IPC(142 动态),lib/main.js 单体,contextIsolation+sandbox 全开——本地无任何 AI/工具实现,能力靠远程服务;故降级 C,仅借鉴其"结构化符号图 + 搜索预算"设计意图',
    },
  },
  {
    id: 'plugin-view-runtime',
    name: '插件视图运行时 plugin_view_runtime',
    category: 'plugin',
    source: 'rea',
    icon: Blocks,
    summary: '断源 iframe + postMessage 消息桥,插件视图隔离渲染(已落 154 行)。',
    maturity: 'A',
    target: 'apps/web/src/lib/plugin-view-runtime.ts',
    evidence: {
      program: 'rea',
      probe: 'validatePluginViewManifest / iframePropsFor(本仓已落)',
      file: 'apps/web/src/lib/plugin-view-runtime.ts',
      version: '154 行',
      sha8: '—',
      measured: '本仓实现,F 类单一真相源;PLUGIN_VIEW_SANDBOX=allow-scripts',
    },
    view: {
      id: 'rea-plugin-view',
      title: 'REA 插件视图运行时',
      src: 'https://aizhs.top/developer/capabilities',
      capabilities: ['plugin:view', 'plugin:postMessage'],
    },
  },
  {
    id: 'ipc-decode',
    name: 'IM/进程间解码(慎用)',
    category: 'ipc',
    source: 'rea',
    icon: MessageSquareCode,
    summary: 'Electron/IM 结构化解码,仅借鉴通道协议,不接用户 IM 凭据。',
    maturity: 'C',
    target: '(借鉴) apps/desktop IPC 协议设计',
    evidence: {
      program: 'rea',
      probe: '借鉴 WorkBuddy ev_4046d0b4 IPC 通道族(仅协议模式)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        'WorkBuddy 实测 120 IPC(55 paired),其中 214 调用为动态通道名——仅借鉴通道组织,不接用户 IM 凭据',
    },
  },
  {
    id: 'secret-redaction',
    name: '密钥脱敏 redactSecrets',
    category: 'secret',
    source: 'workbuddy',
    icon: KeyRound,
    summary: '日志/工具输出四级脱敏(env/json/string/key),防凭据落日志。',
    maturity: 'B',
    target: 'packages/shared/src/utils/redact.ts',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_71a977bc redact* 函数族(codebuddy-lite-wb.mjs)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 4 函数:redactEnvValueForLog / redactJsonSensitiveFields / redactSensitiveKeys / redactStringCredentials;占位符 <redacted> [REDACTED] [REDACTED]:[REDACTED]@',
    },
  },
  {
    id: 'sandbox-filesystem',
    name: '文件系统沙箱 allow/deny 写路径',
    category: 'sandbox-fs',
    source: 'workbuddy',
    icon: FolderLock,
    summary: 'bash_sandbox 的 allowWrite/denyWrite 路径策略,执行前限定可写边界。',
    maturity: 'B',
    target: 'packages/auth + apps/ai-service/services/sandbox_fs_service.py',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_71a977bc getDefaultSandboxFilesystemConfig / getDefaultSandboxAllowWritePath',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 11 函数:getDefaultSandboxFilesystemConfig / getDefaultSandboxAllowWritePath / getAllowAllWritePathForPlatform / isWindowsAllowWriteNoBackupPath / S.filesystem.denyWrite.filter',
    },
  },
  {
    id: 'subagent-budget',
    name: '子代理并发/预算/深度治理',
    category: 'agent-runtime',
    source: 'workbuddy',
    icon: Layers,
    summary: 'maxConcurrentSubagents + spawnBudget + subagentDepth,防子代理失控空转。',
    maturity: 'B',
    target: 'apps/ai-service/services/subagent_governance.py',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_71a977bc getMaxConcurrentSubagents / getSubagentDepth / getOrCreateSpawnBudget',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 6 函数:getMaxConcurrentSubagents / getSubagentDepth / getOrCreateSpawnBudget / envelopeBudgetLeft / evaluateJobMemoryBudget / readJobMemoryBudget;常量 subagentSpawnBudget',
    },
  },
  {
    id: 'job-broker-runtime',
    name: '长驻进程 job broker 治理',
    category: 'agent-runtime',
    source: 'workbuddy',
    icon: Workflow,
    summary: 'claimWorker/planCrashResume/spawnInner + respawn 预算,长任务可恢复。',
    maturity: 'B',
    target: 'apps/ai-service/services/job_broker_service.py',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_71a977bc JobBrokerRuntime.*(claimWorker/planCrashResume/spawnInner)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 JobBrokerRuntime 8 成员(claimWorker/planCrashResume/spawnInner/startupProfiler/store)+ buildLongLivedProcessSpawnEnvironment / buildRespawnArgs / persistJobRespawnFlagUnlocked',
    },
  },
  {
    id: 'team-runtime-registry',
    name: 'team runtime 成员注册表',
    category: 'agent-team',
    source: 'workbuddy',
    icon: Users,
    summary: 'TeamMemberRegistry 多代理编队:register/notifyStateChange + leader 权限传导。',
    maturity: 'C',
    target: '(借鉴) apps/api/src/services/agent-teams-service.ts',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_71a977bc TeamMemberRegistry.register / TeamMember.writeRuntimeMemberTermination',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 team 类函数 114 个:TeamMemberRegistry.notifyStateChange/onStateChange/register / leaderPermissionModeForTeammate / createTeamRuntimeManifest / applyPlanApprovalResponses',
    },
  },
  {
    id: 'os-keychain',
    name: 'OS keychain 原生密钥库 keytar',
    category: 'secret',
    source: 'qoder',
    icon: KeyRound,
    summary:
      'keytar 7.9.0 把凭据存进 OS keychain(Windows Credential Manager/Mac Keychain),优于手搓 node:crypto 加密存库。IHUI carrier-login.ts 现为自实现加密,存在安全差距。',
    maturity: 'B',
    target: 'packages/auth/src/keychain-service.ts',
    evidence: {
      program: 'qoder',
      probe: 'unpacked node_modules/keytar@7.9.0(keytar.node 707KB)',
      file: 'G:\\Qoder CN\\.qoder-versions\\0.5.7\\resources\\app.asar.unpacked\\node_modules\\keytar',
      version: '0.5.7',
      sha8: '47862150',
      measured:
        '实测 keytar package.json description="Bindings to native Mac/Linux/Windows password APIs",版本 7.9.0,prebuilds/win32-x64/keytar.node 707584 字节;对照 IHUI apps/api/src/services/carrier-login.ts 用 node:crypto createDecipheriv 自实现',
    },
  },
  {
    id: 'ripgrep-search',
    name: 'ripgrep 代码搜索集成',
    category: 'code-intel',
    source: 'trae',
    icon: Search,
    summary: '自托管 ripgrep 二进制做代码搜索,替代无预算 grep;含下载/初始化。',
    maturity: 'B',
    target: 'apps/ai-service/services/ripgrep_search_service.py',
    evidence: {
      program: 'trae',
      probe: 'ev_ad40823f downloadRipgrep / initRipgrepDir / getGrepSearchTool(tob-git-ai)',
      file: 'G:\\Trae CN\\resources\\app',
      version: '1.107.1',
      sha8: '46868f54',
      measured:
        '实测 5 函数:t.grep / f.initRipgrepDir / f.createRipgrepDir / f.downloadRipgrep / p.getGrepSearchTool;另确证命令 tob-git-ai.checkpointCueInlineCompletion',
    },
  },
  {
    id: 'windows-job-object',
    name: 'Windows Job Object 防孤儿原语 job-object.node',
    category: 'process-governance',
    source: 'workbuddy',
    icon: Boxes,
    summary:
      '原生 Windows Job Object(killOnClose)绑定:子进程/孙进程挂到同一 Job,CLI 宿主退出即整组回收,根治孤儿进程。嵌套 Job + MSYS breakaway 回归测试齐全。IHUI terminal-service.ts 现仅靠 node-pty spawn,无 Job 治理。',
    maturity: 'B',
    target: 'apps/api/src/services/process-governance-service.ts',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_aa7c5cb0 windows-job.native-test.cjs(bin/native/win32-arm64/job-object.node)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测字符串:binding.ensureKillOnCloseJob / ERR_AGENT_CLI_WINDOWS_JOB / job-object.node / "grandchild survives its direct parent and is reaped only when CLI host exits" / "a CLI already inside a parent CLI Job can initialize its own nested Job" / MSYS breakaway 回归(job-git-bash- / bash.exe);对照 IHUI apps/api/src/services/terminal-service.ts:597 仅 pty spawn 无 Job',
    },
  },
  {
    id: 'local-model-governance',
    name: '本地大模型治理 workbuddy:local-model:*',
    category: 'local-model',
    source: 'workbuddy',
    icon: Cpu,
    summary:
      '本地 LLM 生命周期管理面:list / start-download / pause-download / deployment-plan / llama-status / set-engine-keep-alive / toggle-enabled / delete-model。含 llama.cpp 引擎独立下载与常驻控制。',
    maturity: 'B',
    target: 'apps/api/src/services/local-model-service.ts',
    evidence: {
      program: 'workbuddy',
      probe: 'ev_94639b7e + ev_686523ef + ev_800bd156 (ipc workbuddy:local-model:*)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 12 条 paired IPC,handler 全为 registerLocalModelIpc(main/main-bootstrap.js:17),invoker 在 preload/index.js:23:D.list/D.startDownload/D.pauseDownload/D.deleteModel/D.deleteLlamaServer/D.getDeploymentPlan/D.getLlamaStatus/D.setEngineKeepAlive/D.startLlamaDownload/D.toggleEnabled',
    },
  },
  {
    id: 'ckg-vector-search',
    name: '代码知识图内嵌向量检索 sqlite_vec',
    category: 'code-intel',
    source: 'trae',
    icon: Search,
    summary:
      'CKG 代码知识图内置 local_embedding + sqlite_vec 向量库(:50000),符号关系 + 语义向量检索一体,替代无预算 grep。IHUI code_symbol_graph.py / knowledge_graph.py 有符号图但无内嵌向量检索 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/code_symbol_graph.py(补 sqlite-vec 语义检索)',
    evidence: {
      program: 'trae',
      probe:
        'trae-native-runtime 取证:ckg_server(libckg.dll) sublabel="代码知识图 :50000 / local_embedding / sqlite_vec",tag=Rust + 内嵌向量库',
      file: 'docs/benchmark-evidence/2026-10/trae-rea-20261031/T1-trae-ai-agent.md',
      version: '1.107.1',
      sha8: '7c8739dd',
      measured:
        '实测 ckg_server 组件:libckg.dll 独立进程 :50000 端口,内嵌 local_embedding(本地向量化)+ sqlite_vec(SQLite 向量扩展),与 harness/ai_agent/toolhost 三巨型原生模块并列为第四数据库件;对照 IHUI code_symbol_graph.py 纯符号关系图、knowledge_graph.py 文本图,均无向量语义检索层',
    },
  },
  {
    id: 'sandbox-network-policy',
    name: '沙箱网络策略 network_allow/deny',
    category: 'sandbox-fs',
    source: 'trae',
    icon: FolderLock,
    summary:
      '沙箱化 toolhost 执行工具时施加 network_allow/deny 策略,云代理按租户 gated。IHUI sandbox_policy.py 已有 allow_network 布尔,但缺 allow/deny 双清单与四模式代理(cloud/system/manual/direct)双重应用。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/sandbox_policy.py(allow_network 布尔 → allow/deny 清单)',
    evidence: {
      program: 'trae',
      probe:
        'trae-native-runtime 取证:toolhost.dll + agent-tool-host.exe 沙箱化调用,sandbox(aha_sbox_v1) cards 明示 network_allow/deny 策略 + 四模式网络代理 cloud/system/manual/direct 双重应用',
      file: 'docs/benchmark-evidence/2026-10/trae-rea-20261031/T2-trae-periphery.md',
      version: '1.107.1',
      sha8: 'e84a98fe',
      measured:
        '实测隔离卡片:工具执行走沙箱化 toolhost,含 network_allow/deny 策略;网络四模式 cloud/system/manual/direct 双重应用(进程级 + 系统级);云代理按租户 gated 仅业务用户可启用;对照 IHUI sandbox_policy.py:202 仅 allow_network: bool 单布尔,无域名/IP 双清单,无多模式代理叠加',
    },
  },
  {
    id: 'trae-sandbox-vm',
    name: '沙箱 VM 本体(aha_sbox_v1:aiep_vm/aiep_sbox/aiep_ipc)',
    category: 'sandbox-fs',
    source: 'trae',
    icon: Boxes,
    summary:
      '字节系 Rust 原生沙箱 SDK(aha_sbox_v1):vm_sdk.dll + sbox_sdk.dll + aiep_vm/aiep_sbox/aiep_ipc.dll 全 x64/x86,把工具执行放进 VM 级隔离环境(非单进程 sandbox),run_helper.exe 启动子进程。与 sandbox-network-policy(网络策略层)互补 —— 那条是策略,这条是隔离本体。IHUI exec_policy 是权限检查,不是 VM 级隔离。',
    maturity: 'C',
    target: '(借鉴) apps/ai-service 沙箱隔离层(exec_policy → VM 级)',
    evidence: {
      program: 'trae',
      probe:
        'trae-native-runtime 取证:_b_one-sandbox.json components[sandbox,type=security,label=沙箱 VM,tag=aha_sbox_v1] + trae-modules.json 文件清单 vm_sdk/sbox_sdk/aiep_vm/aiep_sbox/aiep_ipc/run_helper(x64+x86)',
      file: 'docs/benchmark-evidence/2026-10/trae-rea-20261031/T2-trae-periphery.md',
      version: '1.107.1',
      sha8: 'e84a98fe',
      measured:
        '实测文件级取证(trae-modules.json size,sha8 用 _b_one-sandbox.json 重算):vm_sdk.dll 2582928B + sbox_sdk.dll 2320272B + aiep_vm.dll 917392B(x64)/698256B(x86) + aiep_sbox.dll 757648B(x64)/575888B(x86) + aiep_ipc.dll 577424B(x64)/435088B(x86) + run_helper.exe 682384B(x64)/545680B(x86) + trae-sandbox.exe 1254288B;aha_sbox_v1 全套 VM 隔离,非单进程 sandbox',
    },
  },
  {
    id: 'trae-process-orchestration',
    name: '进程化 agent 运行时(harness/ai_agent/toolhost socket 编排)',
    category: 'agent-runtime',
    source: 'trae',
    icon: Workflow,
    summary:
      '字节系把 AI 主体整块下沉到 Rust 原生层,拆成三个巨型 DLL 独立进程:harness.dll(263MB,Agent 编排/会话主控) + ai_agent.dll(285MB,Agent 主体/工具循环) + toolhost.dll(99MB,工具宿主/执行沙箱化),用 socket 端口编排通信。阶段化日志标签 stage=... 便于追踪。IHUI agent 是服务进程内组合,无进程化拆分与 socket 编排。',
    maturity: 'C',
    target: '(借鉴) apps/ai-service agent 进程化拆分(服务进程内 → 独立进程 socket 编排)',
    evidence: {
      program: 'trae',
      probe:
        'trae-native-runtime 取证:_b_one-harness.json components[harness,type=backend,tag=263MB Rust] + _b_one-aiagent.json components[aiagent,tag=285MB Rust] + _b_one-toolhost.json components[toolhost,tag=99MB+101MB] + _b_one-ipcbridge.json(ICube 桥接 71 通道)',
      file: 'docs/benchmark-evidence/2026-10/trae-rea-20261031/T1-trae-ai-agent.md',
      version: '1.107.1',
      sha8: '7c8739dd',
      measured:
        '实测文件级取证(trae-modules.json):ai_agent.dll 285523856B + harness.dll 264456080B + agent-tool-host.exe 99315088B + toolhost.dll 97991568B;架构主线 VSCode fork 外壳 + AI 主体整块下沉 Rust;可复用点:进程化拆分(socket 端口编排) + 阶段化日志 stage=;ICube 桥接 71 通道 100 运行时计算',
    },
  },
  {
    id: 'longtask-observability',
    name: '渲染长任务/心跳观测 perf:renderer-*',
    category: 'process-governance',
    source: 'workbuddy',
    icon: Workflow,
    summary:
      '渲染进程长任务栈回传 + 心跳观测:perf:renderer-longtask-stack 抓阻塞主线程的调用栈,perf:renderer-heartbeat 探活。IHUI sandbox_metrics.py 测沙箱资源,但无渲染进程 long task 阻塞栈回传。',
    maturity: 'C',
    target: '(借鉴) apps/desktop 渲染进程性能观测',
    evidence: {
      program: 'workbuddy',
      probe:
        'ev_4046d0b4 (js_app_map) IPC 通道 perf:renderer-longtask-stack / perf:renderer-heartbeat(wb-ipc-raw.json 实测确认)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测 2 条性能域 IPC:perf:renderer-longtask-stack(长任务阻塞栈回传主进程)+ perf:renderer-heartbeat(渲染进程心跳探活);属"性能与长任务观测"域;IHUI 沙箱侧有 sandbox_metrics.py 资源采样,但 Electron 渲染进程 long task 栈回传缺失,仅借鉴观测思路',
    },
  },
  {
    id: 'app-file-sandbox',
    name: '应用文件沙箱 buddy-app:read-local-*',
    category: 'sandbox-fs',
    source: 'workbuddy',
    icon: FolderLock,
    summary:
      '第三方 Buddy 应用宿主的本地文件沙箱:受限目录/ZIP 只读访问 + 调试目录监视(watch/unwatch)+ HTTPS handler 注入。IHUI sandbox-filesystem 管 agent 写路径,此条是插件应用宿主的只读文件桥,互不重复。',
    maturity: 'C',
    target: '(借鉴) apps/desktop 插件应用宿主文件桥',
    evidence: {
      program: 'workbuddy',
      probe:
        'ev_4046d0b4 (js_app_map) IPC 通道 buddy-app:read-local-directory / buddy-app:read-local-zip / buddy-app:watch-debug-directory / buddy-app:unwatch-debug-directory / buddy-app:ensure-https-handler(wb-ipc-raw.json 实测确认)',
      file: 'G:\\WorkBuddy\\resources\\app.asar',
      version: '5.11.3',
      sha8: '42e3c7cf',
      measured:
        '实测"buddy 应用沙箱"域 6 条 IPC:read-local-directory / read-local-zip(本地目录与 ZIP 受限只读)+ watch/unwatch-debug-directory(调试目录监视)+ ensure-https-handler + debug-directory-changed;插件应用宿主侧只读文件桥,与 agent 写路径沙箱(sandbox-filesystem 条)互补不重复',
    },
  },
  {
    id: 'session-log-eventsourcing',
    name: '事件溯源会话日志 dsh-session(append-only + replay/fork)',
    category: 'session-log',
    source: 'deepseek',
    icon: Database,
    summary:
      '每条模型可见事实以 append-only 会话日志记录并从中推导历史,支持 inspect/replay/fork/flush 而保留历史事件;compaction 只隐藏被取代条目不删除;persistence 可选,checkpoint 等后端就绪。IHUI 已复现核心:app/core/session_event_log.py(2026-11-15 R11,append 原子性+JSON 安全+重放投影+fork/compaction,15 测试钉住)。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/session_event_log.py(已落地 append-only 事件日志 + 重放投影)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-session README + dsh-session-persistence-jsonl + dsh-session-projection(-cache) + dsh-session-format v0→v4 迁移链:SessionEventMap / canonicalHeader / SessionSeq / SessionLogOffset / epoch header',
      file: '.archify/deepseek-session-src/session__README.md',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: '3dc8af1f',
      measured:
        '实测 dsh-session README 23762 字符:append-only log + replay 派生历史 + fork 保留历史事件 + compaction 隐藏非删除 + persistence 可选 + checkpoint 等后端;配套 dsh-session-persistence-jsonl(JSONL 持久化)/ dsh-session-projection-cache(投影缓存)/ dsh-session-format-v0-to-v1..v3-to-v4(4 段版本迁移)/ dsh-session-query-sqlite(SQLite 查询);整套以"事件=唯一真相源"驱动,沙箱模式/审批/agent 状态全为 log-only 事件,重启靠 replay 重建无外部 config',
    },
  },
  {
    id: 'sandbox-escalation-ladder',
    name: '沙箱权限提升阶梯 escalation(严格更宽 + 执行前人审批)',
    category: 'permission',
    source: 'deepseek',
    icon: ArrowUpNarrowWide,
    summary:
      '严格更宽阶梯表 + 参数配对校验 + 模型可见拒绝/提示标记 + approveEscalation 有序 fail-closed 序列,在执行任何东西前经用户审批通道裁决 sandbox_permissions 请求。IHUI 权限模型无"运行时申请更宽模式 + 人审批"阶梯 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/services/os_sandbox.py(补 escalation 阶梯 + 审批通道)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-sandbox/src/escalation.ts:SANDBOX_ESCALATION_{INVALID_ARGUMENT,UNAVAILABLE,REJECTED,CANCELLED} / SANDBOX_MODES=[read-only,workspace-write,danger-full-access] / strictly-wider table / approveEscalation / ESCALATION_TARGETS',
      file: '.archify/deepseek-session-src/sandbox__escalation.ts',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'ebf8d9d3',
      measured:
        '实测三模式 SANDBOX_MODES=[read-only,workspace-write,danger-full-access] + 严格更宽阶梯表(EXECUTION 期校验,不烘进 schema)+ 四错误码(参数不配对/无法审批/用户拒绝/审批无决策)+ approveEscalation 在执行前经 EscalationAsk 结构化闭包走审批通道;沙箱模式为 per-session log-only 事件(sandbox/mode),effective=投影态??部署默认,重启靠 replay;对照 IHUI os_sandbox.py 无阶梯/无审批',
    },
  },
  {
    id: 'local-asr-sensevoice',
    name: '本地语音转文字 ASR(sherpa-onnx + sensevoice,非云)',
    category: 'local-model',
    source: 'deepseek',
    icon: Mic,
    summary:
      '宿主端本地语音识别:sensevoice 模型经 sherpa-onnx 原生插件(sherpa-onnx-win-x64.node)离线转写,实验性 API + voice-input bundle,不经云端。IHUI realtime_voice_session.py 走云端,无本地 ASR 能力 —— 真缺。',
    maturity: 'C',
    target: 'apps/ai-service/app/core/(补本地 ASR 通道,与云端并存)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) native_modules sherpa-onnx-win-x64/sherpa-onnx.node + dsh-experimental-speech-to-text(-sensevoice) + dsh-experimental-voice-input-bundle + dsh-experimental-api-speech-to-text',
      file: '.archify/deepseek-session-src/sensevoice__README.zh.md',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'e776f9de',
      measured:
        '实测 10 个原生模块含 sherpa-onnx.node(本地 ASR 推理引擎)+ frame-forwarding.node(LibreOffice 文档帧转发);dsh-experimental-speech-to-text-sensevoice + dsh-experimental-api-speech-to-text + dsh-experimental-voice-input-bundle 构成宿主离线转写链;本地推理不经云,与 IHUI realtime_voice_session.py 云端路径互补',
    },
  },
  {
    id: 'office-render-kit',
    name: 'Office 文档渲染套件(LibreOffice 原生 + WASM 兜底)',
    category: 'document',
    source: 'deepseek',
    icon: FileText,
    summary:
      '宿主端把 Office 文档渲染为 PDF/PNG、互转格式、重算工作簿;声明了原生 LibreOffice 引擎的目标用它,其余用 Node WASM;预览支持 DOC/DOCX/XLS/XLSX/PPT/PPTX,操作另收 OpenDocument,OOXML 返回缺失字体名。IHUI 无宿主 Office 渲染/重算 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/services/(补 office 渲染/重算通道)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-office-kit + @deepseek-ai/libreoffice-kit/frame-forwarding(prebuilds win32-x64 .node) + dsh-skill-office + dsh-tool-office + dsh-client-ui-sidebar-documentpreview/client/office/{cache,face,index}.ts',
      file: '.archify/deepseek-session-src/office-kit__README.md',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: '0313e961',
      measured:
        '实测 dsh-office-kit README 14792 字符:渲染为 PDF/PNG + 格式互转 + 工作簿重算;原生 LibreOffice(frame-forwarding.node)优先,WASM 兜底;DOC/DOCX/XLS/XLSX/PPT/PPTX 预览 + OpenDocument 操作 + PDF 渲染;OOXML 返回缺失字体名、binary 返回空列表;配套 skill-office + tool-office + 文档预览侧栏 UI',
    },
  },
  {
    id: 'subagent-unified-providers',
    name: 'subagent 统一编排(local spawn/fork + ACP + Codex + Claude Code)',
    category: 'agent-team',
    source: 'deepseek',
    icon: Users,
    summary:
      '经命名 provider 委派并收集受管 activation 结果:local spawn 与 fork 子进程保留持久会话可续消息,ACP/DSH SDK/Codex/Claude Code 单次执行;每个子进程共享 admission/取消/所有权/发现。IHUI subagent_cascade.py 仅本地级联,无多 provider 统一编排 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/subagent_cascade.py(补多 provider 编排)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-subagent child-agent.ts resolveChildDepth(delegationDepthOf+1) + SubagentDepthError(maxDepth 上限) + dsh-subagent-fork-in-process / spawn-in-process + dsh-tool-subagent(-control)',
      file: '.archify/deepseek-session-src/subagent__child-agent.ts',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'f632ef9e',
      measured:
        '实测 dsh-subagent README 28071 字符:命名 provider 委派 + 受管 activation;local spawn/fork 留持久会话,ACP/DSH SDK/Codex/Claude Code 单次;共享 admission/取消/所有权/发现;child-agent.ts 委派深度 = parent+1,持久 parent header 为单调下限(恢复的 parent 不能当顶层),SubagentDepthError 超限;对照 IHUI subagent_cascade.py 仅本地级联',
    },
  },
  {
    id: 'ptc-programmatic-tool-calls',
    name: 'PTC 程序化工具调用 run_code(模型写代码调工具)',
    category: 'agent-runtime',
    source: 'deepseek',
    icon: FileCode,
    summary:
      '模型写 TS/Python 程序经 run_code 调用 agent 可见工具,程序在原生并发契约下调度的嵌套执行;每个子 dispatch 记日志供重建,仅外层 curated 结果进模型历史。IHUI 无"程序化工具调用"传输 —— 真缺。',
    maturity: 'B',
    target: 'apps/ai-service/app/core/agents_md.py(补 PTC run_code 传输)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-tool-executor-ptc/src/{ptc,ptc-calls,config}.ts + dsh-ptc-runtime(-node) + RUN_CODE_NAME + requirePtcRuntime + PtcBindingFunction',
      file: '.archify/deepseek-session-src/ptc-executor__ptc.ts',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: '7a94324b',
      measured:
        '实测 ptc.ts 776 行:run_code 工具(TS/Python 双 flavor)+ runtime.timeout / sandboxMode 控制参数 + escalationGuidance(整程序一次提权、嵌套工具保留自身策略、程序永不自动重放)+ jsonNormalizeArgs(双 snapshot 解耦 dispatch 与日志);requirePtcRuntime 拒绝缺 provider 与未注册语言;对照 IHUI 仅 tool-executor-native 单调用,无程序化批调',
    },
  },
  {
    id: 'acp-agent-protocol',
    name: 'ACP Agent 客户端协议(跨进程 subagent,JSON-RPC stdio)',
    category: 'mcp',
    source: 'deepseek',
    icon: Cable,
    summary:
      '经标准 ACP(Agent Client Protocol)自动化持久 agent:创建/恢复会话、选模型与推理档、挂 MCP server、提交/取消任务、收语义更新、独立关闭会话;面向 out-of-process subagent、测试 runner、脚本控制器。IHUI 无跨进程 agent 客户端协议 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/routers/(补 ACP stdio server)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) @agentclientprotocol/sdk/dist/{acp,connection,jsonrpc,protocol-router,server-sse,http-stream,ws-server}.js + v2/schema + dsh-acp(--profile acp) + dsh-subagent-acp',
      file: '.archify/deepseek-session-src/acp__README.md',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'f72402f2',
      measured:
        '实测 dsh-acp README 13553 字符 + asar 内嵌完整 @agentclientprotocol/sdk(dist 含 connection/jsonrpc/protocol-router/server-sse/http-stream/ws-server/stream/node-adapter + v2 schema);pnpm dsh --profile acp 起 JSON-RPC stdio server,dsh-subagent-acp 为仓库客户端;支持 listing/resume/close 跨进程重启;刻意省略 DSH 专有呈现数据与交互 UI;对照 IHUI agent-runtime-stream 仅单进程 SSE,无跨进程 agent 协议',
    },
  },
  {
    id: 'token-meter-replay-aware',
    name: '重放感知 token 计量 ctx.tokenMeter(provider 分桶 + 上下文压力)',
    category: 'process-governance',
    source: 'deepseek',
    icon: Layers,
    summary:
      '重放持久会话日志估算请求/上下文压力或单条消息定价,确定性且不调模型,使 compaction/占用显示/遥测共享同一结果;provider 上报 usage 仅在请求信封完全一致时复用;reasoning 输出跨桶去重。IHUI token_baseline.py/turn_token_usage.py 无重放感知 + 分桶去重 —— 真缺。',
    maturity: 'A',
    target: 'apps/ai-service/app/core/token_baseline.py(补重放感知计量 + 分桶去重)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-token-meter/src/index.ts(296 行):usageTokens(input+cacheRead+cacheWrite,去 reasoning) + contextBreakdown/contextPressure/tokenUsage 三投影 + surface-fold + route-pricing + ReplayState(consumedEvents/anchorHeader)',
      file: '.archify/deepseek-session-src/token-meter__index.ts',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: '9c9fd53d',
      measured:
        '实测 index.ts 296 行 + README 16068 字符:replay session log 派生 tokenUsage/contextPressure/contextBreakdown 三投影,确定性无模型调用;usageTokens=input+cacheRead+cacheWrite 且 reasoning 输出跨桶去重(避免重复计费);provider usage 仅同请求信封复用;ReplayState 含 consumedEvents/anchorHeader/anchorNodes 支持断点重放;文本/无图路由用固定启发式、声明式视觉定价优先;对照 IHUI token_baseline.py 无重放、无 provider 分桶去重',
    },
  },
  {
    id: 'computer-use-registry',
    name: 'computer-use 单驱动注册表(原生 CUA + Cua Driver)',
    category: 'agent-runtime',
    source: 'deepseek',
    icon: Cpu,
    summary:
      '单驱动一次一个 computer-use provider:加载第二个 provider 报已注册名失败;原生 CUA 与 Cua Driver 适配器共用此注册表,各 provider 自带工具与桌面操作。IHUI desktop 端无 computer-use provider 注册表 —— 真缺。',
    maturity: 'C',
    target: '(借鉴) apps/desktop computer-use provider 注册表',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-computer-use/README.md + dsh-cua(-bundle) + dsh-cua-bundle/docs/DETAIL.md(原生 macOS Notes 演示)',
      file: '.archify/deepseek-session-src/computer-use__README.md',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: '3f87137d',
      measured:
        '实测 dsh-computer-use README 3522 字符:单 provider 一次启用,加载第二个失败报已注册名;原生 CUA + Cua Driver 共用注册表,各带工具与桌面操作;服务无配置、加模型可见工具、不协调并发 Session;配套 dsh-cua + dsh-cua-bundle(DETAIL.md 含 macOS Notes 实操演示);仅借鉴注册表模式,IHUI desktop 计算机操作尚无此层',
    },
  },
  {
    id: 'qoder-mcp-stack',
    name: 'MCP 协议栈全家桶(hono + SDK server/client/core)',
    category: 'mcp',
    source: 'qoder',
    icon: Server,
    summary:
      'asar 内嵌完整 MCP SDK(sdk/server/client/core 近 900 文件)+ hono web 框架 + node-pty 终端 + mammoth/pdfjs 文档处理;主 chunk 为 obfuscator.io 字符串数组混淆但 import 签名清晰可读。IHUI 已有 mcp 基座,可对照其 server/client 拓扑。',
    maturity: 'C',
    target: '(借鉴) apps/ai-service MCP server/client 拓扑',
    evidence: {
      program: 'qoder',
      probe:
        'ev_d8163ce3 (js_app_map) 637 src / 37 endpoint / 154 route / 8 window;node_modules @modelcontextprotocol/{sdk,server,client,core} + hono + node-pty + mammoth + pdfjs-dist',
      file: 'G:\\Qoder CN\\resources\\app.asar',
      version: '0.5.6',
      sha8: '47862150',
      measured:
        '实测 6448 文件(4513 node_modules + 1934 out):主 chunk C3VLoyTK.js 431KB 为 obfuscator.io 字符串数组混淆(非 V8 字节码,import 节点清晰可读);node_modules 暴露 @modelcontextprotocol/sdk 397 + server 271 + client 269 + core 235(合计约 1172 MCP 文件)+ hono 376(web 框架)+ node-pty 83(伪终端)+ mammoth 75/docx + pdfjs-dist 380/PDF;562 个清晰依赖文件已提取归档到 .archify(本条 probe 为 ev_d8163ce3 现场取证)',
    },
  },
  {
    id: 'sandbox-failure-attribution',
    name: '沙箱失败跨后端归因表(denial 方言 + exit-gate 防误判)',
    category: 'sandbox-fs',
    source: 'deepseek',
    icon: ShieldCheck,
    summary:
      '把一条受限命令的 (exit_code, stderr) 归因为 denied/runner_fatal/business_failure/oom 四态:每后端一套否认方言(bwrap read-only fs / seatbelt operation not permitted / windows-acl access denied),runner 自身致命规则带退出码 gate(防"命令仅打印签名"被误判成"没跑起来"),各后端声明执行完整性(bwrap/seatbelt=full, windows-acl=partial 因 NTFS 硬链接别名+读不设限,landlock 经 probe 定 full/partial)。IHUI os_sandbox.py 1831 行仅靠 exit code + 一处 MemoryError 字符串判断,退出码非 0 无法区分"被沙箱拒"vs"launcher 崩"vs"业务失败" —— 真缺,已复现 sandbox_failure_classifier.py(17 测试全过)。',
    maturity: 'A',
    target:
      'apps/ai-service/app/core/sandbox_failure_classifier.py(已复现,classify_sandbox_failure 纯函数)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-sandbox-local/index.ts DENIAL_SIGNATURES(:220-231,4 后端方言)+ RUNNER_FAILURE_RULES(:245-256,exit-gate 127/125)+ STATIC_ENFORCEMENT(:201-206,bwrap/seatbelt=full windows-acl=partial);防误判契约 :237-240 "a confined command that merely PRINTS the signature is never misclassified as the command did not run"',
      file: '.archify/deepseek-agent-core-src/dsh-sandbox-local__index.js',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'db087d40',
      measured:
        '实测 DENIAL_SIGNATURES 四后端方言 + RUNNER_FAILURE_RULES(windows_acl exit-127 / landlock exit-125 informational 行)/ STATIC_ENFORCEMENT 三档;复现 sandbox_failure_classifier.py classify_sandbox_failure 纯函数(不 spawn,四态+exit-gate+enforcement),test_sandbox_failure_classifier.py 17 测试(pytest .venv 实跑 17 passed)覆盖 bwrap/seatbelt/windows-acl denied、windows_acl runner_fatal exit-gated、landlock informational 降级 denied、exit-gate 防误判、probe 覆盖静态 enforcement',
    },
  },
  {
    id: 'plugin-host-vm-sandbox',
    name: '双半插件宿主运行时(node:vm 沙箱 + 扣留 API 重定向)',
    category: 'plugin',
    source: 'deepseek',
    icon: Puzzle,
    summary:
      "动态包 host half 源码在全新 node:vm realm 求值:故意扣留 require/fetch/计时器(调用即抛带 cordis 服务重定向指引:inject['fs']/['web']/['bash']),只保留 tagged console/harness 注册对/编码原语;vm timeout 只限同步段(async 逃逸是接受的信任立场);跨 realm SyntaxError 判定必须用 error.name 而非 instanceof(vm 在沙箱 realm 构造错误,宿主 instanceof 静默 false)。定位:架构件(权威 gap-matrix §12 判「不复制」——IHUI 服务进程内组合,单机插件调试面不适配多租户平台),复现其沙箱边界以供借鉴 + 借扣留表/跨 realm 判定两处通用安全机制。已复现 plugin_host_vm_sandbox.py(13 测试)。",
    maturity: 'C',
    target: '(借鉴) apps/ai-service/app/core/plugin_host_vm_sandbox.py(沙箱构造 + 失败归类纯函数)',
    evidence: {
      program: 'deepseek',
      probe:
        'ev_db087d40 (js_app_map DSH 0.2.2-rc.2) dsh-cordis-host-runner/index.js(104837 字节)node:vm import(:510) + createSandbox(:48995,扣留表注入) + NODE_API_REDIRECTS(7 API 重定向) + isSyntaxError realm-safe 判定(:49657) + evaluateHostCode(:54214,timeout 仅同步段 + isPlugin 检查 :92236)',
      file: '.archify/deepseek-agent-core-src/dsh-cordis-host-runner__index.js',
      version: 'dsh-desktop 0.2.2-rc.2',
      sha8: 'db087d40',
      measured:
        "实测 createSandbox 构造(nodeApiTraps + taggedConsole + harness 注册对 + btoa/atob/TextEncoder/TextDecoder + patchDualRealmInstanceof);NODE_API_REDIRECTS 表:require → cordis fs/web/bash 服务 + inject 数组,fetch → ctx.web,计时器 → TIMER_REDIRECT(禁 async 延迟);vm timeout 信任立场如实声明;isSyntaxError 用 error.name === 'SyntaxError'(realm 安全);复现 plugin_host_vm_sandbox.py(test_plugin_host_vm_sandbox.py 13 passed:扣留表完整性、require/fetch 重定向、跨 realm instanceof、四态失败归类、plugin 形状守卫、sync timeout caveat)",
    },
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
