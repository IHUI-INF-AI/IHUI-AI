// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设备执行器守护(G2,2026-11-25)。
 *
 * 职责边界:认领任务 → 在本机工作区跑 AgentCore → 把过程写回会话消息 → 报终态。
 * 不做的事:不解析"该干什么"(那是 payload.prompt)、不自选工作区(白名单查表)、
 * 不代用户放宽危险动作(无人可问一律 fail-closed)。
 *
 * 为什么复用 AgentCore 而不是另造执行循环:它已经带齐工具层、权限模式、危险动作审计门
 * 与上下文压缩;第二套循环必然在"权限判定/工具结果裁剪"上漂移,而这两处正是安全面。
 *
 * 跨端可见的实现:**每批 token/工具行都写进会话里那条 assistant 消息**,不是另发任务日志。
 * 手机/网页/桌面看到的因此是同一份内容(chat-sync 的 rev 契约,由服务端统一分配)。
 */
import { statSync, appendFileSync, renameSync, existsSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import {
  deviceClaimNextTask,
  deviceHeartbeat,
  deviceTaskAttach,
  deviceTaskComplete,
  deviceTaskFail,
  deviceTaskLease,
  deviceTaskRequestApproval,
  deviceTaskStream,
  type DeviceTaskRow,
} from '@ihui/api-client'
import type { DeviceTaskExecutionPayload, DeviceTaskProgress } from '@ihui/types'
import { createDeviceExecutionTracker } from '@ihui/shared/chat'
import { AgentCore } from '../server/agent-core.js'
import type { PermissionMode } from '../tools/permissions.js'
import { deviceLogPath, resolveWorkspacePath } from './credential.js'
import {
  captureWorkspaceDiff,
  revertWorkspaceChanges,
  snapshotWorkspace,
  type WorkspaceSnapshot,
} from './workspace-diff.js'

export interface DeviceRunnerConfig {
  apiUrl: string
  deviceId: string
  deviceToken: string
  fingerprint: string
  workspaces: Record<string, string>
  model: string
  apiKey: string
  permissionMode?: PermissionMode
  pollIntervalMs?: number
  heartbeatIntervalMs?: number
  maxIterations?: number
  /** 令牌续期回调(heartbeat 会回发新令牌,调用方负责持久化) */
  onTokenRotated?: (token: string) => void
  /** 日志出口(缺省写 ~/.ihui/device.log + stderr) */
  log?: (line: string) => void
}

export interface DeviceRunnerHandle {
  stop: () => void
  done: Promise<void>
}

const LOG_MAX_BYTES = 5 * 1024 * 1024

function defaultLog(line: string): void {
  const stamped = `[${new Date().toISOString()}] ${line}`
  try {
    const path = deviceLogPath()
    if (existsSync(path) && statSync(path).size > LOG_MAX_BYTES) {
      renameSync(path, `${path}.1`)
    }
    appendFileSync(path, `${stamped}\n`, 'utf8')
  } catch {
    /* 日志失败不阻断执行;stderr 仍可见 */
  }
  process.stderr.write(`${stamped}\n`)
}

function nowIso(): string {
  return new Date().toISOString()
}

function progressOf(
  stage: DeviceTaskProgress['stage'],
  percent: number,
  extra?: Pick<DeviceTaskProgress, 'iteration' | 'lastEvent'>,
): DeviceTaskProgress {
  return { stage, percent, updatedAt: nowIso(), ...extra }
}

function oneLine(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/**
 * 把 Agent 事件摊平成会话正文 + 执行面。
 *
 * 对标 TRAE 的跨端任务视图:手机/网页/桌面看到的是与云端会话同构的工具卡、终端卡,
 * 而不是「· read_file {...}」这样的纯文本日志。正文只放模型的自然语言输出;
 * 工具活动走结构化执行面(CLI 折叠 → API 落 metadata + 广播 → 三端卡片渲染)。
 */
function createStreamer(deviceToken: string, taskId: string, log: (line: string) => void) {
  let full = ''
  let sent = 0
  let flushing = false
  let pending = false
  let lastFlushAt = 0
  let progress = progressOf('thinking', 5)
  const execution = createDeviceExecutionTracker()
  let activityVersion = 0
  let sentActivityVersion = 0

  const executionPayload = (): {
    toolCalls?: ReturnType<typeof execution.snapshot>['toolCalls']
    terminalTasks?: ReturnType<typeof execution.snapshot>['terminalTasks']
  } => {
    if (activityVersion === sentActivityVersion) return {}
    const snap = execution.snapshot()
    return {
      ...(snap.toolCalls.length > 0 ? { toolCalls: snap.toolCalls } : {}),
      ...(snap.terminalTasks.length > 0 ? { terminalTasks: snap.terminalTasks } : {}),
    }
  }

  async function push(force: boolean): Promise<void> {
    if (flushing) {
      pending = true
      return
    }
    const chunk = full.slice(sent)
    const needsActivity = activityVersion !== sentActivityVersion
    if (!chunk && !needsActivity) return
    if (!force && chunk.length < 200 && !needsActivity && Date.now() - lastFlushAt < 800) return
    flushing = true
    const versionAtSend = activityVersion
    try {
      if (chunk) {
        const res = await deviceTaskStream(deviceToken, taskId, {
          kind: 'delta',
          textDelta: chunk,
          progress,
          ...executionPayload(),
        })
        if (res.success) {
          sent = full.length
          sentActivityVersion = versionAtSend
        } else {
          // delta 失败(网络/状态冲突)→ 用全量快照重发:宁可重复一段,也不留半截
          const snap = await deviceTaskStream(deviceToken, taskId, {
            kind: 'snapshot',
            content: full,
            progress,
            ...executionPayload(),
          })
          if (snap.success) {
            sent = full.length
            sentActivityVersion = versionAtSend
          } else log(`stream 上报失败:${res.error ?? snap.error ?? '未知错误'}`)
        }
      } else {
        // 没有新正文、只有执行面变化:发快照,避免工具卡停在 running 直到下段文字
        const res = await deviceTaskStream(deviceToken, taskId, {
          kind: 'snapshot',
          content: full,
          progress,
          ...executionPayload(),
        })
        if (res.success) sentActivityVersion = versionAtSend
        else log(`stream 上报失败:${res.error ?? '未知错误'}`)
      }
      lastFlushAt = Date.now()
    } catch (e) {
      log(`stream 异常:${e instanceof Error ? e.message : String(e)}`)
    } finally {
      flushing = false
      if (pending) {
        pending = false
        void push(true)
      }
    }
  }

  return {
    onEvent(evt: {
      type: string
      text?: string
      name?: string
      args?: Record<string, unknown>
      success?: boolean
      output?: string
      count?: number
      max?: number
      message?: string
    }): void {
      if (evt.type === 'token' && typeof evt.text === 'string') {
        full += evt.text
        progress = progressOf('streaming', 60)
        void push(false)
        return
      }
      if (evt.type === 'tool_call' && typeof evt.name === 'string') {
        execution.onToolCall(evt.name, evt.args ?? {})
        activityVersion += 1
        progress = progressOf('tool', 35, { lastEvent: evt.name })
        void push(true)
        return
      }
      if (evt.type === 'tool_result' && typeof evt.name === 'string') {
        execution.onToolResult(evt.name, evt.success === true, evt.output)
        activityVersion += 1
        progress = progressOf('streaming', 60)
        void push(true)
        return
      }
      if (evt.type === 'iteration' && typeof evt.count === 'number') {
        progress = progressOf('thinking', 20, {
          iteration: evt.count,
          ...(typeof evt.max === 'number' ? { lastEvent: `第 ${evt.count}/${evt.max} 轮` } : {}),
        })
        return
      }
      if (evt.type === 'error' && typeof evt.message === 'string') {
        full += `\n\n执行错误:${evt.message}\n`
        progress = progressOf('failed', 0, { lastEvent: oneLine(evt.message, 200) })
        void push(true)
      }
    },
    finalize: () => push(true),
    progress: () => progress,
    text: () => full,
  }
}

type ApprovalVerdict = 'approved' | 'rejected' | 'cancelled' | 'timeout'

interface ApprovalWaitResult {
  verdict: ApprovalVerdict
  /**
   * G4:kind=diff 的逐文件裁决。**undefined 与 [] 不同**:
   * undefined = 人没给逐文件清单(批准即全收、拒绝即全退);
   * [] = 一个都不收。执行端据此决定回退范围,不能把两者折成一个。
   */
  acceptedPaths?: string[]
}

/**
 * 原地等审批(G3,2026-11-26;G4 扩到 diff)。
 * 每 5s 走一次租约:既续租(防服务端把任务判超时),又读人的决定与取消意图。
 * 默认 30 分钟封顶 —— 设备是串行执行的,一条没人管的任务挂着等于整条队列全堵;
 * 超时如实报 failed(人可以重排),而不是假装还在跑。
 */
async function waitForApproval(
  token: string,
  taskId: string,
  progress: DeviceTaskProgress,
  log: (line: string) => void,
  onCancel: () => void,
  maxMs = 30 * 60_000,
): Promise<ApprovalWaitResult> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const res = await deviceTaskLease(token, taskId, progress)
      if (res.success && res.data) {
        if (res.data.cancel_requested) {
          onCancel()
          return { verdict: 'cancelled' }
        }
        const accepted = Array.isArray(res.data.approval_accepted_paths)
          ? res.data.approval_accepted_paths
          : undefined
        if (res.data.approval_decision === 'approved') {
          return accepted === undefined
            ? { verdict: 'approved' }
            : { verdict: 'approved', acceptedPaths: accepted }
        }
        if (res.data.approval_decision === 'rejected') return { verdict: 'rejected' }
      }
    } catch (e) {
      log(`等审批心跳异常:${e instanceof Error ? e.message : String(e)}`)
    }
    await delay(5000)
  }
  return { verdict: 'timeout' }
}

/** 执行单个任务。返回后调用方继续 claim。 */
async function executeTask(
  cfg: DeviceRunnerConfig,
  token: string,
  task: DeviceTaskRow,
  log: (line: string) => void,
): Promise<void> {
  const payload = task.payload as DeviceTaskExecutionPayload | null
  if (!payload || typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    log(`任务 ${task.id} 缺少可执行载荷,拒绝执行`)
    await deviceTaskFail(token, task.id, '任务缺少执行载荷(服务端未填 prompt)')
    return
  }

  let workspacePath: string
  try {
    workspacePath = resolveWorkspacePath(cfg, payload.workspace)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log(`任务 ${task.id} 工作区被拒:${message}`)
    await deviceTaskFail(token, task.id, message)
    return
  }

  log(`认领任务 ${task.id} → ${workspacePath}`)

  // G4:改动审查要的判据是"跑之前长什么样",必须在 agent 动第一下之前取。
  // plan 档不启用(它的审批位要留给"批方案",同一任务不设两次审批)。
  const reviewEnabled = payload.reviewDiff === true && payload.mode !== 'plan'
  const snapshot: WorkspaceSnapshot | null = reviewEnabled ? snapshotWorkspace(workspacePath) : null
  if (snapshot && !snapshot.repoRoot) {
    log(`任务 ${task.id} 要求改动审查,但工作区不是 git 仓库 → 本轮只能跑,抓不到 diff`)
  }

  const attach = await deviceTaskAttach(token, task.id)
  if (!attach.success || !attach.data) {
    log(`attach 失败:${attach.error ?? '未知错误'}`)
    await deviceTaskFail(token, task.id, `会话消息落点创建失败:${attach.error ?? '未知'}`)
    return
  }

  const streamer = createStreamer(token, task.id, log)

  // 执行模式:plan 只出方案;其余一律 default(危险动作无人可问 ⇒ fail-closed)。
  // autoApprove 只放宽到 acceptEdits(只读工具免批),**不**开 bypassPermissions ——
  // 手机上勾一个开关就给任意命令全权,与本项目"国安级"约束相悖。
  const permissionMode: PermissionMode =
    payload.mode === 'plan' ? 'plan' : payload.autoApprove ? 'acceptEdits' : cfg.permissionMode ?? 'default'

  const model = payload.model && payload.model.trim() ? payload.model.trim() : cfg.model
  const core = new AgentCore({
    workspacePath,
    model,
    apiUrl: cfg.apiUrl,
    apiKey: cfg.apiKey,
    maxIterations: cfg.maxIterations ?? 30,
    permissionMode,
    enableMcp: true,
    allowDangerous: false,
  })

  const controller = new AbortController()
  let cancelled = false

  // 租约轮询:既是心跳(防服务端把任务判超时),也是取消意图的读点。
  const leaseTimer = setInterval(() => {
    void (async () => {
      try {
        const res = await deviceTaskLease(token, task.id, streamer.progress())
        if (res.success && res.data?.cancel_requested) {
          cancelled = true
          controller.abort()
        }
      } catch {
        /* 网络抖动:下一次继续,不在这里中止执行 */
      }
    })()
  }, 15_000)

  let finalPermissionMode: PermissionMode = permissionMode
  try {
    let result = await core.sendMessage(
      payload.prompt,
      (evt) => streamer.onEvent(evt),
      { signal: controller.signal },
    )

    // G3(2026-11-26):plan 档出完方案会以 plan_approval_required 停住 ——
    // 这不是"完成",是"等你点头"。把消息指针交上服务端,原地续租等人批;
    // 批了用同一会话以 acceptEdits 接着跑,拒了如实收口。
    if (result.stopReason === 'plan_approval_required' && !cancelled) {
      await streamer.finalize()
      const plan = streamer.text().trim()
      const asked = await deviceTaskRequestApproval(token, task.id, {
        preview: plan || '执行端未产出计划正文',
        // 消息指针是服务端读回计划正文的唯一入口(api-client 回包是 snake_case)
        ...(attach.success && attach.data?.message_id
          ? { messageId: attach.data.message_id }
          : {}),
        iterations: result.iterations,
      })
      if (!asked.success) {
        log(`审批请求上报失败:${asked.error ?? '未知错误'}`)
        await deviceTaskFail(token, task.id, `审批请求上报失败:${asked.error ?? '未知'}`)
        return
      }
      log(`任务 ${task.id} 出完方案(${plan.length} 字),等你批准`)
      const { verdict } = await waitForApproval(
        token,
        task.id,
        progressOf('awaiting_approval', 60, { lastEvent: '等待你批准计划' }),
        log,
        () => {
          cancelled = true
          controller.abort()
        },
      )
      if (verdict === 'cancelled') {
        log(`任务 ${task.id} 等审批时被取消`)
        await deviceTaskFail(token, task.id, '用户已取消', null, progressOf('cancelled', 0))
        return
      }
      if (verdict === 'timeout') {
        log(`任务 ${task.id} 等审批超时`)
        await deviceTaskFail(token, task.id, '等待审批超时(30 分钟内无人批准)', null, {
          stage: 'failed',
          percent: 0,
          lastEvent: '等待审批超时',
          updatedAt: nowIso(),
        } satisfies DeviceTaskProgress)
        return
      }
      if (verdict === 'rejected') {
        log(`任务 ${task.id} 的计划被拒绝`)
        await deviceTaskFail(token, task.id, '用户拒绝了这个计划', null, {
          stage: 'cancelled',
          percent: 0,
          lastEvent: '计划被拒绝',
          updatedAt: nowIso(),
        } satisfies DeviceTaskProgress)
        return
      }

      // 计划已批 ⇒ 后续编辑类动作不必逐条追问;仍不开 bypassPermissions(危险动作照旧 fail-closed)。
      finalPermissionMode = 'acceptEdits'
      const resumed = new AgentCore({
        workspacePath,
        model,
        apiUrl: cfg.apiUrl,
        apiKey: cfg.apiKey,
        maxIterations: cfg.maxIterations ?? 30,
        permissionMode: finalPermissionMode,
        enableMcp: true,
        allowDangerous: false,
      })
      streamer.onEvent({ type: 'token', text: '\n\n— 计划已获批准,继续执行 —\n\n' })
      result = await resumed.sendMessage(
        '计划已获批准,请按上面的计划继续执行。',
        (evt) => streamer.onEvent(evt),
        { signal: controller.signal, sessionId: result.sessionId },
      )
    }

    // G4(2026-11-28):execute 档跑完先把文件级改动交上来,人逐文件收下/回退。
    // 不可回退的文件(执行前就脏)只展示、不参与回退 —— 见 workspace-diff.ts 的判据。
    let reviewInfo: Record<string, unknown> | undefined
    if (reviewEnabled && snapshot && !cancelled) {
      if (!snapshot.repoRoot) {
        streamer.onEvent({
          type: 'token',
          text: '\n\n— 工作区不是 git 仓库,本轮无法抓取改动 —\n',
        })
      } else {
        const diff = captureWorkspaceDiff(workspacePath, snapshot)
        if (!diff) {
          log(`任务 ${task.id} 结束后工作区没有可审改动`)
        } else {
          const head = `${diff.files.length} 个文件 (+${diff.additions} −${diff.deletions})${diff.truncated ? ',仅列前 80 个' : ''}`
          streamer.onEvent({ type: 'token', text: `\n\n— 改动待审阅:${head} —\n` })
          await streamer.finalize()
          const asked = await deviceTaskRequestApproval(token, task.id, {
            preview: `改动 ${head}`,
            ...(attach.success && attach.data?.message_id
              ? { messageId: attach.data.message_id }
              : {}),
            diff,
          })
          if (!asked.success) {
            log(`改动审批上报失败:${asked.error ?? '未知错误'}`)
            // 报不上审批 = 人看不到改动;此时把改动全部回退,不把"没审过的改动"留在工作区。
            const rolled = revertWorkspaceChanges(workspacePath, snapshot, diff.files, [])
            await deviceTaskFail(
              token,
              task.id,
              `改动审批上报失败:${asked.error ?? '未知'}(已回退 ${rolled.reverted.length} 个文件)`,
            )
            return
          }
          log(`任务 ${task.id} 跑完,改动 ${head},等你审阅`)
          const wait = await waitForApproval(
            token,
            task.id,
            progressOf('awaiting_approval', 90, { lastEvent: '等待你审阅改动' }),
            log,
            () => {
              cancelled = true
              controller.abort()
            },
          )

          const finishReview = async (
            keepPaths: string[] | undefined,
            note: string,
          ): Promise<void> => {
            const outcome = revertWorkspaceChanges(workspacePath, snapshot, diff.files, keepPaths)
            const kept = keepPaths === undefined ? diff.files.length : keepPaths.length
            const skippedNote =
              outcome.skipped.length > 0
                ? `;${outcome.skipped.length} 个文件保留原状(执行前已有未提交改动)`
                : ''
            streamer.onEvent({
              type: 'token',
              text: `\n${note}(收下 ${kept} 个,回退 ${outcome.reverted.length} 个${skippedNote})\n`,
            })
            await streamer.finalize()
            reviewInfo = {
              files: diff.files.length,
              kept,
              reverted: outcome.reverted.length,
              skipped: outcome.skipped.length,
            }
          }

          if (wait.verdict === 'cancelled') {
            await finishReview([], '任务已取消,改动已回退')
            log(`任务 ${task.id} 审阅改动时被取消`)
            await deviceTaskFail(token, task.id, '用户已取消', null, progressOf('cancelled', 0))
            return
          }
          if (wait.verdict === 'timeout') {
            await finishReview([], '审阅超时,改动已回退')
            log(`任务 ${task.id} 等改动审阅超时`)
            await deviceTaskFail(token, task.id, '等待改动审阅超时(30 分钟),改动已回退', null, {
              stage: 'failed',
              percent: 0,
              lastEvent: '等待改动审阅超时',
              updatedAt: nowIso(),
            } satisfies DeviceTaskProgress)
            return
          }
          if (wait.verdict === 'rejected') {
            await finishReview([], '改动已退回')
            log(`任务 ${task.id} 的改动被退回`)
            await deviceTaskFail(token, task.id, '用户退回了这些改动(已回退)', null, {
              stage: 'cancelled',
              percent: 0,
              lastEvent: '改动被退回',
              updatedAt: nowIso(),
            } satisfies DeviceTaskProgress)
            return
          }
          // approved:accceptedPaths=undefined ⇒ 全收;[] ⇒ 一个都不收(全部回退)
          await finishReview(wait.acceptedPaths, '改动已审阅')
        }
      }
    }

    await streamer.finalize()
    await deviceTaskComplete(token, task.id, {
      agent_session_id: result.sessionId,
      stop_reason: result.stopReason,
      iterations: result.iterations,
      usage: result.usage,
      permission_mode: finalPermissionMode,
      ...(reviewInfo ? { review: reviewInfo } : {}),
    })
    log(`任务 ${task.id} 完成(${result.stopReason}, ${result.iterations} 轮)`)
  } catch (e) {
    await streamer.finalize()
    const message = e instanceof Error ? e.message : String(e)
    if (cancelled) {
      log(`任务 ${task.id} 已取消`)
      await deviceTaskFail(token, task.id, '用户已取消', null, progressOf('cancelled', 0))
    } else {
      log(`任务 ${task.id} 失败:${message}`)
      await deviceTaskFail(token, task.id, message.slice(0, 2000), null, streamer.progress())
    }
  } finally {
    clearInterval(leaseTimer)
  }
}

/**
 * 启动守护。返回句柄而不是 Promise-only:调用方要能响应 SIGINT 并等一轮收尾。
 * 串行执行:一个设备同时只跑一个任务 —— 两个 Agent 共写一个工作区会互相踩文件,
 * 而"并发省下的那点时间"远小于用户看到两份交叉 diff 的困惑。
 */
export function startDeviceRunner(cfg: DeviceRunnerConfig): DeviceRunnerHandle {
  const log = cfg.log ?? defaultLog
  const pollMs = cfg.pollIntervalMs ?? 3000
  const heartbeatMs = cfg.heartbeatIntervalMs ?? 30_000
  let token = cfg.deviceToken
  let stopped = false
  let busy = false

  const heartbeatTimer = setInterval(() => {
    void (async () => {
      try {
        const res = await deviceHeartbeat(token)
        if (res.success && res.data?.device_token) {
          token = res.data.device_token
          cfg.onTokenRotated?.(token)
        } else if (!res.success) {
          log(`心跳失败:${res.error ?? '未知错误'}`)
        }
      } catch (e) {
        log(`心跳异常:${e instanceof Error ? e.message : String(e)}`)
      }
    })()
  }, heartbeatMs)

  const done = (async () => {
    log(`设备执行器已启动(${cfg.deviceId.slice(0, 8)}…,轮询 ${pollMs}ms)`)
    while (!stopped) {
      if (!busy) {
        busy = true
        let claimed: DeviceTaskRow | null = null
        try {
          const res = await deviceClaimNextTask(token)
          if (!res.success) {
            log(`认领失败:${res.error ?? '未知错误'}`)
          } else {
            claimed = res.data
          }
        } catch (e) {
          log(`认领异常:${e instanceof Error ? e.message : String(e)}`)
        }
        if (claimed) {
          try {
            await executeTask(cfg, token, claimed, log)
          } catch (e) {
            log(`执行异常:${e instanceof Error ? e.message : String(e)}`)
          }
        }
        busy = false
      }
      await delay(pollMs)
    }
    log('设备执行器已停止')
  })()

  return {
    stop: () => {
      stopped = true
      clearInterval(heartbeatTimer)
    },
    done,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
