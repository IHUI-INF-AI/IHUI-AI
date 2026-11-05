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
