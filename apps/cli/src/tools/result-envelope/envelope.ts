// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结果信封 —— 超限工具结果回灌给模型的那段**结构化替身**。
 *
 * 格式契约(三行元信息 + 预览 + 收尾说明),两侧都要按它解析:
 *   - 压缩/提醒重建侧靠 `ENVELOPE_OPEN_MARKER` 认出"这段是信封",
 *     从而 **① 不再二次封装 ② 不把预览当正文再压一遍**;
 *   - 模型侧靠它知道"正文在哪个路径、还剩多少没看、下一步该分块读而不是重跑工具"。
 *
 * 为什么用方括号标记而不是 JSON:
 *   结果体本身可能含任意文本(命令输出里就有 JSON),再套一层 JSON 会把转义
 *   成本推给模型;标记行 + 明文键值既好读又好正则定位,与仓内既有
 *   `[工具结果 ✓]` / `[上下文摘要` 约定同族。
 */

import type { ArtifactWrite } from './artifact-store.js';
import {
  ENVELOPE_OPEN_MARKER,
  ENVELOPE_CLOSE_MARKER,
  ENVELOPE_PREVIEW_FOOTER,
  isEnvelopeContent,
} from '@ihui/context-compaction';

// 标记与识别判据的真源在 @ihui/context-compaction/src/markers.ts:那里是回收侧
// (reclaim)也必须读同一个判据的层,而依赖方向是 apps/cli → 共享包,反向 import
// 结构上不可能。本文件按原导出面 re-export,消费方零改动 —— 但**不得**在这里
// 重新写一遍字面量,那会变成"改一端、另一端静默漂移"的第二份真相。
export { ENVELOPE_OPEN_MARKER, ENVELOPE_CLOSE_MARKER, ENVELOPE_PREVIEW_FOOTER, isEnvelopeContent };

/** 信封解析结果 */
export interface ParsedEnvelope {
  toolName: string;
  /** 项目内相对路径(可直接喂 read_file) */
  artifactPath: string;
  /**
   * 这份输出**原本是关于哪个文件的**(read_file/list_dir 等带路径参数的工具)。
   * 存在的理由:冷启动恢复时内存里的已读跟踪器是空的,只剩 messages 里这段信封 ——
   * 没有这一行就只能记住"读过某个产物",记不住"读过 src/foo.ts"这件事本身。
   */
  sourcePath: string | null;
  totalChars: number;
  totalLines: number;
  budgetChars: number;
  previewChars: number;
  preview: string;
}

/** 一段文本里出现了几次信封起始标记(>1 即说明发生了重复封装,应视为缺陷) */
export function countEnvelopes(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = text.indexOf(ENVELOPE_OPEN_MARKER, from);
    if (idx < 0) return count;
    count += 1;
    from = idx + ENVELOPE_OPEN_MARKER.length;
  }
}

/** 取文本前 N 字符做预览(按字符切,不按 token;顺带把行尾 BOM 去掉) */
export function takePreview(text: string, previewChars: number): string {
  if (previewChars <= 0) return '';
  const normalized = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return normalized.length <= previewChars ? normalized : normalized.slice(0, previewChars);
}

/** 生成信封正文(纯函数,不落盘;落盘产物由调用方传入) */
export function buildEnvelope(opts: {
  toolName: string;
  artifact: Pick<ArtifactWrite, 'relativePath' | 'chars'>;
  totalLines: number;
  budgetChars: number;
  preview: string;
  /** 该输出对应的源文件(能取到就写,取不到省略这一行) */
  sourcePath?: string | null;
}): string {
  // 预览压缩空行(含首尾换行):reclaim(@ihui/context-compaction)对内嵌形态
  // `[工具结果 ✓] name\n正文` 按 '\n\n' 分段,段级保护 isEnvelopeResult 要求 body
  // 同时含 OPEN/CLOSE 两个标记。预览是原文逐字节切片,原文里的空行落在预览窗口内
  // 时信封会被从中间劈开 —— 首段只带 OPEN 标记与产物路径行,逃过段级保护,被改写
  // 成回收占位串 ⇒ `完整输出: <产物路径>` 逐字节丢失,冷启动 parseEnvelope /
  // collectFromMessages 全部失效(重建提醒是内存态,兜不住会话恢复)。
  // 空行属排版不属语义:压成单换行后信封恒为单个完整段,指针在改写前后逐字节可回
  // (判据由 tests/reclaim-envelope-boundary.test.ts 钉死)。
  const preview = opts.preview.replace(/\n{2,}/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
  const head = [
    ENVELOPE_OPEN_MARKER,
    `工具: ${opts.toolName}`,
    ...(opts.sourcePath ? [`源文件: ${opts.sourcePath}`] : []),
    `完整输出: ${opts.artifact.relativePath} (共 ${opts.artifact.chars} 字符 / ${opts.totalLines} 行,上下文预算 ${opts.budgetChars} 字符)`,
    `预览(前 ${preview.length} 字符):`,
  ].join('\n');
  const tail = [
    ENVELOPE_PREVIEW_FOOTER,
    ENVELOPE_CLOSE_MARKER,
    '正文未进入上下文。需要更多内容请对上列路径用 read_file 分块读取(带 offset/limit),不要重复执行原工具。',
  ].join('\n');
  return `${head}\n${preview}\n${tail}`;
}

/**
 * 解析信封。只认"第一处起始标记 → 其后第一个结束标记"这一段;
 * 解析不出关键字段(路径/字符数)时返回 null,调用方按"非信封"处理 ——
 * 宁可不重建,也不要把残缺片段当事实。
 */
export function parseEnvelope(text: string): ParsedEnvelope | null {
  if (!isEnvelopeContent(text)) return null;
  const openIdx = text.indexOf(ENVELOPE_OPEN_MARKER);
  const closeIdx = text.indexOf(ENVELOPE_CLOSE_MARKER, openIdx);
  if (closeIdx < 0) return null;
  const block = text.slice(openIdx + ENVELOPE_OPEN_MARKER.length, closeIdx);

  const toolName = /^工具:\s*(.+)$/m.exec(block)?.[1]?.trim() ?? '';
  const sourcePath = /^源文件:\s*(.+)$/m.exec(block)?.[1]?.trim() || null;
  const metaLine = /^完整输出:\s*(.+)$/m.exec(block)?.[1]?.trim() ?? '';
  const pathMatch = /^(\S+)/.exec(metaLine);
  const charsMatch = /共\s*(\d+)\s*字符/.exec(metaLine);
  const linesMatch = /\/\s*(\d+)\s*行/.exec(metaLine);
  const budgetMatch = /预算\s*(\d+)\s*字符/.exec(metaLine);
  const artifactPath = pathMatch?.[1] ?? '';
  const totalChars = Number.parseInt(charsMatch?.[1] ?? '', 10);
  if (!artifactPath || !Number.isFinite(totalChars)) return null;

  const previewHead = /预览\(前\s*\d+\s*字符\):\n/.exec(block);
  const previewStart = previewHead ? (previewHead.index ?? 0) + previewHead[0].length : -1;
  const footerIdx = block.indexOf(ENVELOPE_PREVIEW_FOOTER);
  const preview =
    previewStart >= 0 && footerIdx > previewStart ? block.slice(previewStart, footerIdx).replace(/\s+$/, '') : '';

  return {
    toolName,
    artifactPath,
    sourcePath,
    totalChars,
    totalLines: Number.parseInt(linesMatch?.[1] ?? '', 10) || 0,
    budgetChars: Number.parseInt(budgetMatch?.[1] ?? '', 10) || 0,
    previewChars: preview.length,
    preview,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
