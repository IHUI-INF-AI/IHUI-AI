#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 发布/校验工具为 CLI,需 console 输出诊断信息 */
/**
 * update-file-manifest.mjs — 更新包「逐文件 sha256 自校验」唯一实现(2026-11-04 立)。
 *
 * 清单格式(JSON,schemaVersion=1):
 *   {
 *     "schemaVersion": 1,
 *     "generatedAt": "2026-11-04T...Z",
 *     "files": [{ "path": "desktop/xxx.exe", "sha256": "<64 hex>", "size": 123 }]
 *   }
 * `path` 一律相对清单根目录的 POSIX 风格路径;绝对路径、盘符、`..` 一律判损坏。
 *
 * 校验覆盖六类事实(任一不符 ⇒ ok=false,逐条报 path/期望/实际):
 *   - manifest_corrupt         清单本身损坏(JSON 坏/schemaVersion 不符/条目形状坏/重复/非法路径/非法 hash)
 *   - file_missing             清单列出的文件在包里不存在(清单多项)
 *   - size_mismatch            字节数不符
 *   - sha256_mismatch          内容哈希不符
 *   - manifest_missing_entry   包里有、清单没列(清单缺项)
 *   - duplicate_entry          同一路径在清单出现两次(歧义,按损坏处理)
 *
 * 设计约束(用户拍板):
 *   - 不得只在 debug 跑,不得失败只打日志继续 —— 本模块只返回结论,调用方必须据此中止;
 *   - 不短路:一次校验把所有问题都报出来,不因第一个错就停止;
 *   - 本模块不做网络/进程退出决策,CLI 主流程在文件底部。
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MANIFEST_SCHEMA_VERSION = 1
export const UPDATE_MANIFEST_FILENAME = 'update-files.json'
const SHA256_RE = /^[0-9a-f]{64}$/

/** 清单根里永不参与校验的目录(与更新包无关且体量巨大)。 */
const SKIP_DIRS = new Set(['.git', 'node_modules'])

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * 规范化清单路径:仅接受相对 POSIX 路径。
 * 返回 null = 非法(绝对路径/盘符/`..`/空段),调用方按损坏处理。
 */
export function normalizeManifestPath(input) {
  if (typeof input !== 'string' || input.length === 0) return null
  const s = input.replace(/\\/g, '/')
  if (s.startsWith('/') || /^[A-Za-z]:/.test(s)) return null
  const parts = s.split('/')
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null
  return parts.join('/')
}

function corruptIssue(path, message) {
  return {
    code: 'manifest_corrupt',
    category: 'manifest_corrupt',
    path: path ?? '',
    expected: null,
    actual: null,
    message,
  }
}

/**
 * 解析并结构校验清单。raw 可以是 JSON 文本或已解析对象。
 * 返回 { ok, manifest, issues } —— issues 非空时 manifest 为 null(不拿半份清单去校验)。
 */
export function parseUpdateFileManifest(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (e) {
      return { ok: false, manifest: null, issues: [corruptIssue('', `清单 JSON 解析失败: ${e?.message ?? e}`)] }
    }
  }
  if (!isRecord(data)) {
    return { ok: false, manifest: null, issues: [corruptIssue('', '清单不是对象')] }
  }
  const issues = []
  if (data.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    issues.push(
      corruptIssue(
        '',
        `schemaVersion 不符:期望 ${MANIFEST_SCHEMA_VERSION},实际 ${JSON.stringify(data.schemaVersion)}`,
      ),
    )
  }
  if (!Array.isArray(data.files)) {
    issues.push(corruptIssue('', '清单缺 files 数组'))
    return { ok: false, manifest: null, issues }
  }
  const seen = new Set()
  const files = []
  for (const entry of data.files) {
    if (!isRecord(entry)) {
      issues.push(corruptIssue('', 'files 条目不是对象'))
      continue
    }
    const path = normalizeManifestPath(entry.path)
    if (!path) {
      issues.push(corruptIssue(String(entry.path ?? ''), `非法路径 ${JSON.stringify(entry.path)}`))
      continue
    }
    if (seen.has(path)) {
      issues.push({
        code: 'duplicate_entry',
        category: 'manifest_corrupt',
        path,
        expected: null,
        actual: null,
        message: `清单里同一路径出现两次: ${path}`,
      })
      continue
    }
    if (typeof entry.sha256 !== 'string' || !SHA256_RE.test(entry.sha256)) {
      issues.push({
        code: 'manifest_corrupt',
        category: 'manifest_corrupt',
        path,
        expected: '64 位小写十六进制 sha256',
        actual: String(entry.sha256 ?? ''),
        message: `sha256 格式非法: ${path}`,
      })
      continue
    }
    if (!Number.isInteger(entry.size) || entry.size < 0) {
      issues.push({
        code: 'manifest_corrupt',
        category: 'manifest_corrupt',
        path,
        expected: '非负整数 size',
        actual: String(entry.size ?? ''),
        message: `size 非法: ${path}`,
      })
      continue
    }
    seen.add(path)
    files.push({ path, sha256: entry.sha256, size: entry.size })
  }
  if (issues.length > 0) return { ok: false, manifest: null, issues }
  return {
    ok: true,
    manifest: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : '',
      files,
    },
    issues: [],
  }
}

/**
 * 核对清单与「包里实际文件清单」。
 * actualFiles: [{ path, size, sha256 }] —— sha256 由调用方算好(便于注入与单测)。
 * 不短路:先逐条核对清单项,再反查包里多出的文件,最后统一返回。
 */
export function verifyUpdateFileManifest(manifest, actualFiles) {
  const issues = []
  const actual = new Map()
  for (const f of actualFiles ?? []) {
    const p = normalizeManifestPath(f?.path)
    if (!p) {
      issues.push(corruptIssue(String(f?.path ?? ''), '实际文件清单含非法路径'))
      continue
    }
    actual.set(p, { path: p, size: Number(f.size), sha256: String(f.sha256 ?? '') })
  }
  const expectedPaths = new Set()
  for (const entry of manifest?.files ?? []) {
    expectedPaths.add(entry.path)
    const got = actual.get(entry.path)
    if (!got) {
      // 清单列了、包里没有 ⇒ 清单多项
      issues.push({
        code: 'file_missing',
        category: 'manifest_extra_entry',
        path: entry.path,
        expected: { sha256: entry.sha256, size: entry.size },
        actual: null,
        message: `清单多项:清单列出的文件在包内不存在 → ${entry.path}(期望 size=${entry.size} sha256=${entry.sha256})`,
      })
      continue
    }
    if (got.size !== entry.size) {
      issues.push({
        code: 'size_mismatch',
        category: 'size_mismatch',
        path: entry.path,
        expected: entry.size,
        actual: got.size,
        message: `size 不符 → ${entry.path}(期望 ${entry.size} B,实际 ${got.size} B)`,
      })
    }
    if (got.sha256 !== entry.sha256) {
      issues.push({
        code: 'sha256_mismatch',
        category: 'sha256_mismatch',
        path: entry.path,
        expected: entry.sha256,
        actual: got.sha256,
        message: `sha256 不符 → ${entry.path}(期望 ${entry.sha256},实际 ${got.sha256})`,
      })
    }
  }
  for (const [path, got] of actual) {
    if (expectedPaths.has(path)) continue
    // 包里有、清单没列 ⇒ 清单缺项
    issues.push({
      code: 'manifest_missing_entry',
      category: 'manifest_missing_entry',
      path,
      expected: null,
      actual: { size: got.size, sha256: got.sha256 },
      message: `清单缺项:包内多出清单未登记的文件 → ${path}(实际 size=${got.size} B)`,
    })
  }
  issues.sort((a, b) => (a.path === b.path ? a.code.localeCompare(b.code) : a.path.localeCompare(b.path)))
  return {
    ok: issues.length === 0,
    issues,
    checked: { manifestFiles: (manifest?.files ?? []).length, actualFiles: actual.size },
  }
}

/** 递归枚举目录下的常规文件(POSIX 相对路径);不跟随符号链接(避免越界读)。 */
export function enumeratePackageFiles(dir) {
  const root = resolve(dir)
  const out = []
  const stack = [root]
  while (stack.length > 0) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue
      const abs = join(cur, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        stack.push(abs)
        continue
      }
      if (!e.isFile()) continue
      // 清单自身恒不计入校验集:否则"清单落盘后再校验"必然把自己判成缺项(自指)
      if (e.name === UPDATE_MANIFEST_FILENAME) continue
      out.push({ path: relative(root, abs).split(sep).join('/'), abs })
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path))
  return out
}

/** 流式计算文件 sha256(大安装包不整读进内存)。 */
export function sha256File(absPath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(absPath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

/** 为目录生成清单对象(不落盘)。 */
export async function buildUpdateFileManifest(dir) {
  const files = []
  for (const f of enumeratePackageFiles(dir)) {
    const st = statSync(f.abs)
    files.push({ path: f.path, sha256: await sha256File(f.abs), size: st.size })
  }
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    files,
  }
}

/** 读盘做一次完整核对(清单 → 目录)。 */
export async function verifyDirectory(dir, manifest) {
  const actualFiles = []
  for (const f of enumeratePackageFiles(dir)) {
    const st = statSync(f.abs)
    actualFiles.push({ path: f.path, sha256: await sha256File(f.abs), size: st.size })
  }
  return verifyUpdateFileManifest(manifest, actualFiles)
}

/** 生成清单并写盘。 */
export async function writeUpdateFileManifest(dir, outPath) {
  const manifest = await buildUpdateFileManifest(dir)
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  writeFileSync(resolve(outPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  return manifest
}

/** 把校验结论渲染成给人看的多行文本(调用方决定退出码)。 */
export function renderVerifyReport(result, context) {
  const head = result.ok
    ? `✅ 逐文件 sha256 校验通过(${context}:清单 ${result.checked.manifestFiles} 项 / 实际 ${result.checked.actualFiles} 个文件)`
    : `❌ 逐文件 sha256 校验失败(${context}:${result.issues.length} 项不符)`
  const lines = result.ok ? [] : result.issues.map((i) => `  - [${i.code}] ${i.message}`)
  return [head, ...lines].join('\n')
}

// ─── CLI: generate / verify ────────────────────────────────────────────────
function takeFlag(args, name) {
  const i = args.indexOf(name)
  if (i < 0) return { present: false, value: null }
  const v = args[i + 1]
  if (!v || v.startsWith('-')) return { present: true, value: null }
  return { present: true, value: v }
}

async function main(argv) {
  const args = argv.slice(2)
  const cmd = args[0]
  const dir = takeFlag(args, '--dir')
  if (!['generate', 'verify'].includes(cmd) || !dir.value) {
    console.error('用法: node scripts/update-file-manifest.mjs generate|verify --dir <包目录> [--out <清单路径>] [--manifest <清单路径>]')
    process.exit(2)
  }
  if (!existsSync(dir.value)) {
    console.error(`❌ 目录不存在: ${dir.value}`)
    process.exit(2)
  }
  if (cmd === 'generate') {
    const out = takeFlag(args, '--out').value ?? join(resolve(dir.value), UPDATE_MANIFEST_FILENAME)
    const manifest = await writeUpdateFileManifest(dir.value, out)
    console.log(`✅ 已生成逐文件清单:${resolve(out)}(${manifest.files.length} 个文件)`)
    process.exit(0)
  }
  const manifestPath = takeFlag(args, '--manifest').value ?? join(resolve(dir.value), UPDATE_MANIFEST_FILENAME)
  if (!existsSync(manifestPath)) {
    console.error(`❌ 清单不存在: ${manifestPath}`)
    process.exit(2)
  }
  const parsed = parseUpdateFileManifest(readFileSync(manifestPath, 'utf-8'))
  if (!parsed.ok) {
    console.error(renderVerifyReport({ ok: false, issues: parsed.issues, checked: { manifestFiles: 0, actualFiles: 0 } }, dir.value))
    process.exit(1)
  }
  const result = await verifyDirectory(dir.value, parsed.manifest)
  const text = renderVerifyReport(result, dir.value)
  console.log(text)
  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv).catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
