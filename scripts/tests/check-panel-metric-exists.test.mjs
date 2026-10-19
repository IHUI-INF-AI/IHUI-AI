// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 220 的镜像测试(AGENTS §22c):判据一律 import 生产实现,禁止在这里复制第二份。
// 与 --self-test 的分工:自检证"门自己的单元行为",本文件证"门接在生产判据上、
// 摘掉某一形取形就翻红"——两档互不可替代(自检档曾全绿而门体 SyntaxError,教训见 b798a5abb2)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as GATE } from '../check-grafana-metric-exists.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_PATH = resolve(ROOT, 'scripts/check-grafana-metric-exists.mjs')

test('M1 取形:selector / range / 函数首参 三种形状都取得到名字', () => {
  const names = GATE.extractMetricNames('histogram_quantile(0.95, sum by (le) (rate(ihui_llm_ttft_seconds_bucket{job="ai-service"}[1h])))')
  assert.ok(names.includes('ihui_llm_ttft_seconds_bucket'), 'name{ 形状必须取到')
  const bare = GATE.extractMetricNames('sum(rate(business_ai_calls_total[1h]))')
  assert.ok(bare.includes('business_ai_calls_total'), 'name[range] 形状必须取到(不带花括号的真实写法)')
})

test('M2 取形:函数名与分组标签不得被当指标(判据乱咬 = 逼人跳门)', () => {
  const names = GATE.extractMetricNames('sum by (provider) (rate(ihui_llm_calls_total{job="ai-service"}[1h]))')
  for (const notAMetric of ['sum', 'by', 'rate', 'provider', 'job']) {
    assert.equal(names.includes(notAMetric), false, `${notAMetric} 不是指标,被抓到即假阳`)
  }
})

test('M3 归一化:Counter/Histogram 声明名按 prometheus 后缀规则展开', () => {
  const c = GATE.normalizedNameVariants('ihui_llm_calls_total')
  assert.ok(c.has('ihui_llm_calls_total') && c.has('ihui_llm_calls_created'))
  const h = GATE.normalizedNameVariants('ihui_llm_ttft_seconds')
  assert.ok(h.has('ihui_llm_ttft_seconds_bucket') && h.has('ihui_llm_ttft_seconds_count'))
})

test('M4 手拼渲染的族(business_ai_*)必须被认作有发射点 —— 摘掉 HELP/序列取形即红', () => {
  // 这一条是 TS_HELP_RE / TS_SERIES_RE 的承重反证:上一版只认"与引号相邻"的字面量,
  // 于是 apps/api 自己拼 PromQL 文本的那一族被判成幽灵,大屏不能引用业务口径(实测)。
  const res = GATE.runAudit('head')
  assert.equal(res.status, 'ok', `审面应可读,实得:${res.reason || res.status}`)
  const funnel = res.report.find((r) => r.file.endsWith('business-funnel.json'))
  assert.ok(funnel, 'business-funnel.json 应在审面上')
  const ghosts = funnel.violations.map((v) => v.name)
  for (const real of ['business_funnel_total', 'business_api_call_total', 'business_orders_total']) {
    assert.equal(ghosts.includes(real), false, `${real} 由仓内手写渲染,不该被判幽灵(判据假阳)`)
  }
})

test('M5 两面旗同给 ⇒ exit 2(§0.4 取材面纪律不允许"同时判两面")', () => {
  let rc = -1
  let out = ''
  try {
    out = execFileSync(process.execPath, [GATE_PATH, '--staged', '--worktree'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    rc = 0
  } catch (e) {
    rc = e.status
    out = String(e.stdout || '')
  }
  assert.equal(rc, 2, `应落"未判定"档,实得 rc=${rc} out=${out.slice(0, 120)}`)
})

test('M6 全量档在审面上必须真能跑完(自检路径覆盖不到主判定,曾出现门体 SyntaxError 而自检全绿)', () => {
  let rc = -1
  let out = ''
  try {
    out = execFileSync(process.execPath, [GATE_PATH], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    rc = 0
  } catch (e) {
    rc = e.status
    out = String(e.stdout || '') + String(e.stderr || '')
  }
  assert.match(out, /面=head/, `全量档应报出取材面,实得 rc=${rc}`)
  assert.match(out, /大屏 \d+ 份/, '应报出大屏份数(枚举为 0 时判死,不记绿)')
  // rc 允许 0(无新增幽灵)或 1(本次把幽灵加回来了);2 = 未判定,3+ = 崩了
  assert.ok(rc === 0 || rc === 1, `全量档 rc 应落在 0/1,实得 ${rc}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
