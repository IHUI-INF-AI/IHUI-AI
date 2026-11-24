#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * desktop-payload-v2.mjs — 把 Tauri 主程序打成客户端可原子暂存的 zip 载荷。
 *
 * 产物布局（客户端 update_v2 的硬约定，不能改）：
 *   ihui-app.exe
 *   manifest.json  {schema:2, version, platform, files:[{path,sha256,size}]}
 *
 * 用法：
 *   node scripts/desktop-payload-v2.mjs \
 *     --exe apps/desktop/src-tauri/target/release/ihui-desktop.exe \
 *     --version 0.1.93 \
 *     --out dist/ihui-0.1.93-windows-x86_64.zip
 *
 *   --platform 默认 windows-x86_64；--print-json 只输出结果对象给 CI 消费。
 *
 * 为什么不在 Node 里手写 zip：仓库没有 zip 依赖；Windows runner/本机自带
 * PowerShell 的 Compress-Archive，产物由客户端 Rust 侧的真实解压器验收。
 * 非 Windows 主机直接拒绝，避免发出一个布局不同的包。
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function take(args, name, fallback = '') {
  const at = args.indexOf(name)
  if (at < 0) return fallback
  const value = args[at + 1]
  if (!value || value.startsWith('-')) {
    throw new Error(`${name} 缺值`)
  }
  return value
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function runCompressArchive(sourceDir, outFile) {
  const script = [
    `$ErrorActionPreference = 'Stop'`,
    `if (Test-Path ${psQuote(outFile)}) { Remove-Item -LiteralPath ${psQuote(outFile)} -Force }`,
    `Compress-Archive -Path ${psQuote(join(sourceDir, '*'))} -DestinationPath ${psQuote(outFile)} -CompressionLevel Optimal -Force`,
  ].join('; ')
  const shells = ['pwsh', 'powershell']
  let last = null
  for (const shell of shells) {
    const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
    })
    if (result.status === 0) return
    last = result
  }
  const detail = last
    ? `status=${last.status} stderr=${String(last.stderr || '').slice(0, 400)}`
    : '找不到 pwsh/powershell'
  throw new Error(`Compress-Archive 失败：${detail}`)
}

export function buildPayload({ exe, version, platform = 'windows-x86_64', out }) {
  if (process.platform !== 'win32') {
    throw new Error('desktop-payload-v2 只支持 Windows（Compress-Archive 布局必须与客户端一致）')
  }
  if (!existsSync(exe)) throw new Error(`exe 不存在：${exe}`)
  if (!version || !/^[0-9A-Za-z.-]{1,64}$/.test(version)) {
    throw new Error(`非法版本号：${version}`)
  }
  const absOut = resolve(out)
  mkdirSync(dirname(absOut), { recursive: true })
  // --out 是 zip 文件而不是目录；早报错，避免 Compress-Archive 把 zip 写进去后
  // 再 stat 目录失败、留下半截产物。
  if (existsSync(absOut) && statSync(absOut).isDirectory()) {
    throw new Error(`--out 必须是 zip 文件路径，不是目录：${absOut}`)
  }
  const tmp = mkdtempSync(join(tmpdir(), 'ihui-payload-'))
  const staged = join(tmp, 'ihui-app.exe')
  copyFileSync(exe, staged)

  const manifest = {
    schema: 2,
    version,
    platform,
    files: [
      {
        path: 'ihui-app.exe',
        sha256: sha256File(staged),
        size: statSync(staged).size,
      },
    ],
  }
  writeFileSync(join(tmp, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  runCompressArchive(tmp, absOut)
  rmSync(tmp, { recursive: true, force: true })

  const size = statSync(absOut).size
  return {
    path: absOut,
    name: basename(absOut),
    size,
    sha256: sha256File(absOut),
    manifest,
  }
}

function main() {
  const args = process.argv.slice(2)
  const exe = resolve(take(args, '--exe'))
  const version = take(args, '--version')
  const platform = take(args, '--platform', 'windows-x86_64')
  const out = resolve(take(args, '--out', join(ROOT, 'dist', `ihui-${version}-${platform}.zip`)))
  const result = buildPayload({ exe, version, platform, out })
  if (args.includes('--print-json')) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  console.log(`✅ payload ${result.path}`)
  console.log(`   ${result.size} bytes  sha256=${result.sha256}`)
  console.log(`   manifest=${JSON.stringify(result.manifest.files)}`)
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

export const __test__ = { buildPayload, sha256File }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
