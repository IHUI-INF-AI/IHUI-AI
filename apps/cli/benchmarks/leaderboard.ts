// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 汇总 benchmarks/results/*.json 为可公开的榜单数据。
// 用法：tsx benchmarks/leaderboard.ts
// 输出：benchmarks/results/leaderboard.json + leaderboard.md
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RESULTS_DIR = join(import.meta.dirname, 'results')
const OUT_JSON = join(RESULTS_DIR, 'leaderboard.json')
const OUT_MD = join(RESULTS_DIR, 'leaderboard.md')

type Row = {
  benchmark: string
  model: string
  total: number
  passed: number
  passRate: number
  generatedAt: string | null
  source: string
}

type RawResult = {
  benchmark?: string
  model?: string
  total?: number
  passed?: number
  passRate?: number
  generatedAt?: string
}

const isResult = (name: string) => name.endsWith('.json') && !['leaderboard.json', 'trae-model-sweep.json'].includes(name)

const benchOf = (name: string, data: RawResult): string => {
  if (data.benchmark === 'HumanEval' || name.startsWith('humaneval')) {
    // 公开榜只收 >=50 题的样本；164 全量单独成榜，避免和 50 题样本混排
    if ((data.total ?? 0) >= 164) return 'HumanEval-164'
    if ((data.total ?? 0) >= 50) return 'HumanEval-50'
    return 'HumanEval-Small'
  }
  return data.benchmark ?? 'IHUI-8'
}

const rows: Row[] = []
for (const name of readdirSync(RESULTS_DIR)) {
  if (!isResult(name)) continue
  try {
    const data = JSON.parse(readFileSync(join(RESULTS_DIR, name), 'utf8')) as RawResult
    if (!data.model || typeof data.total !== 'number' || typeof data.passed !== 'number') continue
    rows.push({
      benchmark: benchOf(name, data),
      model: data.model,
      total: data.total,
      passed: data.passed,
      passRate: typeof data.passRate === 'number' ? data.passRate : data.passed / data.total,
      generatedAt: data.generatedAt ?? statSync(join(RESULTS_DIR, name)).mtime.toISOString(),
      source: name,
    })
  } catch {
    // 损坏或非评测 JSON 直接跳过
  }
}

// 同一模型同一基准保留样本量最大的一份（同量取时间更新的一份）
const best = new Map<string, Row>()
for (const r of rows) {
  const key = `${r.benchmark}::${r.model}`
  const prev = best.get(key)
  if (!prev || r.total > prev.total || (r.total === prev.total && (r.generatedAt ?? '') > (prev.generatedAt ?? ''))) {
    best.set(key, r)
  }
}

const sorted = [...best.values()]
  .filter((r) => r.benchmark !== 'HumanEval-Small')
  .sort((a, b) =>
    a.benchmark.localeCompare(b.benchmark) || b.passRate - a.passRate || a.model.localeCompare(b.model),
  )

writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), entries: sorted }, null, 2), 'utf8')

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const lines = ['# IHUI-AI Benchmark Leaderboard', '']
for (const bench of [...new Set(sorted.map((r) => r.benchmark))]) {
  lines.push(`## ${bench}`, '', '| 排名 | 模型 | 通过 | 通过率 | 样本 | 生成时间 |', '| --- | --- | --- | --- | --- | --- |')
  sorted
    .filter((r) => r.benchmark === bench)
    .forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.model} | ${r.passed}/${r.total} | ${pct(r.passRate)} | ${r.total} | ${r.generatedAt ?? '-'} |`)
    })
  lines.push('')
}
writeFileSync(OUT_MD, lines.join('\n'), 'utf8')

console.log(`leaderboard: ${sorted.length} entries -> ${OUT_JSON}`)
for (const r of sorted) console.log(`${r.benchmark.padEnd(10)} ${r.model.padEnd(32)} ${r.passed}/${r.total} ${pct(r.passRate)}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
