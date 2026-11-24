// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

/**
 * D76 产物归属 turn 派生层(跨端单一真相源;残余票 2026-09-25 自 web 提取)。
 *
 * 为什么落共享层(AGENTS.md §3):本模块是**纯数据派生**(消息数组 → turn 序列 /
 * 轮次序号 / 产物下标),零 DOM / window / 平台 API,web / extension / miniapp-taro /
 * mobile-rn 均可复用;各端只做薄接线。web 渲染层
 * `apps/web/src/components/media/artifact-turn-badge.tsx` 原样 re-export 本模块,
 * **不得再抄一份派生**。
 *
 * 残余①(同轮多产物聚焦粒度)的复用约束:产物锚点 → 所属轮的下标解析
 * (`artifactTurnIndex`)直接作用在 `collectArtifactTurns` 已派生的序列上 ——
 * 序列本身就是唯一映射,**禁止另建 artifact→turn 的第二份映射表**。
 *
 * 语义与提取前逐字一致(判据不变):
 *  - originating turn = 产物所在 toolCall 挂着的那条 assistant 消息;
 *  - turn 序号 = 该 assistant 消息在全部 assistant 消息中的 1 基序号。
 */

/** 产物四型。 */
export type ArtifactKind = 'document' | 'presentation' | 'spreadsheet' | 'file'

/**
 * 扩展名 → 分型判据表(显式 const,小写、不带点):
 *  - docx/pptx/xlsx 与 D41 OfficePreview 的 SUPPORTED_EXTS 一一对应(对齐守卫
 *    `assertOfficeExtAlignment` 留在 web 侧,因 SUPPORTED_EXTS 定义于 web 组件);
 *  - md 走消息流 markdown 渲染、csv 走 message-file-preview 的 CsvPreview,
 *    语义同为文档/电子表格;
 *  - 其余一律 'file',不做启发式扩散(判据可穷举,不猜)。
 */
export const ARTIFACT_KIND_BY_EXT: Readonly<Record<string, ArtifactKind>> = {
  docx: 'document',
  md: 'document',
  pptx: 'presentation',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
}

/** 文件名/路径/URL → 产物分型。取最后一段扩展名,忽略 ?query/#hash;无扩展名归 'file'。 */
export function artifactKindOf(nameOrPath: string): ArtifactKind {
  const base = nameOrPath.split(/[?#]/, 1)[0] ?? ''
  const dot = base.lastIndexOf('.')
  if (dot < 0) return 'file'
  return ARTIFACT_KIND_BY_EXT[base.slice(dot + 1).toLowerCase()] ?? 'file'
}

// ------------------------------------------------------- turn 派生(纯函数) ----

/** 产物条目(派生层最小形态,path 为锚点原文)。 */
export interface TurnArtifact {
  readonly path: string
  readonly kind: ArtifactKind
}

/** 一个"有产物的 turn":第 N 轮 = 第 N 条 assistant 回答(1 起)。 */
export interface ArtifactTurnEntry {
  readonly turn: number
  readonly messageId: string
  readonly artifacts: readonly TurnArtifact[]
}

/** 消息流最小结构面(直接兼容 ChatMessage,不引入契约依赖)。 */
export interface ArtifactTurnSourceMessage {
  readonly id: string
  readonly role: string
  readonly toolCalls?: ReadonlyArray<{
    readonly summary_data?: {
      readonly artifacts?: ReadonlyArray<{ readonly path?: string; readonly name?: string }>
    }
  }>
}

/**
 * 从消息流派生"有产物的 turn"序列(保持会话顺序):
 * originating turn = 产物所在 toolCall 挂着的那条 assistant 消息,
 * turn 序号 = 该 assistant 消息在全部 assistant 消息中的 1 基序号。
 * 无 path/name 的产物条目跳过;无产物的 assistant 消息不出现在结果里(但仍占序号)。
 */
export function collectArtifactTurns(
  messages: readonly ArtifactTurnSourceMessage[],
): ArtifactTurnEntry[] {
  let turn = 0
  const out: ArtifactTurnEntry[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    turn += 1
    const artifacts: TurnArtifact[] = []
    for (const tc of m.toolCalls ?? []) {
      for (const a of tc.summary_data?.artifacts ?? []) {
        const p = a.path ?? a.name
        if (typeof p === 'string' && p.length > 0) {
          artifacts.push({ path: p, kind: artifactKindOf(p) })
        }
      }
    }
    if (artifacts.length > 0) out.push({ turn, messageId: m.id, artifacts })
  }
  return out
}

/**
 * 消息 id → originating turn 序号(= 截至(含)该消息的 assistant 计数)。
 * 产物卡侧用:只知自己挂在哪条 assistant 消息下,
 * 不需要该消息真有产物(内联 content 型产物不走 summary_data 也算一轮)。
 */
export function assistantTurnOf(
  messages: readonly ArtifactTurnSourceMessage[],
  messageId: string,
): number | null {
  let turn = 0
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    turn += 1
    if (m.id === messageId) return turn
  }
  return null
}

/**
 * 残余①(聚焦粒度,2026-09-25 立):产物锚点(path/name,与产物卡
 * `[data-artifact-path]` 标注同源)→ 它在派生 turn 序列中的下标;找不到返回 null。
 * 只线性扫 `collectArtifactTurns` 的既有序列,不另建映射 —— 同轮多产物时,
 * 点第 1 个与点第 2 个各自解析到"被点的那一个"所属的轮(序列下同轮同下标,
 * 锚点命中即定位),调用方据下标取 `turns[idx]` 得整条 entry。
 */
export function artifactTurnIndex(
  turns: readonly ArtifactTurnEntry[],
  artifactAnchor: string,
): number | null {
  for (let i = 0; i < turns.length; i += 1) {
    if (turns[i]?.artifacts.some((a) => a.path === artifactAnchor)) return i
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
