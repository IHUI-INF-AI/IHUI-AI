// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `scripts/check-provider-health-vocabulary.mjs` 的 §22c 镜像测试(台账 G-814416,2026-10-08 立)。
//
// 为什么必须存在:本门判的是"档位值域有没有第二份同值声明",而它的测试若自己再写一份解析
// 规则或一份成员清单,就成了"用另一把尺子量同一件事"—— 门漂移时测试照样绿(§22c:镜像只复读
// 实现就是复读机)。所以本文件**只 import 生产实现**,成员集合一律由门从被审面现读,一条解析
// 规则都不重写;真仓面(T2/T3/T4)逐字取 HEAD 内容,不靠自造夹具顶替(AGENTS §22c 的
// archive-completed-tasks 教训:夹具复刻的是实现的形状,漂移 11 天全绿)。
//
// 跑法:`node --test scripts/tests/check-provider-health-vocabulary.test.mjs`

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-provider-health-vocabulary.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-provider-health-vocabulary.mjs'
const TEST_NAME = 'check-provider-health-vocabulary.test.mjs'

/** git 派生一律显式 stdio + windowsHide(AGENTS §12g:缺省 stdio 在本机稳定 EBUSY)。 */
function gitAt(root, args) {
  return execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-C', root, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  })
}

/** HEAD 面取正文(测试判的是提交内容,不是可能滞后的共享工作树)。 */
function headFile(rel) {
  return catBatch(ROOT, [`HEAD:${rel}`]).get(`HEAD:${rel}`) ?? null
}

/**
 * 门体与它的镜像测试是**同一枚提交**落地的,HEAD 面在落地前必然读不到(守门 151 镜像测试同源
 * 的处理):这两份只从磁盘读自己;判定用的仓内其它面一律走 headFile(HEAD blob)。
 */
function ownFile(name) {
  try {
    return readFileSync(join(ROOT, 'scripts', name), 'utf8')
  } catch {
    return null
  }
}

const KEYS = (r) => r.violations.map((v) => v.key)

/** 真仓全量档只跑一次(git grep 预筛 + 批量取面有秒级成本,十条用例复用时别派十遍)。 */
let auditCache = null
function headAudit() {
  if (!auditCache) auditCache = gate.runAudit({ root: ROOT, face: 'head' })
  return auditCache
}

test('T1 测试不得有第二份真相:只 import 生产实现,门体走统一取材层与单一遮罩', () => {
  const src = ownFile(join('tests', TEST_NAME))
  const gateSrc = ownFile(SRC_NAME)
  assert.ok(src !== null && gateSrc !== null, '门体或镜像测试不在盘上(交付不完整)')
  assert.match(src, /from '\.\.\/check-provider-health-vocabulary\.mjs'/, '没 import 生产实现')
  // 取材层与遮罩各只许一台(守门 118 / §22c:散写 git show 与自带分词器都是第二份实现)
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/, '门没引统一取材层')
  assert.match(gateSrc, /catBatch/, '门没经 catBatch 取面')
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'/, '门没引唯一遮罩实现')
  assert.doesNotMatch(gateSrc, /readFileSync\(/, '门按磁盘读仓库内容(共享工作树常年滞后 HEAD)')
  assert.doesNotMatch(gateSrc, /'show'/, '门散写 git show 取正文')
  // 反向锁:两份文件自己不得成为"第二份同值声明"(尺子量不到自己就是假绿)
  const members = headAudit().members
  assert.ok(members, 'canonical 现读失败')
  for (const [name, text] of [
    [SRC_NAME, gateSrc],
    [TEST_NAME, src],
  ]) {
    for (const s of gate.declarationSites(text)) {
      assert.notEqual(
        gate.classifyAgainst(s.members, members),
        'exact',
        `${name} 自己写了第二份同值声明(${s.name})`,
      )
    }
  }
})

test('T2 真仓 HEAD 面:并表后的现状必须"非空判据 + 零违规"', () => {
  const res = headAudit()
  assert.equal(res.face, 'head')
  assert.ok(Array.isArray(res.members), `canonical 现读失败:${res.undetermined.join(' | ')}`)
  assert.equal(res.members.length, gate.DOC_MEMBER_COUNT, '档位集合与票面「四档」不符(改档须另票)')
  assert.ok(res.stats.candidateFiles > 0, 'PV2 候选枚举为空 ⇒ 扫描面漂了,这一维等于没跑')
  assert.equal(res.aliasState, 'alias', 'channels-api 的别名不再是"指向 canonical 的类型别名"')
  assert.deepEqual(
    res.violations.map((v) => v.text),
    [],
    'HEAD 面就存在第二份同值声明 / 并表回退',
  )
  assert.equal(res.undetermined.length, 0, res.undetermined.join(' | '))
})

test('T3 阳性对照用真文:把 HEAD 的 channels-api 别名改回手抄联合 ⇒ PV3 必须点名', () => {
  const real = headFile(gate.ALIAS.rel)
  assert.ok(typeof real === 'string' && real.length > 0, `${gate.ALIAS.rel} 取不到`)
  const aliasLine = new RegExp(`^export type ${gate.ALIAS.typeSymbol} = .*$`, 'm').exec(real)
  assert.ok(aliasLine, '现读不到别名声明行(T2 已判过,不该到这里才缺)')
  const members = headAudit().members
  const mutated = real.replace(
    aliasLine[0],
    `export type ${gate.ALIAS.typeSymbol} = ${members.map((m) => `'${m}'`).join(' | ')}`,
  )
  assert.notEqual(mutated, real, '变异没落到文本上(判据没被真正喂到分叉形态)')
  const r = gate.decide({
    canon: headFile(gate.CANON.rel),
    alias: mutated,
    candidates: null,
  })
  assert.ok(
    KEYS(r).includes(`PV3|${gate.ALIAS.rel}|${gate.ALIAS.typeSymbol}`),
    `PV3 没抓住并表回退:${JSON.stringify(r.violations)}`,
  )
})

test('T4 边界对照用真文:近邻域的别的表不得被判成第二份(否则门开始咬别的域)', () => {
  const NEIGHBOURS = [
    'apps/web/src/components/ai/orchestration-hub-panel.tsx',
    'packages/types/src/orchestration.ts',
    'packages/api-client/src/endpoints/llm.ts',
    'apps/api/src/routes/relay-monitor-public.ts',
    'apps/api/src/services/clawdbot/health.ts',
    'apps/api/src/services/relay-health-check-service.ts',
    'apps/web/tests/provider-health-badge.test.ts',
  ]
  const members = headAudit().members
  assert.ok(members, 'canonical 现读失败')
  let sawSubset = false
  let sawOther = false
  for (const rel of NEIGHBOURS) {
    const src = headFile(rel)
    assert.ok(typeof src === 'string', `近邻面取不到:${rel}`)
    for (const s of gate.declarationSites(src)) {
      const cls = gate.classifyAgainst(s.members, members)
      assert.notEqual(cls, 'exact', `${rel}:${s.line} ${s.name} 被判成第二份同值声明(误伤别的域)`)
      if (cls === 'subset') sawSubset = true
      if (cls === 'other') sawOther = true
    }
  }
  // 两条 note 通道都得是活的。HEAD 现读只有真子集样本(apps/api 那份本族表缺 unknown 那一档);
  // 超集那一格今天全仓没有活样本(api-client:237 的上游可用性表根本不含 unknown ⇒ 落 other),
  // 所以用**同一行真文**造前视形态:补上 unknown 之后必须落进"另一张表",而不是"第二份同值副本"。
  assert.ok(sawSubset, '真子集通道失明(缺 unknown 的那份本族表已读不出来)')
  assert.ok(sawOther, '无关域通道失明(别的业务域的表该整个落到 other,而不是逐条放行)')
  const SVC = 'apps/api/src/services/relay-health-check-service.ts'
  const svc = headFile(SVC)
  const svcLine = /^export type HealthStatus = .*$/m.exec(svc)
  assert.ok(svcLine, `现读不到 ${SVC} 的 HealthStatus 声明行`)
  const clsOf = (text) =>
    gate
      .declarationSites(text)
      .filter((s) => s.name === 'HealthStatus')
      .map((s) => gate.classifyAgainst(s.members, members))
  assert.deepEqual(clsOf(svc), ['subset'], '真文现状该落在真子集(不判红)')
  // 变异 1:补齐到全档 ⇒ 必须翻红(PV2 对"新增同值副本"有牙)
  const toExact = svc.replace(svcLine[0], `${svcLine[0]} | 'unknown'`)
  const rExact = gate.decide({
    canon: headFile(gate.CANON.rel),
    alias: headFile(gate.ALIAS.rel),
    candidates: [{ path: SVC, src: toExact }],
  })
  assert.ok(
    KEYS(rExact).includes(`PV2|${SVC}|union|HealthStatus`),
    `补齐到全档后没翻红:${JSON.stringify(rExact.violations)}`,
  )
  // 变异 2:补齐全档再多留一档 ⇒ 只报名不判红(那是另一张表)
  assert.deepEqual(
    clsOf(svc.replace(svcLine[0], `${svcLine[0]} | 'unknown' | 'not_configured'`)),
    ['superset'],
    '超集通道失明(补两档该落 superset 而不是 exact)',
  )
  // 反向对照:同一份真文没被改坏(证明上面两条红是变异造成的,不是恒红)
  const rClean = gate.decide({
    canon: headFile(gate.CANON.rel),
    alias: headFile(gate.ALIAS.rel),
    candidates: [{ path: SVC, src: svc }],
  })
  assert.deepEqual(
    rClean.violations.map((v) => v.key),
    [],
    '真文现状被本门判红(恒红方向)',
  )
})

test('T5 接线方向锁:头注自称未接 ⇒ runner 里必须真的没有条目(反之亦然)', () => {
  const gateSrc = ownFile(SRC_NAME)
  assert.ok(gateSrc !== null, '门体不在盘上(交付不完整)')
  const runner = headFile('scripts/guardian-runner.mjs') ?? ''
  const claimsWired = !/尚未接提交链/.test(gateSrc) && !/刻意尚未接/.test(gateSrc)
  const registered = runner.includes(SRC_NAME)
  if (!claimsWired) assert.equal(registered, false, `头注自称未接,runner 却已登记(${SRC_NAME})`)
  else
    assert.equal(registered, true, `头注自称已接,runner 里却没有条目(守门 89 R2 会对每次提交判红)`)
})

test('T6 判死不记绿:候选枚举到 0 与取不到内容都走未判定,不出合格证', () => {
  const canon = headFile(gate.CANON.rel)
  const alias = headFile(gate.ALIAS.rel)
  const empty = gate.decide({ canon, alias, candidates: [] })
  assert.equal(empty.violations.length, 0)
  assert.ok(
    empty.undetermined.some((u) => u.startsWith('PV2 候选枚举到 0')),
    JSON.stringify(empty.undetermined),
  )
  const missing = gate.decide({ canon, alias, candidates: [{ path: 'apps/x/gone.ts', src: null }] })
  assert.ok(missing.undetermined.some((u) => u.includes('apps/x/gone.ts')))
  const noCanon = gate.decide({ canon: null, alias, candidates: [] })
  assert.equal(noCanon.members, null)
  assert.ok(noCanon.undetermined.some((u) => u.startsWith('PV1')))
})

test('T7 违规带结构化键(棘轮锚在维/文件/形态/符号上,不锚在文案上)', () => {
  const r = gate.decide({
    canon: gate.FIXTURE_CANON,
    alias: gate.FIXTURE_ALIAS_LITERAL,
    candidates: [{ path: 'apps/x/copy.tsx', src: gate.FIXTURE_COPY_ARRAY }],
  })
  assert.deepEqual(KEYS(r).sort(), [
    'PV2|apps/x/copy.tsx|array|COLS',
    `PV3|${gate.ALIAS.rel}|${gate.ALIAS.typeSymbol}`,
  ])
  for (const v of r.violations) assert.match(v.text, /:\d+ /, '违规文本必须带行号')
})

test('T8 扫描面差异锁:测试目录不得被排除(与守门 151 SV3 的刻意差别)', () => {
  const members = headAudit().members
  const hits = gate.grepCandidates(ROOT, 'head', members)
  assert.ok(
    hits.some((p) => p.includes('tests/')),
    `候选里没有测试目录文件 ⇒ tests/ 被排掉了,第二份声明藏进测试目录即失明:${hits.slice(0, 3)}`,
  )
  assert.ok(!hits.includes(gate.CANON.rel), 'canonical 自己不该进候选')
  assert.ok(
    hits.every((p) => !gate.SELF_EXEMPT_RE.test(p)),
    '门不得读自己(AGENTS:读自己会把前提自证洗成恒真)',
  )
})

test('T9 遮罩不漂行号:注释遮完后行数必须不变(违规要指回原文行)', () => {
  const src = headFile(gate.CANON.rel)
  assert.ok(typeof src === 'string')
  assert.equal(gate.mask(src).split('\n').length, src.replace(/\r\n/g, '\n').split('\n').length)
  const withBlocks = `${'// 头注\n'}import { A } from 'a'\n/* 块\n   注 */\nexport const B = 1\n`
  assert.equal(gate.mask(withBlocks).split('\n').length, withBlocks.split('\n').length)
})

test('T10 端到端(独立仓,HEAD 面与索引面都判):新增副本必红,HEAD 已红的按棘轮只报名', () => {
  const dir = mkScratch('provider-health-vocab')
  /** 夹具落盘一律先建目录(独立仓的树是按用例拼出来的,没有现成父目录) */
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    const canonRel = gate.CANON.rel
    const aliasRel = gate.ALIAS.rel
    const canonSrc = `export const ${gate.CANON.arraySymbol} = ['aa', 'bb', 'cc', 'dd'] as const
export type ${gate.CANON.typeSymbol} = (typeof ${gate.CANON.arraySymbol})[number]
`
    const aliasSrc = `import type { ${gate.CANON.typeSymbol} } from '../../settings/llm/types-v2'
export type ${gate.ALIAS.typeSymbol} = ${gate.CANON.typeSymbol}
`
    put(canonRel, canonSrc)
    put(aliasRel, aliasSrc)
    put('apps/web/legacy.ts', `export const OLD_COLS = ['aa', 'cc', 'bb', 'dd']\n`)
    // 一格"含成员字面量但不是声明"的合规消费者:让候选集合非空,免得某档把"一个候选都没有"
    // 读成通过(判死不记绿另有 T6 钉住)
    put(
      'apps/web/usage.ts',
      `import { ${gate.CANON.arraySymbol} } from './x'\nif (s === 'aa') render('aa')\n`,
    )
    gitAt(dir, ['init', '-q', '-b', 'main'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    ])
    gitAt(dir, ['add', canonRel, aliasRel, 'apps/web/legacy.ts', 'apps/web/usage.ts'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '-m',
      '存量副本',
    ])

    const head = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(head.members, ['aa', 'bb', 'cc', 'dd'], JSON.stringify(head.undetermined))
    assert.ok(
      head.violations.some((v) => v.key === 'PV2|apps/web/legacy.ts|array|OLD_COLS'),
      `HEAD 面的存量副本没被抓到:${JSON.stringify(head.violations)}`,
    )

    // 索引面新增第二份 + 存量那份不动 ⇒ 棘轮只拦新增
    put('packages/types/src/new-copy.ts', "export type NewTier = 'dd' | 'cc' | 'bb' | 'aa'\n")
    gitAt(dir, ['add', 'packages/types/src/new-copy.ts'])
    const staged = gate.runAudit({ root: dir, face: 'staged' })
    assert.ok(
      staged.violations.some((v) => v.key === 'PV2|packages/types/src/new-copy.ts|union|NewTier'),
      `--staged 没抓住新增副本:${JSON.stringify(staged.violations)}`,
    )
    assert.ok(
      staged.inherited.some((v) => v.key === 'PV2|apps/web/legacy.ts|array|OLD_COLS'),
      '--staged 把 HEAD 已红的存量也算成新增(恒红方向:逼人 --no-verify,§12e)',
    )

    // 把两副本都改成从 canonical 派生 ⇒ 必须翻绿(证明红不是恒红门)
    put('apps/web/legacy.ts', 'export const OLD_COLS = 1\n')
    put('packages/types/src/new-copy.ts', 'export type NewTier = x\n')
    gitAt(dir, ['add', 'apps/web/legacy.ts', 'packages/types/src/new-copy.ts'])
    const fixed = gate.runAudit({ root: dir, face: 'staged' })
    assert.deepEqual(
      fixed.violations.map((v) => v.key),
      [],
      JSON.stringify(fixed.violations),
    )
    assert.equal(fixed.undetermined.length, 0, fixed.undetermined.join(' | '))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T11 排除项兜底:canonical 与别名的声明必须真被解析到(排除不是失明)', () => {
  const canon = headFile(gate.CANON.rel)
  const alias = headFile(gate.ALIAS.rel)
  const members = headAudit().members
  assert.ok(typeof canon === 'string' && typeof alias === 'string' && members)
  const canonSites = gate.declarationSites(canon).filter((s) => s.name === gate.CANON.arraySymbol)
  assert.equal(canonSites.length, 1, 'canonical 的数组声明解析不到 ⇒ 成员集合来路不明')
  assert.deepEqual(canonSites[0].members, members, 'canonical 数组与解析出的成员集合不一致')
  const aliasSites = gate.declarationSites(alias).filter((s) => s.name === gate.ALIAS.typeSymbol)
  assert.equal(aliasSites.length, 1, '别名声明解析不到(PV3 会读成"搬家"而放行)')
  assert.deepEqual(aliasSites[0].members, [], '别名已带字面量档位 —— 那正是并表回退形态')
  // 预筛把 canonical 排除在候选之外,所以它自己再抄一份必须由 PV1b 兜住(档位清单现读,不手抄)
  const dup = `\nexport const HEALTH_TIERS_DUP = [${members.map((m) => `'${m}'`).join(', ')}] as const\n`
  const r = gate.decide({
    canon: canon + dup,
    alias,
    candidates: [{ path: 'apps/x/one.ts', src: 'export const A = 1\n' }],
  })
  assert.ok(
    KEYS(r).some((k) => k.startsWith(`PV1b|${gate.CANON.rel}|array|HEALTH_TIERS_DUP`)),
    `canonical 文件里再抄一份没被判红:${JSON.stringify(r.violations)}`,
  )
})

test('T12 同面同轮:预筛的清单面必须等于判定面(--worktree 档看不见未提交副本就是失明)', () => {
  const dir = mkScratch('provider-health-face')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    put(
      gate.CANON.rel,
      `export const ${gate.CANON.arraySymbol} = ['aa', 'bb', 'cc', 'dd'] as const
export type ${gate.CANON.typeSymbol} = (typeof ${gate.CANON.arraySymbol})[number]
`,
    )
    put(
      gate.ALIAS.rel,
      `import type { ${gate.CANON.typeSymbol} } from '../../settings/llm/types-v2'
export type ${gate.ALIAS.typeSymbol} = ${gate.CANON.typeSymbol}
`,
    )
    put('apps/web/usage.ts', `if (s === 'aa') render('aa')\n`)
    gitAt(dir, ['init', '-q', '-b', 'main'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    ])
    gitAt(dir, ['add', gate.CANON.rel, gate.ALIAS.rel, 'apps/web/usage.ts'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '-m',
      '并表后的干净现状',
    ])

    const committed = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(
      committed.violations.map((v) => v.key),
      [],
      JSON.stringify(committed.violations),
    )

    // 只改磁盘、不提交:HEAD 档**不该**看见(看见了就是拿工作树判提交),工作树档必须看见。
    // 副本落在**已跟踪**文件上:git grep 不带 rev 只搜已跟踪文件,新建的未跟踪文件本来就不在
    // 任何提交链面上(门体头注把这一格登记为 --worktree 档的已知边界)。
    put('apps/web/usage.ts', `export const TIERS = ['aa', 'bb', 'cc', 'dd'] as const\n`)
    const headStill = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(
      headStill.violations.map((v) => v.key),
      [],
      '未提交的副本被判进了 HEAD 面(混面取数)',
    )
    const wt = gate.runAudit({ root: dir, face: 'worktree' })
    assert.ok(
      KEYS(wt).includes('PV2|apps/web/usage.ts|array|TIERS'),
      `--worktree 没抓住未提交副本(预筛按 HEAD 枚举 = 这一档失明):${JSON.stringify(wt.violations)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ---- 下面三臂是 2026-10-10 收尾票(G-814416 / G-1058634 复验)补的 ----
// 票面 §22c 清单逐项对过:T2/T3/T4+T10 已覆盖"②真仓 HEAD 阳性对照 + 独立仓注入",T6 已覆盖
// "③枚举到 0 判死"的**判据层**那一半;缺的是**CLI 层**的三格 —— ④两旗同给 exit 2、
// ③的另一半(权威文件被摘线时 CLI 记不记绿)、①的加强(接线后必须是 blocking+skipEnv **成套**,
// 原 T5 只查到"有没有条目")。这三格都只能在进程外证,decide() 给的是 RC 之前的语义。

/** 端到端跑门体 CLI;stdio 显式给出(AGENTS §12g:缺省 stdio 在本机稳定 EBUSY)。 */
function runGateCli(args, cwd = ROOT) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', SRC_NAME), ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
}

const outOf = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`

test('T13 两旗同给必 exit 2,且那个 2 来自"互斥"这一因(不是崩在别处)', () => {
  const both = runGateCli(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两旗同给 RC=${both.status} 应为 2;输出:${outOf(both)}`)
  assert.match(
    outOf(both),
    /两个判定面互斥/,
    `exit 2 没带互斥的因由 ⇒ 是别的失败冒充的:${outOf(both)}`,
  )
  // 同族第二格:--root 换根却按 HEAD/索引读 = 双根分裂,也必须 exit 2 并说清因由
  const badRoot = runGateCli(['--root', ROOT])
  assert.equal(
    badRoot.status,
    2,
    `单旗 --root(非 worktree 档)RC=${badRoot.status} 应为 2:${outOf(badRoot)}`,
  )
  assert.match(outOf(badRoot), /--root 只在 --worktree 档有效/, outOf(badRoot))
})

test('T14 尺子失明判死不记绿:唯一真相源被摘线 ⇒ CLI 必 exit 2,且不得打印合格字样', () => {
  const dir = mkScratch('provider-health-dewired')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    // 摘线形状:别名的 import 与消费点都还在(扫描面非空),canonical 文件整块没了 ——
    // 这是"权威文件被摘线"最真实的形态:下游一切照旧,只有尺子的锚点不存在。
    put(
      gate.ALIAS.rel,
      `import type { ${gate.CANON.typeSymbol} } from '../../settings/llm/types-v2'\n` +
        `export type ${gate.ALIAS.typeSymbol} = ${gate.CANON.typeSymbol}\n`,
    )
    put('apps/web/usage.ts', `if (s === 'aa') render('aa')\n`)
    gitAt(dir, ['init', '-q', '-b', 'main'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    ])
    gitAt(dir, ['add', gate.ALIAS.rel, 'apps/web/usage.ts'])
    gitAt(dir, [
      '-c',
      'user.email=gate@local',
      '-c',
      'user.name=gate',
      'commit',
      '-q',
      '-m',
      '摘线后的面',
    ])

    const res = gate.runAudit({ root: dir, face: 'head' })
    assert.equal(res.members, null, 'canonical 缺席却解析出了成员集合 ⇒ 尺子在自造值域')
    assert.ok(
      res.undetermined.some((u) => u.startsWith('PV1')),
      `摘线没读成"未判定":${JSON.stringify(res.undetermined)}`,
    )
    assert.equal(res.violations.length, 0, '失明档不得冒红:那一格是"判不了",不是"有罪"')

    const cli = runGateCli(['--root', dir, '--worktree'])
    assert.equal(cli.status, 2, `摘线后门体 CLI 没 exit 2(RC=${cli.status}):${outOf(cli)}`)
    assert.doesNotMatch(cli.stdout ?? '', /✅|对账通过/, `失明被打印成合格证:${cli.stdout}`)
    assert.match(outOf(cli), /PV1/, `exit 2 没点名是哪一维失明:${outOf(cli)}`)

    // 配对正向臂:同一 CLI、同一档,把 canonical 补回盘上就必须绿 —— 证明上面那个 2 是判据给的,
    // 不是"这一档恒红"(§12e:恒红门的唯一结局是逼人 --no-verify)。
    put(
      gate.CANON.rel,
      `export const ${gate.CANON.arraySymbol} = ['aa', 'bb', 'cc', 'dd'] as const\n` +
        `export type ${gate.CANON.typeSymbol} = (typeof ${gate.CANON.arraySymbol})[number]\n`,
    )
    const fixed = runGateCli(['--root', dir, '--worktree'])
    assert.equal(fixed.status, 0, `补回 canonical 后仍不绿(RC=${fixed.status}):${outOf(fixed)}`)
  } finally {
    rmScratch(dir)
  }
})

/**
 * 从 runner 正文里取某道门的注册块。**只按行的结构边界收口**(条目恒为独占一行的 `  {` … `  },`),
 * 不 import runner、不执行它(镜像测试执行被审实现 = 把它的 bug 也继承成自己的绿)。
 */
function runnerEntry(runnerText, scriptName) {
  const lines = runnerText.split(/\r?\n/)
  const i = lines.findIndex((l) => /script:\s*'/.test(l) && l.includes(`'${scriptName}'`))
  if (i < 0) return null
  let s = i
  while (s > 0 && !/^\s*\{\s*$/.test(lines[s])) s--
  let e = i
  while (e < lines.length - 1 && !/^\s*\},?\s*$/.test(lines[e])) e++
  const body = lines.slice(s, e + 1).join('\n')
  return {
    mode: (/mode:\s*'([a-zA-Z]+)'/.exec(body) || [])[1] ?? null,
    skipEnv: (/skipEnv:\s*'([A-Za-z0-9_]+)'/.exec(body) || [])[1] ?? null,
  }
}

test('T15 接线方向锁加强:一旦登记必须 blocking + skipEnv 成套;夹具自证这一判据有牙', () => {
  const runner = headFile('scripts/guardian-runner.mjs')
  assert.ok(typeof runner === 'string' && runner.length > 0, 'runner 的 HEAD 面取不到')
  const entry = runnerEntry(runner, SRC_NAME)
  if (!entry) {
    // 未接线:T5 已锁"头注必须自称未接",这里只补一条 —— 缺席不许读成"接线但没档位"
    assert.match(ownFile(SRC_NAME), /尚未接提交链|刻意尚未接/, 'runner 无条目而头注也未自称未接')
  } else {
    assert.equal(
      entry.mode,
      'blocking',
      `已登记却非 blocking(mode=${entry.mode}) ⇒ 只报数的门守不住并表`,
    )
    assert.ok(
      entry.skipEnv,
      '接线了却没有 skipEnv ⇒ 应急出口不在承诺里(头注的"无 skipEnv"随之作废)',
    )
    assert.match(entry.skipEnv, /^HUSKY_SKIP_/, `skipEnv 命名族不符:${entry.skipEnv}`)
  }
  // 夹具臂:上面的 if 分支今天只走一侧,另一侧不许成为"永不执行的断言"。同一函数喂三种形态,
  // 证明它读得出 mode/skipEnv 的成套关系(缺哪一格都必须露出来)。
  const fix = (extra) =>
    runnerEntry(
      [
        '  {',
        "    id: '900',",
        `    script: '${SRC_NAME}',`,
        "    args: ['--strict'],",
        extra,
        '  },',
        '  {',
        "    id: '901',",
        "    script: 'other-gate.mjs',",
        "    mode: 'warn',",
        '  },',
      ].join('\n'),
      SRC_NAME,
    )
  assert.deepEqual(fix("    mode: 'blocking',\n    skipEnv: 'HUSKY_SKIP_PROVIDER_HEALTH_VOCAB',"), {
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PROVIDER_HEALTH_VOCAB',
  })
  assert.equal(
    fix("    mode: 'blocking',").skipEnv,
    null,
    '缺 skipEnv 必须读成 null(否则成套判据失明)',
  )
  assert.equal(
    fix("    mode: 'warn',\n    skipEnv: 'HUSKY_SKIP_X',").mode,
    'warn',
    '档位必须读得出来',
  )
  assert.equal(runnerEntry('  {\n    script: 1,\n  },\n', SRC_NAME), null, '读不到条目不得冒充条目')
})
