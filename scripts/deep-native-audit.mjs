#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deep-native 44 条候选的现状复核器（可复验）
 *
 * 为什么存在：`docs/benchmark-evidence/2026-11/deep-native-2026-11-23/README.md`
 * 的「IHUI 现状」列是 2026-11-23 的读数，取证后并行会话已推进多条（P0-1 / B1-01 /
 * B1-11 等），照旧表排任务会把已完成的当欠账、把真欠账漏掉。本脚本把每条的判据
 * 钉在「文件 + 符号」上，跑一遍给 present / partial / absent 三态，作为排期唯一基线。
 *
 * 纪律（与仓库决策账第四节一致）：
 * - 只看文件存在不算 present，必须命中实现符号；
 * - 一个 probe 命中、另一个不命中 ⇒ partial，不许报 present；
 * - 判据不可达（路径不存在）⇒ absent，不冒绿；
 * - 明确「不建议照搬」的条目（B3-10）记 n/a，不计入欠账。
 *
 * 用法：node scripts/deep-native-audit.mjs [--json]
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/** 遍历仓库内匹配 glob 的文件（只支持 * 与 **，够用且不引依赖） */
function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.venv' || e.name === 'dist') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\u0000/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

/** probe: { path: 相对路径或 glob, pattern?: 内容正则, label: 人话说明 } */
function probe(p) {
  const abs = path.join(ROOT, p.path)
  const hasGlob = p.path.includes('*')
  let files = []
  if (hasGlob) {
    const re = globToRegExp(p.path.replace(/\//g, path.sep))
    files = walk(path.join(ROOT, p.path.split('*')[0].replace(/\/$/, '') || '.'))
      .filter((f) => re.test(path.relative(ROOT, f)))
  } else if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    files = [abs]
  }
  if (files.length === 0) return { hit: false, where: null, label: p.label }

  // 无 pattern：文件存在即命中
  if (!p.pattern) {
    return { hit: true, where: path.relative(ROOT, files[0]), label: p.label }
  }

  const re = new RegExp(p.pattern, 'm')
  for (const f of files) {
    let text
    try {
      text = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const m = re.exec(text)
    if (m) {
      const line = text.slice(0, m.index).split('\n').length
      return { hit: true, where: `${path.relative(ROOT, f)}:${line}`, label: p.label }
    }
  }
  return { hit: false, where: path.relative(ROOT, files[0]), label: p.label }
}

/** 44 条候选。每条 probes 全中 = present；部分 = partial；全不中 = absent。 */
const ENTRIES = [
  // ---- P0 ----
  {
    id: 'P0-1', title: '审批语义收敛（四档 + 拒收 + timeout_ms）',
    probes: [
      { path: 'apps/ai-service/app/services/agent_loop_v2.py', pattern: '_VALID_APPROVAL_POLICIES\\s*=.*deny', label: '四档含 deny' },
      { path: 'apps/ai-service/app/core/patch_safety.py', pattern: 'deny', label: 'patch_safety 拒绝档' },
    ],
  },
  {
    id: 'P0-2', title: '反向守护进程拓扑',
    probes: [
      { path: 'apps/cli/src/**/*.ts', pattern: 'start-daemon|daemon-started|handedOff', label: '握手符号' },
    ],
  },
  {
    id: 'P0-3', title: '跨进程注册表三判据',
    probes: [
      { path: 'apps/cli/src/**/*.ts', pattern: 'isPortOpen|configuredPort|isProcessIdentityCurrent', label: '三判据符号' },
      { path: 'apps/cli/src/daemon/registry.ts', label: 'registry 模块' },
    ],
  },
  {
    id: 'P0-4', title: '沙箱能力探测三态 fail-closed',
    probes: [
      { path: 'apps/desktop/src-tauri/src/**/*.rs', pattern: 'IsSBoxSupported|sbox_supported|SBoxSDK_Init', label: '探测符号' },
    ],
  },
  {
    id: 'P0-5', title: '终态前输出完成闸门（drain）',
    probes: [
      { path: 'apps/ai-service/app/services/output_ring.py', pattern: 'class OutputRing|_SETTLEMENT_STATUSES', label: '有界输出环 + 四态结算' },
      { path: 'apps/desktop/src-tauri/src/terminal_session.rs', pattern: 'drain_complete|output_drain|OutputDrain', label: 'drain 闸门' },
    ],
  },
  {
    id: 'P0-6', title: '沙箱文件规则族（凭据 deny）',
    probes: [
      { path: 'apps/cli/src/sandbox/file-access-policy.ts', pattern: '\\.gnupg', label: '.gnupg 凭据族' },
    ],
  },
  {
    id: 'P0-7', title: '回合前上下文自检钩子',
    probes: [
      { path: 'apps/ai-service/app/services/agent_loop_v2.py', pattern: 'context_self_check|anchor_missing|re_read_required', label: '自检实现（非注释）' },
    ],
  },
  {
    id: 'P0-8', title: '索引完整性审计统计',
    probes: [
      { path: 'apps/api/src/services/codebase-index-service.ts', pattern: 'missing_vector|vector_entity_count|integrity', label: '审计列查询' },
    ],
  },
  // ---- P1 ----
  {
    id: 'B1-06', title: '目标自动续轮竞争裁决',
    probes: [
      { path: 'apps/ai-service/app/services/goal_round_driver.py', label: 'driver 模块' },
      { path: 'apps/ai-service/app/services/**/*.py', pattern: 'competing_queued|competingQueued|valid_reservation', label: '竞争裁决符号' },
    ],
  },
  {
    id: 'B2-02', title: 'IPC 通道安全描述符 / ACL',
    probes: [
      { path: 'apps/desktop/src-tauri/src/**/*.rs', pattern: 'InitIPCInterface2WithSecurityDescriptor|ipc_security_descriptor', label: 'SD 构建符号' },
    ],
  },
  {
    id: 'B2-03', title: 'helper 中继 + 输出 drain 完成判定',
    probes: [
      { path: 'apps/desktop/src-tauri/src/terminal_session.rs', pattern: 'helper_relay|drain', label: '中继/drain' },
    ],
  },
  {
    id: 'B2-04', title: '分级看门狗重连',
    probes: [
      { path: 'apps/ai-service/app/services/connection_watcher.py', label: 'watcher 模块' },
    ],
  },
  {
    id: 'B2-05', title: '命令级 timeout_ms 入参',
    probes: [
      { path: 'apps/ai-service/app/routers/agent_runtime.py', pattern: 'timeout_ms', label: 'timeout_ms 入参' },
    ],
  },
  {
    id: 'B3-01', title: '浏览器桥 native host',
    probes: [
      { path: 'apps/desktop/src-tauri/src/native_connector_host.rs', label: 'host 模块' },
      { path: 'apps/desktop/src-tauri/src/**/*.rs', pattern: 'connect_native|connectNative|allowed_origins', label: 'host 侧判据' },
    ],
  },
  {
    id: 'B3-02', title: '进程组判活与整组回收',
    probes: [
      { path: 'apps/cli/src/**/*.ts', pattern: 'pgid|lstart|kill\\(-', label: '组判据符号' },
    ],
  },
  {
    id: 'B3-03', title: '协作 CLI 身份三档 + 退出码契约',
    probes: [
      { path: 'apps/cli/src/commands/collab/exit-codes.ts', pattern: 'EXIT|exit', label: '协作退出码契约' },
      { path: 'apps/cli/src/commands/collab/identity.ts', pattern: 'RuntimeOwner|nextOffset', label: '身份三档/部分结果' },
    ],
  },
  {
    id: 'B3-04', title: '系统提交内存 OOM 预判',
    probes: [
      { path: 'apps/desktop/src-tauri/src/system_memory.rs', label: '内存模块' },
      { path: 'apps/desktop/src-tauri/src/system_memory.rs', pattern: 'total_commit_bytes|avail_commit_bytes', label: 'commit charge 符号' },
    ],
  },
  {
    id: 'B4-02', title: '父子 env 白名单透传集',
    probes: [
      { path: 'apps/cli/src/sandbox/env-channel.ts', label: 'env-channel 模块' },
      { path: 'apps/cli/src/sandbox/env-guard.ts', pattern: 'EnvRoute|ROUTES|checkEnvKey', label: 'env 路由白名单集' },
    ],
  },
  {
    id: 'B4-05', title: '更新后优雅自重启状态机',
    probes: [
      { path: 'apps/cli/src/daemon/auto-restart.ts', label: 'auto-restart 模块' },
      { path: 'apps/cli/src/**/*.ts', pattern: 'pendingRestart|restartInFlight|DAEMON_RESTART_REFUSED', label: '状态机符号' },
    ],
  },
  {
    id: 'B4-07', title: '网络边界双引擎',
    probes: [
      { path: 'apps/cli/src/sandbox/egress/**/*.ts', pattern: 'LocalProxy|tcp_decide|tcpDecide', label: 'TCP 决策载体' },
    ],
  },
  // ---- P2 ----
  {
    id: 'B1-01', title: '工具超时结构化结果码',
    probes: [
      { path: 'apps/ai-service/app/core/tool_timeout_result.py', pattern: 'TOOL_TIMEOUT_CODE', label: '结果码常量' },
    ],
  },
  {
    id: 'B1-03', title: '重复调用分级 advisory',
    probes: [
      { path: 'apps/ai-service/app/core/repeat_call_reminder.py', label: 'reminder 模块' },
    ],
  },
  {
    id: 'B1-05', title: '沙箱三级策略 + 会话级可写根',
    probes: [
      { path: 'apps/ai-service/app/services/sandbox.py', pattern: 'extra_writable|session_writable|session.*root', label: '会话级可写根' },
    ],
  },
  {
    id: 'B1-07', title: 'LLM 重试 provider 路由 + retryId',
    probes: [
      { path: 'apps/ai-service/app/**/*.py', pattern: 'retry_id|retryId', label: 'retryId 持久化' },
    ],
  },
  {
    id: 'B1-08', title: '工作区变更盘上快照兜底',
    probes: [
      { path: 'apps/ai-service/app/services/workspace_changes_service.py', label: '盘上快照模块' },
    ],
  },
  {
    id: 'B1-09', title: '子代理 fork/spawn 双后端',
    probes: [
      { path: 'apps/ai-service/app/services/subagent_backends.py', label: '后端模块' },
    ],
  },
  {
    id: 'B1-10', title: '输出留存原语',
    probes: [
      { path: 'apps/ai-service/app/services/spill_retention.py', label: '留存模块（实测在此）' },
      { path: 'apps/ai-service/app/services/spill_retention.py', pattern: 'omit|OMIT', label: 'omit 三态' },
    ],
  },
  {
    id: 'B1-11', title: 'OTel 事件/会话日志双通道',
    probes: [
      { path: 'apps/ai-service/app/services/otel_log_channels.py', pattern: 'class BatchPlan', label: '批计划' },
      { path: 'apps/ai-service/app/telemetry.py', pattern: '_log_provider', label: '日志通道腿' },
    ],
  },
  {
    id: 'B2-07', title: '常驻原生模块统一 ABI',
    probes: [
      { path: 'apps/desktop/src-tauri/src/native_plugin_abi.rs', label: 'ABI 模块' },
    ],
  },
  {
    id: 'B2-08', title: 'ContextFS 动词面',
    probes: [
      { path: 'apps/ai-service/app/core/context_fs.py', pattern: 'def .*verb|def ls|def cat|def glob', label: '动词处理器' },
    ],
  },
  {
    id: 'B2-10', title: '沙箱生命周期埋点',
    probes: [
      { path: 'apps/desktop/src-tauri/src/sandbox_metrics.rs', label: '埋点模块' },
    ],
  },
  {
    id: 'B2-11', title: '会话快照只读查询面',
    probes: [
      { path: 'apps/ai-service/app/routers/checkpoint_rewind.py', label: '回滚路由（实测在此）' },
      { path: 'apps/ai-service/app/routers/checkpoint_rewind.py', pattern: 'message_id', label: '按 message_id 反查' },
    ],
  },
  {
    id: 'B3-05', title: 'Windows 通知权限状态查询',
    probes: [
      { path: 'apps/desktop/src-tauri/src/notification_permission.rs', label: '权限模块' },
    ],
  },
  {
    id: 'B3-06', title: '剪贴板一次性读取令牌',
    probes: [
      { path: 'apps/desktop/src-tauri/src/**/*.rs', pattern: 'clipboard.*token|ClipboardToken', label: '令牌语义' },
    ],
  },
  {
    id: 'B3-07', title: '请求元数据四层 + Advisor + patches',
    probes: [
      { path: 'apps/api/src/**/*.ts', pattern: 'request_set_id|requestSetId', label: 'request_set 追踪' },
    ],
  },
  {
    id: 'B3-08', title: 'worker 行协议',
    probes: [
      { path: 'apps/cli/src/subagents/worker-protocol.ts', label: '协议模块' },
    ],
  },
  {
    id: 'B3-09', title: 'RTC 音视频原生桥',
    probes: [
      { path: 'apps/desktop/src-tauri/src/rtc_bridge.rs', label: 'RTC 模块' },
    ],
  },
  {
    id: 'B3-10', title: '硬件专用键盘钩子（不建议照搬）',
    na: true,
    probes: [],
  },
  {
    id: 'B4-03', title: '编译态/源码态双 spawn 判据',
    probes: [
      { path: 'apps/cli/src/util/spawn-isolated.ts', label: '双判据模块' },
    ],
  },
  {
    id: 'B4-08', title: '启动画像 span 树',
    probes: [
      { path: 'apps/cli/src/startup/profile.ts', pattern: 'span|concurrent', label: 'span 判据' },
    ],
  },
  {
    id: 'B4-09', title: '低内存 V8 启动档',
    probes: [
      { path: 'apps/cli/**/*.ts', pattern: 'optimize-for-size|max-semi-space-size', label: 'V8 启动档符号' },
    ],
  },
  {
    id: 'B4-10', title: 'lazy chunk manifest 版本防污染',
    probes: [
      { path: 'apps/cli/src/startup/prewarm.ts', pattern: 'manifest|version', label: 'manifest 判据' },
    ],
  },
  {
    id: 'B4-11', title: '崩溃看门狗重启腿',
    probes: [
      { path: 'apps/cli/src/**/*.ts', pattern: 'watchdog_restart|restartBudget|unref\\(\\).*restart', label: '重启腿符号' },
    ],
  },
  {
    id: 'B4-12', title: '会话历史清理按路由意图',
    probes: [
      { path: 'apps/cli/src/commands/**/*.ts', pattern: 'history.*clean|cleanHistory|routeIntent', label: '路由意图判据' },
    ],
  },
]

const results = ENTRIES.map((entry) => {
  if (entry.na) return { id: entry.id, title: entry.title, state: 'n/a', hits: [] }
  const hits = entry.probes.map(probe)
  const hitCount = hits.filter((h) => h.hit).length
  const state = hitCount === entry.probes.length ? 'present' : hitCount > 0 ? 'partial' : 'absent'
  return { id: entry.id, title: entry.title, state, hits }
})

const order = { present: 0, partial: 1, absent: 2, 'n/a': 3 }
results.sort((a, b) => order[a.state] - order[b.state] || a.id.localeCompare(b.id))

const args = process.argv.slice(2)
if (args.includes('--json')) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
} else {
  const width = 16
  for (const r of results) {
    const evidence = r.hits.filter((h) => h.hit).map((h) => `${h.where || ''} (${h.label})`).join(' | ') || '-'
    const missing = r.hits.filter((h) => !h.hit).map((h) => h.label).join(', ')
    let line = `${r.id.padEnd(8)} ${r.state.padEnd(8)} ${r.title}`
    line += `\n         证据: ${evidence}`
    if (missing) line += `\n         未命中: ${missing}`
    console.log(line)
  }
  const counts = results.reduce((acc, r) => ((acc[r.state] = (acc[r.state] || 0) + 1), acc), {})
  console.log('\n=== 汇总 ===')
  console.log(
    `present ${counts.present || 0} / partial ${counts.partial || 0} / absent ${counts.absent || 0} / n/a ${counts['n/a'] || 0} · 合计 ${results.length}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
