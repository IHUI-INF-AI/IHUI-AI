// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 压缩时间线的中断收敛(G-816014)。
 *
 * 问题形态:一次上下文压缩是**多步落库**的过程 —— started(发起)→ retrying(重试)→
 * boundary(压缩结果已落到边界)→ completed(终态)。进程在中途被杀时,账面里会留下
 * 只有 started/retrying(可能带 boundary)的**悬挂**时间线:重启后它既不是完成也不是
 * 中断,账面读起来像"压缩判过了" —— "钩子无终态不得渲染成完成"在压缩侧的同型缺口。
 *
 * 收敛语义(resume 时一次性对账,**append-only**,原日志一条不动):
 *   - 按 timelineId 分组;组内**已有终态**(completed / interrupted)⇒ 原样跳过,
 *     不得改写也不得再追加(反向锁:防把成功的历史重判成中断);
 *   - 悬挂组内**存在 boundary** ⇒ 压缩已落到边界、只差终态落笔 ⇒ 补 completed;
 *   - 悬挂组内**无 boundary** ⇒ 压缩死在中途 ⇒ 补 interrupted(**可审计**)。
 *
 * 可审计口径:补的不只是一条终态记录 —— report 里每个 timelineId 都有
 * outcome + 最后已知活动时刻 + kind 计数,"为什么被判成中断"可以离线重放,
 * 不依赖读日志的人脑补。
 *
 * 纯函数:不 mutate 入参;收敛后的账面 = 原 records 原样在前 + 追加终态在后;
 * 补记时刻由调用方传 nowMs(保持可重放,不在纯函数里偷 Date.now)。
 */

/** 一条压缩时间线记录的形态(落库 append-only,kind 闭集见下)。 */
export type CompactTimelineEntryKind =
  | 'started'
  | 'retrying'
  | 'boundary'
  | 'completed'
  | 'interrupted'

export interface CompactTimelineRecord {
  /** 一次压缩流程的标识:同一流程的全部记录共享(日志天然可能交错多条流程) */
  timelineId: string
  kind: CompactTimelineEntryKind
  /** 记录时刻(epoch ms) */
  atMs: number
}

/** 终态判定:completed / interrupted。悬挂态(started/retrying/boundary)一律 false。 */
export function isTerminalTimelineKind(kind: CompactTimelineEntryKind): boolean {
  return kind === 'completed' || kind === 'interrupted'
}

/** 单个 timelineId 的对账结论(审计面:只记种类计数与时刻,不记消息内容)。 */
export interface CompactTimelineGroupReport {
  timelineId: string
  /**
   * 收敛结果:
   *   - 'completed' / 'interrupted' —— 本次补记的终态;
   *   - 'skipped-terminal' —— 组内已有终态,本次一条未动(反向锁生效)。
   */
  outcome: 'completed' | 'interrupted' | 'skipped-terminal'
  /** 组内最后已知活动时刻(审计"悬了多久"用) */
  lastActivityAtMs: number
  /** 组内各 kind 的条数(判据可重放:有没有 boundary 一眼可见) */
  kinds: Partial<Record<CompactTimelineEntryKind, number>>
}

export interface TimelineRecoveryReport {
  /** 本次实际追加的终态记录(与收敛后账面的尾段一致) */
  appended: CompactTimelineRecord[]
  /** 逐 timelineId 的对账结论(含被跳过的终态组) */
  groups: CompactTimelineGroupReport[]
}

export interface RecoverInterruptedCompactTimelinesResult {
  /** 收敛后的完整账面:原记录原样在前 + 追加终态在后 */
  records: CompactTimelineRecord[]
  report: TimelineRecoveryReport
}

/**
 * resume 对账入口:把悬挂的 started/retrying/boundary 收敛成 completed 或 interrupted,
 * 账面不留"无终态"。已是终态的条目不得被改写(③反向锁)。
 */
export function recoverInterruptedCompactTimelines(
  records: readonly CompactTimelineRecord[],
  nowMs: number,
): RecoverInterruptedCompactTimelinesResult {
  // 分组:保持首次出现序(账面读序),不依赖对象键序
  const order: string[] = []
  const groups = new Map<string, CompactTimelineRecord[]>()
  for (const rec of records) {
    let group = groups.get(rec.timelineId)
    if (!group) {
      group = []
      groups.set(rec.timelineId, group)
      order.push(rec.timelineId)
    }
    group.push(rec)
  }

  const appended: CompactTimelineRecord[] = []
  const groupReports: CompactTimelineGroupReport[] = []

  for (const timelineId of order) {
    const group = groups.get(timelineId)!
    const kinds: Partial<Record<CompactTimelineEntryKind, number>> = {}
    let lastActivityAtMs = group[0]!.atMs
    let hasTerminal = false
    let hasBoundary = false
    for (const rec of group) {
      kinds[rec.kind] = (kinds[rec.kind] ?? 0) + 1
      if (rec.atMs > lastActivityAtMs) lastActivityAtMs = rec.atMs
      if (isTerminalTimelineKind(rec.kind)) hasTerminal = true
      if (rec.kind === 'boundary') hasBoundary = true
    }

    // ③ 反向锁:组内已有终态 ⇒ 一条不动(不改写、不追加),只在报告里留痕
    if (hasTerminal) {
      groupReports.push({ timelineId, outcome: 'skipped-terminal', lastActivityAtMs, kinds })
      continue
    }

    const outcome: 'completed' | 'interrupted' = hasBoundary ? 'completed' : 'interrupted'
    appended.push({ timelineId, kind: outcome, atMs: nowMs })
    groupReports.push({ timelineId, outcome, lastActivityAtMs, kinds })
  }

  return {
    records: [...records, ...appended],
    report: { appended, groups: groupReports },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
