// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { ToolContentBlock } from '../index.js';
import { writeToolMediaArtifact } from './artifact-store.js';

export interface MaterializedToolContent {
  content: ToolContentBlock[];
  /** 供模型/日志读的短说明；绝不包含 base64 正文。 */
  notes: string[];
}

function dataUrlParts(value: string): { mimeType?: string; base64: string } | undefined {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(value);
  if (!match?.[2]) return undefined;
  return {
    ...(match[1] ? { mimeType: match[1] } : {}),
    base64: match[3] ?? '',
  };
}

/**
 * 把工具结果里的媒体段落成会话产物，换回相对路径。
 *
 * 目的不是“把图片塞给模型”，而是三件事同时成立：
 *  1. provider 侧只看到短路径/说明，不因 base64 撑爆上下文；
 *  2. 宿主/UI 仍能从 content 里拿到可预览的本地文件；
 *  3. 同一份内容重复出现时命中内容哈希，不重复占盘。
 *
 * 落盘失败不静默丢段：保留原 data 并在 notes 里点名失败，调用方仍可看到事实。
 */
export function materializeToolContent(
  blocks: ToolContentBlock[] | undefined,
  opts: { workspacePath: string; sessionId?: string; toolName: string },
): MaterializedToolContent {
  if (!blocks || blocks.length === 0) return { content: [], notes: [] };
  const content: ToolContentBlock[] = [];
  const notes: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'resource_link') {
      content.push(block);
      continue;
    }

    const dataUrl = block.url ? dataUrlParts(block.url) : undefined;
    const base64 = block.data ?? dataUrl?.base64;
    if (!base64) {
      content.push(block);
      if (block.url) notes.push(`[${block.type}: ${block.url}]`);
      else if (block.path) notes.push(`[${block.type}: ${block.path}]`);
      continue;
    }

    const mimeType = block.mimeType ?? dataUrl?.mimeType;
    try {
      const written = writeToolMediaArtifact({
        workspacePath: opts.workspacePath,
        sessionId: opts.sessionId,
        toolName: opts.toolName,
        mimeType,
        base64,
      });
      const next: ToolContentBlock = {
        ...block,
        path: written.relativePath,
        ...(mimeType ? { mimeType } : {}),
      };
      delete (next as { data?: string }).data;
      delete (next as { url?: string }).url;
      content.push(next);
      notes.push(`[${block.type}: ${written.relativePath}${mimeType ? ` (${mimeType})` : ''}]`);
    } catch (err) {
      content.push(block);
      notes.push(`[${block.type} 落盘失败: ${err instanceof Error ? err.message : String(err)}]`);
    }
  }

  return { content, notes };
}
