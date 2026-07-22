/**
 * 图片输入 — 从文件路径读取图片,转 base64 dataURL,供多模态模型使用。
 * 支持从剪贴板读取(当前返回 unsupported,现有 clipboard 工具仅支持文本)。
 * 灵感来源:OpenCode 的 image input。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ImageInput {
  dataUrl: string;
  mediaType: string;
}

export type ImageReadResult =
  | { ok: true; image: ImageInput }
  | { ok: false; error: string };

const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const EXT_TO_MEDIA: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** 从文件路径读取图片,转 base64 dataURL */
export function readImageFromPath(filePath: string): ImageReadResult {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) {
    return { ok: false, error: `不支持的图片格式: ${ext || '(无扩展名)'}(支持 png/jpg/jpeg/gif/webp)` };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `文件不存在: ${filePath}` };
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return { ok: false, error: `不是文件: ${filePath}` };
  }
  if (stat.size > MAX_IMAGE_BYTES) {
    const mb = (stat.size / 1024 / 1024).toFixed(2);
    return { ok: false, error: `图片过大: ${mb}MB(限制 5MB)` };
  }
  try {
    const buf = fs.readFileSync(filePath);
    const base64 = buf.toString('base64');
    const mediaType = EXT_TO_MEDIA[ext]!;
    return {
      ok: true,
      image: {
        dataUrl: `data:${mediaType};base64,${base64}`,
        mediaType,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `读取失败: ${msg}` };
  }
}

/**
 * 从剪贴板读取图片。
 * 现有 clipboard 工具仅支持文本,图片剪贴板暂返回 unsupported。
 * 后续可扩展为调用平台原生 API(Get-Clipboard -Format Image / pngpaste 等)。
 */
export function readImageFromClipboard(): ImageReadResult {
  return {
    ok: false,
    error: '剪贴板图片读取暂不支持(现有 clipboard 工具仅支持文本;请用文件路径输入)',
  };
}
