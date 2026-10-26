// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /undo /redo 命令 — 多步文件改动回滚/重做。
 *
 * 对标并反超 OpenCode:OpenCode 的 undo 只回滚最后一个文件改动,
 * 本实现支持多步回滚(回滚到指定步数)+ redo 重做 + 持久化(每 session 一个 JSON)。
 *
 * 持久化路径:<workspacePath>/.ihui-agent/undo-history/<sessionId>.json
 *   - undoStack:已执行的工具改动栈(栈顶=最近)
 *   - redoStack:被 undo 的改动栈(栈顶=最近被 undo)
 *
 * 语义:
 *   - undo:从 undoStack pop N 个 change,反向应用(beforeContent → 文件),push 到 redoStack
 *   - redo:从 redoStack pop N 个 change,正向应用(afterContent → 文件),push 回 undoStack
 *   - 新 recordChange 清空 redoStack(标准 undo/redo 语义)
 *   - undoStack 上限 100,超过自动 shift 最老的
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// D163 回退臂(2026-10-18 立):撤回前后的工作区快照与比对。
// 接进来的唯一理由:/undo 现在的失败路径是**异常冒泡**——applyChange 用
// fs.writeFileSync/unlinkSync,中途任一文件写失败就整段抛出,返回面里
// 一个字都没提"工作区到底被改成什么样了"。于是"工作区未发生变化"这句话
// 当前既无处可说、也无事实可依。现在它由前后两份快照的比对结果驱动。
// D163 收口刀(2026-10-18 第二轮):比对结论不再只躺在布尔里,而是升成三态
// `verdict`(unchanged / changed / unknown)并由 `undo-claim-copy.ts` 分派到
// 八句文案 —— "判不了"与"未变化"从此说不同的话,且"没得撤"与"撤了全失败"
// 也不再共用同一句(详见该文件头注)。
import {
  classifyUndoVerdict,
  diffWorkspaceSnapshots,
  snapshotWorkspace,
  type UndoVerdict,
} from './undo-workspace-state.js';
// D22046 通道②:动手**之前**把"检查点能不能用"读成结构化事实。
import {
  probeUndoCheckpoint,
  type UndoCheckpointProbe,
} from './undo-checkpoint-state.js';

/** 单次工具调用产生的文件改动 */
export interface FileChange {
  /** 工具名:write_file / edit_file / bash (with file op) */
  toolName: string;
  /** 文件路径(相对工作区或绝对路径) */
  filePath: string;
  /** 改动前内容;null = 文件原本不存在(新建) */
  beforeContent: string | null;
  /** 改动后内容;null = 文件被删除 */
  afterContent: string | null;
  /** 改动时间戳(epoch ms) */
  timestamp: number;
}

/** /undo 返回 */
export interface UndoResult {
  undoneSteps: number;
  changes: FileChange[];
  /** 剩余可 undo 的步数 */
  remaining: number;
  /**
   * D163 回退不可用原因分档:本轮回退实际**尝试**了几条。
   *
   * 0 = 检查点里本来就没有可回滚项(无快照 / 记录读不出来);
   * >0 而 `undoneSteps===0` = 检查点有条目但回退动作全失败(暂时不可用)。
   * 这两件事票面给了两句不同的话,靠本字段与 `undoneSteps` 分开选择。
   */
  attemptedSteps: number;
  /** D163:回滚**失败**的文件(记录时用的路径写法)。空 = 全部成功。 */
  failedFiles: string[];
  /** D163:撤销失败原因(与 failedFiles 一一对应,逐条点名,不合并成一个大桶)。 */
  failedReasons: string[];
  /**
   * D163:这句话是**承诺**,必须由比对驱动 —— 只有撤销前后两份快照逐文件
   * 逐字节等价才为真。调用方拿到 false 时**不许**渲染"工作区未发生变化":
   * 半途失败的撤回已经把工作区改了一部分,那句话会变成安慰话。
   * 读不出来的文件一律判 false(fail-closed,拿不到的信息不当证据)。
   */
  workspaceUnchanged: boolean;
  /**
   * D163 收口刀:三态判据,驱动"用户看到的那一句"。
   *
   * `workspaceUnchanged` 是它的两值别名(为只要布尔的老调用方留着);
   * 新代码一律读这个字段 —— 因为"判不了"与"未变化"必须说不同的话,
   * 压成布尔就只能把其中一种谎说出来。
   */
  verdict: UndoVerdict;
  /**
   * D163:确实发生了变化的文件(绝对路径),供上层给具体动作而非只报失败。
   *
   * 注意与 `verdict` 的分工:本清单含"读不出来"的条目(fail-closed 报法,
   * 与 web 侧不同,这里刻意保守);要区分确证/不可判定,读 `verdict`。
   */
  changedFiles: string[];
  /** D163:部分失败 ⇒ 撤销结果不完整(对应票面 undoPartialWarning 那一态)。 */
  partial: boolean;
  /** D22046:回退失败涉及的**步数/轮次**(与失败文件数不同:一轮可含多个文件)。 */
  failedSteps: number;
  /**
   * D22046 通道②:撤销**之前**探测到的检查点可用性(结构化,不是日志)。
   *
   * 与 `attemptedSteps` 的分工:本字段说明"有没有得撤、索引能不能读",
   * 后者说明"实际动了几次手"。`status!=='available'` 时本函数不动任何文件,
   * 上层据此选择"先修检查点"而不是"重试";`available` 而 `undoneSteps===0`
   * 才是"可用但执行失败",两档在文案与动作上都不许合并。
   */
  checkpoint: UndoCheckpointProbe;
}

/**
 * D22046 通道③:回退观察器的依赖注入口。
 *
 * 生产默认值就是 HEAD 里那一套(快照 / 三态判定 / 差异清单 / 探测),
 * 注入只为让测试能构造"比对恒真"的变异体 —— 变异必须改的是**注入的依赖**,
 * 不许为了让用例变绿去改生产判据(§12e/§12f)。
 */
export interface UndoRedoDeps {
  readonly snapshotWorkspace?: typeof snapshotWorkspace;
  readonly classifyUndoVerdict?: typeof classifyUndoVerdict;
  readonly diffWorkspaceSnapshots?: typeof diffWorkspaceSnapshots;
  readonly probeCheckpoint?: (indexFile: string) => UndoCheckpointProbe;
}

/** /redo 返回 */
export interface RedoResult {
  redoneSteps: number;
  changes: FileChange[];
  /** 剩余可 redo 的步数 */
  remaining: number;
}

/**
 * D163 收口刀:`--dry-run` 的计划 —— 将恢复多少文件、影响多少轮。
 *
 * **不弹栈、不写文件、不 persist**:预览与执行共用同一套取数(undoStack 栈顶
 * N 条),否则"预览说 3 个文件、真跑恢复 2 个"就又造出一句不可信的话。
 */
export interface UndoPlan {
  readonly fileCount: number;
  readonly turnCount: number;
  readonly files: readonly string[];
}

/** /undo list 单条条目 */
export interface ChangeEntry {
  step: number;
  toolName: string;
  filePath: string;
  timestamp: number;
  /** 人类可读描述 */
  description: string;
}

/** 单 session 的持久化结构 */
interface SessionHistory {
  undoStack: FileChange[];
  redoStack: FileChange[];
}

/** undoStack 最大容量,超过自动丢弃最老的 */
const MAX_UNDO_STACK = 100;

/**
 * UndoRedoManager — 管理 per-session 的文件改动 undo/redo 栈。
 *
 * 用法:
 *   const mgr = new UndoRedoManager(process.cwd());
 *   mgr.recordChange(sessionId, { toolName, filePath, beforeContent, afterContent, timestamp });
 *   await mgr.undo(sessionId, 2);   // 回滚最近 2 步
 *   await mgr.redo(sessionId, 1);   // 重做 1 步
 *   mgr.listUndoable(sessionId);    // 列出可回滚改动
 */
export class UndoRedoManager {
  private readonly workspacePath: string;
  /** 内存缓存:sessionId → history(首次访问时从磁盘 load) */
  private readonly cache: Map<string, SessionHistory> = new Map();
  private readonly deps: Required<UndoRedoDeps>;

  constructor(workspacePath: string, deps: UndoRedoDeps = {}) {
    this.workspacePath = workspacePath;
    this.deps = {
      snapshotWorkspace,
      classifyUndoVerdict,
      diffWorkspaceSnapshots,
      probeCheckpoint: (indexFile: string) => probeUndoCheckpoint(indexFile),
      ...deps,
    };
  }

  /** 持久化目录:<workspacePath>/.ihui-agent/undo-history/ */
  private getHistoryDir(): string {
    return path.join(this.workspacePath, '.ihui-agent', 'undo-history');
  }

  private getHistoryFile(sessionId: string): string {
    return path.join(this.getHistoryDir(), `${sessionId}.json`);
  }

  /**
   * 记录一次工具调用产生的文件改动(在工具执行后调用)。
   * 新改动会清空 redoStack(标准 undo/redo 语义)。
   */
  recordChange(sessionId: string, change: FileChange): void {
    this.load(sessionId);
    const history = this.cache.get(sessionId)!;
    history.undoStack.push(change);
    // 超过上限移除最老的
    while (history.undoStack.length > MAX_UNDO_STACK) {
      history.undoStack.shift();
    }
    // 新改动清空 redo 栈
    history.redoStack = [];
    this.persist(sessionId);
  }

  /**
   * /undo [steps=1] — 回滚最近 N 步改动。
   * 从 undoStack 栈顶 pop,反向应用(beforeContent → 文件),push 到 redoStack。
   */
  async undo(sessionId: string, steps: number = 1): Promise<UndoResult> {
    // D22046 通道②:先探测再动手。索引缺失 / 读不出来 / 条目残缺时,
    // 一个文件都不碰,并把事实原样交给上层 —— 这条路径与"试了但失败"
    // 在结果里必须是两种可分辨的形态,否则文案又会退回"一律同一句"。
    const checkpoint = this.deps.probeCheckpoint(this.getHistoryFile(sessionId));
    this.load(sessionId);
    const history = this.cache.get(sessionId)!;
    if (checkpoint.status !== 'available') {
      return {
        undoneSteps: 0,
        changes: [],
        remaining: history.undoStack.length,
        attemptedSteps: 0,
        failedFiles: [],
        failedReasons: [],
        workspaceUnchanged: true,
        verdict: 'unchanged',
        changedFiles: [],
        partial: false,
        failedSteps: 0,
        checkpoint,
      };
    }
    const actualSteps = Math.min(steps, history.undoStack.length);
    if (actualSteps <= 0) {
      // 无步可撤:一个字节都没动过(连失败的写入都没发生)⇒ 那句承诺成立。
      // 这一格不能省:省了,"什么都没做"就会被上层读成"不知道有没有变"。
      return {
        undoneSteps: 0,
        changes: [],
        remaining: history.undoStack.length,
        attemptedSteps: 0,
        failedFiles: [],
        failedReasons: [],
        workspaceUnchanged: true,
        verdict: 'unchanged',
        changedFiles: [],
        partial: false,
        failedSteps: 0,
        checkpoint,
      };
    }
    // 先取出待撤销的 N 条(栈顶 → 栈底),**刻意先不逐条 pop 再 catch**:
    // 边 pop 边 catch 会把失败的那几条直接丢掉,用户连"再试一次"的机会都没有。
    const pending: FileChange[] = [];
    for (let i = 0; i < actualSteps; i++) {
      const top = history.undoStack.pop();
      if (!top) break;
      pending.push(top);
    }
    // D163 第一刀:撤销**前**的快照。之后那句"工作区未发生变化"由这一份与
    // 撤销后的那一份比对得出,而不是由"回滚应该会成功"这个假设得出。
    const watchPaths = pending.map((c) => c.filePath);
    const before = this.deps.snapshotWorkspace(watchPaths, this.workspacePath);
    const undone: FileChange[] = [];
    const failed: FileChange[] = [];
    const failedFiles: string[] = [];
    const failedReasons: string[] = [];
    for (const change of pending) {
      try {
        this.applyChange(change, true);
        history.redoStack.push(change);
        undone.push(change);
      } catch (err) {
        failed.push(change);
        failedFiles.push(change.filePath);
        failedReasons.push(
          `${(err as NodeJS.ErrnoException).code ?? 'ERROR'}: ${(err as Error).message}`,
        );
      }
    }
    // 失败的按**原顺序**放回 undoStack 栈顶(逆序 push 才还原原来的栈顶优先),
    // 工作量没白记 —— 否则这一次撤回就等于把改动历史删掉了。
    for (const change of [...failed].reverse()) {
      history.undoStack.push(change);
    }
    this.persist(sessionId);
    const after = this.deps.snapshotWorkspace(watchPaths, this.workspacePath);
    const verdict = this.deps.classifyUndoVerdict(before, after);
    return {
      undoneSteps: undone.length,
      changes: undone,
      remaining: history.undoStack.length,
      attemptedSteps: pending.length,
      failedFiles,
      failedReasons,
      workspaceUnchanged: verdict === 'unchanged',
      verdict,
      changedFiles: this.deps.diffWorkspaceSnapshots(before, after),
      partial: failed.length > 0,
      failedSteps: failed.length,
      checkpoint,
    };
  }

  /**
   * D163:`/undo --dry-run` 的计划(只读,不动栈)。
   *
   * 与 `undo()` 取同一批数:`undoStack` 栈顶 `min(steps, len)` 条,文件数按
   * 去重后的路径算 —— 同一条文件被两步各改一次,恢复它算一次而非两次。
   */
  async previewUndo(sessionId: string, steps: number = 1): Promise<UndoPlan> {
    this.load(sessionId);
    const history = this.cache.get(sessionId)!;
    const actualSteps = Math.min(steps, history.undoStack.length);
    if (actualSteps <= 0) return { fileCount: 0, turnCount: 0, files: [] };
    const pending = history.undoStack.slice(-actualSteps);
    const files = [...new Set(pending.map((c) => c.filePath))].sort();
    return { fileCount: files.length, turnCount: actualSteps, files };
  }

  /**
   * /redo [steps=1] — 重做最近 N 步被 undo 的改动。
   * 从 redoStack 栈顶 pop,正向应用(afterContent → 文件),push 回 undoStack。
   */
  async redo(sessionId: string, steps: number = 1): Promise<RedoResult> {
    this.load(sessionId);
    const history = this.cache.get(sessionId)!;
    const actualSteps = Math.min(steps, history.redoStack.length);
    if (actualSteps <= 0) {
      return { redoneSteps: 0, changes: [], remaining: history.redoStack.length };
    }
    const redone: FileChange[] = [];
    for (let i = 0; i < actualSteps; i++) {
      const change = history.redoStack.pop();
      if (!change) break;
      // 正向应用:afterContent → 文件
      this.applyChange(change, false);
      history.undoStack.push(change);
      redone.push(change);
    }
    this.persist(sessionId);
    return {
      redoneSteps: redone.length,
      changes: redone,
      remaining: history.redoStack.length,
    };
  }

  /**
   * /undo list — 列出可回滚的改动(栈顶=最近,排在前面)。
   */
  listUndoable(sessionId: string): ChangeEntry[] {
    this.load(sessionId);
    const history = this.cache.get(sessionId)!;
    const entries: ChangeEntry[] = [];
    // 倒序展示:栈顶(step=1)在前
    for (let i = history.undoStack.length - 1; i >= 0; i--) {
      const change = history.undoStack[i]!;
      const step = history.undoStack.length - i;
      entries.push({
        step,
        toolName: change.toolName,
        filePath: change.filePath,
        timestamp: change.timestamp,
        description: this.describeChange(change),
      });
    }
    return entries;
  }

  /**
   * 应用或反向应用一个 change 到文件系统。
   * @param change 文件改动
   * @param reverse true=反向(beforeContent → 文件,用于 undo);false=正向(afterContent → 文件,用于 redo)
   */
  private applyChange(change: FileChange, reverse: boolean): void {
    const fullPath = path.isAbsolute(change.filePath)
      ? change.filePath
      : path.resolve(this.workspacePath, change.filePath);
    const content = reverse ? change.beforeContent : change.afterContent;
    if (content === null) {
      // reverse=true 且 beforeContent=null → 文件原本不存在,删除当前文件
      // reverse=false 且 afterContent=null → 文件应被删除
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } else {
      // 确保父目录存在(新建文件场景)
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  }

  /** 生成人类可读的改动描述 */
  private describeChange(change: FileChange): string {
    const fileName = path.basename(change.filePath);
    if (change.beforeContent === null && change.afterContent !== null) {
      return `${change.toolName} 新建 ${fileName}`;
    }
    if (change.afterContent === null && change.beforeContent !== null) {
      return `${change.toolName} 删除 ${fileName}`;
    }
    return `${change.toolName} 修改 ${fileName}`;
  }

  /** 持久化:把内存中的 history 写入 JSON 文件 */
  private persist(sessionId: string): void {
    const history = this.cache.get(sessionId);
    if (!history) return;
    const dir = this.getHistoryDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.getHistoryFile(sessionId), JSON.stringify(history, null, 2), 'utf-8');
  }

  /** 加载:从磁盘 JSON 读取 history 到内存缓存(已缓存则跳过) */
  private load(sessionId: string): void {
    if (this.cache.has(sessionId)) return;
    const file = this.getHistoryFile(sessionId);
    let history: SessionHistory = { undoStack: [], redoStack: [] };
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<SessionHistory>;
        if (parsed && Array.isArray(parsed.undoStack) && Array.isArray(parsed.redoStack)) {
          history = { undoStack: parsed.undoStack, redoStack: parsed.redoStack };
        }
      } catch {
        // 损坏的文件,使用空 history
      }
    }
    this.cache.set(sessionId, history);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
