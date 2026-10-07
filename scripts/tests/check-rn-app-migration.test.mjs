// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-rn-app-migration.mjs`(mobile-rn screen 迁移守门,guardian 39)。
 *
 * 判据(什么算"已迁移"、白名单里有什么、screen 文件集怎么取)一律由门体导出的 `gate` 裁定
 * (AGENTS.md §22c 红线 + 守门 191 `check-test-judge-not-replicated.mjs`)。本文件不重述
 * `@ihui/rn-app` 的匹配式,也不重列白名单,只在断言里引用 `gate.WHITELIST`、调用
 * `gate.hasRnAppImport / listScreenFiles / getStagedScreenFiles`。
 *
 * 断言输入逐字取自真仓 HEAD(`catBatch` 现取 blob 铺进 scratch 后再交给门体判)—— 门体读磁盘,
 * 而共享工作树的磁盘面随时被并发会话改写(§12),拿磁盘面当"真仓读数"会判到别人的现场。
 *
 * 用例清单:
 *  T1 正反成对(真仓 HEAD 逐字面):PaymentScreen(已迁移 wrapper)判"已迁移",
 *     AboutScreen(真仓里只 import @ihui/design-tokens 的 RN 独占屏)判"未迁移"。后者是 HEAD 面上
 *     天然存在的近邻反例 —— 证明判据不是"内容里出现过 @ihui 包名就算"。
 *  T2 有牙证明(内存构造面):删掉那行共享层 import ⇒ 必须翻成"未迁移",逐字恢复 ⇒ 必须翻回"已迁移";
 *     子路径写法仍判"已迁移";双引号写法仍判"已迁移";近邻包名 rn-application 必须判"未迁移"。
 *  T3 存量对账 + 白名单有牙:HEAD 全量 screen 面上,未迁移者必须逐个被 `gate.WHITELIST` 解释掉;
 *     再把生产白名单里抽掉一枚真实豁免名重判一次 ⇒ 违规数必须立刻 > 0(白名单是判据不是装饰)。
 *  T4 面切换装车(子进程 + scratch 临时 git 仓):staged 一枚 screen ⇒ 读得到;再 staged 一枚非
 *     screen 路径 ⇒ 读数不被污染;screens 目录不存在 ⇒ listScreenFiles 空返。
 *     (SCREENS_DIR / ROOT 在门体加载时由 process.cwd() 冻结,所以这一支只能换进程验,不在测试里改门体)
 *  T5 CLI 全量档装车:已迁移面 exit 0 / 同一份未迁移内容挂非豁免名 exit 1 并点名 / 该内容挂真实豁免名 exit 0。
 *  T6 共享 index 实况档:门体的暂存读数是**别的会话此刻 staged 的东西**,加载期同步量能力探测,
 *     暂存面非空就整条跳过并写明"这一维此刻不判" —— 跳过不等于通过。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g);
 * 临时目录/临时 git 仓一律 mkScratch/rmScratch(§26 唯一落点);对真仓 git 严格只读(不写 index、
 * 不碰 stash)。本机 Node v24.19 无 `it.skipIf`(实测 `typeof it.skipIf === 'undefined'`),
 * 等价形状是 `it(name, { skip: <原因字符串 | false> }, fn)`。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-rn-app-migration.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_CLI = join(REPO, 'scripts', 'check-rn-app-migration.mjs')
const SCREENS_REL = 'apps/mobile-rn/src/screens'

/** 真仓 HEAD 在册路径(逐字取自 `git ls-tree -r HEAD -- apps/mobile-rn/src/screens`)。 */
const MIGRATED_REL = `${SCREENS_REL}/PaymentScreen.tsx`
const MIGRATED_BASE = 'PaymentScreen.tsx'
const EXEMPT_REL = `${SCREENS_REL}/AboutScreen.tsx`
const EXEMPT_BASE = 'AboutScreen.tsx'
const OUT_OF_SCOPE_REL = 'apps/web/app/globals.css'
/** 共享层 import 那一行在 HEAD 面上逐字长这样(T2 的行级手术锚点)。 */
const IMPORT_ANCHOR = "import { PaymentScreen as SharedPaymentScreen, type PaymentOrderItem } from '@ihui/rn-app'"

const HEAD_BLOBS = catBatch(REPO, [MIGRATED_REL, EXEMPT_REL, OUT_OF_SCOPE_REL].map((p) => `HEAD:${p}`))

function head(rel) {
  const text = HEAD_BLOBS.get(`HEAD:${rel}`)
  assert.equal(typeof text, 'string', `HEAD 面取不到 ${rel} —— 判不了就点名,绝不回落成自造夹具`)
  return text
}

function toFwd(p) {
  return String(p).split(sep).join('/')
}

function layFile(dir, rel, text) {
  const abs = join(dir, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}

function gitRead(args, cwd = REPO) {
  return spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args],
    {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 1 << 26,
    },
  )
}

/**
 * 子进程驱动。门体的 ROOT / SCREENS_DIR 在**加载时**由 process.cwd() 冻结,所以"换一面"只能换进程;
 * 驱动脚本落在 driverDir(scratch),工作树由 cwd 决定 —— 驱动里不写判据,只调 gate 并打成 JSON。
 */
function runDriver({ driverDir, cwd }) {
  const driver = layFile(
    driverDir,
    'gate-driver.mjs',
    [
      "import { pathToFileURL } from 'node:url'",
      'const mod = await import(pathToFileURL(process.argv[2]).href)',
      'const g = mod.__test__',
      'console.log(JSON.stringify({',
      '  staged: g.getStagedScreenFiles(),',
      '  listed: g.listScreenFiles(),',
      '  whitelistSize: g.WHITELIST.size,',
      '  cwd: process.cwd(),',
      '}))',
      '',
    ].join('\n'),
  )
  const r = spawnSync(process.execPath, [driver, GATE_CLI], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 1 << 26,
  })
  let json = null
  try {
    json = JSON.parse(String(r.stdout || '').trim())
  } catch {
    json = null
  }
  return { rc: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? ''), json }
}

function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [GATE_CLI, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    maxBuffer: 1 << 26,
  })
  return { rc: r.status, out: String(r.stdout ?? '') + String(r.stderr ?? '') }
}

/** 门体只读盘 ⇒ 真仓 HEAD 文本必须先铺进 scratch,再由 gate.hasRnAppImport 判。 */
function judgeAt(dir, rel, text) {
  return gate.hasRnAppImport(layFile(dir, rel, text))
}

function initScratchRepo(dir) {
  assert.equal(gitRead(['init', '--quiet'], dir).status, 0, '临时仓 init 失败')
  assert.equal(gitRead(['config', 'user.email', 'gate-test@example.invalid'], dir).status, 0)
  assert.equal(gitRead(['config', 'user.name', 'gate-test'], dir).status, 0)
}

// 真仓 HEAD 全量 screen 面(T3 存量对账用)
const HEAD_SCREENS = (() => {
  const r = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', SCREENS_REL])
  if (r.status !== 0) return { ok: false, reason: `HEAD screen 清单枚举失败(exit=${r.status})`, rels: [], blobs: null }
  const rels = String(r.stdout || '').split('\n').filter(Boolean)
  const blobs = catBatch(REPO, rels.map((p) => `HEAD:${p}`))
  const bad = rels.filter((p) => typeof blobs.get(`HEAD:${p}`) !== 'string')
  if (bad.length > 0) return { ok: false, reason: `HEAD 面 ${bad.length} 个 screen 取不到,首个:${bad[0]}`, rels, blobs }
  return { ok: true, reason: '', rels, blobs }
})()

/** 加载期同步量出的能力探测(T6):真仓暂存面非空 ⇒ 结论由别人的暂存决定。 */
const INDEX_PROBE = (() => {
  const r = gitRead(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  if (r.status !== 0) return { ok: false, reason: `暂存面枚举失败(git exit=${r.status})` }
  const staged = String(r.stdout || '').split('\n').filter(Boolean).map(toFwd)
  return staged.length === 0
    ? { ok: true, reason: '' }
    : { ok: false, reason: `共享 index 此刻有 ${staged.length} 个暂存条目(首个:${staged[0]}),属他人现场` }
})()

describe('check-rn-app-migration · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 正反成对(真仓 HEAD 逐字面):已迁移 wrapper 判真,RN 独占屏判假', () => {
    const scratch = mkScratch('ihui-rn-app-migration-t1-')
    try {
      assert.equal(judgeAt(scratch, MIGRATED_REL, head(MIGRATED_REL)), true, 'PaymentScreen 在 HEAD 上就是 wrapper,判不出迁移 = 尺子漂开')
      assert.equal(
        judgeAt(scratch, EXEMPT_REL, head(EXEMPT_REL)),
        false,
        'AboutScreen 的 HEAD 面只 import @ihui/design-tokens,判成已迁移 = 判据退化成包名子串搜索',
      )
      assert.ok(gate.WHITELIST.has(EXEMPT_BASE), '门体白名单里必须确实登记着这枚真屏(否则 T1 的反例只是巧合)')
    } finally {
      rmScratch(scratch, { bestEffort: true })
    }
  })

  it('T2 有牙证明(内存构造面):删 import 翻红、逐字恢复翻绿、子路径与双引号放行、近邻包名判假', () => {
    const scratch = mkScratch('ihui-rn-app-migration-t2-')
    try {
      const text = head(MIGRATED_REL)
      const lines = text.split('\n')
      const at = lines.findIndex((l) => l === IMPORT_ANCHOR)
      assert.ok(at >= 0, 'HEAD 面里应逐字找到那行共享层 import(找不到 = 面漂开,先怀疑尺子)')

      const stripped = lines.filter((_, i) => i !== at).join('\n')
      assert.equal(judgeAt(scratch, `${SCREENS_REL}/StrippedScreen.tsx`, stripped), false, '删掉共享层 import 后仍判已迁移 = 判据没牙')

      const restoredLines = stripped.split('\n')
      restoredLines.splice(at, 0, lines[at])
      assert.equal(judgeAt(scratch, `${SCREENS_REL}/RestoredScreen.tsx`, restoredLines.join('\n')), true, '逐字恢复原行后仍判未迁移 = 上一条的红是断言恒真而不是判据生效')

      assert.equal(judgeAt(scratch, `${SCREENS_REL}/SubPathScreen.tsx`, text.replace("'@ihui/rn-app'", "'@ihui/rn-app/wrapper'")), true, '门体注释写明子路径 import 也算迁移')
      assert.equal(judgeAt(scratch, `${SCREENS_REL}/DoubleQuoteScreen.tsx`, text.replace("from '@ihui/rn-app'", 'from "@ihui/rn-app"')), true, '双引号写法同样算迁移(门体注释里的口径)')
      assert.equal(judgeAt(scratch, `${SCREENS_REL}/NearMissScreen.tsx`, text.replace("'@ihui/rn-app'", "'@ihui/rn-application'")), false, '近邻包名被放过 = 锚点没锚住')
    } finally {
      rmScratch(scratch, { bestEffort: true })
    }
  })

  it(
    'T3 存量对账 + 白名单有牙:HEAD 全量 screen 面上未迁移者必被 gate.WHITELIST 解释掉;抽掉一枚真实豁免立刻判违规',
    { skip: HEAD_SCREENS.ok ? false : `能力探测未过:${HEAD_SCREENS.reason} —— 面取不齐就不下结论` },
    () => {
      const scratch = mkScratch('ihui-rn-app-migration-t3-')
      try {
        const notMigrated = []
        for (const rel of HEAD_SCREENS.rels) {
          if (!judgeAt(scratch, rel, HEAD_SCREENS.blobs.get(`HEAD:${rel}`))) notMigrated.push(rel.split('/').pop())
        }
        const unexplained = notMigrated.filter((b) => !gate.WHITELIST.has(b))
        assert.deepEqual(
          unexplained,
          [],
          `HEAD 上存在既未迁移又不在白名单的 screen:${unexplained.join(', ')} —— 那是门体此刻的读数,与本测试无关也要点名`,
        )
        assert.ok(notMigrated.length > 0, 'HEAD 面里应有 RN 独占屏(一枚都没有 = 白名单那一维无从证明有牙)')
        assert.ok(notMigrated.includes(EXEMPT_BASE), `真屏 ${EXEMPT_BASE} 应在未迁移名单里`)

        // 反事实:从生产白名单抽掉一枚真实豁免名 ⇒ 同一批面必须立刻判出违规
        const stripped = new Set(gate.WHITELIST)
        stripped.delete(EXEMPT_BASE)
        const violations = notMigrated.filter((b) => !stripped.has(b))
        assert.ok(violations.includes(EXEMPT_BASE), '抽掉豁免后仍不判违规 = 白名单是装饰,不是判据')
        assert.ok(violations.length < notMigrated.length, '其余未迁移屏仍应被白名单解释掉(抽一枚不该整族翻红)')

        // [G-1059141 2026-10-07] 死账回潮钉:白名单任何条目都不得落在 HEAD 面"已迁移"集合里。
        // 2026-10-07 清账移出了 13 条此类冗余豁免(DevEnterScreen/SharedDemoScreen/CourseScreen/
        // PlazaScreen/StudyIndexScreen/StudyPublishScreen/CircleIndexScreen/TopicListScreen/
        // ChatToolsScreen/KnowledgeRagScreen/WebViewScreen/ImageGenCreateScreen/PdfToolsScreen,
        // 逐条 import 证据见门体 WHITELIST 处清账注释);再登记已迁移屏 = 白名单重新开始掩盖。
        const migratedNames = new Set(
          HEAD_SCREENS.rels.map((rel) => rel.split('/').pop()).filter((b) => !notMigrated.includes(b)),
        )
        const deadEntries = [...gate.WHITELIST].filter((b) => migratedNames.has(b))
        assert.deepEqual(
          deadEntries,
          [],
          `白名单仍登记着 HEAD 面已迁移(有共享层 import)的 screen:${deadEntries.join(', ')}`,
        )
      } finally {
        rmScratch(scratch, { bestEffort: true })
      }
    },
  )

  it('T4 面切换装车(子进程 + scratch 临时 git 仓):目录不存在空返 / staged screen 读得到 / 非 screen 不污染读数', () => {
    const repo = mkScratch('ihui-rn-app-migration-t4-')
    try {
      const bare = runDriver({ driverDir: repo, cwd: repo })
      assert.equal(bare.rc, 0, `驱动子进程没跑成:${bare.err.slice(0, 200)}`)
      assert.deepEqual(bare.json.listed, [], 'screens 目录不存在时 listScreenFiles 必须空返而不是抛')
      assert.deepEqual(bare.json.staged, [], '非 git 目录里暂存读数应为空(门体 catch 臂)')

      initScratchRepo(repo)
      layFile(repo, MIGRATED_REL, head(MIGRATED_REL))
      const afterInit = runDriver({ driverDir: repo, cwd: repo })
      assert.deepEqual(afterInit.json.listed, [MIGRATED_BASE], `listScreenFiles 应列出铺进去的真屏文件名(只给名不给路径),实得 ${JSON.stringify(afterInit.json.listed)}`)
      assert.deepEqual(afterInit.json.staged, [], 'init 后未暂存 ⇒ 暂存读数必须为空')

      assert.equal(gitRead(['add', '--', MIGRATED_REL], repo).status, 0, '临时仓 add 失败')
      const stagedScreen = runDriver({ driverDir: repo, cwd: repo }).json.staged
      assert.deepEqual(stagedScreen, [MIGRATED_BASE], `staged 一枚 screen 时门体应读到它的文件名,实得 ${JSON.stringify(stagedScreen)}`)

      layFile(repo, OUT_OF_SCOPE_REL, head(OUT_OF_SCOPE_REL))
      assert.equal(gitRead(['add', '--', OUT_OF_SCOPE_REL], repo).status, 0)
      const stagedMixed = runDriver({ driverDir: repo, cwd: repo }).json.staged
      assert.deepEqual(stagedMixed, [MIGRATED_BASE], '再暂存一枚非 screen 路径后读数不得被它污染(扫描范围由门体自己定)')
      assert.equal(runDriver({ driverDir: repo, cwd: repo }).json.whitelistSize, gate.WHITELIST.size, '子进程里读到的白名单规模必须与父进程一致(同一份门体)')
    } finally {
      rmScratch(repo, { bestEffort: true })
    }
  })

  it('T5 CLI 全量档装车:已迁移面 exit 0 / 同一份未迁移内容挂非豁免名 exit 1 并点名 / 该内容挂真实豁免名 exit 0', () => {
    const exemptText = head(EXEMPT_REL)
    const cases = [
      { rel: `${SCREENS_REL}/${MIGRATED_BASE}`, src: head(MIGRATED_REL), expectRc: 0, why: '已迁移 wrapper' },
      { rel: `${SCREENS_REL}/CarteReportScreen.tsx`, src: exemptText, expectRc: 1, why: '未迁移且不在白名单' },
      { rel: `${SCREENS_REL}/${EXEMPT_BASE}`, src: exemptText, expectRc: 0, why: '同一份内容命中真实豁免名' },
    ]
    for (const c of cases) {
      const repo = mkScratch('ihui-rn-app-migration-t5-')
      try {
        layFile(repo, c.rel, c.src)
        const { rc, out } = runCli([], repo)
        assert.equal(rc, c.expectRc, `${c.why}:期望 exit ${c.expectRc},实得 ${rc} / 输出:${out.slice(0, 240)}`)
        if (c.expectRc === 1) {
          assert.ok(out.includes('CarteReportScreen.tsx'), '违规档必须点名那枚 screen')
          assert.ok(out.includes(EXEMPT_BASE) === false || out.includes('白名单'), '白名单清单应随违规一起打印')
        }
      } finally {
        rmScratch(repo, { bestEffort: true })
      }
    }
  })

  it(
    'T6 共享 index 实况档:getStagedScreenFiles 读的是别人此刻暂存的东西(暂存面非空时,这一维此刻不判)',
    { skip: INDEX_PROBE.ok ? false : `能力探测未过:${INDEX_PROBE.reason} —— 跳过不等于通过,也不替他人暂存下结论` },
    () => {
      const driverDir = mkScratch('ihui-rn-app-migration-t6-')
      try {
        const { rc, json, err } = runDriver({ driverDir, cwd: REPO })
        assert.equal(rc, 0, `驱动没跑成:${err.slice(0, 200)}`)
        assert.equal(json.cwd, REPO, '驱动必须工作在真仓工作树上,否则这一维判的就不是本机暂存面')
        assert.deepEqual(json.staged, [], '暂存面为空(探测已量过)时,门体的 screen 暂存读数也必须为空')
      } finally {
        rmScratch(driverDir, { bestEffort: true })
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
