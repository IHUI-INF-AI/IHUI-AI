import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const key = config.CREDENTIALS_ENCRYPTION_KEY;
  if (key.length < KEY_LENGTH) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY 必须至少 32 字符');
  }
  return Buffer.from(key.slice(0, KEY_LENGTH));
}

export interface EncryptedPayload {
  iv: string;       // base64
  ciphertext: string; // base64
  tag: string;      // base64
}

/**
 * 加密任意可 JSON 序列化的值，返回 { iv, ciphertext, tag } 结构。
 */
export function encryptJSON(data: unknown): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(12); // GCM 推荐 12 字节 IV
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * 解密 { iv, ciphertext, tag } 结构，返回原始值。
 */
export function decryptJSON(payload: EncryptedPayload): unknown {
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

/**
 * 判断值是否为加密 payload 格式（含 iv/ciphertext/tag 三字段）。
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.iv === 'string' && typeof v.ciphertext === 'string' && typeof v.tag === 'string';
}
