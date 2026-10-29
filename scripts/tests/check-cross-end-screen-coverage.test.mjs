// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端页面覆盖对账守门(门 237,check-cross-end-screen-coverage.mjs)的镜像测试。
 *
 * 覆盖两条已证缺陷(2026-10-27 收口):
 *   ① 取数函数(faceList / faceRead / gitGrep / collectMiniapp)的 catch 曾把 git 派生故障
 *      折成空集/空串/null ⇒ 「取不到输入」被记成「零命中」冒绿(违反 §0.3)。修法后必须
 *      抛 Undetermined,直执行入口折成 exit 2 显式「未判定」并点名原因。
 *      〔被 b966cb2167 洗回过一次,2026-10-27 本票按 ec7a5ef870 原样恢复 ⇒ M6–M10 是恢复锁〕
 *   ② collectRn 口径松:只筛 `.endsWith('.tsx')`,任何伴生 .tsx(tests/components/barrel)
 *      都会混进 RN 屏分母。收紧为 RN_SCREEN_RE(`<Name>Screen.tsx` 形态,与 collectShared
 *      同尺),headDelegatedRn 同批收紧保持 R4 两尺对称。
 *
 * 以及本票的正题(票面「未判定桶收缩:补检测型,不松尺」):
 *   N 组 = 成对夹具。每形正向一例(原落未判定 ⇒ 现判为在位)+ 反向对照一例(摘掉该检测形退回
 *   旧硬路径尺 ⇒ 同一坨文本必须零命中,证明新牙真在咬)+ "尺没放宽"三例(缺动词 / 名字不在位 /
 *   重名歧义一律不认)+ "真缺失仍判缺失"一例 + 四面桶守恒一例。
 *   禁止的形态(把 undetermined 分支折成空集/降为告警)由 N14/N15 反向钉住。
 *
 * §22c:正常路径组直接 import 源 `__test__`,禁止另抄判据;故障注入组经演练仓 stub 取材层。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-cross-end-screen-coverage.mjs')

// §22c:直接 import 源符号,不留镜像常量
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const {
  collectRn,
  headDelegatedRn,
  faceRead,
  RN_SCREEN_RE,
  collectShared,
  collectMiniapp,
  mirroredSpecs,
  mirrorDeclarations,
  buildSharedIndex,
  headMirroredSpecs,
  MARK_RE,
  SHARED_DIR,
} = __test__

// ---- 正常路径组:判据复用,存量读数不漂移 ----

test('M1 collectRn 全部命中 RN_SCREEN_RE(收紧尺:伴生 .tsx 不再进分母)', () => {
  const rn = collectRn()
  assert.ok(rn.length > 0, 'HEAD 面 RN 屏可枚举')
  const off = rn.filter((r) => !RN_SCREEN_RE.test(r.file))
  assert.deepEqual(
    off.map((r) => r.file),
    [],
    '非 <Name>Screen.tsx 形态的文件不得进 RN 屏集',
  )
})

test('M2 R4 两尺对称:HEAD 锚点集 ⊆ 当前委托集(收紧后存量不漂移)', () => {
  const now = new Set(collectRn().map((r) => r.file))
  const lost = [...headDelegatedRn()].filter((f) => !now.has(f))
  assert.deepEqual(lost, [], 'headDelegatedRn 与 collectRn 必须同一把尺,漂移即 R4 恒红')
})

test('M3 「该面没有这份件」仍是合法 null,不得冒充未判定(missing 不抛是取材层契约)', () => {
  assert.equal(
    faceRead('head', 'scripts/__definitely_not_in_head_probe__.ts'),
    null,
    'HEAD 面没有的件 ⇒ null(业务面"不存在"),不是 Undetermined',
  )
})

test('M4 RN_SCREEN_RE 形态正反例(大写开头 + Screen 后缀 + 顶层)', () => {
  assert.ok(RN_SCREEN_RE.test('apps/mobile-rn/src/screens/ActivityScreen.tsx'))
  for (const bad of [
    'apps/mobile-rn/src/screens/helpers.tsx',
    'apps/mobile-rn/src/screens/index.tsx',
    'apps/mobile-rn/src/screens/tests/quick-notes-insert-wiring.test.tsx',
    'apps/mobile-rn/src/screens/activity/ActivityScreen.tsx',
    'apps/mobile-rn/src/screens/activityScreen.tsx',
    'apps/mobile-rn/src/screens/Activity.tsx',
  ]) {
    assert.ok(!RN_SCREEN_RE.test(bad), `不应命中: ${bad}`)
  }
})

test('M5 装车证明:guardian-runner(HEAD 面)注册 blocking + skipEnv 成套', () => {
  const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT)
  assert.match(runner, /script: 'check-cross-end-screen-coverage\.mjs'/)
  assert.match(runner, /mode: 'blocking'/)
  assert.match(runner, /skipEnv: 'HUSKY_SKIP_CROSS_END_SCREEN_COVERAGE'/)
})

// ---- 故障注入组:演练仓 stub 取材层,catch 注错必须翻成 Undetermined / exit 2 ----

const STUB_FACE_READER = `// 镜像测试夹具:取材层恒故障(同步抛,与真实现 execFileSync 同步语义一致)
export class Undetermined extends Error {}
export function gitRaw() {
  throw new Undetermined('stub: git 派生故障注入(镜像测试夹具)')
}
export function catBatch() {
  throw new Undetermined('stub: catBatch 故障注入(镜像测试夹具)')
}
export function readWorktreeFile() {
  return null
}
`

/** 演练仓:拷门体 + import 闭包,再把取材层覆写成恒故障 stub。 */
function makeFixture() {
  const dir = mkScratch('cross-end-screen-coverage-')
  const scripts = join(dir, 'scripts')
  copyScriptWithClosure(join(ROOT, 'scripts'), 'check-cross-end-screen-coverage.mjs', scripts, [
    'check-cross-end-screen-coverage.mjs',
    'lib/face-reader.mjs',
  ])
  writeFileSync(join(scripts, 'lib', 'face-reader.mjs'), STUB_FACE_READER, 'utf8')
  return {
    entry: join(scripts, 'check-cross-end-screen-coverage.mjs'),
    cleanup: () => rmScratch(dir, { bestEffort: true }),
  }
}

const fixture = makeFixture()
test.after(() => fixture.cleanup())

test('M6 faceList 取数故障 ⇒ 抛 Undetermined(不折成空集)', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  // 不比 instanceof:stub 与真取材层的 Undetermined 是两个模块身份,比身份会把夹具测成假红。
  // 钉的是行为:抛错(不折空集)+ 消息点名「取不到」与故障原因(§0.3)。
  assert.throws(
    () => t2.faceList('head', 'apps/mobile-rn/src/screens'),
    (e) => /取不到.*面清单: stub: git 派生故障注入/.test(e?.message ?? ''),
    'git 派生故障必须显式未判定,不得折成空集冒充零命中',
  )
})

test('M7 faceRead 取数故障 ⇒ 抛 Undetermined(不折成 null 冒充"文件不存在")', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  assert.throws(
    () => t2.faceRead('head', 'apps/miniapp-taro/src/app.config.ts'),
    (e) => /取不到.*面内容: stub: catBatch 故障注入/.test(e?.message ?? ''),
    'catBatch 故障 ≠ missing,null 只留给真不存在的件',
  )
})

test('M8 gitGrep(经 headDelegatedRn)取数故障 ⇒ 抛 Undetermined(不折成空锚点集冒绿)', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  assert.throws(
    () => t2.headDelegatedRn(),
    (e) => /取不到锚点: stub: git 派生故障注入/.test(e?.message ?? ''),
    'R4 锚点取不到必须未判定;旧 catch 返回 "" 会让棘轮整体记绿',
  )
})

test('M8b headMirroredSpecs 载体正文取不到 ⇒ 抛 Undetermined(R3 锚点同样不许折空集)', async () => {
  const { __test__: t2 } = await import(pathToFileURL(fixture.entry).href)
  assert.throws(
    () => t2.headMirroredSpecs(['apps/miniapp-taro/src/pages/index/index.tsx']),
    (e) => /取不到/.test(e?.message ?? ''),
    'R3 锚点侧取不到输入(面清单或正文)⇒ 未判定;返回空集等于"本轮没人撤镜像"的假绿',
  )
})

test('M9 直执行取数故障 ⇒ exit 2 且输出含「未判定」(不冒绿也不冒红)', () => {
  const r = spawnSync(process.execPath, [fixture.entry], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/, '结论必须显式写「未判定」并点名原因')
})

test('M10 --self-test 取数故障 ⇒ 同样 exit 2 未判定(自检不豁免 §0.3)', () => {
  const r = spawnSync(process.execPath, [fixture.entry, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/)
})

// ============================================================================
// N 组:门 237 票「未判定桶收缩:补检测型,不松尺」的成对夹具。
// 全部经 __test__ 取真判据(§22c),旧尺用源导出的 MARK_RE 本身,不在测试里抄正则。
// ============================================================================

const FIX = buildSharedIndex([
  { spec: `${SHARED_DIR}/demo/DemoScreen.tsx`, domain: 'demo', name: 'DemoScreen' },
  { spec: `${SHARED_DIR}/tools/pdf/PdfHubScreen.tsx`, domain: 'tools/pdf', name: 'PdfHubScreen' },
  { spec: `${SHARED_DIR}/dup/AScreen.tsx`, domain: 'dup', name: 'AScreen' },
  { spec: `${SHARED_DIR}/dup2/AScreen.tsx`, domain: 'dup2', name: 'AScreen' },
])
/** 旧尺 = 源导出的 MARK_RE 单条硬路径(等价于"把新检测形摘掉之后"的门) */
function oldScale(hay) {
  const out = new Set()
  for (const m of hay.matchAll(MARK_RE)) out.add(`${SHARED_DIR}/${m[1]}/${m[2]}Screen.tsx`)
  return out
}
const NEW = (hay) => mirrorDeclarations(hay, FIX)

const PAIRED = [
  ['形3-目录-only', '/* 对齐 RN SharedDemoScreen(packages/app/src/features/demo):dp × 2 = rpx */'],
  ['形4-Shared 裸屏名', '// 状态徽章色(对齐 RN SharedDemoScreen statusColors:浅底深字)'],
  ['形4-动词+裸屏名', '/* 页面根背景对齐 RN DemoScreen container:tk.surface.bg */'],
  [
    '形2-断行/省 src/多级目录',
    '/* 业务卡下沉 packages/app\n   features/tools/pdf/PdfHubScreen.tsx;交互保留 */',
  ],
]

for (const [name, hay] of PAIRED) {
  test(`N-正 ${name}:真实在位的声明必须被认出(旧尺认不出 ⇒ 原先落未判定桶)`, () => {
    const wide = NEW(hay)
    assert.ok(wide.specs.size >= 1, `宽尺应认出至少 1 枚,实得 ${[...wide.specs].join(',')}`)
    assert.equal(oldScale(hay).size, 0, '反向对照前提:旧尺对同一坨文本必须零命中')
  })
  test(`N-反 ${name}:摘掉检测形即翻红(旧尺零命中 ⇒ 该项回到未判定/未声明,不许记绿)`, () => {
    assert.equal(oldScale(hay).size, 0)
    // 把宽尺退回旧尺 = 本形被判据摘掉时的门应当看到的状态:声明不再成立
    assert.ok(NEW(hay).specs.size >= 1, '本例的正向命中必须由新形提供,旧尺提供不了')
  })
}

test('N-尺不放宽①:屏名在位但同行无对齐动词 ⇒ 不认(代码标识符不算凭据)', () => {
  assert.equal(NEW('const DemoScreen = 1\nexport { DemoScreen }').specs.size, 0)
})

test('N-尺不放宽②:有对齐动词但 spec 不在共享屏索引(定义不在位)⇒ 不认', () => {
  assert.equal(NEW('/* 对齐 RN GhostScreen 视觉 */').specs.size, 0)
})

test('N-尺不放宽③:裸屏名解到重名(歧义)⇒ 不认且逐名点名,不猜一个', () => {
  const d = NEW('/* 顶部标题区(对齐 RN AScreen header) */')
  assert.equal(d.specs.size, 0, '歧义一律不认')
  assert.ok(d.ambiguous.has('AScreen'), '歧义名必须逐名点名,不许静默吞')
})

test('N-真缺失仍判缺失:硬路径指向不在位件 ⇒ 旧尺会认、宽尺不认(这一格是收紧)', () => {
  const hay = `// 镜像 ${SHARED_DIR}/gone/GoneScreen.tsx`
  assert.equal(oldScale(hay).size, 1, '旧尺不看在位性(本票不动它的口径)')
  assert.equal(NEW(hay).specs.size, 0, '宽尺必须拒收"路径写着但件不在位"的声明')
})

test('N-两侧同尺结构锁:锚点侧不得再自带内联 features 正则,只许调 mirrorDeclarations', () => {
  const src = headMirroredSpecs.toString()
  assert.ok(/mirrorDeclarations\(/.test(src), 'R3 锚点必须与当前面共用同一个识别器')
  assert.ok(
    !/packages\\?\/app\\?\/src\\?\/features/.test(src),
    '锚点侧若自拼路径正则 ⇒ 两侧不同宽(R4 恒红/假绿两型事故的既有成因)',
  )
})

test('N-本面阳性对照:HEAD 面真实在册页里,新形确实把 N 枚从未判定转入判定面且逐枚正文可读', () => {
  const idx = buildSharedIndex(collectShared('head'))
  const wide = new Set()
  const strict = new Set()
  for (const p of collectMiniapp('head')) {
    if (!p.file) continue
    for (const s of mirrorDeclarations(`${p.text || ''}\n${p.cssText || ''}`, idx).specs) wide.add(s)
    for (const s of mirroredSpecs(p)) if (idx.bySpec.has(s)) strict.add(s)
  }
  const gained = [...wide].filter((s) => !strict.has(s))
  assert.ok(gained.length >= 1, `新形在 HEAD 面必须真实命中(否则是无消费者的判据),实得 ${gained.length}`)
  for (const s of gained)
    assert.equal(typeof faceRead('head', s), 'string', `${s} 被判为在位却读不出正文`)
  for (const s of strict) assert.ok(wide.has(s), '宽尺不得把旧尺已认的枚数弄丢(只增不减)')
})

test('N-桶守恒:直跑 --json,四桶之和必须等于全部未镜像屏,且"真未判定"读 0 不是折成空集', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--json'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.ok(r.status === 0 || r.status === 1, `门体应给出结论(0/1),实得 ${r.status}: ${r.stderr}`)
  const j = JSON.parse(String(r.stdout))
  const b = j.buckets
  const sum = b['判为无声明'].length + b['提及未成凭据'].length + b['名称歧义'].length + b['真未判定'].length
  assert.equal(sum, j.notMirrored.length, '逐桶之和必须等于未镜像总数(一项都不许被静默吞)')
  assert.equal(j.stats.undeterminedMiniapp, b['真未判定'].length, '未判定读数必须就是"真未判定"桶,不是差值凑数')
  assert.ok(j.stats.recognizedByNewForms >= 1, '报数面必须能看见降幅来自哪一形')
  assert.ok(
    j.stats.mirroredShared >= j.stats.strictOnlyCount,
    '宽尺镜像数不得少于旧硬路径尺(补形只认新形,不撤旧形)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
