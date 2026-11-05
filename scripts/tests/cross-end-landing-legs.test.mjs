// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 四枚跨端写盘腿 × cross-end-landing-ledger 的镜像测试(2026-11-03 立,§22c:判据 import 生产出口)。
 *
 * 钉什么:
 *  · 整链证明(最关键):腿的**生产登记出口**写完一文件 ⇒ 账本恰好 +1 行,且同夹具里
 *    collectiblePaths 判成 collectible(取 oid 与收编侧同尺,否则永远 contested);
 *  · 可续跑:重放同产出 ⇒ deduped ∧ landedSkips 判为本轮已完成;
 *  · 防事故:登记后再改一行 ⇒ contested、skipLanded 不含它;
 *  · 只读档零登记:空批一个字节都不写(账本文件都不许建)+ 写旗形状锁(主流程的
 *    registerLandings 调用点必须挂在 writtenPaths 写盘集之后;真实只读档的"账本零新增"
 *    另由 gen-rn-host-shell --check 实测钉,只读腿不碰账本);
 *  · 账本读不到 ⇒ landedSkips 报 ledger=unjudged 且不抛(失效方向"多要一次",不退场);
 *  · 同形锁:四枚的 leg 名一律来自具名常量 `export const CROSS_END_LEG`,取值逐字出现在
 *    scripts/git-guardian.mjs 的派发体里(守护自称名,不许自立新名);取 oid 的形态四枚一致。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内——守门 208);
 * 两枚顶层流程型 CLI(repair-cross-end-mirror / auto-register-cross-end)import 即跑全链,
 * 测试经它们自带的 --register-landing / --landing-skips 子进程档调**生产同一函数**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectiblePaths, readLanding, DEFAULT_QUIET_MS } from '../lib/cross-end-landing-ledger.mjs'
import { __test__ as genRnLeg, CROSS_END_LEG as GEN_RN_LEG } from '../gen-rn-host-shell.mjs'
import { __test__ as upgraderLeg, CROSS_END_LEG as UPGRADER_LEG } from '../upgrade-miniapp-shell-pages.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const read = (f) => readFileSync(join(SCRIPTS, f), 'utf8')

const REPAIR_SRC = read('repair-cross-end-mirror.mjs')
const AUTOREG_SRC = read('auto-register-cross-end.mjs')
const GUARDIAN_SRC = read('git-guardian.mjs')

/** 同形锁①:leg 名必须来自具名常量 `export const CROSS_END_LEG = '<kebab>'`,四枚同式。 */
const LEG_CONST_RE = /export const CROSS_END_LEG = '([a-z0-9-]+)'/
function legNameOf(src, file) {
  const m = LEG_CONST_RE.exec(src)
  assert.ok(m, `${file} 的 leg 名必须写成具名常量 export const CROSS_END_LEG(§0.6 同形)`)
  return m[1]
}
const REPAIR_LEG = legNameOf(REPAIR_SRC, 'repair-cross-end-mirror.mjs')
const AUTOREG_LEG = legNameOf(AUTOREG_SRC, 'auto-register-cross-end.mjs')
legNameOf(read('gen-rn-host-shell.mjs'), 'gen-rn-host-shell.mjs')
legNameOf(read('upgrade-miniapp-shell-pages.mjs'), 'upgrade-miniapp-shell-pages.mjs')

/** 四枚腿的驱动:两枚 import 直调生产函数,两枚经各自 CLI 档(同一函数,子进程)。 */
function cliCall(script, flags) {
  const out = execFileSync(process.execPath, [join(SCRIPTS, script), ...flags], {
    cwd: SCRIPTS,
    encoding: 'utf8',
    windowsHide: true, // §5b 派生进程纪律
    timeout: 5 * 60 * 1000, // 守门 80
    maxBuffer: 1 << 22,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
  })
  return JSON.parse(String(out).trim())
}
const mkCli = (script) => ({
  register: (paths, { root }) =>
    cliCall(script, ['--register-landing', `--root=${root}`, `--paths=${paths.join(',')}`]),
  skips: (paths, { root }) =>
    cliCall(script, ['--landing-skips', `--root=${root}`, `--paths=${paths.join(',')}`]),
})

const LEGS = [
  {
    key: 'repair-cross-end-mirror',
    leg: REPAIR_LEG,
    src: REPAIR_SRC,
    ...mkCli('repair-cross-end-mirror.mjs'),
  },
  {
    key: 'auto-register-cross-end',
    leg: AUTOREG_LEG,
    src: AUTOREG_SRC,
    ...mkCli('auto-register-cross-end.mjs'),
  },
  {
    key: 'gen-rn-host-shell',
    leg: GEN_RN_LEG,
    src: read('gen-rn-host-shell.mjs'),
    register: (paths, { root }) => genRnLeg.registerLandings(paths, { root }),
    skips: (paths, { root }) => genRnLeg.landedSkips(paths, { root }),
  },
  {
    key: 'upgrade-miniapp-shell-pages',
    leg: UPGRADER_LEG,
    src: read('upgrade-miniapp-shell-pages.mjs'),
    register: (paths, { root }) => upgraderLeg.registerLandings(paths, { root }),
    skips: (paths, { root }) => upgraderLeg.landedSkips(paths, { root }),
  },
]

/** 独立临时 git 仓(不 commit 也够 hash-object/check-ignore 用,与库镜像测试同款)。 */
function newRepo() {
  const dir = mkScratch('xend-leg-')
  gitRaw(['init', '-q'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}
const DEMO = 'apps/demo/LegPage.tsx'
const LEDGER_REL = join('.ihui-agent', 'state', 'cross-end-landing.jsonl')
/** 静默期已过的那一刻(现在 + quiet + 1 分钟)——只喂给量算,不落任何盘。 */
const pastQuiet = () => Date.now() + DEFAULT_QUIET_MS + 60_000

for (const leg of LEGS) {
  test(`${leg.key}: 整链证明 ⇒ 写完一文件账本恰好 +1 行且 collectiblePaths 判成 collectible`, () => {
    const dir = newRepo()
    try {
      put(dir, DEMO, 'export const a = 1\n')
      const res = leg.register([DEMO], { root: dir })
      assert.equal(res.landing, 1, `landing 应恰 1:实得 ${JSON.stringify(res)}`)
      assert.equal(res.appended, 1)
      assert.equal(res.landingError, undefined, '登记成功不得带 landingError')
      const rd = readLanding({ root: dir })
      assert.equal(rd.ok, true)
      assert.equal(rd.lines.length, 1, '账本恰好 +1 行')
      assert.equal(rd.lines[0].leg, leg.leg, '登记的 leg 必须就是守护自称名')
      assert.equal(rd.lines[0].path, DEMO)
      const col = collectiblePaths(pastQuiet(), { root: dir })
      assert.equal(col.ok, true)
      assert.deepEqual(col.collectible.map((c) => c.path), [DEMO], '整链:登记 oid == 工作树实测 oid ⇒ 可收编')
      assert.equal(col.collectible[0].leg, leg.leg)
      assert.deepEqual([col.contested.length, col.incomplete.length, col.ignored.length], [0, 0, 0])
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  test(`${leg.key}: 重放同产出 ⇒ deduped 且被 landedSkips 判为本轮已完成(skipLanded)`, () => {
    const dir = newRepo()
    try {
      put(dir, DEMO, 'export const a = 1\n')
      leg.register([DEMO], { root: dir })
      const again = leg.register([DEMO], { root: dir })
      assert.equal(again.appended, 0, '同键同 oid 不得重复追写')
      assert.equal(again.deduped, 1)
      assert.equal(again.landing, 1, 'dedup 也是"在册",landing 读数不得变 0')
      assert.equal(readFileSync(join(dir, LEDGER_REL), 'utf8').split('\n').filter(Boolean).length, 1)
      const sk = leg.skips([DEMO], { root: dir })
      assert.deepEqual(sk.skip, [DEMO], '本 leg 在册 ∧ blob 未动 ⇒ 本轮已完成')
      assert.equal(sk.ledger, null)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  test(`${leg.key}: 登记后再改一行 ⇒ contested 且 skipLanded 不含它(防事故核心)`, () => {
    const dir = newRepo()
    try {
      put(dir, DEMO, 'export const a = 1\n')
      leg.register([DEMO], { root: dir })
      put(dir, DEMO, 'export const a = 1\n// 别席后来加了一行\n')
      const col = collectiblePaths(pastQuiet(), { root: dir })
      assert.equal(col.collectible.length, 0, 'blob 已被改动 ⇒ 一条不放')
      assert.equal(col.contested.length, 1)
      assert.equal(col.contested[0].path, DEMO)
      assert.equal(col.contested[0].leg, leg.leg)
      const sk = leg.skips([DEMO], { root: dir })
      assert.deepEqual(sk.skip, [])
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  test(`${leg.key}: 空批(只读档的登记入口)⇒ 一个字节都不写,账本文件都不建`, () => {
    const dir = newRepo()
    try {
      const res = leg.register([], { root: dir })
      assert.equal(res.landing, 0)
      assert.equal(existsSync(join(dir, LEDGER_REL)), false, '零产出批不得建账本')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  test(`${leg.key}: 账本不存在 ⇒ landedSkips 报 ledger=unjudged 且不抛(失效方向=多要一次)`, () => {
    const dir = newRepo()
    try {
      put(dir, DEMO, 'x\n')
      const sk = leg.skips([DEMO], { root: dir })
      assert.equal(sk.ledger, 'unjudged')
      assert.ok(String(sk.reason).includes('not-found'), `reason 必须点名取不到:实得 ${sk.reason}`)
      assert.deepEqual(sk.skip, [])
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  test(`${leg.key}: 形状锁 —— 主流程只在写盘批调 registerLandings,且取 oid 与库同尺`, () => {
    // ① 生产调用点必须挂在"本批写了盘"的集合之后(writtenPaths),不得无条件调用;
    //    --register-landing 子进程档是显式人肉/测试出口,单列允许。
    const callLines = leg.src
      .split('\n')
      .filter((l) => l.includes('registerLandings(') && !l.includes('export function registerLandings'))
    assert.ok(callLines.length >= 1, `${leg.key} 的主流程必须调用 registerLandings`)
    for (const l of callLines)
      assert.ok(
        /writtenPaths|register-landing|registerLandings\(paths,/.test(l),
        `调用点未挂在写盘集之后:${l.trim()}`,
      )
    // ② 取 oid 的形态四枚逐字一致,且与库内 collectiblePaths(worktree 面)同一把尺
    //    (两侧算法不一致的后果是"永远 contested")。
    assert.ok(
      leg.src.includes("gitRaw(['hash-object', '--', rel], root)"),
      `${leg.key} 必须经 face-reader.gitRaw 的 hash-object 取 oid(禁自拼裸 git / 换参)`,
    )
    // ③ 判据只 import,不复制:落账/读账都走库出口。
    assert.match(leg.src, /from '\.\/lib\/cross-end-landing-ledger\.mjs'/)
    assert.doesNotMatch(leg.src, /function appendLanding|function readLanding/, '不得在腿里重写库判据')
  })
}

test('同形锁:四枚 leg 名互不相同且逐字出现在 git-guardian 派发体(守护自称名,非自立新名)', () => {
  const names = LEGS.map((l) => l.leg)
  assert.equal(new Set(names).size, 4, `四枚 leg 名必须互不相同:实得 ${names.join(',')}`)
  for (const n of names)
    assert.ok(
      GUARDIAN_SRC.includes(n),
      `leg 名 ${n} 必须逐字出现在守护源里(自称名对照:在册腿是引号整名,巡检腿是节流戳 '…-last.json' 的前缀段)`,
    )
  // 守护的在册名集合逐字含这两枚(mirror-heal / portal-converge);另两枚以节流戳自称名
  // 出现(rn-host-shell-last.json / hand-mirror-upgrade-last.json)。
  assert.match(GUARDIAN_SRC, /CROSS_END_LEGS[\s\S]*?'mirror-heal'/)
  assert.match(GUARDIAN_SRC, /CROSS_END_LEGS[\s\S]*?'portal-converge'/)
  assert.ok(GUARDIAN_SRC.includes("'rn-host-shell-last.json'"))
  assert.ok(GUARDIAN_SRC.includes("'hand-mirror-upgrade-last.json'"))
})

test('只读档实测:gen-rn-host-shell --check(不带 --write)跑完,真账本字节不变', () => {
  const ledger = join(SCRIPTS, '..', LEDGER_REL)
  const before = existsSync(ledger) ? readFileSync(ledger, 'utf8') : null
  const stdout = execFileSync(process.execPath, [join(SCRIPTS, 'gen-rn-host-shell.mjs'), '--check'], {
    cwd: SCRIPTS,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5 * 60 * 1000,
    maxBuffer: 1 << 22,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(String(stdout), /gen-rn-host-shell --check/, '只读档必须真跑完(不是静默退出)')
  const after = existsSync(ledger) ? readFileSync(ledger, 'utf8') : null
  assert.equal(after, before, '只读档不得往账本写一个字节')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
