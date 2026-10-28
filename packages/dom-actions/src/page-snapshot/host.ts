// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页内宿主入口（给"自己就在页面里"的端用：扩展 content script / webview / 桌面端）。
 *
 * 与 CLI 那条路的分工：CLI 在页外，经 CDP 注入 `installIhuiPageApi` 的函数体后
 * 拿到同一个页内 API；本文件在页内直接 import 同一个安装函数。
 * 两条路共用实现与同一套预算，所以同一份页面在两端拿到的句柄语义一致 ——
 * 这是把契约放共享包的全部理由。
 */
import {
  clampPageSnapshotBudget,
  PAGE_SNAPSHOT_SCHEMA,
  parsePageHandle,
  type PageActionErrorCode,
  type PageActionRaw,
  type PageActionResult,
  type PageActionType,
  type PageSnapshotBudget,
  type PageSnapshotRaw,
  type PageSnapshotResult,
  type SideEffectCertainty,
} from './contract.js'
import {
  buildPageApiOptions,
  getIhuiPageApi,
  installIhuiPageApi,
  newPageScope,
  type IhuiPageApiHolder,
} from './page-api.js'
import { renderEmptySnapshot, renderSnapshot, serializeSnapshotResult } from './serialize.js'

/** 在页内安装（或复用）页内 API。 */
export function installPageApi(): IhuiPageApiHolder | null {
  const existing = getIhuiPageApi()
  if (existing) return existing
  installIhuiPageApi(buildPageApiOptions(newPageScope()))
  return getIhuiPageApi()
}

/** 页内 API 当前状态（宿主自检 / 测试取证用；不触发安装）。 */
export function pageApiState(): {
  installed: boolean
  schema: number | null
  scope: string | null
  handles: number
} {
  const holder = getIhuiPageApi()
  if (!holder) return { installed: false, schema: null, scope: null, handles: 0 }
  const state = holder.api.state()
  return { installed: true, schema: holder.schema, scope: holder.scope, handles: state.handles }
}

/** 一次调用的确定性结论：`dispatched` 为真即 uncertain，绝不自称无副作用。 */
export function outcomeOf(raw: PageActionRaw): Pick<
  PageActionResult,
  'ok' | 'errorCode' | 'error' | 'dispatched' | 'sideEffect' | 'sideEffectReason'
> {
  const sideEffect: SideEffectCertainty = raw.dispatched ? 'uncertain' : 'none'
  return {
    ok: raw.ok,
    errorCode: raw.errorCode,
    error: raw.error,
    dispatched: raw.dispatched,
    sideEffect,
    sideEffectReason: raw.dispatched
      ? '已派发真实输入事件，页面可能已提交/跳转/发起请求，重试有重复提交风险'
      : '输入事件未派发，本次调用结构上不可能改动页面',
  }
}

function unavailable(): PageActionResult {
  return {
    ok: false,
    errorCode: 'PAGE_API_UNAVAILABLE',
    error: '页内 API 未安装或版本不符（宿主须先安装）',
    dispatched: false,
    sideEffect: 'none',
    sideEffectReason: '未进入页内执行体，未派发任何事件',
    hint: '先调 installPageApi()',
  }
}

/** 句柄表被页内产出的行与契约解析器共同认定不合法时的显式失败（宁可报错也不交付错句柄）。 */
function malformedFromPage(handle: string): PageActionResult {
  return {
    ok: false,
    errorCode: 'HANDLE_MALFORMED',
    error: `页内句柄格式与契约不符：${handle}`,
    dispatched: false,
    sideEffect: 'none',
    sideEffectReason: '只读动作',
    hint: `页内 schema=${PAGE_SNAPSHOT_SCHEMA} 与宿主 schema 不一致，须刷新页内脚本`,
  }
}

/**
 * 派发一个页面动词（页内端用）。CLI 侧走 `runPageActionWithApi`，两侧共用同一份
 * 预算钳制、副作用判定与序列化，避免"CLI 与扩展给出的快照格式不同"。
 */
export function runPageAction(
  action: PageActionType,
  params: Record<string, unknown>,
  budgetInput?: Partial<Record<keyof PageSnapshotBudget, unknown>>,
): PageActionResult {
  const holder = installPageApi()
  if (!holder) return unavailable()
  return runPageActionWithApi(holder, action, params, budgetInput)
}

export interface PageSnapshotOutcome {
  ok: boolean
  raw?: PageSnapshotRaw
  errorCode?: PageActionErrorCode
  error?: string
}

/** 只取原始快照（CLI 页外侧复用：注入调用拿到 raw 后仍走同一份序列化）。 */
export function snapshotOutcomeOf(raw: PageSnapshotRaw): PageSnapshotOutcome {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rows)) {
    return { ok: false, errorCode: 'EXECUTION_FAILED', error: '页内未返回可解读的快照结构' }
  }
  const broken = raw.rows.find((row) => parsePageHandle(row.handle) === null)
  if (broken) {
    return { ok: false, errorCode: 'HANDLE_MALFORMED', error: `页内句柄格式与契约不符：${broken.handle}` }
  }
  return { ok: true, raw }
}

/** 按预算装配快照结果与文本（页内外共用）。 */
export function buildSnapshotResult(
  raw: PageSnapshotRaw,
  budgetInput?: Partial<Record<keyof PageSnapshotBudget, unknown>>,
): { result: PageSnapshotResult; text: string } {
  const budget = clampPageSnapshotBudget(budgetInput)
  const result = serializeSnapshotResult(raw, budget)
  const text =
    result.rows.length === 0 && result.body.length === 0
      ? renderEmptySnapshot('页面既未交回可动作元素，也未交回正文')
      : renderSnapshot(result)
  return { result, text }
}

/**
 * 用**已就位**的页内 API 派发动词。
 *
 * 参数不合法/句柄取不到 ⇒ 一律 `none`（还没派发过任何事件）；派发过 ⇒ `uncertain`。
 * 失败时给 `hint`：让模型知道该重拍快照，而不是换个选择器再赌一次。
 */
export function runPageActionWithApi(
  holder: IhuiPageApiHolder,
  action: PageActionType,
  params: Record<string, unknown>,
  budgetInput?: Partial<Record<keyof PageSnapshotBudget, unknown>>,
): PageActionResult {
  const budget = clampPageSnapshotBudget(budgetInput)

  if (action === 'page_snapshot') {
    const outcome = snapshotOutcomeOf(holder.api.snapshot(budget))
    if (!outcome.ok || !outcome.raw) {
      return {
        ok: false,
        errorCode: outcome.errorCode ?? 'EXECUTION_FAILED',
        error: outcome.error ?? '快照失败',
        dispatched: false,
        sideEffect: 'none',
        sideEffectReason: '只读快照，未派发任何事件',
      }
    }
    const { result, text } = buildSnapshotResult(outcome.raw, budget)
    return {
      ok: true,
      dispatched: false,
      sideEffect: 'none',
      sideEffectReason: '只读快照，未派发任何事件',
      data: { text, snapshot: result, counts: outcome.raw.counts },
    }
  }

  if (action === 'page_pick_at_point') {
    const picked = holder.api.pick(params.x, params.y, budget)
    const detail = (picked.detail ?? {}) as Record<string, unknown>
    if (typeof detail.handle === 'string' && parsePageHandle(detail.handle) === null) {
      return malformedFromPage(detail.handle)
    }
    return {
      ...outcomeOf(picked),
      data: picked.ok ? detail : undefined,
      hint: picked.ok ? undefined : '坐标可能落在视口外或空白处；先拍快照按行取句柄',
    }
  }

  // 其余四个动词都要先解析句柄 —— 解析失败必然发生在派发之前，因此副作用确定为 none。
  const resolved = holder.api.resolve(params.handle)
  if (!resolved.ok) {
    return {
      ...outcomeOf(resolved),
      hint: '重新拍一次快照拿新句柄；页面已导航时旧句柄整批失效是预期行为',
    }
  }
  const acted = holder.api.act(action, params.handle, params, budget)
  const resolvedDetail = (resolved.detail ?? {}) as Record<string, unknown>
  return {
    ...outcomeOf(acted),
    data: acted.ok
      ? {
          handle: params.handle,
          point: { x: resolvedDetail.x, y: resolvedDetail.y },
          ...(acted.detail ? { detail: acted.detail } : {}),
        }
      : undefined,
    hint: acted.ok ? undefined : '目标类型与该动词不匹配，按表内 role 选动词',
  }
}

/** 页内动作派发完但未校验结果时，宿主可据 `dispatched` 直接标注确定性（CLI 用）。 */
export function dispatchedOutcome(detail?: Record<string, unknown>): PageActionResult {
  return {
    ...outcomeOf({ ok: true, dispatched: true }),
    data: detail ? { detail } : undefined,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
