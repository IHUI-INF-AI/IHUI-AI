// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 大文件的「真实行数 / 按行窗口」读取器(纯函数 + 流式扫描,便于单测)。
 *
 * 病灶:`read_file` 用 `readHeadOfFile(abs, MAX_READ_BYTES)` 只读前 512KB,再
 * `text.split('\n')` —— 于是「首 512KB 内的换行数」被当成「文件总行数」:
 * `D:\IHUI-AI\PROJECT_PLAN.md` 真实 33751 行,首 512KB 只有 3428 个换行,
 * 工具却报告"文件只有 3429 行",任何 `offset >= 3430` 一律判成越过末尾 ——
 * 结构上不可达,台账里 31455 / 31464 行的票**永远读不到**。
 *
 * 正确语义:`offset` / `limit` 是**行号窗口**,行数是**文件的真实行数**;
 * `MAX_READ_BYTES` 只限制"单次回给模型的正文字节",不限制"只许认识前 512KB"。
 * 因此本模块按行流式扫描:数行用真实换行数,取窗口按行定位后再按 `maxBytes` 截取。
 *
 * 三条口径(与 `builtins.ts` 既有 `text.split('\n')` 逐字对齐,否则快慢两条路径
 * 会对同一个文件报出两个不同的"总行数"):
 *  1. **总行数 = 换行符个数 + 1**。以换行符结尾的文件,inode 里没有那一行,但
 *     `'a\n'.split('\n')` 是 `['a','']` —— 快路径数出来是 2,这里也必须报 2,
 *     否则同一文件在"512KB 以内 / 以上"两种读法下会给出两个总行数。
 *  2. **行内容按字节切、按 utf8 解**,`\r` 保留在行尾(与 `split('\n')` 同形:
 *     CRLF 文件的行内容是 `'foo\r'`)。
 *  3. **判不了就说判不了**:扫描有硬上限 `MAX_LINE_SCAN_BYTES`,到顶还没扫完时
 *     `totalLinesExact=false`,`totalLines` 是**下界**;此时不得把下界当结论去
 *     判"越过文件末尾"(那正是本票要消灭的失效方向:拿一个数冒充另一个数)。
 *
 * 为什么不是"先 stat 再除以平均行长"或"二分定位":行不是定长的,任何估算都会
 * 在长行文件上给出假数;二分定位需要随机读,且每轮都不确定落在行内哪里,反而更慢。
 * 一次顺序扫描的代价是 O(文件字节),8.6MB 量级约 10ms;而且总行数本来就得数完
 * 才知道,与"要不要取窗口"无关 —— 所以行数与窗口共用同一趟 I/O。
 */

import * as fs from 'node:fs';

/** 顺序扫描的分块大小:一次 1MB 读,够大(减少系统调用)又不至于在病态文件上占内存 */
const LINE_SCAN_CHUNK_BYTES = 1024 * 1024;

/**
 * 数行的**硬上限**(64MB)。超过它的文件不再继续扫:
 *  - 收益急剧下降(再扫 1GB 只为了给模型报一个总行数);
 *  - 不设上限等于让一次 read_file 变成一次无上限顺序读,工具执行预算会被它吃掉。
 * 到顶时 `totalLinesExact=false`,`totalLines` 是下界 —— 如实报"至少 N 行"。
 */
export const MAX_LINE_SCAN_BYTES = 64 * 1024 * 1024;

/** 换行符字节(只认 LF;CRLF 的 `\r` 属于行内容,与 `split('\n')` 同形) */
const LF = 0x0a;

/** 替换字符:字节窗口切在多字节序列中间时,utf8 解码会产出它 */
const REPLACEMENT_CHAR = '\uFFFD';

/** 一次行扫描的预算 */
export interface LineScanBudget {
  /** 扫描字节上限,缺省 `MAX_LINE_SCAN_BYTES` */
  byteCap?: number;
}

/** 行数统计结果 */
export interface LineCount {
  /** 真实总行数(换行符数 + 1);`totalLinesExact=false` 时是**下界** */
  totalLines: number;
  /** 是否扫到了文件末尾(false = 撞上 `byteCap`,上面的数是下界而不是结论) */
  totalLinesExact: boolean;
  /** 实际扫描了多少字节 */
  bytesScanned: number;
  /** 文件总字节数(fstat,与扫描同一句柄) */
  totalBytes: number;
}

/** 行窗口读取参数 */
export interface ReadLineWindowOptions extends LineScanBudget {
  /** 起始行号(1-based);缺省 1 */
  offset?: number;
  /** 最多取多少行;缺省读到文件尾 */
  limit?: number;
  /** 本次回给模型的正文字节上限(不含行号前缀) */
  maxBytes: number;
}

/**
 * `offset` 的三种结局。**不合并 `beyond-eof` 与 `indeterminate`**:
 * 前者是"文件确实没这么长"这一条事实,后者是"我只数到 64MB,判不了"——
 * 把判不了说成事实,正是本票要修的那个失效方向。
 */
export type LineWindowOffsetResolution = 'ok' | 'beyond-eof' | 'indeterminate';

/** 行窗口读取结果 */
export interface LineWindow extends LineCount {
  /** 窗口内的行(不含行尾换行符);空窗口 = `offset` 越界 */
  lines: string[];
  /** 窗口起始行号(1-based) */
  startLine: number;
  /** 窗口最后一行的行号(空窗口 = `startLine - 1`) */
  endLine: number;
  /** 窗口正文的字节数(utf8,不含行号前缀与注记) */
  bytesRead: number;
  /** 窗口是否因 `maxBytes` 被截短(后面还有属于点名窗口的行没回) */
  byteLimited: boolean;
  /** `offset` 落在哪:ok / 确实越界 / 扫描上限内判不了 */
  offsetResolution: LineWindowOffsetResolution;
}

interface RawScan {
  lines: string[];
  reachedOffset: boolean;
  totalNewlines: number;
  /** 是否扫到了文件末尾 */
  complete: boolean;
  bytesScanned: number;
  totalBytes: number;
  bytesRead: number;
  byteLimited: boolean;
}

/**
 * 一次顺序扫描,同时产出"行数"与"窗口内容"。
 *
 * `collect=false` 时只数行(不缓冲任何行内容),给只需要总量的调用方用。
 */
function scanFile(
  filePath: string,
  opts: {
    offset: number;
    limit?: number;
    maxBytes: number;
    byteCap: number;
    collect: boolean;
  },
): RawScan {
  const fd = fs.openSync(filePath, 'r');
  try {
    const totalBytes = fs.fstatSync(fd).size;
    const scanEnd = Math.min(totalBytes, Math.max(0, opts.byteCap));
    const scanCapped = totalBytes > scanEnd;
    const chunkBytes = Math.max(1, Math.min(LINE_SCAN_CHUNK_BYTES, scanEnd));
    const buf = Buffer.allocUnsafe(chunkBytes);

    const lines: string[] = [];
    /** 已收集行的正文字节数(不含行间换行符;换行符在收尾时按行数补) */
    let contentBytes = 0;
    /** 当前正在扫的行号(1-based) */
    let lineNo = 1;
    let reachedOffset = false;
    /** 窗口已收满 / 已被字节上限切断 —— 之后再遇到的行只数不取 */
    let windowDone = false;
    let byteLimited = false;
    let totalNewlines = 0;
    let bytesScanned = 0;
    /** 当前行在窗口内时的已读字节(跨块拼接) */
    let pending: Buffer[] = [];
    let pendingBytes = 0;
    /** 当前行是否需要落到 `lines` 里(pending 可能为空:空行) */
    let pendingLine = false;

    let base = 0;
    while (base < scanEnd) {
      const want = Math.min(chunkBytes, scanEnd - base);
      const read = fs.readSync(fd, buf, 0, want, base);
      if (read <= 0) break;
      const view = buf.subarray(0, read);

      let i = 0;
      while (i < read) {
        const nl = view.indexOf(LF, i);
        const segEnd = nl === -1 ? read : nl;
        const segBytes = segEnd - i;
        const collecting = opts.collect && !windowDone && lineNo >= opts.offset;

        if (collecting) {
          reachedOffset = true;
          if (contentBytes + segBytes <= opts.maxBytes) {
            pendingLine = true;
            if (segBytes > 0) {
              pending.push(Buffer.from(view.subarray(i, segEnd)));
              pendingBytes += segBytes;
            }
          } else {
            // 本行放不下:把能放下的字节前缀留下(单行巨文件的唯一出路),
            // 窗口到此为止,后面的行只数不取。
            const room = Math.max(0, opts.maxBytes - contentBytes);
            if (room > 0) {
              pending.push(Buffer.from(view.subarray(i, i + room)));
              pendingBytes += room;
              pendingLine = true;
            }
            byteLimited = true;
            windowDone = true;
          }
        }

        if (nl === -1) {
          // 行没结束(跨块,或文件末尾没有换行符)
          i = read;
          break;
        }

        totalNewlines += 1;
        if (pendingLine) {
          const text = decodeLine(pending, pendingBytes, byteLimited);
          lines.push(text);
          contentBytes += Buffer.byteLength(text, 'utf8');
          pending = [];
          pendingBytes = 0;
          pendingLine = false;
          if (opts.limit !== undefined && lines.length >= opts.limit) windowDone = true;
        }
        lineNo += 1;
        i = segEnd + 1;
      }

      base += read;
      bytesScanned = base;
    }

    if (opts.collect && pendingLine) {
      // 文件末尾没有换行符:最后一行就是 pending 的这一行
      // (可能是被字节上限切断的那一行 —— 那时 windowDone 已置位,但内容仍要如实给出)
      const text = decodeLine(pending, pendingBytes, byteLimited);
      lines.push(text);
      contentBytes += Buffer.byteLength(text, 'utf8');
    } else if (opts.collect && !windowDone && !scanCapped && lineNo >= opts.offset) {
      // split('\n') 语义:以换行符结尾的文件末尾还有一个空行
      if (opts.limit === undefined || lines.length < opts.limit) {
        lines.push('');
        reachedOffset = true;
      }
    }

    return {
      lines,
      reachedOffset,
      totalNewlines,
      complete: !scanCapped && bytesScanned >= totalBytes,
      bytesScanned,
      totalBytes,
      // 窗口正文 = 各行字节之和 + 行间换行符(与 join('\n') 的字节数一致)
      bytesRead: contentBytes + Math.max(0, lines.length - 1),
      byteLimited,
    };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // 关闭失败不改变"已经扫到的这些行"这一事实
    }
  }
}

/** 把窗口内收集到的字节解成一行文本;被字节上限切断时去掉尾部 U+FFFD */
function decodeLine(parts: readonly Buffer[], totalBytes: number, cut: boolean): string {
  let text = Buffer.concat(parts, totalBytes).toString('utf8');
  if (cut && text.endsWith(REPLACEMENT_CHAR)) text = text.slice(0, -1);
  return text;
}

/** 数一个文件的真实行数(不读内容)。`totalLinesExact=false` 时结果是下界 */
export function countLines(filePath: string, options: LineScanBudget = {}): LineCount {
  const scan = scanFile(filePath, {
    offset: 1,
    maxBytes: 0,
    byteCap: options.byteCap ?? MAX_LINE_SCAN_BYTES,
    collect: false,
  });
  return {
    totalLines: scan.totalNewlines + 1,
    totalLinesExact: scan.complete,
    bytesScanned: scan.bytesScanned,
    totalBytes: scan.totalBytes,
  };
}

/**
 * 按行定位读一个窗口:先在字节流里走到 `offset` 那一行,再顺行取到 `limit` 行,
 * 全程受 `maxBytes` 限制(单次回给模型的正文上限)。
 *
 * 返回的 `lines` 是**真实的那一段内容** —— 不是"前 512KB 里碰巧对上的行",
 * 也不是"被截断后假装这就是文件全部"。
 */
export function readLineWindow(filePath: string, options: ReadLineWindowOptions): LineWindow {
  const offset =
    typeof options.offset === 'number' && Number.isFinite(options.offset) && options.offset >= 1
      ? Math.floor(options.offset)
      : 1;
  const limit =
    typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit >= 1
      ? Math.floor(options.limit)
      : undefined;

  const scan = scanFile(filePath, {
    offset,
    limit,
    maxBytes: Math.max(0, Math.floor(options.maxBytes)),
    byteCap: options.byteCap ?? MAX_LINE_SCAN_BYTES,
    collect: true,
  });

  const offsetResolution: LineWindowOffsetResolution = scan.reachedOffset
    ? 'ok'
    : scan.complete
      ? 'beyond-eof'
      : 'indeterminate';

  return {
    lines: scan.lines,
    startLine: offset,
    endLine: offset + scan.lines.length - 1,
    totalLines: scan.totalNewlines + 1,
    totalLinesExact: scan.complete,
    bytesRead: scan.bytesRead,
    bytesScanned: scan.bytesScanned,
    totalBytes: scan.totalBytes,
    byteLimited: scan.byteLimited,
    offsetResolution,
  };
}
