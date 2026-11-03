// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 回退臂(2026-10-18 立):回退失败/不可用时那句「工作区未发生变化」的**事实来源**。
 *
 * 为什么单独立一个文件、而不是把这句话直接写进 undo 的返回文案里:
 * 那句话是**承诺**,而承诺必须由事实驱动。撤回是破坏性动作,用户敢不敢再试一次
 * 全靠"这次什么都没改成"这句;若它只是写死的措辞,那么在"第 1 步回滚成功、
 * 第 2 步失败"这种最常见的半途失败里,它就会变成一句安慰话 —— 工作区明明已经
 * 被改了一部分,界面还在说"未发生变化"。这是 AGENTS §里那条
 * 「越权用例要断言未发出查询(`whereSeen===0`)」的**用户界面版**:
 * 机器侧断言副作用没发生,人这一侧要给一句**等价**的话,而等价的前提是两侧
 * 同源 —— 都来自"前后两份快照的比对结果",不是来自作者的信心。
 *
 * 三条刻意的设计:
 * - **读不出来 = 没证明没变**(`FileState.unknown` ⇒ 判"变了")。拿不到的信息
 *   不许当证据用,否则"不知道"会被渲染成"没变",那一侧失效方向是让用户在
 *   已经改动的工作区上继续操作;
 * - 快照按**绝对路径**存、按相对路径对外:同一文件被两条 change 以不同写法
 *   (相对/绝对)记录时,不归一就会比成两个文件,漏掉真变化;
 * - 本模块只做"观察与比对",**不写任何文件**:判定权与改动权分开,
 *   回退的写入仍在 undo-redo.ts,本模块对它只读。
 */

import fs from 'node:fs';
import path from 'node:path';

/** 单个文件在某一时刻的可观察状态。 */
export type FileState =
  | { kind: 'present'; content: string }
  | { kind: 'absent' }
  | { kind: 'unknown'; reason: string };

/** 路径 → 状态。键一律是**绝对路径**(见头注第二条)。 */
export type WorkspaceSnapshot = ReadonlyMap<string, FileState>;

/**
 * 读取单个文件的当前状态。
 *
 * ENOENT 与"其他读错误"必须分开:前者是**确证不存在**(可与 'present' 比出变化),
 * 后者是**读不出来**(权限/锁/设备忙),按它判"不存在"就会把真变化读成没变。
 */
export function readFileState(fullPath: string): FileState {
  try {
    return { kind: 'present', content: fs.readFileSync(fullPath, 'utf-8') };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { kind: 'absent' };
    return { kind: 'unknown', reason: code ?? (err as Error).message };
  }
}

/** 相对路径 → 绝对路径(与 undo-redo.ts 的 applyChange 同一套解析,不得各写一份)。 */
export function resolveInWorkspace(filePath: string, workspacePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
}

/** 对一批路径取快照;去重(同一绝对路径只读一次)。 */
export function snapshotWorkspace(
  filePaths: readonly string[],
  workspacePath: string,
): WorkspaceSnapshot {
  const out = new Map<string, FileState>();
  for (const rel of filePaths) {
    const abs = resolveInWorkspace(rel, workspacePath);
    if (!out.has(abs)) out.set(abs, readFileState(abs));
  }
  return out;
}

/**
 * 详细比对:把"确证变了"与"读不出来"分开 —— 二者不是一回事。
 *
 * 失败方(给动作)要的是保守清单,所以 `diffWorkspaceSnapshots` 把两者都算"变了";
 * 而说给人听的承诺句必须区分它们,否则就是把谎换了方向。
 */
interface WorkspaceDiff {
  /** 逐文件逐字节确证变了(含一侧 absent 一侧 present) */
  readonly changed: readonly string[];
  /** 任一侧 unknown ⇒ 这一份比对不作数(没事实,不许声称) */
  readonly unverifiable: readonly string[];
}

/** 比对两份快照 → 确证变化 / 不可判定 两份清单(两个出口的唯一实现)。 */
export function diffWorkspaceSnapshotsDetailed(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): WorkspaceDiff {
  const changed: string[] = [];
  const unverifiable: string[] = [];
  const keys = new Set<string>([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const a = before.get(key);
    const b = after.get(key);
    if (a === undefined || b === undefined) {
      changed.push(key);
      continue;
    }
    if (a.kind === 'unknown' || b.kind === 'unknown') {
      unverifiable.push(key);
      continue;
    }
    if (a.kind === 'present' && b.kind === 'present') {
      if (a.content !== b.content) changed.push(key);
      continue;
    }
    if (a.kind !== b.kind) changed.push(key);
  }
  return { changed: [...changed].sort(), unverifiable: [...unverifiable].sort() };
}

/** 三态判定:不变 / 确证变了 / 判不了(与 web 侧 `classifyUndoWorkspace` 同名同义)。 */
export type UndoVerdict = 'unchanged' | 'changed' | 'unknown';

/**
 * 「工作区未发生变化」的三态判据(D163 收口刀)。
 *
 * 优先级写死,不许反过来:
 *   1. 有**确证**变化 ⇒ 'changed'(真变了就明说,不因别处有 unknown 而降级);
 *   2. 没有确证变化但有读不出来的 ⇒ 'unknown'(没事实就不许声称);
 *   3. 逐文件逐字节全都等价 ⇒ 'unchanged'。
 *
 * 反向锁:把 unknown 一律判成 'changed'(旧的两值化)会让第 2 档永假,
 * 于是"无法核实"这句话永远说不出口 —— 那只是把谎换了方向(D163 票面铁律:
 * 不许只改文案,也不许把"没事实"说成"变了")。
 */
export function classifyUndoVerdict(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): UndoVerdict {
  const { changed, unverifiable } = diffWorkspaceSnapshotsDetailed(before, after);
  if (changed.length > 0) return 'changed';
  if (unverifiable.length > 0) return 'unknown';
  return 'unchanged';
}

/**
 * 比对两份快照 → **发生了变化**的绝对路径列表。
 *
 * 变化的三型 + 一型不可判定:
 * - 一侧 present 一侧 absent ⇒ 变了(新建或删除);
 * - 两侧 present 而内容不同 ⇒ 变了;
 * - 仅出现在某一侧(路径集不同)⇒ 变了;
 * - 任一侧 unknown ⇒ **按"变了"报**(拿不到的信息不许当"没变"的证据)。
 *
 * 这是 fail-closed 的报法,给"要动手的人"一张最保守的清单。但**说给人听**的
 * 那句必须比它更细:把"读不出来"说成"已发生变化"也是谎(方向相反的谎)。
 * 要区分,用 `diffWorkspaceSnapshotsDetailed` / `classifyUndoVerdict`。
 *
 * 实现只此一份,两个详略出口都由它派生(§0.6 单一真相源)。
 */
export function diffWorkspaceSnapshots(before: WorkspaceSnapshot, after: WorkspaceSnapshot): string[] {
  const { changed, unverifiable } = diffWorkspaceSnapshotsDetailed(before, after);
  return [...changed, ...unverifiable].sort();
}

/**
 * 「工作区未发生变化」的唯一判据(两值出口,供只要布尔的老调用方)。
 *
 * 只有当 verdict 为 'unchanged' 时才为真。'unknown' 一律为假:
 * fail-closed,拿不到的信息不当证据。**语义与三态版完全一致** ——
 * 本函数只是 `classifyUndoVerdict(...) === 'unchanged'` 的别名,不另写一份判据。
 */
export function isWorkspaceUnchanged(before: WorkspaceSnapshot, after: WorkspaceSnapshot): boolean {
  return classifyUndoVerdict(before, after) === 'unchanged';
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
