// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‍‌‌‍‍‍‌‌‌‌‌‍‍‍‌‍‍‌‌‌‌‍‍‍‌‌‍‍‍‌‍‍‌‌‍‍‌‌‌‌‌‍‍‍‍‍‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‌‍‍‍‍‌‍‍‌‌‌‌‌‌‌‌‍‍️‍‍‌‌‌‌‍‌‍‍‍‌‌‍‍‍‌‌‍‍‍‌‌‍‌‌‌‍‌‌⁠

// §22c 镜像测试:`scripts/check-load-state-projection-parity.mjs`(G-759 补票)
//
// 为什么必须存在(而不是只靠门自己的 --self-test):本门判据的一半在**取材**(读 HEAD
// blob 判五族投影的键集与来源),而 --self-test 的构造面夹具只证明"函数会给答案"。
// 本文件补的正是"真仓上有人问它"那一半,以及四条**反向对照**—— 反向对照是本门的全部
// 价值:一个只有正例的判据与`return true` 在账面上不可区分。
//
// 一条硬约束:本文件**只 import 生产实现**(`__test__`),一条判据都不重写。
// 在测试里再抄一份"什么叫缺 loadState",源门漂移时测试照样绿 —— 那正是 §22c 立项要杀的形态。
//
// 跑法:node --test scripts/tests/check-load-state-projection-parity.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-load-state-projection-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC_NAME = 'check-load-state-projection-parity.mjs'
const GATE_FILE = join(ROOT, 'scripts', SRC_NAME)
const gateSrc = readFileSync(GATE_FILE, 'utf8')
const selfSrc = readFileSync(join(ROOT, 'scripts', 'tests', `${SRC_NAME.replace('.mjs', '')}.test.mjs`), 'utf8')

const SINGLETON = gate.FAMILIES.find((f) => f.kind === 'singleton')
const PER_KEY = gate.FAMILIES.find((f) => f.kind === 'per-key')

function runGate(args) {
  const r = spawnSync(process.execPath, [GATE_FILE, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    // 本门不消费子进程 stdin ⇒ 必须显式 ignore(Windows 病窗:不写 stdio 与
    // stdio:'pipe' 同病 —— 后者仍是三通道全管道,stdin 照样建管道、照样 EBUSY)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

// ── 形态锁:本门不得留第二份判据 ──────────────────────────────────────────

test('T1 镜像只 import 生产实现,不得有第二份判据/遮噪', () => {
  assert.match(selfSrc, /import \{ __test__ as gate \} from '\.\.\/check-load-state-projection-parity\.mjs'/)
  // 判据函数名只属于源门;在测试里出现同名定义 ⇒ 两份真相(§22c 的原始动因)
  for (const fn of [
    'judgeTierLiterals',
    'judgeTierScatter',
    'judgeModule',
    'judgeFamilies',
    'dictTopKeys',
    'dictValueExpr',
    'resolveSharedExit',
    'maskPyNarrative',
  ]) {
    assert.ok(!new RegExp(`function ${fn}\\s*\\(`).test(selfSrc), `测试里定义了 ${fn} ⇒ 复制了判据实现`)
  }
  // 门体只引一份遮罩底层,不得自带 code-mask 的第二份实现
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'|from '\.\/lib\/face-reader\.mjs'/)
  assert.ok(!/function\s+scanSpans\s*\(/.test(gateSrc), '门体自带第二台分词器 ⇒ 两处算同一件事必漂移')
})

test('T2 门体走统一取材层(HEAD blob),不得按磁盘判被审内容(守门 118 同口径)', () => {
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(gateSrc, /selectFace/, '面选择必须走共用出口')
  assert.match(gateSrc, /catBatch/, 'HEAD/索引面取材必须走 catBatch')
  // 默认面必须是 head(不得默认读工作树 —— 并发会话在飞时那不是判定面)
  assert.match(gateSrc, /def: 'head'/)
})

test('T3 头注必须带「warn 起步、不是 blocking」的理由(守门 156 教训)', () => {
  const head = gateSrc.split('\n').slice(0, 80).join('\n')
  assert.match(head, /定级:\*\*warn 起步,不是 blocking\*\*/, '头注必须写明定级与理由')
  assert.match(head, /--no-verify/, '理由必须落在「逼人跳门」这条具体后果上')
  assert.match(head, /12e|§12e/, '理由须引 AGENTS §12e/§12f 的同型先例')
  // 不得出现"接成 blocking"的自我授权(定级是人裁的,不是门自行决定的)
  assert.ok(!/mode: 'blocking'/.test(gateSrc), '门体不得自我升级为 blocking')
})

// ── 正例:真实五族形态 ⇒ 绿 ──────────────────────────────────────────────

test('T4 真仓 HEAD 面:五族基线绿(违规 0、未判定 0)', () => {
  const r = runGate([])
  assert.equal(r.rc, 0, `默认档应绿(违规只报数)。实得 rc=${r.rc}:\n${r.out}`)
  assert.match(r.out, /✅ loadState 投影对账通过\(面=head\)/)
  assert.ok(!/检出 \d+ 处/.test(r.out), `不该报违规:\n${r.out}`)
})

test('T5 真仓 --strict 也是 rc=0(存量无红,不是靠放宽判据取绿)', () => {
  const r = runGate(['--strict'])
  assert.equal(r.rc, 0, `--strict 应 rc=0;实得 rc=${r.rc}:\n${r.out}`)
  assert.ok(!/检出 \d+ 处/.test(r.out), `--strict 不该有存量违规:\n${r.out}`)
})

test('T6 真仓 LV1:四档字面量只住在 _load_lifecycle.py(唯一实现)', () => {
  const r = runGate(['--json'])
  const j = JSON.parse(r.out)
  assert.equal(j.lv1.holders.length, 1, `持有字面量的文件应恰为 1 个:\n${r.out}`)
  assert.equal(j.lv1.holders[0].path, gate.LIFECYCLE_FILE)
  assert.ok(j.lv1.lifecycleHits >= 3, `唯一实现应持有四档字面量(≥3),实得 ${j.lv1.lifecycleHits}`)
})

test('T7 真仓 LV2:五族 loadState 键齐全且全部经共享出口(逐族点名)', () => {
  const r = runGate(['--json'])
  const j = JSON.parse(r.out)
  assert.equal(j.lv2.length, 5, '五族都要有读数')
  for (const rep of j.lv2) {
    const fam = gate.FAMILIES.find((f) => f.module === rep.module)
    for (const k of fam.required) {
      assert.ok(rep.keys.includes(k), `${rep.module} 缺键 ${k}(实得 [${rep.keys.join(',')}])`)
    }
    assert.equal(rep.undetermined, 0, `${rep.module} 不该未判定`)
    assert.equal(rep.violations, 0, `${rep.module} 不该有违规`)
  }
})

// ── 反向对照①:某族缺 loadState 键 ⇒ 红 ────────────────────────────────

test('T8 反向对照①:族内缺 loadState 键 ⇒ 判红并点名该族与缺键', () => {
  const j = gate.judgeModule(SINGLETON, gate.FIX_SINGLETON_NO_LOADSTATE)
  assert.ok(j.violations.length > 0, '缺 loadState 键必须判红')
  const v = j.violations.find((x) => x.includes('loadState'))
  assert.ok(v, `必须点名 loadState 键:实得 ${JSON.stringify(j.violations)}`)
  assert.ok(v.includes(SINGLETON.module), `必须点名该族:实得 ${v}`)
  assert.ok(!j.keys.includes('loadState'), '夹具确实缺该键(证明这一条不是恒绿)')
})

test('T9 反向对照①的族形状:per-key 族缺 loadState 键同样判红', () => {
  const broken = gate.FIX_PERKEY_OK.replace(/^\s*"loadState": worst,\n/m, '')
  assert.notEqual(broken, gate.FIX_PERKEY_OK, '变异必须真被改(先证明文本变了,再断言判据红)')
  const j = gate.judgeModule(PER_KEY, broken)
  assert.ok(j.violations.some((v) => v.includes('loadState')), `per-key 族缺键也必须红:实得 ${JSON.stringify(j.violations)}`)
})

// ── 反向对照②:某族硬编码四档字面量 ⇒ 红(判据A) ─────────────────────────

test('T10 反向对照②:第二个文件逐字写出四档字面量 ⇒ LV1 判红并点名该文件', () => {
  const j = gate.judgeTierScatter([
    { path: gate.LIFECYCLE_FILE, src: gate.FIX_LIFECYCLE },
    { path: 'apps/ai-service/app/services/other_svc.py', src: gate.FIX_SCATTER },
  ])
  assert.equal(j.violations.length, 1, `应恰报 1 条:实得 ${JSON.stringify(j.violations)}`)
  const v = j.violations[0]
  assert.ok(v.includes('other_svc.py'), `必须点名散落的文件:实得 ${v}`)
  assert.ok(v.includes(gate.LIFECYCLE_FILE), '必须点名唯一实现,让改法有落点')
})

test('T11 反向对照②的遮罩方向:注释/docstring 里的同名字面量不判红(门不咬自己的散文)', () => {
  const j = gate.judgeTierScatter([
    { path: gate.LIFECYCLE_FILE, src: gate.FIX_LIFECYCLE },
    { path: 'apps/ai-service/app/services/prose_only.py', src: gate.FIX_SINGLETON_OK },
  ])
  assert.equal(j.violations.length, 0, `注释/docstring 里的档位不得判红:实得 ${JSON.stringify(j.violations)}`)
  // 反向自证:同一段字面量挪进真代码必须翻红(否则上一条只是"门瞎了")
  const moved = gate.FIX_SINGLETON_OK.replace(
    '        load_state = _load_state_label(loaded=self._loaded, failures=self._load_failures)',
    `        load_state = _load_state_label(loaded=self._loaded, failures=self._load_failures)\n        _FALLBACK = "${gate.TIER_LITERALS[1]}"`,
  )
  assert.notEqual(moved, gate.FIX_SINGLETON_OK, '变异必须真被改')
  const r2 = gate.judgeTierScatter([
    { path: gate.LIFECYCLE_FILE, src: gate.FIX_LIFECYCLE },
    { path: 'apps/ai-service/app/services/prose_only.py', src: moved },
  ])
  assert.ok(r2.violations.length > 0, '同一字面量挪进真代码必须翻红(证明 T11 的绿来自遮罩,不是失明)')
})

// ── 反向对照③:loadState 写成常量 ⇒ 红(判据B 的来源维) ──────────────────

test('T12 反向对照③:loadState 硬编码 "loaded" 常量 ⇒ 判红(不经共享出口)', () => {
  const j = gate.judgeModule(SINGLETON, gate.FIX_SINGLETON_HARDCODED)
  assert.ok(
    j.violations.some((v) => v.includes('硬编码四档字面量')),
    `loadState 写成常量必须判红:实得 ${JSON.stringify(j.violations)}`,
  )
  assert.ok(j.keys.includes('loadState'), '夹具确实有 loadState 键(这一条判的是来源,不是缺键)')
})

test('T13 反向对照③的族形状:per-key 族 loadState 写常量同样判红', () => {
  const broken = gate.FIX_PERKEY_OK.replace('"loadState": worst,', '"loadState": "loaded",')
  assert.notEqual(broken, gate.FIX_PERKEY_OK, '变异必须真被改')
  const j = gate.judgeModule(PER_KEY, broken)
  assert.ok(j.violations.some((v) => v.includes('硬编码四档字面量')), 'per-key 族同样必须判红')
})

test('T14 反向对照③的传递维:经局部变量藏起来写死同样判红(不能只判"直接字面量")', () => {
  // 把常量先赋给局部变量再交给 loadState —— 只看 loadState 那一格会漏
  const broken = gate.FIX_SINGLETON_OK.replace(
    '        load_state = _load_state_label(loaded=self._loaded, failures=self._load_failures)',
    `        load_state = "loaded"`,
  )
  assert.notEqual(broken, gate.FIX_SINGLETON_OK, '变异必须真被改')
  const j = gate.judgeModule(SINGLETON, broken)
  assert.ok(
    j.violations.some((v) => v.includes('硬编码四档字面量')),
    `藏进局部变量也必须判红:实得 ${JSON.stringify(j.violations)}`,
  )
})

// ── 反向对照④:判据**不许**要求 per-key 族有 loaded 键(判据自身不许漂) ──

test('T15 反向对照④:per-key 族刻意没有 loaded/loadFailures 键 ⇒ 判据不得因此判红', () => {
  const j = gate.judgeModule(PER_KEY, gate.FIX_PERKEY_NO_SINGLETON_KEYS)
  assert.equal(j.violations.length, 0, `per-key 族缺 loaded 键不得判红:实得 ${JSON.stringify(j.violations)}`)
  assert.equal(j.undetermined.length, 0, `且不该未判定:实得 ${JSON.stringify(j.undetermined)}`)
  assert.ok(!j.keys.includes('loaded'), '夹具确实没有 loaded 键(这一条的前提)')
  assert.ok(!j.keys.includes('loadFailures'), '夹具确实没有 loadFailures 键')
})

test('T16 反向对照④的常量层锁:判据的期望键集里不得出现 loaded/loadFailures(per-key 族)', () => {
  // 这是"判据不许漂"的守卫:天有人为了让两族"看起来一致"把这两个键补进 per-key 期望集,
  // 后果是下游按单例口径读 per-key 投影 ⇒ 同名不同义(最坏的下游陷阱)。这里当场拦住。
  assert.ok(!PER_KEY.required.includes('loaded'), 'per-key 族期望集里不许有 loaded')
  assert.ok(!PER_KEY.required.includes('loadFailures'), 'per-key 族期望集里不许有 loadFailures')
  assert.ok(PER_KEY.required.includes('allKeysLoaded'), 'per-key 族的真键名是 allKeysLoaded')
  assert.ok(PER_KEY.required.includes('maxLoadFailures'), 'per-key 族的真键名是 maxLoadFailures')
  // 单例族反过来**必须**有这三键(否则 LV2 退化成"只查 loadState 键在不在")
  for (const k of ['loaded', 'loadFailures', 'loadState']) {
    assert.ok(SINGLETON.required.includes(k), `单例族期望集缺 ${k}`)
  }
})

test('T17 反向对照④的运行面:把真族判据换成"per-key 也要求 loaded"后,合规夹具必须翻红', () => {
  // 构造"判据自身写歪"的形态:给 per-key 族临时加一个 loaded 期望键
  const skewed = [{ ...PER_KEY, required: [...PER_KEY.required, 'loaded'] }]
  const fam = gate.FAMILIES.map((f) => (f.kind === 'per-key' ? skewed[0] : f))
  const inputs = {}
  for (const f of fam) {
    inputs[f.module] = f.kind === 'per-key' ? gate.FIX_PERKEY_NO_SINGLETON_KEYS : gate.FIX_SINGLETON_OK
  }
  const inputs2 = { ...inputs }
  // judgeFamilies 走 FAMILIES 常量,这里直接调 judgeModule 逐族判,避免改生产常量
  let red = 0
  for (const f of fam) {
    const j = gate.judgeModule(f, inputs2[f.module])
    if (j.violations.length > 0) red += 1
  }
  assert.equal(red, 2, '判据一旦要求 per-key 族有 loaded,两个 per-key 族都应翻红(证明这条守门不是恒绿)')
})

// ── 五族聚合 + 未判定分流 ───────────────────────────────────────────────

test('T18 五族聚合:一族坏掉只点名那一族,其余不受牵连', () => {
  // 每族必须喂**本族形态**的合规夹具:拿单例夹具喂 per-key 族会因缺 7 键而红,
  // 那测的是"夹具配错",不是"聚合对账"(这一格自己踩过:全绿基线先红在夹具上)。
  const good = {}
  for (const f of gate.FAMILIES) good[f.module] = f.kind === 'per-key' ? gate.FIX_PERKEY_OK : gate.FIX_SINGLETON_OK
  assert.equal(gate.judgeFamilies(good).violations.length, 0, '全合规夹具必须绿')
  const bad = { ...good, meta_learner: gate.FIX_SINGLETON_NO_LOADSTATE }
  const j = gate.judgeFamilies(bad)
  assert.ok(j.violations.length > 0, '坏掉必须红')
  assert.ok(j.violations.every((v) => v.includes('meta_learner')), `只点名坏的那一族:实得 ${JSON.stringify(j.violations)}`)
})

test('T19 未判定分流:取不到面 / 解析不到出口 ⇒ 未判定且零违规(不记绿也不冒红)', () => {
  const noFile = gate.judgeModule(SINGLETON, '')
  assert.equal(noFile.violations.length, 0, '取不到面不得冒红')
  assert.equal(noFile.undetermined.length, 1, '取不到面必须未判定')
  const noExit = gate.judgeModule(SINGLETON, 'class X:\n    def other(self):\n        pass\n')
  assert.equal(noExit.violations.length, 0, '解析不到出口不得冒红')
  assert.match(noExit.undetermined[0], /get_status/, '未判定消息须点名锚点')
  // 门级:有未判定 ⇒ rc=2(既不记绿也不冒红的那一档)
  const inputs = {}
  for (const f of gate.FAMILIES) inputs[f.module] = f.module === 'user_profile' ? null : gate.FIX_SINGLETON_OK
  const j = gate.judgeFamilies(inputs)
  assert.ok(j.undetermined.some((u) => u.includes('user_profile')), '一族取不到必须报未判定')
  assert.ok(!j.undetermined.some((u) => u.includes('ab_test_tracker')), '其余族不该被连带判未判定')
})

test('T20 门的 --self-test 必须自会绿(不靠外部夹具)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.rc, 0, `--self-test 应全绿:\n${r.out}`)
  assert.match(r.out, /--self-test:\d+\/\d+ 通过/)
  assert.ok(!/✗/.test(r.out), `不该有失败用例:\n${r.out}`)
})
