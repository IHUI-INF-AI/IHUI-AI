// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 收口刀:回退结论 → 用户看到的那一句。
 *
 * 分工:本模块只做"选哪一句、插哪些值",**不**做裁决。裁决在
 * `undo-workspace-state.ts` 的 `classifyUndoVerdict`(三态判据)与
 * `undo-redo.ts` 的 UndoResult 上。理由:判据要有牙(可单测、可变异对照),
 * 文案要可对账(五语齐、键名封闭);两者混在一个文件里就都测不干净。
 *
 * 与 web 侧 `apps/web/src/lib/undo-fact-check.ts` 的关系:同一个三态口径、
 * 同一句铁律 —— "工作区未发生变化"只在 verdict==='unchanged' 时出现。
 * 失败/不可用再按**原因**分档(票面 undoUnavailableDescription /
 * undoFailedDescription 两句),不许压成一句:
 *   - 检查点里根本没有可回滚项(无快照 / 记录读不出来)⇒ `undoUnavailable`;
 *   - 检查点有条目、但一条也没撤成(写失败 / 无权限 / 目标被占用)⇒ `undoFailed`;
 *   - 撤成一部分 ⇒ `undoPartialWarning`。
 * 键名与 web 侧逐字对齐(见 `UNDO_CLAIM_KEYS`),五语 parity 由
 * `apps/cli/tests/d163-undo-i18n-parity.test.ts` 逐字钉住。
 */

/**
 * 文案键(相对 `cliEntry.` 命名空间,与 undoDesc/undoDone 同一层)。
 *
 * 顺序即票面六态 + 失败三拆:preparing → confirm → succeeded → partial →
 * unavailable → failed(不可用原因 / changed / unverifiable)。
 */
export const UNDO_CLAIM_KEYS = [
  'undoPreparing',
  'undoConfirm',
  'undoSucceeded',
  'undoPartialWarning',
  'undoUnavailable',
  'undoFailed',
  'undoFailedChanged',
  'undoFailedUnverifiable',
] as const;

export type UndoClaimKey = (typeof UNDO_CLAIM_KEYS)[number];

/** i18n 里八键挂在 cliEntry 下;渲染时才拼前缀,键表本身保持与 web 侧同名。 */
export const UNDO_CLAIM_KEY_PREFIX = 'cliEntry.';

/** 三态(与 `undo-workspace-state.ts` 的 UndoVerdict 同义,这里用结构型避免命令层被反依赖)。 */
type UndoVerdictLike = 'unchanged' | 'changed' | 'unknown';

/** 检查点可用性(与 `undo-checkpoint-state.ts` 同义,结构型同上)。 */
type UndoCheckpointStatusLike = 'available' | 'missing' | 'unreadable' | 'corrupt';

/** `selectUndoClaimKey` 的入参:只要"已经跑完的回退"这一份结论。 */
export interface UndoClaimInput {
  readonly verdict: UndoVerdictLike;
  /** 有文件没撤成 ⇒ 撤销结果不完整 */
  readonly partial: boolean;
  readonly undoneSteps: number;
  /**
   * D22046 通道②:撤销前探测到的检查点可用性。
   *
   * 缺省(老调用方)= 'available',行为与改造前逐字等价;给了值就必须参与分派 ——
   * 因为"检查点根本读不出来"与"检查点好好的、只是写失败"是两份不同的事实,
   * 对应的下一句与下一步动作都不同。
   */
  readonly checkpointStatus?: UndoCheckpointStatusLike;
  /**
   * 本轮回退实际**尝试**了几条(来自 `UndoResult.attemptedSteps`)。
   *
   * 分档靠它把"没得撤"与"撤了但全失败"分开:
   *   0   ⇒ 检查点里本来就没有条目(无快照 / 记录读不出来)⇒ `undoUnavailable`;
   *   > 0 ⇒ 真的动过手,若 `undoneSteps===0` 则是回退动作失败 ⇒ `undoFailed`。
   * 少了这一格,两件事只能共用同一句文案 —— 那正是票面要拆掉的"一律一句"。
   */
  readonly attemptedSteps: number;
}

/**
 * 回退结论 → 该说哪一句(纯函数:不插值、不碰 i18n、不读文件)。
 *
 * 互斥顺序写死,从上到下第一个命中即返回,每条对应票面一态:
 *   1. verdict==='changed'  ⇒ undoFailedChanged      (确证变了,明说)
 *   2. verdict==='unknown'  ⇒ undoFailedUnverifiable (判不了,不声称)
 *   3. checkpointStatus!=='available' ⇒ undoUnavailable (检查点自己就坏了,一次没动手)
 *   4. attemptedSteps===0   ⇒ undoUnavailable        (可用但索引里没有可回滚条目)
 *   5. undoneSteps===0      ⇒ undoFailed             (有快照但一条也没撤成)
 *   6. partial              ⇒ undoPartialWarning     (部分修改不在检查点中)
 *   7. 其余                 ⇒ undoSucceeded          (干净成功)
 *
 * 3 与 5 就是"回退不可用原因分档":两者的**事实**不同(检查点能不能读 / 有没有动过手),
 * 票面也给了两句不同的话。把 5 删掉 ⇒ 全失败会被并回"文件检查点不可用",
 * 于是用户看到的仍是同一句 —— 正是本刀要拆掉的形态。
 * 3 必须在 5 之前:检查点缺失时 `attemptedSteps` 恒 0,一旦先判 5,
 * "读不出来"就被读成"能读但没条目",上层会去重试一个根本不存在的索引。
 *
 * 反向锁(变异对照的依据):把 1、2 的顺序对调,会把"真变了、但另有一个文件
 * 读不出来"说成"判不了" —— 确证事实被降级成未决,这正是票面禁的那类谎。
 * 把 2 删掉则"无法核实"这句永远说不出口,失败全被读成"已发生变化"。
 * 把 1、2 移到 3 之后,两句含"未发生变化"的承诺就会在真变了时照说不误。
 */
export function selectUndoClaimKey(input: UndoClaimInput): UndoClaimKey {
  if (input.verdict === 'changed') return 'undoFailedChanged';
  if (input.verdict === 'unknown') return 'undoFailedUnverifiable';
  // 通道②:检查点自己坏了(缺失/读不出/索引不完整)⇒ "文件检查点不可用"。
  // 这一档必须排在 attemptedSteps 之前:此时一次都没动手,不能因为"没试"
  // 就把它读成"可用但执行失败";反之若先判 attemptedSteps,两档又会并成一句。
  if (input.checkpointStatus !== undefined && input.checkpointStatus !== 'available') {
    return 'undoUnavailable';
  }
  if (input.attemptedSteps === 0) return 'undoUnavailable';
  if (input.undoneSteps === 0) return 'undoFailed';
  if (input.partial) return 'undoPartialWarning';
  return 'undoSucceeded';
}

/** CLI `t()` 的签名(只依赖结构,不 import apps/cli 的 i18n 实例,防环)。 */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** 准备态:快照采集之前。 */
export function renderUndoPreparing(t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoPreparing');
}

/** 确认态:将恢复多少文件、影响多少轮(任务记录不动)。 */
export function renderUndoConfirm(fileCount: number, turnCount: number, t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoConfirm', { fileCount, turnCount });
}

/** 成功态:带恢复文件数插值。 */
export function renderUndoSucceeded(count: number, t: Translate): string {
  return t(UNDO_CLAIM_KEY_PREFIX + 'undoSucceeded', { count });
}

/** 把 selectUndoClaimKey 选中的那句真正渲染出来(插值参数按各态给齐)。 */
export function renderUndoClaim(input: UndoClaimInput, t: Translate): string {
  const key = selectUndoClaimKey(input);
  if (key === 'undoSucceeded') return renderUndoSucceeded(input.undoneSteps, t);
  return t(UNDO_CLAIM_KEY_PREFIX + key);
}

/**
 * D22046 末格:部分/全部失败时,终端要**逐条点名**失败文件与原因。
 *
 * 数据面(`UndoResult.failedFiles/failedReasons`)早就在,但终端此前只印成功清单 ——
 * 结论说"部分失败"、用户却看不到是哪几个,票面验收①"文案含具体文件数"在终端上落空。
 * 这里只做渲染(选句、插值、截断),裁决仍在 `undo-redo.ts` 与 `selectUndoClaimKey`。
 *
 * 截断上限:最多 `UNDO_REPORT_LIST_LIMIT` 条,余下用一句"另有 N 条"收口。
 * 设上限是为了一屏可读 —— 十几条失败刷满终端,反而把上面那句结论顶出视野。
 */
export const UNDO_REPORT_LIST_LIMIT = 10;

/** 失败清单三键(相对 `cliEntry.`,与 undoDone 同一层)。 */
export const UNDO_FAILURE_LIST_KEYS = [
  'undoFailedFilesTitle',
  'undoFailedFileLine',
  'undoFailedFilesMore',
] as const;

/** 单条成功改动的展示形状(只取渲染要的两列,不绑死 FileChange)。 */
interface UndoReportedChange {
  readonly toolName: string;
  readonly filePath: string;
}

/** 成功清单入参。 */
interface UndoSucceededLinesInput {
  readonly undoneSteps: number;
  readonly remaining: number;
  readonly changes: readonly UndoReportedChange[];
}

/**
 * 成功改动清单。
 *
 * `undoneSteps===0`(全失败 / 无步可撤)时返回空:此时印"✓ 已回滚 0 步"是把
 * 失败包装成成功清单,票面明确不许(全失败要么不印清单,要么明说 0 成功)。
 */
function renderUndoSucceededLines(input: UndoSucceededLinesInput, t: Translate): string[] {
  if (input.undoneSteps <= 0) return [];
  const lines = [
    t(UNDO_CLAIM_KEY_PREFIX + 'undoDone', {
      undoneSteps: input.undoneSteps,
      remaining: input.remaining,
    }),
  ];
  for (const change of input.changes) {
    lines.push(`  · ${change.toolName} → ${change.filePath}`);
  }
  return lines;
}

/** 失败清单入参(`failedFiles` 与 `failedReasons` 一一对应,由 undo-redo 保证)。 */
interface UndoFailureLinesInput {
  readonly failedFiles: readonly string[];
  readonly failedReasons: readonly string[];
  /**
   * D22046:失败涉及的**轮次**(与文件数分开的两个数)。
   *
   * 一轮可写多个文件,所以"3 个文件"不等于"3 轮"。只报文件数会让用户以为
   * 要重试 3 次;只报轮次又看不出影响面。两个数都给,才谈得上"下一步动作"。
   */
  readonly failedSteps: number;
}

/**
 * 失败文件清单:标题(带总数)+ 逐条「文件 — 原因」+ 截断尾句。
 *
 * 空数组 ⇒ 空输出(全部成功时一个字也不多印,免得成功态反被失败标题干扰)。
 */
function renderUndoFailureLines(
  input: UndoFailureLinesInput,
  t: Translate,
  limit: number = UNDO_REPORT_LIST_LIMIT,
): string[] {
  const total = input.failedFiles.length;
  if (total === 0) return [];
  const shown = Math.max(0, Math.min(Math.floor(limit), total));
  const lines = [
    t(UNDO_CLAIM_KEY_PREFIX + 'undoFailedFilesTitle', {
      count: total,
      turns: input.failedSteps,
    }),
  ];
  for (let i = 0; i < shown; i += 1) {
    lines.push(
      t(UNDO_CLAIM_KEY_PREFIX + 'undoFailedFileLine', {
        file: input.failedFiles[i]!,
        reason: input.failedReasons[i] ?? '',
      }),
    );
  }
  const omitted = total - shown;
  if (omitted > 0) {
    lines.push(t(UNDO_CLAIM_KEY_PREFIX + 'undoFailedFilesMore', { count: omitted }));
  }
  return lines;
}

/** 终端整段报告的入参。 */
export interface UndoReportInput extends UndoClaimInput, UndoFailureLinesInput {
  readonly remaining: number;
  readonly changes: readonly UndoReportedChange[];
}

/** 终端整段报告:一句结论 + 成功清单 + 失败清单(三者互不串台)。 */
export interface UndoReport {
  /** 选中的文案键:机器可读的上层出口(--json 事件里带上,免得再猜一遍文案) */
  readonly claimKey: UndoClaimKey;
  readonly claim: string;
  readonly claimIsSuccess: boolean;
  readonly succeededLines: readonly string[];
  readonly failureLines: readonly string[];
}

/**
 * 组装 `/undo` 的终端输出。index.ts 只负责上色与 console.info,不再自己拼句子 ——
 * 这样"哪一句、印哪几条、截到第几条"都能被单测直接钉住,不用去跑 commander。
 */
export function renderUndoReport(
  input: UndoReportInput,
  t: Translate,
  limit: number = UNDO_REPORT_LIST_LIMIT,
): UndoReport {
  const key = selectUndoClaimKey(input);
  return {
    claimKey: key,
    claim:
      key === 'undoSucceeded'
        ? renderUndoSucceeded(input.undoneSteps, t)
        : t(UNDO_CLAIM_KEY_PREFIX + key),
    claimIsSuccess: key === 'undoSucceeded',
    succeededLines: renderUndoSucceededLines(input, t),
    failureLines: renderUndoFailureLines(input, t, limit),
  };
}
