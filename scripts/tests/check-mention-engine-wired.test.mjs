// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// §22c 镜像测试:守门「多维提及引擎接线与单一源对账」(scripts/check-mention-engine-wired.mjs)。
//
// 规矩:判据一律 import 生产出口,测试里**不得复制一份判定逻辑**(§22c 红线);
// 变异对照必须调生产入口。本文件另钉三件"写门时自己踩到 / 仓里记过"的方向:
//   T1 未注册时不得被读成已装车(注册由主会话代落,所以只判成套性,不判在场)
//   T2 取材面纪律:必须走 face-reader 的读取入口,不得散写 git show / 磁盘读被审内容(守门 118)
//   T3 判据必须有牙:摘掉调用点必红 —— 通过生产入口 analyze 证,不用测试内副本
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as T } from '../check-mention-engine-wired.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GATE_SRC = path.join(HERE, '..', 'check-mention-engine-wired.mjs')
const RUNNER = path.join(HERE, '..', 'guardian-runner.mjs')
const SELF_EXEMPT_BASE = 'check-mention-engine-wired.mjs'

const ENGINE_FILE = T.ENGINE_FILE
const WIRED = T.WIRED_SYMBOLS

function engineFixture() {
  return `export const MENTION_DIMENSIONS = [
  { id: 'at-file', sigil: '@', candidateSource: 'workspace-files' },
  { id: 'at-symbol', sigil: '@', candidateSource: 'context-search' },
  { id: 'hash-rule', sigil: '#', candidateSource: 'static-category' },
] as const
const HASH_TRIGGER_RE = /(?:^|\\s)#([^\\s#]*)$/
const AT_TRIGGER_RE = /@([\\w./-]*)$/
export function parseMentionTrigger(v) { return HASH_TRIGGER_RE.exec(v) ?? AT_TRIGGER_RE.exec(v) }
`
}

function consumerFixture() {
  return `import { useContextMentionStore } from '../stores/context-mention'
import { useSearchMentions } from '../hooks/use-context-mention'
import { MentionChips } from './mention-popover'
export function Panel() {
  useContextMentionStore.getState().addMention(sel)
  useSearchMentions(q, 'symbol', ws, true)
  return <MentionChips />
}
`
}

function definitionFiles() {
  return Object.fromEntries(
    WIRED.flatMap((s) =>
      s.definitionFiles.map((rel) => [
        rel,
        rel.includes('stores')
          ? 'export const useContextMentionStore = { getState: () => ({ addMention: () => {} }) }\n'
          : rel.includes('hooks')
            ? 'export function useSearchMentions() { return {} }\n'
            : 'export function MentionChips() { return null }\n',
      ]),
    ),
  )
}

test('T1 注册成套性:一旦接进提交链,必须同时是 blocking 且带应急跳过变量与暂存触发面', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const at = runner.indexOf(SELF_EXEMPT_BASE)
  if (at === -1) {
    // 尚未注册(本票按任务书把注册交给主会话)⇒ 只允许"未被声称已接线"这一种状态。
    const gateSrc = readFileSync(GATE_SRC, 'utf8')
    assert.ok(
      !/已接\s*pre-commit|guardian\s*第\s*\d+\s*项/.test(gateSrc),
      '未注册却把头注写成已接线 = 守门 89 的 R1 那一型',
    )
    return
  }
  // 大括号配对取出本门那一条注册项(切"前后 N 字符"会跨进邻门 —— 仓里记过同型)
  const start = runner.lastIndexOf('{', at)
  let depth = 0
  let end = start
  for (let i = start; i < runner.length; i++) {
    if (runner[i] === '{') depth++
    else if (runner[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const entry = runner.slice(start, end + 1)
  assert.match(entry, /mode:\s*['"]blocking['"]/, '本门必须 blocking:warn 的代价是"判对了也没人被打断"')
  assert.ok(entry.includes(T.SKIP_ENV_NAME), `缺应急跳过变量 ${T.SKIP_ENV_NAME}`)
})

test('T2 取材面纪律:必须走 face-reader 的读取入口,不得散写 git show / 拼磁盘路径读被审内容', () => {
  const src = readFileSync(GATE_SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容一律走 catBatch(否则守门 118 判半接线)')
  assert.doesNotMatch(src, /\[\s*'show'\s*,/, '不得再自己派生 git show 读内容')
  assert.doesNotMatch(src, /const\s+ROOT\s*=\s*process\.cwd\(\)/, 'ROOT 不得由调用者站哪决定(守门 70 那一型)')
  assert.match(src, /fileURLToPath\(import\.meta\.url\)/)
})

test('T3 判据有牙:生产入口 analyze 认"注释掉的调用点"为未装车,认"真调用"为已装车', () => {
  const commented = `// useContextMentionStore.getState().addMention(sel)
// useSearchMentions(q, 'symbol')
// <MentionChips />
export const noop = 1
`
  const withProd = T.decide(
    [
      { rel: ENGINE_FILE, text: engineFixture() },
      ...Object.entries(definitionFiles()).map(([rel, text]) => ({ rel, text })),
      { rel: 'apps/web/src/components/chat/panel.tsx', text: consumerFixture() },
    ],
    {},
    false,
  )
  const commentedOut = T.decide(
    [
      { rel: ENGINE_FILE, text: engineFixture() },
      ...Object.entries(definitionFiles()).map(([rel, text]) => ({ rel, text })),
      { rel: 'apps/web/src/components/chat/panel.tsx', text: commented },
    ],
    {},
    false,
  )
  assert.equal(
    withProd.violations.length,
    0,
    `真调用被判成未装车 = 判据失效: ${JSON.stringify(withProd.violations)}`,
  )
  const w1 = commentedOut.violations.filter((v) => v.startsWith('W1'))
  assert.equal(
    w1.length,
    WIRED.length,
    `注释掉调用点后三个件必须全判红,实得 ${w1.length}: ${JSON.stringify(commentedOut.violations)}`,
  )
})

test('T4 遮罩只关误报不关判据:同一形态在注释里必不计、在代码里必计(成对)', () => {
  const code = `x.addMention(sel)\n`
  const comment = `// x.addMention(sel)\n`
  const decl = `  addMention: (mention) => set(),\n`
  assert.equal(T.findCallLines(code, 'addMention(', /^\s*addMention:\s*\(/).length, 1)
  assert.equal(T.findCallLines(comment, 'addMention(', /^\s*addMention:\s*\(/).length, 0)
  // 定义行本身不算调用方(否则 store 自己就能给自己发合格证)
  assert.equal(T.findCallLines(decl, 'addMention(', /^\s*addMention:\s*\(/).length, 0)
})

test('T5 单一源判据的输入取自真仓:引擎里确实有那两条触发正则与 ≥14 行维度', () => {
  // 阳性对照用真仓内容(§22c:判据的对象是真实文件的形态时,至少一条断言逐字取自真实文件)
  const src = readFileSync(path.join(HERE, '..', '..', 'packages', 'shared', 'src', 'chat', 'mention-engine.ts'), 'utf8')
  assert.equal(T.findTriggerRegexLines(src).length, 2, '引擎的两条触发正则必须都被指纹命中,否则门对该形态全盲')
  assert.ok(T.countDimensionRows(src) >= 14, `维度行数现测 ${T.countDimensionRows(src)},应 ≥14(@5 + #9)`)
})

test('T6 锚点必须与被审面不同源:同一份内容,锚点 0 判红、锚点给到同值判绿', () => {
  const files = [
    { rel: ENGINE_FILE, text: engineFixture() },
    ...Object.entries(definitionFiles()).map(([rel, text]) => ({ rel, text })),
    { rel: 'apps/web/src/components/chat/panel.tsx', text: consumerFixture() },
    {
      rel: 'apps/web/src/hooks/own-trigger.ts',
      text: `export function own(v) { return v.match(/(?:^|\\s)#([^\\s#]*)$/) }\n`,
    },
  ]
  const noAnchor = T.decide(files, {}, false)
  const anchored = T.decide(files, { 'apps/web/src/hooks/own-trigger.ts': { rows: 0, trig: 1 } }, false)
  const degraded = T.decide(files, {}, true)
  assert.ok(
    noAnchor.violations.some((v) => v.startsWith('W3')),
    `锚点为 0 时第二处触发解析必须判红: ${JSON.stringify(noAnchor.violations)}`,
  )
  assert.ok(
    !anchored.violations.some((v) => v.startsWith('W3')),
    '锚点给到同值时必须放过(否则就是与改动无关的恒红门)',
  )
  assert.ok(
    !degraded.violations.some((v) => v.startsWith('W2') || v.startsWith('W3')) &&
      degraded.notice.anchorUnavailable === true,
    '锚点取不到 ⇒ 只能记"未判定"并打印,不得静默记绿也不得冒红',
  )
})
