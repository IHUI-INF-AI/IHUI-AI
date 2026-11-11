// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 314 的镜像测试 —— 钉三件事:装车位置(主 checks 数组,不是 pushGateChecks)、判据形态
// (含 2026-11-11 scanJsx 修复的归属不回退)、台账棘轮(存在且 --emit-baseline 只允许下降)。
// 跑法:node --test scripts/tests/check-button-border-color.test.mjs
// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as G, main } from '../check-button-border-color.mjs'

const RUNNER = join(import.meta.dirname, '..', 'guardian-runner.mjs')
const LEDGER = join(import.meta.dirname, '..', 'button-border-color-baseline.json')
const REPO = join(import.meta.dirname, '..', '..')

/**
 * 夹具档表:常量名与治理现场同名,值只用于夹具 —— 钉的是"引用按**被审面的值**解析"这个机制,
 * 不是任何字符串副本(真仓常量在 stash@{0} 未落盘期间,本测试同样成立)。
 */
const SHARED = new Map([['SHARED_QUICK_ACTION_BORDER_CLASS', 'border border-input hover:border-primary/40']])
const audit = (src, shared = SHARED) => G.auditFileText('x/T.tsx', src, shared)

/** 按花括号配平取数组全体文本(照门 150 的 T1 形态):"在文件里出现过"不算装车。 */
function arrRange(src, name) {
  const at = src.indexOf('const ' + name + ' = [')
  assert.ok(at >= 0, `runner 里找不到数组 ${name}`)
  let depth = 0
  let i = src.indexOf('[', at)
  const from = i
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) break
    }
  }
  return { from, to: i, text: src.slice(from + 1, i) }
}

test('T1 装车证明:314 必须在 checks 数组内(不是 pushGateChecks),blocking/skipEnv/stagedTriggers 逐字一致', () => {
  // runner 读**磁盘**:本门 2026-11-11 新建,注册条目尚未与提交同枚入库,HEAD blob 里没有它;
  // 同枚提交后此取材可换 headBlob —— 钉的不变量(落哪个数组、要素逐字)两种取材下都成立。
  const src = readFileSync(RUNNER, 'utf8')
  const checks = arrRange(src, 'checks')
  const pushOnly = arrRange(src, 'pushGateChecks')
  assert.ok(
    checks.text.includes('check-button-border-color.mjs'),
    '本门不在 checks 区间内 ⇒ pre-commit 与全量批永不调度它(grep 却查得到 —— 门 150 记过的同型事故)',
  )
  assert.ok(
    !pushOnly.text.includes('check-button-border-color.mjs'),
    '本门不得同时挂在 pushGateChecks 上 ⇒ 两处注册会互相顶失败归属',
  )
  const at = src.indexOf("id: '314'")
  assert.ok(at >= 0, "注册表里没有 id: '314'")
  assert.ok(at > checks.from && at < checks.to, "id: '314' 落在 checks 区间之外")
  const block = src.slice(at, src.indexOf('\n  },', at) + 5)
  assert.match(block, /script: 'check-button-border-color\.mjs'/, 'script 字段不符')
  assert.match(block, /mode: 'blocking'/, '定级不是 blocking')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_BUTTON_BORDER_COLOR'/, '缺应急跳过出口(逐字)')
  assert.match(block, /stagedTriggers: \['apps\/', 'packages\/'\]/, 'stagedTriggers 逐字不符')
})

test('T2 判据镜像:裸 border 红 / 显式色合规 / hover 不算基础色 / 共享常量按值合规 / 卡片出射程', () => {
  assert.equal(audit('<button className="border px-3">ok</button>').violations.length, 1, '裸 border 按钮必须判红')
  const ok = audit('<button className="border border-input">ok</button>')
  assert.equal(ok.violations.length, 0, 'border border-input 必须合规')
  assert.equal(ok.compliant, 1, '合规要计入对账数,不能只是"没红"')
  assert.equal(audit('<button className="border hover:border-primary/40">ok</button>').violations.length, 1, '只有状态覆盖不算基础色')
  assert.equal(audit('<button className={cn(SHARED_QUICK_ACTION_BORDER_CLASS, \'px-2\')}>ok</button>').violations.length, 0, '引用共享常量按值合规')
  // 常量按被审面解析的回退钉:同名常量在面上被改成无色 ⇒ 引用它照样红(门内没有字符串副本可护短)
  assert.equal(
    audit('<button className={cn(SHARED_QUICK_ACTION_BORDER_CLASS)}>ok</button>', new Map([['SHARED_QUICK_ACTION_BORDER_CLASS', 'border px-2']])).violations.length,
    1,
    '常量值无色时必须判红 —— 钉"不写死副本"',
  )
  // 非按钮元素不在射程:单列第四格,既不并进合规也不并进未判定(卡片没有"同性质按钮"对账对象)
  const card = audit('<div className="rounded-lg border bg-card p-4">card</div>')
  assert.equal(card.violations.length, 0)
  assert.equal(card.outOfScope.length, 1)
  assert.equal(card.compliant, 0)
})

test('T3 scanJsx 修复不回退:footer={<button className="border">} 归属到按钮本体判红', () => {
  const src = [
    'function D() {',
    '  return (',
    '    <Modal',
    '      open={o}',
    '      footer={<button className="border px-3 hover:border-primary/40">ok</button>}',
    '    />',
    '  )',
    '}',
  ].join('\n')
  const r = audit(src)
  assert.equal(r.violations.length, 1, '属性表达式里的裸 border 按钮必须被判到')
  assert.equal(r.violations[0].line, 5, '违规行必须归属按钮本体所在行(2026-11-11 前的 scanJsx 会误归外层组件)')
  assert.ok(r.outOfScope.every((o) => o.line !== 5), '按钮那一行不得同时被记成"不在射程"')
})

test('T4 台账存在、形状合规,且 --emit-baseline 只允许下降', async () => {
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
  assert.ok(ledger.anchors && typeof ledger.anchors === 'object', '台账缺 anchors 字段')
  for (const [k, v] of Object.entries(ledger.anchors)) {
    assert.match(k, /\|border-color-implicit$/, `台账键形态不符:${k}`)
    assert.ok(Number.isInteger(v) && v >= 0, `台账值须为非负整数:${k}=${v}`)
  }
  const log = []
  const orig = console.log
  console.log = (...a) => log.push(a.join(' '))
  let code
  try {
    // 台账读工作树磁盘(门头注:台账是门的判据输入、不是被判面内容),
    // 故 emit-baseline 必须同面取 --worktree 对账。若按 HEAD 面,治理改动
    // 未入库的窗口里 HEAD 存量 > 磁盘锚点 0,会被判"锚点回归"拒 exit 1,
    // 连把修复与门同枚提交的那一次也会被本测试挡住 —— 2026-11-11 实证。
    code = await main(['--emit-baseline', '--worktree'], REPO)
  } finally {
    console.log = orig
  }
  assert.equal(code, 0, '--emit-baseline 被拒(锚点回归?)')
  const next = JSON.parse(log.join('\n'))
  const bad = G.anchorRegression(ledger.anchors, next.anchors)
  assert.deepEqual(bad, [], `台账回归:${bad.join(' ; ')}`)
  const total = (o) => Object.values(o).reduce((s, n) => s + n, 0)
  assert.ok(total(next.anchors) <= total(ledger.anchors), '台账总数只允许下降')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
