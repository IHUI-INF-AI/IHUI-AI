// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务 meta 单调合并(2026-09-30 立,吸收批次 74 W1 票 G-977986)。
 *
 * 场景:持久层/快照链路带回的 task meta(可能落后)要与本地乐观 meta 合并,
 * 合并必须单调——不回退、不还原手动编辑、不吞运行状态。
 *
 * 机制(吸收自上游任务 meta 合并判据):
 *  - 单调合并:updatedAt 更新的候选胜出;快照 updatedAt 落后于本地乐观时间时
 *    不得把整行拉回旧时刻(新建任务会在首屏刷新后跳回列表底部);
 *  - updatedAt 相等用 title 长度打破平局(信息量更大者胜);
 *  - 标题保护:空标题/"New session" 默认占位不得覆盖真实标题
 *    (快照可能早于后台标题投影;自动生成的真实标题仍照常覆盖);
 *  - titleOverridden 优先:任一候选带手动重命名标记 → 合并结果保留该标记,
 *    无标记的快照不得还原手动重命名;
 *  - unreadAt 用 hasOwnProperty 区分「显式 undefined(已读,清除)」与「未携带
 *    (不动已有未读态)」——直接取值会把未携带误伤成清除;
 *  - status 回退:胜出候选自身没带 status 时必须回退到落选候选,
 *    防乐观层把持久层的 running/completed 吞成 undefined(远控首页"运行中"靠它兜底);
 *  - 多候选折叠:按对合并逐个折叠,时间/标题平局规则同上。
 */

export interface TaskMetaCandidate {
  taskId: string
  createdAt: number
  updatedAt: number
  title: string
  /** 手动重命名标记;快照链路可能不带此键 */
  titleOverridden?: boolean
  /**
   * 未读时间戳。键不存在 = 未携带(不参与合并);
   * 显式 undefined/null = 已读,清除未读态。
   */
  unreadAt?: number | null
  /** 会话状态词元(running/completed/error/idle…);乐观层可能不带 */
  status?: string | null
  changeSummary?: string | null
  model?: string | null
  provider?: string | null
}

function hasOwnField<T extends object, K extends keyof T>(candidate: T, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(candidate, key)
}

/** 空标题与默认占位不可覆盖真实标题(小写归一后比较) */
function isPlaceholderTaskTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  return normalized.length === 0 || normalized === 'new session'
}

function resolveMergedTaskTitle(
  preferred: TaskMetaCandidate,
  fallback: TaskMetaCandidate,
): string {
  // 手动重命名优先:preferred 没有覆写标记而 fallback 有 → 标题随 fallback,
  // 防无标记的快照把手动重命名还原成旧值
  if (fallback.titleOverridden === true && preferred.titleOverridden !== true) {
    return fallback.title
  }
  // 占位标题不得覆盖真实标题;自动生成的真实标题(两侧都非占位)按 preferred 照常覆盖
  if (isPlaceholderTaskTitle(preferred.title) && !isPlaceholderTaskTitle(fallback.title)) {
    return fallback.title
  }
  return preferred.title
}

/**
 * 两候选单调合并:snapshot = 持久层/快照侧,optimistic = 本地乐观侧。
 * 返回对象总是携带 titleOverridden/status/unreadAt 等键(值可能为 undefined)。
 */
export function mergeTaskMetaPair<T extends TaskMetaCandidate>(
  snapshot: T,
  optimistic: T,
): T {
  // 单调判据:乐观时间更新者胜;同刻用 title 长度打破平局。
  // 快照 updatedAt 落后 → 乐观候选整体胜出,时间戳不回退。
  const shouldKeepOptimistic =
    optimistic.updatedAt > snapshot.updatedAt ||
    (optimistic.updatedAt === snapshot.updatedAt &&
      optimistic.title.length > snapshot.title.length)
  const preferred = shouldKeepOptimistic ? optimistic : snapshot
  const fallback = shouldKeepOptimistic ? snapshot : optimistic

  return {
    ...preferred,
    changeSummary: preferred.changeSummary ?? fallback.changeSummary,
    model: preferred.model ?? fallback.model,
    provider: preferred.provider ?? fallback.provider,
    title: resolveMergedTaskTitle(preferred, fallback),
    titleOverridden:
      preferred.titleOverridden === true || fallback.titleOverridden === true
        ? true
        : (preferred.titleOverridden ?? fallback.titleOverridden),
    // status 回退:胜出候选自身没带 status 时回落到落选候选,防 running/completed 被吞
    status: preferred.status ?? fallback.status,
    // hasOwnProperty 区分「显式 undefined = 已读清除」与「未携带 = 不动已有未读态」
    unreadAt: hasOwnField(optimistic, 'unreadAt')
      ? optimistic.unreadAt
      : (preferred.unreadAt ?? fallback.unreadAt),
  }
}

/**
 * 多候选折叠:按序两两合并,空候选跳过;全空返回 undefined。
 * 位置语义:合并按「时间新者胜」进行,与传入位置无关;仅在 updatedAt 与
 * title 长度全相等时先到者保留(确定性收敛)。
 */
export function foldTaskMetaCandidates<T extends TaskMetaCandidate>(
  ...candidates: Array<T | null | undefined>
): T | undefined {
  let merged: T | undefined
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    merged = merged ? mergeTaskMetaPair(candidate, merged) : candidate
  }
  return merged
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
