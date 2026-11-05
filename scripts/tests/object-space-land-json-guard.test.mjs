// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814414 镜像测试:scripts/object-space-land.mjs 的 .json/.jsonl **键路径集合对账**守卫。
 * (§22c —— 判据函数直接 import;端到端一律 spawn CLI 打临时仓;git 写操作只发生在
 * scripts/lib/scratch-dir.mjs 的临时夹具仓内,绝不碰真仓。)
 *
 * 票面两格,各由成对用例钉死(两臂同色 = 判据无牙 = 红):
 *  ① 消失/重现按**键路径与数组元素集合**计 —— 值变化、尾逗号翻转、缩进、键序、数组追加、
 *     .jsonl 记录重排都不算丢 ⇒ 「同一内容重放」消失/复活计数必须为 0(改前行级判据报 9/1);
 *  ② 复活必须以**同一键路径**在祖先 blob 里也取过同值为凭据,只按行文本命中一律不算
 *     (「同数字不同切片」的行文本巧合不得再当凭据)。
 * 同时钉住不削弱的那一半:Markdown 类活文档(.md)仍由原行级判据管,真删键/真搬回旧行照样判红。
 *
 * 夹具是合成的(临时仓 + 临时文件),不依赖真仓当前状态;每枚用例自建两枚提交的历史
 * (祖先 A → 基线 B=HEAD),把要落的内容写到工作树再问守卫,与真仓里那次
 * `config/zcode-absorption.json` 报「消失 9 / 复活 1」的形状同源。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../object-space-land.mjs'
import { canonicalOf } from '../lib/ledger-retirement.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'object-space-land.mjs')

// 门 231(暖色描边)涉事判据的测试通道 —— 与 `object-space-land.test.mjs` 同一理由:
// 夹具仓里的树是本器用临时索引写出来的,真门在夹具仓 `git ls-tree` 报 `not a tree object`
// ⇒ 判未判定 ⇒ 落地器拒绝落盘(2026-10-21 实测本文件 2 条端到端因此全红)。
// 模块级设一次,覆盖所有内联拼 env 的用例;需要真门行为的那几条可自行覆写。scratch 随进程退出回收。
const WARM_STUB = join(mkScratch('osl-json-warm-'), 'stub-warm-border.mjs')
writeFileSync(WARM_STUB, 'process.exit(0)\n')
process.env.LAND_WARM_BORDER_GATE = WARM_STUB
const GIT = resolveGitBin() || 'git'
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args],
    { ...runOpts, stdio: ['ignore', 'pipe', 'pipe'] },
  )

function makeRepo(t) {
  const dir = mkScratch('osljson-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  runGit(dir, ['commit', '-q', '--allow-empty', '-m', 'init'])
  return dir
}

/** 两枚提交造出"祖先 A → 基线 B(=HEAD)"的历史,再把要落的内容写到工作树。返回祖先短 sha。 */
function commitFile(dir, path, text, msg) {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
  runGit(dir, ['add', '--', path])
  runGit(dir, ['commit', '-q', '-m', msg])
  return runGit(dir, ['rev-parse', 'HEAD']).trim().slice(0, 9)
}

function runLand(dir, { paths = '', msg = 'chore: e2e land' } = {}) {
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: paths, LAND_MSG: msg }
  delete env.LAND_BASE_REF
  delete env.LAND_ALLOW_STALE
  delete env.LAND_JSON_STRUCTURE
  delete env.LAND_BLOBS
  delete env.LAND_BLOB_PROOF
  return spawnSync(process.execPath, [TOOL], {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/* ── .json 夹具:祖先 A → 基线 B(HEAD)。B 是别人的合法推进:删 legacy 键、加 G-002、自增 meta.read。── */
const A_JSON = [
  '{',
  '  "meta": {',
  '    "read": 1,',
  '    "note": "初版批注"',
  '  },',
  '  "services": {',
  '    "read": 191',
  '  },',
  '  "ui": {',
  '    "read": 218',
  '  },',
  '  "ticketIndex": {',
  '    "G-001": {',
  '      "read": 191',
  '    }',
  '  },',
  '  "legacy": {',
  '    "v": "祖先里取过这个值的旧键"',
  '  },',
  '  "items": [',
  '    "aaa-item-one",',
  '    "bbb-item-two"',
  '  ]',
  '}',
  '',
].join('\n')
const B_JSON = A_JSON.replace('    "read": 1,', '    "read": 2,')
  .replace('    "G-001": {', '    "G-001": {')
  .replace('      "read": 191\n    }\n  },', '      "read": 191\n    },\n    "G-002": {\n      "read": 7\n    }\n  },')
  .replace('  "legacy": {\n    "v": "祖先里取过这个值的旧键"\n  },\n', '')

/** 甲:同一票内容的正常回填 = 值变化 + 数组追加(尾逗号翻转) + 键序重排 + 新键(其行文字与祖先 legacy 块同形)。 */
const SAME_JSON = [
  '{',
  '  "meta": {',
  '    "read": 3,',
  '    "note": "初版批注"',
  '  },',
  '  "services": {',
  '    "read": 218',
  '  },',
  '  "ui": {',
  '    "read": 218',
  '  },',
  '  "ticketIndex": {',
  '    "G-002": {',
  '      "read": 7',
  '    },',
  '    "G-001": {',
  '      "read": 191',
  '    }',
  '  },',
  '  "items": [',
  '    "aaa-item-one",',
  '    "bbb-item-two",',
  '    "ccc-item-three"',
  '  ],',
  '  "revived": {',
  '    "v": "祖先里取过这个值的旧键"',
  '  }',
  '}',
  '',
].join('\n')

/** 乙:真把别人已入库的键删掉(G-002 整块消失),另带一处本票的值编辑 ⇒ 不等于任何祖先的混合体。 */
const DROP_KEY_JSON = B_JSON.replace('    "read": 2,', '    "read": 9,').replace(
  '    },\n    "G-002": {\n      "read": 7\n    }\n  },',
  '    }\n  },',
)

/** 丙:把基线已合法删掉的 legacy 键**连同同值**搬回来 —— 键路径复活真阳性。 */
const REVIVE_JSON = B_JSON.replace('\n  "items": [', '\n  "legacy": {\n    "v": "祖先里取过这个值的旧键"\n  },\n  "items": [')

/* ── .jsonl 夹具:台账逐行成记录。基线 B = 祖先 A ⊕ 别人追加的 G-003。── */
const A_JSONL = ['{"id":"G-001","read":1,"evidence":"ptr-a"}', '{"id":"G-002","read":2,"evidence":"ptr-b"}', ''].join('\n')
const B_JSONL = [...A_JSONL.trim().split('\n'), '{"id":"G-003","read":3,"evidence":"ptr-c"}', ''].join('\n')
/** 丁甲:记录重排 + 值自增 + 追加新记录 ⇒ 键路径并集一字不变 ⇒ 0/0。 */
const SAME_JSONL = [
  '{"id":"G-003","read":3,"evidence":"ptr-c"}',
  '{"id":"G-001","read":5,"evidence":"ptr-a"}',
  '{"id":"G-004","read":0,"evidence":"ptr-d"}',
  '{"id":"G-002","read":2,"evidence":"ptr-b"}',
  '',
].join('\n')
/** 丁乙:把所有记录里的 evidence 键整批删掉 ⇒ 并集缩水 ⇒ 必须红。 */
const DROP_KEY_JSONL = B_JSONL.replaceAll(',"evidence":"ptr-a"', '').replaceAll(',"evidence":"ptr-b"', '').replaceAll(',"evidence":"ptr-c"', '')

/* ── 非可解析 JSON(.json 后缀 + 尾逗号)与 Markdown 活文档夹具 ── */
const A_BROKEN = ['{', '  "alpha": "值甲一_long_enough",', '}', ''].join('\n')
const B_BROKEN = ['{', '  "alpha": "值甲一_long_enough",', '  "beta": "值乙一_long_enough",', '}', ''].join('\n')
const SAME_BROKEN = ['{', '  "alpha": "值甲一_long_enough",', '  "beta": "值乙一_long_enough",', '  "gamma": "值丙一_long_enough",', '}', ''].join('\n')
const A_MD = ['# 笔记', 'quitChecking: 正在检查更新', 'settings: 设置', ''].join('\n')
const B_MD = ['# 笔记', 'settings: 设置', ''].join('\n')
const SAME_MD = ['# 笔记', 'quitChecking: 正在检查更新', 'settings: 设置', 'newest_key: 真新增加的一行', ''].join('\n')

test('P0 档位分派:只有 .json/.jsonl 后缀进键路径档,.md 等活文档一律原行级判据', () => {
  assert.equal(__test__.jsonGuardKindFor('config/zcode-absorption.json'), 'json')
  assert.equal(__test__.jsonGuardKindFor('LEDGER.JSONL'), 'jsonl')
  assert.equal(__test__.jsonGuardKindFor('docs/台账.jsonl'), 'jsonl')
  assert.equal(__test__.jsonGuardKindFor('PROJECT_PLAN.md'), null)
  assert.equal(__test__.jsonGuardKindFor('AGENTS.md'), null)
  assert.equal(__test__.jsonGuardKindFor('pack.txt'), null)
  assert.equal(__test__.jsonGuardKindFor('a.jsonl.bak'), null)
  // 解析不了 ⇒ applicable:false,由调用方退回行级判据 —— 判不出不得冒充判过。
  const fb = __test__.jsonKeyPathAudit({ baseText: '{\n  "a": 1,\n}\n', newText: '{}', kind: 'json', ancestors: [] })
  assert.equal(fb.applicable, false)
  assert.match(fb.reason, /不是可解析 JSON/)
})

test('P1 纯函数面·甲(①的构造面):值变化+尾逗号+键序+数组追加+同形新键 ⇒ 消失 0 / 复活 0', () => {
  const anc = { commit: 'aaaaaaaaa', text: A_JSON }
  const r = __test__.jsonKeyPathAudit({ baseText: B_JSON, newText: SAME_JSON, kind: 'json', ancestors: [anc] })
  assert.equal(r.applicable, true)
  assert.equal(r.delta.vanished, 0, `键集合没变小就不得记丢:${JSON.stringify(r.delta)}`)
  assert.equal(r.delta.appeared, 3, '新键($.revived、$.revived.v)与数组新元素各计一条重现')
  assert.equal(r.line.status, 'judged')
  assert.equal(r.line.count, 0, `同形新键的行文字在祖先里命中,但键路径不同 ⇒ 不得算复活:${JSON.stringify(r.line)}`)
  // 对照组:同一份内容在**改前的行级判据**下确实被咬(消失 4 / 复活 1)—— 证明 0/0 是判据换对了量纲,
  // 不是夹具太弱谁看都是绿的。
  assert.equal(__test__.lineDelta(B_JSON, SAME_JSON).vanished, 4)
  assert.equal(
    __test__.resurrectAnalysis({ baseText: B_JSON, newText: SAME_JSON, ancestors: [anc] }).count,
    1,
    '行级判据会把 $.revived.v 那行按文字命中祖先算成复活 —— 这正是 G-814414 的假阳',
  )
})

test('P2 纯函数面·乙(②的构造面):真删基线里的键 ⇒ 记丢并点名键路径;搬回基线已删的同值键 ⇒ 复活', () => {
  const anc = { commit: 'aaaaaaaaa', text: A_JSON }
  const dropped = __test__.jsonKeyPathAudit({ baseText: B_JSON, newText: DROP_KEY_JSON, kind: 'json', ancestors: [anc] })
  assert.equal(dropped.delta.vanished, 2, '$.ticketIndex.G-002 与其 .read 两条键路径消失')
  assert.ok(dropped.delta.vanishedSample.some((s) => s.includes('G-002')), `样本要点名是哪个键:${JSON.stringify(dropped.delta.vanishedSample)}`)
  assert.equal(dropped.line.count, 0, '丢是丢,复活是复活:这份内容没有搬回任何基线没有的键路径')
  const revived = __test__.jsonKeyPathAudit({ baseText: B_JSON, newText: REVIVE_JSON, kind: 'json', ancestors: [anc] })
  assert.equal(revived.delta.vanished, 0, '只搬回、不丢键 ⇒ 消失侧必须为 0(拒绝凭的是复活那一颗牙)')
  assert.equal(revived.line.count, 2, '$.legacy 与 $.legacy.v 两条键路径都在祖先里取过同值 ⇒ 复活 2')
  assert.deepEqual(revived.line.commits, ['aaaaaaaaa'])
  // 同数字不同切片:新键路径取的值恰与祖先另一条键路径同值 ⇒ 只按行文本会中,键路径口径不得中。
  const coinc = __test__.jsonKeyPathAudit({
    baseText: B_JSON,
    newText: B_JSON.replace('  "items": [', '  "proxy": 224,\n  "items": ['),
    kind: 'json',
    ancestors: [{ commit: 'aaaaaaaaa', text: A_JSON.replace('    "read": 218', '    "read": 224') }],
  })
  assert.equal(coinc.line.count, 0, '祖先的 224 属于别的键路径 ⇒ 不是凭据')
})

test('P3 纯函数面·丁(.jsonl):记录重排+追加不算丢;记录内键路径整批消失才算丢', () => {
  const anc = { commit: 'aaaaaaaaa', text: A_JSONL }
  const same = __test__.jsonKeyPathAudit({ baseText: B_JSONL, newText: SAME_JSONL, kind: 'jsonl', ancestors: [anc] })
  assert.equal(same.delta.vanished, 0)
  assert.equal(same.delta.appeared, 0, 'G-004 的键在别的记录里都有 ⇒ 并集不变,不算重现')
  assert.equal(same.line.count, 0)
  assert.equal(
    __test__.lineDelta(B_JSONL, SAME_JSONL).vanished,
    1,
    '对照:行级判据按行文字对账,G-001 的 read 自增那行在落地内容里找不到同文字 ⇒ 记消失并拒落(多重集语义下重排本身不算,但值变化算)',
  )
  const drop = __test__.jsonKeyPathAudit({ baseText: B_JSONL, newText: DROP_KEY_JSONL, kind: 'jsonl', ancestors: [anc] })
  assert.equal(drop.delta.vanished, 1, '$.evidence 从全部记录里消失 ⇒ 并集缩水一条')
  assert.ok(drop.delta.vanishedSample[0].includes('evidence'))
})

test('P4 纯函数面·退休(.json 数组台账):条目进 retired[] ⇒ 覆盖;只删不退休 ⇒ 红', () => {
  const base = { entries: [{ file: 'a.tsx', rule: 'r1', n: 1 }, { file: 'b.tsx', rule: 'r2', n: 2 }] }
  const retired = {
    ...base.entries[1],
    retiredAt: '2026-11-05T04:00:00Z',
    retiredReason: '该条目已裁决收敛,按授权退休移出 entries 在册项',
    retiredBy: 'gate-299-shell-batch',
    retiredFrom: canonicalOf(base.entries[1]),
    retiredFromSha: createHash('sha256').update(canonicalOf(base.entries[1]), 'utf8').digest('hex'),
  }
  const good = { entries: [base.entries[0]], retired: [retired] }
  const g = __test__.jsonKeyPathAudit({
    baseText: JSON.stringify(base),
    newText: JSON.stringify(good),
    kind: 'json',
    ancestors: [],
    path: 'scripts/data/web-rn-copy-diffs.json',
  })
  assert.equal(g.retirement.ok, true, JSON.stringify(g.retirement.problems))
  assert.equal(g.retirement.covered, 1)
  assert.equal(g.delta.vanished, 0, '合法退休覆盖掉的数组元素不再计丢')

  const bad = __test__.jsonKeyPathAudit({
    baseText: JSON.stringify(base),
    newText: JSON.stringify({ entries: [base.entries[0]] }),
    kind: 'json',
    ancestors: [],
    path: 'scripts/data/web-rn-copy-diffs.json',
  })
  assert.equal(bad.retirement.ok, false, '只删元素不写 retired ⇒ 必须判红')
  assert.ok(bad.retirement.problems.some((p) => /未登记 retired/.test(p)))
})

test('甲(端到端成对·绿臂):同一内容重放 ⇒ 消失/复活 0、守卫放行、HEAD 前进', (t) => {
  const dir = makeRepo(t)
  const ancestor9 = commitFile(dir, 'config/zcode-absorption.json', A_JSON, 'A: 祖先形态')
  commitFile(dir, 'config/zcode-absorption.json', B_JSON, 'B: 别人合法推进(删 legacy、加 G-002、自增)')
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'config', 'zcode-absorption.json'), SAME_JSON)

  const g = __test__.detectStaleLanding({ root: dir, paths: ['config/zcode-absorption.json'] })
  assert.equal(g.ok, true, `键路径口径下这份内容必须放行:${JSON.stringify(g.offenders, null, 2)}`)
  assert.equal(g.offenders.length, 0)
  const note = g.notes.find((n) => n.kind === 'json-keypath-mode')
  assert.ok(note, '键路径档生效必须大声报名,不得静默')
  assert.match(note.why, /消失 0 \/ 重现 3 \/ 复活 0/, `三个数照登:${note.why}`)

  const r = runLand(dir, { paths: 'config/zcode-absorption.json', msg: 'chore: 同一内容重放(值+追加+重排)' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 0, `必须能落,实得 ${r.status}:\n${out}`)
  assert.doesNotMatch(out, /LAND_ALLOW_STALE/, '正常回填不得再被逼走显式放行 —— 这正是本票要拔的刺')
  assert.match(out, /提交面回读 1\/1 路径在树/)
  assert.notEqual(runGit(dir, ['rev-parse', 'HEAD']).trim(), before)
  void ancestor9
})

test('乙(端到端成对·红臂):真把别人已入库的键删掉 ⇒ 必须判红,点名键路径', (t) => {
  const dir = makeRepo(t)
  const ancestor9 = commitFile(dir, 'config/zcode-absorption.json', A_JSON, 'A: 祖先形态')
  commitFile(dir, 'config/zcode-absorption.json', B_JSON, 'B: 别人合法推进')
  writeFileSync(join(dir, 'config', 'zcode-absorption.json'), DROP_KEY_JSON)
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()

  const g = __test__.detectStaleLanding({ root: dir, paths: ['config/zcode-absorption.json'] })
  assert.equal(g.ok, false, '真丢键必须判红 —— 证明键路径档有牙')
  assert.equal(g.offenders.length, 1)
  const [o] = g.offenders
  assert.equal(o.commit, null, '混合体(丢键 ⊕ 本票值编辑)不等于任何祖先 ⇒ 整 blob 那一支看不见它')
  assert.equal(o.vanished, 2, '消失按键路径计:$.ticketIndex.G-002 与 $.ticketIndex.G-002.read')
  assert.equal(o.resurrected, 0)
  assert.equal(o.lineStatus, 'judged')
  assert.ok(o.vanishedSample.some((s) => s.includes('G-002')), `要能点名丢的是哪个键:${JSON.stringify(o.vanishedSample)}`)

  const r = runLand(dir, { paths: 'config/zcode-absorption.json', msg: 'chore: 试着删掉别人已入库的键' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /陈旧落地守卫/)
  assert.match(out, /G-002/, '报告必须点名被丢的键路径')
  assert.equal(runGit(dir, ['rev-parse', 'HEAD']).trim(), before, '拒绝路径上 HEAD 一步没动')

  // 红臂的第二格:整份写回祖先(纯回写)⇒ 整 blob 那一支也要照咬,且消失计数是键路径口径。
  writeFileSync(join(dir, 'config', 'zcode-absorption.json'), A_JSON)
  const g2 = __test__.detectStaleLanding({ root: dir, paths: ['config/zcode-absorption.json'] })
  assert.equal(g2.ok, false)
  assert.equal(g2.offenders[0].commit, ancestor9, `必须点名写回的是哪枚祖先:${JSON.stringify(g2.offenders[0])}`)
  assert.equal(g2.offenders[0].vanished, 2, '键路径口径下,B 里的 G-002 两条键路径会被这份写回抹掉')
  const r2 = runLand(dir, { paths: 'config/zcode-absorption.json', msg: 'chore: 整份写回祖先' })
  assert.equal(r2.status, 1)
})

test('丙:搬回基线已删的同值键(键路径复活真阳性)⇒ 判红并点名祖先;LAND_JSON_STRUCTURE 不得豁免它', (t) => {
  const dir = makeRepo(t)
  const ancestor9 = commitFile(dir, 'config/zcode-absorption.json', A_JSON, 'A: 祖先形态')
  commitFile(dir, 'config/zcode-absorption.json', B_JSON, 'B: 别人合法删掉 legacy')
  writeFileSync(join(dir, 'config', 'zcode-absorption.json'), REVIVE_JSON)

  const g = __test__.detectStaleLanding({ root: dir, paths: ['config/zcode-absorption.json'] })
  assert.equal(g.ok, false, '同一键路径在祖先里取过同值 ⇒ 复活成立,必须拦')
  assert.equal(g.offenders[0].resurrected, 2, '$.legacy 与 $.legacy.v 各计一条')
  assert.ok(g.offenders[0].resurrectedBy.includes(ancestor9), `必须点名凭据出自哪枚祖先:${JSON.stringify(g.offenders[0])}`)
  assert.ok(g.offenders[0].resurrectedSample.some((s) => s.includes('$.legacy')))
  assert.equal(g.offenders[0].vanished, 0, '没丢任何键 ⇒ 拒绝凭的是复活那颗牙,消失必须是 0')

  const r = runLand(dir, { paths: 'config/zcode-absorption.json', msg: 'chore: 搬回别人删掉的键' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /复活 2 行\(键路径口径/)
  assert.ok(out.includes(ancestor9))
})

/* ── G-814414 补格(2026-11-05):台账「授权退休」通道 —— 5 组反例 + 1 组合法正例 ── */
const LEDGER_PATH = 'scripts/data/miniapp-shell-copy-ledger.jsonl'
const ledgerRows = [
  { route: 'pages/a', file: 'apps/miniapp-taro/src/pages/a.tsx', loc: 100, mapStatus: 'registry', impl: 'copy', reasonClass: 'pure-copy', declaredSpecs: ['packages/app/src/features/a/AScreen.tsx'], note: '纯布局复制页', at: '2026-11-05' },
  { route: 'pages/b', file: 'apps/miniapp-taro/src/pages/b.tsx', loc: 120, mapStatus: 'registry', declaredSpecs: ['packages/app/src/features/b/BScreen.tsx'], impl: 'copy', reasonClass: 'pure-copy', note: '纯布局复制页', at: '2026-11-05' },
  { route: 'pages/c', file: 'apps/miniapp-taro/src/pages/c.tsx', loc: 140, mapStatus: 'declaration', declaredSpecs: ['packages/app/src/features/c/CScreen.tsx'], impl: 'copy', reasonClass: 'pure-copy', note: '纯布局复制页', at: '2026-11-05' },
]
const ledgerText = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

/** 合法退休行:原条目保留 + 五个标记(retiredFrom 规范形、retiredFromSha = 其 sha256)。 */
function retiredRow(row, overrides = {}) {
  const from = canonicalOf(row)
  return JSON.stringify({
    ...row,
    retiredAt: '2026-11-05T04:00:00Z',
    retiredReason: '门 299 已薄壳化(import @rn-shells 入口),按授权退休摘除在册条目',
    retiredBy: 'gate-299-shell-batch',
    retiredFrom: from,
    retiredFromSha: createHash('sha256').update(from, 'utf8').digest('hex'),
    ...overrides,
  })
}

function seedLedger(t) {
  const dir = makeRepo(t)
  commitFile(dir, LEDGER_PATH, ledgerText(ledgerRows.slice(0, 2)), 'A: 台账初版')
  commitFile(dir, LEDGER_PATH, ledgerText(ledgerRows), 'B: 别人合法追加')
  return dir
}

function landLedger(dir, text) {
  writeFileSync(join(dir, LEDGER_PATH), text)
  return runLand(dir, { paths: LEDGER_PATH, msg: 'chore: 台账授权退休测试' })
}

test('退休①:摘条目但没写 retired ⇒ 仍判红(只删行不合法)', (t) => {
  const dir = seedLedger(t)
  const r = landLedger(dir, ledgerText(ledgerRows.slice(0, 2)))
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /retirement-rejected|未登记 retired|不是退休/)
  assert.doesNotMatch(out, /retirement-accepted/)
})

test('退休②:retiredFrom / retiredFromSha 与上一版原文对不上 ⇒ 判红', (t) => {
  const dir = seedLedger(t)
  const badSha = retiredRow(ledgerRows[2], { retiredFromSha: '0'.repeat(64) })
  const r = landLedger(dir, ledgerText([ledgerRows[0], ledgerRows[1], JSON.parse(badSha)]))
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /retiredFromSha 与上一版原文不一致|retirement-rejected/)
})

test('退休③:整份文件清空且没有任何 retired ⇒ 判红', (t) => {
  const dir = seedLedger(t)
  const r = landLedger(dir, '')
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /retirement-rejected|未登记 retired/)
})

test('退休④:retiredReason 少于 10 字 ⇒ 判红', (t) => {
  const dir = seedLedger(t)
  const bad = retiredRow(ledgerRows[2], { retiredReason: '已收敛' })
  const r = landLedger(dir, ledgerText([ledgerRows[0], ledgerRows[1], JSON.parse(bad)]))
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /retiredReason 至少 10 字|retirement-rejected/)
})

test('退休⑤:正常值编辑(loc 改变、身份仍在)不走退休通道,原内容闸照旧放行', (t) => {
  const dir = seedLedger(t)
  const edited = ledgerRows.map((r, i) => (i === 2 ? { ...r, loc: 141 } : r))
  const r = landLedger(dir, ledgerText(edited))
  const out = r.stdout + r.stderr
  assert.equal(r.status, 0, `正常值编辑必须照旧能落,实得 ${r.status}:\n${out}`)
  assert.doesNotMatch(out, /retirement-rejected/)
})

test('退休正例:每条被摘条目都有可核验退休行 ⇒ 放行且退休行不计入在册条数', (t) => {
  const dir = seedLedger(t)
  writeFileSync(
    join(dir, LEDGER_PATH),
    ledgerText([ledgerRows[0], ledgerRows[1], JSON.parse(retiredRow(ledgerRows[2]))]),
  )
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = runLand(dir, { paths: LEDGER_PATH, msg: 'chore: 台账授权退休' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 0, `合法退休必须能落,实得 ${r.status}:\n${out}`)
  assert.match(out, /台账授权退休逐条核验通过/)
  assert.match(out, /有效覆盖 1 条/)
  assert.notEqual(runGit(dir, ['rev-parse', 'HEAD']).trim(), before)
})

test('丁(.jsonl):记录重排+追加 ⇒ 0/0 放行;记录内键路径整批删掉 ⇒ 判红', (t) => {
  const dir = makeRepo(t)
  commitFile(dir, 'LEDGER.jsonl', A_JSONL, 'A: 台账初版')
  commitFile(dir, 'LEDGER.jsonl', B_JSONL, 'B: 别人追加 G-003')
  writeFileSync(join(dir, 'LEDGER.jsonl'), SAME_JSONL)

  const g = __test__.detectStaleLanding({ root: dir, paths: ['LEDGER.jsonl'] })
  assert.equal(g.ok, true, `记录重排与追加不是丢:${JSON.stringify(g.offenders)}`)
  const note = g.notes.find((n) => n.kind === 'json-keypath-mode')
  assert.ok(note && /消失 0 \/ 重现 0 \/ 复活 0/.test(note.why), `0/0 要照登:${note && note.why}`)
  const r = runLand(dir, { paths: 'LEDGER.jsonl', msg: 'chore: 台账重排+追加' })
  assert.equal(r.status, 0, `必须能落,实得 ${r.status}:\n${r.stdout}\n${r.stderr}`)

  const dir2 = makeRepo(t)
  commitFile(dir2, 'LEDGER.jsonl', A_JSONL, 'A: 台账初版')
  commitFile(dir2, 'LEDGER.jsonl', B_JSONL, 'B: 别人追加 G-003')
  writeFileSync(join(dir2, 'LEDGER.jsonl'), DROP_KEY_JSONL)
  const g2 = __test__.detectStaleLanding({ root: dir2, paths: ['LEDGER.jsonl'] })
  assert.equal(g2.ok, false, '记录内键路径整批消失 ⇒ 真丢,必须红')
  assert.equal(g2.offenders[0].vanished, 1)
  assert.ok(g2.offenders[0].vanishedSample[0].includes('evidence'))
  const r2 = runLand(dir2, { paths: 'LEDGER.jsonl', msg: 'chore: 批量删掉 evidence 键' })
  assert.equal(r2.status, 1, `必须拒落,实得 ${r2.status}:\n${r2.stdout}\n${r2.stderr}`)
  assert.match(r2.stdout + r2.stderr, /陈旧落地守卫/)
})

test('戊(.json 后缀但解析不了):键路径档不适用必须大声报名,并退回原行级判据(行为同形)', (t) => {
  const dir = makeRepo(t)
  commitFile(dir, 'broken.json', A_BROKEN, 'A: 带尾逗号的历史形态')
  commitFile(dir, 'broken.json', B_BROKEN, 'B: 追加 beta')
  writeFileSync(join(dir, 'broken.json'), SAME_BROKEN)
  const g = __test__.detectStaleLanding({ root: dir, paths: ['broken.json'] })
  const fb = g.notes.find((n) => n.kind === 'json-keypath-fallback')
  assert.ok(fb, '退回行级判据必须逐条报名,不得静默')
  assert.match(fb.why, /不是可解析 JSON/)
  assert.equal(g.ok, true, '退回后仍是纯追加 ⇒ 行级判据放行(与改前同形)')
})

test('己(不削弱的那一半):Markdown 活文档仍由行级判据管 —— 搬回别人删掉的行照样判红', (t) => {
  const dir = makeRepo(t)
  const ancestor9 = commitFile(dir, 'notes.md', A_MD, 'A: 含 quitChecking 行')
  commitFile(dir, 'notes.md', B_MD, 'B: 别人合法删掉该行')
  writeFileSync(join(dir, 'notes.md'), SAME_MD)

  const g = __test__.detectStaleLanding({ root: dir, paths: ['notes.md'] })
  assert.equal(g.ok, false, '.md 不进键路径档,行级复活判据必须照咬')
  assert.equal(g.offenders[0].resurrected, 1, 'quitChecking 行在祖先里、不在基线里、被搬回 ⇒ 复活 1 行')
  assert.ok(g.offenders[0].resurrectedBy.includes(ancestor9))
  assert.ok(
    !g.notes.some((n) => n.path === 'notes.md' && (n.kind === 'json-keypath-mode' || n.kind === 'json-keypath-fallback')),
    '活文档连键路径档的报名都不得出现(根本不在射程)',
  )
  const r = runLand(dir, { paths: 'notes.md', msg: 'docs: 搬回别人删掉的行' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `行级判据必须照拦,实得 ${r.status}:\n${out}`)
  assert.match(out, /复活 1 行\(证据行门槛/, '.md 的复活报告保持行级口径的措辞')
})

/**
 * 数组元素的"复活"必须要求**曾被删过**(2026-10-23 立)。
 *
 * 立因(真事故):给 ihui-ai-overview 追加 3 块面板时,新面板复用了既有的
 * `options.reduceOptions.calcs = ["lastNotNull"]` 同形对象,守卫判"复活 2 行"并拒绝落地;
 * 而那个父面板是全新的,结构上不可能把任何已删行搬回。根因是数组分支只要求
 * "该元素在某个祖先里出现过",从不要求它在 祖先→基线 之间**减少过**。
 */
test('P3 数组元素:复用未被删的同值元素 ⇒ 不算复活;真被删过又补回 ⇒ 算', () => {
  const mk = (tags) => JSON.stringify({ tags }, null, 2) + '\n'
  // 甲(假阳锁):祖先与基线同为 ["a","b"],落地追加一个 "a" ⇒ 计数只增不减 ⇒ 复活 0
  const reuse = __test__.jsonKeyPathAudit({
    baseText: mk(['a', 'b']),
    newText: mk(['a', 'b', 'a']),
    kind: 'json',
    ancestors: [{ commit: 'aaaaaaaaa', text: mk(['a', 'b']) }],
  })
  assert.equal(reuse.applicable, true)
  assert.equal(
    reuse.line.count,
    0,
    `复用未被删过的同值元素不得算复活:${JSON.stringify(reuse.line)}`,
  )
  // 乙(真阳对照):祖先 ["a","b","c"] → 基线 ["a","b"](c 被删)→ 补回 c ⇒ 复活 1
  const restore = __test__.jsonKeyPathAudit({
    baseText: mk(['a', 'b']),
    newText: mk(['a', 'b', 'c']),
    kind: 'json',
    ancestors: [{ commit: 'bbbbbbbbb', text: mk(['a', 'b', 'c']) }],
  })
  assert.equal(restore.line.status, 'judged')
  assert.equal(
    restore.line.count,
    1,
    `真被删过再补回必须仍被咬:${JSON.stringify(restore.line)}`,
  )
  assert.deepEqual(restore.line.commits, ['bbbbbbbbb'])
})

/* ─────────────────────────────────────────────────────────────────────────────
 * ④ 窄档「改写 ≠ 摘除」(2026-11-05 立)。现场:给 `scripts/data/miniapp-mirror-verdicts.jsonl`
 * 某行补一个必填键(`route`),退休档按**整元素规范形**比身份 ⇒ 补键 = 身份消失 = "摘除一条判定"
 * ⇒ 拒落。本档只放"判定一字未动、只是补键"这一型;改 verdict / 改 evidence / 改或删已有键 /
 * 整行删除一律仍拒(§0.10:失效方向恒为"多要一次说明",绝不是"多放一次跳门")。
 * 夹具行形 = 真台账行形(键集落不进 lib 的 IDENTITY_GROUPS,身份退到 `canon:{…}`)—— 这正是
 * 现场会翻车的那一格,换成带 route+file 的行就测不到它。
 * ───────────────────────────────────────────────────────────────────────────── */
const MV_PATH = 'scripts/data/mirror-verdicts-fixture.jsonl'
const MV_ROWS = [
  { shared: 'packages/app/src/features/x/XScreen.tsx', route: 'pkg-x/x/index', verdict: 'generated', evidence: '2026-11-01 实测: 壳取数端点与 web 同源', at: '2026-11-01', source: 'cross-end-audit-2026-11-01' },
  // 第二行**没有 route** —— 就是真仓第 10 行那一型(绕过单源写出口手加,缺必填键)。
  { shared: 'packages/app/src/features/y/YScreen.tsx', verdict: 'not-applicable', evidence: '2026-11-02 复核: 两侧业务键 0 交集、端点 0 交集', at: '2026-11-02', source: 'cross-end-stale-pair-audit-2026-11-02' },
  { shared: 'packages/app/src/features/z/ZScreen.tsx', route: '-', verdict: 'aligned', evidence: '2026-11-03 复核: 三端一致', at: '2026-11-03', source: 'cross-end-audit-2026-11-03' },
]
const mvText = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
const mvAudit = (baseRows, nextRows, ancestors = []) =>
  __test__.jsonRetirementAudit({ baseText: mvText(baseRows), newText: mvText(nextRows), kind: 'jsonl', path: MV_PATH })

function seedMv(t) {
  const dir = makeRepo(t)
  commitFile(dir, MV_PATH, mvText(MV_ROWS.slice(0, 2)), 'A: 台账祖先形态(第二行仍缺 route)')
  commitFile(dir, MV_PATH, mvText(MV_ROWS), 'B: 别人合法追加第三行')
  return dir
}

test('MV①正向·纯函数:给一行补必填键(其余字段逐字不变)⇒ 判改写,不计入被摘,rewritten=1', () => {
  const next = MV_ROWS.map((r) => (r === MV_ROWS[1] ? { ...r, route: '-' } : r))
  const a = mvAudit(MV_ROWS, next)
  assert.equal(a.applicable, true)
  assert.equal(a.rewritten, 1, `补一键必须读成改写:${JSON.stringify(a.problems)}`)
  assert.equal(a.dropped, 0, '改写不得再计入"被摘"')
  assert.equal(a.retired, 0, '本档不需要任何退休登记')
  assert.equal(a.covered, 0)
  assert.equal(a.sameSubjectDrift, 0)
  assert.equal(a.ok, true, JSON.stringify(a.problems))
  assert.ok(a.rewriteSample.some((s) => s.includes('route')), `要点名补的是哪个键:${JSON.stringify(a.rewriteSample)}`)
  // 整档读数:改写那一行不进退休剥离,键路径那一维本来就 0/0(同键路径在别的行已活着)。
  const full = __test__.jsonKeyPathAudit({
    baseText: mvText(MV_ROWS),
    newText: mvText(next),
    kind: 'jsonl',
    ancestors: [{ commit: 'aaaaaaaaa', text: mvText(MV_ROWS.slice(0, 2)) }],
    path: MV_PATH,
  })
  assert.equal(full.applicable, true)
  assert.equal(full.delta.vanished, 0)
  assert.equal(full.line.count, 0, '补的键值在基线别的行已活着 ⇒ 不是复活')
})

test('MV②正向·端到端:补键落地放行,结论行必须写 rewritten=1(不得静默放过)', (t) => {
  const dir = seedMv(t)
  const next = MV_ROWS.map((r, i) => (i === 1 ? { ...r, route: '-' } : r))
  writeFileSync(join(dir, MV_PATH), mvText(next))
  const g = __test__.detectStaleLanding({ root: dir, paths: [MV_PATH] })
  assert.equal(g.ok, true, `补键必须放行:${JSON.stringify(g.offenders)}`)
  const note = g.notes.find((n) => n.kind === 'retirement-rewrite')
  assert.ok(note, '改写档点火必须单独报名 —— covered=0 时不报就是把"放了一格"写成静默')
  assert.match(note.why, /rewritten=1/)
  const r = runLand(dir, { paths: MV_PATH, msg: 'chore: 给台账行补必填键' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 0, `必须能落,实得 ${r.status}:\n${out}`)
  assert.match(out, /rewritten=1/, '结论行要如实报改写条数')
  assert.doesNotMatch(out, /LAND_ALLOW_STALE/, '放行靠的是判据,不是闸门开关')
})

test('MV③反向①:改 verdict ⇒ 仍拒,并点名"改判定须退休登记"', (t) => {
  const next = MV_ROWS.map((r, i) => (i === 1 ? { ...r, route: '-', verdict: 'aligned' } : r))
  const a = mvAudit(MV_ROWS, next)
  assert.equal(a.ok, false, '改判定不是改写')
  assert.equal(a.rewritten, 0)
  assert.equal(a.dropped, 1)
  assert.equal(a.sameSubjectDrift, 1)
  assert.ok(a.problems.some((p) => /改判定/.test(p) && /retired/.test(p)), `要点名到出口:${JSON.stringify(a.problems)}`)
  const dir = seedMv(t)
  writeFileSync(join(dir, MV_PATH), mvText(next))
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = runLand(dir, { paths: MV_PATH, msg: 'chore: 试着改掉一行的 verdict' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /台账授权退休不成立/)
  assert.match(out, /改判定.*必须逐条登记 retired/)
  assert.match(out, /rewritten=0/, '拒的时候也要把改写读数报出来(0 就是 0,不藏)')
  assert.equal(runGit(dir, ['rev-parse', 'HEAD']).trim(), before, '拒绝路径上 HEAD 一步没动')
})

test('MV④反向②:改 evidence 文本 ⇒ 仍拒', () => {
  const next = MV_ROWS.map((r, i) => (i === 1 ? { ...r, route: '-', evidence: r.evidence + '(结论已改)' } : r))
  const a = mvAudit(MV_ROWS, next)
  assert.equal(a.ok, false)
  assert.equal(a.rewritten, 0)
  assert.equal(a.dropped, 1)
  assert.equal(a.sameSubjectDrift, 1)
  // 只改 evidence 的第一个字符也不放行(逐字相同 = 一个字都不许动)。
  const tiny = MV_ROWS.map((r, i) => (i === 1 ? { ...r, evidence: r.evidence.replace('复核', '复 核') } : r))
  assert.equal(mvAudit(MV_ROWS, tiny).ok, false, 'evidence 挪一个空格也算改依据 ⇒ 本档不放行')
})

test('MV⑤反向③:整行删除(同 shared 无新行)⇒ 仍拒,且不得被读成改写', (t) => {
  const a = mvAudit(MV_ROWS, [MV_ROWS[0], MV_ROWS[2]])
  assert.equal(a.ok, false)
  assert.equal(a.rewritten, 0)
  assert.equal(a.dropped, 1)
  assert.equal(a.sameSubjectDrift, 0, '主体整个没了 ⇒ 这是"丢",不是"改判定"两型,措辞不得混')
  assert.ok(a.problems.some((p) => /未登记 retired/.test(p)))
  assert.ok(!a.problems.some((p) => /改判定/.test(p)))

  const dir = seedMv(t)
  writeFileSync(join(dir, MV_PATH), mvText([MV_ROWS[0], MV_ROWS[2]]))
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = runLand(dir, { paths: MV_PATH, msg: 'chore: 试着删掉一条判定' })
  const out = r.stdout + r.stderr
  assert.equal(r.status, 1, `必须拒落,实得 ${r.status}:\n${out}`)
  assert.match(out, /未登记 retired/)
  assert.doesNotMatch(out, /改判定/, '整行删除不得套上"改判定"那条措辞')
  assert.match(out, /被摘 1 条 .* rewritten=0|rewritten=0/)
  assert.equal(runGit(dir, ['rev-parse', 'HEAD']).trim(), before, '拒绝路径上 HEAD 一步没动')
})

test('MV⑥形状锁:逐字段钉死"哪些变了仍放行 / 哪些变了必拒"(锚点表只认 shared+verdict+evidence)', () => {
  // 锚点表是本档的全部射程;多一个键进锚点 = 下一席可以拿来洗红。这里钉的是**声明面**,不是复刻判据。
  assert.deepEqual(__test__.REWRITE_ANCHOR_KEYS, ['shared', 'verdict', 'evidence'])
  const withRoute = { ...MV_ROWS[1], route: '-' }
  const variants = [
    ['补一个新键(现场型)⇒ 放行', { ...MV_ROWS[1], someNewKey: 'v' }, true],
    ['补必填 route ⇒ 放行', withRoute, true],
    ['改 verdict ⇒ 拒', { ...MV_ROWS[1], verdict: 'aligned' }, false],
    ['改 evidence ⇒ 拒', { ...MV_ROWS[1], evidence: '换成另一条依据_long_enough' }, false],
    ['改 shared(换主体)⇒ 拒', { ...MV_ROWS[1], shared: 'packages/app/src/features/other/Other.tsx' }, false],
    ['改已有 route 的取值 ⇒ 拒(已有键不许动)', { ...MV_ROWS[0], route: 'pkg-x/x2/index' }, false],
    ['改 at ⇒ 拒(本档只放"补键";已有键一个不许动,失效方向=多要一次说明)', { ...MV_ROWS[1], at: '2026-12-01' }, false],
    ['改 source ⇒ 拒(同上:出处换了就得重登记,不借改写档洗)', { ...MV_ROWS[1], source: 'someone-else-2026-11-06' }, false],
    ['删已有键 at ⇒ 拒', { shared: MV_ROWS[1].shared, verdict: MV_ROWS[1].verdict, evidence: MV_ROWS[1].evidence, source: MV_ROWS[1].source }, false],
    ['锚点缺失(整行没有 verdict)⇒ 拒', { shared: MV_ROWS[1].shared, evidence: MV_ROWS[1].evidence, route: '-' }, false],
    ['锚点形态坏(verdict 非字符串)⇒ 拒,不折成放行(§0.3)', { ...MV_ROWS[1], verdict: null }, false],
    ['两侧都无 shared ⇒ 根本不进本档(照旧拒)', null, false],
  ]
  for (const [name, nextRow, expectPass] of variants) {
    if (nextRow === null) {
      const noShared = [
        { key: 'k1', verdict: 'v', evidence: 'e1', at: '2026-11-01' },
        { key: 'k2', verdict: 'v', evidence: 'e2', at: '2026-11-01' },
      ]
      const a = mvAudit(noShared, noShared.map((r) => ({ ...r, extra: 'x' })))
      assert.equal(a.rewritten, 0, `${name}:无 shared 就不配进改写档`)
      assert.equal(a.ok, true, '内容一字未动(只带 extra 的等价改写)按身份仍在处理,不进本档')
      const gone = mvAudit(noShared, [noShared[0]])
      assert.equal(gone.ok, false, `${name}:无 shared 的行被摘 ⇒ 照旧拒`)
      assert.equal(gone.rewritten, 0)
      continue
    }
    const idx = MV_ROWS.findIndex((r) => r.shared === nextRow.shared)
    const next = MV_ROWS.map((r, i) => (i === (idx < 0 ? 1 : idx) ? nextRow : r))
    const a = mvAudit(MV_ROWS, next)
    assert.equal(__test__.isLedgerRewrite(MV_ROWS[idx < 0 ? 1 : idx], nextRow), expectPass, `${name}:谓词读数`)
    assert.equal(a.rewritten, expectPass ? 1 : 0, `${name}:rewritten 读数`)
    assert.equal(a.ok, expectPass, `${name}:整档结论 ${JSON.stringify(a.problems)}`)
  }
})

test('MV⑦一鱼两吃锁:同锚点的两行只补出一行 ⇒ 另一条照旧算被摘', () => {
  const twin = { ...MV_ROWS[1], at: '2026-11-02', source: 'another-audit-2026-11-02' }
  const base = [MV_ROWS[0], MV_ROWS[1], twin, MV_ROWS[2]]
  const next = [MV_ROWS[0], { ...MV_ROWS[1], route: '-' }, MV_ROWS[2]]
  const a = mvAudit(base, next)
  assert.equal(a.rewritten, 1, '一条改写只能吃掉一个落地行')
  assert.equal(a.dropped, 1)
  assert.equal(a.ok, false, '另一条同主体行整个消失 ⇒ 必须仍拒(不能靠改写档蒙过去)')
})

test('MV⑧射程锁:非退休通道(台账族以外的 .jsonl)根本不进本档', () => {
  const a = __test__.jsonRetirementAudit({
    baseText: mvText(MV_ROWS),
    newText: mvText(MV_ROWS.map((r, i) => (i === 1 ? { ...r, route: '-' } : r))),
    kind: 'jsonl',
    path: 'config/some-other.jsonl',
  })
  assert.equal(a.applicable, false)
  assert.equal(a.rewritten, 0, '不在射程的路径不得报出改写读数')
  // 取不到基线面(解析不了)⇒ 保持既有"拒"的语义,绝不折成放行。
  const broken = __test__.jsonRetirementAudit({
    baseText: '{"shared":"a","verdict":"v","evidence":"e"}\n{坏掉的行\n',
    newText: mvText(MV_ROWS),
    kind: 'jsonl',
    path: MV_PATH,
  })
  assert.equal(broken.ok, false)
  assert.equal(broken.rewritten, 0)
  assert.match(broken.problems.join(' '), /解析失败/)
})
