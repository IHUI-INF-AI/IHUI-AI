#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PUBLISH_CREDENTIALS_KEY 迁移助手(2026-11-24 立)。
 *
 * 背景:ai-service 的凭据加密(发布凭证 + 连接器 user OAuth token)主密钥取自
 * `PUBLISH_CREDENTIALS_KEY`;未配置时降级读 `apps/ai-service/data/credentials_key`
 * 文件。本机实测两份密钥文件(服务根 / 仓库根)内容不同 —— 多实例/换容器时
 * 每实例各读各的文件,A 实例加密的 token 到 B 实例必 InvalidTag。
 *
 * 本脚本把现存文件密钥原值转成环境变量要填的 base64,**不重新生成、不写文件**,
 * 因此迁移前后历史密文都可解(旧值另填 PUBLISH_CREDENTIALS_KEY_LEGACY 更稳)。
 *
 * 用法:
 *   node scripts/export-publish-credentials-key.mjs                 # 主位置密钥 base64
 *   node scripts/export-publish-credentials-key.mjs --all           # 主位置 + 历史位置(JSON)
 *   node scripts/export-publish-credentials-key.mjs --verify        # 校验 env 与各文件是否一致
 *
 * 退出码:0 = 正常/校验通过;1 = 密钥缺失或格式非法/校验不一致。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVICE_ROOT = resolve(ROOT, 'apps', 'ai-service')
const KEY_LEN = 32
const ENV_NAME = 'PUBLISH_CREDENTIALS_KEY'
const LEGACY_ENV_NAME = 'PUBLISH_CREDENTIALS_KEY_LEGACY'

// 与 credentials_crypto.py 的 _KEY_FILE / _LEGACY_KEY_FILES 顺序保持一致
const FILES = {
  primary: resolve(SERVICE_ROOT, 'data', 'credentials_key'),
  'repo-root-legacy': resolve(ROOT, 'data', 'credentials_key'),
}

function readKey(path) {
  if (!existsSync(path)) return null
  try {
    const buf = readFileSync(path)
    if (buf.length !== KEY_LEN) {
      process.stderr.write(`[warn] ${path} length=${buf.length}, expected ${KEY_LEN}; ignored\n`)
      return null
    }
    return buf
  } catch (e) {
    process.stderr.write(`[warn] ${path} unreadable: ${e.message}; ignored\n`)
    return null
  }
}

function decodeEnv(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    const buf = Buffer.from(raw, 'base64')
    const canonical = buf.toString('base64').replace(/=+$/, '')
    if (buf.length !== KEY_LEN || canonical !== raw.replace(/=+$/, '')) return null
    return buf
  } catch {
    return null
  }
}

const args = new Set(process.argv.slice(2))
const primary = readKey(FILES.primary)
const legacy = readKey(FILES['repo-root-legacy'])

if (args.has('--verify')) {
  const env = decodeEnv(process.env[ENV_NAME])
  const legacyEnvs = String(process.env[LEGACY_ENV_NAME] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!env) {
    process.stderr.write(`[FAIL] ${ENV_NAME} 未配置或不是 32 字节 base64\n`)
    process.exit(1)
  }
  const match = primary && env.equals(primary) ? 'primary(apps/ai-service/data/credentials_key)'
    : legacy && env.equals(legacy) ? 'repo-root-legacy(data/credentials_key)'
      : 'external(与现存文件均不同 —— 确认是刻意轮换且旧值在 LEGACY)'
  process.stdout.write(`[OK] ${ENV_NAME} = ${match}\n`)
  process.stdout.write(`[OK] ${LEGACY_ENV_NAME} entries = ${legacyEnvs.length}\n`)
  process.exit(0)
}

const out = {
  [ENV_NAME]: primary ? primary.toString('base64') : null,
  legacy: { 'repo-root-legacy': legacy ? legacy.toString('base64') : null },
}
if (args.has('--all')) {
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
} else {
  if (!primary) {
    process.stderr.write('[FAIL] 主位置密钥文件不存在或非法: ' + FILES.primary + '\n')
    process.exit(1)
  }
  process.stdout.write(primary.toString('base64') + '\n')
}
