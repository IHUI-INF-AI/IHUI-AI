#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需打印结论 */
/**
 * check-gate-wiring.test.mjs — 守门脚本接线对账门的 §22c 镜像测试
 *
 * 取向:一律 import 源文件的 `__test__` 导出,**不复制任何判据实现**(§22c 红线)。
 * 夹具全部现造字符串,不依赖真仓内容(教训:「棘轮自测夹具别写死存量路径」),
 * 端到端正反对账在源脚本的 `--self-test` 里用独立临时仓库完成。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as G } from '../check-gate-wiring.mjs'

test('T1 被测全集口径:basename 锚定 + 顶层 scripts/ 直属', () => {
  const out = G.filterGatePaths(
    [
      'scripts/check-a.mjs',
      'scripts/_i18n-scan-helpers.mjs', // 含 scan 中段的辅助文件,不得误收
      'scripts/lib/check-b.mjs', // 库不是门
      'scripts/tests/check-c.mjs', // 测试目录
      'scripts/check-d.test.mjs', // 测试文件
      'scripts/check-e.ts', // 非 mjs
      'scripts/guard-f.mjs',
      'scripts/scan-g.mjs',
      'apps/api/check-h.mjs', // 端内脚本不在全集
    ].join('\n'),
  )
  assert.deepEqual(out, ['check-a.mjs', 'guard-f.mjs', 'scan-g.mjs'])
})

test('T2 头部区在第一个非注释行截断:代码里的字符串常量不构成 R1 声称', () => {
  const src =
    '/**\n * check-x.mjs — 说明\n *\n * 用法见下\n */\nconst hint = "集成位置: pre-commit 第 3 项"\nconsole.log(hint)\n'
  const header = G.extractHeaderRegion(src)
  assert.ok(!header.includes('const hint'), 'header 越界到了代码区')
  assert.deepEqual(G.extractHeaderClaims(header), [])
})

test('T3 R1 声称表述识别(六种形态)', () => {
  const cases = [
    '集成位置: scripts/guardian-runner.mjs 第 **77** 项(blocking)',
    '接入 pre-commit 第 12 项',
    '本门挂在 pre-push',
    'CI 必跑 node scripts/check-x.mjs',
    '集成位置: CI / pre-commit',
    'guardian-runner 第 30a 项',
  ]
  for (const c of cases) assert.ok(G.extractHeaderClaims(c).length >= 1, `未识别声称: ${c}`)
  // 反例:仅描述用法/参数,不构成「已接线」声称
  assert.deepEqual(G.extractHeaderClaims('用法: node scripts/check-x.mjs --staged\n纯 CLI 工具,人工按需跑'), [])
})

test('T4 模板形态接线识别:分发器派生的子门算已接线,且不误伤无关名', () => {
  const corpus = 'execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`)'
  const m = G.buildTemplateMatchers(corpus)
  assert.ok(m.length >= 1, '未从 ${target} 拼接形态提取到 matcher')
  for (const t of ['scan-web-dead-i18n-keys.mjs', 'scan-miniapp-taro-dead-i18n-keys.mjs', 'scan-desktop-dead-i18n-keys.mjs']) {
    assert.ok(G.gateMatchesTemplates(t, m), `模板漏判 ${t}`)
  }
  assert.equal(G.gateMatchesTemplates('check-other.mjs', m), null)
})

test('T5 五处权威接线点结构:pre-commit 真实逻辑必须在强接线集合内', () => {
  const strongIds = G.WIRING_POINTS.strong.map((p) => p.id)
  const weakIds = G.WIRING_POINTS.weak.map((p) => p.id)
  assert.equal(G.WIRING_POINTS.strong.length, 4, '强接线点应为 4 处')
  assert.equal(G.WIRING_POINTS.weak.length, 2, '弱接线点应为 2 处(合起来五处)')
  // 结构事实:2026-09-22 起 .husky/pre-commit 已退化成薄壳,判据必须以 pre-commit-hook.js 为准
  assert.ok(strongIds.includes('pre-commit-hook'))
  assert.ok(
    G.WIRING_POINTS.strong.find((p) => p.id === 'pre-commit-hook').paths.includes('scripts/lib/pre-commit-hook.js'),
  )
  assert.ok(strongIds.includes('runner') && strongIds.includes('husky') && strongIds.includes('package-json'))
})

test('T6 classifyGate 优先级:弱接线不判红 / 声称优先于台账 / 无声称才落 R3', () => {
  const base = { strongPoints: [], weakPoints: [], headerClaims: [], agentsClaims: [], allowEntry: null }
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs' }).status, 'unwired-unclaimed')
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', weakPoints: ['ci-workflows'] }).status, 'wired-weak')
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', headerClaims: ['集成位置'] }).status, 'red-r1')
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', agentsClaims: ['- 守门'] }).status, 'red-r2')
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', strongPoints: ['runner'] }).status, 'wired')
  // 反作弊:台账(dispatcher 或任意 type)都不得为撒谎门开脱
  const allow = { script: 'a.mjs', type: 'dispatcher', dispatcher: 'guardian-runner.mjs', reason: '为消红而登记' }
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', headerClaims: ['集成位置'], allowEntry: allow }).status, 'red-r1')
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', agentsClaims: ['- 守门'], allowEntry: allow }).status, 'red-r2')
  // 台账只救 R3
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', allowEntry: allow }).status, 'exempt')
  // 本门自身豁免(创建当期 HEAD 内还没有它)
  assert.equal(G.classifyGate({ ...base, name: G.SELF_EXEMPT_SCRIPT, headerClaims: ['集成位置'] }).status, 'self-exempt')
})

test('T7 R2:AGENTS.md 必须「点名 + 同一条款含接线表述」两条件齐', () => {
  const clauses = G.splitAgentClauses(
    '# 标题\n\n- 守门:`scripts/check-real.mjs`(blocking,2026-09-24 立)\n\n- 只是历史记录,提到 scripts/check-hist.mjs 曾存在。\n\n另一段\n\n- `scripts/check-plain.mjs` 是可选手动跑的脚本\n',
  )
  assert.equal(G.findAgentsClaims(clauses, 'check-real.mjs').length, 1)
  assert.equal(G.findAgentsClaims(clauses, 'check-hist.mjs').length, 0)
  assert.equal(G.findAgentsClaims(clauses, 'check-none.mjs').length, 0)
})

test('T8 台账卫生:可撤销豁免 + 僵尸条目 + 格式校验', () => {
  const wired = new Set(['check-wired.mjs'])
  assert.equal(G.findRevocableExemptions([{ script: 'check-wired.mjs', type: 'standalone-tool', reason: 'x x x x x x x x' }], wired).length, 1)
  assert.equal(G.findRevocableExemptions([{ script: 'check-x.mjs', type: 'standalone-tool', reason: 'ok reason here' }], wired).length, 0)
  assert.equal(G.findStaleExemptions([{ script: 'gone.mjs', type: 'doc-only' }], new Set(['check-x.mjs'])).length, 1)
  const bad = G.validateAllowlist({ entries: [{ script: 'check-a.mjs', type: 'nope' }] })
  assert.equal(bad.problems.length, 2, 'type 非法 + 缺依据说明应各报一条')
  assert.deepEqual(G.validateAllowlist({}).problems.length, 1)
  assert.equal(
    G.validateAllowlist({
      entries: [{ script: 'check-a.mjs', type: 'dispatcher', dispatcher: 'guardian-runner.mjs', reason: '由分发器统一派生子门,自身无独立调用点' }],
    }).problems.length,
    0,
  )
})

test('T9 git grep 输出解析:HEAD:<path>:<match>,且只认全集内的名字', () => {
  const byPath = G.parseGrepHits(
    'HEAD:scripts/guardian-runner.mjs:check-a.mjs\nHEAD:package.json:check-b.mjs\nHEAD:package.json:check-z.mjs\n噪音行',
    ['check-a.mjs', 'check-b.mjs'],
  )
  assert.ok(byPath.get('scripts/guardian-runner.mjs').has('check-a.mjs'))
  assert.ok(byPath.get('package.json').has('check-b.mjs'))
  assert.equal(byPath.get('package.json').has('check-z.mjs'), false)
})

test('T10 取原文不吃尾行(不 trim)与零宽字符剥离', () => {
  assert.equal(G.extractHeaderRegion('// 头\n'), '// 头\n')
  assert.ok(G.extractHeaderRegion('/*\n * 头\n */\ncode\n').endsWith('*/'))
  assert.ok(!G.extractHeaderRegion('/*\n * 头\n */\ncode\n').includes('code'), '代码行不得进入头部区')
  assert.deepEqual(G.extractHeaderClaims('集成​位置: pre-commit 第 9 项'), ['集成位置'])
  // 声称数组按 HEADER_CLAIM_PATTERNS 顺序返回(集成位置在前)
  assert.deepEqual(G.extractHeaderClaims('接入​ pre-commit 与集成位置均在头部'), ['集成位置', '接入 pre-commit'])
})

test('T11 R1 判据收紧**双向**:如实陈述不判红 / 肯定式声称必判红', () => {
  // 负向(真仓两处假红的原文形态):「可选挂到…或手动」「…后续项」
  assert.deepEqual(G.extractHeaderClaims('集成位置: 可选挂到 pre-commit(不阻塞)或手动 `pnpm check:routes:ignore`'), [])
  assert.deepEqual(G.extractHeaderClaims('集成位置: CI / guardian-runner 后续项(暂 FAIL-blocking + WARN-only)'), [])
  // 正向:肯定式声称必须照旧识别(收窄没削掉有效面)
  assert.deepEqual(G.extractHeaderClaims('集成位置: scripts/guardian-runner.mjs 第 87 项(blocking)'), [
    '集成位置',
    'guardian-runner 第 N 项',
  ])
  // 正向:标签行换行后的肯定式子弹(真仓 guard-push 原文形态)必判红,两类表述都在
  assert.deepEqual(
    G.extractHeaderClaims(
      '集成位置:\n *   - .husky/pre-commit: 集成 whitelist 模式,在 commit 前检测\n *   - .husky/pre-push: 集成 baseline 模式\n *\n * 设计权衡:\n',
    ),
    ['集成位置', 'pre-push'],
  )
  // 窗口终止:注释块的「*」空行算段落结束,不得一路吞进下一小节
  assert.equal(G.claimWindow([' * 集成位置:', ' *   - a', ' *', ' * 下一小节'], 0), ' * 集成位置:\n *   - a')
  assert.ok(G.CLAIM_NEGATION_RE.test('后续项'))
  // 反向钉死:否定标记只认这 14 个词,不得把普通「不」当否定
  assert.equal(G.CLAIM_NEGATION_RE.test('不阻塞 commit'), false)
})

test('T12 R2 判据收紧**双向**:同块他句不算声称 / 同句声称必判红', () => {
  // 负向 1:真仓 AGENTS §1 原文形态(「守门」来自示例代码,末句只是「扫描工具」提法)
  assert.deepEqual(
    G.findAgentsClaims(
      [
        '- **任务认领**:例 `- [ ]（进行中）O20d 守门...`;完成后改 `[x] ✅(日期)`。派单前先扫进行中项。扫描工具:`node scripts/check-task-claims.mjs`。',
      ],
      'check-task-claims.mjs',
    ),
    [],
  )
  // 负向 2:「另有 A 与 B(后者为 …第 36 项实际调用项)」——被声称接的是 B,不是 A
  const dup =
    '- 另有 `scripts/check-miniapp-taro-design-tokens.mjs` 与 `scripts/check-miniapp-tokens-sync.mjs`(后者为 guardian-runner 第 36 项实际调用项)校验同步一致性。'
  assert.deepEqual(G.findAgentsClaims([dup], 'check-miniapp-taro-design-tokens.mjs'), [])
  // 正向:同句含接线表述,即便在 bullet 列表中间也必判红
  assert.equal(G.findAgentsClaims(['- 另有 `scripts/a.mjs`(守门,blocking)与 `scripts/b.mjs`。'], 'a.mjs').length, 1)
  assert.equal(G.findAgentsClaims(['- 别的说明。另见 `scripts/d.mjs`,该门 blocking。'], 'd.mjs').length, 1)
  // 正向:跨行同句(句子未以句末标点结束)仍算同一句
  assert.equal(
    G.findAgentsClaims(['**守门**:`scripts/e.mjs`(blocking)\n- 补充说明,与别的门无关'], 'e.mjs').length,
    1,
  )
  assert.ok(G.AGENTS_SENTENCE_SPLIT_RE.test('a。b'), '句界常量必须认 。')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
