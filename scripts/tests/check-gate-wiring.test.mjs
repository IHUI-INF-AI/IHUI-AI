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
import { existsSync, readFileSync } from 'node:fs'
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

test('T11 R11(G-665)解析判据:两面输出形态都认、content 冒号不干扰;异面前缀/杂行不算', () => {
  assert.deepEqual(
    [
      ...G.parseBaselineUpdateHits(
        'HEAD:.github/workflows/ci.yml:12: run node scripts/check-x.mjs --update-baseline\n',
        'HEAD',
      ),
      ...G.parseBaselineUpdateHits(
        '.github/workflows/release.yml:3: run node scripts/scan-y.mjs --update-baseline --root=G:/a:b\n',
        '',
      ),
    ],
    [
      { path: '.github/workflows/ci.yml', line: 12 },
      { path: '.github/workflows/release.yml', line: 3 },
    ],
  )
  // 负向:空输出 / 无行号锚的杂行 / 其它 rev 前缀的行(别的面的输出混入)都不得算命中
  assert.deepEqual(G.parseBaselineUpdateHits('', 'HEAD'), [])
  assert.deepEqual(G.parseBaselineUpdateHits('HEAD:.github/workflows/ci.yml:没有数字:文字', 'HEAD'), [])
  assert.deepEqual(G.parseBaselineUpdateHits('main:.github/workflows/ci.yml:5:x --update-baseline', 'HEAD'), [])
  // 常量钉死:旗标与 CI 面目录改动必须显式过人(判据本体随常量漂移=失明)
  assert.equal(G.R11_BASELINE_FLAG, '--update-baseline')
  assert.equal(G.R11_CI_DIR, '.github/workflows')
})

test('T5 权威接线点结构:pre-commit 真实逻辑与守护巡检都必须在强接线集合内(判不变量,不判裸计数)', () => {
  const strongIds = G.WIRING_POINTS.strong.map((p) => p.id)
  // 计数锁会挡掉正当扩面(2026-10-01 加 git-guardian 那一次就是被"应为 4 处"绊住),
  // 而本条真正在乎的是**这些调度器不能掉**:把它们写成"必须包含"的子集判据,少一个即红,
  // 多一个不挡 —— 与"会过期的豁免清单不得当断言"是同一条规矩。
  const REQUIRED_STRONG = [
    'runner',
    'pre-commit-hook',
    'husky',
    'package-json',
    'git-guardian',
  ]
  for (const id of REQUIRED_STRONG)
    assert.ok(strongIds.includes(id), `强接线集合缺调度器 ${id}(摘掉它 = 该通道调度的门被判 R2 恒红)`)
  assert.equal(
    new Set(strongIds).size,
    strongIds.length,
    `强接线 id 不得重复:${JSON.stringify(strongIds)}(重复会让失败归属与 skipEnv 串门)`,
  )
  const weakPointIds = G.WIRING_POINTS.weak.map((p) => p.id)
  for (const id of ['ci-workflows', 'cert-runner'])
    assert.ok(weakPointIds.includes(id), `弱接线集合缺 ${id}`)
  assert.equal(new Set(weakPointIds).size, weakPointIds.length, '弱接线 id 不得重复')
  // 结构事实:2026-09-22 起 .husky/pre-commit 已退化成薄壳,判据必须以 pre-commit-hook.js 为准
  assert.ok(
    G.WIRING_POINTS.strong
      .find((p) => p.id === 'pre-commit-hook')
      .paths.includes('scripts/lib/pre-commit-hook.js'),
  )
  // 守护巡检必须是"真读取该路径"的一条,而不是挂着名字的装饰
  assert.ok(
    G.WIRING_POINTS.strong
      .find((p) => p.id === 'git-guardian')
      .paths.includes('scripts/git-guardian.mjs'),
    'git-guardian 点的 paths 必须真指 scripts/git-guardian.mjs',
  )
  // 有牙证明①:由 git-guardian 单点调度的门 ⇒ 归类为 wired(不是 R2/R3)。
  assert.equal(
    G.classifyGate({
      name: 'check-disk-root-hygiene.mjs',
      strongPoints: ['git-guardian'],
      weakPoints: [],
      headerClaims: [],
      agentsClaims: ['- 立盘根卫生守门 `check-disk-root-hygiene.mjs`'],
      allowEntry: null,
    }).status,
    'wired',
    '守护巡检调度未被认成已接线 ⇒ R2 会把每一次提交钉红(恒红门,§12f)',
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

test('T6b 逃生舱不得是假的:门体承诺的 HUSKY_SKIP_* 必须在 runner 真声明(2026-10-03)', () => {
  // 背景:门 44 / 30a 的**脚本里一直读** HUSKY_SKIP_ROOT_DIR_GUARD / HUSKY_SKIP_COMMIT_LOSS_CHECK,
  // 而 guardian-runner 从未声明 ⇒ 那些变量设了毫无效果(= 假逃生舱),逼人改用 --no-verify
  // 连带废掉全部 210+ 道门。本仓 TAGSVIEW_GUARD 早就踩过同一型并留下修法注释。
  // 这条断言钉住"脚本读了 ⇒ runner 必须声明"这个配对,防止将来又被删成假舱。
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const runner = readFileSync(join(root, 'guardian-runner.mjs'), 'utf8')
  const pairs = [
    ['check-root-dir-clean.mjs', 'HUSKY_SKIP_ROOT_DIR_GUARD'],
    ['check-commit-loss-guard.mjs', 'HUSKY_SKIP_COMMIT_LOSS_CHECK'],
    ['check-input-border-var.mjs', 'HUSKY_SKIP_INPUT_BORDER_VAR'],
  ]
  for (const [script, env] of pairs) {
    // ① 门体脚本必须真读这个变量(否则声明了也没人消费)
    const body = readFileSync(join(root, script), 'utf8')
    assert.ok(body.includes(env), `${script} 必须自己读 ${env}(否则 runner 声明了也是空舱)`)
    // ② runner 的注册项必须声明它 —— 取 script 行往后 1200 字符的注册块
    const i = runner.indexOf(`script: '${script}'`)
    assert.ok(i > 0, `guardian-runner.mjs 里找不到 ${script} 的注册项`)
    const block = runner.slice(i, i + 1200)
    assert.ok(
      block.includes(`skipEnv: '${env}'`),
      `${script} 的注册项缺 skipEnv: '${env}' ⇒ 假逃生舱(设了变量也没效果,只剩 --no-verify 一条路)`,
    )
  }
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

test('T8b R5 判据面:注释里提及 id 不构成登记(2026-10-03 RED-R5 假撞号实证),真同号仍判红', () => {
  const findDuplicateIds = G.findDuplicateIds
  const stripJsComments = G.stripJsComments
  const Q = String.fromCharCode(39) // 单引号,绕开模板串里的转义
  // ① 本仓真实成因:核号命令的字面量写在注释里,全文正则把它读成第二次注册
  const commentOnly = [
    '// 编号 186:注册前已核 `grep -n "id: ' + Q + '186' + Q + '"` 为空(未被占用)',
    "  { id: '186', script: 'a.mjs' },",
  ].join('\n')
  assert.deepEqual(
    findDuplicateIds(commentOnly),
    [],
    '注释里出现 id 字面量不得被读成登记(本仓 186/187 两枚新门当天就是这样被误判成撞号的)',
  )
  // ② 反向:真撞号必须照旧判红(判据没有被顺手削掉)
  assert.deepEqual(
    findDuplicateIds(["  { id: '9' },", "  { id: '9' },"].join('\n')),
    ['9'],
    '两道真门用同一 id 必须判红',
  )
  // ③ 块注释同样不算登记
  assert.deepEqual(
    findDuplicateIds(['/* id: ' + Q + '5' + Q + ' */', "  { id: '5' },"].join('\n')),
    [],
    '块注释里的 id 也不构成登记',
  )
  // ④ 剥注释不得吃掉字符串里的真代码(URL 里的 // 不是注释起点)
  assert.deepEqual(
    findDuplicateIds(["const u = 'https://a/b';", "  { id: '7' },", "  { id: '7' },"].join('\n')),
    ['7'],
    "字符串字面量里的 '//' 不得被当成行注释起点(否则其后的真登记被整段吃掉,门会漏红)",
  )
  // ⑤ 剥注释保留行数(错误信息仍能按行定位)
  const raw = ['a', '// x', 'b', '/* y', ' z */', 'c'].join('\n')
  assert.equal(
    stripJsComments(raw).split('\n').length,
    raw.split('\n').length,
    '剥注释不得改变行数',
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

test('T12b R2 与 R1 必须同一条否定词判据(如实陈述不得被读成撒谎 / 肯定式声称不得被遮蔽)', () => {
  // 负向:同一扇门、同一句**如实**声明"尚未接线" ⇒ 不得算声称。
  // 立据:AGENTS_CLAIM_RE 含「守门」「blocking」,在 AGENTS.md 里描述一道门几乎必然撞上,
  // 没有这一条 ⇒ 未接线的门在文档里没有合法写法,89 对每次提交恒红(§12f 同型)。
  assert.deepEqual(
    G.findAgentsClaims(
      ['- **某门对账**(`scripts/check-manual-thing.mjs`,**尚未接提交链**,判据与出口表见正文)。'],
      'check-manual-thing.mjs',
    ),
    [],
  )
  // 正向(遮蔽反向):同一条款里**既有**如实声明**又有**一句肯定式声称 ⇒ 后者必须仍判红。
  // 只做上一条而不做这一条,等于"条款里出现一个『尚未』就整块免检"——那是放松,不是对称。
  assert.equal(
    G.findAgentsClaims(
      [
        '- 初版**尚未接提交链**。后来接入:`scripts/check-manual-thing.mjs`(blocking,pre-commit 必跑)。',
      ],
      'check-manual-thing.mjs',
    ).length,
    1,
  )
  // 命中「守门」但同句声明"按需手动跑(未接线)" ⇒ 不算声称(词表只有一份,与 R1 共用)
  assert.equal(
    G.findAgentsClaims(['- `scripts/x.mjs` 属**守门**,按需手动跑(未接线)。'], 'x.mjs').length,
    0,
  )
  assert.ok(
    /CLAIM_NEGATION_RE\.test\(sent\)/.test(G.findAgentsClaims.toString()),
    'R2 必须复用 CLAIM_NEGATION_RE 那一份实现(不得另抄否定词正则)',
  )
})

test('T26 否定判据必须有结构层:同义否定整族与存档句不得判红,谎报半句必须仍红', () => {
  // 负向(本组修复的真缺陷):「未接入/未纳入/未挂载/未登记」这一族**整族**不在
  // CLAIM_NEGATION_RE 的枚举里 —— 只靠那张抄出来的词表时,判据的可靠性取决于「有人恰好把
  // 常用否定说法逐个抄进去」。改前实测:同一夹具仅把头注「未接线」换成「未接入」,
  // 即从「无 R1 红」变成「[RED-R1]」,如实陈述被当成谎报(本仓同族已修 40+ 例的同型)。
  // 用例**不带任何救场词**:真仓那 5 枚写「未接入」的门改前是靠「手动/按需」侥幸没红,
  // 侥幸不是判据。
  for (const w of ['未接入 runner', '未纳入 runner', '未挂载到任何钩子', '未登记进 runner']) {
    assert.deepEqual(
      G.extractHeaderClaims(`集成位置: ${w}。`),
      [],
      `R1 不得把如实陈述「${w}」判成谎报`,
    );
  }
  // 正向(遮蔽反向,缺这条则本用例只是"放松"不是"修准"):同句并存时谎报那半句必须仍红。
  assert.ok(
    G.extractHeaderClaims('集成位置: 未纳入 runner,已接入 guardian-runner 第 88 项。').length >= 1,
    '同句后半的肯定式谎报必须仍判红(加个「未」不得洗白)',
  );
  // 存档语气:如实记录历史不是谎报现状(同族已踩三次)。
  assert.deepEqual(
    G.extractHeaderClaims('集成位置: 原 2026-08-01 接入 runner 第 89 项,2026-09-01 撤出。'),
    [],
    '「原<日期>接入…撤出」是记录历史,不得判红',
  );
  assert.equal(
    G.findAgentsClaims(
      [
        '- `scripts/check-x.mjs`:当前未接入 runner。\n- 历史:原 2026-08-01 接入 runner 第 89 项,2026-09-01 撤出。',
      ],
      'check-x.mjs',
    ).length,
    0,
    'R2 同样不得把「记录历史」判成谎报',
  );
  // 形状锁:R1/R2 共用同一份结构判据;否定词必须**紧邻**动词,普通「不」不算否定。
  assert.ok(
    /isNegatedWiringSentence\(win\)/.test(G.extractHeaderClaims.toString()) &&
      /isNegatedWiringSentence\(sent\)/.test(G.findAgentsClaims.toString()),
    'R1/R2 必须共用同一份结构否定判据(禁止另写一套否定逻辑)',
  );
  assert.equal(G.isNegatedWiringSentence('不阻塞 commit'), false, '普通「不」不得被当成否定');
  assert.equal(
    G.isNegatedWiringSentence('集成位置: .husky/pre-commit 已接入'),
    false,
    '肯定式接线必须认成声称',
  );
  assert.equal(G.isNegatedWiringSentence('集成位置: 未接入 runner'), true);
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

test('T18 R9 的装车证明:main() 必须真的调用判据并把 red-r9 推进 reds(函数在而没人调 = 提交链上一路绿灯)', () => {
  const src = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'check-gate-wiring.mjs'), 'utf8')
  assert.match(src, /const r9 = findAbsentGateScripts\(/, 'main() 未调用 R9 判据 ⇒ 该维零调度')
  // 红必须参与退出码(只打印不改退出码 = 下一次没人看,与本仓"报数不判红"的例外清单互斥)
  assert.match(src, /status:\s*'red-r9'/, 'R9 未产出 red-r9 条目 ⇒ 不会进 reds、不影响退出码')
  // 存在性面与注册面必须同源:--staged 读索引注册就必须用索引枚举判存在
  assert.match(
    src,
    /r8Face === '索引'[\s\S]{0,200}git\(\['ls-files'\]/,
    'R9 的存在性集合必须随注册面切换(读索引注册却按 HEAD 判存在 = 基准错位的尺子)',
  )
})

test('T19 真仓注册表 R9 必 0 枚缺席,且 registered 必须 > 0(两条同时成立才算"判据有牙且没瞎")', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const has = (p) => existsSync(join(root, p))
  const r = G.findAbsentGateScripts(readFileSync(join(root, 'scripts/guardian-runner.mjs'), 'utf8'), has)
  assert.deepEqual(
    r.absent,
    [],
    `注册表点名要跑而面上没有:${r.absent.map((a) => `${a.id}=scripts/${a.script}`).join(' / ')}`,
  )
  assert.ok(r.registered > 100, `只解析到 ${r.registered} 条注册 ⇒ 尺子对真仓格式失明(不得把 0 当通过)`)
  assert.ok(
    r.checked > 0,
    'checked=0 而 absent=0 是"什么都没看"的形状,不是"都好了" —— 这条断言防的就是空扫冒充通过',
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

// ─────────────────────────────────────────────────────────────────────────
// R10(票 G-409):文档/登记表点名 ↔ 实现侧存在
//   成对判据一律在这里钉住(端到端三态另由源脚本 --self-test 的 R10a–R10h 用临时仓库跑),
//   本文件守的是**判据形状**:两臂必须互为对照,缺一臂就退化成"只会响的喇叭"。
// ─────────────────────────────────────────────────────────────────────────

/** 一条"文档声称这道门已接线"的登记行(AGENTS 速查里最常见的形态) */
const DOC_CLAIM_LINE = '\n- 守门:`scripts/check-ghost-r10.mjs`(blocking,guardian 第 899 项)\n'
const docsOf = (text) => [{ name: 'AGENTS.md', text }]
const emptyAllow = new Set()

test('T20 R10 成对 ①②:点名一道不存在的门必被抓住;同一行改指真实存在的门必须放它过去', () => {
  // ① 门体不在面上 ⇒ 必点名,且要报出"哪份文档第几行"(只报数不能复核)
  const hit = G.findDocNamedAbsentGates({
    docs: docsOf('- 速查\n' + DOC_CLAIM_LINE),
    hasPath: () => false,
    allowNames: emptyAllow,
  })
  assert.equal(hit.gap.length, 1, '一行接线断言 + 门体不在面上 ⇒ 必须落 gap')
  assert.equal(hit.gap[0].script, 'check-ghost-r10.mjs')
  assert.equal(hit.gap[0].doc, 'AGENTS.md')
  assert.ok(hit.gap[0].line >= 1 && hit.gap[0].excerpt.includes('check-ghost-r10'), '必须带可复核的出处')
  // ② 同一行,唯一变量换成"门体在面上" ⇒ 必须放过(否则本门会在每一条正常登记行上响)
  const miss = G.findDocNamedAbsentGates({
    docs: docsOf('- 速查\n' + DOC_CLAIM_LINE),
    hasPath: (p) => p === 'scripts/check-ghost-r10.mjs',
    allowNames: emptyAllow,
  })
  assert.equal(miss.gap.length, 0, '门体在面上 ⇒ 一态都不许进(这条是 ① 的对照组)')
  assert.equal(miss.named, 1, '点名计数仍要如实记上,不能因为放过就看不见')
  assert.deepEqual([miss.narrative.length, miss.exempt.length], [0, 0])
})

test('T21 R10 三态不并桶:接线断言/叙述性/台账三条落点各归一处,且互不顶名额', () => {
  const text =
    '- 守门:`scripts/check-gap-r10.mjs`(blocking)\n' +
    '可复用到:任何场景(如 `scripts/check-narrative-r10.mjs` 等)。\n' +
    '- 守门:`scripts/check-allowed-r10.mjs`(blocking)\n'
  const r = G.findDocNamedAbsentGates({
    docs: docsOf(text),
    hasPath: () => false,
    allowNames: new Set(['check-allowed-r10.mjs']),
  })
  assert.deepEqual(r.gap.map((x) => x.script), ['check-gap-r10.mjs'], '真缺口只该有带接线断言的那一条')
  assert.deepEqual(r.narrative.map((x) => x.script), ['check-narrative-r10.mjs'], '散文举例不得算缺口')
  assert.deepEqual(r.exempt.map((x) => x.script), ['check-allowed-r10.mjs'], '台账条目必须单独成一组(不并进 gap)')
  assert.equal(r.named, 3, '三态合计必须等于点名总数 —— 少了就是有一类被静默吞掉')
})

test('T22 R10 与 R4 严格互补:runner 有门而文档没点名只归 R4,R10 不得重复计债', () => {
  const wired = ['check-wired.mjs', 'check-undocumented.mjs']
  const docText = '- 已接线:`scripts/check-wired.mjs`(blocking)\n'
  const r4 = G.findUndocumentedGates(wired, docText)
  assert.deepEqual(r4, ['check-undocumented.mjs'], 'R4 的既有语义不得被改动')
  // 这一型里门体**在面上**(它已接线),所以 R10 的三态都不得含它 —— 两道门各计一次会让
  // 同一笔债在两份报告里互相顶掉(守门 134 那条锚点粒度教训同型)。
  const r10 = G.findDocNamedAbsentGates({
    docs: docsOf(docText),
    hasPath: (p) => p === 'scripts/check-wired.mjs',
    allowNames: emptyAllow,
  })
  const all = [...r10.gap, ...r10.narrative, ...r10.exempt].map((x) => x.script)
  assert.equal(all.includes('check-undocumented.mjs'), false, 'R10 不得把"文档没点名"算成自己的账')
  assert.deepEqual(all, [])
})

test('T23 R10 编号维:只报数、永不判红,且带字母后缀的 id 不得被截成整数冒充缺口', () => {
  const runner =
    "const G = [\n  { id: '1', script: 'check-wired.mjs' },\n  { id: \"42\", script: 'check-quoted.mjs' },\n  { id: '13c', script: 'check-suffix.mjs' },\n]\n"
  const reg = G.parseRunnerRegistrations(runner)
  assert.deepEqual([...reg.ids].sort(), ['1', '13c', '42'], '单/双引号与带后缀 id 都必须认(否则合法注册会被读成失踪)')
  const stale = G.findStaleIdMentions({
    docs: docsOf(
      [
        '守门 13c 与本条无关(带后缀,必须放过)。',
        '守门 777 说的其实是 `scripts/check-wired.mjs`(它挪过号了)。',
        '```',
        '守门 888 是围栏里的示例,不得计数。',
        '```',
      ].join('\n'),
    ),
    runnerIds: reg.ids,
    runnerScripts: reg.byScript,
  })
  assert.deepEqual(stale.map((x) => x.id), ['777'], '只有真失踪的编号该被点名:13c 不能截成 13,围栏内不能算')
  assert.equal(stale[0].actual, '1', '同一行点了门体的名 ⇒ 必须回指它在注册面上的真实 id(可复核的出处)')
})

test('T24 R10 形状锁:main() 必须真把判据挂上,默认档不得进 reds,文档面不得退化读工作区', () => {
  const src = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'check-gate-wiring.mjs'), 'utf8')
  const main = src.slice(src.indexOf('async function main('), src.indexOf('// ─── self-test'))
  assert.ok(main.length > 500, 'main() 区块取形失败(截取判据的前置条件不成立 ⇒ 本条断言无牙)')
  // ① 装车:两条判据必须被 main() 真调用(函数在而无人调 = 提交链上一路绿灯,守门 70/102 同型)
  for (const call of ['findDocNamedAbsentGates(', 'findStaleIdMentions(', 'parseRunnerRegistrations(']) {
    assert.ok(main.includes(call), `main() 里没有调用 ${call} ⇒ R10 对该形态失明`)
  }
  // ② 定级:red-r10 只允许出现在 --strict 分支里(默认档判红 = 与改动无关的恒红门,§12e)
  const strictGuard = main.match(/if \(opts\.strict\) \{[\s\S]{0,400}?red-r10/)
  assert.ok(strictGuard, 'red-r10 必须在 `if (opts.strict)` 块内 —— 默认档判红就是造一台恒红机')
  assert.equal(
    (main.match(/status: 'red-r10'/g) || []).length,
    1,
    "red-r10 只允许有一处 push 点(两处就会让默认档在某一支上偷偷判红)",
  )
  // ③ 取材面:R10 的两份文档必须复用 docReader(HEAD∪索引),不得另起一次工作区读取
  assert.ok(/const readmeText = docReader\.read\('README\.md'\)/.test(main), 'README.md 必须走 docReader(与 R2/R4 同面)')
  assert.ok(!/readFileSync\([^)]*(AGENTS|README)\.md/.test(main), '文档面禁止 readFileSync 工作区(他人未提交的编辑不算仓库内容)')
  // ④ 存在性面:必须把索引并进 HEAD 全树(同一枚提交里"新立门 + 补点名行"不得被自己挡住)
  assert.ok(/r10Face[\s\S]{0,160}tracked[\s\S]{0,80}r10IndexPaths|new Set\(\[...tracked, \.\.\.r10IndexPaths\]\)/.test(main), 'R10 存在性面必须是 HEAD ∪ 索引')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
