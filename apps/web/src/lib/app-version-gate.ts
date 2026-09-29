// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// G-700:app-version 强更策略的 web 消费者(策略声明面此前零消费者)。
//
// 声明面(只读对照,不改):
//   - packages/api-client/src/endpoints/system.ts 的 checkAppVersion(GET /api/app-version/check-update)
//   - apps/api/src/routes/app-version.ts:43 的 forceUpdate(版本发布策略位)
//   - apps/api/src/routes/app-version.ts:89 的 minimumVersion(服务端最低版本闸门,CliMinVersionDecision)
//   - packages/database/src/schema/app-version.ts 的 app_versions.force_update
//
// 六终态机与动作语义照抄上游 zcode packages/desktop/src/main(只读参考,不改它):
//   - autoUpdater.ts:99-105  ForceAutoUpdateState 六终态
//   - autoUpdater.ts:1099-1102  skipAvailableUpdateVersion:强更会话激活 ⇒ skip 侧门直接锁死
//   - autoUpdater.ts:1245-1248  cancelDownloadingUpdate:强更会话激活 ⇒ cancel 侧门直接锁死
//   - forceUpdatePrompt.ts:383-385  isActiveAutoState = checking|downloading|ready|installing
//   - forceUpdatePrompt.ts:386-401/462-464  confirm-close:manual/quit 恒可点,active 态下先二次确认
//
// 服务端同款降级哲学(app-version.ts:67-70):配错/取不到一律 fail-open 不拦,
// 挡住全部用户比旧版本跑新契约更坏;结论带 reason,留痕不静默。

import { checkAppVersion, type VersionCheckResult } from '@ihui/api-client/endpoints/system'

// ==================== 六终态机 ====================

/** 六终态(照抄上游 ForceAutoUpdateState:autoUpdater.ts:99-105)。 */
export type AppVersionGateKind =
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'
  | 'dev-skipped'

/** UI 态 = 六终态 + confirm-close(上游 forceUpdatePrompt.ts:390)+ idle(闸门未接管)。 */
export type AppVersionGateUiState = AppVersionGateKind | 'confirm-close' | 'idle'

/** 强更会话的激活态子集(上游 isActiveAutoState,forceUpdatePrompt.ts:383-385)。 */
export const APP_VERSION_GATE_ACTIVE_KINDS: readonly AppVersionGateKind[] = [
  'checking',
  'downloading',
  'ready',
  'installing',
]

export function isActiveAppVersionGateKind(kind: AppVersionGateUiState): boolean {
  return (APP_VERSION_GATE_ACTIVE_KINDS as readonly string[]).includes(kind)
}

/** 强更弹窗的四个动作:manual/quit 恒可用;skip/cancel 是侧门,强更期间锁死。 */
export type AppVersionGateAction = 'skip' | 'cancel' | 'manual' | 'quit'

// ==================== 版本比较(与服务端 MIN_VERSION_RE / CLI compareVersions 同口径) ====================

/** 服务端 app-version.ts:78 同款:只认 X.Y.Z 三段数字。 */
const VERSION_RE = /^\d+\.\d+\.\d+$/

export function isValidVersion(v: string): boolean {
  return VERSION_RE.test(v)
}

/** 逐段数字比较,缺段按 0 补('1.2' == '1.2.0');多进位正确('2.10.0' > '2.9.9')。 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.')
  const pb = b.split('.')
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10) || 0
    const nb = Number.parseInt(pb[i] ?? '0', 10) || 0
    if (na !== nb) return na < nb ? -1 : 1
  }
  return 0
}

// ==================== 策略判定(纯函数) ====================

export interface AppVersionGateInput {
  currentVersion: string
  /** check-update 端点的 hasUpdate(服务端按 buildNumber 比过)。 */
  hasUpdate: boolean
  latestVersion?: string | null
  downloadUrl?: string | null
  releaseNotes?: string | null
  /** check-update 的 forceUpdate 策略位(app-version.ts:43)。 */
  forceUpdate?: boolean
  /** 服务端下发的最低版本(app-version.ts:89 的 CliMinVersionDecision.minimumVersion;null/缺省=没要求)。 */
  minimumVersion?: string | null
}

export interface AppVersionGateDecision {
  /** true = 强更会话:六终态机接管,skip/cancel 侧门锁死,manual/quit 恒可用(active 态经 confirm-close)。 */
  required: boolean
  /** required 会话的起点恒为 'checking',由下游沿六终态机推进;非强更 = 'idle',判定失败 = 'error'(fail-open)。 */
  kind: AppVersionGateUiState
  /** 结论为什么是这样(人在控制台能直接读;放行也留痕,同服务端哲学)。 */
  reason: string
  latestVersion: string | null
  downloadUrl: string | null
  releaseNotes: string | null
}

/**
 * 强更策略判定:版本比较(minimumVersion 硬闸 + forceUpdate 策略位)⇒ 是否进入强更会话。
 * 纯函数,不碰网络;配错一律 fail-open(required=false),理由随 reason 回传。
 */
export function appVersionGate(input: AppVersionGateInput): AppVersionGateDecision {
  const base = {
    latestVersion: input.latestVersion ?? null,
    downloadUrl: input.downloadUrl ?? null,
    releaseNotes: input.releaseNotes ?? null,
  }
  if (!isValidVersion(input.currentVersion)) {
    return {
      required: false,
      kind: 'error',
      reason: `当前版本 "${input.currentVersion}" 不是 X.Y.Z 形态 ⇒ 不拦(fail-open,同服务端配错降级哲学)`,
      ...base,
    }
  }
  const minimumVersion = input.minimumVersion ?? null
  if (minimumVersion !== null) {
    if (!isValidVersion(minimumVersion)) {
      return {
        required: false,
        kind: 'error',
        reason: `服务端 minimumVersion="${minimumVersion}" 不是 X.Y.Z 形态 ⇒ 不拦(fail-open,同服务端配错降级哲学)`,
        ...base,
      }
    }
    if (compareVersions(input.currentVersion, minimumVersion) < 0) {
      return {
        required: true,
        kind: 'checking',
        reason: `当前版本 ${input.currentVersion} 低于服务端最低版本 ${minimumVersion} ⇒ 强更会话(六终态机接管,skip/cancel 侧门锁死)`,
        ...base,
      }
    }
  }
  if (input.hasUpdate && input.forceUpdate === true) {
    return {
      required: true,
      kind: 'checking',
      reason: `有更新且服务端标记 forceUpdate ⇒ 强更会话(六终态机接管,skip/cancel 侧门锁死)`,
      ...base,
    }
  }
  if (input.hasUpdate) {
    return {
      required: false,
      kind: 'idle',
      reason: `有更新(最新 ${input.latestVersion ?? '未知'})但服务端未标记 forceUpdate ⇒ 仅提示,skip 侧门可用`,
      ...base,
    }
  }
  return { required: false, kind: 'idle', reason: '服务端判定无更新 ⇒ 闸门放行', ...base }
}

// ==================== 动作可用性(manual/quit 恒可用;强更锁死 skip/cancel 侧门) ====================

export interface AppVersionGateActionVerdict {
  allowed: boolean
  /** true = 动作可点但不立即执行,须先经 confirm-close 二次确认(上游 forceUpdatePrompt.ts:462-464)。 */
  confirmFirst: boolean
  reason: string
}

/**
 * 单一动作可用性判据(照抄上游三处守门):
 *   - manual/quit 恒可用(forceUpdatePrompt.ts:398-399 两按钮从不 disabled);
 *     active 自动态下先 confirm-close(462-464),confirm-close 态本身不再叠加确认。
 *   - skip/cancel 在强更会话期间锁死(autoUpdater.ts:1099-1102 / 1245-1248 的
 *     activeForceAutoUpdateListener 早退分支)。
 */
export function gateAllowsAction(
  state: AppVersionGateUiState,
  decision: Pick<AppVersionGateDecision, 'required'>,
  action: AppVersionGateAction,
): AppVersionGateActionVerdict {
  if (action === 'manual' || action === 'quit') {
    return {
      allowed: true,
      confirmFirst: isActiveAppVersionGateKind(state),
      reason: 'manual/quit 恒可用;active 自动态下先经 confirm-close 二次确认',
    }
  }
  if (decision.required) {
    return {
      allowed: false,
      confirmFirst: false,
      reason: `强更会话期间 ${action} 侧门锁死(上游 activeForceAutoUpdateListener 早退,autoUpdater.ts:1099-1102/1245-1248)`,
    }
  }
  return { allowed: true, confirmFirst: false, reason: '非强更会话,侧门可用' }
}

// ==================== 接线:拉端点 + 广播决策(UI 钩子) ====================

/** 决策广播事件名:UI 侧 window.addEventListener(APP_VERSION_GATE_EVENT, …) 即可订阅强更提示。 */
export const APP_VERSION_GATE_EVENT = 'app-version-gate:decision'

/** web 当前版本号:构建时可经 NEXT_PUBLIC_APP_VERSION 注入;缺省 0.0.0(服务端按 buildNumber 兜底比对)。 */
const WEB_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'

function failOpen(reason: string): AppVersionGateDecision {
  return {
    required: false,
    kind: 'error',
    reason,
    latestVersion: null,
    downloadUrl: null,
    releaseNotes: null,
  }
}

/**
 * 启动/登录后的接线点:拉 GET /api/app-version/check-update,套 appVersionGate 策略,
 * 把决策经 window CustomEvent 广播(下游 UI 钩子订阅即可出强更提示,不在此造弹窗工程)。
 * 端点失败/响应异常一律 fail-open 不拦启动;决策照常广播,消费方拿得到失败留痕。
 */
export async function appVersionGateCheck(
  opts: { currentVersion?: string; platform?: 'web' | 'android' | 'ios' | 'miniapp' } = {},
): Promise<AppVersionGateDecision> {
  const currentVersion = opts.currentVersion ?? WEB_APP_VERSION
  let decision: AppVersionGateDecision
  try {
    const res = await checkAppVersion({
      version: currentVersion,
      platform: opts.platform ?? 'web',
    })
    if (!res.success || !res.data) {
      decision = failOpen(
        `check-update 端点未返回有效数据(success=${res.success}) ⇒ 不拦(fail-open)`,
      )
    } else {
      const d: VersionCheckResult = res.data
      decision = appVersionGate({
        currentVersion,
        hasUpdate: d.hasUpdate === true,
        latestVersion: (d.latestVersion as string | undefined) ?? null,
        downloadUrl: (d.downloadUrl as string | undefined) ?? null,
        releaseNotes: (d.releaseNotes as string | undefined) ?? null,
        forceUpdate: d.forceUpdate === true,
        minimumVersion: (d.minimumVersion as string | null | undefined) ?? null,
      })
    }
  } catch (e) {
    decision = failOpen(
      `check-update 请求失败(${e instanceof Error ? e.message : String(e)}) ⇒ 不拦(fail-open)`,
    )
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AppVersionGateDecision>(APP_VERSION_GATE_EVENT, { detail: decision }))
  }
  return decision
}
