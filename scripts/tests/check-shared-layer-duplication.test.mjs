// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-shared-layer-duplication.mjs` 的镜像测试(§22c/§22d)。
 *
 * 判据**一律从源脚本 import**(`__test__`),不在本文件里复写一份 —— 复算的第二把尺子必然漂开。
 * 本文件守四件事(取材面档;判据本体的正反例由 G-880 判据加固档随新判据配锁):
 *   ① 采集与剪枝的口径单源:collectExports 5 式样 + 同名先现者为准、appOf/候选剪枝射程;
 *   ② 判定面纪律(AGENTS §0.4,G-880 本票核心):`analyze()` 在 head / staged / worktree 三档
 *      各判各面 —— 改端侧盘不算改 HEAD、改 shared 侧盘同样不算改 HEAD(export 集合必须同面取材)、
 *      未提交的新文件不进 HEAD 面;
 *   ③ 任一棵树枚举到 0 ⇒ `Undetermined`(不把"没扫到"读成"没重复");
 *   ④ §22d 形状锁:import 本模块零输出零退出,CLI 直跑才执行 main;
 *      取材必须走共用层(face-reader 枚举 + face-scan 同面取材,门内不得再现 readFileSync);
 *   ⑤ 加固维度(G-880 判据③):util 维有牙 + "摘掉判据某维 ⇒ 命中集立刻变化"的有牙锁 +
 *      类型撞车假阳锁 + 白名单 reviewBy 到期三态(now 注入) + analyze 的 util 存量棘轮。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary, Undetermined } from '../lib/face-reader.mjs'
// §22c:判据从源脚本 import,不在测试里复算
import { __test__ as gate } from '../check-shared-layer-duplication.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-shared-layer-duplication.mjs')
const GIT = gitBinary()

const SHARED_SRC = 'packages/shared/src/use-thing.ts'
const SHARED_TEXT = 'export function useThing() { return 1 }\n'
const APP_BAD_REL = 'apps/web/src/use-thing.ts'
const APP_BAD_TEXT = 'export function useThing() { return 2 }\n'

/** 派生 git 一律显式 stdio + windowsHide(§12g 派生进程纪律) */
function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function writeRepoFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

/** 建一个带一次提交的临时仓(HEAD 面才有东西可判) */
function createRepo(files) {
  const dir = mkScratch('ihui-shared-dup-git-')
  const r = git(dir, ['init', '-q'])
  assert.equal(r.status, 0, `git init 失败: ${r.stderr}`)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  for (const [rel, content] of Object.entries(files)) writeRepoFile(dir, rel, content)
  git(dir, ['add', '-A'])
  const c = git(dir, ['commit', '-q', '-m', 'baseline'])
  assert.equal(c.status, 0, `baseline commit 失败: ${c.stdout}${c.stderr}`)
  return dir
}

// 判据本体(违规/豁免逐条反向对照)不在本文件锁 —— 那是 G-880 判据加固档(③)的配套自检,
// 由加固席随新判据一并落;本文件只锁**取材面纪律**(②③④),与 `judgeAppSource` 的签名形状解耦。

// ─── ① shared export 采集 ───

test('S02 collectExports:5 条式样都收,同名先出现者为准(shared 优先于 types)', () => {
  const text = [
    'export function fnA() {}',
    'export const cnB = 1',
    'export const ctC: string = "x"',
    'export { reD, reE }',
    'export type TyF = number',
    'export interface IgG {}',
  ].join('\n')
  const m = gate.collectExports([{ rel: 'packages/shared/src/a.ts', text }])
  for (const n of ['fnA', 'cnB', 'ctC', 'TyF', 'IgG']) assert.ok(m.has(n), `${n} 未被采集`)
  assert.ok(m.has('reD') || m.has('reE'), 'export { } 花括号式未采集')
  const dup = gate.collectExports([
    { rel: 'packages/shared/src/a.ts', text: 'export function useDup() {}' },
    { rel: 'packages/types/src/b.ts', text: 'export function useDup() {}' },
  ])
  assert.equal(dup.get('useDup'), 'packages/shared/src/a.ts', '同名必须取先出现者(采集序=注册序)')
})

// ─── ② 射程剪枝 ───

test('S03 剪枝:appOf 只认在射程端,测试文件/构建目录/非 ts 一律不收', () => {
  assert.equal(gate.appOf('apps/web/src/x.ts'), 'web')
  assert.equal(gate.appOf('apps/api/src/x.ts'), null, 'api 不在 APPS 射程')
  assert.equal(gate.appOf('apps/web/x.ts'), null, '无 src/ 段不在射程')
  assert.equal(gate.isAppCandidate('apps/web/src/x.ts'), true)
  assert.equal(gate.isAppCandidate('apps/web/src/x.test.ts'), false)
  assert.equal(gate.isAppCandidate('apps/web/src/__tests__/x.ts'), false)
  assert.equal(gate.isAppCandidate('apps/web/src/x.md'), false)
  assert.equal(gate.isSharedCandidate('packages/shared/src/x.tsx'), true)
  assert.equal(gate.isSharedCandidate('packages/shared/src/x.spec.ts'), false)
  assert.equal(gate.isSharedCandidate('packages/shared/src/x.js'), false, 'shared 采集只认 .ts/.tsx')
})

// ─── ③ 判定面纪律(§0.4,G-880 本票核心) ───

test('S04 analyze:三档各判各面 —— 改盘不算改 HEAD(端侧与 shared 侧都同面),新文件只进索引档', () => {
  const dir = createRepo({ [SHARED_SRC]: SHARED_TEXT, [APP_BAD_REL]: APP_BAD_TEXT })
  try {
    const head1 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head1.violations.length, 1, 'HEAD 面应判 1 处重复')
    assert.equal(head1.violations[0].file, APP_BAD_REL)

    // 只改端侧盘(不 add、不 commit):HEAD 读数必须不动,worktree 必须看到修好的那一份
    writeRepoFile(dir, APP_BAD_REL, 'export const webOnly = 1\n')
    assert.equal(
      gate.analyze({ root: dir, face: 'head' }).violations.length,
      1,
      '盘上改对把 HEAD 面读数改动了 ⇒ 两面混取',
    )
    assert.equal(
      gate.analyze({ root: dir, face: 'worktree' }).violations.length,
      0,
      'worktree 档没读到盘上那一份',
    )

    // 端侧还原,改 shared 侧盘:对照表(export 集合)同样必须取自被审面,不能被磁盘拖走
    writeRepoFile(dir, APP_BAD_REL, APP_BAD_TEXT)
    writeRepoFile(dir, SHARED_SRC, 'export function useOther() { return 1 }\n')
    assert.equal(
      gate.analyze({ root: dir, face: 'head' }).violations.length,
      1,
      'HEAD 的 shared 面被盘上改动改动了 ⇒ export 集合未同面取材',
    )
    assert.equal(
      gate.analyze({ root: dir, face: 'worktree' }).violations.length,
      0,
      'worktree 档 shared 已不导出 useThing ⇒ 应判 0',
    )

    // 新增一个只在索引里的重复文件:staged 档必须看得见,HEAD 档必须看不见
    writeRepoFile(dir, 'apps/miniapp-taro/src/dup.ts', 'export function useThing() { return 3 }\n')
    assert.equal(git(dir, ['add', 'apps/miniapp-taro/src/dup.ts']).status, 0)
    const staged = gate.analyze({ root: dir, face: 'staged' })
    assert.ok(
      staged.violations.some((x) => x.file === 'apps/miniapp-taro/src/dup.ts'),
      `staged 档漏判新增文件(${JSON.stringify(staged.violations)})`,
    )
    assert.ok(
      staged.violations.some((x) => x.file === APP_BAD_REL),
      '索引里仍是旧端 blob ⇒ staged 档应照判',
    )
    const head2 = gate.analyze({ root: dir, face: 'head' })
    assert.ok(
      !head2.violations.some((x) => x.file === 'apps/miniapp-taro/src/dup.ts'),
      'HEAD 档把未提交的新文件收进来了',
    )
  } finally {
    rmScratch(dir)
  }
})

test('S05 analyze:任一棵树枚举到 0 ⇒ Undetermined(不把"没扫到"读成"没重复")', () => {
  const empty = createRepo({ 'README.md': '# 空仓\n' })
  try {
    assert.throws(() => gate.analyze({ root: empty, face: 'head' }), Undetermined)
    assert.throws(() => gate.analyze({ root: empty, face: 'head' }), /枚举到 0/)
  } finally {
    rmScratch(empty)
  }
  const noApps = createRepo({ [SHARED_SRC]: SHARED_TEXT })
  try {
    assert.throws(() => gate.analyze({ root: noApps, face: 'head' }), /枚举到 0/)
  } finally {
    rmScratch(noApps)
  }
})

// ─── ④ §22d 形状锁 + 取材面接线(G-880) ───

test('S06 形状锁:取材走共用层(face-reader 枚举 + face-scan 同面),import 零输出零退出', async () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /from '\.\/lib\/face-scan\.mjs'/)
  assert.match(src, /listFaceFiles\(/, '清单必须走按面枚举(不是磁盘 walk)')
  assert.match(src, /readSources\(/, '正文必须走同面取材')
  assert.equal(/\breadFileSync\(/.test(src), false, '门内又出现 readFileSync ⇒ 取材面退回磁盘')
  assert.match(
    src,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(src, /export async function main\(/)
  assert.match(src, /export const __test__ = \{/)
  assert.equal(/^process\.exit\(/m.test(src), false, '模块顶层出现裸 process.exit ⇒ 测试 import 会打死宿主')

  const fileUrl = pathToFileURL(SCRIPT_PATH).href
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(fileUrl)})`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  assert.equal(r.status, 0, `import 未零退出: ${r.stderr}`)
  assert.equal(r.stdout, '', `import 产生了 stdout(顶层有副作用): ${r.stdout}`)
  assert.equal(r.stderr, '', `import 产生了 stderr: ${r.stderr}`)
})

test('S07 CLI 直跑:守卫放行后 main 真的执行了(输出结论)', () => {
  const r = spawnSync(process.execPath, [SCRIPT_PATH], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  // 允许 0/1(仓库现状由内容决定);这里只证明"直跑确实进了主流程"
  assert.ok([0, 1].includes(r.status), `意外退出码 ${r.status}: ${r.stderr}`)
  assert.match(`${r.stdout}${r.stderr}`, /共享层/, '直跑未进主流程(无结论输出)')
})

// ─── ⑥ 加固维度(G-880 判据③) ───

test('S08 collectUtilExports:shared 侧只认 function/const,类型同名不进比对集(撞车假阳锁)', () => {
  const text = [
    'export function formatDate(d) {}',
    'export const redactUrl = (u) => u',
    'export interface KanbanColumn { id: string }',
    'export type Cfg = number',
    'export { forwarded }',
  ].join('\n')
  const m = gate.collectUtilExports([{ rel: 'packages/shared/src/a.ts', text }])
  assert.ok(m.has('formatDate'), 'function 导出必须进 util 比对集')
  assert.ok(m.has('redactUrl'), 'const 导出必须进 util 比对集')
  assert.ok(!m.has('KanbanColumn'), 'interface 是类型撞车不是重实现(实测假阳:types 包 vs 端内同名组件)')
  assert.ok(!m.has('Cfg'), 'type 导出不得进 util 比对集')
  assert.ok(!m.has('forwarded'), 'export{} 转发名不得进 util 比对集')
  // 有牙对照:同一份文本走 collectExports(全 5 式样)⇒ 类型名照收 —— 两集确有分流,不是同一把尺
  const full = gate.collectExports([{ rel: 'packages/shared/src/a.ts', text }])
  assert.ok(full.has('KanbanColumn') && full.has('Cfg') && full.has('forwarded'))
})

test('S09 util 维有牙 + 摘维即变锁:formatDate 三处重实现看得见,摘掉 util 维命中集立刻归 0', () => {
  const shared = new Map([
    ['formatDate', 'packages/shared/src/date.ts'],
    ['useThing', 'packages/shared/src/use-thing.ts'],
  ])
  const utilSet = new Map([['formatDate', 'packages/shared/src/date.ts']])
  const APP_FMT = 'apps/web/src/fmt.ts'
  const FMT_TEXT = 'export function formatDate(d) { return String(d) }\n'
  // 旧判据(只认 use[A-Z])整族看不见的形态,新 util 维必须判得出
  const hits = gate.judgeAppSource(APP_FMT, FMT_TEXT, shared, utilSet)
  assert.equal(hits.length, 1, '端内 formatDate 重实现 ⇒ util 维必须命中')
  assert.equal(hits[0].dimension, 'util')
  assert.equal(hits[0].sharedLocation, 'packages/shared/src/date.ts')
  // 摘维即变(有牙锁):把 util 比对集掏空 ⇒ 命中集立刻从 1 变 0(证明这一维真实承重,不是恒真摆设)
  assert.equal(gate.judgeAppSource(APP_FMT, FMT_TEXT, shared, new Map()).length, 0)
  // 反向:摘掉 hook 维(sharedExports 不含 useThing)⇒ hook 命中立刻消失,util 命中不受牵连
  const BOTH = 'export function formatDate(d) {}\nexport function useThing() {}\n'
  const both = gate.judgeAppSource(APP_FMT, BOTH, shared, utilSet)
  assert.deepEqual(both.map((x) => x.dimension).sort(), ['hook', 'util'], '两维各自独立命中')
  const noHook = gate.judgeAppSource(APP_FMT, BOTH, new Map([['formatDate', 'x.ts']]), utilSet)
  assert.deepEqual(noHook.map((x) => x.exportName), ['formatDate'], '摘掉 hook 维 ⇒ hook 命中立刻消失')
  // 维度分流不重复计:use[A-Z] 名只归 hook 维(util 比对集即便含同名也不得二次命中)
  const dupHook = gate.judgeAppSource(
    APP_BAD_REL,
    APP_BAD_TEXT,
    shared,
    new Map([['useThing', 'packages/shared/src/use-thing.ts']]),
  )
  assert.equal(dupHook.length, 1, '同名 hook 不得 hook/util 两维各计一次')
  assert.equal(dupHook[0].dimension, 'hook')
  // 端外文件不在射程
  assert.equal(gate.judgeAppSource('packages/ui-react/fmt.ts', FMT_TEXT, shared, utilSet).length, 0)
})

test('S10 白名单到期三态(now 注入):未到期豁免 / 到期照计违规 / 形态坏 fail-closed', () => {
  const wl = [{ app: 'web', name: 'useAuth', reason: 'web 深度集成版', reviewBy: '2027-03-31' }]
  // ① 未到期 ⇒ 豁免
  assert.equal(gate.isWhitelisted(wl, 'web', 'useAuth', new Date(2026, 9, 23)), true)
  // 到期日当天仍豁免(reviewBy >= today),次日起不再豁免
  assert.equal(gate.isWhitelisted(wl, 'web', 'useAuth', new Date(2027, 2, 31)), true)
  assert.equal(gate.isWhitelisted(wl, 'web', 'useAuth', new Date(2027, 3, 1)), false, '到期必须停止豁免')
  // ② 形态坏 ⇒ fail-closed(reason 空 / reviewBy 非 ISO / 缺字段)
  assert.equal(gate.isWhitelisted([{ app: 'web', name: 'useAuth', reason: '', reviewBy: '2027-03-31' }], 'web', 'useAuth', new Date(2026, 9, 23)), false)
  assert.equal(gate.isWhitelisted([{ app: 'web', name: 'useAuth', reason: 'r', reviewBy: '2027/03/31' }], 'web', 'useAuth', new Date(2026, 9, 23)), false)
  assert.equal(gate.isWhitelisted([{ app: 'web', name: 'useAuth', reason: 'r' }], 'web', 'useAuth', new Date(2026, 9, 23)), false)
  // ③ 到期条目在判据里照计违规(不是只住在 isWhitelisted 导出口)
  const shared = new Map([['useAuth', 'packages/shared/src/use-auth.ts']])
  const expiredWl = [{ app: 'web', name: 'useAuth', reason: 'r', reviewBy: '2020-01-01' }]
  assert.equal(
    gate.judgeAppSource('apps/web/src/use-auth.ts', 'export function useAuth() {}\n', shared, new Map(), expiredWl, new Date(2026, 9, 23)).length,
    1,
    '白名单到期 ⇒ 照计违规',
  )
  assert.equal(
    gate.judgeAppSource('apps/web/src/use-auth.ts', 'export function useAuth() {}\n', shared, new Map(), wl, new Date(2026, 9, 23)).length,
    0,
  )
  // ④ 台账形态锁:7 条全部 {app,name,reason 非空,reviewBy ISO} 且现档未到期(门不会因到期白名单恒红)
  assert.equal(gate.WHITELIST.length, 7, '白名单条数变了要同步本锁与票面口径')
  const today = new Date()
  const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
  for (const e of gate.WHITELIST) {
    assert.ok(e.app && e.name, `白名单条目缺 app/name: ${JSON.stringify(e)}`)
    assert.ok(typeof e.reason === 'string' && e.reason.trim() !== '', `白名单 ${e.app}/${e.name} reason 为空(不可复核)`)
    assert.match(String(e.reviewBy), gate.ISO_DATE_RE, `白名单 ${e.app}/${e.name} reviewBy 非 ISO`)
    assert.ok(String(e.reviewBy) >= todayIso, `白名单 ${e.app}/${e.name} 已到期(${e.reviewBy} < ${todayIso})⇒ 须续期或整改`)
  }
})

test('S11 analyze util 棘轮:HEAD 面 util 命中只报数不进阻断集,staged 档本次新增行进阻断集', () => {
  const dir = createRepo({
    'packages/shared/src/date.ts': 'export function formatDate(d) { return 1 }\nexport function formatTime(t) { return 2 }\n',
    'apps/web/src/fmt.ts': 'export function formatDate(d) { return 3 }\n',
  })
  try {
    const head = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head.violations.length, 0, 'util 加固维在全量面不得进阻断集(§0.5 棘轮:有存量的新判据不升 blocking)')
    assert.equal(head.utilStock.length, 1, 'util 存量没报数 = 静默少扫')
    assert.equal(head.utilStock[0].exportName, 'formatDate')

    // 工作树偷加一处 util 重复(不 add):HEAD 读数纹丝不动(证明没读盘),worktree 见 2
    writeRepoFile(dir, 'apps/web/src/fmt.ts', 'export function formatDate(d) { return 3 }\nexport function formatTime(t) { return 4 }\n')
    assert.equal(gate.analyze({ root: dir, face: 'head' }).utilStock.length, 1, '盘上偷改动到了 HEAD 面 ⇒ 混面取材')
    assert.equal(gate.analyze({ root: dir, face: 'worktree' }).utilStock.length, 2, 'worktree 档应看见盘上的新值')

    // git add 后 staged 档:本次新增那一行进阻断集,存量行仍只报数
    assert.equal(git(dir, ['add', 'apps/web/src/fmt.ts']).status, 0)
    const staged = gate.analyze({ root: dir, face: 'staged' })
    assert.equal(staged.violations.length, 1, 'staged 档必须拦本次提交带进来的 util 新增')
    assert.equal(staged.violations[0].exportName, 'formatTime')
    assert.equal(staged.utilStock.length, 1, '存量行不得被算成本次新增')
  } finally {
    rmScratch(dir)
  }
})

test('S12 面纪律反向:HEAD 干净而盘上新增重复 ⇒ head 档仍判绿(不读工作树),worktree 档才红', () => {
  const dir = createRepo({ [SHARED_SRC]: SHARED_TEXT, [APP_BAD_REL]: 'export const webOnly = 1\n' })
  try {
    const head1 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head1.violations.length, 0, `HEAD 面干净的基线都不绿 ⇒ 判据失准(${JSON.stringify(head1.violations)})`)

    // 只在盘上加重复(不 add、不 commit):HEAD 档必须照旧报 0,只有 worktree 档才看见
    writeRepoFile(dir, APP_BAD_REL, APP_BAD_TEXT)
    assert.equal(
      gate.analyze({ root: dir, face: 'head' }).violations.length,
      0,
      '未提交的脏改动进了 HEAD 面 ⇒ 门对已入库代码给出假红',
    )
    assert.equal(gate.analyze({ root: dir, face: 'worktree' }).violations.length, 1, 'worktree 档没看见盘上的重复')
  } finally {
    rmScratch(dir)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
