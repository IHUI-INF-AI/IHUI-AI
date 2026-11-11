// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-OSL-RP72 2026-11-11
/**
 * object-space-land 落地前置档 RP-72「声明集成对」的镜像测试(2026-11-11 立,票 RP-72 落地前置接线腿)。
 *
 * 接线因由(票面接法):共判新增走提交链/落地前置**声明自检**档 —— runner 提交链腿(另一枚)已接,
 * 本文件钉第二条腿:本枚声明集(LAND_PATHS ∪ LAND_REMOVE_PATHS)改 `scripts/guardian-runner.mjs` 或
 * `scripts/git-guardian.mjs` 而未同枚带 `scripts/data/root-guard-manifest.json` ⇒ 判拦并点名同枚
 * --seal 出口。与 runner 提交链档一致:自检档只打印、不阻断;升 blocking 仍走「存量先归零」。
 * 本档不提供任何 skip 变量(唯一出路=同枚重封清单并把清单带进本枚落地面)。
 *
 * 判据单源在 `scripts/lib/root-guard-declaration-pairing.mjs`(§0.6:本文件不抄第二份键表,
 * 规则面/清单路径一律 import 常量;runner 腿的成对用例与结构锁住在 root-guard-declaration-pairing.test.mjs,
 * 两文件各钉各的接线面,互不改对方的文件)。
 *
 *  运行时成对用例(真跑 CLI,合成仓,与外部调用完全同形):
 *  T1 改规则文件不带清单 ⇒ 判拦点名出口,且**照常落地**(自检档不阻断;两枚规则面各自成对)
 *  T2 改规则文件同枚带清单 ⇒ 放行(无 RP-72 喊行)
 *  T3 未碰规则面 ⇒ 不喊(回归:不误拦普通落地)
 *  T4 删除档(LAND_REMOVE_PATHS)摘规则文件不带清单 ⇒ 同判拦(声明集=写入 ∪ 摘除)
 *  T5 结构锁:接线在源码、真调判据、点名 --seal --staged、无 skip 变量、排在 casUpdateRef( 之前
 *  T6 变异自证:抹 import / 删接线块 / 判据换 stub / 塞 skip 变量 ⇒ 结构锁逐项转红
 *
 * 一律在 `os.tmpdir()` 的 `git init` 合成仓里跑(经 `mkScratch`,退出即回收),
 * **绝不在真仓上跑任何落地动作**;每例跳过与本判据正交的预检(水印/相对引用/悬空引用/受影响判据复跑
 * —— 最后一条尤其必须跳:落地面刻意用规则文件路径,而注册表映射读的是**合成仓 HEAD 面**那份夹具正文,
 * 拿它选门既无意义又引入漂移),与 object-space-land-conflict-gate.test.mjs 同一姿势。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import {
  ROOT_GUARD_RULE_FILES,
  ROOT_GUARD_MANIFEST_FILE,
} from '../lib/root-guard-declaration-pairing.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'object-space-land.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
const GIT = resolveGitBin() || 'git'
const RUN_OPTS = {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 120_000,
  maxBuffer: 64 << 20,
  stdio: ['ignore', 'pipe', 'pipe'],
}
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=t@e2e.local',
      '-c',
      'user.name=e2e',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    RUN_OPTS,
  )

/** 夹具基线正文:三枚判据面各一份,内容互不相同(改哪枚、动哪枚,逐例可控)。 */
const FIXTURES = {
  [ROOT_GUARD_RULE_FILES[0]]: 'guardian-runner-base\n',
  [ROOT_GUARD_RULE_FILES[1]]: 'git-guardian-base\n',
  [ROOT_GUARD_MANIFEST_FILE]: '{"sealedAt":"base"}\n',
  'keep.txt': 'untouched\n',
}

/** 合成仓:三枚判据面 + 一枚无关件都在基线跟踪态(临时仓与真仓同形,只是内容小)。 */
function makeRepo(t) {
  const dir = mkScratch('osl-rp72-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  for (const [p, text] of Object.entries(FIXTURES)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), text, 'utf8')
  }
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/** 真跑一次落地(env 驱动的 CLI,与外部调用完全同形)。paths=null ⇒ 纯删除档。 */
// msg 必须过落地器的正文形状档(2026-11-04 立:单行且 <24 字符 ⇒ exit 2),与冲突标记闸测试同一夹具姿势。
function land(dir, { paths = 'keep.txt', remove = '', msg = 'test(land): RP-72 落地前置声明自检夹具正文 —— 需过落地器的正文形状档', extra = {} } = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      LAND_ROOT: dir,
      LAND_PATHS: paths ?? '',
      LAND_REMOVE_PATHS: remove,
      LAND_MSG: msg,
      // 四项与本判据正交的预检:水印/相对引用/悬空引用在临时仓判不出(无横幅基线 / closure 未复制 /
      // 树不是本仓 HEAD);受影响判据复跑按落地面路径选门,而注册表映射读合成仓 HEAD 面的夹具正文 ⇒
      // 拿它选门无意义,跳过并留痕(跳过行不影响本文件断言,RP-72 自检在 CAS 之前已完成)。
      IHUI_LAND_SKIP_WATERMARK: '1',
      IHUI_LAND_SKIP_IMPORT_CHECK: '1',
      IHUI_LAND_SKIP_DANGLING_GATE: '1',
      IHUI_LAND_SKIP_AFFECTED_GATES: '1',
      ...extra,
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const out = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`
const RP72_LINE = '根护栏声明自检'

test('T1 改规则文件不带清单 ⇒ 判拦点名同枚 --seal 出口,且照常落地(自检档不阻断)', (t) => {
  for (const rule of ROOT_GUARD_RULE_FILES) {
    const dir = makeRepo(t)
    writeFileSync(join(dir, rule), `${rule} seat-p16 change\n`, 'utf8')
    const r = land(dir, { paths: rule })
    const o = out(r)
    assert.match(o, new RegExp(RP72_LINE), `改 ${rule} 未带清单必须打 RP-72 自检行`)
    assert.ok(o.includes('判拦'), '话术必须含「判拦」(与 runner 提交链档同词)')
    assert.ok(o.includes(rule), '必须点名被改的规则面')
    assert.ok(o.includes(ROOT_GUARD_MANIFEST_FILE), '必须点名没同枚带的清单')
    assert.ok(o.includes('--seal --staged'), '必须点名同枚 --seal 出口(--staged 档,与 runner 档一致)')
    assert.equal(r.status, 0, `自检档不阻断:落地必须照常成功,实得 ${r.status}:${o}`)
    const landed = runGit(dir, ['cat-file', 'blob', `HEAD:${rule}`])
    assert.ok(landed.includes('seat-p16 change'), '内容必须真进了 HEAD(证明"不阻断"不是空话)')
  }
})

test('T2 改规则文件同枚带清单 ⇒ 放行(无 RP-72 喊行)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, ROOT_GUARD_RULE_FILES[0]), 'guardian-runner changed WITH manifest\n', 'utf8')
  writeFileSync(join(dir, ROOT_GUARD_MANIFEST_FILE), '{"sealedAt":"resealed-together"}\n', 'utf8')
  const r = land(dir, { paths: `${ROOT_GUARD_RULE_FILES[0]};${ROOT_GUARD_MANIFEST_FILE}` })
  const o = out(r)
  assert.equal(r.status, 0, `带清单必须能落,实得 ${r.status}:${o}`)
  assert.ok(!o.includes(RP72_LINE), '同枚带清单 ⇒ 不得喊 RP-72(放行侧成对用例)')
})

test('T3 未碰规则面 ⇒ 不喊(回归:不误拦普通落地)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'keep.txt'), 'untouched + seat change\n', 'utf8')
  const r = land(dir, { paths: 'keep.txt' })
  const o = out(r)
  assert.equal(r.status, 0, `普通落地必须照常成功,实得 ${r.status}:${o}`)
  assert.ok(!o.includes(RP72_LINE), '没碰规则面 ⇒ na,一行都不许多喊')
})

test('T4 删除档摘规则文件不带清单 ⇒ 同判拦(声明集=写入 ∪ 摘除)', (t) => {
  const dir = makeRepo(t)
  const r = land(dir, { paths: null, remove: ROOT_GUARD_RULE_FILES[1] })
  const o = out(r)
  assert.match(o, new RegExp(RP72_LINE), '摘除规则文件也是"声明集改规则面",必须同判拦')
  assert.ok(o.includes('--seal --staged'), '判拦必须点名同枚 --seal 出口')
  assert.equal(r.status, 0, `自检档不阻断:纯删除照常落,实得 ${r.status}:${o}`)
  const gone = runGit(dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', ROOT_GUARD_RULE_FILES[1]])
  assert.equal(String(gone).trim(), '', '删除档确实进了 HEAD(反向自证:不在树里)')
})

// —— 结构锁(带变异自证) ——

function assertLandWiring(source) {
  assert.ok(
    source.includes("import { rootGuardDeclarationPairing } from './lib/root-guard-declaration-pairing.mjs'"),
    '落地器必须 import 判据单源(接线缺失 = 自检是摆设)',
  )
  const start = source.indexOf('RP-72 根护栏声明自检(落地前置档')
  assert.ok(start > 0, '自检块必须挂在落地前置档(锚点注释在源码里)')
  const end = source.indexOf('const skipWatermark = process.env', start)
  assert.ok(end > start, '自检块必须排在 main() 声明集解构之后、预检开关之前')
  const region = source.slice(start, end)
  assert.ok(region.includes('rootGuardDeclarationPairing('), '自检块必须真调判据(只 import 不接=摆设)')
  assert.ok(region.includes('paths'), '声明集必须取本枚落地面(paths ∪ removePaths),不是别处')
  assert.ok(region.includes('removePaths'), '删除档必须计入声明集(摘规则面同样是改规则面)')
  assert.ok(region.includes('--seal --staged'), '判拦必须点名同枚 --seal 出口(--staged 档)')
  assert.ok(region.includes('判拦'), '点名话术必须含「判拦」')
  assert.ok(region.includes('不阻断'), '自检档必须自我声明不阻断(与 runner 提交链档一致)')
  assert.equal(region.includes('process.env'), false, '本尺不提供任何 skip 变量(唯一出路=同枚重封清单并带进落地面)')
  const casAt = source.indexOf('casUpdateRef(commit, head, { root })')
  assert.ok(casAt > 0, 'casUpdateRef 调用点必须还在')
  assert.ok(start < casAt, '自检必须排在落地动作(CAS)之前 —— 排在后面就是事后喊,票面要的是"落地前置"')
}

test('T5 落地器前置链接齐全且无 skip 变量', () => {
  assertLandWiring(SRC)
})

test('T6 变异自证:抹 import/删接线块/判据换 stub/塞 skip 变量 ⇒ 接线锁逐项转红', () => {
  const start = SRC.indexOf('RP-72 根护栏声明自检(落地前置档')
  const end = SRC.indexOf('const skipWatermark = process.env', start)
  assert.ok(start > 0 && end > start, '锚点取不到 ⇒ 变异夹具本身失效(先修 T5 再谈自证)')
  const cases = [
    ['抹掉 import', SRC.replace("import { rootGuardDeclarationPairing } from './lib/root-guard-declaration-pairing.mjs'", '/* removed */')],
    ['删掉整个接线块', SRC.slice(0, start) + SRC.slice(end)],
    ['判据换成恒 na 的 stub', SRC.replace('rootGuardDeclarationPairing(rpPairingPaths)', "{ verdict: 'na' }")],
    ['给本尺塞 skip 变量', SRC.replace('const rpPairingPaths = paths', "if (process.env.IHUI_RP72_SKIP === '1') return\n    const rpPairingPaths = paths")],
  ]
  for (const [label, mutated] of cases) {
    assert.notEqual(mutated, SRC, `${label}:变异没生效 ⇒ 本自证是摆设`)
    let red = false
    try {
      assertLandWiring(mutated)
    } catch {
      red = true
    }
    assert.equal(red, true, `${label} 后接线锁必须红`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
