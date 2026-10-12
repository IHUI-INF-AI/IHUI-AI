// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端 UI 一致性尺子的自检/fixture 段 —— 从 check-cross-end-ui-parity.mjs 原样拆出(判据一行不动)。
// 主文件不 import 本件;--self-test 时由主文件 dispatch 动态 await import() 加载,免循环引用。
// 源码级装车锁读的是**主文件**源码:统一经 MAIN_SOURCE_PATH 取,不再用 import.meta.url(那会指到本件)。
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitBinary, Undetermined } from './face-reader.mjs'
import { mkScratch, rmScratch } from './scratch-dir.mjs'
import { radiusEntriesOf, radiusLookup, radiusSetOf } from './radius-tokens.mjs'
import {
  WEB_LEDGER,
  anchorRegression,
  audit,
  clauseDemand,
  collect,
  diffValues,
  elementRadiusCount,
  elementRadiusDiff,
  emitBaseline,
  faceFromArgv,
  geometryDeclCheck,
  iconAudit,
  iconGlyphs,
  namedConflicts,
  parseBaseline,
  parseModuleEdges,
  pickCandidate,
  radiusCount,
  readGeometry,
  readTaroPages,
  rejectLegs,
  rejectProblem,
  resolveRel,
  rootSlotAudit,
  rootSlotRadiiOf,
  scan,
  specLegAudit,
  specTiers,
  stripComments,
  unresolvedClassNames,
  usedClassNames,
  verdictOf,
  waiverProblem,
  webRadiusAudit,
} from '../check-cross-end-ui-parity.mjs'

// 装车锁的被读对象:上一级的主文件本体。
const MAIN_SOURCE_PATH = fileURLToPath(new URL('../check-cross-end-ui-parity.mjs', import.meta.url))
/**
 * 可达性判据的成对夹具:一座最小**真** git 仓(判据全程按 git 面取数,夹具不入库就测不到)。
 * 两端各一枚同名 `Foo`;RN 那枚**只被桶文件再导出** —— `packages/app/src/components/index.ts`
 * 带着它,而桶从 `@ihui/rn-app` 只被要求提供 `Bar`。这正是 NavBar / UserInfoCard 在真仓的形态。
 * `rn` 改的就是"导航器到底 import 哪些名字"这一处 ⇒ 传 `{Bar}` 必剔、传 `{Bar,Foo}` 必留,
 * 两条用例互为可逆对照(只有恒红或恒绿两种坏实现会同时错过它们)。
 */
function FIXTURE_BASE({ rn }) {
  return {
    'apps/miniapp-taro/src/app.tsx': 'export default function App() { return null }\n',
    'apps/miniapp-taro/src/app.config.ts':
      "export default defineAppConfig({ pages: ['pages/index/index'] })\n",
    'apps/miniapp-taro/src/pages/index/index.tsx':
      "import { Foo } from '@/components'\nexport default function P() { return <Foo /> }\n",
    'apps/miniapp-taro/src/components/index.ts': "export { Foo } from './Foo'\n",
    'apps/miniapp-taro/src/components/Foo.tsx':
      'export function Foo() { return <div className="w-[72rpx]" /> }\n',
    'apps/mobile-rn/App.tsx':
      "import { RootNavigator } from './src/navigation/RootNavigator'\nexport default function App() { return <RootNavigator /> }\n",
    'apps/mobile-rn/src/navigation/RootNavigator.tsx': `${rn}\n`,
    'packages/app/package.json': '{"name":"@ihui/rn-app","main":"./src/index.ts"}\n',
    'packages/app/src/index.ts': "export { Bar, Foo } from './components'\n",
    'packages/app/src/components/index.ts':
      "export { Bar } from './Bar'\nexport { Foo } from './Foo'\n",
    'packages/app/src/components/Bar.tsx': 'export function Bar() { return null }\n',
    'packages/app/src/components/Foo.tsx':
      'export function Foo() { return <div style={{ width: 36 }} /> }\n',
    // 具名档表与组件同面取,夹具必须自带一份 spec —— 否则 collect() 按"判据失明"判死,
    // 这一组用例红的原因就不是判据,而是夹具缺件。
    'packages/shared/src/ui/foo-spec.ts': 'export const FOO_BOX_PX = 24\n',
  }
}

/**
 * 档位表夹具(逐条目一行 —— objectEntries 按行取条目,单行对象会解析为 null,见 KW 注)。
 * web 腿用例(㉗b/㉗c)的组件用了 `rounded-md` ⇒ 圆角维要求表在面,缺件会让红的原因错位。
 */
function radiusFixtureTable() {
  return [
    'export const RADIUS_STEPS = {',
    '  xs: 2,',
    '  md: 6,',
    '  lg: 8,',
    '  xl: 12,',
    "  '2xl': 16,",
    '}',
    '',
  ].join('\n')
}

/** 造夹具仓:写文件 → init → add → commit(--no-verify + 自带身份,不碰任何全局钩子)。 */
function makeFixtureRepo(files) {
  const dir = mkScratch('ui-parity-')
  const run = (args) =>
    execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  run(['init', '-q'])
  run(['add', '-A'])
  run([
    '-c',
    'user.email=self-test@local',
    '-c',
    'user.name=self-test',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    'fixture',
  ])
  return dir
}

export function runSelfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, note) => {
    if (cond === true) pass++
    else fail++
    console.log(
      `  ${cond === true ? 'ok  ' : 'FAIL'} ${name}${cond === true ? '' : ` —— 实得:${String(cond)}${note ? ` (${note})` : ''}`}`,
    )
  }
  t(
    'S1 注释里的数字不得被当成几何档',
    readGeometry('// BOX = 99\nconst a = 1\n', 'rn').values.size === 0,
  )
  t(
    'S2 字符串里的块注释开闭序列不得吞掉后续判据',
    stripComments('const s="/*"\nconst BOX=8\n').includes('BOX'),
  )
  t(
    'S3 72rpx 与 36px 归一到同一档(单位不是差异)',
    readGeometry('w-[72rpx]', 'miniapp').values.has(36) &&
      readGeometry('w-[36px]', 'rn').values.has(36),
  )
  t(
    'S4 同名常量两侧不同值必须点名(阳性对照)',
    namedConflicts({ ICON: 20 }, { ICON: 22 }).length === 1,
  )
  t(
    'S5 同名常量两侧同值不得点名(反向对照)',
    namedConflicts({ ICON: 22 }, { ICON: 22 }).length === 0,
  )
  t(
    'S6 非几何键(字重/时长/index)不计入',
    readGeometry('fontWeight: 700\nduration: 300\nrowIndex = 3\n', 'rn').values.size === 0,
  )
  t(
    'S7 配对认 .jsx 与 .tsx 同判(门不得对自己产出的形态失明)',
    scan(['a/Back.jsx'], ['b/Back.tsx']).pairs.length === 1,
  )
  t('S8 两端清单为空 ⇒ 判死而非记绿(空扫不通过)', scan([], []).undetermined === true)
  t('S9 豁免缺理由仍算红', waiverProblem({ until: '2027-01-01' }) !== null)
  t(
    'S10 豁免带理由才算 waived',
    waiverProblem({ reason: '平台 chrome:原生导航栏不参与 CSS' }) === null,
  )
  t(
    'S11 棘轮:不超锚点绿 / 超过锚点红(成对)',
    (() => {
      const f = {
        name: 'X',
        named: [],
        geometry: { onlyMiniapp: [1, 2], onlyRn: [] },
        waived: false,
      }
      return (
        verdictOf([f], { counts: { X: 2 } }).red.length === 0 &&
        verdictOf([f], { counts: { X: 1 } }).red.length === 1
      )
    })(),
  )
  t(
    'S12 台账缺该组件 ⇒ 锚点 0,新配对的任何差异直接红',
    verdictOf(
      [{ name: 'New', named: [], geometry: { onlyMiniapp: [8], onlyRn: [] }, waived: false }],
      {},
    ).red.length === 1,
  )
  t(
    'S13 变好了只提示下调,不自动改账',
    verdictOf(
      [{ name: 'X', named: [], geometry: { onlyMiniapp: [1], onlyRn: [] }, waived: false }],
      {
        counts: { X: 5 },
      },
    ).shrunk.length === 1,
  )
  t(
    'S14 audit 端到端:同档绿 / 差一档红',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[36px]\n' }, {})
      const diff = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[44px]\n' }, {})
      return same.red.length === 0 && diff.red.length === 1
    })(),
  )
  t(
    'S15 两面旗同给 ⇒ 判死',
    (() => {
      try {
        faceFromArgv(['--staged', '--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S16 工作树档被拒(本门拒绝按磁盘判,防错数写回台账)',
    (() => {
      try {
        faceFromArgv(['--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S17 圆角不进几何档集合(它有独立的 RD 维与独立锚点,混计会让同一处双计)',
    readGeometry('rounded-[99px]\nborderRadius: 99\n', 'rn').values.size === 0,
  )
  /**
   * S18–S20 是 RD 维的**成对正反例**。它们存在的理由:本门立项时圆角被整族排除,而注释把
   * 这一 exclusion 说成"守门 77 会管"—— 前提不成立(77 判值的源头,不判同一元素跨端取档),
   * 于是这一型缺陷一路报绿直到用户实拍。只加判据不加"判据有牙"的正反例,下次换个写法它照样瞎。
   */
  t(
    'S18 RD 维:同一档两种写法(类名 vs rnRadius 标识符)必须判同值,不得造出假分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'className="rounded-lg"\n' }, {}, {}, tbl)
      const same2 = audit(
        { pairs: p.pairs },
        {
          'a/Foo.tsx': 'className="rounded-lg"\n',
          'b/Foo.tsx': 'borderRadius: rnRadius.lg,\n',
        },
        {},
        {},
        tbl,
      )
      const off = audit(
        { pairs: p.pairs },
        {
          'a/Foo.tsx': 'className="rounded-lg"\n',
          'b/Foo.tsx': 'borderRadius: rnRadius.xl,\n',
        },
        {},
        {},
        tbl,
      )
      return (
        radiusCount(off.findings[0]) === 2 &&
        off.red.length === 1 &&
        off.red[0].over.join('').includes('圆角') &&
        same2.findings.length === 0 &&
        (same.findings.length === 0 || radiusCount(same.findings[0]) === 0)
      )
    })(),
  )
  /**
   * S19 的规格在 2026-09-29 被 O81 票㊵ 整个反过来:那一族标记的**放行**语义已废除(项目定档
   * 「不允许任何豁免」,判红住在守门 77、报名住在守门 150),本门因此必须**不认这个标记**。
   * 照抄旧断言"带标记不得造出分叉",等于把一条已废除的出口重新装回判据。
   * 有牙证明仍成对给:带标记与不带标记必须**同判**(标记不改变任何结论),而这一对必须真计上
   * 档差 —— 否则"不放行"与"判据失明"在账面上长得一模一样。
   */
  t(
    'S19 RD 维:radius-exempt 不构成放行(该族放行语义已由 O81 票㊵ 整体废除)⇒ 带标记与不带标记必须同判、且都判红',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const withMark = audit(
        p,
        {
          // 指令形态"族名+冒号"由 lib/radius-exempt-marker.mjs 的 RE 识别,门 77 判原文行、
          // 对新文件无棘轮基线 ⇒ fixture 不得再造该形态(判据不吃自己的说明文字同源)。
          // 该族放行已废除,audit 对此串本就零识别,S19 的牙在档差判红与两分支同判,不依赖指令形态。
          'a/Foo.tsx': 'borderRadius: 8, // radius-exempt 标记(该族已废除,非出口): 选中圆点\n',
          'b/Foo.tsx': 'borderRadius: 20, // radius-exempt 标记(该族已废除,非出口): 头像正圆\n',
        },
        {},
        {},
        tbl,
      )
      // 反向对照:把标记去掉,同一对必须判红 —— 否则"豁免生效"与"判据失明"长得一模一样
      const noMark = audit(
        p,
        {
          'a/Foo.tsx': 'borderRadius: 8,\n',
          'b/Foo.tsx': 'borderRadius: 20,\n',
        },
        {},
        {},
        tbl,
      )
      const shape = (r) => JSON.stringify((r.findings ?? []).map((f) => [f.name, f.radius]))
      return (
        shape(withMark) === shape(noMark) &&
        withMark.findings.length === 1 &&
        withMark.red.length === 1 &&
        noMark.red.length === 1
      )
    })(),
  )
  t(
    'S20 RD 维:档位表解析不出来 ⇒ radiusLookup 返回 null(collect 据此判失明,不得当成"两端同档")',
    radiusLookup !== undefined && radiusLookup('export const NOTHING = {}') === null,
  )
  /**
   * S21 锚点分家的**全部价值**就在这条:合成一个数时,"改坏一处圆角 + 修好一处几何"净零 ⇒ 逃逸。
   * 分家后同一笔改动必须仍被圆角维钉红。正反两例成对给,否则这条断言只是在对实现复述。
   */
  t(
    'S21 RD 锚点独立:几何下调不得替圆角上升顶掉名额(净零逃逸必须仍判红)',
    (() => {
      const f = {
        name: 'Foo',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [8], onlyRn: [12] },
      }
      // 台账钉:几何 5(现降到 0)、圆角 0(现升到 2)—— 总数 2 < 5,合成一维就绿了
      const v = verdictOf([f], { counts: { Foo: 5 }, radiusCounts: { Foo: 0 } })
      const okRed = v.red.length === 1 && v.red[0].over.join('').includes('圆角')
      // 反向对照:圆角存量本来就钉在 2 时不得判红(存量不是新账)
      const okStock =
        verdictOf([f], { counts: { Foo: 5 }, radiusCounts: { Foo: 2 } }).red.length === 0
      return okRed && okStock
    })(),
  )
  /**
   * RE 维的成对正反例。存在的理由是一条实测读数:真仓 HEAD 上 RD 报了 10 对"圆角跨端不同档",
   * 而按元素名配对去查,**一对都不成立** —— `NavBar` 的「仅小程序 4」对面那一侧根本没有圆角声明,
   * `VideoPlayer` 的「仅 RN 8」小程序侧同理。集合之差把"对面没写"说成"两端不一样",
   * 照着它补数字就制造视觉回归。下面 ①–④ 钉的是 RE 只能按**同名元素**产出结论。
   */
  t(
    '㊵ RE①:同名元素两端同档(两种书写语言)必须判绿,不得因写法不同造出分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      // 小程序侧走 CSS 类、RN 侧走 StyleSheet 键 —— 同名 `card` 都是 lg(8)
      const r = audit(
        p,
        {
          'a/Foo.tsx': '.card {\n  border-radius: var(--radius-lg);\n}\n',
          'b/Foo.tsx': 'const s = {\n  card: {\n    borderRadius: rnRadius.lg,\n  },\n}\n',
        },
        {},
        {},
        tbl,
      )
      const f = r.findings[0]
      return (
        r.red.length === 0 &&
        (!f || f.elementRadius.mismatched.length === 0) &&
        elementRadiusCount(f ?? { elementRadius: { mismatched: [] } }) === 0
      )
    })(),
  )
  t(
    '㊶ RE②:同名元素两端差一档必须判红,且红要能单独归因到 RE 这一维(锚点缺省 0 ⇒ 新增直接问责)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const src = (mpPx, rnStep) => ({
        'a/Foo.tsx': `.card {\n  border-radius: ${mpPx};\n}\n`,
        'b/Foo.tsx': `const s = {\n  card: {\n    borderRadius: rnRadius.${rnStep},\n  },\n}\n`,
      })
      const r = audit(p, src('8px', 'xl'), {}, {}, tbl)
      const f = r.findings[0]
      return (
        r.red.length === 1 &&
        elementRadiusCount(f) === 1 &&
        f.elementRadius.mismatched[0].name === 'card' &&
        String(f.elementRadius.mismatched[0].miniapp) === '8' &&
        String(f.elementRadius.mismatched[0].rn) === '12' &&
        r.red[0].over.join('').includes('同名元素圆角 1 > 锚点 0') &&
        // 反向对照:三维各自钉在存量上时不得判红(存量不是新账)
        audit(
          p,
          src('8px', 'xl'),
          { counts: { Foo: 2 }, radiusCounts: { Foo: 2 }, elementRadiusCounts: { Foo: 1 } },
          {},
          tbl,
        ).red.length === 0
      )
    })(),
  )
  /**
   * ㊷ 是这一票的**核心对照**:同一份输入,RE 判"无从配对"并报名字,RD 判"跨端不同档"。
   * 两侧从未同名 ⇒ 不存在"同一个元素长得不一样"这件事;而集合之差照样产出读数。
   * 断言若写成"findings 为空"就是在骗自己 —— RD 仍然会推一条,那正是它一直在产的假信号。
   */
  t(
    '㊷ RE③:一侧有名字、另一侧没有 ⇒ RE 不计红但逐条报名(同输入下 RD 仍报分叉 = 假信号来源)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const r = audit(
        p,
        {
          // 小程序侧只写 utility 串:没有元素名可归 ⇒ 不得与 RN 的 `card` 配对
          'a/Foo.tsx': '<View className="rounded-lg" />\n',
          'b/Foo.tsx': 'const s = {\n  card: {\n    borderRadius: rnRadius.xl,\n  },\n}\n',
        },
        {},
        {},
        tbl,
      )
      const u = r.radiusUnpaired[0]
      const f = r.findings[0]
      return (
        // RE 这一维:零分叉
        elementRadiusCount(f) === 0 &&
        !r.red[0].over.join('').includes('同名元素圆角') &&
        // RD 这一维:照样报出"两端不同档" —— 这就是 NavBar / VideoPlayer 那两条读数的成因
        radiusCount(f) === 2 &&
        r.red[0].over.join('').includes('圆角 2 > 锚点 0') &&
        // 而报名字让这一格变得可处置:对面根本没起元素名,该修的是命名而不是数字
        u?.name === 'Foo' &&
        u.onlyRn.join() === 'card' &&
        u.onlyMiniapp.join() === '' &&
        u.unnamed.miniapp === 1
      )
    })(),
  )
  t(
    '㊸ RE④:注释里的档不得计入、同一形态写进代码必须计入(成对,否则不知哪边在说谎)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // 注释里写着 rounded-xl(12)而代码取 lg(8):计入就会与 RN 的 lg 造出一档假分叉
      const commentIgnored = radiusEntriesOf(
        '.card {\n  // 原写 rounded-xl,现按规范收口到 lg\n  border-radius: var(--radius-lg);\n}\n',
        tbl,
      )
      // 反向对照:同一形态从注释搬进代码(utility 串 + 本文件真定义过的类名)必须被读到
      const codeCounted = radiusEntriesOf(
        '.card {\n  padding: 2px;\n}\n<View className="card rounded-xl" />',
        tbl,
      )
      // 整块被注释掉的规则:类名与档都不能进射程(凭空多出一个"具名元素"就是凭空多一对可红)
      const commentedRule = radiusEntriesOf(
        '/* .ghost {\n  border-radius: var(--radius-2xl);\n} */\n',
        tbl,
      )
      return (
        String(commentIgnored.entries.card) === '8' &&
        String(codeCounted.entries.card) === '12' &&
        Object.keys(commentedRule.entries).length === 0 &&
        commentedRule.unnamed === 0
      )
    })(),
  )
  t(
    '㊹ RE 锚点第三家:RD 下调不得替 RE 上升顶掉名额(三维合一就是净零逃逸的入口)',
    (() => {
      const f = {
        name: 'Foo',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
        elementRadius: { mismatched: [{ name: 'card', miniapp: [8], rn: [12] }] },
      }
      const v = verdictOf([f], {
        counts: { Foo: 4 },
        radiusCounts: { Foo: 3 },
        elementRadiusCounts: { Foo: 0 },
      })
      return (
        v.red.length === 1 &&
        v.red[0].over.join('').includes('同名元素圆角 1 > 锚点 0') &&
        verdictOf([f], {
          counts: { Foo: 4 },
          radiusCounts: { Foo: 3 },
          elementRadiusCounts: { Foo: 1 },
        }).red.length === 0
      )
    })(),
  )
  t(
    '㊺ 重出台账必须拒绝"任一既有锚点上升或消失",只允许下降(覆盖面一放宽就是一次无声放松)',
    (() => {
      const prior = {
        counts: { A: 2 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      }
      const rose = anchorRegression(prior, {
        counts: { A: 3 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      })
      const gone = anchorRegression(prior, { counts: {}, radiusCounts: { A: 1 } })
      const fell = anchorRegression(prior, {
        counts: { A: 1 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      // 新组件首次入账(锚点从缺省 0 起)不算上升 —— 否则任何新增配对都堵住重锚
      const fresh = anchorRegression(prior, {
        counts: { A: 2 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0, B: 0 },
      })
      // 两把锚点同时缺键(counts 与 elementRadiusCounts),radiusCounts 那维仍在 ⇒ 恰 2 条
      return (
        rose.length === 1 &&
        rose[0].includes('counts.A') &&
        gone.length === 2 &&
        gone.every((x) => x.includes('整键消失')) &&
        fell.length === 0 &&
        fresh.length === 0
      )
    })(),
  )
  /**
   * S22 是票"排除几何档"的**成对正反例**(Step 5 要求的"匹配对"):同一份夹具,只在第二腿多一处取用 ——
   *  - NEG:那一处是 `width: 20, height: 20, borderRadius: 10`(边长的一半 = 真圆,§4 规定的写法)
   *        ⇒ RD 维**不得**把它当成端上多出来的一档;否则门 77 认定为"规范真圆"的每一处都会在这一维
   *          凭空记一笔,而另一端根本没有对应元素 ⇒ 假分叉(实测 UserInfoCard 头像 24、ModelList check 10)。
   *  - POS:把它换成 `rnRadius.xl`(12, 同值档位但**是档位取用**)⇒ 必须**仍判红**,
   *        且红在 RD 这一维(over 含"圆角")。
   * 两条一红一绿才算"排除的是形状、没顺手把维度改瞎"。只留 NEG 就是替"判据失明"发合格证。
   */
  t(
    'S22 RD 成对:co-located size/2 真圆不得计入档集(NEG 圆角 0 档、无圆角红),换成同位 rnRadius.xl 档必须仍红(POS)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      // 两腿都有 card=lg(8);差异只在第二腿那"一处"的写法(同 20×20 盒)。
      const aBase = 'card: { borderRadius: rnRadius.lg },\n'
      const neg = audit(
        p,
        {
          'a/Foo.tsx': aBase,
          'b/Foo.tsx': aBase + 'dot: { width: 20, height: 20, borderRadius: 10 },\n',
        },
        {},
        {},
        tbl,
      )
      const pos = audit(
        p,
        {
          'a/Foo.tsx': aBase,
          'b/Foo.tsx': aBase + 'chip: { width: 20, height: 20, borderRadius: rnRadius.xl },\n',
        },
        {},
        {},
        tbl,
      )
      const overMentions = (v, kw) => v.red.some((r) => (r.over || []).join('').includes(kw))
      return (
        // NEG:圆角被排除 ⇒ 圆角一维 0 档、无"圆角"红(几何那处 20×20 仍成 finding 是另一维,不冲突)
        radiusCount(neg.findings[0]) === 0 &&
        !overMentions(neg, '圆角') &&
        // POS:同位真档 ⇒ 圆角计 1 处差且红在圆角维
        radiusCount(pos.findings[0]) === 1 &&
        overMentions(pos, '圆角')
      )
    })(),
  )
  /**
   * S23 是 anchorRegression 豁免短路的**成套正反例**(缩小假阳,不动真保护):
   *  - 未豁免族上升 ⇒ 必拒(与改动前逐字同形;这条是本核对存在的全部理由,绝不能被豁免短路连带放宽)。
   *  - 带**有效**豁免(prior.waivers 里理由足 6 字)的族上升 ⇒ 放行(它在 verdictOf 里本就 continue,
   *    锚点是惰性记账)。
   *  - 理由不足(waiverProblem 非空)的"豁免" ⇒ 不短路 ⇒ 仍拒 —— 否则填个空理由就能给放松开门。
   *  - 同族的**下降**在未豁免时也照旧放行(单调性只拦上升/消失)。
   */
  t(
    'S23 anchorRegression 豁免短路只缩假阳:未豁免上升必拒、有效豁免上升放行、空理由豁免仍拒、下降恒放行',
    (() => {
      const priorW = {
        counts: { A: 1 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
        waivers: { A: { reason: '两端不是同一套子元素', until: '2027-01-01' } },
      }
      // A 已带有效豁免 ⇒ counts/radiusCounts 两维上升都应放行(elementRadius 持平本就不拦)
      const rose2 = { counts: { A: 5 }, radiusCounts: { A: 4 }, elementRadiusCounts: { A: 0 } }
      const waivedRose = anchorRegression(priorW, rose2)
      // 把豁免理由改成不足 6 字 ⇒ 短路失效 ⇒ 两条上升全部回来(与未豁免同形)
      const badWaiver = {
        ...priorW,
        waivers: { A: { reason: '短', until: '2027-01-01' } },
      }
      const badRose = anchorRegression(badWaiver, rose2)
      // 完全没有 waivers 字段(未豁免)⇒ 与旧行为逐字一致,两条上升都拒
      const noWaiver = {
        counts: { A: 1 },
        radiusCounts: { A: 1 },
        elementRadiusCounts: { A: 0 },
      }
      const rose = anchorRegression(noWaiver, rose2)
      // 有效豁免族的**下降**也放行(单调性只拦上升/消失,这里本就是下降)
      const fell = anchorRegression(priorW, {
        counts: { A: 0 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      // 未豁免族的**下降**恒放行(保护不变:下降不是放松)
      const fellUnwaived = anchorRegression(noWaiver, {
        counts: { A: 0 },
        radiusCounts: { A: 0 },
        elementRadiusCounts: { A: 0 },
      })
      return (
        waivedRose.length === 0 &&
        badRose.length === 2 &&
        badRose.every((x) => x.includes('上升')) &&
        rose.length === 2 &&
        fell.length === 0 &&
        fellUnwaived.length === 0
      )
    })(),
  )
  t(
    '㊼ 方向与角形态必须与整格形态同判 —— 漏读一侧不表现为"少几个数",表现为凭空造出跨端分叉',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // 小程序底部弹层的写法(只圆上两角)
      const side = radiusSetOf('<View className="relative bg-card rounded-t-2xl" />', tbl)
      const corner = radiusSetOf('<View className="bg-cta rounded-tr-sm" />', tbl)
      // 整格形态不得被新的可选前缀打坏(反向对照:同一档、不同写法 ⇒ 集合必须仍等值)
      const whole = radiusSetOf('<View className="rounded-2xl" />', tbl)
      const rnSide = radiusSetOf('style={{ borderRadius: rnRadius["2xl"] }}', tbl)
      // rounded-full 属守门 11 的胶囊那一型,不得被这一维计成"取了某档"
      const full = radiusSetOf('<View className="rounded-full" />', tbl)
      return (
        side.join(',') === '16' &&
        corner.join(',') === '4' &&
        whole.join(',') === '16' &&
        rnSide.join(',') === '16' &&
        diffValues(new Set(side), new Set(rnSide)).onlyMiniapp.length === 0 &&
        diffValues(new Set(side), new Set(rnSide)).onlyRn.length === 0 &&
        full.length === 0
      )
    })(),
  )
  t(
    'RD 遮噪必须与 RE 同一条口径 —— 注释散文里的档位不得算进档集(真仓 LoginPopUp 的假分叉就是这么造出来的)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // ① 行尾注释:同一行代码取 sm(4),注释里提 rounded-md(6) 不得被记上
      const trailing = radiusSetOf(
        '  pill: { borderRadius: rnRadius.sm, // 旧写法 rounded-md,现取 control 档\n}',
        tbl,
      )
      // ② 跨行块注释的**续行**:旧实现只跳"以 /* 或 * 开头的整行",续行里的档会漏进来
      const block = radiusSetOf(
        '<View\n  {/* 弹窗主体 = panel 档\n      旧写法在这里挂 rounded-md 并按 bubble 档取 rounded-2xl */}\n  className="rounded-xl" />',
        tbl,
      )
      // ③ 阳性对照:同一个 6 写在真代码里必须被记上(遮罩关掉的是误报,不是判据)
      const real = radiusSetOf('<View className="rounded-md" />', tbl)
      return (
        trailing.join(',') === '4' &&
        block.join(',') === '12' &&
        real.join(',') === '6' &&
        // 反向锁:把注释里的 6 算进去就是这一型的病灶,读数必须与"真取 6"不同形
        trailing.join(',') !== real.join(',')
      )
    })(),
  )
  t(
    'RE 配对键:BEM 结构分隔符可折(证据),缩写前缀不可折(猜测);折叠撞车时必须**不配对**而不是并档',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const mp = radiusEntriesOf(
        [
          '.cb__item { border-radius: 12rpx }',
          '.cb__free-badge { border-radius: 16rpx }',
          '.cb__panel--active { border-radius: 8rpx }',
          '.mcd-upload-btn { border-radius: 8rpx }',
        ].join('\n'),
        tbl,
      ).entries
      const rn = radiusEntriesOf(
        [
          'const s = {',
          '  item: { borderRadius: rnRadius.xl },',
          '  freeBadge: { borderRadius: rnRadius.lg },',
          '  panel: { borderRadius: rnRadius.md },',
          '  uploadBtn: { borderRadius: rnRadius.lg },',
          '}',
        ].join('\n'),
        tbl,
      ).entries
      const d = elementRadiusDiff(mp, rn)
      // 名可以是字符串(单侧名单)或 {name,…}(分叉记录)—— 判据取名字那一层,
      // 否则 `/x/.test({...})` 会把对象强转成 "[object Object]",四条子断言全部**永不命中**
      // 而账面看起来"跑过了"(§22c:恒绿断言与恒红断言同样没用)。
      const namesOf = (list) => (list || []).map((x) => (typeof x === 'string' ? x : x.name))
      const has = (list, re) => namesOf(list).some((n) => re.test(n))
      // ① BEM `__` 是命名法规定的元素分隔符:cb__item ↔ item 必须配上,且真分叉要被抓到
      const paired = has(d.mismatched, /^cb__item\|item$/) && d.mismatched.length >= 1
      // ② 大小写 + 连字符折叠:`free-badge` ↔ `freeBadge` 同值 ⇒ 既不进 mismatched 也不进单侧名单
      const folded =
        !has(d.mismatched, /freebadge|free-badge/i) &&
        !has(d.onlyMiniapp, /free-badge/) &&
        !has(d.onlyRn, /freeBadge/)
      // ③ 修饰符不参与身份:panel--active ↔ panel 必须配上(md=6 vs lg=8 ⇒ 应报分叉)
      const modifier = has(d.mismatched, /panel/)
      // ④ 缩写前缀**不折**(票面明令:那是猜测)⇒ 两边都只能算单侧元素
      const notGuessed = has(d.onlyMiniapp, /mcd-upload-btn/) && has(d.onlyRn, /uploadBtn/)
      // ⑤ 反向锁:同一侧两个原始名折叠到同一身份时**不得配对**(并档会造"同值"假绿灯)
      const collide = elementRadiusDiff({ a__card: [8], b__card: [12] }, { card: [8] })
      const guarded =
        collide.mismatched.length === 0 &&
        collide.onlyRn.includes('card') &&
        collide.ambiguous.includes('card')
      return paired && folded && modifier && notGuessed && guarded
    })(),
  )
  t(
    '(函数在、自检过,而 audit 没调 = 提交链上一路绿灯,本仓最高频失效型)',
    (() => {
      const body = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const a = body.slice(
        body.indexOf('export function audit('),
        body.indexOf('export function verdictOf('),
      )
      // 判据写在别处不等于没装车,但写在别处的这一维就再也回不到 audit —— 本锁要求它必须在。
      return (
        /radiusEntriesOf\(aAll/.test(a) &&
        /radiusEntriesOf\(bAll/.test(a) &&
        /elementRadiusDiff\(erA\.entries, erB\.entries\)/.test(a) &&
        /elementRadiusCount\(f\)/.test(
          body.slice(
            body.indexOf('export function verdictOf('),
            body.indexOf('export function emitBaseline('),
          ),
        ) &&
        /elementRadiusCounts\[f\.name\] = elementRadiusCount\(f\)/.test(
          body.slice(
            body.indexOf('export function emitBaseline('),
            body.indexOf('export function parseBaseline('),
          ),
        ) &&
        // RE 的红必须折进退出码:它挂在 res.red 上,所以 red 那条求和行必须在
        /if \(aliasRed\) return 1/.test(body) &&
        /return rotRed \+ res\.red\.length/.test(body)
      )
    })(),
  )
  t(
    'S18 RN 同名多命中 ⇒ 取排序靠前的层(共享层优先)',
    scan(['a/X.tsx'], ['p1/X.tsx', 'p2/X.tsx']).pairs[0].rn === 'p1/X.tsx',
  )
  t(
    'S19 台账坏 JSON ⇒ 判死,不得当"没有豁免"蒙过',
    (() => {
      try {
        parseBaseline('{坏 json', 'ledger')
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    '㉑ 路由表读页:顶层 pages 不带 root、subPackages 的页必须带自己的 root',
    (() => {
      const { pages, unresolved } = readTaroPages(
        "export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [{ root: 'pkg-ai', pages: ['ai/chat', `dyn/${x}`] }]\n})\n",
        'apps/miniapp-taro/src',
      )
      return (
        pages.join('|') ===
          'apps/miniapp-taro/src/pages/index/index|apps/miniapp-taro/src/pkg-ai/ai/chat' &&
        unresolved.length === 1
      )
    })(),
  )
  t(
    '㉒ import 子句:具名导入按名路由,默认/命名空间/混用一律整模块(不得少算可达)',
    (() => {
      const names = clauseDemand('{ A, B as C }')
      return (
        JSON.stringify(names) === '["A","B"]' &&
        clauseDemand('Foo, { A }') === null &&
        clauseDemand('* as ns') === null &&
        clauseDemand('') === null
      )
    })(),
  )
  t(
    '㉓ type-only 边不成腿(import type / export type 都不算)',
    (() => {
      const { edges } = parseModuleEdges(
        "import type { A } from './a'\nexport type { B } from './b'\nexport { C } from './c'\n",
      )
      return edges.length === 1 && edges[0].spec === './c'
    })(),
  )
  t(
    '㉔ 阳性对照:被桶文件再导出、但从端入口不可达的副本必须被剔除(真临时 git 仓端到端)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.pairs.pairs.length === 0 &&
          r.unreachableLegs.length === 1 &&
          r.unreachableLegs[0].name === 'Foo' &&
          r.unreachableLegs[0].legs.join('|') === 'packages/app/src/components/Foo.tsx' &&
          /从端入口不可达/.test(r.unreachableLegs[0].reason)
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '真仓可达性判据在临时仓上没跑通',
  )
  t(
    '㉕ 反向对照:同一组件改成从端入口链上 import ⇒ 必须留在配对里(证明 ㉔ 的红不是恒红)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.unreachableLegs.length === 0 &&
          r.pairs.pairs.length === 1 &&
          r.pairs.pairs[0].rn === 'packages/app/src/components/Foo.tsx'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉖ 解析不到的路径走"未判定",绝不当"不可达"把组件剔掉(成对:与 ㉕ 唯一差别是多一条坏 import)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nimport { Gone } from './gen/missing'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        const hit = r.undeterminedEdges.some(
          (u) => /missing/.test(u.spec) && !/不存在/.test(u.reason),
        )
        return r.unreachableLegs.length === 0 && r.pairs.pairs.length === 1 && hit
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗ 逃生口:--pair-all 档退回"同名即配对"(人工核对用,默认档才是可达性判据)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        return collect(dir, 'head', { pairAll: true }).pairs.pairs.length === 1
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗b web 腿阳性对照:web 侧同名件没人用 ⇒ web 配对必须按"从web端入口不可达"剔除(真临时 git 仓)',
    (() => {
      const fx = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        // web 入口(page)不 import 任何组件 ⇒ web 侧 Foo 是死副本;miniapp 侧活着。
        'apps/web/app/page.tsx':
          "export default function P() { return <div className='rounded-sm' /> }\n",
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="rounded-md" /> }\n',
      }
      // 档位表必须随夹具走:collect 对"表取不到而组件在用圆角"判失明(同 KW 注)。
      fx['packages/design-tokens/src/radius.js'] = radiusFixtureTable()
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        return (
          r.webUnreachableLegs.length === 1 &&
          r.webUnreachableLegs[0].name === 'Foo' &&
          r.webUnreachableLegs[0].legs.join('|') === 'apps/web/src/components/Foo.tsx' &&
          /从web端入口不可达/.test(r.webUnreachableLegs[0].reason) &&
          r.webPairs.length === 0
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '真仓 web 腿可达性判据在临时仓上没跑通',
  )
  t(
    '㉗c 反向对照:同一 web 组件被入口链上 import ⇒ web 配对必须保留(证明 ㉗b 的红不是恒红)',
    (() => {
      const fx = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        'apps/web/app/page.tsx':
          "import { Foo } from '@/components/Foo'\nexport default function P() { return <Foo /> }\n",
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="rounded-md" /> }\n',
      }
      fx['packages/design-tokens/src/radius.js'] = radiusFixtureTable()
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        return (
          r.webUnreachableLegs.length === 0 &&
          r.webPairs.length === 1 &&
          r.webPairs[0].name === 'Foo' &&
          r.webPairs[0].rn === 'apps/web/src/components/Foo.tsx'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗d web 可达性挂起不得静默:夹具没有 web 种子 ⇒ 挂起留痕,web 配对不被误剔也不装"已确认活着"',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          typeof r.webReachNote === 'string' &&
          /web/.test(r.webReachNote) &&
          r.webUnreachableLegs.length === 0
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉘ IC:字形名解析 —— lucide 导入按 PascalCase→kebab,小程序按 LineIcon name,两者可逐名比',
    (() => {
      const rn = iconGlyphs("import { ChevronLeft, Mic as MicIcon } from 'lucide-react-native'\n")
      const mp = iconGlyphs(
        'import LineIcon from "@/components/LineIcon"\n<LineIcon name="chevron-left" size={24} />\n',
      )
      return rn.vector.join(',') === 'chevron-left,mic' && mp.vector.join(',') === 'chevron-left'
    })(),
  )
  t(
    '㉙ IC:CDN 位图当 UI 图标必须计数;带原因的逐行豁免把它抵消(成对对照,证明豁免不是恒放)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const rnSrc = "import { Send } from 'lucide-react-native'\n"
      const bare = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png")\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      const withEx = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png") // icon-bitmap-exempt: 多色品牌插画\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      return bare.length === 1 && bare[0].bitmap === 1 && withEx.length === 0
    })(),
  )
  t(
    '㉙b RN 侧位图载体必须同样计数(旧尺子只认小程序的 aizhsUrl 形态 ⇒ "RN 仍用位图"整型隐身)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const mpVec = 'import LineIcon from "@/components/LineIcon"\n<LineIcon name="send" />\n'
      const rnBmp = iconAudit(pairs, {
        m: mpVec,
        r: 'const ICON_SEND = `${cdnHost}/icons/send.png`\n<Image source={{ uri: ICON_SEND }} />\n',
      })
      const rnEx = iconAudit(pairs, {
        m: mpVec,
        r: 'const ICON_SEND = `${cdnHost}/icons/send.png` // icon-bitmap-exempt: 多色插画\n',
      })
      return rnBmp[0].rnBitmap === 1 && rnEx[0].rnBitmap === 0
    })(),
  )
  t(
    '㉙c 两端拿同一字形都走位图 ⇒ 必须点名(一致但都没矢量化,过去完全看不见)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const r = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/camera.png")\n',
        r: 'const ICON_CAMERA = `${cdnHost}/icons/camera.png`\n',
      })
      return r.length === 1 && r[0].bothBitmap.length === 1 && r[0].bothBitmap[0] === 'camera'
    })(),
  )
  t(
    '㉙d 位图判据面必须已剥注释(说明文字里提一句 png 不得造出一处载体)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const r = iconAudit(pairs, {
        m: 'import LineIcon from "@/components/LineIcon"\n',
        r: "// 这里以前是 `${cdnHost}/icons/send.png`,现已换成 lucide Send\nimport { Send } from 'lucide-react-native'\n",
      })
      return r[0].rnBitmap === 0
    })(),
  )
  t(
    '㉚ IC 与几何判据分开跑:几何已同值而字形集合不同形的族,必须仍被 IC 看见',
    (() => {
      const r = iconAudit(
        { pairs: [{ name: 'Y', miniapp: 'm', rn: 'r' }] },
        {
          m: '<LineIcon name="plus" />',
          r: "import { Plus, Camera } from 'lucide-react-native'\n",
        },
      )
      return r.length === 1 && r[0].bitmap === 0 && r[0].onlyRn.join(',') === 'camera'
    })(),
  )
  t(
    '㉛ IC:字形名三种传法(属性字面量 / 配置数组 icon: / 三元 name={})都必须算进矢量化面;未 import LineIcon 不得乱认(成对)',
    (() => {
      const withChannel =
        'import LineIcon from "@/components/LineIcon"\n' +
        'const G = [{ icon: "camera" }]\n' +
        "<LineIcon name={mode === 'voice' ? 'keyboard' : 'mic'} size={20} />\n" +
        '<LineIcon name="send" size={20} />\n'
      const noChannel = 'const G = [{ icon: "camera" }]\n'
      return (
        iconGlyphs(withChannel).vector.join(',') === 'camera,keyboard,mic,send' &&
        iconGlyphs(noChannel).vector.join(',') === ''
      )
    })(),
  )
  /* 票⑥(2026-09-26)读数面四条不对称 + 具名档解析。
     这一组存在的理由:用户实拍"两端还是不一样",而本门一路报绿 —— 查下来不是台账数字错,
     是**读数面本身两侧不同形**:字距被当尺寸、`w-1/3` 被折成 4px、小程序的 `px-3` 不进集合而
     RN 的 `paddingHorizontal: 12` 进集合,以及最要命的一条 —— 数字一旦收编进 shared spec,
     组件里只剩标识符,前面所有数字形态的提取式全部落空,于是"收进单一源"= 从尺子上消失。
     每条都配正反对照(阴性结论必须有阳性对照,否则等于没测)。 */
  t(
    '㉙ letterSpacing 不是尺寸(反面对照:同键名换成 width 必须仍被读)',
    readGeometry('letterSpacing: 0.2\nfoo: 3\n', 'rn').values.size === 0 &&
      readGeometry('letterSpacing: 0.2\nwidth: 300\n', 'rn').values.has(300),
  )
  t(
    '㉚ 分数宽度 w-1/3 不得被折成 4px;同串里的真档 w-8 仍要读到',
    (() => {
      const g = readGeometry('className="w-1/3"\n', 'miniapp')
      const h = readGeometry('className="w-8"\n', 'miniapp')
      return !g.values.has(4) && !g.values.has(1) && h.values.has(32)
    })(),
  )
  t(
    '㉛ 刻度档 px-3 / gap-4 在小程序侧同样进集合(与 RN 的 paddingHorizontal: 12 对形)',
    (() => {
      const g = readGeometry('className="px-3 gap-4"\n', 'miniapp')
      const r = readGeometry('paddingHorizontal: 12\ngap: 16\n', 'rn')
      return (
        g.values.has(12) &&
        g.values.has(16) &&
        !diffValues(g.values, r.values).onlyRn.length &&
        !diffValues(g.values, r.values).onlyMiniapp.length
      )
    })(),
  )
  t(
    '㉜ 具名档:一端写字面量、另一端读同一 spec 档 ⇒ 必须判同值(旧尺子在这里报"仅小程序档 32")',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32 }
      // 裸数字写在 RN 侧(该端量纲即逻辑 px);小程序侧的裸数字按 rpx 折半,不是本例要证的口径
      const a = readGeometry('width: 32\n', 'rn', tiers)
      const b = readGeometry(
        'import { BOTTOM_ACTION_BAR_CONTROL_BOX_PX } from "spec"\nwidth: toUnit(BOTTOM_ACTION_BAR_CONTROL_BOX_PX)\n',
        'rn',
        tiers,
      )
      const d = diffValues(a.values, b.values)
      return a.values.has(32) && b.values.has(32) && !d.onlyMiniapp.length && !d.onlyRn.length
    })(),
  )
  t(
    '㉝ 具名档有真分叉时必须现形(上一条的阳性对照:同一通道不能只会藏)',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32, BOTTOM_ACTION_BAR_OTHER_PX: 44 }
      const a = readGeometry('width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX\n', 'miniapp', tiers)
      const b = readGeometry('width: BOTTOM_ACTION_BAR_OTHER_PX\n', 'rn', tiers)
      const d = diffValues(a.values, b.values)
      return d.onlyMiniapp.join() === '32' && d.onlyRn.join() === '44'
    })(),
  )
  t(
    '㉞ geometry 表的档经 rnGeometry.tapBox 取用同样入集合;换算系数 TARO_RPX_PER_PX 不得当档',
    (() => {
      const src = {
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\nexport const TARO_RPX_PER_PX = 2\n',
      }
      const tiers = specTiers(src)
      const g = readGeometry('const VOICE = rnGeometry.tapBox\nheight: VOICE\n', 'rn', tiers)
      return (
        tiers['geometry.tapBox'] === 36 &&
        tiers['TARO_RPX_PER_PX'] === undefined &&
        g.values.has(36)
      )
    })(),
  )
  t(
    '㉟ spec 档表按被审面取;面枚举不到任何 *-spec.ts ⇒ 判"无法判定",不得记绿',
    (() => {
      const files = { ...FIXTURE_BASE({}) }
      // 夹具默认带一份 spec(见 FIXTURE_BASE);本例要证的正是"没有具名档来源时门必须喊瞎"
      delete files['packages/shared/src/ui/foo-spec.ts']
      const dir = makeFixtureRepo(files)
      try {
        collect(dir, 'head')
        return '未抛 Undetermined'
      } catch (e) {
        return /spec|Undetermined|无法判定/.test(String(e?.message ?? e))
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊱ spec 档写成几何表的投影(`= GEOMETRY_PX.controlBox`)仍必须解出数值 —— 否则改成投影就等于回到隐身',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  controlBox: 32,\n  controlGlyph: 14,\n}\n',
        'packages/shared/src/ui/x-spec.ts':
          "import { GEOMETRY_PX } from '@ihui/design-tokens'\n" +
          'export const X_CONTROL_BOX_PX = GEOMETRY_PX.controlBox\n' +
          'export const X_CONTROL_GLYPH_PX = GEOMETRY_PX.controlGlyph\n',
      })
      const g = readGeometry('width: X_CONTROL_BOX_PX\nsize={X_CONTROL_GLYPH_PX}\n', 'rn', tiers)
      return (
        tiers.X_CONTROL_BOX_PX === 32 &&
        tiers.X_CONTROL_GLYPH_PX === 14 &&
        g.values.has(32) &&
        g.values.has(14)
      )
    })(),
  )
  t(
    '㊲ 投影源在表里取不到(改名 / 删档)⇒ 该具名档不入表,不得凭名字造一个数',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\n',
        'packages/shared/src/ui/y-spec.ts':
          'export const Y_GONE_PX = GEOMETRY_PX.renamedAway\nexport const Y_REAL_PX = 20\n',
      })
      return tiers.Y_GONE_PX === undefined && tiers.Y_REAL_PX === 20
    })(),
  )
  t(
    '㊳ SL:一张 spec 档只被一条腿引用必须点名(正反对照:两侧同引用 ⇒ 不列)',
    (() => {
      const tiers = { Z_BOX_PX: 36, Z_GLYPH_PX: 20, 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const oneLeg = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\n',
          'b/Z.tsx': 'width: Z_GLYPH_PX\n',
        },
        tiers,
      )
      const bothLegs = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\nsize: Z_GLYPH_PX\n',
          'b/Z.tsx': 'width: Z_BOX_PX\nsize: Z_GLYPH_PX\n',
        },
        tiers,
      )
      return (
        oneLeg.length === 1 &&
        oneLeg[0].onlyMiniapp.join(',') === 'Z_BOX_PX' &&
        oneLeg[0].onlyRn.join(',') === 'Z_GLYPH_PX' &&
        bothLegs.length === 0
      )
    })(),
  )
  t(
    '㊴ SL 域不含 `geometry.*` 通用档(两侧都无引用 ⇒ 整族不列;有引用也只列 spec 档)',
    (() => {
      const tiers = { 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const none = specLegAudit(
        pairs,
        { 'a/Z.tsx': 'const t = rnGeometry.tapBox\n', 'b/Z.tsx': 'padding: 8\n' },
        tiers,
      )
      const emptyTiers = specLegAudit(pairs, { 'a/Z.tsx': 'x\n', 'b/Z.tsx': 'y\n' }, {})
      return none.length === 0 && emptyTiers.length === 0
    })(),
  )
  t(
    '㊵ 装车锁:`main` 必须把 `collected.tiers` 与 `collected.radius` 都喂进 `audit` —— 算出档表又丢掉,等于判据没接线',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      /**
       * 按**实参集合**判,不按整条调用的字节形判:本文件被 prettier 折过行以后,
       * 锚定 `...collected.tiers\s*\)` 这种"闭合括号紧跟最后一个参数"的写法会在一次无关的
       * 重排里假红(实测把 audit 调用改成多行参数后本条即红,而接线本身完好)。
       * 现在两维都必须出现 —— 圆角维单独被摘线(只喂 tiers)同样判这条红,
       * 那正是 2026-09-27 之前 RD 维在提交链上生效 0 次的那一型。
       */
      const calls = [...src.matchAll(/\baudit\(([^)]*)\)/g)].map((m) => m[1])
      return calls.some(
        (a) =>
          /collected\.pairs/.test(a) && /collected\.tiers/.test(a) && /collected\.radius/.test(a),
      )
    })(),
  )
  t(
    '㊶ G:表里加一档而 `GeometryStep` 不跟 ⇒ 必须点名该档(正反对照:同名 ⇒ 无话)',
    (() => {
      const drift = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n  controlBox: 32,\n}\n',
        "export type GeometryStep = 'tapBox'\n",
      )
      const same = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n  glyphMd: 20,\n}\n',
        "export type GeometryStep = 'tapBox' | 'glyphMd'\n",
      )
      return (
        !!drift.problem &&
        drift.problem.includes('controlBox') &&
        !same.problem &&
        same.steps.length === 2 &&
        same.declared.length === 2
      )
    })(),
  )
  t(
    '㊷ G 反向漂移同样判红:类型承认一档而表里没有(消费方编译过、运行时取到 undefined)',
    (() => {
      const r = geometryDeclCheck(
        'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\n',
        "export type GeometryStep = 'tapBox' | 'glyphSm'\n",
      )
      return !!r.problem && r.problem.includes('glyphSm') && r.missingInJs.join() === 'glyphSm'
    })(),
  )
  t(
    '㊸ G 取不到两份之一 ⇒ 判"未判定"而不是"一致"(把判据失明写成通过是本仓最高频失效型)',
    (() => {
      const noTable = geometryDeclCheck('export const OTHER = {}\n', "type X = 'a'\n")
      const noSrc = geometryDeclCheck(undefined, "type X = 'a'\n")
      return noTable.undetermined === true && noSrc.undetermined === true
    })(),
  )
  t(
    '㊹ G 装车锁:main 必须读 collected.geoDecl 并把它折进退出码(否则本维只是自检里的摆设)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return (
        /geometryDeclCheck\(specSources\[geoPath\],\s*specSources\[geoDtsPath\]\)/.test(src) &&
        /collected\.geoDecl/.test(src) &&
        /\+ \(geoRed \? 1 : 0\)\s*\?\s*1\s*:\s*0/.test(src)
      )
    })(),
  )
  t(
    '㊺ 拆对声明三条判据:无理由 / 日期形态错 / 已到期 各自判红,合法声明返回 null',
    (() => {
      const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
      const ok = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: future,
      })
      const noReason = rejectProblem({ reason: '', until: future })
      const shortReason = rejectProblem({ reason: '不一样', until: future })
      const expired = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: '2020-01-01',
      })
      const badDate = rejectProblem({
        reason: '两端头注逐字读自 HEAD:一个是右下角功能盒,一个是顶部 toast',
        until: '2027-13-99x',
      })
      const notObj = rejectProblem('FloatBox')
      return (
        ok === null &&
        !!noReason &&
        !!shortReason &&
        !!expired &&
        !!badDate &&
        !!notObj &&
        /到期/.test(expired)
      )
    })(),
  )
  t(
    '㊻ 拆对必须发生在配对层:该族不再进 findings,但必须在 rejected 里点名(不得静默消失)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const plain = collect(dir, 'head')
        const withRej = collect(dir, 'head', { rejected: ['Foo'] })
        return (
          plain.pairs.pairs.some((p) => p.name === 'Foo') &&
          plain.rejected.length === 0 &&
          !withRej.pairs.pairs.some((p) => p.name === 'Foo') &&
          withRej.rejected.length === 1 &&
          withRej.rejected[0].name === 'Foo' &&
          withRej.rejected[0].rn === 'packages/app/src/components/Foo.tsx'
        )
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊼ emitBaseline 必须原样带走 pairingRejects(重写台账把别人的拆对声明冲掉 = 该族凭空多出一堆"差异")',
    (() => {
      const prior = {
        counts: { A: 1 },
        waivers: {},
        pairingRejects: { F: { reason: 'x', until: '2027-01-01' } },
      }
      const out = emitBaseline(
        [{ name: 'A', named: [], geometry: { onlyMiniapp: [], onlyRn: [] } }],
        prior,
      )
      const dropped = emitBaseline(
        [{ name: 'A', named: [], geometry: { onlyMiniapp: [], onlyRn: [] } }],
        {},
      )
      return (
        !!out.pairingRejects &&
        out.pairingRejects.F.reason === 'x' &&
        !Object.keys(out.counts).includes('F') &&
        dropped.pairingRejects === undefined
      )
    })(),
  )
  t(
    '㊽ 装车锁:拆对的红必须折进退出码(只打印不拦提交 = 声明坏了没人知道)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return /\+\s*slRed\.length\s*\+\s*rejRed\s*\+\s*\(geoRed \? 1 : 0\)/.test(src)
    })(),
  )
  t(
    '㊣ 换算器必须参与读数:`toUnit(taroGeometry.X)` = 双重换算,读出来是表值的 2 倍(实测事故形态)',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const bad = readGeometry('width: toUnit(taroGeometry.controlBox)\n', 'miniapp', tiers)
      return bad.values.has(64) && !bad.values.has(32)
    })(),
  )
  t(
    '㊤ 正解写法不得被判成差一倍:`rpx(taroGeometry.X)` 读表值本身(上一条的成对对照)',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const good = readGeometry('width: rpx(taroGeometry.controlBox)\n', 'miniapp', tiers)
      return good.values.has(32) && !good.values.has(64)
    })(),
  )
  t(
    '㊥ 端到端:一端走对投影、另一端走错投影 ⇒ 必须报成真分叉(旧尺子在这里报"两端同档")',
    (() => {
      const tiers = { 'geometry.controlBox': 32 }
      const a = readGeometry('width: rpx(taroGeometry.controlBox)\n', 'miniapp', tiers)
      const b = readGeometry('width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX\n', 'rn', {
        ...tiers,
        BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32,
      })
      const d = diffValues(a.values, b.values)
      const sameNoConverter = diffValues(
        readGeometry('width: toUnit(taroGeometry.controlBox)\n', 'miniapp', tiers).values,
        b.values,
      )
      return (
        !d.onlyMiniapp.length && !d.onlyRn.length && sameNoConverter.onlyMiniapp.join() === '64'
      )
    })(),
  )
  t(
    '㊦ 台账腐烂:台账钉着某族而本轮实测无该族记录 ⇒ 必须点名并进退出码',
    (() => {
      const v = verdictOf([], { counts: { Ghost: 3 }, radiusCounts: {} })
      return v.rot.join() === 'Ghost'
    })(),
  )
  t(
    '㊧ 反向对照:同一族本轮有读数(哪怕差异为 0 档以外)⇒ 不得判腐烂',
    (() => {
      const f = {
        name: 'X',
        named: [],
        geometry: { onlyMiniapp: [44], onlyRn: [32] },
        radius: { onlyMiniapp: [], onlyRn: [] },
      }
      const v = verdictOf([f], { counts: { X: 2 }, radiusCounts: { X: 0 } })
      return v.rot.length === 0
    })(),
  )
  t(
    '㊨ 带理由豁免的族仍算"扫过了",不得被读成腐烂(否则没人敢登记豁免)',
    (() => {
      const f = {
        name: 'Y',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
      }
      const v = verdictOf([f], {
        counts: { Y: 5 },
        radiusCounts: {},
        waivers: { Y: { reason: '原生 chrome 与键盘避让机制不同,两端不可同形' } },
      })
      return v.rot.length === 0 && v.waived.length === 1
    })(),
  )
  t(
    '㊩ 腐烂维装车锁:main 必须既打印 res.rot 又把它折进退出码(只打印 = 下一次没人看)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return (
        /× 台账腐烂:\$\{res\.rot\.join/.test(src) &&
        /const rotRed = res\.rot\.length \? 1 : 0/.test(src) &&
        /rotRed\s*\+\s*res\.red\.length\s*\+\s*icRed\.length/.test(src)
      )
    })(),
  )
  t(
    'WD1 web 腿读数:两侧都读到档而不同 ⇒ 出差异;一侧一个档都读不出 ⇒ 未判定,不得记"两端同值"',
    (() => {
      // 与 S18 同一形态:档位表就是一张普通对象(radiusLookup 解析的是 radius.js 的**具体写法**,
      // 自检测的是判据不是解析器,所以既有 RD 用例都直接喂表)
      const table = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const pairs = [
        { name: 'Card', miniapp: 'm/Card.tsx', rn: 'w/Card.tsx' },
        { name: 'Quiet', miniapp: 'm/Quiet.tsx', rn: 'w/Quiet.tsx' },
      ]
      const text = {
        'm/Card.tsx': 'export const Card = () => <div className="rounded-lg" />',
        'w/Card.tsx': 'export const Card = () => <div className="rounded-md" />',
        'm/Quiet.tsx': 'export const Quiet = () => <div />',
        'w/Quiet.tsx': 'export const Quiet = () => <div />',
      }
      const r = webRadiusAudit(pairs, text, table)
      const card = r.findings.find((f) => f.name === 'Card')
      return (
        !!card &&
        card.radius.onlyRn.length === 1 &&
        card.radius.onlyMiniapp.length === 1 &&
        r.findings.length === 1 &&
        r.undetermined.length === 1 &&
        r.undetermined[0].name === 'Quiet'
      )
    })(),
  )
  t(
    'WD2 web 腿锚点独立:同一族在主腿与 web 腿各有一份差异时,一边下降不得替另一边顶掉名额;' +
      '而台账没钉过的族出现差异 ⇒ 直接红',
    (() => {
      const f = {
        name: 'Card',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [6], onlyRn: [8] },
        elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [] },
      }
      // 主腿台账给 Card 一份额度,web 台账没给 ⇒ web 腿必须红,主腿必须绿
      const mainLedger = { counts: { Card: 0 }, radiusCounts: { Card: 2 } }
      const webLedger = { webCounts: {}, webRadiusCounts: {} }
      const main = verdictOf([f], mainLedger)
      const web = verdictOf([f], webLedger, WEB_LEDGER)
      const webAfter = verdictOf([f], { webCounts: {}, webRadiusCounts: { Card: 2 } }, WEB_LEDGER)
      return (
        main.red.length === 0 &&
        web.red.length === 1 &&
        webAfter.red.length === 0 &&
        web.red[0].radiusCount === 2
      )
    })(),
  )
  t(
    'WD3 装车锁:web 腿必须既被 main 打印、又折进退出码,且"台账钉过而本轮零记录"要红' +
      '(只打印 = 下一次没人看;没有死亡机制 = 删目录就能让这一维安静)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return (
        /**
         * 这几条锁刻意用 `\s*` 容忍**折行**:早先它们写成 `webRadiusAudit\(collected\.webPairs`
         * 这样的紧邻子串,而调用点被格式化工具折成多行后锁就红了 —— 判据与被判据的**排版**挂钩,
         * 于是"格式化"成了唯一能修它的手段,而本仓明令不得对本校验器跑格式化(自检里有多处
         * 源码正则自证,折行会凭空让它们失明)。带 `\s*` 后语义不变(仍是"这个调用在本体内"),
         * 但换行不再让它变成恒红(§12e:恒红门的唯一结局是逼人跳门)。
         */
        /webRadiusAudit\(\s*collected\.webPairs/.test(src) &&
        /if \(webVerdict\.red\.length \|\| webGhostRed\)/.test(src) &&
        /const webGhostRed = webPriorKeys\.length && !web\.findings\.length/.test(src) &&
        /web 腿整族消失|台账钉着 \$\{webPriorKeys\.length\} 族/.test(src)
      )
    })(),
  )
  t(
    'WD4 web 腿豁免自成一本账:重锚必须带过去(键按 webWaivers,不与主腿 waivers 互串),' +
      '差异归零的理由要撤下并报名,而生效中的豁免必须逐条把理由打进报告(豁免不得静默)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const f = {
        name: 'Card',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [6], onlyRn: [8] },
        elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [] },
      }
      const prior = {
        // 主腿对同名族也挂了一份豁免:两腿的豁免表必须互不顶账(web 腿的差异不等于主腿的差异)
        waivers: { Card: { reason: '主腿那一维的理由' } },
        webWaivers: {
          Card: { reason: 'web 侧多嵌一段联想面板,两端输入井同档' },
          Gone: { reason: '本轮已经找不到差异,该撤下' },
        },
      }
      const out = emitBaseline([], prior, [f])
      const carried = !!out[WEB_LEDGER.waivers]?.Card
      const ghostRetired = out[WEB_LEDGER.waivers]?.Gone === undefined
      const notCrossed = out.waivers.Card === undefined // 主腿本轮无该族差异 ⇒ 主腿理由必须撤下,而不是被 web 腿带着
      const waivedNotRed = (() => {
        const ledger = { webCounts: {}, webRadiusCounts: { Card: 2 }, webWaivers: prior.webWaivers }
        const v = verdictOf([f], ledger, WEB_LEDGER)
        return v.red.length === 0 && v.waived.length === 1 && v.waived[0].name === 'Card'
      })()
      const printed =
        /带理由豁免 \$\{webVerdict\.waived\.length\}/.test(src) &&
        /webVerdict\.waived[\s\S]{0,240}⊘ WD \$\{wv\.name\} 带理由豁免/.test(src)
      return carried && ghostRetired && notCrossed && waivedNotRed && printed
    })(),
  )
  t(
    'WD5 拆对必须能只作用于一条腿:legs=["web"] 时主腿在册配对不得被连带摘线,而 web 腿必须留名;' +
      '缺省(不写 legs)= 两腿都拆(既有 FloatBox 声明逐字不改行为)',
    (() => {
      const future = new Date(Date.now() + 86400 * 300).toISOString().slice(0, 10)
      const badLegName = rejectProblem({
        reason: '两端不是同一个东西,证据见头注',
        until: future,
        legs: ['nope'],
      })
      const emptyLegs = rejectProblem({
        reason: '两端不是同一个东西,证据见头注',
        until: future,
        legs: [],
      })
      const shape = badLegName === null ? false : /腿名/.test(badLegName)
      const both = rejectLegs({ reason: 'x', until: future })
      const onlyWeb = rejectLegs({ reason: 'x', until: future, legs: ['web'] })
      if (!(both.main && both.web && !onlyWeb.main && onlyWeb.web)) return false
      if (!shape || !emptyLegs) return false
      const files = {
        ...FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
        // web 腿目录里再放一份同名件:同一族现在同时存在于两条腿上。
        // 刻意**不写圆角类**:FIXTURE_BASE 里没有 radius.js 那份档表,写了会让 collect 按
        // "圆角维判据失明"判死 —— 那这条用例红的原因是夹具缺件,不是 legs 判据(与上面㊻同一条纪律)。
        'apps/web/src/components/Foo.tsx':
          'export function Foo() { return <div className="flex" /> }\n',
      }
      const dir = makeFixtureRepo(files)
      try {
        const decl = {
          reason: 'web 那份同名件是另一端口的死副本,与小程序/RN 不是同一个元素',
          until: future,
          legs: ['web'],
        }
        const w = collect(dir, 'head', { rejected: ['Foo'], rejectMap: { Foo: decl } })
        const m = collect(dir, 'head', {
          rejected: ['Foo'],
          rejectMap: { Foo: { ...decl, legs: ['main'] } },
        })
        const plain = collect(dir, 'head', {})
        const mainKept = w.pairs.pairs.some((p) => p.name === 'Foo')
        const webSplit = w.webRejected.length === 1 && w.webPairs.every((p) => p.name !== 'Foo')
        const mainSplit = !m.pairs.pairs.some((p) => p.name === 'Foo') && m.webRejected.length === 0
        // 不写 legs ⇒ 与旧行为逐字一致(两腿都拆),这条防的是"新维度顺手改了缺省语义"
        const legacy = collect(dir, 'head', {
          rejected: ['Foo'],
          rejectMap: { Foo: { reason: decl.reason, until: future } },
        })
        const legacyBoth =
          !legacy.pairs.pairs.some((p) => p.name === 'Foo') && legacy.webRejected.length === 1
        return plain.webRejected.length === 0 && mainKept && webSplit && mainSplit && legacyBoth
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊪ 平台后缀必须能配对:`SectionHeader` 与 `SectionHeader.taro` 是同一元素;' +
      '带后缀那份优先当选;而真不同名的两个文件不得被并成一对(宁可少配)',
    (() => {
      const r = scan(
        [
          'apps/miniapp-taro/src/components/SectionHeader.tsx',
          'apps/miniapp-taro/src/components/SectionHeader.taro.tsx',
          'apps/miniapp-taro/src/components/SearchBar.tsx',
        ],
        [
          'packages/app/src/features/common/SectionHeader.tsx',
          'packages/app/src/features/chat/SearchInput.tsx',
        ],
      )
      const names = r.pairs.map((p) => p.name)
      const sec = r.pairs.find((p) => p.name === 'SectionHeader')
      return (
        names.length === 1 &&
        names[0] === 'SectionHeader' &&
        sec.miniapp.endsWith('SectionHeader.taro.tsx') &&
        r.onlyMiniapp === 1 &&
        r.onlyRn === 1 &&
        r.onlyMiniappNames.join() === 'apps/miniapp-taro/src/components/SearchBar.tsx' &&
        r.onlyRnNames.join() === 'packages/app/src/features/chat/SearchInput.tsx'
      )
    })(),
  )
  t(
    '㊫ 名单必须是可指认的路径而不是又一个计数:' +
      '只报"75 / 50"时,下一个人无从判断哪些是同一元素、哪些真只存在一端,那一格永远清不掉',
    (() => {
      const r = scan(['apps/miniapp-taro/src/a/Only.tsx'], ['packages/app/src/b/Twin.tsx'])
      return (
        r.onlyMiniapp === 1 &&
        r.onlyMiniappNames.length === 1 &&
        r.onlyMiniappNames[0].includes('Only.tsx') &&
        r.onlyRnNames[0].includes('Twin.tsx')
      )
    })(),
  )
  t(
    '㊬ 装车锁:换腿桶必须与配对键同形 —— altsBySide 用 pairKey 建桶、按 pairKey 查桶' +
      '(仍用 normKey 的话,带平台后缀那份与不带那份不在同一桶里,不可达时找不到替代腿)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return (
        /altsBySide\[side\] = m/.test(src) &&
        (src.match(/const k = pairKey\(p\)/g) ?? []).length === 1 &&
        /altsBySide\[side\]\.get\(pairKey\(cur\[side\]\)\)/.test(src) &&
        !/altsBySide\[side\]\.get\(normKey\(cur\[side\]\)\)/.test(src)
      )
    })(),
  )
  t(
    '㊭ 装车锁:名单必须由 main 真的打出来(人读面 + --json 两面各一处)。' +
      "自检证明 scan 给得出名字,不等于有人问它要 —— 本仓最高频的失效型就是'函数在、没人调'",
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const from = src.indexOf('function main(')
      // runSelfTest 已拆出主文件 ⇒ main 之后直到文件尾都是主文件面(dispatch + __test__)
      const mainBody = src.slice(from)
      return (
        // --json 面(机器可读,下一票的输入源)
        /onlyMiniappNames: collected\.pairs\?\.onlyMiniappNames \?\? \[\]/.test(mainBody) &&
        /onlyRnNames: collected\.pairs\?\.onlyRnNames \?\? \[\]/.test(mainBody) &&
        // 人读面:名单打印的三处缺一不可(标签表、计数前缀、逐名 join)
        /\['仅小程序', 'onlyMiniappNames'\]/.test(mainBody) &&
        /\['仅 RN', 'onlyRnNames'\]/.test(mainBody) &&
        /\$\{label\}\(\$\{names\.length\}\):\$\{names\.join\(' '\)\}/.test(mainBody)
      )
    })(),
  )
  t(
    '㊮ 别名必须能把"两端不同名的同一元素"拉回射程:' + '配对成立、名单里不再重复点名、且无一条判红',
    (() => {
      const r = scan(
        [
          'apps/miniapp-taro/src/components/CategoryBar.tsx',
          'apps/miniapp-taro/src/components/X.tsx',
        ],
        ['packages/app/src/components/CategoryInlineBar.tsx'],
        {
          CategoryBar: {
            miniapp: 'apps/miniapp-taro/src/components/CategoryBar.tsx',
            rn: 'packages/app/src/components/CategoryInlineBar.tsx',
            reason: '两端头注互点名:同一"统一分类条"的两份同形实现',
            until: '2027-01-01',
          },
        },
      )
      const p = r.pairs.find((x) => x.name === 'CategoryBar')
      return (
        !!p?.aliased &&
        p.rn.endsWith('CategoryInlineBar.tsx') &&
        r.aliasProblems.length === 0 &&
        r.onlyMiniapp === 1 &&
        r.onlyMiniappNames.join() === 'apps/miniapp-taro/src/components/X.tsx' &&
        r.onlyRn === 0 &&
        r.onlyRnNames.length === 0
      )
    })(),
  )
  t(
    '㊯ 别名两侧文件必须在被审面上找得到:路径写歪 / 文件搬家 ⇒ 判红并点名,' +
      '不得静默退回"这一族没配对上"',
    (() => {
      const r = scan(['a/CategoryBar.tsx'], ['b/Gone.tsx'], {
        CategoryBar: {
          miniapp: 'a/CategoryBar.tsx',
          rn: 'b/CategoryInlineBar.tsx',
          reason: '同一分类条的两份实现,头注互点名',
          until: '2027-01-01',
        },
      })
      return (
        r.aliasProblems.length === 1 &&
        /找不到/.test(r.aliasProblems[0].problem) &&
        r.pairs.every((p) => !p.aliased)
      )
    })(),
  )
  t(
    '㊰ 该对已能按同名配对 ⇒ 别名是多余行,必须判红要求了结' +
      '(挂着一条不再生效的配对声明,比没有更难查)',
    (() => {
      const r = scan(['a/Foo.tsx'], ['b/Foo.tsx'], {
        Foo: {
          miniapp: 'a/Foo.tsx',
          rn: 'b/Foo.tsx',
          reason: '早年两端不同名,如今已能同名配对',
          until: '2027-01-01',
        },
      })
      return r.aliasProblems.length === 1 && /多余行/.test(r.aliasProblems[0].problem)
    })(),
  )
  t(
    '㊱ 别名声明的卫生与拆对同源:无理由 / 理由不足以复核 / 已到期 各判红,而判据只有 rejectProblem 一份',
    (() => {
      const mk = (a) =>
        scan(['a/A.tsx'], ['b/B.tsx'], { A: { miniapp: 'a/A.tsx', rn: 'b/B.tsx', ...a } })
      return (
        mk({ reason: '', until: '2027-01-01' }).aliasProblems.length === 1 &&
        mk({ reason: '短', until: '2027-01-01' }).aliasProblems.length === 1 &&
        mk({ reason: '同一元素的两种命名,依据两端头注互点名', until: '2020-01-01' }).aliasProblems
          .length === 1 &&
        mk({ reason: '同一元素的两种命名,依据两端头注互点名', until: '2027-01-01' }).aliasProblems
          .length === 0
      )
    })(),
  )
  t(
    '㊲ emitBaseline 必须原样带走 aliases(重写台账把已登记别名冲掉 = 那一族静默回到零判据,账面什么都看不见)',
    (() => {
      const prior = { aliases: { A: { miniapp: 'a', rn: 'b', reason: 'r', until: '2027-01-01' } } }
      const out = emitBaseline(
        [{ name: 'X', named: [], geometry: { onlyMiniapp: [], onlyRn: [] }, waived: false }],
        prior,
      )
      const dropped = emitBaseline([], prior)
      return out.aliases?.A?.reason === 'r' && dropped.aliases?.A?.reason === 'r'
    })(),
  )
  t(
    '㊳ 装车锁:别名表必须由 main 喂进 collect,且**每一处** HEAD 棘轮基线取样同样要喂' +
      '(漏喂 ⇒ 本轮多出的配对在基准侧不存在,别人欠的债会被算成新增红)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      /**
       * 这里断言的是"**每一处** HEAD 基线取样都喂了 aliases",不是"恰好 N 处"。
       * 原来写死 `=== 2` 时它数的是当时已有的两处;RS 维的差值棘轮合法地添了第三处之后,
       * 那个数字就变成"新维必须不存在"的隐含约束 —— 判据一加维度就把守门弄红,这是**恒红门**(§12e),
       * 而恒红门的唯一结局是逼人跳门。逐处断言反而比计数强:新增任何一处取样都逃不掉。
       */
      const headSamples = [...src.matchAll(/collect\(repoRoot, 'head',[^\n]*/g)].map((m) => m[0])
      return (
        /collect\(repoRoot, face, \{ pairAll, rejected: rejNames, rejectMap: rej, aliases \}\)/.test(
          src,
        ) &&
        headSamples.length >= 2 &&
        headSamples.every((s) => s.includes('aliases')) &&
        /if \(aliasRed\) return 1/.test(src) &&
        /aliasPairs: \(collected\.pairs\?\.pairs \?\? \[\]\)/.test(src)
      )
    })(),
  )
  t(
    '㉅ 伴生样式表必须参与几何/圆角读数:同一对文件,喂 styles 与不喂结论必须不同' +
      '(不喂 ⇒ "小程序 0 档 / RN 11 档"这种测量假象,与 §4 的 CSS 整面隐身同型)',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const texts = {
        'a/Foo.tsx': 'export default function Foo(){return null}\n',
        'b/Foo.tsx': 'width: 32\n',
      }
      const blind = audit(p, texts, {})
      // 128rpx 归一 = 64px,与 RN 侧 32 不同档(64rpx 会正好等于 32,那是同值不是漏读)
      const withCss = audit(p, texts, {}, {}, null, { 'a/Foo.tsx': '.foo{width: 128rpx}\n' })
      const gBlind = blind.findings[0].geometry
      const gCss = withCss.findings[0].geometry
      return (
        gBlind.onlyMiniapp.length === 0 &&
        gBlind.onlyRn.join() === '32' &&
        gCss.onlyMiniapp.join() === '64' &&
        gCss.onlyRn.join() === '32'
      )
    })(),
  )
  t(
    '㉆ resolveRel 只处理 ./ 与 ../,并按被审面拼仓库相对路径(带别名的说明符不跟 —— 样式文件不该走别名)',
    (() =>
      resolveRel('apps/miniapp-taro/src/components/CategoryBar.tsx', './CategoryBar.css') ===
        'apps/miniapp-taro/src/components/CategoryBar.css' &&
      resolveRel('packages/app/src/components/a/X.tsx', '../b/Y.scss') ===
        'packages/app/src/components/b/Y.scss')(),
  )
  t(
    '㉇ 装车锁:collect 必须真的读伴生样式表并 return styles,main 必须把它喂进 audit 且把口径打印出来' +
      '(样式在、判据没跟 = 整族隐身而账面全绿)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const mainBody = src.slice(src.indexOf('function main('))
      return (
        /const styles = \{\}/.test(src) &&
        /styles\[f\] = parts\.join\('\\n'\)/.test(src) &&
        /^    styles,$/m.test(src) &&
        /collected\.styles \?\? \{\}/.test(mainBody) &&
        /读数口径/.test(mainBody) &&
        /取不到伴生样式表/.test(src)
      )
    })(),
  )
  t(
    '㉮ 简写多值声明必须逐值收档:`padding: 0 24rpx` 的 24rpx 要读成 12px' +
      '(实测 CategoryBar 的"仅 RN 档 12"就是漏收第二个值造出的假分叉)',
    (() => {
      const v = readGeometry('.x{\n  padding: 0 24rpx;\n}\n', 'miniapp').values
      const w = readGeometry('.x{\n  margin: 8rpx 0 16rpx auto;\n}\n', 'miniapp').values
      return v.has(12) && w.has(4) && w.has(8)
    })(),
  )
  t(
    '㉯ 反向对照 + 不该计的都不计:单值形态不得被双计,auto / 百分比 / calc 不当档,' +
      '非几何键(padding 之外如 color)不入场',
    (() => {
      const single = [...readGeometry('.x{\n  width: 40px;\n}\n', 'rn').values]
      const junk = readGeometry(
        '.x{\n  padding: 0 auto;\n  width: 100%;\n  height: calc(100% - 8px);\n  color: 3 4px;\n}\n',
        'rn',
      ).values
      return (
        single.filter((n) => n === 40).length === 1 &&
        !junk.has(100) &&
        !junk.has(8) &&
        !junk.has(3) &&
        !junk.has(4)
      )
    })(),
  )
  t(
    '㉰ 同一元素两端各用一种写法必须判同值(简写 vs 显式方向):' +
      '这是本条判据的全部目的,否则它只是多收了几个数而没修好任何一笔账',
    (() => {
      const mp = readGeometry('.x{\n  padding: 0 24rpx;\n}\n', 'miniapp').values
      const rn = readGeometry('paddingHorizontal: 12,\n', 'rn').values
      const d = diffValues(mp, rn)
      return !d.onlyMiniapp.filter((n) => n !== 0).length && !d.onlyRn.length
    })(),
  )
  t(
    '㉱ 装车锁:简写提取式必须真在 readGeometry 体内,且这条锁自己要有牙' +
      '(判据写在别处 = 提交链上永不生效;正则不转义 = 看着断言其实恒假)',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const from = src.indexOf('export function readGeometry')
      const until = src.indexOf('return { values, named }', from)
      const body = src.slice(from, until > from ? until : from + 6000)
      const has = (s) =>
        /if \(vals\.length < 2\) continue/.test(s) &&
        /push\(toPx\(one\[1\], one\[2\], side\)\)/.test(s)
      // 牙:把简写循环整段摘掉后同一条判据必须翻红(否则它就是支恒真断言,比没有更糟)。
      // 用**索引切片**而不是正则 —— 目标文本里本身嵌着正则字面量,再套一层正则必然引号地狱,
      // 而"写复杂的变异表达式"正是本仓记过的"断言看着有、其实恒真"那一型。
      const mk = 'for (const m of code.matchAll(/(?:^|\\n)[\\t ]*([a-z][a-z-]*)'
      const s = body.indexOf(mk)
      const e = body.indexOf('\n  }\n', s)
      const noLoop = s < 0 || e < 0 ? body : body.slice(0, s) + body.slice(e + 5)
      return from > 0 && has(body) && noLoop !== body && !has(noLoop)
    })(),
  )
  t(
    '㉕ 类名提取必须吃真形态(跨行三元 + cn())且必须放过枚举值:' +
      '这条披露曾一次都不触发,而"没触发"在报告里读起来和"没有盲区"一模一样',
    (() => {
      const real =
        'export default function X() {\n' +
        '  return (\n' +
        '    <View\n' +
        "      className={cn('textarea-wrap', !isAmp && !isBig ? 'textarea-int' : '')}\n" +
        '      className2="text-sm bg-muted"\n' +
        '    />\n' +
        '  )\n' +
        '}\n'
      const used = usedClassNames(real)
      // 定长窗口的失败形态:隔壁属性的值被一起捞走(实测第一版因此把 `completed`/`read` 报成类名)
      const neighbor = usedClassNames("<View className={cn('box-shell')} state='completed' />")
      const neg = usedClassNames(
        "const kind = 'react'\nconst src2 = 'image'\nconst v = 'default'\n",
      )
      return (
        used.has('textarea-int') &&
        used.has('textarea-wrap') &&
        !used.has('text-sm') &&
        !used.has('bg-muted') &&
        neg.size === 0 &&
        neighbor.has('box-shell') &&
        !neighbor.has('completed')
      )
    })(),
  )
  t(
    '㉖ unresolvedClassNames 必须把"定义在自家样式表里的"放过、把"落在全局表的"点名',
    (() => {
      const src = 'const X = () => <View className="textarea-int other-box" />'
      const own = '.textarea-int { height: 80rpx; }'
      return (
        unresolvedClassNames(src, own).join() === 'other-box' &&
        unresolvedClassNames(src, own + '.other-box{padding:0}').length === 0
      )
    })(),
  )
  t(
    '㉗ 装车锁:披露必须由 collect 产出、由 main 打印,且不得在空数组时假装"没有盲区"',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const mainBody = src.slice(src.indexOf('function main('))
      return (
        /const blindClasses = \[\]/.test(src) &&
        /\n {4}styles,\n {4}blindClasses,\n/.test(src) &&
        /blindClasses\.push\(/.test(src) &&
        /collected\.blindClasses \?\? \[\]/.test(mainBody) &&
        /读数不完整/.test(mainBody)
      )
    })(),
  )
  t(
    '㉲ 选腿三序之二:出口指向必须压过目录序,而出口没指到任何一份时不得冒充依据(成对)',
    (() => {
      const a = 'packages/app/src/components/Foo.tsx'
      const b = 'packages/app/src/features/cards/Foo.tsx'
      const fwd = pickCandidate([a, b], b)
      const rev = pickCandidate([b, a], b)
      const none = pickCandidate([a, b], null)
      return (
        fwd.chosen === b &&
        fwd.by === 'exit' &&
        fwd.others.join() === a &&
        rev.chosen === b &&
        rev.by === 'exit' &&
        none.chosen === a &&
        none.by === 'order'
      )
    })(),
  )
  t(
    '㉳ 选腿三序之首:平台后缀必须压过出口指向(票⑩ 那一条"构建期真解析 .taro"不得被新加的这支掀翻)',
    (() => {
      const plain = 'apps/miniapp-taro/src/components/Foo.tsx'
      const suffixed = 'apps/miniapp-taro/src/components/Foo.taro.tsx'
      const a = pickCandidate([plain, suffixed], plain)
      const b = pickCandidate([suffixed, plain], plain)
      return (
        a.chosen === suffixed && a.by === 'suffix' && b.chosen === suffixed && b.by === 'suffix'
      )
    })(),
  )
  t(
    '㉴ 三份同名:扩面前后进审的候选逐条点名,且两份实现不得被并成一条假同值腿;' +
      '而"端内自绘层"必须压过出口指向(票#9 —— 本门比的是两端各自屏幕上的那张脸)',
    (() => {
      const mini = ['apps/miniapp-taro/src/components/UserInfoCard.tsx']
      const ownEnd = 'apps/mobile-rn/src/components/UserInfoCard.tsx'
      const sharedComponents = 'packages/app/src/components/UserInfoCard.tsx'
      const feat = 'packages/app/src/features/cards/UserInfoCard.tsx'
      // 扩面前:共享层 + 端内两份都在,没有出口证据 ⇒ 端内胜(它就是该端屏幕渲染的那份),两份都点名
      const b = scan(mini, [sharedComponents, ownEnd], {})
      const bb = b.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 扩面后:三份都在,出口指向 features ⇒ 端内那份仍胜(票#9:出口指向不得把不同层的副本顶上来)
      const a = scan(
        mini,
        [sharedComponents, ownEnd, feat],
        {},
        { rn: new Map([['userinfocard', feat]]) },
      )
      const aa = a.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 成对反向 1:该端**没有**自绘层副本时,出口指向照旧生效(新序不得把旧判据整支吞掉)
      const c = scan(mini, [sharedComponents, feat], {}, { rn: new Map([['userinfocard', feat]]) })
      const cc = c.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      // 成对反向 2:同层两份且无出口证据 ⇒ 仍按先入桶序(兜底那一支还活着;顺序即 SIDES 枚举序,共享层在前)
      const d = scan(mini, [sharedComponents, feat], {})
      const dd = d.multiCandidates.find((e) => e.name === 'UserInfoCard' && e.side === 'rn')
      return (
        b.pairs.length === 1 &&
        a.pairs.length === 1 &&
        !!bb &&
        bb.chosen === ownEnd &&
        bb.others.join() === sharedComponents &&
        bb.by === 'own-end' &&
        !!aa &&
        aa.chosen === ownEnd &&
        aa.by === 'own-end' &&
        aa.others.slice().sort().join() === [sharedComponents, feat].sort().join() &&
        a.pairs[0].rn === ownEnd &&
        a.pairs[0].name === 'UserInfoCard' &&
        !!cc &&
        cc.chosen === feat &&
        cc.by === 'exit' &&
        c.pairs[0].rn === feat &&
        !!dd &&
        dd.chosen === sharedComponents &&
        dd.by === 'order'
      )
    })(),
  )
  t(
    '㊾ 端到端(真临时 git 仓):包入口再导出指向 features 那一份 ⇒ 腿必须是那一份,' +
      '另两份点名在未选里,且不得被记成"换腿"(出口指向不是可达性)',
    (() => {
      const fx = FIXTURE_BASE({
        rn:
          "import { Bar, Foo } from '@ihui/rn-app'\n" +
          "import '../../../../packages/app/src/components/Foo'\n" +
          'export function RootNavigator() { return null }\n',
      })
      fx['packages/app/src/index.ts'] =
        "export { Bar } from './components'\nexport { Foo } from './features/cards'\n"
      fx['packages/app/src/features/cards/index.ts'] = "export { Foo } from './Foo'\n"
      fx['packages/app/src/features/cards/Foo.tsx'] =
        'export function Foo() { return <div style={{ width: 40 }} /> }\n'
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        const p = r.pairs.pairs.find((x) => x.name === 'Foo')
        const mc = (r.pairs.multiCandidates ?? []).find((e) => e.name === 'Foo' && e.side === 'rn')
        return (
          !!p &&
          p.rn === 'packages/app/src/features/cards/Foo.tsx' &&
          !!mc &&
          mc.by === 'exit' &&
          mc.others.includes('packages/app/src/components/Foo.tsx') &&
          (r.fallbacks ?? []).every((f) => f.name !== 'Foo')
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '出口链在真 git 仓面上没跑通 ⇒ 单元层的 pickCandidate 过不等于装车过',
  )
  t(
    '㊿ 反向对照:同一份夹具把出口改指 components 那一份 ⇒ 腿跟着换回去(features 不得因"新加的目录"永远优先)',
    (() => {
      const fx = FIXTURE_BASE({
        rn:
          "import { Bar, Foo } from '@ihui/rn-app'\n" +
          "import '../../../../packages/app/src/features/cards/Foo'\n" +
          'export function RootNavigator() { return null }\n',
      })
      fx['packages/app/src/index.ts'] =
        "export { Bar } from './components'\nexport { Foo } from './components'\n"
      fx['packages/app/src/features/cards/Foo.tsx'] =
        'export function Foo() { return <div style={{ width: 40 }} /> }\n'
      const dir = makeFixtureRepo(fx)
      try {
        const r = collect(dir, 'head')
        const p = r.pairs.pairs.find((x) => x.name === 'Foo')
        const mc = (r.pairs.multiCandidates ?? []).find((e) => e.name === 'Foo' && e.side === 'rn')
        return (
          !!p &&
          p.rn === 'packages/app/src/components/Foo.tsx' &&
          !!mc &&
          mc.chosen === 'packages/app/src/components/Foo.tsx' &&
          mc.by === 'exit' &&
          mc.others.includes('packages/app/src/features/cards/Foo.tsx')
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊀ 装车锁(归一化文本):配对源、出口喂入、双面上报缺任何一个都红 —— 面扩了判据没扩 = 白扩',
    (() => {
      const flat = readFileSync(MAIN_SOURCE_PATH, 'utf8').replace(/\s+/g, ' ')
      return (
        /'packages\/app\/src\/components', 'packages\/app\/src\/features', 'apps\/mobile-rn\/src\/components'/.test(
          flat,
        ) &&
        /exitPreferMaps\(repoRoot, face, probe\.multiCandidates \?\? \[\]\)/.test(flat) &&
        /scan\(lists\.miniapp, lists\.rn, aliases, exit\.maps\)/.test(flat) &&
        /\{ preferMaps: exit\.maps, webPairs \}/.test(flat) &&
        /pruned\.webPairs \?\? webPairs/.test(flat) &&
        /webUnreachable: wPrunedJson/.test(flat) &&
        /multiCandidates: collected\.pairs\?\.multiCandidates \?\? \[\]/.test(flat) &&
        /exitNotes: collected\.exitNotes \?\? \[\]/.test(flat) &&
        /同侧多候选/.test(flat) &&
        /出口链/.test(flat)
      )
    })(),
  )
  t(
    'KH line-height 无单位倍数不得进盒档(实测 0.5 幽灵档的成因),但 height/line-height 邻居仍要收',
    (() => {
      // 负例:小程序 CSS 的 `line-height: 1` 会被 toPx 当 rpx 折半成 0.5 —— 两端都没有这个数
      const css = '.ia-row { line-height: 1; height: 22rpx; letter-spacing: 0.2; }\n'
      const got = readGeometry(css, 'miniapp')
      return (
        !got.values.has(0.5) &&
        !got.values.has(1) &&
        got.values.has(11) && // height: 22rpx = 11px 必须仍然收(排除不能过宽)
        !got.values.has(0.2)
      )
    })(),
  )
  t(
    'KI 单位归属(负例):小程序**写进样式表**的 Npx 与 Nrpx 折出同一个物理量 ⇒ 不得报成跨端分叉',
    (() => {
      const vals = (s, side) => [...readGeometry(s, side).values].sort((a, b) => a - b)
      const mpPx = vals('.row { margin-top: 20px; }', 'miniapp')
      const mpRpx = vals('.row { margin-top: 20rpx; }', 'miniapp')
      const arbitrary = vals('<View className="w-[140px]" />', 'miniapp')
      return (
        JSON.stringify(mpPx) === JSON.stringify(mpRpx) &&
        JSON.stringify(mpPx) === JSON.stringify([10]) &&
        JSON.stringify(arbitrary) === JSON.stringify([70]) &&
        // 对面写 20 就是真 20:归一之后**同元素真差**仍要看得见
        JSON.stringify(vals('.row { margin-top: 20px; }', 'rn')) === JSON.stringify([20])
      )
    })(),
  )
  t(
    'KJ 单位归属(阳性对照):8rpx ↔ 10px 归一后必须是 4 ↔ 10,一格都不许被抹平',
    (() => {
      const mp = readGeometry('.t { font-size: 8rpx; }', 'miniapp').values
      const rn = readGeometry('.t { font-size: 10px; }', 'rn').values
      const d = diffValues(mp, rn)
      return d.onlyMiniapp.join() === '4' && d.onlyRn.join() === '10'
    })(),
  )
  t(
    'KK 单位归属:引号里的运行时 px 不过 postcss ⇒ 仍按真 px 读(实测 AgentRuntimePanel 的 minHeight)',
    (() => {
      const runtime = [...readGeometry("const s = { minHeight: '120px' }", 'miniapp').values]
      const sheet = [...readGeometry('.s { min-height: 120px; }', 'miniapp').values]
      return (
        JSON.stringify(runtime) === JSON.stringify([120]) &&
        JSON.stringify(sheet) === JSON.stringify([60])
      )
    })(),
  )
  t(
    'KL 圆角别名:同文件档位别名必须当档取用并归到元素名;解不到的名字计入读不到;不递别名表时默认口径一位不动',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const aliased = radiusEntriesOf(
        [
          // 别名声明刻意放在**非首行**(真实文件里前面总有 import):取声明行的正则若漏 `m` 旗,
          // `$` 只在整个字符串末尾成立 ⇒ 除首行外每一条声明都解不到,而"解不到"表现为
          // 静默不折叠 ⇒ 门照报绿而别名整族隐身。本仓把 `/…$/` 少 `m` 旗记过两次,这条是它的行为版。
          "import { rnRadius } from '@ihui/design-tokens'",
          "import { View } from '@tarojs/components'",
          '',
          'const INPUT_RADIUS = rnRadius["2xl"]',
          '',
          'const styles = {',
          '  fieldShell: {',
          '    borderRadius: INPUT_RADIUS,',
          '  },',
          '}',
        ].join('\n'),
        tbl,
      )
      const unread = radiusEntriesOf(
        [
          'const styles = {',
          '  fieldShell: {',
          '    borderRadius: IMPORTED_RADIUS,',
          '  },',
          '}',
        ].join('\n'),
        tbl,
      )
      // 守门 11/77/150 共用的默认口径:别名形态整条读不出(RD 不因此长档)
      const untouched = radiusSetOf(
        'const styles = {\n  fieldShell: {\n    borderRadius: INPUT_RADIUS,\n',
        tbl,
      )
      return (
        JSON.stringify(aliased.entries) === JSON.stringify({ fieldShell: [16] }) &&
        aliased.unnamed === 0 &&
        aliased.unresolved === 0 &&
        unread.unresolved === 1 &&
        Object.keys(unread.entries).length === 0 &&
        JSON.stringify(untouched) === JSON.stringify([])
      )
    })(),
  )
  t(
    'KM @media 副本:同一条声明逐字再写一遍只算一份;@media 里改了值就是响应式真分叉,照计',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const copy = radiusEntriesOf(
        [
          '.panel {',
          '  border-radius: 8px;',
          '}',
          '@media (min-width: 480px) {',
          '  .panel {',
          '    border-radius: 8px;',
          '  }',
          '}',
        ].join('\n'),
        tbl,
      )
      const diverging = radiusEntriesOf(
        [
          '.panel {',
          '  border-radius: 8px;',
          '}',
          '@media (min-width: 480px) {',
          '  .panel {',
          '    border-radius: 16px;',
          '  }',
          '}',
        ].join('\n'),
        tbl,
      )
      const anonCopy = radiusEntriesOf(
        [
          'const mk = () => ({',
          '  borderRadius: rnRadius.lg,',
          '})',
          '@media (min-width: 480px) {',
          '  const mk2 = () => ({',
          '    borderRadius: rnRadius.lg,',
          '  })',
          '}',
        ].join('\n'),
        tbl,
      )
      return (
        JSON.stringify(copy.entries) === JSON.stringify({ panel: [8] }) &&
        copy.unnamed === 0 &&
        JSON.stringify(diverging.entries) === JSON.stringify({ panel: [8, 16] }) &&
        diverging.unnamed === 0 &&
        anonCopy.unnamed === 1
      )
    })(),
  )
  t(
    'KN 装车锁(单位只有一份):门内不得再留第二份折算表,折算必须走 lib/length-units',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      return (
        !/\bTO_PX\b/.test(src) &&
        /from '\.\/lib\/length-units\.mjs'/.test(src) &&
        /facePx\(/.test(src) &&
        !/\/\s*RPX_PER_PX|RPX_PER_PX\s*\*/.test(src)
      )
    })(),
  )
  t(
    'KU 装车锁(根槽位维必须装车):读数在 --json 分支**之前**算好、红色折进退出码、' +
      'json 必须暴露 rootSlot —— 缺一条就是"有判据而没人调度",而账面读起来仍全绿',
    (() => {
      const src = readFileSync(MAIN_SOURCE_PATH, 'utf8')
      const at = src.search(/const rs = rootSlotAudit\(\s*collected\.pairs/)
      return (
        at >= 0 &&
        at < src.indexOf("if (argv.includes('--json'))") &&
        /rootSlot: \{\s*findings: rs\.findings/.test(src) &&
        /\+\s*\(geoRed \? 1 : 0\)\s*\+\s*rsRed\.length\s*\?\s*1\s*:\s*0/.test(src) &&
        /rootSlotDelta\(rs\.findings, baseRs\.findings\)/.test(src)
      )
    })(),
  )
  t(
    'KV 根槽位必须字符串安全:引号与模板串里的括号花括号不得破坏深度走查' +
      '(判据跟着字符串漂是同类洞 —— 漂一次的读数是看起来自洽的假分叉)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      const src =
        'const s = "don\'t { break ( ["\n' +
        'const t = `x${y ? "(" : ")" }z`\n' +
        'export default function Foo() {\n' +
        '  return (\n' +
        '    <View className="rounded-lg">\n' +
        '      <View className="rounded-2xl" />\n' +
        '    </View>\n' +
        '  )\n' +
        '}\n'
      const r = rootSlotRadiiOf(src, tbl)
      return r.anchored === true && r.indirect === false && JSON.stringify(r.tiers) === '[8]'
    })(),
  )
  t(
    'KW 端到端(真 git 夹具):真 git 夹具上,内层档凑平集合时 RD 读 0 而 RS 点名 —— ' +
      'miniapp 把 2xl 放组件根、RN 放内层 ⇒ 两侧档位**集合**都是 {8,16},元素级凑平 ⇒ ' +
      'RD 读 0(findings 里没有 Foo),而 RS 在**根槽位**上读出 [16] vs [] 并点名',
    (() => {
      const fx = FIXTURE_BASE({
        rn: "import { Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return <Foo /> }\n",
      })
      fx['apps/miniapp-taro/src/components/Foo.tsx'] =
        'export default function Foo() {\n  return (\n    <View className="rounded-2xl">\n      <View className="rounded-lg" />\n    </View>\n  )\n}\n'
      fx['packages/app/src/components/Foo.tsx'] =
        'export default function Foo() {\n  return (\n    <View>\n      <View className="rounded-2xl" />\n      <View className="rounded-lg" />\n    </View>\n  )\n}\n'
      // 档位表必须随夹具走:collect 对"表取不到而组件在用圆角"判失明。
      // 逐条目一行的真表同构(objectEntries 按行取条目,单行对象会解析为 null)。
      fx['packages/design-tokens/src/radius.js'] = [
        'export const RADIUS_STEPS = {',
        '  xs: 2,',
        '  md: 6,',
        '  lg: 8,',
        '  xl: 12,',
        "  '2xl': 16,",
        '}',
        'export const RADIUS_ROLES = {',
        "  chip: 'md',",
        "  card: 'lg',",
        '}',
        '',
      ].join('\n')
      const dir = makeFixtureRepo(fx)
      try {
        const got = collect(dir, 'head')
        const rd = audit(got.pairs, got.text, {}, got.tiers, got.radius, got.styles ?? {})
        const rs = rootSlotAudit(got.pairs, got.text, got.radius, got.styles ?? {})
        const f = rd.findings.find((x) => x.name === 'Foo')
        const r = rs.findings.find((x) => x.name === 'Foo')
        // 前提:RD 读 0(两侧集合相同 ⇒ 元素级也凑平,这一族不进 RD findings)
        // `rs.undetermined.length === 0` 这条不可省:空 findings 有两个来源(真的一致 / 判据瞎了),
        // 只看 findings 分不开 —— 而"分不开"正是本维要修的那个推断本身。
        return (
          !f &&
          rs.undetermined.length === 0 &&
          !!r &&
          JSON.stringify(r.miniapp) === '[16]' &&
          JSON.stringify(r.rn) === '[]'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    'KX 真仓两型致盲 + 取材错位的回归锁(G-629 阳性对照逼出来的):' +
      '① 参数解构组件必须走出函数体、② 平台宿主 import 不得判成代渲染(跨语句的 import 缠绕不得张冠李戴、' +
      '业务 import 仍须判代渲染)、③ return 与根标签之间夹注释时取材不得错位(pad 等长)',
    (() => {
      const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
      // Carousel 真仓形态:多条 import(本仓无分号风格)+ 参数解构 + 平台宿主元素作根。
      const carouselShape = [
        "import { useTt } from '@/i18n'",
        "import { View } from '@tarojs/components'",
        'export default function Foo({',
        '  items = [],',
        "  className = '',",
        '}: FooProps) {',
        '  return <View className="rounded-2xl" />',
        '}',
        '',
      ].join('\n')
      const a = rootSlotRadiiOf(carouselShape, tbl)
      // 同名但从业务文件 import ⇒ 根由子组件代渲染,仍必须是"读不出"。
      const b = rootSlotRadiiOf(
        "import { View } from './view'\nexport default function Foo() {\n  return <View className=\"rounded-2xl\" />\n}\n",
        tbl,
      )
      // 注释夹在 `return (` 与根标签之间:等长遮罩使取材下标不左移(删注释会切到隔壁材料)。
      const c = rootSlotRadiiOf(
        'export default function Foo() {\n  return (\n    // 层:圆角声明在组件根\n' +
          '    <View className="rounded-2xl" />\n  )\n}\n',
        tbl,
      )
      const raw = 'a\n/* 注释\n * 若干行 */\nb'
      return (
        a.anchored === true &&
        a.indirect === false &&
        JSON.stringify(a.tiers) === '[16]' &&
        b.indirect === true &&
        b.tiers === null &&
        c.indirect === false &&
        JSON.stringify(c.tiers) === '[16]' &&
        stripComments(raw, true).length === raw.length
      )
    })(),
  )
  console.log(`--self-test:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}
