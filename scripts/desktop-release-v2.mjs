#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * desktop-release-v2.mjs — 一次跑完 Windows v2 发版：zip → minisign → feed →（可选）上传。
 *
 * 前置：已经 `pnpm tauri build` 出 exe（本机 CARGO_TARGET_DIR 可能是 C:\IHUI-Build\target）。
 *
 * 最小用法（本机验证，不上传）：
 *   node scripts/desktop-release-v2.mjs \
 *     --exe C:\IHUI-Build\target\release\ihui-desktop.exe \
 *     --version 0.1.94 \
 *     --base-url https://github.com/OWNER/REPO/releases/download/desktop-v0.1.94
 *
 * 真正发布（需要 gh 已登录 + TAURI_SIGNING_PRIVATE_KEY / PASSWORD）：
 *   node scripts/desktop-release-v2.mjs ... --github-release OWNER/REPO@desktop-v0.1.94 \
 *     --rollout 5 --ts-out apps/web/src/config/desktop-feed-v2.generated.ts
 *
 * 产出：dist/ihui-<ver>-windows-x86_64.zip、.zip.sig、desktop-feed-v2.json。
 * 注意：这只是**文件字节**的 minisign 签名，不等于 Authenticode；正式对外发版仍需
 * SignPath/EV 对 exe 做代码签名，否则 SmartScreen 信誉会下降。
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
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

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...opts,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exit ${result.status}`)
}

function runJson(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exit ${result.status}`)
  const lines = result.stdout.trim().split(/\r?\n/)
  return JSON.parse(lines[lines.length - 1])
}

function runText(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exit ${result.status}`)
  return result.stdout.trim()
}

function main() {
  const args = process.argv.slice(2)
  const exe = resolve(take(args, '--exe'))
  const version = take(args, '--version').replace(/^v/, '')
  if (!existsSync(exe)) throw new Error(`exe 不存在：${exe}`)
  const platform = take(args, '--platform', 'windows-x86_64')
  const outDir = resolve(take(args, '--out-dir', join(ROOT, 'dist')))
  mkdirSync(outDir, { recursive: true })
  const zipPath = join(outDir, `ihui-${version}-${platform}.zip`)

  const payload = runJson(process.execPath, [
    join(ROOT, 'scripts/desktop-payload-v2.mjs'),
    '--exe',
    exe,
    '--version',
    version,
    '--platform',
    platform,
    '--out',
    zipPath,
    '--print-json',
  ])
  console.log(`[release-v2] zip ${payload.path} ${payload.size} bytes`)

  const signaturePath = `${zipPath}.sig`
  const providedSig = take(args, '--signature', '')
  if (providedSig) {
    if (!existsSync(providedSig)) throw new Error(`签名文件不存在：${providedSig}`)
    console.log(`[release-v2] 使用外部签名 ${providedSig}`)
  } else {
    if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
      throw new Error('缺少 TAURI_SIGNING_PRIVATE_KEY；或显式传 --signature <file>')
    }
    // 本机优先 repo 内 CLI；纯 Rust CI 没有 apps/web 的 node_modules，回退全局 tauri。
    const explicitTauri = take(args, '--tauri-bin', '') || process.env.IHUI_TAURI_BIN || ''
    const localTauri = join(
      ROOT,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'tauri.cmd' : 'tauri',
    )
    const signer = explicitTauri
      ? { cmd: explicitTauri, prefix: [] }
      : existsSync(localTauri)
        ? { cmd: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', prefix: ['exec', 'tauri'] }
        : { cmd: 'tauri', prefix: [] }
    run(signer.cmd, [...signer.prefix, 'signer', 'sign', zipPath], {
      cwd: join(ROOT, 'apps', 'desktop'),
      env: process.env,
      // Windows 的 .cmd/.bat 不是 PE 可执行文件，shell:false 会 EINVAL；必须交给 cmd.exe。
      shell: process.platform === 'win32',
    })
    if (!existsSync(signaturePath)) throw new Error(`签名未生成：${signaturePath}`)
    console.log(`[release-v2] minisign ${signaturePath}`)
  }

  const signatureToUse = providedSig || signaturePath
  // 发布前最后一道：签名必须覆盖当前 zip 字节（不是“.sig 文件存在”）。
  run(process.execPath, [
    join(ROOT, 'scripts/desktop-updater-sig-verify.mjs'),
    '--artifact',
    zipPath,
    '--signature',
    signatureToUse,
    '--config',
    join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json'),
  ])
  console.log('[release-v2] signature covers zip bytes')

  const baseUrl = take(args, '--base-url', '')
  const githubRelease = take(args, '--github-release', '')
  let url = take(args, '--url', '')
  if (!url) {
    if (!baseUrl) throw new Error('需要 --url 或 --base-url（payload 的 https 地址）')
    url = `${baseUrl.replace(/\/$/, '')}/${basename(zipPath)}`
  }
  const feedOut = join(outDir, 'desktop-feed-v2.json')
  const feedArgs = [
    join(ROOT, 'scripts/desktop-feed-v2.mjs'),
    '--zip',
    zipPath,
    '--signature',
    signatureToUse,
    '--url',
    url,
    '--version',
    version,
    '--out',
    feedOut,
  ]
  for (const flag of ['--rollout', '--min-supported', '--rollback-to', '--notes']) {
    const value = take(args, flag, '')
    if (value) feedArgs.push(flag, value)
  }
  for (const revoked of args.reduce((acc, v, i) => (v === '--revoked' ? [...acc, i] : acc), [])) {
    feedArgs.push('--revoked', args[revoked + 1])
  }
  const tsOut = take(args, '--ts-out', '')
  if (tsOut) feedArgs.push('--ts-out', tsOut)
  run(process.execPath, feedArgs)
  console.log(`[release-v2] feed ${feedOut}`)

  if (githubRelease) {
    const [repo, tag] = githubRelease.split('@')
    if (!repo || !tag) throw new Error('--github-release 格式应为 OWNER/REPO@tag')
    run('gh', ['release', 'upload', tag, zipPath, signatureToUse, feedOut, '--clobber'], {
      cwd: ROOT,
      env: process.env,
    })
    // feed 一旦烘焙，客户端会立刻按 payload.url 下载；先确认资产真的在 Release 上，
    // 避免“feed 发了、zip 404”的静默断更。
    const assetNames = runText('gh', [
      'release',
      'view',
      tag,
      '-R',
      repo,
      '--json',
      'assets',
      '--jq',
      '.assets | map(.name) | join(",")',
    ])
    const names = new Set(
      assetNames
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    for (const required of [basename(zipPath), basename(signatureToUse), basename(feedOut)]) {
      if (!names.has(required)) throw new Error(`发布资产缺失：${required}`)
    }
    console.log(`[release-v2] uploaded to ${repo}@${tag}`)
  }

  console.log(
    JSON.stringify({
      version,
      zip: payload.path,
      size: statSync(zipPath).size,
      sha256: payload.sha256,
      signature: signatureToUse,
      feed: feedOut,
      url,
    }),
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
