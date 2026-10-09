// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-miniapp-generated.mjs(§22c —— 直接 import 源符号,不复制判据)
// 跑法:node --test scripts/tests/check-miniapp-generated.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate, CHECK_FACES } from '../check-miniapp-generated.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// 本文件在 <root>/scripts/tests/ 下:向上两级才到仓库根(写错一级会把路径拼成 scripts/scripts/...)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-miniapp-generated.mjs')
const APP = 'apps/miniapp-taro'
const TABBAR_DIR = `${APP}/src/assets/tabbar`

function runGuard(args, cwd = ROOT) {
  try {
    const out = execFileSync(process.execPath, [GUARD, ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out, err: '' }
  } catch (e) {
    return { code: e?.status ?? 2, out: e?.stdout ?? '', err: e?.stderr ?? String(e?.message) }
  }
}

function git(dir, args) {
  return execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
    // maxBuffer 显式给足:T11 要用它把 HEAD 版的 guardian-runner.mjs(实测 181KB,且只会长)整份读回,
    // 默认 1MB 一旦顶不住就是 ENOBUFS —— 那会让一条"接线对账"断言以"取不到"的形态红,难查且与判据无关。
    { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 一个只含"引用 ↔ 存在"两侧齐全的最小仓 */
function makeConsistentRepo(dir) {
  git(dir, ['init', '-q', '-b', 'main'])
  put(dir, `${APP}/src/pages/x.tsx`, `export const I = () => <img src='assets/tabbar/present.png' />`)
  put(dir, `${TABBAR_DIR}/present.png`, 'PNG')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/** 注册对象里 `script:` 之后的那一段(= 本门自己的档位与应急通道,不吞邻门) */
function ownRegistrationTail(src, idx) {
  const rest = src.slice(idx)
  const end = rest.search(/\n\s*\},\n/)
  return end > 0 ? rest.slice(0, end) : rest.slice(0, 800)
}

/** 失败消息里只打登记行本身,别把 1.4KB 的 onFailHint 整块喷进终端 */
function blockFacts(text) {
  const lines = text.split('\n').filter((l) => /\b(id|mode|skipEnv|script|args):/.test(l)).map((l) => l.trim())
  return lines.length ? lines.join('\n') : '(该段里没解析到 id/mode/skipEnv/script 任一行)'
}

/** 两次输出的第一处行级差异(给"同形"断言一个能读懂的失败消息) */
function firstDiff(a, b) {
  const la = a.split('\n')
  const lb = b.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if (la[i] !== lb[i]) return `第 ${i + 1} 行不同:\n  run1: ${la[i]}\n  run2: ${lb[i]}`
  }
  return '(无行级差异)'
}

/* ───────────── 一、§22c 锚点:源必须真导出、测试必须真 import ───────────── */

test('T1 §22c 装载:源导出 __test__ 且含核心符号,测试真的 import 了它', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /export const __test__ = \{/, '源脚本必须有 __test__ 导出锚点')
  for (const key of ['decodeBundle', 'runCheck', 'makeReader', 'sameLeafValue', 'registryKeys']) {
    assert.ok(typeof gate[key] === 'function', `__test__ 必须导出 ${key}`)
  }
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(
    self,
    /import \{ __test__ as gate[^}]*\} from '\.\.\/check-miniapp-generated\.mjs'/,
    '测试必须直接 import 源符号(不得复制判据)',
  )
})

test('T2 §22d isDirectRun:被 import 时不得执行 CLI 主流程', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL/, '缺 §22d 守卫')
  assert.match(src, /if \(isDirectRun\)/, '守卫必须真包住 main 调用')
  // 反向:import 上面那个模块时若真的跑了 main,这里会拿不到 FACES_OK 之类的纯导出符号
  assert.ok(Array.isArray(CHECK_FACES) && CHECK_FACES.length >= 2, 'import 成功即证明顶层没有 process.exit / git 派生;面清单必须由本门持有')
})

/* ───────────── 二、取材面:两个面旗同给 / 非 git 根 一律 exit 2 ───────────── */

test('T3 --staged 与 --worktree 同给 ⇒ exit 2(不得任选一面假装判定)', () => {
  const r = runGuard(['--staged', '--worktree'])
  assert.equal(r.code, 2, `期望 exit 2,实际 ${r.code}:${r.out}${r.err}`)
  assert.match(`${r.out}${r.err}`, /不得同用|无法判定|互斥/)
})

test('T4 --root 指到非 git 目录 ⇒ exit 2「无法判定」,绝不记绿也绝不冒红', () => {
  const dir = mkScratch('cmg-notgit')
  try {
    put(dir, `${APP}/src/pages/x.tsx`, `export const I = 'assets/tabbar/anything.png'`)
    const r = runGuard(['--root', dir, '--worktree', '--group', 'assets'])
    // 磁盘面不需要 git ⇒ 这一条只用来证明"面选对了就能判";真判死看下面的 head 面
    assert.equal(r.code, 1, `磁盘面应判出缺资源,实际 ${r.code}:${r.out}`)
    const h = runGuard(['--root', dir, '--group', 'assets'])
    assert.equal(h.code, 2, `HEAD 面在非 git 根必须判"无法判定",实际 ${h.code}:${h.out}${h.err}`)
    assert.match(`${h.out}${h.err}`, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('T5 未知参数必须报错而不是默默当全量', () => {
  const r = runGuard(['--stagedd'])
  assert.notEqual(r.code, 0, `拼错的参数不得被当成有效调用:${r.out}`)
})

/* ───────────── 三、端到端:临时 git 仓,两个面各判一次 ───────────── */

test('T6 齐全 ⇒ HEAD 与索引两面都 exit 0(反向对照,防本门恒红)', () => {
  const dir = makeConsistentRepo(mkScratch('cmg-ok'))
  try {
    for (const args of [['--root', dir], ['--root', dir, '--staged']]) {
      const r = runGuard([...args, '--group', 'assets'])
      assert.equal(r.code, 0, `${args.join(' ')} 期望 0,实际 ${r.code}:${r.out}${r.err}`)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T7 两面口径必须真分开:坏改动只在索引 ⇒ --staged 红而 HEAD 仍绿', () => {
  const dir = makeConsistentRepo(mkScratch('cmg-face'))
  try {
    // 引用一个不存在的资源,只 git add(不进 HEAD)—— 这正是本门存在的理由
    put(dir, `${APP}/src/pages/bad.tsx`, `export const I = () => <img src='assets/tabbar/nope.png' />`)
    git(dir, ['add', '-A'])
    const staged = runGuard(['--root', dir, '--staged', '--group', 'assets'])
    const head = runGuard(['--root', dir, '--group', 'assets'])
    assert.equal(staged.code, 1, `索引面必须判红,实际 ${staged.code}:${staged.out}`)
    assert.match(staged.out, /nope\.png/, '必须点名缺的那个资源')
    assert.equal(head.code, 0, `HEAD 面不该被别人的未提交改动钉红,实际 ${head.code}:${head.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 判据有牙且方向分明:补上文件即转绿(与 T7 成对)', () => {
  const dir = makeConsistentRepo(mkScratch('cmg-fix'))
  try {
    put(dir, `${APP}/src/pages/bad.tsx`, `export const I = () => <img src='assets/tabbar/nope.png' />`)
    git(dir, ['add', '-A'])
    assert.equal(runGuard(['--root', dir, '--staged', '--group', 'assets']).code, 1, '改前必须红')
    put(dir, `${TABBAR_DIR}/nope.png`, 'PNG')
    git(dir, ['add', '-A'])
    const after = runGuard(['--root', dir, '--staged', '--group', 'assets'])
    assert.equal(after.code, 0, `补上缺的资源后必须转绿,实际 ${after.code}:${after.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 孤儿默认不判红、--strict 改判红(同一夹具两档对照)', () => {
  const dir = makeConsistentRepo(mkScratch('cmg-orphan'))
  try {
    put(dir, `${TABBAR_DIR}/ghost.png`, 'PNG')
    git(dir, ['add', '-A'])
    const loose = runGuard(['--root', dir, '--staged', '--group', 'assets'])
    assert.equal(loose.code, 0, `默认档孤儿只报数,实际 ${loose.code}:${loose.out}`)
    assert.match(loose.out, /ghost\.png/, '必须如实点名孤儿,不得静默')
    const strict = runGuard(['--root', dir, '--staged', '--group', 'assets', '--strict'])
    assert.equal(strict.code, 1, `--strict 下孤儿必须判红,实际 ${strict.code}:${strict.out}`)
  } finally {
    rmScratch(dir)
  }
})

/* ───────────── 四、只读性:门自己不得写 git ───────────── */

test('T10 本门全程只读:源码里不得出现 git 写动词', () => {
  const src = readFileSync(GUARD, 'utf8')
  for (const verb of ["'commit'", "'add'", "'update-index'", "'reset'", "'checkout'", "'mv'", "'rm'", "'gc'"]) {
    const re = new RegExp(`\\[?\\s*${verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    if (!re.test(src)) continue
    const hit = src.split('\n').find((l) => re.test(l))
    assert.fail(`出现写动词 ${verb} —— 对账门不得改动仓库状态。命中行:${String(hit).trim()}`)
  }
})

test('T11 接线状态对账(判 HEAD blob):登记唯一 + 显式 mode + 带应急通道;warn 档必须写明升档前置条件', (t) => {
  // 口径:读 **HEAD** 的 runner,不读磁盘。guardian-runner.mjs 是全仓共享注册文件,磁盘副本常年
  // 滞后 HEAD 或带着别人未提交的改动 —— 按磁盘判会把别人的现场冒充本仓债务(与本门自身的
  // "全量判 HEAD blob / --staged 判索引"同取向;实测本文件改前就是磁盘与 HEAD 双红)。
  let src
  try {
    src = git(ROOT, ['show', 'HEAD:scripts/guardian-runner.mjs'])
  } catch (e) {
    assert.fail(`HEAD 取不到 scripts/guardian-runner.mjs ⇒ 接线状态**无法判定**:${String(e?.message ?? e).split('\n')[0]}`)
  }
  const hits = [...src.matchAll(/script: 'check-miniapp-generated\.mjs'/g)]
  if (hits.length === 0) {
    // 未接线也是一种事实:本门当前由 dev 链与手动命令消费。刻意不 fail,但也不静默 ——
    // 这条分支是唯一机器可读的「本门未进提交链」记录,删掉它就等于把状态藏起来。
    t.diagnostic('HEAD 的 runner 未登记本门(只由 dev 链 / 手动命令消费)')
    return
  }
  assert.equal(hits.length, 1, `注册块应出现恰好 1 次,实际 ${hits.length} 次(重复登记即撞号)`)

  const own = ownRegistrationTail(src, hits[0].index)
  const head = src.slice(Math.max(0, hits[0].index - 1200), hits[0].index)
  const mode = /mode: '([a-z]+)'/.exec(own)
  assert.ok(
    mode,
    `注册对象必须**显式**声明 mode(blocking|warn)。script: 之后实际读到的登记行:\n${blockFacts(own)}`,
  )
  assert.ok(
    ['blocking', 'warn'].includes(mode[1]),
    `mode 只认 blocking / warn,实际 "${mode[1]}"。登记行:\n${blockFacts(own)}`,
  )
  assert.match(
    own,
    /skipEnv: 'HUSKY_SKIP_MINIAPP_GENERATED'/,
    `接了就必须带应急通道。实际登记行:\n${blockFacts(own)}`,
  )
  // 刻意不把档位钉死成 blocking —— 升不升档由 runner 依"存量红点是否清零"决定,而本门全量面
  // 实测有 R2 孤儿与 G3 图标无源(见 --worktree 输出),钉 blocking 就是一道恒红断言。
  // 但 warn 不得变成"安静地不接":必须在登记处写明升档前置条件,否则等于把债藏进档位。
  if (mode[1] === 'warn') {
    assert.match(
      head,
      /升 blocking 的前置条件|升档.*前置条件/,
      'warn 档必须在注册处写明升 blocking 的前置条件(否则 warn 只是"永久不问责"的别名)。' +
        `注册块上方 1200 字符内未找到该说明。`,
    )
  }
})

test('T12 --self-test 连跑两次必须同形且都 0(不得被别的调用顶掉而假绿)', () => {
  const a = runGuard(['--self-test'])
  const b = runGuard(['--self-test'])
  // 阳性对照:先证明这把尺子看得见"成功行长什么样"。两次都空 + 都 exit 0 也能"完全相同",
  // 那等于什么都没跑(§"扫到 0 必须先怀疑判据")。
  assert.match(a.out, /自检:\d+ 例,失败 0/, `第一次的输出形态就不对(exit ${a.code}):${a.err || a.out}`)
  assert.equal(a.code, 0, `第一次 --self-test 期望 0,实际 ${a.code}:${a.err}`)
  assert.equal(b.code, 0, `第二次 --self-test 期望 0(说明自检留有状态,第二次结果不可信),实际 ${b.code}:${b.err}`)
  assert.match(b.out, /自检:\d+ 例,失败 0/, `第二次的输出形态不对(exit ${b.code}):${b.err || b.out}`)
  assert.equal(b.out, a.out, `两次输出必须逐字同形,实际差异:\n${firstDiff(a.out, b.out)}`)
})

/* ───────────── G-680 生成物自述钉(三例:装车锁 / 单一实现 / 端到端三态) ───────────── */

const PIN = gate.pinKit
const GEN_REL = 'scripts/gen-i18n-compressed.mjs'

/** 造一份"钉按 pristine 输入算"的离线包夹具(钉永远代表旧的那次生成,磁盘可以是新的) */
function pinBundleText({ inputs }) {
  const merged = {}
  for (const l of gate.REMOTE_LOCALES) merged[l] = { greeting: `hello-${l}` }
  const b64For = (obj) => Buffer.from(gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'))).toString('base64')
  const data = gate.REMOTE_LOCALES.map((l) => `  ${l}: '${b64For(merged[l])}',`).join('\n')
  const pin = PIN.renderPin({
    generator: GEN_REL,
    sourceCommit: 'cafebabe',
    inputs,
    generatedAt: '2026-01-01T00:00:00.000Z',
  }).join('\n')
  return { pin: `${pin}\n`, data }
}

function pinFixture(dir, { breakInputRel, withPin = true } = {}) {
  const inputs = gate.REMOTE_LOCALES.flatMap((l) => [
    { rel: `${gate.MESSAGE_ROOT}/shared/${l}.json`, text: JSON.stringify({ greeting: `hello-${l}` }) },
    { rel: `${gate.MESSAGE_ROOT}/miniapp-taro/${l}.json`, text: '{}' },
  ])
  for (const i of inputs) {
    put(dir, i.rel, i.rel === breakInputRel ? JSON.stringify({ greeting: 'LATER-EDIT' }) : i.text)
  }
  const { pin, data } = pinBundleText({ inputs, breakInputRel })
  put(dir, gate.I18N_BUNDLE, `// GENERATED\n${withPin ? pin : ''}export const REMOTE_LOCALE_B64 = {\n${data}\n}\n`)
}

test('T13 装车锁:G5 判据必须真的挂在 runCheck 上(函数在而无人调 = 提交链上一路绿灯)', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /function checkBundlePin\(/, '判据函数必须在位')
  const called = src.match(/checkBundlePin\(\{[^}]*bundleText[^}]*\}\)/g) || []
  assert.ok(called.length >= 1, 'checkBundlePin 必须在 runCheck 里被调用,否则本票等于没做')
  // 反向锁:红点必须进 blocking 聚合(只打印不改退出码的门等于没有)
  assert.match(src, /push\(\s*'G5'/, "G5 必须走 push(带 blocking),不得只 console.log")
})

test('T14 单一实现:哈希与归一只能有一份,门与生成器都引它(两处各算必漂)', () => {
  const gateSrc = readFileSync(GUARD, 'utf8')
  const genSrc = readFileSync(join(ROOT, GEN_REL), 'utf8')
  for (const [name, src] of [['门', gateSrc], ['生成器', genSrc]]) {
    assert.match(src, /lib\/generated-input-pin\.mjs/, `${name}必须引那份唯一实现`)
    // 门与生成器都不得自己 createHash —— 那正是"两处算同一个 key"的开端
    assert.doesNotMatch(src, /from 'node:crypto'/, `${name}不得自带第二份 crypto 实现`)
  }
  const libSrc = readFileSync(join(ROOT, 'scripts/lib/generated-input-pin.mjs'), 'utf8')
  assert.match(libSrc, /export function digestInputs/, '聚合哈希出口必须在 lib 里')
  // 归一必须真在 lib 里做(否则 Windows CRLF 检出的磁盘 vs git blob 恒红)
  assert.match(libSrc, /\\r\\n/, 'lib 必须做 CRLF 归一')
})

test('T15 端到端三态:matched 绿 / stale 红并点名 / absent 未判定但不得判红', (_t) => {
  // ① matched ⇒ exit 0
  const ok = mkScratch('cmg-pin-ok')
  try {
    pinFixture(ok, {})
    const r = runGuard(['--root', ok, '--worktree', '--group', 'i18n'])
    assert.equal(r.code, 0, `钉与输入一致时期望 0,实际 ${r.code}:${r.out || r.err}`)
    assert.match(r.out, /自述钉\(G-680\):matched/, `matched 态必须点名:${r.out}`)
  } finally {
    rmScratch(ok)
  }
  // ② 输入变了而钉没重算 ⇒ exit 1 且红点点名变了哪份输入
  const stale = mkScratch('cmg-pin-stale')
  try {
    const broken = `${gate.MESSAGE_ROOT}/shared/ja.json`
    pinFixture(stale, { breakInputRel: broken })
    const r = runGuard(['--root', stale, '--worktree', '--group', 'i18n'])
    assert.equal(r.code, 1, `陈旧产物期望 1,实际 ${r.code}:${r.out}`)
    assert.match(r.out, /\[G5\]/, `必须点名 G5:${r.out}`)
    assert.ok(r.out.includes(broken), `红点必须点名变了的那份输入,实际:${r.out}`)
  } finally {
    rmScratch(stale)
  }
  // ③ 没有钉 ⇒ 未判定:不得判红(HEAD 面上现存产物正是这态,判红即恒红门),但必须喊出来
  const absent = mkScratch('cmg-pin-absent')
  try {
    pinFixture(absent, { withPin: false })
    const r = runGuard(['--root', absent, '--worktree', '--group', 'i18n'])
    assert.equal(r.code, 0, `absent 是未判定不是红,期望 0,实际 ${r.code}:${r.out}`)
    assert.match(r.out, /自述钉\(G-680\):absent/, `absent 必须报名:${r.out}`)
    assert.match(r.out, /未判定 ≠ 通过/, '必须明写"未判定不等于通过",不得让读者当成已通过')
  } finally {
    rmScratch(absent)
  }
})

test('T16 幂等:同一批输入两次 renderPin,屏蔽时刻行后逐字节全等(本票生命线)', () => {
  const inputs = [{ rel: 'a.json', text: '{"k":1}' }]
  const mk = (iso) => PIN.renderPin({ generator: 'g', sourceCommit: 'x', inputs, generatedAt: iso }).join('\n')
  const a = mk('2026-01-01T00:00:00.000Z')
  const b = mk('2026-12-31T23:59:59.999Z')
  assert.notEqual(a, b, '时刻行本来就该让原始字节不同(否则这条断言是空的)')
  assert.equal(PIN.maskGeneratedAt(a), PIN.maskGeneratedAt(b), '屏蔽时刻后必须全等')
  assert.match(a, /inputsSha256: [0-9a-f]{64}/, '聚合哈希必须是 64 位十六进制')
})

/* ───────────── I2(G-415/A8)LineIcon 调用点「值→键」 ───────────── */

/** 带注册表与一个 LineIcon 调用页的最小仓(page 内容由调用方写入) */
function makeIconRepo(dir, pageLines) {
  git(dir, ['init', '-q', '-b', 'main'])
  put(dir, `${APP}/src/components/LineIcon/icons.ts`, `export const ICONS = {\n  "bot": "<svg/>",\n  "heart": "<svg/>",\n} as const`)
  put(dir, `${APP}/src/pages/x.tsx`, pageLines.join('\n'))
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

test('T17 I2:写死的坏图标名在 HEAD 与 worktree 两面都判红并点名坏键(阳性)', () => {
  const dir = makeIconRepo(mkScratch('cmg-i2-lit'), ['export const A = () => <LineIcon name="ghost-key" />'])
  try {
    for (const extra of [[], ['--worktree']]) {
      const r = runGuard(['--root', dir, '--group', 'icons', ...extra])
      assert.equal(r.code, 1, `坏键必须判红(${extra.join(' ') || 'head'}),实际 ${r.code}:${r.out}`)
      assert.match(r.out, /ghost-key/, '必须点名坏键本身')
      assert.match(r.out, /\[I2\]/, '必须以 I2 码报出')
    }
  } finally {
    rmScratch(dir)
  }
})

test('T18 I2:合法名 + 逃逸存量 ⇒ HEAD 面绿(反向对照,防本门恒红)', () => {
  const dir = makeIconRepo(mkScratch('cmg-i2-ok'), [
    'export const A = () => <LineIcon name="bot" />',
    'export const B = () => <LineIcon name={icon as IconName} />',
  ])
  try {
    const r = runGuard(['--root', dir, '--group', 'icons'])
    assert.equal(r.code, 0, `HEAD 面逃逸存量只报数不判红,实际 ${r.code}:${r.out}${r.err}`)
    assert.match(r.out, /逃逸写法[\s\S]*?1 处/, '存量必须如实报数(1 处),不得静默当零')
  } finally {
    rmScratch(dir)
  }
})

test('T19 I2 棘轮:--staged 面逃逸数超 HEAD ⇒ 红;不超 ⇒ 绿;worktree 面 ⇒ 绿(只报数)', () => {
  const dir = makeIconRepo(mkScratch('cmg-i2-ratchet'), ['export const A = () => <LineIcon name={a as never} />'])
  try {
    // 存量不变 ⇒ --staged 绿
    git(dir, ['add', '-A'])
    let r = runGuard(['--root', dir, '--staged', '--group', 'icons'])
    assert.equal(r.code, 0, `存量未增时 --staged 必须绿,实际 ${r.code}:${r.out}${r.err}`)
    // 新增一处逃逸 ⇒ --staged 红(棘轮咬合)
    put(dir, `${APP}/src/pages/x.tsx`, [
      'export const A = () => <LineIcon name={a as never} />',
      'export const B = () => <LineIcon name={b as IconName} />',
    ].join('\n'))
    git(dir, ['add', '-A'])
    r = runGuard(['--root', dir, '--staged', '--group', 'icons'])
    assert.equal(r.code, 1, `逃逸 1→2 必须判红,实际 ${r.code}:${r.out}`)
    assert.match(r.out, /从 HEAD 的 1 处涨到 2 处/, '必须报出锚点与现值')
    // 同一工作树,HEAD 面锚点是它自己 ⇒ 绿(存量棘轮不新增恒红面)
    r = runGuard(['--root', dir, '--group', 'icons'])
    assert.equal(r.code, 0, `HEAD 面必须绿(锚点=自身),实际 ${r.code}:${r.out}${r.err}`)
  } finally {
    rmScratch(dir)
  }
})

test('T20 I2 装车锁:判据必须真挂在 runCheck 的 icons 组上(函数在而无人调 = 提交链上一路绿灯)', () => {
  const src = readFileSync(GUARD, 'utf8')
  const runCheckIdx = src.indexOf('function runCheck(')
  assert.ok(runCheckIdx > 0, 'runCheck 必须存在')
  const body = src.slice(runCheckIdx, src.indexOf('function formatReport('))
  for (const needle of ["'I2'", 'extractLineIconNameExprs(', 'isLineIconEscapeHatch(', 'lineIconValueLiterals(']) {
    assert.ok(body.includes(needle), `runCheck 必须真调用 ${needle}(只在别处定义 = 判据没装车)`)
  }
  // 注释剥离必须先于调用点扫描:注释里提 <LineIcon 不得被当成调用点(假用量,守门 R6 同型教训)
  assert.ok(body.includes('stripJsComments('), '调用点扫描必须吃剥过注释的源码')
})

/* ───────────── G-816040 写回挂点(2026-10-10):四端 ui-routes 自动写回 ─────────────
 * 立因:`apps/web/app/…/page.tsx` 被别人改了并入库,而没有任何环节重跑生成器 ⇒ 自述钉落后 ⇒
 * 本门 G5 在**干净 HEAD** 上恒红 ⇒ 每次提交被迫 --no-verify。修法=把四端生成器挂进
 * `scripts/lib/pre-commit-hook.js` 的 TOKEN_SYNC_TARGETS(§4:端内派生副本的唯一自动写回表),
 * 写回出口 = 本门的 --heal-ui-routes 档,复核门 = 本门自己(同表第 5 行的形态)。
 * 这四例分别锁:① 行真在表上且触发面盖得住真输入;② 写回真的能进这一次提交(快照协同);
 * ③ 别人在飞副本不被门覆盖;④ 修不了时仍红(不静默记绿)。
 */

const HOOK_REL = 'scripts/lib/pre-commit-hook.js'
const WEB_ART_REL = 'apps/web/src/lib/ui-routes.generated.ts'
const WEB_PAGE_REL = 'apps/web/app/(main)/x/page.tsx'
const GEN_WEB_REL = 'apps/web/scripts/generate-ui-routes.mjs'
const CONSUMER_WEB_REL = 'apps/web/src/lib/ui-action-registry.ts'
/** 演练仓要把门与它的依赖整套装进去:跑的就是仓库里那一份生成器与那一份取材层,不复制判据 */
const KIT_RELS = [
  'scripts/check-miniapp-generated.mjs',
  'scripts/lib/face-reader.mjs',
  'scripts/lib/scratch-dir.mjs',
  'scripts/lib/generated-input-pin.mjs',
  GEN_WEB_REL,
]
const HEAL_CMD = 'node scripts/check-miniapp-generated.mjs --heal-ui-routes --staged'

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function installKit(dir, { withGenerator = true } = {}) {
  for (const rel of KIT_RELS) {
    if (rel === GEN_WEB_REL && !withGenerator) continue
    const src = readFileSync(join(ROOT, rel), 'utf8')
    assert.ok(src.length > 0, `${rel} 读出来是空的,夹具会骗人`)
    put(dir, rel, src)
  }
  put(
    dir,
    CONSUMER_WEB_REL,
    "import { UI_ROUTES } from './ui-routes.generated'\nexport const R = UI_ROUTES // 消费方引用 ui-routes.generated\n",
  )
}

/** 建一个"HEAD 自洽(钉=现算)"的 web 演练仓,然后把输入改掉并只暂存输入 —— 就是本票的现场 */
function makeStaleWebRepo(dir, { staged = true } = {}) {
  git(dir, ['init', '-q', '-b', 'main'])
  installKit(dir)
  const oldText = 'export default function OLD() {\n  return null\n}\n'
  put(dir, WEB_PAGE_REL, oldText)
  const pin = PIN.renderPin({
    generator: GEN_WEB_REL,
    sourceCommit: 'cafebabe',
    inputs: [{ rel: WEB_PAGE_REL, text: oldText }],
    generatedAt: '2026-01-01T00:00:00.000Z',
  }).join('\n')
  put(
    dir,
    WEB_ART_REL,
    `// GENERATED\n${pin}\nexport const UI_ROUTES: { path: string; param: boolean; group: string }[] = [\n  { path: '/x', param: false, group: 'x' },\n]\n`,
  )
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'init'])
  const clean = runGuard(['--root', dir, '--group', 'ui-routes'])
  assert.equal(clean.code, 0, `夹具起点必须自洽(HEAD 面),实际 ${clean.code}:${clean.out || clean.err}`,)
  put(dir, WEB_PAGE_REL, 'export default function NEW() {\n  return null\n}\n')
  if (staged) git(dir, ['add', '--', WEB_PAGE_REL])
  const red = runGuard(['--root', dir, '--group', 'ui-routes', '--staged'])
  assert.equal(red.code, 1, `改输入而钉没跟必须先判红(否则后面的例子都在空转),实际 ${red.code}:${red.out}`,)
  return dir
}

/** 取登记表里某一 file 的行(按 label/file/cmd/trigger/pathTrigger/failMode/check 的字面顺序) */
function hookRow(hookSrc, fileRel) {
  const re = new RegExp(
    `label: '[^']*',\\s*\\n\\s*file: '${escRe(fileRel)}',\\s*\\n\\s*cmd: '([^']+)',\\s*\\n` +
      "\\s*trigger: '([^']+)',\\s*\\n\\s*pathTrigger: '([^']+)',\\s*\\n\\s*failMode: '([^']+)',\\s*\\n\\s*check: '([^']+)'",
  )
  return re.exec(hookSrc)
}

test('T21 装车锁:四端写回行真在登记表上,且每行的触发面盖得住判定面上的真输入清单', () => {
  const hook = readFileSync(join(ROOT, HOOK_REL), 'utf8')
  const rows = gate.UI_ROUTES_ARTIFACTS.map((art) => {
    const m = hookRow(hook, art.rel)
    assert.ok(m, `TOKEN_SYNC_TARGETS 里找不到 ${art.rel} 的写回行(或字段顺序漂了/漏登记)`)
    return { art, cmd: m[1], trigger: m[2], pathTrigger: m[3], failMode: m[4], check: m[5] }
  })
  for (const r of rows) {
    assert.equal(r.cmd, HEAL_CMD, `${r.art.rel} 的写回出口必须指向本门的 --heal-ui-routes 档`)
    assert.equal(r.check, 'check-miniapp-generated.mjs', `${r.art.rel} 的复核门 = 本门(写回与复核同一尺子)`,)
    assert.equal(r.failMode, 'block', `${r.art.rel} 必须 block:warn 等于"写回失败也照提交"`)
    assert.equal(r.trigger, 'v3-src', `${r.art.rel} 的粗触发只能是 125 认得的枚举值(warn:精确面在 pathTrigger)`,)
  }
  // 真输入清单逐条必须落在该行的 pathTrigger 之下:漏一条 = 那一端改了输入而行不触发 = 恒红复现
  const reader = gate.makeReader('head', ROOT)
  reader.prefetch([
    ...gate.UI_ROUTES_ARTIFACTS.map((a) => a.rel),
    gate.TARO_APP_CONFIG,
    gate.RN_NAVIGATOR,
    gate.RN_LINKING,
    gate.EXT_SIDEPANEL,
  ])
  for (const r of rows) {
    const rels = r.art.inputRels(reader)
    assert.ok(rels.length > 0, `${r.art.rel} 在 HEAD 面列不出输入(夹具或判据坏了)`)
    const prefixes = r.pathTrigger.split(' ').filter(Boolean)
    for (const rel of rels) {
      assert.ok(prefixes.some((p) => rel.startsWith(p)), `${r.art.rel} 的输入 ${rel} 不在触发面「${r.pathTrigger}」之内 ⇒ 这一行永不触发`,)
    }
  }
  // 精确面必须 ⊆ 粗触发,否则第二道筛永远到不了(死行)。
  // 粗触发的取值面 = END_SRC_DIRS,而它是 `[...V3_USAGE_DIRS, 'apps/web/', 'apps/extension/']` ——
  // 展开段没有字面量,所以两个 const 都要读,只读 END_SRC_DIRS 会把展开掉的那三端当成不在面内。
  const endConst = /const END_SRC_DIRS = \[([^\]]*)\]/.exec(hook)
  const v3Const = /const V3_USAGE_DIRS = \[([^\]]*)\]/.exec(hook)
  assert.ok(endConst && v3Const, "找不到 END_SRC_DIRS / V3_USAGE_DIRS(粗触发 'v3-src' 的取值面)—— 扩容写法漂了",)
  assert.match(endConst[1], /\.\.\.V3_USAGE_DIRS/, 'END_SRC_DIRS 必须展开 V3_USAGE_DIRS(一份清单两处用,不复制第二份)',)
  const coarseDirs = [
    ...[...v3Const[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    ...[...endConst[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
  ]
  for (const r of rows) {
    for (const p of r.pathTrigger.split(' ').filter(Boolean)) {
      assert.ok(coarseDirs.some((d) => p.startsWith(d)), `${r.art.rel} 的精确面 ${p} 不在粗触发 ${coarseDirs.join(', ')} 之内 ⇒ 死行`,)
    }
  }
  // 原有各行的有效面一字不改:守门 125 的枚举没被放宽,粗触发扩容的代价不得由 ALPHA_USAGE 付。
  // 这一行必须用**引用**把自己的面钉回原来那三端(字面量抄一份就是第二份真相,必漂)。
  assert.match(hook, /TOKEN_SYNC_TARGETS\.filter\(\(t\) => triggersOn\[t\.trigger\]\)/, '第一道筛的写法是别处按字面读的锚(sync-rn-global-css T8),不得顺手改形',)
  const alpha =
    /label: 'ALPHA_USAGE 用量表',\s*\n\s*file: '[^']+',\s*\n\s*cmd: '[^']+',\s*\n\s*trigger: '([^']+)',\s*\n\s*pathTrigger: ([^,\n]+),/.exec(
      hook,
    )
  assert.ok(alpha, 'ALPHA_USAGE 行必须带 pathTrigger(把面钉回原来那三端)')
  assert.equal(alpha[1], 'v3-src', "ALPHA_USAGE 的粗触发保持 'v3-src'(125 的枚举没被放宽)")
  assert.equal(alpha[2].trim(), "V3_USAGE_DIRS.join(' ')", 'ALPHA_USAGE 的精确面必须按引用等于 V3_USAGE_DIRS(一份清单两处用,不复制第二份)',)
  assert.deepEqual([...v3Const[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort(), ['apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/'].sort(), 'V3_USAGE_DIRS 必须还是立项那三端(扩容粗触动的不是这里)',)
})

test('T22 端到端(真临时 git 仓 · --staged 面):写回 + 快照协同 ⇒ 进得了这次提交,同面复检到绿', (_t) => {
  const dir = mkScratch('cmg-heal-land')
  try {
    makeStaleWebRepo(dir)
    const require_ = createRequire(import.meta.url)
    const snapLib = require_(join(ROOT, 'scripts/lib/staging-snapshot.js'))
    // 1) pre-commit 入口快照:此刻索引里只有提交者自己暂存的输入(产物不在里面)
    const snapshot = snapLib.takeStagingSnapshot({ cwd: dir })
    assert.deepEqual([...snapshot], [WEB_PAGE_REL], '快照必须只含提交者暂存的输入')
    // 2) 登记表的写回出口跑起来(表里的 cmd 原文,只是把 cwd 换到演练仓)
    const heal = runGuard(['--root', dir, '--heal-ui-routes', '--staged'])
    assert.equal(heal.code, 0, `写回档不该因为"正常写回"退非 0,实际 ${heal.code}:${heal.out || heal.err}`,)
    assert.match(heal.out, /已写回 1/, `必须报出写了 1 份,实际:${heal.out}`)
    assert.ok(heal.out.includes(WEB_ART_REL), `必须点名是哪份产物,实际:${heal.out}`)
    // 3) 表的落地三步(git add + 把新路径登记进快照)—— 少第 3 步就会被 restoreStaging 摘掉
    git(dir, ['add', '--', WEB_ART_REL])
    snapshot.add(WEB_ART_REL)
    const restored = snapLib.restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.deepEqual(restored.restored, [], `写回的产物必须活过 hook 退出前的还原,实际被摘掉:${restored.restored}`,)
    // 4) 复检:同一个面(--staged 判索引 blob)、同一轮口径 ⇒ 绿
    const judged = runGuard(['--root', dir, '--group', 'ui-routes', '--staged'])
    assert.equal(judged.code, 0, `写回后同面复检必须 0,实际 ${judged.code}:${judged.out || judged.err}`,)
    assert.match(judged.out, /apps\/web\/src\/lib\/ui-routes\.generated\.ts: matched/, `复检必须真判到 matched:${judged.out}`,)
    // 5) 幂等:再跑一次写回档必须"无需写回",一个字节都不动(登记表 failMode=block 的前置依据)
    const bytes = readFileSync(join(dir, WEB_ART_REL), 'utf8')
    const again = runGuard(['--root', dir, '--heal-ui-routes', '--staged'])
    assert.match(again.out, /已写回 0/, `第二次必须不再写,实际:${again.out}`)
    assert.equal(readFileSync(join(dir, WEB_ART_REL), 'utf8'), bytes, '第二次跑后产物必须逐字节不动',)
  } finally {
    rmScratch(dir)
  }
})

test('T23 在飞副本闸:产物的工作树副本 ≠ 索引副本 ⇒ 拒绝写回、字节不动、判定侧仍红(不替别人背书)', (_t) => {
  const dir = mkScratch('cmg-heal-inflight')
  try {
    makeStaleWebRepo(dir)
    // 另一会话正拿着这份产物的**未提交**改动:索引里还是那份陈旧带钉的,工作树已被人改过
    put(dir, WEB_ART_REL, '// 别人的在飞版本,门不得覆盖\nexport const UI_ROUTES = []\n')
    const before = readFileSync(join(dir, WEB_ART_REL), 'utf8')
    const heal = runGuard(['--root', dir, '--heal-ui-routes', '--staged'])
    assert.equal(heal.code, 0, `拒绝写回不是故障,期望 0,实际 ${heal.code}:${heal.err}`)
    assert.match(heal.out, /已写回 0/, `有在飞副本时必须一份都不写,实际:${heal.out}`)
    assert.match(heal.out, /工作树副本 ≠/, `拒绝理由必须点名"工作树副本 ≠ 面副本",实际:${heal.out}`)
    assert.equal(readFileSync(join(dir, WEB_ART_REL), 'utf8'), before, '别人的在飞字节一个都不许动')
    const judged = runGuard(['--root', dir, '--group', 'ui-routes', '--staged'])
    assert.equal(judged.code, 1, `门不背书 ⇒ 红点必须还在(不得静默记绿),实际 ${judged.code}:${judged.out}`,)
    assert.match(judged.out, /\[G5\]/, `红点仍须是 G5:${judged.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T24 生成器修不了那一半:面上没有生成器 ⇒ 拒绝写回并点名,判定侧仍红(挂点不产出绿)', (_t) => {
  const dir = mkScratch('cmg-heal-nogen')
  try {
    makeStaleWebRepo(dir)
    git(dir, ['rm', '-q', '-f', '--', GEN_WEB_REL])
    const before = readFileSync(join(dir, WEB_ART_REL), 'utf8')
    const heal = runGuard(['--root', dir, '--heal-ui-routes', '--staged'])
    assert.equal(heal.code, 0, `生成器不在位是"拒绝写回"而不是本档崩溃,期望 0,实际 ${heal.code}:${heal.err}`,)
    assert.match(heal.out, /已写回 0/, `生成器没了绝不能报"已写回",实际:${heal.out}`)
    assert.match(heal.out, /生成器不可用/, `必须点名生成器不可用,实际:${heal.out}`)
    assert.equal(readFileSync(join(dir, WEB_ART_REL), 'utf8'), before, '拒绝写回时产物字节不得动(不许半修)',)
    const judged = runGuard(['--root', dir, '--group', 'ui-routes', '--staged'])
    assert.equal(judged.code, 1, `修不了就还是红 —— 期望 1,实际 ${judged.code}:${judged.out}`)
    assert.match(judged.out, /\[G5\]/, `红点必须是 G5:${judged.out}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
