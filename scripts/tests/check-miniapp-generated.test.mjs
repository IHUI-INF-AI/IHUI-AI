// 镜像测试:scripts/check-miniapp-generated.mjs(§22c —— 直接 import 源符号,不复制判据)
// 跑法:node --test scripts/tests/check-miniapp-generated.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
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
    assert.equal(
      new RegExp(`\\[?\\s*${verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(src),
      false,
      `出现写动词 ${verb} —— 对账门不得改动仓库状态`,
    )
  }
})

/* ───────────── 五、装车证明(本轮刻意未接线,故写成条件断言) ───────────── */

test('T11 接线状态如实登记:注册块存在则必须 blocking + skipEnv;本轮尚未接线', () => {
  const runnerPath = join(ROOT, 'scripts/guardian-runner.mjs')
  if (!existsSync(runnerPath)) return
  const src = readFileSync(runnerPath, 'utf8')
  const wired = src.includes('check-miniapp-generated.mjs')
  if (!wired) {
    // 刻意不 fail:接线由主控会话统一做(避免并行会话抢注册表)。
    // 但这条断言不许被删 —— 它是"本门当前未进提交链"的唯一机器可读记录。
    assert.ok(true, '未接线(与交付报告一致)')
    return
  }
  const hits = [...src.matchAll(/script: 'check-miniapp-generated\.mjs'/g)]
  assert.equal(hits.length, 1, `注册块应出现恰好 1 次,实际 ${hits.length} 次(重复登记即撞号)`)
  const block = src.slice(Math.max(0, hits[0].index - 700), hits[0].index + 700)
  assert.match(block, /mode: 'blocking'/, '接了就必须 blocking')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_MINIAPP_GENERATED'/, '必须带应急通道')
})
