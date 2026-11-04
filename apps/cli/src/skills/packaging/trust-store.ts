// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发布者信任锚 — trustedKeys 配置文件(安装期签名校验的唯一信任来源)。
 *
 * 格式:
 *   {
 *     "keys": [
 *       { "id": "publisher-a", "algorithm": "ed25519", "publicKey": "<base64 SPKI DER>" }
 *     ]
 *   }
 *
 * 纪律:
 *   - **没有内置公钥、没有"没配置就跳过"**:文件缺失 ⇒ SKILL_PKG_TRUST_STORE_MISSING;
 *     文件损坏/形状不对 ⇒ SKILL_PKG_TRUST_STORE_INVALID。签名校验永远 fail-closed。
 *   - 只接受 ed25519(与签名文件算法枚举同源),不接受"未知算法就放行"。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createPublicKey, type KeyObject } from 'node:crypto'
import { getIhuiRoot } from '../../plugins/paths.js'
import { SkillPackageError } from './errors.js'

export const SKILL_TRUST_STORE_ALGORITHM = 'ed25519' as const

export interface TrustedKey {
  id: string
  algorithm: typeof SKILL_TRUST_STORE_ALGORITHM
  publicKey: KeyObject
}

export interface TrustedKeyStore {
  keys: Map<string, TrustedKey>
  /** 信任锚文件路径(报告里点名,便于审计"这次用的是哪份配置") */
  source: string
}

/** 默认信任锚: ~/.ihui/skill-trusted-keys.json(IHUI_HOME 可覆盖,测试用) */
export function getDefaultSkillTrustStorePath(): string {
  return path.join(getIhuiRoot(), 'skill-trusted-keys.json')
}

/**
 * 从磁盘加载信任锚。任何"读不到/看不懂"都拒,不返回空集合冒充"没有发布者"。
 */
export function loadTrustedKeyStore(storePath = getDefaultSkillTrustStorePath()): TrustedKeyStore {
  if (!fs.existsSync(storePath)) {
    throw new SkillPackageError(
      'SKILL_PKG_TRUST_STORE_MISSING',
      `发布者信任锚不存在:${storePath}(缺签名信任配置即拒装,不存在"没配置就跳过")`,
      { path: storePath },
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(storePath, 'utf8')) as unknown
  } catch (err) {
    throw new SkillPackageError(
      'SKILL_PKG_TRUST_STORE_INVALID',
      `发布者信任锚不是合法 JSON:${storePath}`,
      { path: storePath, cause: err instanceof Error ? err.message : String(err) },
    )
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { keys?: unknown }).keys)) {
    throw new SkillPackageError('SKILL_PKG_TRUST_STORE_INVALID', `发布者信任锚缺少 keys 数组:${storePath}`, {
      path: storePath,
    })
  }
  const keys = new Map<string, TrustedKey>()
  for (const [index, item] of (raw as { keys: unknown[] }).keys.entries()) {
    const record = item as Record<string, unknown> | null
    if (!record || typeof record !== 'object') {
      throw new SkillPackageError('SKILL_PKG_TRUST_STORE_INVALID', `keys[${index}] 不是对象:${storePath}`, {
        path: storePath,
        index,
      })
    }
    if (
      typeof record.id !== 'string' ||
      record.id.length === 0 ||
      record.algorithm !== SKILL_TRUST_STORE_ALGORITHM ||
      typeof record.publicKey !== 'string' ||
      record.publicKey.length === 0
    ) {
      throw new SkillPackageError(
        'SKILL_PKG_TRUST_STORE_INVALID',
        `keys[${index}] 字段不合法(需要 id/algorithm=ed25519/publicKey):${storePath}`,
        { path: storePath, index },
      )
    }
    if (keys.has(record.id)) {
      throw new SkillPackageError('SKILL_PKG_TRUST_STORE_INVALID', `信任锚存在重复 keyId:${record.id}`, {
        path: storePath,
        keyId: record.id,
      })
    }
    let publicKey: KeyObject
    try {
      publicKey = createPublicKey({ key: Buffer.from(record.publicKey, 'base64'), format: 'der', type: 'spki' })
    } catch (err) {
      throw new SkillPackageError(
        'SKILL_PKG_TRUST_STORE_INVALID',
        `keyId=${record.id} 的公钥无法解析:${err instanceof Error ? err.message : String(err)}`,
        { path: storePath, keyId: record.id },
      )
    }
    keys.set(record.id, { id: record.id, algorithm: SKILL_TRUST_STORE_ALGORITHM, publicKey })
  }
  return { keys, source: storePath }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
