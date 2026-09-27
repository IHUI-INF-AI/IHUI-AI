// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D113(2026-09-27)文件写类工具的**流中 diff 预览** —— CLI 侧唯一出口。
 *
 * 为什么这一端要自己派生(而不是像 web/RN/小程序那样收 `tool-delta` SSE 帧):
 * CLI 的工具在**本地执行**,服务端 `apps/ai-service/app/routers/llm.py` 的发帧路径
 * 根本不会被走到 —— 该端既不携带 `agentTools`,其调用又经
 * `commands/agent.ts:dispatchEarlyTool` / `executeToolCall` 在进程内完成。
 * 所以"执行前把将要写入的内容先给用户看一眼"这件事,只能由本地执行器在
 * **执行之前**从已有的工具参数派生;派生的**算法与预算必须与服务端同一语义**,
 * 不得自创第二套判据(本文件因此与服务端逐字对齐,并由两把尺子钉住):
 *
 *   · `apps/ai-service/tests/fixtures/file-edit-preview-cases.json` —— 由**服务端真实函数**
 *     生成的向量与期望值(Python 侧写入,TS 侧只读)。
 *   · `apps/cli/tests/file-edit-preview-parity.test.ts` —— TS 实现跑同一批向量必须逐字等值,
 *     并**静态解析 llm.py 源码**核预算常量与取键表(改一侧数字即点名两侧)。
 *   · `apps/ai-service/tests/test_file_edit_preview_parity.py` —— 反向:Python 函数重算同一批
 *     向量,必须仍等于台账期望值。
 *
 * 一处**已声明的**不对称(不是静默漂移,由上述 parity 测试逐条钉死):
 * 服务端 `edit_file` 只认 `new_string`,而 CLI 的 `edit_file`(`tools/file-edit.ts:263`)
 * 的参数面是 `search`/`replace`/`patch` —— 按服务端语义它**永远派生不出预览**。
 * 这里在共享规则之后追加一个 CLI 本地兜底键 `replace`,让该端第二个写类工具也拿得到
 * 与其余三端**同一观感**的预览(其余三端对 file_edit 显示的也正是"新内容"那一段)。
 * 除此之外两版算法一字不差。
 */
import type { ToolDeltaEvent } from '@ihui/api-client';

/**
 * 工具名 → 预览取键顺序(取第一个 string 值)。
 * `edit_file` 的第二项 `replace` 是上面那段**已声明的 CLI 本地扩展**;
 * 服务端侧只有 `new_string`,该差异由 parity 测试逐条点名,不得静默增键。
 */
export const FILE_EDIT_PREVIEW_KEYS: Readonly<Record<string, readonly string[]>> = {
  write_file: ['content'],
  file_edit: ['new_string'],
  edit_file: ['new_string', 'replace'],
};

// ── 预算常量:与服务端 `_PREVIEW_*`(llm.py)逐值同形,改动必须两侧同步 ──
/** 单次预览最多发出的帧数 */
export const PREVIEW_MAX_FRAMES = 10;
/** 每帧累积多少行(第 N 帧带前 N×40 行) */
export const PREVIEW_LINES_PER_FRAME = 40;
/** 预览文本总行上限 */
export const PREVIEW_MAX_LINES = 400;
/** 预览文本总字符上限(与 Python 同口径:**码点**数,不是 UTF-16 单元数) */
export const PREVIEW_MAX_CHARS = 32 * 1024;

/**
 * Python `str.splitlines()` 的等价切分(服务端用 splitlines,JS 的 `split('\n')` 不等价)。
 * 边界集合照抄 CPython:`\n` `\r` `\r\n` `\v` `\f` `\x1c` `\x1d` `\x1e` `\x85` `\u2028` `\u2029`,
 * 且**行尾分隔符不产出多余空段**(`'a\n'.splitlines() === ['a']`、`''.splitlines() === []`)。
 */
const LINE_BOUNDARY_RE = /\r\n|[\n\r\u000B\u000C\u001C\u001D\u001E\u0085\u2028\u2029]/;
export function pySplitlines(text: string): string[] {
  if (text === '') return [];
  const parts = text.split(LINE_BOUNDARY_RE);
  return parts[parts.length - 1] === '' ? parts.slice(0, -1) : parts;
}

/** Python `len(str)`:码点数(emoji 等增补平面字符算 1,与 `string.length` 不同) */
export function pyLen(text: string): number {
  return Array.from(text).length;
}

/**
 * 从工具参数派生预览文本(纯函数,不触碰磁盘、不执行)。
 * 与 Python 侧一致:工具名不在表内 / 取到的值不是字符串 → `null`。
 */
export function fileEditPreviewText(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  const keys = FILE_EDIT_PREVIEW_KEYS[toolName];
  if (!keys) return null;
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

/** 一帧预览:`partialText` 是**累积**文本(整帧替换渲染),`truncated` 只在末帧为真 */
export interface PreviewFrame {
  partialText: string;
  truncated: boolean;
}

/**
 * 把预览文本切成累积帧序列 —— 与服务端 `_file_edit_preview_frames` 逐语义同形:
 * 先按 splitlines 切行,超 400 行或超 32K 码点即置 `truncated`,再逐行按字符预算裁剪
 * (裁剪命中也置 truncated 并**停止**追加),最后每 40 行出一帧、帧数封顶 10。
 */
export function fileEditPreviewFrames(text: string): PreviewFrame[] {
  const lines = pySplitlines(text);
  let truncated = lines.length > PREVIEW_MAX_LINES || pyLen(text) > PREVIEW_MAX_CHARS;
  const kept: string[] = [];
  let used = 0;
  for (const line of lines.slice(0, PREVIEW_MAX_LINES)) {
    if (used + pyLen(line) + 1 > PREVIEW_MAX_CHARS) {
      truncated = true;
      break;
    }
    kept.push(line);
    used += pyLen(line) + 1;
  }
  const frames: PreviewFrame[] = [];
  for (let i = 0; i < kept.length; i += PREVIEW_LINES_PER_FRAME) {
    const isLastBatch = i + PREVIEW_LINES_PER_FRAME >= kept.length;
    frames.push({
      partialText: kept.slice(0, i + PREVIEW_LINES_PER_FRAME).join('\n'),
      truncated: truncated && isLastBatch,
    });
  }
  return frames.slice(0, PREVIEW_MAX_FRAMES);
}

/**
 * 一次工具调用 → 该发的帧序列(seq 从 **1** 起,与服务端 `enumerate(..., start=1)` 同形)。
 * 空 `toolCallId` / 非写类工具 / 取不到文本 → 空数组(不发帧,与三端"空 id 丢弃"同一条纪律)。
 */
export function buildFileEditPreviewEvents(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
): ToolDeltaEvent[] {
  if (!toolCallId) return [];
  const text = fileEditPreviewText(toolName, args);
  if (!text) return [];
  return fileEditPreviewFrames(text).map(
    (frame, index): ToolDeltaEvent => ({
      toolCallId,
      seq: index + 1,
      partialText: frame.partialText,
      ...(frame.truncated ? { truncated: true } : {}),
    }),
  );
}

/** 某一 toolCallId 当前的预览状态(整帧覆盖后的结果) */
export interface ToolDeltaPreview {
  partialText: string;
  truncated: boolean;
}

/**
 * 渲染门(与其余三端同一条判据):web 的 `status === 'running' && partialDiff`、
 * 小程序的 `c.status === 'running' && c.partialDiff` —— CLI 终端没有常驻卡片,
 * "running" 的等价事实是**这张工具卡还开着**(spinner 在跑)。
 * 返回该输出的预览文本,`null` = 本次不输出。抽成纯函数是为了让这条规则被行为测试
 * 直接问,而不是靠断言渲染文件里的字符串。
 */
export function pickToolDeltaPreviewText(input: {
  running: boolean;
  preview: ToolDeltaPreview | undefined;
}): string | null {
  if (!input.running) return null;
  const text = input.preview?.partialText;
  return text ? text : null;
}

/**
 * 按 `toolCallId` 存流中预览 —— 与其余三端同一条状态语义:
 * **整帧覆盖**(payload 本就是累积文本,故同 seq 重放天然幂等,seq 不参与判断)、
 * 空 `toolCallId` 丢弃、工具落终态(完成/失败)即清除(最终 diff 以 result 为准)。
 *
 * 为什么这一端需要一个本地 store 而不是直接渲染:预览文本可能一次到齐(本地派生)
 * 也可能逐帧到(将来接真流),渲染端只该读"当前累积值",而不是自己拼帧。
 */
export interface ToolDeltaPreviewStore {
  /** 应用一帧;`false` = 该帧被丢弃(空 toolCallId) */
  apply(event: ToolDeltaEvent): boolean;
  get(toolCallId: string): ToolDeltaPreview | undefined;
  clear(toolCallId: string): void;
  clearAll(): void;
  /** 当前持有预览的 toolCallId(按写入顺序) */
  ids(): string[];
}

export function createToolDeltaPreviewStore(): ToolDeltaPreviewStore {
  const byId = new Map<string, ToolDeltaPreview>();
  return {
    apply(event) {
      if (!event || typeof event.toolCallId !== 'string' || event.toolCallId === '') return false;
      byId.set(event.toolCallId, {
        partialText: event.partialText,
        truncated: event.truncated === true,
      });
      return true;
    },
    get(toolCallId) {
      return byId.get(toolCallId);
    },
    clear(toolCallId) {
      byId.delete(toolCallId);
    },
    clearAll() {
      byId.clear();
    },
    ids() {
      return [...byId.keys()];
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
