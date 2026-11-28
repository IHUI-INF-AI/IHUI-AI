// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// HumanEval 公开基准执行器（2026-11-28）
// 目的：把「8 例自建玩具题」升级成公开可比的 HumanEval 分数。
// 用法：
//   $env:IHUI_BENCH_MODEL='workbuddy/hy4flash'
//   $env:IHUI_HUMANEVAL_N='50'
//   tsx benchmarks/humaneval.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = (process.env.IHUI_BENCH_BASE_URL ?? 'http://127.0.0.1:8813/v1').replace(/\/$/, '')
const MODEL = process.env.IHUI_BENCH_MODEL ?? 'workbuddy/hy4flash'
const LIMIT = Number(process.env.IHUI_HUMANEVAL_N ?? 50)
const START = Number(process.env.IHUI_HUMANEVAL_START ?? 0)
const DELAY = Number(process.env.IHUI_BENCH_DELAY_MS ?? 2000)
const PYTHON =
  process.env.IHUI_BENCH_PYTHON ??
  'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'
const OUT =
  process.env.IHUI_HUMANEVAL_OUT ??
  join(HERE, 'results', `humaneval-${MODEL.replace(/[^A-Za-z0-9.-]/g, '-')}.json`)

interface Problem {
  task_id: string
  prompt: string
  test: string
  entry_point: string
}

interface HumanEvalResult {
  task_id: string
  passed: boolean
  output?: string
  code?: string
  error?: string
}

const keyFile = resolve(HERE, '..', '.ihui-agent', 'tmp', 'relay-credential.txt')
const apiKey =
  process.env.IHUI_BENCH_API_KEY ?? (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : '')

function loadProblems(): Problem[] {
  const gz = readFileSync(join(HERE, 'data', 'HumanEval.jsonl.gz'))
  return gunzipSync(gz)
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Problem)
}

function extractCode(text: string): string {
  const fence = text.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1]
  // 没有围栏时，从第一行“像代码”的行开始（保留 from/import，HumanEval 的类型注解靠它）
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^(from\s|import\s|def\s|class\s|@)/.test(l.trim()))
  return start >= 0 ? lines.slice(start).join('\n') : text
}

async function solve(p: Problem): Promise<{ code: string; raw: string }> {
  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a Python coding assistant. Return ONLY the complete code starting from the given ' +
          'function definition. Do not explain, do not add tests.',
      },
      { role: 'user', content: p.prompt + '\n\n# Complete the function above. Return the full code.' },
    ],
    temperature: 0.0,
    max_tokens: 2048,
  }
  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.IHUI_BENCH_TIMEOUT_MS ?? 120_000)),
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`upstream ${resp.status}: ${text.slice(0, 200)}`)
  const json = JSON.parse(text)
  const raw: string = json.choices?.[0]?.message?.content ?? ''
  return { code: extractCode(raw), raw }
}

function runTest(p: Problem, code: string): { passed: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-he-'))
  const file = join(dir, 'solution.py')
  const script = `from typing import *\n\n${code}\n\n${p.test}\n\ncheck(${p.entry_point})\n`
  writeFileSync(file, script, 'utf8')
  const r = spawnSync(PYTHON, [file], { encoding: 'utf8', timeout: 30_000, windowsHide: true })
  rmSync(dir, { recursive: true, force: true })
  return {
    passed: r.status === 0,
    output: ((r.stderr ?? '') + (r.stdout ?? '')).slice(-400),
  }
}

async function main() {
  const all = loadProblems()
  const picked = all.slice(START, START + LIMIT)
  console.log(`HumanEval model=${MODEL} problems=${picked.length} start=${START}`)
  const results: HumanEvalResult[] = []
  for (const [i, p] of picked.entries()) {
    if (i > 0 && DELAY > 0) await new Promise((r) => setTimeout(r, DELAY))
    try {
      const { code } = await solve(p)
      const t = runTest(p, code)
      results.push({ task_id: p.task_id, passed: t.passed, output: t.passed ? '' : t.output, code: t.passed ? '' : code })
      console.log(`${t.passed ? 'PASS' : 'FAIL'} ${p.task_id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ task_id: p.task_id, passed: false, error: msg })
      console.log(`FAIL ${p.task_id} err=${msg}`)
    }
  }
  const passed = results.filter((r) => r.passed).length
  const summary = { benchmark: 'HumanEval', model: MODEL, total: results.length, passed, passRate: passed / results.length, generatedAt: new Date().toISOString(), results }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`pass-rate: ${passed}/${results.length} (${(summary.passRate * 100).toFixed(1)}%)`)
  console.log(`results -> ${OUT}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
