// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `check-package-barrel-export.mjs` 的 §22c 镜像测试。
 *
 * 两条不可动摇的写法:
 *  1. **判据不复制** —— 一切行为断言都 import 源文件的 `__test__`,测试里不得再抄一份
 *     parseModule / analyze(抄了就等于两套真相,源改了就恒绿)。这里只允许断言"形状"的正则
 *     是对源码文本看的,不是重新实现判据。
 *  2. **端到端用真 git 仓** —— 夹具里把门连同相对 import 闭包复制进去(门按自身位置推 ROOT;
 *     不装它就是在审真仓,那等于跑完什么都没测 —— 守门 70 的 13/14 恒红、13c 的 11/13 例失真
 *     都是这一型)。双向锁成对:第一趟必须红、注释掉的同一形态必须绿。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-package-barrel-export.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const RUNNER = join(SCRIPTS_DIR, 'guardian-runner.mjs')
const SRC = join(SCRIPTS_DIR, GATE_REL)
const GIT = resolveGitBin() || 'git'

const gate = await import(`../${GATE_REL}`)

/** 事故实形:入口是显式命名清单,少了一行;包内文件里那个函数一直都在 */
const BARREL_OK = [
  "export { delivered, hidden } from './thing.js'",
  "export type { Shape } from './thing.js'",
  '',
].join('\n')
const BARREL_MISSING = [
  "export { delivered } from './thing.js'",
  "export type { Shape } from './thing.js'",
  '',
].join('\n')
const THING_TS =
  'export function delivered() { return 1 }\nexport function hidden() { return 2 }\nexport interface Shape { w: number }\n'
const CONSUMER = [
  "import { delivered, hidden } from '@t/pkg'",
  'export const go = () => [delivered(), hidden()]',
  '',
].join('\n')

/* ─── 端内 barrel 族(2026-09-28 扩的第二族)的夹具 ───
 * 真仓实形:`apps/<端>/src/components/index.ts` 显式清单 + 同层兄弟文件 + 两种消费写法
 * (相对目录导入 `./components`,与 tsconfig 别名 `@/components`)。 */
const APP_DIR = 'apps/web/src/components'
const APP_CARD = 'export function Card() { return 1 }\nexport function Tooltip() { return 2 }\n'
const APP_BARREL_OK = `export { Card } from './card.js'\nexport { Tooltip } from './tooltip.js'\n`
const APP_BARREL_MISSING = `export { Card } from './card.js'\n`
const APP_TSCONFIG = JSON.stringify(
  { compilerOptions: { paths: { '@/*': ['./src/*'] } }, include: ['src/**/*.ts'] },
  null,
  2,
)
const APP_CONSUMER = "import { Card, Tooltip } from './components'\nexport const a = [Card, Tooltip]\n"
const APP_ALIAS_CONSUMER = "import { Tooltip } from '@/components'\nexport const b = Tooltip\n"

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}
function runGate(dir, args) {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180_000,
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    }
  } catch (e) {
    return { code: e?.status ?? -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}
/** 装一个最小 workspace:`@t/pkg` 有 dist 产物入口(exports→dist,真仓就是这形态)+ 一个消费者,
 *  外加**一个端内 barrel 族**(apps/web/src/components/index.ts + 相对与别名两种消费写法)。
 *  端内那一族必须一起装:CLI 侧 `requireBarrels:true`,一个 barrel 都没有的面会直接判死 ——
 *  那正是 T12 要的形态,不能让所有端到端夹具都撞上它。 */
function makeRepo(dir, { barrel = BARREL_MISSING, appBarrel = APP_BARREL_OK, extraFiles = {} } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  put(
    dir,
    'packages/pkg/package.json',
    JSON.stringify(
      {
        name: '@t/pkg',
        type: 'module',
        main: './dist/index.js',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      },
      null,
      2,
    ),
  )
  put(dir, 'packages/pkg/src/index.ts', barrel)
  put(dir, 'packages/pkg/src/thing.ts', THING_TS)
  put(dir, 'apps/web/src/consumer.ts', CONSUMER)
  if (appBarrel !== null) {
    put(dir, `${APP_DIR}/index.ts`, appBarrel)
    put(dir, `${APP_DIR}/card.ts`, APP_CARD)
    put(dir, `${APP_DIR}/tooltip.ts`, 'export function Tooltip() { return 3 }\n')
    put(dir, 'apps/web/tsconfig.json', APP_TSCONFIG)
    put(dir, 'apps/web/src/ui.ts', APP_CONSUMER)
    put(dir, 'apps/web/src/alias-user.ts', APP_ALIAS_CONSUMER)
  }
  for (const [rel, txt] of Object.entries(extraFiles)) put(dir, rel, txt)
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'check-dangling-local-imports.mjs',
  ])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

/* ───────────────────────────── 判据行为(import 源实现,不复制) ───────────────────────────── */

test('T1 __test__ 必须把判据函数 export 出来(§22c:镜像测试不许拿第二份真相跑断言)', () => {
  const t = gate.__test__
  assert.deepEqual(t && typeof t, 'object', '源文件必须 export const __test__')
  for (const k of [
    'analyze',
    'parseModule',
    'entrySourceCandidates',
    'deliveredOf',
    'REL_CANDS',
    'maskComments',
    'perFileCounts',
  ])
    assert.equal(typeof t[k], 'function', `__test__ 缺键 ${k}`)
  assert.equal(t.Undetermined.name, 'Undetermined')
  // 测试文件里不得出现第二份判据**声明**(用行首锚定的声明式正则;写 `/function parseModule/`
  // 这种模式串会匹配到断言自己那一行 —— 本枚测试第一次跑就是被这条自匹配咬红的)
  const DECL_RE = /^(?:export\s+)?function\s+(parseModule|analyze|deliveredOf)\s*\(/m
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(!DECL_RE.test(self), `镜像测试不得重新实现判据:${(self.match(DECL_RE) || [])[1]}`)
})

test('T2 真事故形状必须判红(值导出在包内存在、入口没递出)', () => {
  const files = [
    'packages/pkg/package.json',
    'packages/pkg/src/index.ts',
    'packages/pkg/src/thing.ts',
    'apps/web/src/consumer.ts',
  ]
  const text = {
    'packages/pkg/package.json': JSON.stringify({
      name: '@t/pkg',
      exports: { '.': './dist/index.js' },
    }),
    'packages/pkg/src/index.ts': BARREL_MISSING,
    'packages/pkg/src/thing.ts': THING_TS,
    'apps/web/src/consumer.ts': CONSUMER,
  }
  const r = gate.__test__.analyze({ readFace: (p) => text[p] ?? null, files })
  assert.equal(r.red.length, 1, `应恰好 1 处,实得 ${JSON.stringify(r.red.map((x) => x.name))}`)
  assert.equal(r.red[0].name, 'hidden')
  assert.equal(r.red[0].file, 'apps/web/src/consumer.ts')
})

test('T3 对照组:入口补上那一行即绿(判据不是"逢 @t/pkg 即红")', () => {
  const files = [
    'packages/pkg/package.json',
    'packages/pkg/src/index.ts',
    'packages/pkg/src/thing.ts',
    'apps/web/src/consumer.ts',
  ]
  const text = {
    'packages/pkg/package.json': JSON.stringify({
      name: '@t/pkg',
      exports: { '.': './dist/index.js' },
    }),
    'packages/pkg/src/index.ts': BARREL_OK,
    'packages/pkg/src/thing.ts': THING_TS,
    'apps/web/src/consumer.ts': CONSUMER,
  }
  const r = gate.__test__.analyze({ readFace: (p) => text[p] ?? null, files })
  assert.equal(r.red.length, 0)
})

test('T4 取材面纪律的形状锁:必须走 face-reader 的读取入口,不得自派生 git / 读盘判被审内容', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '必须 import 共用取材层(守门 118)')
  assert.ok(
    /catBatch\(/.test(src),
    '必须真用层的读取入口 catBatch —— 只 import 不调用 = 半接线,118 判红',
  )
  assert.ok(!/execFileSync\(\s*['"]git['"]/.test(src), '不得自带裸 git 派生')
  assert.ok(!/readFileSync\(join\(ROOT/.test(src), '不得按磁盘读被审内容')
  // §22d:双形态入口守卫必须在位(import 它不许触发 CLI)
  assert.ok(
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/.test(
      src,
    ),
    '缺 isDirectRun 守卫',
  )
})

test('T5 定级与注册的成套性 —— 未注册时**不得**被判定为已装车(方向性对照)', () => {
  const inRunner = readFileSync(RUNNER, 'utf8').includes(GATE_REL)
  const src = readFileSync(SRC, 'utf8')
  const claimsWired = /已接 pre-commit|提交链必跑|guardian 第 \d+ 项/.test(src)
  if (inRunner) {
    // 一旦接进提交链,就必须成套:blocking + 自己的 skipEnv(否则跳门时无法定向归因)
    assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_PACKAGE_BARREL_EXPORT')
    const entry = readFileSync(RUNNER, 'utf8')
    const i = entry.indexOf(GATE_REL)
    const around = entry.slice(Math.max(0, i - 900), i + 900)
    assert.ok(/mode:\s*'blocking'/.test(around), '已注册却非 blocking')
    assert.ok(around.includes(gate.SELF_SKIP), '已注册却没带 skipEnv')
  } else {
    assert.ok(
      !claimsWired,
      `runner 里没有本门(${GATE_REL}),门体却声称已接提交链 —— 守门 89 的 R1 会红,而那句承诺是假的`,
    )
  }
})

test('T6 端到端双向锁:摘掉入口那一行(只暂存包内文件)必须红;HEAD 与索引同形的存量不得红', () => {
  const dir = mkScratch('pbe-e2e-')
  try {
    // A 臂起点:入口是**完整的**(BARREL_OK),消费者已在用 hidden ⇒ HEAD 干净
    makeRepo(dir, { barrel: BARREL_OK })
    const clean = runGate(dir, ['--staged'])
    assert.equal(clean.code, 0, `HEAD 干净时 --staged 不得红:${clean.out}`)
    assert.match(clean.out, /红 0 处/)

    // B 臂:重演事故 —— 只暂存 **barrel**(把 hidden 那行摘掉),消费者文件一行未动。
    // 判据面若按暂存文件收窄,这一臂结构上不可能红(红点在别人身上)。
    writeFileSync(join(dir, 'packages/pkg/src/index.ts'), BARREL_MISSING, 'utf8')
    gitIn(dir, ['add', 'packages/pkg/src/index.ts'])
    const bad = runGate(dir, ['--staged'])
    assert.equal(bad.code, 1, `只暂存 barrel 也必须有牙,实得 ${bad.code}:${bad.out}`)
    assert.match(
      bad.out,
      /apps\/web\/src\/consumer\.ts/,
      '必须点名真正会拿到 undefined 的消费者文件',
    )
    assert.match(bad.out, /hidden/)
    assert.match(bad.out, /棘轮锚点/, '锚点必须说明"该文件 HEAD 自身存量",否则读起来像存量债')

    // C 臂:同一份坏 barrel **已入库**(HEAD == 索引)⇒ 存量只报数,不把每次无关提交钉红
    gitIn(dir, ['commit', '-q', '-m', 'fixture: 把事故形态入库'])
    const stock = runGate(dir, ['--staged'])
    assert.equal(stock.code, 0, `存量不该在每次提交上判红(§12e 那一型):${stock.out}`)
    assert.match(stock.out, /raw red 1/, '存量必须仍然报名(不得静默)')
  } finally {
    rmScratch(dir)
  }
})

test('T7 端到端:入口不可枚举的包不得被记成"通过"——--strict 要拒绝出合格证', () => {
  const dir = mkScratch('pbe-opaque-')
  try {
    makeRepo(dir, {
      barrel: "export { delivered } from './thing.js'\nexport * from 'some-third-party'\n",
    })
    const full = runGate(dir, [])
    assert.match(full.out, /未判定 1|未判定:1|raw red 0/)
    const strict = runGate(dir, ['--strict'])
    assert.equal(strict.code, 2, `有包未判定时 --strict 必须 exit 2 而不是 0:${strict.out}`)
    assert.match(strict.out, /拒绝出具合格证/)
  } finally {
    rmScratch(dir)
  }
})

test('T8 --staged 与 --worktree 同给 = 自相矛盾,判死而不是随便挑一面', () => {
  const dir = mkScratch('pbe-flags-')
  try {
    makeRepo(dir, { barrel: BARREL_OK })
    const r = runGate(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, r.out)
    assert.match(r.out, /不得同用/)
  } finally {
    rmScratch(dir)
  }
})

test('T9 无提交可审时不记绿(空仓 ⇒ 取不到判定面 ⇒ exit 2)', () => {
  const dir = mkScratch('pbe-nocommit-')
  try {
    gitIn(dir, ['init', '-q'])
    gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
    gitIn(dir, ['config', 'user.name', 'gate-fixture'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    /**
     * 闭包必须由 `copyScriptWithClosure` 现读,不得手抄相对导入清单:手抄那份在
     * `lib/gitdir.mjs` 新增 `lib/scratch-dir.mjs` 依赖的那天起就漏拷,而漏拷的表现不是
     * "断言失败",是 spawn 出 ERR_MODULE_NOT_FOUND ⇒ 本条要证的 exit 2 永远取不到。
     * 判据失效的表现永远是错位而非安静 —— 它砸在另一条断言上,读起来像"门坏了"。
     */
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
    const r = runGate(dir, [])
    assert.equal(r.code, 2, `HEAD 不存在时必须喊"无法判定":${r.code} ${r.out}`)
    assert.match(r.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

/* ───────── 端内 barrel 族(2026-09-28 扩的第二族)的端到端与形状锁 ───────── */

test('T10 端内 barrel 双向锁:只暂存 barrel 必须红(相对与别名两种消费都要点名);入库后存量不得再拦每次提交', () => {
  const dir = mkScratch('pbe-app-')
  try {
    makeRepo(dir, { barrel: BARREL_OK, appBarrel: APP_BARREL_OK })
    const clean = runGate(dir, ['--staged'])
    assert.equal(clean.code, 0, `两端都齐备时 --staged 不得红:${clean.out}`)
    assert.match(clean.out, /barrel \d+ 个/, '报告必须把端内 barrel 的枚举数印出来(否则新射程不可见)')

    // 真事故写法:只改 barrel 那一行,消费者一行没动 —— 判据面若按暂存收窄,这一臂结构上不可能红
    writeFileSync(join(dir, `${APP_DIR}/index.ts`), APP_BARREL_MISSING, 'utf8')
    gitIn(dir, ['add', `${APP_DIR}/index.ts`])
    const bad = runGate(dir, ['--staged'])
    assert.equal(bad.code, 1, `只暂存端内 barrel 也必须有牙,实得 ${bad.code}:${bad.out}`)
    assert.match(bad.out, /Tooltip/, '必须点名那个没递出的名字')
    assert.match(bad.out, /apps\/web\/src\/ui\.ts/, '必须点名相对路径的消费者')
    assert.match(
      bad.out,
      /apps\/web\/src\/alias-user\.ts/,
      '必须点名**别名**(`@/…`)消费者 —— 旧版把别名当未知裸名静默丢掉,这一族连报名都没有',
    )

    // 存量臂:同一份坏 barrel 已入 HEAD ⇒ 与本次提交无关,不得再把每个人钉红(§12e 那一型)
    gitIn(dir, ['commit', '-q', '-m', 'fixture: 端内事故形态入库'])
    put(dir, 'NOTES.md', '一枚与两侧入口都无关的提交\n')
    gitIn(dir, ['add', 'NOTES.md'])
    const stock = runGate(dir, ['--staged'])
    assert.equal(stock.code, 0, `端内存量不该把无关提交钉红:${stock.out}`)
    assert.match(stock.out, /其中端内 barrel \d+/, '存量必须仍然报名(不得静默)')
  } finally {
    rmScratch(dir)
  }
})

test('T11 端内 barrel 的 `export *`:包内 star 必须被跟着递出,不可枚举的 star 必须落未判定', () => {
  // A 臂:Tooltip 经**包内** star 边递出 ⇒ 不得判红,也不得因此把 barrel 记成未判定
  const dir = mkScratch('pbe-star-')
  try {
    makeRepo(dir, {
      barrel: BARREL_OK,
      appBarrel: `export { Card } from './card.js'\nexport * from './tooltip.js'\n`,
    })
    const followed = runGate(dir, [])
    assert.equal(followed.code, 0, `包内 star 递出的名字被误判红:${followed.out}`)
    assert.match(followed.out, /红 0 处\(raw red 0,其中端内 barrel 0\)/)
  } finally {
    rmScratch(dir)
  }
  // B 臂:star 指向三方 ⇒ 名单不可枚举 ⇒ 只能未判定,--strict 拒绝出合格证
  const dir2 = mkScratch('pbe-opaque-app-')
  try {
    makeRepo(dir2, {
      barrel: BARREL_OK,
      appBarrel: `export { Card } from './card.js'\nexport * from 'some-third-party'\n`,
    })
    const strict = runGate(dir2, ['--strict'])
    assert.equal(strict.code, 2, `barrel 有不可枚举的边时 --strict 必须 exit 2:${strict.out}`)
    assert.match(strict.out, /barrel:apps\/web\/src\/components\/index\.ts/)
    assert.match(strict.out, /拒绝出具合格证/)
  } finally {
    rmScratch(dir2)
  }
})

test('T12 端内 barrel 枚举到 0 个 ⇒ 判死,不得记绿(空扫与"仓库干净"在账面上长得一样)', () => {
  const dir = mkScratch('pbe-nobarrel-')
  try {
    // appBarrel:null ⇒ 面上一切 index.(ts|tsx) 都只是包入口,barrel 族枚举为 0
    makeRepo(dir, { barrel: BARREL_OK, appBarrel: null })
    const r = runGate(dir, [])
    assert.equal(r.code, 2, `枚举 0 个 barrel 必须 exit 2 而不是 0:${r.code} ${r.out}`)
    assert.match(r.out, /都没枚举到/)
    assert.doesNotMatch(r.out, /本次判定未把任何"取不到"记成通过/, '判死不等于通过')
  } finally {
    rmScratch(dir)
  }
})

test('T13 形状锁:端内那一族不得只在判据里、而不在**取材面**里(第二趟漏喂 apps/ = 存量被算成新增)', () => {
  const src = readFileSync(SRC, 'utf8')
  // 锚点第二趟的文件过滤:包侧 + 端内侧 + 别名表,三者必须同批喂。
  // 取"从调用点起的一段窗口"而不是配对到最近的 `)` —— filter 体内本身就全是 `)`。
  const at = src.indexOf('const headFiles = headAll.filter(')
  assert.ok(at >= 0, '取不到锚点第二趟的文件过滤(调用点形态被改了,本锁与判据同时失效)')
  const window = src.slice(at, at + 460)
  assert.ok(window.includes("startsWith('packages/')"), '第二趟必须喂 packages/')
  assert.ok(window.includes("startsWith('apps/')"), '第二趟必须喂 apps/ —— 漏了它,端内 barrel 的锚点恒 0')
  assert.ok(/TS_RE\.test\(f\)/.test(window), '第二趟必须喂 tsconfig —— 别名解析不到 ⇒ 锚点同样恒 0')
  // barrel 族必须真挂在主判据上(函数在而调用点没接 = 提交链一路绿灯,守门 70/76/81/102 同型)
  assert.ok(/red\.push\(\{[^}]*scope:\s*'barrel'/.test(src), '端内漏递必须进同一张 red 清单(带 scope 标记)')
  assert.ok(
    /analyze\(\{ readFace, files, requireBarrels: true \}\)/.test(src),
    'CLI 侧必须以 requireBarrels:true 调用 —— 默认假意味着真仓永不因这一族失明而喊死',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
