/**
 * 图形验证码服务。
 * 生成 4 位字符 PNG（base64），5 分钟过期，一次性校验。
 * 主存储 Redis（code-store 复用），fallback 到 DB captchas 表。
 */

import { randomBytes } from 'node:crypto';
import { env } from 'node:process';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export interface CaptchaResult {
  captchaKey: string;
  img: string;
  code: string;
}

export function generateCaptchaKey(): string {
  return randomBytes(16).toString('hex');
}

export function generateCaptchaCode(): string {
  let code = '';
  const rand = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    code += CHARS[(rand[i] ?? 0) % CHARS.length] ?? '';
  }
  return code;
}

/**
 * 生成验证码图片（base64 PNG）。
 * 简化实现：用 SVG 生成文字图片，转 base64 data URI。
 * 生产可替换为 sharp/svg-captcha，此处保持零依赖。
 */
export function generateCaptchaImage(code: string): string {
  // SVG 图片，4 位字符，120x40，带噪点
  const chars = code.split('');
  const noise = Array.from({ length: 10 }, () => {
    const x = Math.floor(Math.random() * 120);
    const y = Math.floor(Math.random() * 40);
    return `<circle cx="${x}" cy="${y}" r="1" fill="#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}" opacity="0.4"/>`;
  }).join('');  const text = chars
    .map(
      (c, i) =>
        `<text x="${15 + i * 28}" y="28" font-size="24" font-family="monospace" fill="#${Math.floor(Math.random() * 0x666666 + 0x333333).toString(16).padStart(6, '0')}" transform="rotate(${Math.floor(Math.random() * 20 - 10)} ${15 + i * 28} 20)">${c}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">${noise}${text}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * 校验验证码（大小写不敏感，一次性）。
 * 调用方负责从 Redis/DB 取出 code 后调用此函数。
 */
export function verifyCaptcha(storedCode: string, inputCode: string): boolean {
  return storedCode.toLowerCase() === inputCode.toLowerCase();
}

/**
 * 判断验证码服务是否启用（DEV 环境可关闭）。
 */
export function isCaptchaEnabled(): boolean {
  return env.CAPTCHA_DISABLED !== 'true';
}
