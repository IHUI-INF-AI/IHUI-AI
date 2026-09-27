// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 源脚本的 `__test__`,不复制判据(两份真相必然漂移)。
// 三条"只有源码级锁能防"的东西:
//   ① 本门编号在 runner 里必须恰好出现一次,且全 runner 无重复号(撞号会串 skipEnv 与失败归属);
//   ② 台账必须真在被审面上才算存在 —— 只躺工作树的台账等于没有台账(G-183 同型);
//   ③ 判据不得退回按磁盘读(工作树档被拒),且文档必须点名(守门 89 R4 同一条要求)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as src } from '../check-cross-end-ui-parity.mjs'
import { radiusSetOf } from '../lib/radius-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER = resolve(ROOT, 'scripts/guardian-runner.mjs')
const SELF = resolve(ROOT, 'scripts/check-cross-end-ui-parity.mjs')
const LEDGER_REL = 'scripts/cross-end-ui-parity-baseline.json'
const LEDGER = resolve(ROOT, LEDGER_REL)

const git = (args) =>
  spawnSync('git', ['-c', 'safe.directory=*', ...args], { cwd: ROOT, encoding: 'utf8' })
const headHasLedger = () => git(['cat-file', '-e', `HEAD:${LEDGER_REL}`]).status === 0

/** runner 里定位本门注册块:label 与 script 之间会被 prettier 折行,所以不吃换行。 */
function runnerBlock() {
  const txt = readFileSync(RUNNER, 'utf8')
  const m = txt.match(/id: '(\d+)',[\s\S]{0,400}?script: 'check-cross-end-ui-parity\.mjs',/)
  assert.ok(m, 'guardian-runner 里没有本门(造好没装车)')
  const start = txt.indexOf(m[0])
  return { id: m[1], block: txt.slice(start, start + 1600) }
}

const finding = (name, miniapp = [], rn = []) => ({
  name,
  named: [],
  geometry: { onlyMiniapp: miniapp, onlyRn: rn },
  waived: false,
})

test('T1 装车证明:runner 里必须有本门,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const { block } = runnerBlock()
  assert.match(block, /mode:\s*'blocking'/, '本门必须是 blocking')
  assert.match(
    block,
    /skipEnv:\s*'HUSKY_SKIP_CROSS_END_UI_PARITY'/,
    '无应急出口的 blocking 门只会逼人 --no-verify',
  )
  assert.match(
    block,
    /stagedTriggers:/,
    '必须只在触及两端组件面时问责,否则与改动无关的提交也被钉红',
  )
  assert.match(block, /apps\/miniapp-taro\/src\/components\//, '触发面必须含小程序组件面')
  assert.match(block, /packages\/app\/src\/components\//, '触发面必须含 RN 组件面')
})

test('T2 编号成套:本门在 runner 恰好一次,且全 runner 任何编号不得出现两次', () => {
  const { id } = runnerBlock()
  const txt = readFileSync(RUNNER, 'utf8')
  const all = [...txt.matchAll(/^\s*id: '([^']+)',$/gm)].map((x) => x[1])
  assert.equal(all.filter((x) => x === id).length, 1, `本门编号 ${id} 出现不止一次`)
  const dupes = [...new Set(all.filter((x, i) => all.indexOf(x) !== i))]
  assert.equal(dupes.length, 0, `runner 存在重复编号:${dupes.join(',')} —— 会串 skipEnv 与失败归属`)
})

test('T3 AGENTS.md 与 README.md 必须点名本门(守门 89 R4 的同一条要求)', () => {
  for (const f of ['AGENTS.md', 'README.md'])
    assert.match(
      readFileSync(resolve(ROOT, f), 'utf8'),
      /check-cross-end-ui-parity/,
      `${f} 未点名本门`,
    )
})

test('T4 棘轮两侧都有牙:超锚点红 / 等锚点绿 / 无台账则锚点为 0 / 变好只提示', () => {
  const f = [finding('X', [8, 9])] // diffCount = 2
  assert.equal(src.verdictOf(f, { counts: { X: 2 } }).red.length, 0, '等于锚点不算回潮')
  assert.equal(src.verdictOf(f, { counts: { X: 1 } }).red.length, 1, '超过锚点必须红')
  assert.equal(src.verdictOf(f, {}).red.length, 1, '台账缺该组件 ⇒ 锚点 0 ⇒ 新差异直接红')
  assert.equal(
    src.verdictOf([finding('Y', [8])], { counts: { Y: 5 } }).shrunk.length,
    1,
    '变好只提示下调,不自动改账',
  )
  assert.equal(
    src.verdictOf([finding('Z', [8])], { waivers: { Z: { reason: '平台 chrome 负责顶距' } } }).red
      .length,
    0,
  )
})

test('T5 台账必须在索引里且非空(不在被审面上 = 判据退化成全红)', () => {
  assert.ok(existsSync(LEDGER), '台账文件必须在仓内')
  assert.ok(
    git(['ls-files', '--', LEDGER_REL]).stdout.trim().length > 0,
    '台账未进索引 ⇒ 它不构成被审面的一部分',
  )
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  assert.ok(Object.keys(led.counts).length > 0, '台账不得为空表(空表 = 把全部存量判红)')
  assert.deepEqual(led.waivers, {}, '本票不预先豁免任何组件;要豁免必须逐条写 reason')
})

test('T5b 台账一旦进 HEAD,全量面必须认它(存量锚点永不生效 = 台账白装)', () => {
  if (!headHasLedger()) return // 首次装车那一枚提交尚未落地,由 T8 在 --staged 面证明
  /**
   * "同一枚提交里既收紧判据、又按新口径重锚台账"是本仓的正当形态(与本门 `--staged` 索引优先、
   * 守门 89 的文档面 HEAD∪索引例外同一条理由)。此刻索引里的台账**比 HEAD 新**,
   * 拿旧台账去判新判据必然红 —— 那一红不是在说"锚点没被读到",而是在说"这枚提交还没落地"。
   * 判据失效的表现必须是红,不是"逼人绕钩子",所以这里按面分流:索引与 HEAD 的台账不一致 ⇒ 走 `--staged`
   * (审的就是这枚待落地的状态);两面一致 ⇒ 照旧要求全量面绿。
   */
  const ledgerDirty =
    git(['diff', '--cached', '--name-only', '--', LEDGER_REL]).stdout.trim().length > 0
  const args = ledgerDirty ? [SELF, '--staged'] : [SELF]
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  assert.equal(
    r.status,
    0,
    `台账已在 HEAD 而${ledgerDirty ? '索引' : '全量'}面仍判红 ⇒ 存量锚点没被读到:\n${r.stdout.slice(-500)}`,
  )
})

test('T6 判据有牙:同一份差异在 .jsx 与 .tsx 上必须同判', () => {
  assert.equal(src.scan(['a/NavBar.tsx'], ['b/NavBar.tsx']).pairs.length, 1)
  assert.equal(
    src.scan(['a/NavBar.jsx'], ['b/NavBar.tsx']).pairs.length,
    1,
    '换成 .jsx 就看不见 = 该形态零判据',
  )
})

test('T6b 空扫不得记通过(判据失明必须与"没有差异"可分)', () => {
  assert.equal(src.scan([], []).undetermined, true)
  assert.equal(src.scan(['a/X.tsx'], []).undetermined, true, '一端为空同样是失明')
})

test('T7 工作树档必须被拒(按磁盘判会把错数写回棘轮台账)', () => {
  assert.throws(() => src.faceFromArgv(['--worktree']), /工作树/)
  assert.throws(() => src.faceFromArgv(['--staged', '--worktree']), /不得同用|互斥/)
})

test('T8 真仓跑通:索引面 exit 0,且逐组件实测数与台账锚点逐条相等', () => {
  const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
  })
  assert.equal(r.status, 0, `索引面判红:\n${r.stdout.slice(-600)}`)
  const j = JSON.parse(r.stdout)
  assert.ok(j.pairCount > 0, '配对数 0 = 判据失明')
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  for (const f of j.findings)
    assert.equal(f.diffCount, led.counts[f.name], `${f.name} 实测与台账不符`)
  for (const k of Object.keys(led.counts))
    assert.ok(
      j.findings.some((f) => f.name === k),
      `台账挂着一条已不存在的账:${k}(清单腐烂)`,
    )
})

/**
 * 形状锁一律**比归一化后的文本**:本仓的提交链跑 prettier,参数列表一长就被折成多行,
 * 而"字节形匹配"会在一次与正确性完全无关的重排上判红(实测 T9/T10 就是这么红的)。
 * 正解是让尺子不吃换行,不是把代码缩回一行去喂锁 —— 后者只是把下一次假红推迟到 prettier
 * 再折一次的时候。
 */
const flat = (s) => s.replace(/\s+/g, ' ')

test('T9 主判定不得被摘线(函数在但没人调 = 提交链上一路绿灯)', () => {
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.ok(/export function collect\(/.test(txt), 'collect 被摘线')
  assert.ok(/audit\(\s*collected\.pairs/.test(txt), 'main 不再调用主判定 ⇒ 门形同虚设')
})

test('T10 具名档、单侧档与圆角三维都必须真接进 main(算出来又丢掉 = 判据没装车)', () => {
  const txt = flat(readFileSync(SELF, 'utf8'))
  /**
   * 取实参列表再判"含不含",不写死完整签名:签名会因尾随逗号、折行、加参数而变形,
   * 而本锁要防的失效型是**少喂一个档表**,不是"签名长得跟某一次提交一样"。
   * (第一版在这里写了 `specLegAudit\( collected\.` 这种"`(` 后带空格"的形 —— `flat()` 只折叠
   *  已有空白、不会插入空白,所以真源码 `specLegAudit(collected.pairs` 永不匹配:锁自己假红。)
   */
  const argsAfter = (fn) => {
    const m = new RegExp(`\\b${fn}\\(([^)]*)\\)`).exec(txt)
    return m ? m[1] : null
  }
  const auditArgs = argsAfter('const res = audit')
  assert.ok(auditArgs, '找不到 main 里的 audit 调用(判据被搬走 ⇒ 本锁失效,必须同步本测试)')
  for (const need of ['collected.pairs', 'collected.tiers', 'collected.radius'])
    assert.ok(auditArgs.includes(need), `collect 算了 ${need} 而 audit 没收到 ⇒ 那一整维隐身`)
  assert.ok(/export function specLegAudit\(/.test(txt), 'specLegAudit 被摘线')
  const slArgs = argsAfter('const sl = specLegAudit')
  assert.ok(
    slArgs && slArgs.includes('collected.tiers'),
    'main 没调用 specLegAudit(或没喂 tiers)⇒ SL 只是自检里的摆设',
  )
  assert.ok(
    /res\.red\.length \+ icRed\.length \+ slRed\.length/.test(txt),
    'slRed 没进退出码 ⇒ SL 判红了也不拦提交',
  )
})

test('T12 拆对声明必须成套:进配对层、被打印、坏声明与双记账都进退出码', () => {
  const txt = readFileSync(SELF, 'utf8')
  assert.ok(/export function rejectProblem\(/.test(txt), 'rejectProblem 被摘线')
  assert.ok(/rejected:\s*rejNames/.test(txt), 'collect 没收到拆对名单 ⇒ 声明形同注释')
  assert.ok(/rejected: rejectedHits/.test(txt), 'collect 算出被拆族却不交回调用方 ⇒ 静默消失')
  assert.ok(
    /rejInvalid\.length \+ rejStillAnchored\.length \+ rejGhosted\.length/.test(txt),
    '三条红少算任何一条 ⇒ 坏声明可以静默存在',
  )
  assert.ok(
    /if \(prior && prior\.pairingRejects\)/.test(txt),
    'emitBaseline 不带走 pairingRejects ⇒ 重生成台账会冲掉他人的拆对声明(守门 83 同型)',
  )
})

test('T11 G 维必须把 geometry.d.ts 一起取进被审面(只对表 ⇒ 类型那份真相永不在尺子上)', () => {
  const txt = readFileSync(SELF, 'utf8')
  assert.ok(
    /packages\/design-tokens\/src\/geometry\.d\.ts/.test(txt),
    '几何表的类型声明没被取面 ⇒ 表↔类型漂移只能靠有人手跑 typecheck',
  )
  assert.ok(
    /hasGeo && !hasGeoDts/.test(txt),
    '有表而无类型声明必须判"未判定",不得当成一致(把失明写成通过)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T13 --emit-baseline 的 stdout 只能是 JSON(说明行走 stderr)', () => {
  // 这一枚台账模板的既定用法就是 `--emit-baseline > <台账文件>`。
  // 实测把说明行打进 stdout 会把一句散文追加进 JSON 文件,后果不是"报告难看",
  // 而是 lint-staged 在**下一次提交当场**崩(JSON 坏了)+ 门自己从此 exit 2 无法判定。
  const src = readFileSync(SELF, 'utf8')
  const m = src.match(/if \(argv\.includes\('--emit-baseline'\)\)\s*\{([\s\S]*?)\n  \}/)
  assert.ok(m, '找不到 --emit-baseline 分支(判据被改名/搬走 ⇒ 本锁失效,必须同步本测试)')
  const body = m[1]
  assert.equal(
    (body.match(/console\.log\(/g) ?? []).length,
    1,
    'console.log 只能出现一次(那一次必须是 JSON.stringify)',
  )
  assert.ok(/console\.log\(JSON\.stringify/.test(body), '唯一的 console.log 必须是打 JSON 那一条')
  assert.ok(/console\.error\(/.test(body), '说明行必须走 console.error(stderr)')
})

/* ── RD 维(2026-09-27 补):圆角跨端同档。立项时本门用一条正则把圆角整族排除,
 *    注释称"守门 77 会管",而 77 判的是值的源头、不判同一元素跨端取档 —— 这一型因此
 *    一路报绿到用户实拍。下面四枚锁钉的是"这一维不可能再被静默摘掉"。 ── */

test('T14 圆角档位表必须从被审面读,不得 import 磁盘版(抄了就是对着旧表打分)', () => {
  const txt = readFileSync(SELF, 'utf8')
  assert.ok(
    /radiusLookup\(specSources\[radiusPath\]\)/.test(txt),
    '档位表没走 specSources(被审面)⇒ 门会在档位改值后继续用旧数打分',
  )
  assert.ok(
    !/from\s+['"][^'"]*design-tokens[^'"]*radius/.test(txt),
    '禁止直接 import 磁盘版 radius.js —— 与"清单来自磁盘、内容来自 git 会造出自洽却错位的尺子"同型',
  )
  // 取不到表必须喊失明,不得退化成"没有差异"
  assert.ok(/圆角维判据失明/.test(txt), '缺"圆角维判据失明"的 Undetermined 出口')
})

test('T15 radiusCounts 必须由 emitBaseline 写出且恒含全部配对(缺键=锚点 0,会把存量判成新增)', () => {
  const out = src.emitBaseline(
    [
      {
        name: 'A',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [8], onlyRn: [12] },
      },
      {
        name: 'B',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
      },
    ],
    { pairingRejects: { FloatBox: { reason: '同名不同物', until: '2099-01-01' } } },
  )
  assert.equal(out.radiusCounts.A, 2, 'RD 差异没进台账 ⇒ 下一次提交把它当新增判红')
  assert.equal(
    out.radiusCounts.B,
    0,
    '同档的组件也必须留 0 键 ⇒ 否则"没配账"与"已同值"在账面上同形',
  )
  assert.ok(out.pairingRejects?.FloatBox, '重写台账冲掉了别人的拆对声明(守门 83 同型)')
  assert.equal(out.counts.A, 0, '几何锚点被圆角污染 ⇒ 两维互相顶掉')
})

test('T16 豁免判据不得有第二份实现(radius-exempt 语义必须走共享 lib)', () => {
  const txt = readFileSync(SELF, 'utf8')
  assert.ok(
    /from '\.\/lib\/radius-tokens\.mjs'/.test(txt),
    '没引共享 lib ⇒ 与守门 77 各写一遍豁免,同一处标记会一边认一边判红',
  )
  assert.ok(
    !/\/radius-exempt\//.test(txt),
    '本门里又写了一份 radius-exempt 正则 ⇒ 两处算同一件事必漂移',
  )
})

test('T17 RD 判据端到端有牙:同一对文件,表里改一档必须让结论翻红', () => {
  const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
  const mini = 'className="rounded-lg"\n'
  const rnSame = 'borderRadius: rnRadius.lg,\n'
  const rnOff = 'borderRadius: rnRadius.xl,\n'
  assert.deepEqual(radiusSetOf(mini, tbl), radiusSetOf(rnSame, tbl), '同档两种写法被判不同 ⇒ 假红')
  assert.notDeepEqual(radiusSetOf(mini, tbl), radiusSetOf(rnOff, tbl), '差一档被判相同 ⇒ 判据无牙')
  // 反第二真相锁:表改值,读数必须跟着改(证明表是输入而不是抄死的数字)
  assert.deepEqual(
    radiusSetOf(mini, { ...tbl, lg: 10 }),
    [10],
    '档位表改了而判据不跟 ⇒ 对着旧表打分',
  )
})

test('T13 配对射程必须自己报数,且只报数不进退出码', () => {
  const src = readFileSync(SELF, 'utf8')
  assert.match(
    src,
    /配对射程:仅小程序成文件/,
    '射程边界不出声 ⇒ "N 对全绿"会被读成"两端界面全一致"',
  )
  assert.match(src, /零判据\(报数,不判红\)/, '必须明写它对这批元素零判据')
  // 反向锁:这一维不得被顺手接进 red 聚合 —— 75/50 个未配对名是**结构边界**不是违规,
  // 把它判红就是一台谁也修不动的恒红门(§12e 同型),唯一结局是各会话跳门。
  const iPrint = src.indexOf('配对射程:仅小程序成文件')
  assert.ok(iPrint > 0, '打印点不见')
  const window = src.slice(iPrint - 1200, iPrint + 400)
  assert.ok(
    !/\breturn\b[^\n]*icRed|\bred\.push\([^\n]*onlyMiniapp/.test(window),
    '射程报数不得进红聚合',
  )
})
