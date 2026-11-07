// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 产物预算门 · 基线生成器(2026-11-07 裁定:用最近一次真实构建产物的实测值立基线,
 * 生成即纳入判红;产不出真实构件的档保持 uncalibrated,并由门自身改判 exit 2)。
 *
 * 用法:
 *   node scripts/gen-artifact-budget-baseline.mjs --target web-static
 *   node scripts/gen-artifact-budget-baseline.mjs --target extension [--artifact <绝对/相对路径>]
 *
 * 产出:scripts/artifact-budget-baselines/<target>.json,内含生成命令、生成时间、产物 sha、
 * 文件数、实测总量、limitBytes(= 实测总量)与 warnPct(=101,不设水位)。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BUDGET } from './check-artifact-budget.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'scripts', 'artifact-budget-baselines')

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(2)
}

function walk(dir, base = dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue
    const abs = join(dir, ent.name)
    if (ent.isDirectory()) walk(abs, base, out)
    else if (ent.isFile()) out.push({ rel: relative(base, abs).split('\\').join('/'), abs })
  }
  return out
}

function main() {
  const args = process.argv.slice(2)
  let target = null
  let artifactOverride = null
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--target') target = args[++i]
    else if (a.startsWith('--target=')) target = a.slice('--target='.length)
    else if (a === '--artifact') artifactOverride = args[++i]
    else if (a.startsWith('--artifact=')) artifactOverride = a.slice('--artifact='.length)
    else fail(`未知参数 ${a}`)
  }
  if (!target || !Object.hasOwn(BUDGET, target)) {
    fail(`缺少或未知 --target;可选:${Object.keys(BUDGET).join(' | ')}`)
  }
  const spec = BUDGET[target]
  const abs = resolve(ROOT, artifactOverride ?? spec.artifactRel)
  if (!existsSync(abs)) {
    fail(`产物目录不存在:${abs}\n先跑 \`${spec.buildHint}\` 再生成基线`)
  }
  const entries = walk(abs)
  if (entries.length === 0) fail(`产物目录为空:${abs}`)

  const lines = []
  let bytes = 0
  let newest = 0
  for (const e of entries) {
    const st = statSync(e.abs)
    bytes += st.size
    if (st.mtimeMs > newest) newest = st.mtimeMs
    lines.push(`${e.rel}\0${st.size}`)
  }
  lines.sort()
  const sha = createHash('sha256').update(lines.join('\n')).digest('hex')

  mkdirSync(OUT_DIR, { recursive: true })
  const out = {
    target,
    artifact: spec.artifactRel,
    generatedAt: new Date().toISOString(),
    generatedBy: `node scripts/gen-artifact-budget-baseline.mjs --target ${target}`,
    artifactSha256: sha,
    fileCount: entries.length,
    measuredBytes: bytes,
    newestMtime: new Date(newest).toISOString(),
    limitBytes: bytes,
    warnPct: 101,
    note:
      'limitBytes = 最近一次真实构建产物的实测总量(硬上限);warnPct=101 表示不设告警水位,' +
      '任何超过该基线的增长都直接判红。换了构建配置/导出范围后必须重新生成本文件。',
  }
  const outPath = join(OUT_DIR, `${target}.json`)
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`✅ 已生成 ${relative(ROOT, outPath)}`)
  console.log(
    `   target=${target} artifact=${spec.artifactRel} files=${entries.length} bytes=${bytes} sha256=${sha}`,
  )
}

// AGENTS §22d:CLI 直跑与被 import 必须隔离副作用(Windows 反斜杠路径经 pathToFileURL 归一)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
