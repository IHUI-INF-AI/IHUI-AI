// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-rn-app-migration.mjs`(mobile-rn screen 迁移守门,guardian 39)。
 *
 * 判据(什么算"已迁移"、什么算屏级共享、白名单怎么算有效/腐烂/到期)一律由门体导出的 `gate`
 * 裁定(AGENTS.md §22c 红线 + 守门 191 `check-test-judge-not-replicated.mjs`)。本文件不重述
 * `@ihui/rn-app` 的匹配式、不重列白名单、不自己算"共享层有没有这个屏",只调用
 * `gate.hasRnAppImport / gate.sharedScreenNames / gate.verdict / gate.isExpired`。
 *
 * 〔G-922 2026-10-21 改判据后同步重写〕门体四处缺陷修完,判据面从"读盘"换成"按面取 blob":
 *  ① ROOT 由 `import.meta.url` 推导 ⇒ **门体永远判真仓**,所以"换仓跑 CLI"这一类用例整体作废,
 *     面切换只能靠真仓的实际两面(HEAD/索引)+ `pickFace` 的两面旗互暗来验;
 *  ② 门体不再读盘 ⇒ 判据输入是**文本**,测试直接用 `catBatch` 取真仓 HEAD 文本喂进去(不铺盘,
 *     铺盘读到的会是并发会话此刻的现场,判出来的绿红与被审内容无关);
 *  ③ 白名单换成带 `why`/`expires` 的 `WHITELIST_ENTRIES`(兼容 Set 形态的 `WHITELIST` 仍在),
 *     新增"到期即失效"与"登记名在被审面不存在 = 腐烂 ⇒ 红"两维;
 *  ④ 新增 V2「屏级共享」维,存量只报数、只拦新增与退化(§0.2 恒红门禁令)。
 *
 * 用例清单:
 *  T1 判据有牙(真仓 HEAD 逐字面):PaymentScreen 判"有共享层 import",AboutScreen 判"没有"
 *     —— 后者是 HEAD 面上天然存在的近邻反例,证明判据不是"内容里出现过 @ihui 包名就算"。
 *  T2 文本变体:删掉那行 import 翻假、逐字恢复翻真;子路径/双引号放行;近邻包名 rn-application 判假。
 *  T3 真仓 HEAD 全量对账(走 gate.verdict):未迁移者必被**有效**白名单解释掉;V2 存量必须非空
 *     (一维都咬不到说明尺子被掏空);腐烂 0(G-922 摘除两枚死账后的存量);抽掉一枚真实豁免
 *     立刻多出红(白名单是判据不是装饰)。
 *  T4 面纪律装车(真仓实跑):两面旗同给 exit 2;`readFace` HEAD 面清单与正文**同面同轮无缺口**;
 *     全量档点名存量那几枚;索引面与 HEAD 面互不冒充。
 *  T5 V2 棘轮(内存构造):新增无同名共享屏 ⇒ 红;基线同形态 ⇒ 只报数不判红;退化 ⇒ 红。
 *  T6 真仓索引实况档:门体的暂存读数是**别的会话此刻 staged 的东西**,暂存面有 screen 就整条跳过
 *     并写明"这一维此刻不判" —— 跳过不等于通过。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g);
 * 临时目录一律 mkScratch/rmScratch(§26 唯一落点);对真仓 git 严格只读(不写 index、不碰 stash)。
 * 本机 Node v22 无 `it.skipIf`,等价形状是 `it(name, { skip: <原因字符串 | false> }, fn)`。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-rn-app-migration.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_CLI = join(REPO, 'scripts', 'check-rn-app-migration.mjs')
const SCREENS_REL = gate.SCREENS_REL
const APP_REL = gate.APP_REL

const MIGRATED_REL = `${SCREENS_REL}/PaymentScreen.tsx`
const EXEMPT_REL = `${SCREENS_REL}/AboutScreen.tsx`
const EXEMPT_BASE = 'AboutScreen.tsx'
const IMPORT_ANCHOR = "import { PaymentScreen as SharedPaymentScreen, type PaymentOrderItem } from '@ihui/rn-app'"

function gitRead(args, cwd = REPO) {
  return spawnSync(gitBinary(), ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 1 << 26,
  })
}

function runCli(args, cwd = REPO) {
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

/** 真仓 HEAD 全量 screen 面(T3 对账用;取不齐就整条不判,绝不回落成自造夹具)。 */
const HEAD_SCREENS = (() => {
  const r = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', SCREENS_REL])
  if (r.status !== 0) return { ok: false, reason: `HEAD screen 清单枚举失败(exit=${r.status})`, rels: [], blobs: null }
  const rels = String(r.stdout || '').split('\n').filter(Boolean).filter((p) => /\.(tsx|ts)$/.test(p))
  const blobs = catBatch(REPO, rels.map((p) => `HEAD:${p}`))
  const bad = rels.filter((p) => typeof blobs.get(`HEAD:${p}`) !== 'string')
  if (bad.length > 0) return { ok: false, reason: `HEAD 面 ${bad.length} 个 screen 取不到,首个:${bad[0]}`, rels, blobs }
  return { ok: true, reason: '', rels, blobs }
})()

/** 共享层同名集合(HEAD 面,与 screens 同轮取材)。 */
const HEAD_SHARED = (() => {
  const r = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', APP_REL])
  if (r.status !== 0) return { ok: false, reason: `packages/app 清单枚举失败(exit=${r.status})`, names: new Set() }
  const rels = String(r.stdout || '').split('\n').filter(Boolean)
  const idx = catBatch(REPO, [`HEAD:${APP_REL}/index.ts`]).get(`HEAD:${APP_REL}/index.ts`) ?? ''
  return { ok: true, reason: '', names: gate.sharedScreenNames({ appFileRels: rels, indexText: idx }) }
})()

/** 加载期同步量出的能力探测(T6):真仓暂存面有 screen ⇒ 结论由别人的暂存决定。 */
const INDEX_PROBE = (() => {
  const r = gitRead(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', SCREENS_REL])
  if (r.status !== 0) return { ok: false, reason: `暂存面枚举失败(git exit=${r.status})` }
  const staged = String(r.stdout || '').split('\n').filter(Boolean)
  return staged.length === 0
    ? { ok: true, reason: '' }
    : { ok: false, reason: `共享 index 此刻暂存着 ${staged.length} 个 screen(首个:${staged[0]}),属他人现场` }
})()

describe('check-rn-app-migration · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 判据有牙(真仓 HEAD 逐字面):已迁移 wrapper 判真,RN 独占屏判假', () => {
    assert.ok(HEAD_SCREENS.ok, `能力探测未过:${HEAD_SCREENS.reason}`)
    const migrated = HEAD_SCREENS.blobs.get(`HEAD:${MIGRATED_REL}`)
    const exempt = HEAD_SCREENS.blobs.get(`HEAD:${EXEMPT_REL}`)
    assert.equal(typeof migrated, 'string', 'HEAD 面取不到 PaymentScreen —— 判不了就点名')
    assert.equal(gate.hasRnAppImport(migrated), true, 'PaymentScreen 在 HEAD 上就是 wrapper,判不出迁移 = 尺子漂开')
    assert.equal(
      gate.hasRnAppImport(exempt),
      false,
      'AboutScreen 的 HEAD 面只 import @ihui/design-tokens,判成已迁移 = 判据退化成包名子串搜索',
    )
    assert.ok(gate.WHITELIST.has(EXEMPT_BASE), '门体白名单里必须确实登记着这枚真屏(否则 T1 的反例只是巧合)')
    assert.ok(
      gate.WHITELIST_ENTRIES.get(EXEMPT_BASE)?.expires,
      '③ 每枚豁免必须带 expires(§0.7 豁免族必须登记存活期)',
    )
  })

  it('T2 文本变体:删 import 翻假、逐字恢复翻真、子路径与双引号放行、近邻包名判假', () => {
    assert.ok(HEAD_SCREENS.ok, `能力探测未过:${HEAD_SCREENS.reason}`)
    const text = HEAD_SCREENS.blobs.get(`HEAD:${MIGRATED_REL}`)
    const lines = text.split('\n')
    const at = lines.findIndex((l) => l === IMPORT_ANCHOR)
    assert.ok(at >= 0, 'HEAD 面里应逐字找到那行共享层 import(找不到 = 面漂开,先怀疑尺子)')
    assert.equal(
      gate.hasRnAppImport(lines.filter((_, i) => i !== at).join('\n')),
      false,
      '删掉共享层 import 后仍判已迁移 = 判据没牙',
    )
    assert.equal(gate.hasRnAppImport(text), true, '逐字恢复后仍判未迁移 = 上一条的红是断言恒真而不是判据生效')
    assert.equal(gate.hasRnAppImport(text.replace("'@ihui/rn-app'", "'@ihui/rn-app/wrapper'")), true, '子路径 import 也算迁移')
    assert.equal(gate.hasRnAppImport(text.replace("from '@ihui/rn-app'", 'from "@ihui/rn-app"')), true, '双引号写法同样算迁移')
    assert.equal(gate.hasRnAppImport(text.replace("'@ihui/rn-app'", "'@ihui/rn-application'")), false, '近邻包名被放过 = 锚点没锚住')
  })

  it(
    'T3 真仓 HEAD 全量对账:未迁移者必被有效白名单解释掉;V2 存量非空;腐烂 0;抽豁免立刻多红',
    { skip: HEAD_SCREENS.ok && HEAD_SHARED.ok ? false : `能力探测未过:${HEAD_SCREENS.reason || HEAD_SHARED.reason}` },
    () => {
      const TODAY = gate.isoToday()
      const screens = HEAD_SCREENS.rels.map((rel) => ({
        name: rel.split('/').pop(),
        text: HEAD_SCREENS.blobs.get(`HEAD:${rel}`),
      }))
      const baseline = new Map(screens.map((s) => [s.name, s.text]))
      const headNames = new Set(screens.map((s) => s.name))
      const v = gate.verdict({
        screens,
        baseline,
        sharedNames: HEAD_SHARED.names,
        baselineSharedNames: HEAD_SHARED.names,
        headScreenNames: headNames,
        whitelist: gate.WHITELIST_ENTRIES,
        today: TODAY,
        fullAudit: true,
      })
      // ① 全量档 V2 只报数 ⇒ violations 里不应出现 V2
      assert.deepEqual(
        v.violations.filter((x) => x.code === 'V2'),
        [],
        `全量档下 V2 存量不得进红集合(§0.2 存量未归零不得升 blocking),实得:${JSON.stringify(v.violations.filter((x) => x.code === 'V2'))}`,
      )
      // ② 每一枚 V1 都必须既无 import 又不在有效白名单里(判据自洽)
      for (const x of v.violations) {
        assert.equal(x.code, 'V1', `全量档只应有 V1 红,实得 ${x.code}`)
        assert.ok(!gate.WHITELIST.has(x.name), `${x.name} 在白名单里却判红 = 到期/腐烂那一维算错`)
      }
      // ③ V2 存量必须非空:一维都咬不到 = 尺子被掏空(④ 那一维等于没装)
      assert.ok(v.soft.length > 0, 'V2 存量为空 = 「有 import 但共享层无同名屏」这一维根本没咬到东西,判据形同虚设')
      // ④ 腐烂 0:G-922 摘除 DebugScreen/SquareScreen 两枚死账后的存量
      assert.deepEqual(v.rot, [], `白名单仍有登记名在 HEAD 面 screens 清单里不存在:${JSON.stringify(v.rot)}`)
      // ⑤ 到期 0(本轮给的存活期都在未来)
      assert.deepEqual(v.expired, [], `白名单仍有已到期条目:${JSON.stringify(v.expired)}`)
      // ⑥ 反事实:抽掉一枚真实豁免 ⇒ 红必须变多(白名单是判据不是装饰)
      const stripped = new Map([...gate.WHITELIST_ENTRIES])
      assert.ok(stripped.delete(EXEMPT_BASE), '门体白名单里应有这枚可抽的真实豁免')
      const v2 = gate.verdict({
        screens,
        baseline,
        sharedNames: HEAD_SHARED.names,
        baselineSharedNames: HEAD_SHARED.names,
        headScreenNames: headNames,
        whitelist: stripped,
        today: TODAY,
        fullAudit: true,
      })
      assert.ok(
        v2.violations.some((x) => x.name === EXEMPT_BASE),
        '抽掉豁免后仍不判违规 = 白名单是装饰,不是判据',
      )
      assert.equal(v2.violations.length, v.violations.length + 1, '抽一枚豁免应恰好多一枚红(不多不少)')
    },
  )

  it('T4 面纪律装车(真仓实跑):两面旗 exit 2 / HEAD 面清单与正文同面同轮无缺口 / 全量档点名存量', () => {
    // ① 两面旗同给 ⇒ 未判定(exit 2),绝不回落任一面
    const both = runCli(['--staged', '--worktree'])
    assert.equal(both.rc, 2, `两面旗同给应 exit 2 未判定,实得 ${both.rc} / ${both.out.slice(0, 200)}`)
    assert.ok(/未判定/.test(both.out), '未判定必须在输出里点名原因(§0.3)')
    // ② 单旗判面成立
    assert.equal(gate.pickFace(true, false).face, 'staged')
    assert.equal(gate.pickFace(false, true).face, 'worktree')
    assert.equal(gate.pickFace(false, false).face, 'head')
    // ③ HEAD 面取材:清单与正文同面同轮,一个都不许缺
    const face = gate.readFace('head', SCREENS_REL)
    assert.ok(face.rels.length > 0, 'HEAD 面 screens 清单为空 = 取材层根本没取到(不是"没有 screen")')
    assert.equal(
      face.texts.size,
      face.rels.length,
      `清单 ${face.rels.length} 条而正文只取到 ${face.texts.size} 条 ⇒ 清单与正文不同面/不同轮(守门 118)`,
    )
    // ④ 空目录面 ⇒ 空返而不是抛
    assert.deepEqual(gate.readFace('head', 'no/such/dir').rels, [], '不存在的目录面应空返')
    // ⑤ 全量档 CLI 装车:存量那几枚必须被点名(证明取材面确实是 HEAD 而不是别的面)
    const full = runCli([])
    assert.ok([0, 1].includes(full.rc), `全量档退出码应为 0/1,实得 ${full.rc}`)
    assert.ok(/HEAD blob 面|HEAD blob面/.test(full.out), `全量档必须点名判定面是 HEAD blob,实得:${full.out.slice(0, 200)}`)
    // ⑥ 自检装车
    assert.equal(runCli(['--self-test']).rc, 0, '门体自检必须全过(判据自身有牙)')
  })

  it('T5 V2 棘轮(内存构造):新增 ⇒ 红 / 基线同形态 ⇒ 只报数 / 退化 ⇒ 红', () => {
    const T = '2026-10-21'
    const wl = new Map()
    const head = new Set(['PaymentScreen.tsx', 'OldScreen.tsx'])
    const shared = new Set(['PaymentScreen'])
    const base = { headScreenNames: head, whitelist: wl, today: T }
    const added = gate.verdict({
      ...base,
      screens: [{ name: 'BrandNewScreen.tsx', text: "import { X } from '@ihui/rn-app'" }],
      baseline: new Map(),
      sharedNames: shared,
      baselineSharedNames: shared,
    })
    assert.equal(added.violations.length, 1, '新增 screen 未走屏级共享必须红(只拦新增这一型)')

    const stock = gate.verdict({
      ...base,
      screens: [{ name: 'OldScreen.tsx', text: "import { X } from '@ihui/rn-app'" }],
      baseline: new Map([['OldScreen.tsx', "import { X } from '@ihui/rn-app'"]]),
      sharedNames: shared,
      baselineSharedNames: shared,
    })
    assert.equal(stock.violations.length, 0, '基线同形态存量不得判红(§0.2)')
    assert.equal(stock.soft.length, 1, '基线同形态存量应进报数而不是被静默吞掉')

    const regressed = gate.verdict({
      ...base,
      screens: [{ name: 'PaymentScreen.tsx', text: "import { Q } from '@ihui/rn-app'" }],
      baseline: new Map([['PaymentScreen.tsx', "import { PaymentScreen } from '@ihui/rn-app'"]]),
      sharedNames: new Set(),
      baselineSharedNames: shared,
    })
    assert.equal(regressed.violations.length, 1, '基线有共享屏而被审面弄丢 ⇒ 必须红(棘轮只放过存量,不放过退化)')

    // 反证:判据被掏空(恒绿)必须咬不住正例
    const hollow = gate.verdict({
      ...base,
      screens: [{ name: 'AnyScreen.tsx', text: 'no import at all' }],
      baseline: new Map(),
      sharedNames: new Set(),
      baselineSharedNames: new Set(),
    })
    assert.equal(hollow.violations.length, 1, 'V1 必须有牙:无 import 无豁免却判绿 = 判据被掏空')
  })

  it(
    'T6 真仓索引实况档:暂存面的 screen 读数是别人此刻 staged 的东西(暂存面非空则这一维不判)',
    { skip: INDEX_PROBE.ok ? false : `能力探测未过:${INDEX_PROBE.reason} —— 跳过不等于通过,也不替他人暂存下结论` },
    () => {
      const staged = gate.readFace('staged', SCREENS_REL, { changedOnly: true })
      assert.deepEqual(staged.rels, [], '暂存面为空(探测已量过)时,门体的 screen 暂存读数也必须为空')
      const r = runCli(['--staged'])
      assert.equal(r.rc, 0, `暂存面无 screen 时应 exit 0,实得 ${r.rc} / ${r.out.slice(0, 200)}`)
      assert.ok(/索引 blob 面|索引 blob面/.test(r.out), 'staged 档必须点名判定面是索引 blob(面纪律不是修辞)')
    },
  )
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
