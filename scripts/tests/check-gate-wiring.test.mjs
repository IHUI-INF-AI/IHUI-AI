#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-gate-wiring.test.mjs — 守门脚本接线对账门的 §22c 镜像测试
 *
 * 取向:一律 import 源文件的 `__test__` 导出,**不复制任何判据实现**(§22c 红线)。
 * 夹具全部现造字符串,不依赖真仓内容(教训:「棘轮自测夹具别写死存量路径」),
 * 端到端正反对账在源脚本的 `--self-test` 里用独立临时仓库完成。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  assert.deepEqual(
    G.extractHeaderClaims('用法: node scripts/check-x.mjs --staged\n纯 CLI 工具,人工按需跑'),
    [],
  )
})

test('T4 模板形态接线识别:分发器派生的子门算已接线,且不误伤无关名', () => {
  const corpus = 'execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`)'
  const m = G.buildTemplateMatchers(corpus)
  assert.ok(m.length >= 1, '未从 ${target} 拼接形态提取到 matcher')
  for (const t of [
    'scan-web-dead-i18n-keys.mjs',
    'scan-miniapp-taro-dead-i18n-keys.mjs',
    'scan-desktop-dead-i18n-keys.mjs',
  ]) {
    assert.ok(G.gateMatchesTemplates(t, m), `模板漏判 ${t}`)
  }
  assert.equal(G.gateMatchesTemplates('check-other.mjs', m), null)
})

test('T5 五处权威接线点结构:pre-commit 真实逻辑必须在强接线集合内', () => {
  const strongIds = G.WIRING_POINTS.strong.map((p) => p.id)
  assert.equal(G.WIRING_POINTS.strong.length, 4, '强接线点应为 4 处')
  assert.equal(G.WIRING_POINTS.weak.length, 2, '弱接线点应为 2 处(合起来五处)')
  // 结构事实:2026-09-22 起 .husky/pre-commit 已退化成薄壳,判据必须以 pre-commit-hook.js 为准
  assert.ok(strongIds.includes('pre-commit-hook'))
  assert.ok(
    G.WIRING_POINTS.strong
      .find((p) => p.id === 'pre-commit-hook')
      .paths.includes('scripts/lib/pre-commit-hook.js'),
  )
  assert.ok(
    strongIds.includes('runner') &&
      strongIds.includes('husky') &&
      strongIds.includes('package-json'),
  )
})

test('T6 classifyGate 优先级:弱接线不判红 / 声称优先于台账 / 无声称才落 R3', () => {
  const base = {
    strongPoints: [],
    weakPoints: [],
    headerClaims: [],
    agentsClaims: [],
    allowEntry: null,
  }
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs' }).status, 'unwired-unclaimed')
  assert.equal(
    G.classifyGate({ ...base, name: 'a.mjs', weakPoints: ['ci-workflows'] }).status,
    'wired-weak',
  )
  assert.equal(
    G.classifyGate({ ...base, name: 'a.mjs', headerClaims: ['集成位置'] }).status,
    'red-r1',
  )
  assert.equal(
    G.classifyGate({ ...base, name: 'a.mjs', agentsClaims: ['- 守门'] }).status,
    'red-r2',
  )
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', strongPoints: ['runner'] }).status, 'wired')
  // 反作弊:台账(dispatcher 或任意 type)都不得为撒谎门开脱
  const allow = {
    script: 'a.mjs',
    type: 'dispatcher',
    dispatcher: 'guardian-runner.mjs',
    reason: '为消红而登记',
  }
  assert.equal(
    G.classifyGate({ ...base, name: 'a.mjs', headerClaims: ['集成位置'], allowEntry: allow })
      .status,
    'red-r1',
  )
  assert.equal(
    G.classifyGate({ ...base, name: 'a.mjs', agentsClaims: ['- 守门'], allowEntry: allow }).status,
    'red-r2',
  )
  // 台账只救 R3
  assert.equal(G.classifyGate({ ...base, name: 'a.mjs', allowEntry: allow }).status, 'exempt')
  // 本门自身豁免(创建当期 HEAD 内还没有它)
  assert.equal(
    G.classifyGate({ ...base, name: G.SELF_EXEMPT_SCRIPT, headerClaims: ['集成位置'] }).status,
    'self-exempt',
  )
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
  assert.equal(
    G.findRevocableExemptions(
      [{ script: 'check-wired.mjs', type: 'standalone-tool', reason: 'x x x x x x x x' }],
      wired,
    ).length,
    1,
  )
  assert.equal(
    G.findRevocableExemptions(
      [{ script: 'check-x.mjs', type: 'standalone-tool', reason: 'ok reason here' }],
      wired,
    ).length,
    0,
  )
  assert.equal(
    G.findStaleExemptions([{ script: 'gone.mjs', type: 'doc-only' }], new Set(['check-x.mjs']))
      .length,
    1,
  )
  const bad = G.validateAllowlist({ entries: [{ script: 'check-a.mjs', type: 'nope' }] })
  assert.equal(bad.problems.length, 2, 'type 非法 + 缺依据说明应各报一条')
  assert.deepEqual(G.validateAllowlist({}).problems.length, 1)
  assert.equal(
    G.validateAllowlist({
      entries: [
        {
          script: 'check-a.mjs',
          type: 'dispatcher',
          dispatcher: 'guardian-runner.mjs',
          reason: '由分发器统一派生子门,自身无独立调用点',
        },
      ],
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
  assert.ok(
    !G.extractHeaderRegion('/*\n * 头\n */\ncode\n').includes('code'),
    '代码行不得进入头部区',
  )
  assert.deepEqual(G.extractHeaderClaims('集成​位置: pre-commit 第 9 项'), ['集成位置'])
  // 声称数组按 HEADER_CLAIM_PATTERNS 顺序返回(集成位置在前)
  assert.deepEqual(G.extractHeaderClaims('接入​ pre-commit 与集成位置均在头部'), [
    '集成位置',
    '接入 pre-commit',
  ])
})

test('T11 R1 判据收紧**双向**:如实陈述不判红 / 肯定式声称必判红', () => {
  // 负向(真仓两处假红的原文形态):「可选挂到…或手动」「…后续项」
  assert.deepEqual(
    G.extractHeaderClaims('集成位置: 可选挂到 pre-commit(不阻塞)或手动 `pnpm check:routes:ignore`'),
    [],
  )
  assert.deepEqual(
    G.extractHeaderClaims('集成位置: CI / guardian-runner 后续项(暂 FAIL-blocking + WARN-only)'),
    [],
  )
  // 正向:肯定式声称必须照旧识别(收窄没削掉有效面)
  assert.deepEqual(
    G.extractHeaderClaims('集成位置: scripts/guardian-runner.mjs 第 87 项(blocking)'),
    ['集成位置', 'guardian-runner 第 N 项'],
  )
  // 正向:标签行换行后的肯定式子弹(真仓 guard-push 原文形态)必判红,两类表述都在
  assert.deepEqual(
    G.extractHeaderClaims(
      '集成位置:\n *   - .husky/pre-commit: 集成 whitelist 模式,在 commit 前检测\n *   - .husky/pre-push: 集成 baseline 模式\n *\n * 设计权衡:\n',
    ),
    ['集成位置', 'pre-push'],
  )
  // 窗口终止:注释块的「*」空行算段落结束,不得一路吞进下一小节
  assert.equal(
    G.claimWindow([' * 集成位置:', ' *   - a', ' *', ' * 下一小节'], 0),
    ' * 集成位置:\n *   - a',
  )
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
  assert.equal(
    G.findAgentsClaims(['- 另有 `scripts/a.mjs`(守门,blocking)与 `scripts/b.mjs`。'], 'a.mjs')
      .length,
    1,
  )
  assert.equal(
    G.findAgentsClaims(['- 别的说明。另见 `scripts/d.mjs`,该门 blocking。'], 'd.mjs').length,
    1,
  )
  // 正向:跨行同句(句子未以句末标点结束)仍算同一句
  assert.equal(
    G.findAgentsClaims(['**守门**:`scripts/e.mjs`(blocking)\n- 补充说明,与别的门无关'], 'e.mjs')
      .length,
    1,
  )
  assert.ok(G.AGENTS_SENTENCE_SPLIT_RE.test('a。b'), '句界常量必须认 。')
})

test('T13 装车证明:本门自己必须真在 runner 里 blocking,且 R4 真参与 reds(本门自豁免 ⇒ 无人替它兜底)', () => {
  // 89 号门对自身是 SELF_EXEMPT 的(创建当期 HEAD 里还没有它,设计如此),
  // 所以"它自己被摘掉接线"这件事 R1/R2/R4 都看不见 —— 只能由本用例钉死。
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const runner = readFileSync(join(root, 'scripts/guardian-runner.mjs'), 'utf8')
  const blocks = runner.split(/\n(?=\s*\{\n\s*(?:\/\/[^\n]*\n\s*)?id:\s*)/)
  const mine = blocks.filter((b) => /script:\s*'check-gate-wiring\.mjs'/.test(b))
  assert.equal(mine.length, 1, `runner 里本门条目应恰好 1 份(实得 ${mine.length})`)
  assert.match(mine[0], /id:\s*'89'/, '本门编号 89 漂移')
  assert.match(mine[0], /mode:\s*'blocking'/, '本门必须是 blocking(warn 等于没有)')
  assert.match(mine[0], /skipEnv:\s*'HUSKY_SKIP_GATE_WIRING'/, '本门必须有应急通道')

  // R4 升 blocking 的装车证明:未点名者必须进 reds 数组(而不是只 console.log 报数)。
  const self = readFileSync(join(root, 'scripts/check-gate-wiring.mjs'), 'utf8')
  assert.equal(
    (self.match(/status:\s*'red-r4'/g) || []).length,
    1,
    'R4 必须恰好一次进入 reds(行为由源脚本 --self-test 的 M8a/M8b 双向证明)',
  )
  // 输出文案不得再声称 R4 仅报数(与实现相反 = 文档漂移)。只约束那行结论模板,
  // 不约束历史说明(源注释里"由「仅报数」升档"是如实陈述)。
  assert.doesNotMatch(self, /R4\([^)\n]*仅报数/, 'R4 结论行仍写「仅报数」,与实现相反')

  // 文档可见性:本门不得只靠 README 表格里的一枚 incidental 提及活着。
  const docs =
    readFileSync(join(root, 'AGENTS.md'), 'utf8') + readFileSync(join(root, 'README.md'), 'utf8')
  assert.ok(
    /^- \*\*.*\*\*\(89\)/m.test(docs) || /^## .*89/m.test(docs),
    'AGENTS.md 速查须有本门专属条目(标题含 (89))',
  )
})

test('T14 文档面取材口径 HEAD∪索引:五种取用形态,且每种都必须如实报出口径(不得静默)', () => {
  const f = G.combineDocSources
  // 两侧一致 → 取单份(避免整篇文档被拼两遍)
  const same = f({ headText: 'A\n', indexText: 'A\n' })
  assert.equal(same.text, 'A\n')
  // 两侧不一致 → 并集:HEAD 与索引的内容都参与判定
  const both = f({ headText: 'H\n', indexText: 'I\n' })
  assert.ok(
    both.text.includes('H\n') && both.text.includes('I\n'),
    '不一致时必须两侧内容都在并集里',
  )
  // 索引取不到 → 退回 HEAD;HEAD 取不到 → 用索引;双缺 → 空串(绝不读工作区)
  assert.equal(f({ headText: 'H\n', indexText: null }).text, 'H\n')
  assert.equal(f({ headText: null, indexText: 'I\n' }).text, 'I\n')
  const none = f({ headText: null, indexText: null })
  assert.equal(none.text, '')
  // 每种形态都必须带非空 mode(结论行据此如实报口径)
  for (const r of [
    same,
    both,
    f({ headText: 'H\n', indexText: null }),
    f({ headText: null, indexText: 'I\n' }),
    none,
  ]) {
    assert.ok(
      typeof r.mode === 'string' && r.mode.length > 0,
      `口径必须如实报出,不得静默:${JSON.stringify(r)}`,
    )
  }
})

test('T15 文档面取材的退化防线:源脚本读 AGENTS.md/README.md 必须走 HEAD∪索引,不得 readFileSync 工作区', () => {
  // 2026-09-24 口径变更的装车证明:文档面(R2/R4)两个读取点都必须经 docReader.read,
  // 且源码里不得出现以 readFileSync 打开这两份权威文档的形态 —— 那等于把共享工作区里
  // 他人未提交的编辑算进判定(守门 57/77/83 同取向:判仓库内容,不判工作区快照)。
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const self = readFileSync(join(root, 'scripts/check-gate-wiring.mjs'), 'utf8')
  assert.doesNotMatch(
    self,
    /readFileSync\([^)]*AGENTS\.md/,
    '文档面取材退化成了读工作区(AGENTS.md)',
  )
  assert.doesNotMatch(
    self,
    /readFileSync\([^)]*README\.md/,
    '文档面取材退化成了读工作区(README.md)',
  )
  assert.match(
    self,
    /docReader\.read\('AGENTS\.md'\)/,
    "R2 文档面必须走 docReader.read('AGENTS.md')(HEAD∪索引)",
  )
  assert.match(
    self,
    /docReader\.read\('README\.md'\)/,
    "R4 文档面必须走 docReader.read('README.md')(HEAD∪索引)",
  )
  // 旧「仅 HEAD」直读不得在文档面残留(HEAD:AGENTS.md / HEAD:README.md 字面量都不应再出现)
  assert.doesNotMatch(self, /HEAD:AGENTS\.md/, 'R2/R4 仍在 HEAD-only 直读 AGENTS.md(时序陷阱未修)')
  assert.doesNotMatch(self, /HEAD:README\.md/, 'R4 仍在 HEAD-only 直读 README.md(时序陷阱未修)')
})

/**
 * R8 的两条跨文件锁 —— 都**只能**在镜像层做,因为它们判的是"本门与别的文件之间的前提关系",
 * 而本门的 --self-test 只用夹具文本(P28-P34 已把判据本身钉死,这里不重复)。
 *
 * 面口径说明(避免被误读成"镜像测试也判 HEAD"):本文件读**磁盘**,因为它是开发者侧回归;
 * 提交链上那道门判 HEAD / --staged 判索引。两者互补,不互相替代。
 */
test('T16 R8 的前提锁:runner 调度循环必须**没有**把归一层包进 try(否则"抛错=中止整批"这个红理由失效)', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const runner = readFileSync(join(root, 'scripts/guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf('for (const check of effectiveChecks)')
  assert.ok(at > 0, 'runner 的调度循环锚点找不到 —— 结构变了,本测试与 R8 都要跟着改')
  const call = runner.indexOf('stagedPathsTouch(check.stagedTriggers)', at)
  assert.ok(call > 0, 'runner 不再走 stagedPathsTouch(check.stagedTriggers) 这一形态 ⇒ R8 的红理由需重估')
  assert.ok(
    !runner.slice(at, call).includes('try {'),
    '归一调用已被 try 包住 ⇒ 一次非法注册不再中止整批 ⇒ R8 必须从"判红"降为"报数",不得继续按旧理由拦人',
  )
  // 同一条前提的第二个失效面:红条件委托的是**运行时那份** lib,若 runner 换掉 import 源就失效
  assert.match(
    runner,
    /from '\.\/lib\/guardian-triggers\.mjs'/,
    'runner 必须仍从 lib 取归一实现 —— 换成第二份实现时,R8 委托的契约就不再是运行时那份',
  )
})

test('T17 真仓注册表 R8 必 0 枚 bad(升档前置:不得留下一枚恒红)', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const r = G.findMalformedTriggers(readFileSync(join(root, 'scripts/guardian-runner.mjs'), 'utf8'))
  assert.deepEqual(
    r.bad,
    [],
    `注册表里有 ${r.bad.length} 枚会让整批门中止的形态:${r.bad.map((b) => `${b.id}=${b.value}`).join(' / ')}`,
  )
  // 三类"不拦但如实报数"的分桶必须都在输出里 —— 缺一项就等于把某类形态静默成"看起来全绿"
  for (const k of ['rescued', 'dead', 'undetermined']) {
    assert.ok(Array.isArray(r[k]), `${k} 必须是数组(结论行要如实报数,不能缺项)`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
