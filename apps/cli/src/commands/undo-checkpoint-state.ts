// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D22046 通道②:回退**之前**的检查点可用性探测。
 *
 * 为什么要有这一份、而不是等 applyChange 抛异常再说:
 * `/undo` 的失败路径此前只有"试了才知道"这一档 —— 检查点索引根本不存在、
 * 读不出来、或者索引条目已经损坏,和"索引好好的、只是写文件失败"在终端上
 * 说的是同一句"CLI 文件检查点暂时不可用"。上层拿到 `UndoResult` 时无法区分
 * 二者,也就无法决定"重试"还是"先修检查点"。本模块把这件事**在动手之前**
 * 读成结构化事实:`status` + `reasonCode` + 可数的索引条目,而不是一句日志。
 *
 * 三档不可用 + 一档可用(互斥,按"能不能真的复原"从严到宽):
 *   - `missing`    索引文件不存在(ENOENT):从未记录过 / 已被清理;
 *   - `unreadable` 存在但读不出来(EACCES/EBUSY/…):拿不到内容就不算可用;
 *   - `corrupt`    读到了但 JSON 解析失败 / 顶层形状不对 / 条目字段不全;
 *   - `available`  能解析、内部索引结构完整。
 * "读不出来"与"没条目"必须分开:前者是故障,后者只是空账 —— 后者仍算
 * `available`(entryCount===0),由上层按"没得撤"处理,不许冒充"检查点坏了"。
 *
 * 本模块只读,不写任何文件;探测失败绝不抛异常(调用方要的是事实,不是中断)。
 */

import fs from 'node:fs';

/** 检查点索引的可用性状态(结构化成字段,上层按它分派,不读日志)。 */
type UndoCheckpointStatus = 'available' | 'missing' | 'unreadable' | 'corrupt';

/** 撤销前探测到的事实。 */
export interface UndoCheckpointProbe {
  readonly status: UndoCheckpointStatus;
  /** 检查点索引文件(空账也指向同一路径,便于上层给人看"该修哪儿") */
  readonly indexFile: string;
  /** 可复原的撤销条目数;读不出来时为 null(不知道 ≠ 0 条) */
  readonly entryCount: number | null;
  /** 结构不完整的条目位置(如 `undoStack[1]`);available 时为空 */
  readonly invalidEntries: readonly string[];
  /** 机器码(ENOENT / JSON_PARSE / SCHEMA / 具体 Node 错误码),不是给人看的句子 */
  readonly reasonCode: string | null;
  /** 补充事实(错误 message / 缺哪个字段),可为 null */
  readonly detail: string | null;
}

/** 探测依赖注入口:单测用它模拟"读不出来"等无法在真实磁盘上稳定复现的分支。 */
export interface UndoCheckpointProbeDeps {
  readonly exists?: (file: string) => boolean;
  readonly readFile?: (file: string) => string;
}

/** 一条撤销记录是否结构完整(缺任一关键字段 ⇒ 索引不完整,不许拿来复原)。 */
function isValidEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.toolName === 'string' &&
    typeof entry.filePath === 'string' &&
    (entry.beforeContent === null || typeof entry.beforeContent === 'string') &&
    (entry.afterContent === null || typeof entry.afterContent === 'string') &&
    typeof entry.timestamp === 'number' &&
    Number.isFinite(entry.timestamp)
  );
}

function errnoOf(err: unknown): string {
  const code = (err as NodeJS.ErrnoException).code;
  return code ?? 'EUNKNOWN';
}

/**
 * 探测检查点索引(只读)。
 *
 * 顺序即判定:不存在 → 读不出来 → 解析不了 → 形状不对 → 条目不全 → 可用。
 * 每一步都返回**具体**的 reasonCode/invalidEntries,好让上层给出下一步动作,
 * 而不是只说"不可用"。
 */
export function probeUndoCheckpoint(
  indexFile: string,
  deps: UndoCheckpointProbeDeps = {},
): UndoCheckpointProbe {
  const exists = deps.exists ?? ((file: string) => fs.existsSync(file));
  const readFile = deps.readFile ?? ((file: string) => fs.readFileSync(file, 'utf-8'));

  if (!exists(indexFile)) {
    return {
      status: 'missing',
      indexFile,
      entryCount: null,
      invalidEntries: [],
      reasonCode: 'ENOENT',
      detail: null,
    };
  }

  let raw: string;
  try {
    raw = readFile(indexFile);
  } catch (err) {
    return {
      status: 'unreadable',
      indexFile,
      entryCount: null,
      invalidEntries: [],
      reasonCode: errnoOf(err),
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (err) {
    return {
      status: 'corrupt',
      indexFile,
      entryCount: null,
      invalidEntries: [],
      reasonCode: 'JSON_PARSE',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      status: 'corrupt',
      indexFile,
      entryCount: null,
      invalidEntries: [],
      reasonCode: 'SCHEMA',
      detail: 'top-level value is not an object',
    };
  }
  const shape = parsed as Record<string, unknown>;
  if (!Array.isArray(shape.undoStack) || !Array.isArray(shape.redoStack)) {
    return {
      status: 'corrupt',
      indexFile,
      entryCount: null,
      invalidEntries: [],
      reasonCode: 'SCHEMA',
      detail: 'undoStack/redoStack must both be arrays',
    };
  }

  const invalidEntries: string[] = [];
  shape.undoStack.forEach((entry, i) => {
    if (!isValidEntry(entry)) invalidEntries.push(`undoStack[${i}]`);
  });
  shape.redoStack.forEach((entry, i) => {
    if (!isValidEntry(entry)) invalidEntries.push(`redoStack[${i}]`);
  });
  if (invalidEntries.length > 0) {
    return {
      status: 'corrupt',
      indexFile,
      entryCount: shape.undoStack.length,
      invalidEntries,
      reasonCode: 'SCHEMA',
      detail: `incomplete entries: ${invalidEntries.join(', ')}`,
    };
  }

  return {
    status: 'available',
    indexFile,
    entryCount: shape.undoStack.length,
    invalidEntries: [],
    reasonCode: null,
    detail: null,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
