#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * desktop-feed-v2.mjs — 从已签名 zip 生成客户端 v2 feed，并可烘焙进 Web 仓库。
 *
 * 用法：
 *   node scripts/desktop-feed-v2.mjs \
 *     --zip dist/ihui-0.1.93-windows-x86_64.zip \
 *     --signature dist/ihui-0.1.93-windows-x86_64.zip.sig \
 *     --url https://gitee.com/.../ihui-0.1.93-windows-x86_64.zip \
 *     --version 0.1.93 \
 *     --rollout 5 \
 *     --out apps/web/public/desktop-feed-v2.json \
 *     --ts-out apps/web/src/config/desktop-feed-v2.generated.ts
 *
 * feed 只认 schema=2 + payload（zip/sha256/minisign），不再混入安装器 legacy 字段。
 * --url 必须是 https 且与 zip 字节一致；--signature 是 tauri signer 生成的 .sig 文本。
 * --rollout 1..100；--revoked 可重复；--rollback-to 只影响已撤版机器的本地回退。
 * --min-supported 低于它的客户端会显示强制安全更新（仍不自动退出）。
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function take(args, name, fallback = '') {
  const at = args.indexOf(name)
  if (at < 0) return fallback
  const value = args[at + 1]
  if (!value || value.startsWith('-')) throw new Error(`${name} 缺值`)
  return value
}

function takeMany(args, name) {
  const out = []
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      const value = args[i + 1]
      if (!value || value.startsWith('-')) throw new Error(`${name} 缺值`)
      out.push(value)
    }
  }
  return out
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * 只判 .sig 文件存在/非空不够：签名可能属于上一版 zip，或 zip 在签名后又被改过。
 * 用与客户端同一把 tauri.conf.json 公钥验一遍字节配对，feed 才允许生成。
 */
function assertSignatureMatchesZip(zip, signature) {
  const result = spawnSync(
    process.execPath,
    [
      join(ROOT, 'scripts/desktop-updater-sig-verify.mjs'),
      '--artifact',
      zip,
      '--signature',
      signature,
      '--config',
      join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json'),
    ],
    { stdio: 'inherit', shell: false, windowsHide: true },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`签名未覆盖当前 zip 字节：${zip} (${signature})`)
  }
}

export function buildFeed({
  zip,
  signature,
  url,
  version,
  notes = '',
  rollout = 100,
  minSupported = '',
  revoked = [],
  rollbackTo = '',
}) {
  if (!existsSync(zip)) throw new Error(`zip 不存在：${zip}`)
  if (!existsSync(signature)) throw new Error(`签名不存在：${signature}`)
  if (!/^https:\/\//i.test(url)) throw new Error(`payload url 必须是 https：${url}`)
  if (!version || !/^[0-9A-Za-z.-]{1,64}$/.test(version)) {
    throw new Error(`非法版本号：${version}`)
  }
  const sigText = readFileSync(signature, 'utf8').trim()
  if (!sigText) throw new Error('签名文件为空')
  const percent = Number(rollout)
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new Error(`rollout 必须是 1..100 的整数：${rollout}`)
  }
  const size = statSync(zip).size
  const digest = sha256File(zip)
  return {
    schema: 2,
    version: version.replace(/^v/, ''),
    channel: 'stable',
    rollout: { percent },
    minSupported: minSupported ? minSupported.replace(/^v/, '') : null,
    revoked: revoked.map((v) => v.replace(/^v/, '')),
    rollbackTo: rollbackTo ? rollbackTo.replace(/^v/, '') : null,
    notes: notes || `智汇AI 桌面端 ${version}：后台装好、点一下重启生效。`,
    payload: {
      url,
      size,
      sha256: digest,
      signature: sigText,
      format: 'zip',
      platform: 'windows-x86_64',
      minLauncher: '0.1.0',
    },
  }
}

function serializeTs(feed) {
  return (
    '// AUTO-GENERATED — 由 scripts/desktop-feed-v2.mjs 从已签名 zip 生成。\n' +
    '// 发版步骤见 docs/desktop-update-v2.md。\n\n' +
    'export interface DesktopFeedV2Payload {\n' +
    '  schema: 2\n' +
    '  version: string\n' +
    '  channel?: string\n' +
    '  rollout?: { percent: number; salt?: string }\n' +
    '  minSupported?: string | null\n' +
    '  revoked?: string[]\n' +
    '  rollbackTo?: string | null\n' +
    '  notes?: string | null\n' +
    '  payload: {\n' +
    '    url: string\n' +
    '    size: number\n' +
    '    sha256: string\n' +
    '    signature: string\n' +
    '    format: string\n' +
    '    platform?: string\n' +
    '    minLauncher?: string\n' +
    '  }\n' +
    '}\n\n' +
    `export const DESKTOP_FEED_V2: DesktopFeedV2Payload = ${JSON.stringify(feed, null, 2)}\n`
  )
}

function watermark(path) {
  const wm = spawnSync(process.execPath, [resolve(ROOT, 'scripts/watermark.mjs'), 'inject', path], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (wm.status !== 0) {
    throw new Error(`水印注入失败(status=${wm.status}):${String(wm.stderr || '').slice(0, 300)}`)
  }
}

function main() {
  const args = process.argv.slice(2)
  const zip = resolve(take(args, '--zip'))
  const signature = resolve(take(args, '--signature'))
  if (!existsSync(zip)) throw new Error(`zip 不存在：${zip}`)
  if (!existsSync(signature)) throw new Error(`签名不存在：${signature}`)
  assertSignatureMatchesZip(zip, signature)
  const url = take(args, '--url')
  const version = take(args, '--version')
  const feed = buildFeed({
    zip,
    signature,
    url,
    version,
    notes: take(args, '--notes', ''),
    rollout: take(args, '--rollout', '100'),
    minSupported: take(args, '--min-supported', ''),
    revoked: takeMany(args, '--revoked'),
    rollbackTo: take(args, '--rollback-to', ''),
  })
  const out = resolve(take(args, '--out', join(ROOT, 'dist', 'desktop-feed-v2.json')))
  const tsOut = take(args, '--ts-out', '')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  console.log(`✅ feed ${out}`)
  console.log(`   version=${feed.version} rollout=${feed.rollout.percent}% sha256=${feed.payload.sha256}`)
  if (tsOut) {
    const absTs = resolve(tsOut)
    mkdirSync(dirname(absTs), { recursive: true })
    writeFileSync(absTs, serializeTs(feed), 'utf8')
    watermark(absTs)
    console.log(`✅ baked ${absTs}`)
  }
  if (args.includes('--print-json')) process.stdout.write(`${JSON.stringify(feed)}\n`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { buildFeed, serializeTs, sha256File }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
