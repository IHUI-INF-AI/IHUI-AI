// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-projection-replay-equality.mjs`(票 G-998175 的只读取证尺子)。
 *
 * 判据一律 **import 门体导出的 `__test__`**,测试里不得再抄一份(§22c:镜像只复读实现就是复读机)。
 * 本文件因此同时是这把尺子**能不能被 import** 的阳性证明 —— 门体若有裸顶层 `main()`,
 * 这句 import 就会把整个 `--plan` 打印拖进测试进程(T0 专门钉这一格,并拿独立子进程复验)。
 *
 * 锁清单
 *  T0 import 门体不得触发 CLI(§22d 的立身之本);
 *  T1 形状锁:测试不得声明第二份判据;`__test__` 必须真的导出各轴判据;
 *  T2 A 轴成对:键级承载必命中 / 同一形态只写在注释里必不命中 / 体配不平必落未判定;
 *  T3 B 轴成对:「键序不同而内容同」的两型(等值判据 + 条件展开)同文件必命中;
 *     走 contentEqual 的站点必落放过、纯序列化输出不得虚报未判定;
 *  T4 C 轴:读不到 schema ⇒ **未判定**而不是放过(票面明写"读不出的站点落未判定");
 *     并证明"没读出的那一格"与"这一格里没有可派生的东西"在两档上不同形;
 *  T5 预筛必须是判据真实形态的**超集**,且有牙证明(抽掉一条 ⇒ 必落 gap);
 *  T6 本尺**刻意不在提交链**:门体源码里不得出现"已接 pre-commit / guardian 第 N 项 / 应急跳过变量",
 *     而 runner 的 **HEAD 面**必须查不到它(接线由架构裁决,不由测试默认放行);
 *  T7 三面口径(CLI 真退出码):两面旗同给 ⇒ 2;缺省档判 HEAD ⇒ 0;`--strict` 有未判定 ⇒ 2;
 *  T8 临时 git 仓端到端:**索引里有、HEAD 里没有**的承载文件 ⇒ HEAD 档看不见、`--staged` 档必须点名
 *     (证明"清单与内容同面"不是措辞);只写在磁盘上不 add ⇒ 两面都看不见(证明它不判磁盘);
 *  T9 空枚举判死:仓里没有任何命中 ⇒ `dead` 非空,不得被读成「已确认没有」;
 *  T10 verdictOf 三条出口各自可达,且"有未判定"永远压过"不需要";
 *  T11 Python 面 ⇒ 未判定,**不得**被记成放过(没判 ≠ 不适用)。
 *
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g:本机宿主下不给 stdio
 * 就报 spawnSync EBUSY,而那是环境问题不是业务结论)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-projection-replay-equality.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-projection-replay-equality.mjs')
const ANSI_RE = /\x1b\[[0-9;]*m/g

function clean(s) {
  return String(s ?? '').replace(ANSI_RE, '')
}

function runGate(args, cwd = REPO) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
    maxBuffer: 1 << 27,
  })
  return { rc: r.status, out: clean(r.stdout), err: clean(r.stderr), all: clean(r.stdout) + clean(r.stderr) }
}

function gitIn(root, args) {
  const r = spawnSync(gitBinary(), ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 1 << 26,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${clean(r.stderr)}`)
  return String(r.stdout ?? '')
}

function createRepo() {
  const root = mkScratch('ihui-projection-replay-')
  gitIn(root, ['init', '--quiet', '--initial-branch=main'])
  gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate-test'])
  return root
}

function putFile(root, rel, text, { add = false, commit = false } = {}) {
  const abs = join(root, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  if (add || commit) gitIn(root, ['add', '--', rel])
  if (commit) gitIn(root, ['commit', '--quiet', '-m', `test: ${rel}`])
}

const KEY_MERGE = `export function mergeWorkflowRunDelta(base, patch) {\n  const out = {}\n  for (const [k, v] of Object.entries(patch)) {\n    out[k] = v\n  }\n  return out\n}\n`
const KEY_MERGE_COMMENTED = KEY_MERGE.split('\n')
  .map((l) => (l.trim() ? `// ${l}` : l))
  .join('\n')
const DRIFT = `export function same(a, b) {\n  const p = { ...(a !== undefined ? { k: a } : {}) }\n  return JSON.stringify(p) === JSON.stringify(b)\n}\n`
const PURE_DUMP = `export function dump(o) {\n  return JSON.stringify(o)\n}\n`
const ZOD_OK = `const RunSchema = z.object({ id: z.string(), title: z.string().optional() })\n`
const ZOD_SPREAD = `const S = z.object({ ...base.shape, extra: z.string() })\n`
const PY_APPLY = `def apply_delta(base, patch):\n    for k, v in patch.items():\n        base[k] = v\n`

const F = (src) => gate.faces(src)

test('T0 import 门体不得触发 CLI 主流程(§22d 的立身之本)', () => {
  // "没炸"不能靠本文件自己没炸来断言:再拿一个独立子进程 import 门体并打哨兵。
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = clean(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${clean(r.stderr)}`)
  assert.doesNotMatch(out, /逐字节重放等式|A 承载轴/, 'import 门体就打印了尺子的读数 ⇒ 顶层裸 main() 回来了,§22c 的通道又断了')
})

test('T1 形状锁:测试不得重写判据,__test__ 必须真导出各轴判据', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /import \{ __test__ as gate \} from '\.\.\/check-projection-replay-equality\.mjs'/, '§22c 锚点')
  for (const name of ['judgeCarrier', 'judgeKeyOrder', 'judgeSchema', 'judgeClamp', 'deriveSchemaShape', 'prefilterGaps', 'verdictOf', 'claimsWired', 'analyze', 'cScopePredicate']) {
    assert.ok(
      !new RegExp(`^(?:export\\s+)?(?:async\\s+)?function ${name}\\s*\\(`, 'm').test(src),
      `测试里出现了第二份 ${name} ⇒ 镜像从防线变成漂移的掩体(§22c 红线)`,
    )
    assert.equal(typeof gate[name], 'function', `__test__ 缺导出 ${name} ⇒ 测试只能另抄一份判据`)
  }
})

test('T2 A 轴成对:键级承载命中 / 只写在注释里不命中 / 体配不平落未判定', () => {
  const f = F(KEY_MERGE)
  const hit = gate.judgeCarrier('a.ts', f.codeAll, f.codeStrict)
  assert.ok(hit.sites.some((s) => s.form === 'key-level'), JSON.stringify(hit))
  const c = F(KEY_MERGE_COMMENTED)
  const commented = gate.judgeCarrier('a.ts', c.codeAll, c.codeStrict)
  assert.equal(commented.sites.length, 0, '注释里逐字写出的该形态不得被算成站点(门不得给自己发合格证)')
  const u = F('function mergeDeltaFrame(base, patch) {\n  const o = { ...\n}\n')
  const unb = gate.judgeCarrier('a.ts', u.codeAll, u.codeStrict)
  assert.equal(unb.sites.length, 0)
  assert.equal(unb.undetermined.length, 1, `体配不平必须落未判定:${JSON.stringify(unb)}`)
})

test('T3 B 轴成对:「键序不同而内容同」两型同文件必命中;纯序列化不得虚报', () => {
  const f = F(DRIFT)
  const d = gate.judgeKeyOrder('a.ts', f.codeStrict)
  assert.ok(d.sites.some((s) => s.form === 'stringify-equality'), JSON.stringify(d))
  assert.ok(d.sites.some((s) => s.form === 'order-drift-risk'), '等值判据 + 条件展开同文件 ⇒ 上游注释点明的失效型必须被点名')
  const p = F(PURE_DUMP)
  const dump = gate.judgeKeyOrder('a.ts', p.codeStrict)
  assert.equal(dump.sites.length, 0)
  assert.equal(dump.undetermined.length, 0, '纯序列化输出不是"没读到的等值判据",虚报会让下一个人去修没坏的东西')
  const i = F(`export function k(a) {\n  const m = new Map()\n  m.set(JSON.stringify(a), 1)\n  return m\n}\n`)
  assert.ok(gate.judgeKeyOrder('a.ts', i.codeStrict).sites.some((s) => s.form === 'stringify-as-identity'))
})

test('T4 C 轴:读不到 schema 落未判定,绝不折成放过(票面明写)', () => {
  const ok = F(ZOD_OK)
  const g = gate.judgeSchema('a.ts', ok.codeAll, ok.codeStrict)
  const one = g.sites.find((s) => s.form === 'shape-derivable')
  assert.ok(one, JSON.stringify(g))
  assert.match(one.text, /2 键,1 可缺省/, '键序与可缺省集必须真的被读出来')
  const sp = F(ZOD_SPREAD)
  const bad = gate.judgeSchema('a.ts', sp.codeAll, sp.codeStrict)
  assert.equal(bad.sites.length, 0, '形状经 spread 的文件不得被算成"已派生"')
  assert.equal(bad.notes.filter((n) => n.state === 'pass').length, 0, '读不出 ≠ 不适用:两者必须落在不同档')
  assert.equal(bad.undetermined.length, 1, JSON.stringify(bad))
  // 反证:同一份 spread 文本如果**没有**相关性,连 C 射程都不该进(射程判据与读得出与否是两件事)
  assert.equal(gate.cScopePredicate(sp.codeStrict), false)
  assert.equal(gate.cScopePredicate('const ks = Object.keys(RunSchema.shape)\n'), true)
})

test('T5 预筛必须是判据真实形态的超集,且这条判据本身有牙', () => {
  assert.deepEqual(gate.prefilterGaps(), [], `预筛缺:${gate.prefilterGaps().join(' | ')}`)
  // 逐条抽掉**唯一承担某形态**的预筛条目 ⇒ 该形态必须落 gap。刻意不抽冗余条目
  // (`data:` / `write[(]` / `merge` / `absorb` / `MAX_` … 那些是被别的条目一起盖住的,
  // 预筛作为超集允许冗余 —— 抽它们不落 gap 是正确行为,拿它们当"有牙证明"就是假红)。
  const UNIQUELY_LOADED = [
    'JSON\\.stringify',
    'contentEqual',
    'deepEqual',
    'stableStringify',
    'canonical',
    'shape',
    'safeParse',
    'z\\.object',
    'optional',
    'nullish',
    '[Dd]elta',
    '[Ss]napshot',
    'apply',
    'replay',
    '\\.\\.\\.(prev|acc|items|rows|list|frames|base|snapshot)',
    'clamp',
    'truncat',
    'slice[(]0',
    'broadcastSSEEvent',
    'StreamingResponse',
    'replaceAll',
  ]
  for (const drop of UNIQUELY_LOADED) {
    const cut = gate.PREFILTER.filter((p) => p === drop)
    assert.equal(cut.length, 1, `夹具前提:预筛里应恰有一条 ${drop}`)
    const gaps = gate.prefilterGaps(gate.SAMPLES_MUST_PREFILTER, gate.PREFILTER.filter((p) => p !== drop))
    assert.ok(gaps.length >= 1, `抽掉预筛条目 ${drop} 后必须有形态落 gap,否则"超集"这条断言无牙`)
  }
  // 反向对照:预筛里存在但**不唯一**的条目被抽掉 ⇒ 不得落 gap(超集允许冗余,判据不得因此误红)
  assert.deepEqual(gate.prefilterGaps(gate.SAMPLES_MUST_PREFILTER, gate.PREFILTER.filter((p) => p !== 'data:')), [])
  assert.match(gate.prefilterGaps(['x'], ['['])[0] ?? '', /编译不过/, '预筛正则坏了必须点名,不得静默返回空')
})

test('T6 本尺刻意不在提交链:门体头注不得自称已接线,runner 的 HEAD 面也查不到它', () => {
  const src = readFileSync(GATE, 'utf8')
  // 只看**头注**:守门 89 的 R1 判的就是"脚本头部注释里的肯定式声称"。整份文件里那些命中
  // 全部来自自检的**反向夹具**(它必须写出谎称长什么样才能证明判据有牙)—— 拿整份文件判,
  // 等于要求判据的说明文字避开自己解释的字符,那是"解释自己的散文被判成违规"那一型。
  const header = src.slice(0, src.indexOf('*/', src.indexOf('/**')))
  assert.match(header, /不是守门/, '头注必须自己讲清这把尺子的定性(否则后人会当门接)')
  assert.deepEqual(gate.claimsWired(header), [], '头注谎称已接线 ⇒ 守门 89 的 R2 会对每一次提交判红(§12e)')
  assert.doesNotMatch(header, /HUSKY_SKIP_[A-Z0-9_]+/, '不在钩子链上的尺子不得声明应急跳过变量')
  const raw = catBatch(REPO, ['HEAD:scripts/guardian-runner.mjs']).get('HEAD:scripts/guardian-runner.mjs')
  assert.equal(typeof raw, 'string', 'runner 的 HEAD blob 取不到 ⇒ 无法判定(不回落磁盘那一面)')
  assert.ok(!raw.includes('check-projection-replay-equality.mjs'), '票面写"落点未定,需先取证"⇒ 接线属架构裁决;真要接,先改票面与这条锁,不得悄悄接线')
})

test('T7 三面口径(CLI 真退出码):两旗同给=2,缺省 HEAD=0,--strict 有未判定=2', () => {
  const both = runGate(['--staged', '--worktree'])
  assert.equal(both.rc, 2, both.all)
  assert.match(both.err, /不得同用/)
  const head = runGate(['--plan'])
  assert.equal(head.rc, 0, head.all)
  assert.match(head.out, /判定面:HEAD blob/)
  const strict = runGate(['--strict'])
  assert.equal(strict.rc, 2, '真仓 HEAD 面有未判定(Python 整族)⇒ --strict 必须拒绝出具合格证')
  assert.match(strict.err, /拒绝出具合格证/)
  const bad = runGate(['--nonsense-flag'])
  assert.equal(bad.rc, 2)
  assert.match(bad.err, /不认识开关/)
})

test('T8 临时仓端到端:清单与内容同面(索引有而 HEAD 没有 ⇒ 只有 --staged 档看得见)', async () => {
  const root = createRepo()
  try {
    putFile(root, 'README.md', '# fixture\n', { commit: true })
    putFile(root, 'apps/x/runner.ts', KEY_MERGE, { add: true }) // 只 add 不 commit ⇒ 在索引、不在 HEAD
    const see = (face) => gate.analyze({ face, root }).axes.A.sites.some((s) => String(s.at).startsWith('apps/x/runner.ts'))
    assert.equal(see('head'), false, `HEAD 档不该看见未入库的那份`)
    assert.equal(see('staged'), true, '索引档必须点名它(清单来自索引、内容也必须来自索引)')
    gitIn(root, ['commit', '--quiet', '-m', 'add carrier'])
    assert.equal(see('head'), true, '入库之后 HEAD 档必须看得见 —— 否则"HEAD 档"是句空话')
    // 只在磁盘上改回去(不 add)⇒ 缺省(HEAD)档仍按入库那份判,worktree 档才看见磁盘。
    // 这一对就是"缺省不判滞后的共享工作树"那条口径的端到端证明。
    putFile(root, 'apps/x/runner.ts', 'export const a = 1\n')
    assert.equal(see('head'), true, '磁盘副本被改回去不得让 HEAD 档换结论')
    assert.equal(see('staged'), true, '索引仍是那份 ⇒ staged 档结论不随磁盘漂')
    assert.equal(see('worktree'), false, 'worktree 档(仅人工逃生舱)必须看得见磁盘那一版')
    // 未跟踪文件不在**任何**一档射程内(git grep 只查已跟踪面)—— 如实登记,不假装全覆盖
    putFile(root, 'apps/y/untracked.ts', KEY_MERGE)
    assert.equal(see('worktree'), false, '未跟踪文件连 worktree 档也不覆盖 ⇒ 射程边界,写进报告而不是当"没有"')
  } finally {
    rmScratch(root)
  }
})

test('T9 空枚举判死:没有任何命中时 dead 非空,不得读成「已确认没有」', () => {
  const root = createRepo()
  try {
    putFile(root, 'apps/z/quiet.ts', 'export const a = 1\n', { commit: true })
    const r = gate.analyze({ face: 'head', root })
    assert.equal(r.listed, 0, JSON.stringify(r.counts))
    assert.ok(r.dead && /dead:/.test(r.dead), '空扫必须判死')
    const v = gate.verdictOf(r)
    assert.equal(v.verdict, 'undetermined')
  } finally {
    rmScratch(root)
  }
})

test('T10 verdictOf 三条出口各自可达;"有未判定"永远压过「不需要」', () => {
  const base = (over) => ({
    dead: null,
    axes: { A: { sites: [], notes: [], undetermined: [] }, B: { sites: [] }, C: { sites: [] }, D: { sites: [] } },
    counts: { undetermined: 0, py: 0, A: { undetermined: 0 } },
    ...over,
  })
  const none = gate.verdictOf(
    base({
      axes: {
        A: { sites: [], notes: [{ reason: '整表赋值 / replaceAll' }], undetermined: [] },
        B: { sites: [] },
        C: { sites: [] },
        D: { sites: [] },
      },
    }),
  )
  assert.equal(none.verdict, 'no-carrier')
  const pend = gate.verdictOf(
    base({
      axes: {
        A: { sites: [], notes: [{ reason: '整表' }], undetermined: [{ where: 'a.py', reason: 'Python 面' }] },
        B: { sites: [] },
        C: { sites: [] },
        D: { sites: [] },
      },
      counts: { undetermined: 1, py: 1, A: { undetermined: 1 } },
    }),
  )
  assert.equal(pend.verdict, 'undetermined', '未判定必须压过"不需要" —— 否则"没量到"就被写成"没有"')
  const withEq = gate.verdictOf(
    base({
      axes: {
        A: { sites: [{ form: 'key-level', at: 'a.ts:1' }, { form: 'replay-equality', at: 'a.ts:2' }], notes: [], undetermined: [] },
        B: { sites: [] },
        C: { sites: [] },
        D: { sites: [] },
      },
    }),
  )
  assert.equal(withEq.verdict, 'carrier-exists-with-equality')
  assert.equal(withEq.replay, 1)
})

test('T11 Python 面一律未判定,不得被记成放过', () => {
  const r = createRepo()
  try {
    putFile(r, 'apps/svc/x.py', PY_APPLY, { commit: true })
    const a = gate.analyze({ face: 'head', root: r })
    const pyHits = a.axes.A.sites.filter((s) => s.at.endsWith('.py') || String(s.at).startsWith('apps/svc/x.py'))
    assert.equal(pyHits.length, 0, 'Python 面不得产出命中(遮罩层不认它的注释语法)')
    assert.equal(a.axes.A.notes.filter((s) => String(s.at).startsWith('apps/svc/x.py')).length, 0, '也不得产出"放过"')
    assert.ok(
      a.axes.A.undetermined.some((s) => String(s.where).startsWith('apps/svc/x.py') && /Python/.test(s.reason)),
      JSON.stringify(a.axes.A.undetermined),
    )
    assert.equal(a.counts.py, 1)
  } finally {
    rmScratch(r)
  }
})

test('T12 自检的 cond 必须"比 true"而不是"取真值"(函数型 cond 不得被记成通过)', () => {
  // 与守门 150 同一课:`!!(() => {{...}})` 恒真 ⇒ "N/N 通过"可以是零条判过。
  // 本门 harness 必须写 `ok: cond === true`,函数型 cond 会被当场记成失败。
  // 这一格只能用源码形状锁住(行为面已被 selfTest 全绿 + 门体判据的成对用例覆盖)。
  const src = readFileSync(GATE, 'utf8')
  const body = src.slice(src.indexOf('export function selfTest'))
  assert.match(body, /ok:\s*cond === true/, 't() 的记账必须是 cond === true;写成 !!cond / Boolean(cond) 就等于让函数型 cond 恒绿')
  const r = gate.selfTest()
  assert.equal(r.fail, 0, `门体自检未全绿:${r.cases.filter((c) => !c.ok).map((c) => c.name).join(' | ')}`)
  assert.ok(r.cases.length >= 30, `自检例数掉了(${r.cases.length}),这条尺子的构造面证据太薄`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
