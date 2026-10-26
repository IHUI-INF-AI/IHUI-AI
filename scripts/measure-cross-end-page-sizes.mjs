#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * measure-cross-end-page-sizes.mjs —— 给「每屏体积估算表」出一个可复现的口径。
 *
 * 为什么需要(2026-10-26 实测):容量判据按**每页边际均值** 28,760 B 算额度,但少数屏的闭包
 * 是均值的一到两个数量级 —— `home` 的 RN 壳闭包实测源码 3.59 MB(按构建比 0.28~0.48 折算 ≈ 1.0~1.7 MB)。
 * 拿均值当它的成本,容量闸会"觉得装得下"而把分包一口吃穿;而分包超限的发现点在**上传**那一步。
 * 所以容量判据必须能按屏取估算,估算表由本器从 HEAD 面现算,不手抄。
 *
 * 口径:每屏估算 = clamp(RN 壳**闭包去重源码字节** × RATIO, MIN, MAX)
 *   · RATIO = 0.5(实测构建比 0.28 / 0.48 两个样本,取向**偏保守**:宁可高估让容量闸早收手,
 *     也不低估把分包顶穿 —— 高估的代价只是早点开新分包,低估的代价是交付物传不上去)
 *   · 闭包 = 同名 RN 壳本体 + 其相对导入(遇到 `@ihui/*` 等裸包即停点,与门 110 主包口径同源)
 *
 * 用法:
 *   node scripts/measure-cross-end-page-sizes.mjs            # 只打印
 *   node scripts/measure-cross-end-page-sizes.mjs --write    # 写进容量表的 pageEstimates
 * 退出码:0 判出;2 取不到被审面(HEAD 面读不到 / 闭包解析不了的比例过高)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { planBatch } from './gen-miniapp-mirror.mjs'
import { walkClosure } from './lib/rn-shell-closure.mjs'
import { CAPACITY_REL } from './lib/cross-end-subpackage-capacity.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const RATIO = 0.65
const MIN_BYTES = 12_000
const MAX_BYTES = 4_000_000
const CLOSURE_ROOTS = ['apps/mobile-rn/src', 'packages/app/src', 'packages/shared/src', 'packages/design-tokens/src']

const git = (args, opts = {}) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: opts.encoding ?? 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['pipe', 'pipe', 'pipe'],
    input: opts.input,
  })

function headFiles() {
  const out = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...CLOSURE_ROOTS])
  return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))
}

function readBatchOf(rels) {
  if (rels.length === 0) return new Map()
  const buf = execFileSync('git', ['cat-file', '--batch'], {
    cwd: ROOT,
    maxBuffer: 1 << 28,
    stdio: ['pipe', 'pipe', 'pipe'],
    input: rels.map((r) => `HEAD:${r}`).join('\n') + '\n',
  })
  const map = new Map()
  let off = 0
  for (const rel of rels) {
    if (off >= buf.length) {
      map.set(rel, null)
      continue
    }
    let nl = buf.indexOf(0x0a, off)
    if (nl < 0) nl = buf.length
    const header = buf.subarray(off, nl).toString('utf8')
    off = nl + 1
    const m = /^[0-9a-f]{40} (\w+) (\d+)$/.exec(header)
    if (!m) {
      map.set(rel, null)
      continue
    }
    const size = Number(m[2])
    map.set(rel, buf.subarray(off, off + size).toString('utf8'))
    off += size + 1
  }
  return map
}

export function resolveSpec(files, from, spec) {
  const base = posix.normalize(posix.join(posix.dirname(from), spec))
  if (files.has(base)) return base
  for (const cand of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (files.has(cand)) return cand
  }
  return null
}

/** 纯函数:闭包源码字节 → 估算产物体积(clamp 到 [MIN, MAX]);单点口径,测试直接打它。 */
export function estimateFromClosureBytes(bytes, ratio = RATIO) {
  return Math.min(MAX_BYTES, Math.max(MIN_BYTES, Math.round(bytes * ratio)))
}

export function measure({ rootDir = ROOT } = {}) {
  const files = headFiles()
  if (files.size === 0) return { ok: false, why: 'HEAD 面枚举到 0 个闭包候选文件' }
  const sizes = new Map()
  for (const rel of files) {
    // 只按 git ls-tree 给的名字大小算源码体量:用 cat-file 也不必要,交给闭包后的 readBatch 一起取
    sizes.set(rel, null)
  }
  const { planned } = planBatch(rootDir, { form: 'shell' })
  const out = {}
  const details = []
  let unresolved = 0
  for (const p of planned) {
    const base = p.spec.split('/').pop()
    const shellRel = `apps/mobile-rn/src/screens/${base}`
    let shellText = null
    try {
      shellText = git(['show', `HEAD:${shellRel}`])
    } catch {
      shellText = null
    }
    if (shellText === null) {
      unresolved += 1
      continue
    }
    const c = walkClosure({
      roots: [{ file: shellRel, text: shellText }],
      readBatch: readBatchOf,
      toRel: (from, spec) => {
        const hit = resolveSpec(files, from, spec)
        if (hit === null) throw new Error(`解析不到 ${spec}`)
        return hit
      },
      isBare: (s) => !s.startsWith('.'),
    })
    // 源码字节 = 闭包内各文件正文长度(用 readBatch 再取一次,避免另开一条 IO 面)
    const got = readBatchOf([...c.files])
    let bytes = 0
    for (const t of got.values()) if (typeof t === 'string') bytes += Buffer.byteLength(t)
    const est = estimateFromClosureBytes(bytes)
    out[p.spec] = est
    details.push({ spec: p.spec, closureFiles: c.files.size, sourceBytes: bytes, estimate: est })
  }
  details.sort((a, b) => b.estimate - a.estimate)
  return { ok: true, estimates: out, details, unresolved, planned: planned.length }
}

function main() {
  const write = process.argv.includes('--write')
  const r = measure()
  if (!r.ok) {
    console.error(`❓ 未判定:${r.why}`)
    process.exit(2)
  }
  console.log(`每屏体积估算 · 待产 ${r.planned} 屏 · 算出 ${r.details.length} · 取不到壳 ${r.unresolved}`)
  for (const d of r.details.slice(0, 12)) {
    console.log(`  ${String(d.estimate).padStart(8)} B ← 闭包 ${d.closureFiles} 份 / ${d.sourceBytes} B  ${d.spec}`)
  }
  if (r.unresolved > 0) {
    console.log(`  ⚠ ${r.unresolved} 屏的 RN 壳在 HEAD 面取不到 ⇒ 未纳入估算表(容量闸会退回均值)`)
  }
  if (!write) {
    console.log('（只读;加 --write 写进容量表 pageEstimates）')
    return
  }
  const abs = join(ROOT, CAPACITY_REL)
  const model = JSON.parse(readFileSync(abs, 'utf8'))
  // 并入而不是覆盖:表里已落页的条目对路由无害(路由只查"本轮要产的屏"),
  // 覆盖会让每一轮把上一轮算出的估算丢掉 ⇒ 下一批又退回均值估,正是造成超限的那型低估。
  model.pageEstimates = { ...(model.pageEstimates ?? {}), ...r.estimates }
  model.pageEstimatesNote = `由 node scripts/measure-cross-end-page-sizes.mjs --write 增量并入(RATIO=${RATIO},clamp ${MIN_BYTES}..${MAX_BYTES},面=HEAD)`
  writeFileSync(abs, `${JSON.stringify(model, null, 2)}\n`, 'utf8')
  console.log(`✅ 已写入 ${CAPACITY_REL}:本轮 ${Object.keys(r.estimates).length} 条,表内合计 ${Object.keys(model.pageEstimates).length} 条`)
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

export const __test__ = { estimateFromClosureBytes, resolveSpec, measure, RATIO, MIN_BYTES, MAX_BYTES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
