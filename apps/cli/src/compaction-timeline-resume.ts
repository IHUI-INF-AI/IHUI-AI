// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 压缩时间线账本的 resume 侧装配(G-816014)。
 *
 * 收敛器 recoverInterruptedCompactTimelines 是 @ihui/context-compaction 里的纯函数,
 * 本模块是它在 CLI 端的唯一介质:账本与主会话同目录(commands/session.ts 的
 * getSessionsDir),文件名 <sessionId>.compaction-timelines.json。进程被杀时压缩
 * 多步落库(started → retrying → boundary → completed)会留下只有悬挂态的账本;
 * resume 时必须对账,否则账面读起来像"压缩判过了"。
 *
 * 保守口径:
 *   - 无账本文件(ENOENT)⇒ 无悬挂可收敛,空账直通(不代建文件);
 *   - 账本读不到 ⇒ 抛错,不能当成没有再整文件重写;
 *   - 账本损坏(非法 JSON / 非数组 / 条目越界)⇒ 抛错,不吞 —— 静默把坏账当空账
 *     会把"该收敛"伪装成"没得收敛",正是本票要堵的缺口;异常沿调用点
 *     (index.ts resolveSession)向上冒,中断 resume,绝不拿坏账装成功;
 *   - 收敛产出 append-only 落盘(原条目一字不动,只追加终态),与纯函数语义一致;
 *     无追加(零悬挂或全是终态)不写盘,保持"只读 through"。
 */

import * as fs from 'node:fs';
import {
  recoverInterruptedCompactTimelines,
  type CompactTimelineEntryKind,
  type CompactTimelineRecord,
  type TimelineRecoveryReport,
} from '@ihui/context-compaction';
import { getSessionsDir } from './commands/session.js';
// 账本文件名由会话 id 拼出:收敛与落点断言统一走 util/path-guard(与会话文件同一判据)。
import { segmentFilePathInside } from './util/path-guard.js';
// BUG-0010:账本与主会话同目录、resume 必须可读 —— 落盘走唯一原子写出口,中断不留半截 JSON。
import { writeFileAtomicSync } from './util/atomic-write.js';

/** 账本与主会话同目录(同一份 getSessionsDir):resume 读会话处必然能读到账本。 */
export function getCompactionTimelineLedgerPath(sessionId: string): string {
  return segmentFilePathInside(
    getSessionsDir(),
    sessionId,
    '.compaction-timelines.json',
    '压缩时间线账本',
  );
}

/** 条目 kind 闭集(与 @ihui/context-compaction 的 CompactTimelineEntryKind 对齐)。 */
const LEDGER_KINDS: ReadonlySet<string> = new Set([
  'started',
  'retrying',
  'boundary',
  'completed',
  'interrupted',
]);

type LedgerStat = (path: string) => fs.Stats;

/**
 * 读账本:文件不存在 ⇒ [](无账 = 无悬挂);读不到或内容不可信 ⇒ 抛错(大声失败)。
 */
export function readCompactionTimelineLedger(
  sessionId: string,
  stat?: LedgerStat,
): CompactTimelineRecord[] {
  const look = stat ?? ((p: string) => fs.statSync(p));
  const p = getCompactionTimelineLedgerPath(sessionId);
  try {
    look(p);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    throw new Error(`压缩账本读不到,不能把它当成没有 (${code ?? 'unknown'})`);
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`compaction timeline ledger is not an array: ${p}`);
  }
  return parsed.map((entry, i) => {
    const rec = entry as Record<string, unknown>;
    if (
      typeof rec.timelineId !== 'string' ||
      rec.timelineId.length === 0 ||
      typeof rec.kind !== 'string' ||
      !LEDGER_KINDS.has(rec.kind) ||
      typeof rec.atMs !== 'number' ||
      !Number.isFinite(rec.atMs)
    ) {
      throw new Error(`compaction timeline ledger entry #${i} is malformed: ${p}`);
    }
    return {
      timelineId: rec.timelineId,
      kind: rec.kind as CompactTimelineEntryKind,
      atMs: rec.atMs,
    };
  });
}

/**
 * resume 对账入口:读账本 → 纯函数收敛 → 有追加才落盘。返回对账报告;
 * 抛错一律向上冒(见头注保守口径),由调用点的既有错误通道承载。
 */
export function recoverCompactionTimelinesForSession(
  sessionId: string,
  nowMs: number = Date.now(),
  stat?: (path: string) => fs.Stats,
): TimelineRecoveryReport {
  const records = readCompactionTimelineLedger(sessionId, stat);
  const { records: converged, report } = recoverInterruptedCompactTimelines(records, nowMs);
  if (report.appended.length > 0) {
    writeFileAtomicSync(
      getCompactionTimelineLedgerPath(sessionId),
      JSON.stringify(converged, null, 2),
    );
  }
  return report;
}
