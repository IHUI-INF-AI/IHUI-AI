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
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { bareRoundedOccurrences, radiusSetOf } from '../lib/radius-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER = resolve(ROOT, 'scripts/guardian-runner.mjs')
const SELF = resolve(ROOT, 'scripts/check-cross-end-ui-parity.mjs')
const LEDGER_REL = 'scripts/cross-end-ui-parity-baseline.json'
const LEDGER = resolve(ROOT, LEDGER_REL)

/**
 * 在"出处面"(某枚历史提交的整棵树)上跑同一把尺子 —— 阳性对照钉出处而不是钉 HEAD(AGENTS 已把这条
 * 立成规矩:账还清那天,"HEAD 上还能量到存量"这句话当场失效,而判据失效的表现永远是安静)。
 * 返回 {ok, json, why}:ok=false 时 why 必须写清是跑不动还是解不出 ⇒ 调用方不得把"没跑到"读成"没有"。
 */
function runAtRef(ref) {
  const dir = mkScratch('g128-pin-')
  const idx = resolve(dir, 'side.idx')
  try {
    const rt = gitWithEnv(['read-tree', ref], { GIT_INDEX_FILE: idx })
    if (rt.status !== 0) return { ok: false, why: `read-tree ${ref} 失败:${String(rt.stderr).trim().slice(0, 120)}` }
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, GIT_INDEX_FILE: idx },
      timeout: 600000,
      maxBuffer: 128 * 1024 * 1024,
    })
    // rc 0 与 rc 1 **都算"跑出了结论"**:退出码里的 1 是"相对当今天台账的棘轮红了",而出处面的锚点
    // 本就不是为那一棵树校准的(给 web 腿装上首锚之后,任何一枚早于它的 ref 都会超锚 ⇒ 旧写法把
    // "有结论"读成"跑不动")。只有 rc≥2(故障/无法判定)或 JSON 解不出才算没跑到 —— 那才是本函数
    // 存在的理由:调用方不得把"没判"读成"没有"。放宽 rc 不影响被钉的那半句(断言读的是 json.exitNotes)。
    if (r.status !== 0 && r.status !== 1)
      return { ok: false, why: `尺子在 ${ref} 面 rc=${r.status}:${String(r.stdout || r.stderr).slice(-160)}` }
    let json
    try {
      json = JSON.parse(r.stdout)
    } catch (e) {
      return { ok: false, why: `${ref} 面的 --json 不可解析:${e.message}` }
    }
    return { ok: true, json, rc: r.status }
  } finally {
    rmScratch(dir)
  }
}

const gitWithEnv = (args, env) =>
  spawnSync('C:/Program Files/Git/bin/git.exe', ['-c', 'safe.directory=*', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 180000,
  })

const git = (args) =>
  spawnSync('git', ['-c', 'safe.directory=*', ...args], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, encoding: 'utf8' })
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
  /**
   * 原来这条断言的是 `deepEqual(led.waivers, {})` —— 它的含义是"建门那一枚提交不预先豁免任何组件",
   * 不是"永远不许有豁免"。票⑬ 把 13 族差异逐条登记了带理由的豁免(AGENTS O81:静默不同形算违规),
   * 于是那条锁从"防滥用"退化成了"禁止合规"。改成判它真正在乎的东西:
   * **每一条豁免都必须带可读的理由**,空理由/缺理由一律红 —— 比"必须为空"严格更强。
   */
  for (const [name, w] of Object.entries(led.waivers ?? {}))
    assert.ok(
      typeof w?.reason === 'string' && w.reason.trim().length >= 6,
      `豁免 ${name} 没有可复核的理由(豁免是登记,不是消红通道)`,
    )
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
  const r = spawnSync(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, encoding: 'utf8', timeout: 180000 })
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
    stdio: ['ignore', 'pipe', 'pipe'],
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
  // 本组钉的是**门体源码的写法**(装车是否成套),不是被审对象长什么样 ⇒ 整组走守门 191 的 P2
  //   形状锁通道:`assert.match(<某文件正文>, /…/)`,主语按惯例命名 `*Src`(混用 `assert.ok(re.test())`
  //   会让前一处的调用窗口吃掉本行的形状,认不出这是形状锁 ⇒ 落命中)。
  const gateSrc = readFileSync(SELF, 'utf8')
  assert.match(gateSrc, /export function rejectProblem\(/, 'rejectProblem 被摘线')
  assert.match(gateSrc, /rejected:\s*rejNames/, 'collect 没收到拆对名单 ⇒ 声明形同注释')
  assert.match(gateSrc, /rejected: rejectedHits/, 'collect 算出被拆族却不交回调用方 ⇒ 静默消失')
  assert.match(
    gateSrc,
    /rejInvalid\.length \+ rejStillAnchored\.length \+ rejGhosted\.length/,
    '三条红少算任何一条 ⇒ 坏声明可以静默存在',
  )
  assert.match(
    gateSrc,
    /if \(prior && prior\.pairingRejects\)/,
    'emitBaseline 不带走 pairingRejects ⇒ 重生成台账会冲掉他人的拆对声明(守门 83 同型)',
  )
})

test('T11 G 维必须把 geometry.d.ts 一起取进被审面(只对表 ⇒ 类型那份真相永不在尺子上)', () => {
  // 同上:钉的是门体取面写法(P2 形状锁),路径本身的真值住在门体里,本文件不另立一份。
  const gateSrc = readFileSync(SELF, 'utf8')
  assert.match(
    gateSrc,
    /packages\/design-tokens\/src\/geometry\.d\.ts/,
    '几何表的类型声明没被取面 ⇒ 表↔类型漂移只能靠有人手跑 typecheck',
  )
  assert.match(
    gateSrc,
    /hasGeo && !hasGeoDts/,
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

/* ── RE 维(2026-09-27 补):圆角按**同名元素**配对,而非按文件内档值集合。
 *    立项依据是一条实测读数:RD 报的 10 对"圆角跨端不同档",按元素名去查一对都不成立 ——
 *    `NavBar` 的「仅小程序 4」对面那一侧根本没有圆角声明。照那种读数补数字 = 制造视觉回归,
 *    所以 RE 必须（a）真接进 audit、（b）有自己的锚点、（c）红能单独归因、
 *    (d)报名而不判红的那一格不得被顺手接进退出码。下面各锁按 flat() 比归一化文本 ——
 *    prettier 一折行,字节形匹配就会在一次与正确性无关的重排上假红(T9/T10 的旧教训)。 ── */

test('T18 RE 判据必须真接进 audit():函数在、自检过,而 audit 没调 = 提交链上一路绿灯', () => {
  const raw = readFileSync(SELF, 'utf8')
  const from = raw.indexOf('export function audit(')
  const to = raw.indexOf('export function verdictOf(')
  assert.ok(from >= 0 && to > from, '找不到 audit 函数体(被改名/搬走 ⇒ 本锁失效,必须同步本测试)')
  // 先切范围(需要换行做锚点)再归一化 —— 顺序反过来等于拿 flat() 之后的文本去找 `\n`,
  // 那把锁会对任何正确写法恒假(与本门 T9/T10 撞过的字节形假红同一条教训,只是方向相反)。
  const a = flat(raw.slice(from, to))
  for (const need of [
    'radiusEntriesOf(aAll, radiusTable)',
    'radiusEntriesOf(bAll, radiusTable)',
    'elementRadiusDiff(erA.entries, erB.entries)',
  ])
    assert.ok(a.includes(need), `audit 体内缺 ${need} ⇒ RE 只是自检里的摆设`)
  // 三态必须各自落地:红走 mismatched,报名走 onlyMiniapp/onlyRn
  assert.ok(a.includes('elementRadius.mismatched.length'), 'skip 条件未纳入 RE ⇒ RE 永远进不了 findings')
})

test('T19 RE 锚点必须第三家独立:写得出(含 0)、读得到、且不与 RD/几何 互相顶名额', () => {
  const out = src.emitBaseline(
    [
      {
        name: 'A',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
        elementRadius: { mismatched: [{ name: 'card', miniapp: [8], rn: [12] }] },
      },
      {
        name: 'B',
        named: [],
        geometry: { onlyMiniapp: [], onlyRn: [] },
        radius: { onlyMiniapp: [], onlyRn: [] },
        elementRadius: { mismatched: [] },
      },
    ],
    { pairingRejects: { FloatBox: { reason: '同名不同物', until: '2099-01-01' } } },
  )
  assert.equal(out.elementRadiusCounts.A, 1, 'RE 差异没进台账 ⇒ 下一次提交把它当新增判红')
  assert.equal(out.elementRadiusCounts.B, 0, '同档也要留 0 键 ⇒ 否则"没配账"与"已同值"同形')
  assert.equal(out.radiusCounts.A, 0, 'RE 污染了 RD 锚点 ⇒ 两维互相顶掉')
  assert.equal(out.counts.A, 0, 'RE 污染了几何锚点')
  assert.ok(out.pairingRejects?.FloatBox, 'emitBaseline 必须原样带走他人的拆对声明')
  // 三维各自只减不增:RE 上升而另两维下降 ⇒ 必须仍红(净零逃逸是本锚点分家的全部理由)
  const f = out && {
    name: 'A',
    named: [],
    geometry: { onlyMiniapp: [], onlyRn: [] },
    radius: { onlyMiniapp: [], onlyRn: [] },
    elementRadius: { mismatched: [{ name: 'card', miniapp: [8], rn: [12] }] },
  }
  const v = src.verdictOf([f], {
    counts: { A: 5 },
    radiusCounts: { A: 4 },
    elementRadiusCounts: { A: 0 },
  })
  assert.equal(v.red.length, 1, '另两维下调就把 RE 的新分叉顶掉 ⇒ 锚点没分家')
  assert.match(v.red[0].over.join(' '), /同名元素圆角 1 > 锚点 0/)
})

test('T20 重出台账必须先过单调性闸,且拒绝走 stderr(stdout 只能是 JSON)', () => {
  assert.deepEqual(
    src.anchorRegression({ counts: { A: 2 } }, { counts: { A: 3 } }).length,
    1,
    '锚点上升必须被点名',
  )
  assert.equal(src.anchorRegression({ counts: { A: 2 } }, { counts: {} }).length, 1)
  assert.equal(src.anchorRegression({ counts: { A: 2 } }, { counts: { A: 1 } }).length, 0)
  const txt = readFileSync(SELF, 'utf8')
  const m = txt.match(/if \(argv\.includes\('--emit-baseline'\)\)\s*\{([\s\S]*?)\n  \}/)
  assert.ok(m, '找不到 --emit-baseline 分支')
  const body = m[1]
  assert.ok(/anchorRegression\(baseline, next\)/.test(body), '闸没接进重锚出口 ⇒ 只是散文规矩')
  assert.ok(/console\.error\(/.test(body) && /return 1/.test(body), '拒绝必须走 stderr 并非零退出')
  assert.equal(
    (body.match(/console\.log\(/g) ?? []).length,
    1,
    'stdout 只能有那一处 JSON(散文进 stdout 会砸碎 `--emit-baseline > 台账`)',
  )
})

test('T21 RE 射程边界必须报名且不得进退出码(覆盖面不是违规,判红就是谁也修不动的恒红门)', () => {
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.match(txt, /本维零判据/, '射程边界不出声 ⇒ "RE 报 0" 会被读成"两端圆角全一致"')
  assert.match(txt, /无元素名可归的取用/, 'must 连"多少取用无处归属"一起报,否则缺口被藏')
  assert.match(txt, /RE 对 \$\{res\.radiusUnpaired\?\.length \?\? 0\} 族零判据/)
  // 反向锁:radiusUnpaired 不得被接进红聚合或退出码求和
  const iPrint = txt.indexOf('本维零判据')
  const window = txt.slice(Math.max(0, iPrint - 1500), iPrint + 1200)
  assert.ok(
    !/red\.push\([^)]*radiusUnpaired|radiusUnpaired[^|]*\+ res\.red\.length/.test(window),
    '射程报名不得进红聚合(§12e 同型:恒红门的唯一结局是各会话跳门)',
  )
})

test('T22 圆角按元素归属的解析只许一份实现(遮罩/豁免在别处再写一遍必然漂移)', () => {
  const gate = readFileSync(SELF, 'utf8')
  // 锁按归一化文本比:长 import 会被 prettier 折成多行,而这条锁在乎的是"从共享 lib 引"这一事实。
  // 取该模块**全部** import 语句的说明符并集(2026-10-11):符号分两条语句写是合法书写,
  // 只取第一条会把"另起一行导"读成"不再由 lib 供给"⇒ 形状锁必须钉不变量,不能钉语句条数。
  const specifiers = [...flat(gate).matchAll(/import \{([^}]*)\} from '\.\/lib\/radius-tokens\.mjs'/g)]
    .map((m) => m[1])
    .join(',')
  assert.ok(specifiers.length > 0, '门不再从 radius-tokens 引实现 ⇒ 圆角解析退回各写一套')
  for (const sym of ['radiusEntriesOf', 'radiusSetOf', 'bareRoundedOccurrences'])
    assert.ok(
      new RegExp(`\\b${sym}\\b`).test(specifiers),
      `${sym} 不再由 lib 供给 ⇒ 同一处写法一边认一边漏(裸档识别尤其如此)`,
    )
  assert.ok(
    !/function radiusEntriesOf|function blockOwnerOf|maskComments/.test(gate),
    '门内不得再有第二份圆角解析或遮罩实现(与守门 77 各写一遍 = 同一处标记一边认一边判红)',
  )
  const lib = readFileSync(resolve(ROOT, 'scripts/lib/radius-tokens.mjs'), 'utf8')
  assert.equal(
    (lib.match(/function maskComments\(/g) ?? []).length,
    1,
    'lib 内的遮罩只能有一份',
  )
})

/**
 * T20 方向与角形态(`rounded-t-2xl` / `rounded-tr-sm`)必须在圆角尺子的射程内。
 * 立票理由不是"多认一种写法":小程序把底部弹层写成方向形态、RN 写成整格形态时,
 * 旧尺子只在小程序那一侧读不到那一档,于是 RD 产出**凭空造出的跨端分叉** ——
 * 漏读一侧的表现不是少几个数,而是把同一档报成两端不同值。
 * 阳性对照刻意取真仓 HEAD 的实际站点而非夹具:夹具只能证明函数会给答案,
 * 证不了这条判据在真仓上不是恒空。
 */
test('T20 方向形态真仓阳性对照 + 窄正则不得回来(漏计一侧 = 造出假分叉)', () => {
  const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16 }
  // 现役站点:票㉜ 把 DrawerComponent 的档位从 xl 收到 lg(角色表 card→lg),方向形态本身没变;
  // 这一族里 `rounded-t-2xl` 仍在的两处是弹层底,取第一个。**阳性对照要的是"这一型还在射程内",
  // 不是某一行**——所以要换现役站点而不是把测试删掉。
  const drawer = git(['show', 'HEAD:apps/miniapp-taro/src/components/VipBenefitsPopup.tsx']).stdout
  assert.ok(drawer.includes('rounded-t-2xl'), '真仓那一处站点搬家了 ⇒ 本对照失效,要换成现役站点而不是删测试')
  assert.ok(
    radiusSetOf(drawer, tbl).includes(16),
    'rounded-t-2xl 读不出 16 ⇒ 门会把小程序的 16 报成"仅 RN 有 16",凭空一对分叉',
  )
  const libSrc = readFileSync(resolve(ROOT, 'scripts/lib/radius-tokens.mjs'), 'utf8')
  assert.match(libSrc, /tr\|tl\|br\|bl/, '方向分支被退回窄正则 ⇒ 整族底部弹层再次隐身,而账面只会变好看')
  assert.deepEqual(radiusSetOf('<View className="rounded-full" />', tbl), [], 'rounded-full 归守门 11,不得被这一维计成档')
  assert.deepEqual(radiusSetOf('<View className="rounded-none" />', tbl), [], 'rounded-none 是 0,不是"该取哪档"的判断')
  // 反向回归锁:门自检里那条方向用例被整文件回写抹掉时,本测试必须红(否则下一个人只会看到读数变少、账面变好看)
  const gateSrc = readFileSync(SELF, 'utf8').replace(/\s+/g, ' ')
  assert.match(gateSrc, /方向与角形态必须与整格形态同判/, '自检里的方向用例不见了 ⇒ 判据被回退')
})

/**
 * T23~T25 配对源扩面(O81 票⑭)的装车锁。
 * 立票理由不是"多扫一个目录":`packages/app/src/features/**` 此前不在配对源里,而
 * `packages/app/src/index.ts` 的 `UserInfoCard` 出口指向的正是 `features/cards/` 那一份 ——
 * 同族三份活实现,改真正被导出的那一份**不移动任何读数**,绿灯建立在另外两份身上。
 * 所以这三条锁各自钉一个失效型:
 *   T23 面扩了但判据没扩(SIDES 加一行、scan/prune 不喂出口指向 = 白扩);
 *   T24 候选点名与"一份族一条腿"(静默选一份 / 同一族记两次账 都在这里翻红);
 *   T25 两侧都扫 + 选腿比较器只许一份(配对层与换腿各写一套序 = 同一族两处选到不同份)。
 * 形状锁一律比归一化文本、取实参列表再判"含不含"(T10 同一课:锁死字节形会在一次
 * 与正确性无关的 prettier 重排上假红)。
 */
test('T23 扩面装车锁:features 必须在 rn 配对源里,出口指向必须真接进 scan 与换腿', () => {
  const txt = flat(readFileSync(SELF, 'utf8'))
  const sides = /const SIDES = \{[^}]*rn: \[([^\]]*)\]/.exec(txt)
  assert.ok(sides, '找不到 SIDES 的 rn 配对源清单(整块搬家了要同步改本锁,不得删锁)')
  for (const d of [
    'apps/mobile-rn/src/components',
    'packages/app/src/components',
    'packages/app/src/features',
  ])
    assert.ok(sides[1].includes(`'${d}'`), `rn 配对源缺 ${d} ⇒ 那一整面改名不移动任何读数`)
  const argsAfter = (label) => {
    const m = new RegExp(`\\b${label}\\(([^)]*)\\)`).exec(txt)
    return m ? m[1] : null
  }
  assert.ok(
    /const probe = scan\(/.test(txt),
    '缺"扩面后先探一遍同侧多候选"⇒ 出口指向算不出来,三序退化成平台后缀 + 目录序',
  )
  const scanArgs = argsAfter('let pairs = scan')
  assert.ok(
    scanArgs && /exit\.maps/.test(scanArgs),
    'collect 探到出口指向却不喂给 scan ⇒ 出口链是算了丢掉的第二份真相',
  )
  const pruneArgs = argsAfter('const pruned = pruneUnreachableLegs')
  assert.ok(
    pruneArgs && /preferMaps/.test(pruneArgs),
    '可达性换腿没收到 preferMaps ⇒ 换完腿就把"出口指的是哪一份"抹平了',
  )
})

test('T24 三份同名:进审候选逐条点名 + 一份族只许一条腿(真仓阳性对照)', () => {
  const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
  })
  assert.equal(r.status, 0, `索引面判红:\n${(r.stdout || r.stderr || '').slice(-600)}`)
  const j = JSON.parse(r.stdout)
  assert.ok(Array.isArray(j.multiCandidates), '--json 不暴露 multiCandidates ⇒ 人读报告的点名无源可查')
  const mc = j.multiCandidates
  assert.ok(mc.length > 0, '同侧多候选在真仓恒空 ⇒ 披露半边没人看过,自检过不等于装车')
  for (const e of mc) {
    assert.ok(e.chosen && Array.isArray(e.others) && e.others.length > 0, `多候选腿没点名未选:${e.name}`)
    assert.ok(!e.others.includes(e.chosen), `${e.name} 选中的那份又出现在未选名单里`)
    assert.ok(
      ['suffix', 'own-end', 'exit', 'order'].includes(e.by),
      `${e.name} 的依据不在"后缀 > 同端自绘层 > 出口 > 目录序"里`,
    )
    assert.ok(['rn', 'miniapp'].includes(e.side), `${e.name} 报不出是哪一侧的多候选`)
  }
  const keys = mc.map((e) => `${e.name}@${e.side}`)
  assert.equal(new Set(keys).size, keys.length, '同一族同一侧被点名两次 ⇒ 候选没有收敛成一个桶')
  const found = j.findings.map((f) => f.name)
  assert.equal(new Set(found).size, found.length, '同名族被拆成多条腿 ⇒ 同一族差异记两次账、锚点虚高')
  const ui = mc.find((e) => e.name === 'UserInfoCard')
  assert.ok(
    ui,
    '真仓不再有三份同名的 UserInfoCard 腿 ⇒ 换成现役的多候选族继续钉,别把锁删掉',
  )
  // 票#9(2026-09-29):RN 侧 UserInfoCard 有三份活实现,而 `apps/mobile-rn/src/components/` 那份
  // 才是 ProfileScreen 直接 import、与小程序端 `apps/miniapp-taro/src/components/` 对位的那一张脸;
  // 出口指向(features/cards)那份被别的屏用 —— 按出口选会拿两个不同元素互相记账。
  // 所以这一格的现行期望是"同端自绘层胜";若它改回 'exit',说明新序被摘掉,选腿重新按包出口走。
  assert.equal(ui.by, 'own-end', '三候选的裁决不再是"同端自绘层" ⇒ 票#9 那一序被摘掉或改了形')
  assert.match(
    ui.chosen,
    /^apps\/mobile-rn\/src\/components\//,
    '选中的腿不是该端屏幕真渲染的那一份(端内自绘层)',
  )
  // 出口链判据的阳性对照**改钉出处,不钉 HEAD**(2026-09-30 O92 票④)。
  // 原判据要求"HEAD 面 exitNotes 必须 >0",而 notes 记的是这条判据**不生效时的报名**
  // (链上取不到文件 / 解到多份定义 / 解不到定义),不是"成功解到了"。O92 票④ 摘除
  // packages/app/src/components/SectionHeader.tsx 及其出口行后,真仓最后一个"解不到定义"的点消失
  // ⇒ HEAD 归零是清账的正当结果,把它读成"出口链被摘线"是错的,而把锁钉在任何一天的 HEAD 上,
  // 等于让下一个合法清账的人被迫拆锁(本仓为这一刻记过的正解:对照钉出处 ref + 反向锁)。
  assert.ok(Array.isArray(j.exitNotes), '--json 不暴露 exitNotes ⇒ 判据不生效时无从报名(真恒绿)')
  const PINNED_EXIT_REF = '4f1f7e84d4^'
  const pinned = runAtRef(PINNED_EXIT_REF)
  assert.ok(pinned.ok, `出处面 ${PINNED_EXIT_REF} 跑不出结论(未判定,不等于没有):${pinned.why}`)
  // 允许 rc=1 的代价由这一条兜住:出了红必须同时拿出**结构完整**的判定 —— 空对象/半截输出不算跑到。
  // (只放宽退出码、不加这一句,等于让"崩在半路而恰好打了点字"冒充结论。)
  assert.ok(
    Array.isArray(pinned.json.findings) && pinned.json.findings.length > 0,
    `出处面 ${PINNED_EXIT_REF} 报了退出码却没有配对 ⇒ "跑出了结论"是假的,不得拿 rc 冒充判定`,
  )
  assert.ok(
    Array.isArray(pinned.json.exitNotes) && pinned.json.exitNotes.length > 0,
    `出处面 ${PINNED_EXIT_REF} 的出口链报名归零 ⇒ "判不出必须报名"这一半真被摘线了(不是账清了)`,
  )
  assert.ok(
    ui.others.includes('packages/app/src/components/UserInfoCard.tsx'),
    '未选名单漏了 components 那一份 ⇒ 点名只点一半',
  )
})

test('T24b 出处面跑不动时仍须判"没跑到"(放宽 rc 的反向锁:不得变成无条件接受)', () => {
  const r = runAtRef('0000000000000000000000000000000000000000')
  assert.equal(r.ok, false, '一个根本不存在的 ref 被读成"跑出了结论" ⇒ 本函数的失败分支没牙')
  assert.match(r.why, /read-tree/, `失败原因没落到实际那一步(得让人看出是取不到面还是尺子崩了):${r.why}`)
})

test('T25 同侧多候选不得只查一侧;选腿比较器与出口链只许一份实现', () => {
  const mini = [
    'apps/miniapp-taro/src/components/Foo.tsx',
    'apps/miniapp-taro/src/components/Foo.taro.tsx',
  ]
  const rn = ['packages/app/src/features/cards/Foo.tsx']
  const s = src.scan(mini, rn, {}, {})
  const m = s.multiCandidates.filter((e) => e.name === 'Foo')
  assert.equal(m.length, 1, '小程序侧的同名多候选没被点名 ⇒ 披露只覆盖一半侧面')
  assert.equal(m[0].side, 'miniapp')
  assert.equal(m[0].by, 'suffix', '平台后缀是第一顺位,不得被出口指向或目录序抢走')
  assert.match(m[0].chosen, /Foo\.taro\.tsx$/, '构建期实际解析的那一份必须赢')
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.ok(/export function pickCandidate\(/.test(txt), 'pickCandidate 被摘线 ⇒ 选腿退回各写一套')
  assert.equal(
    (txt.match(/const pick = pickCandidate\(/g) || []).length,
    2,
    '配对层与可达性换腿必须共用这一份比较器:少一处就是又一处各写各的序(同一族两处选到不同份)',
  )
  assert.ok(!/cands\.reduce\(/.test(txt), '"取候选里最后一个"还留着 ⇒ 同一族在两处能选到不同份')
  assert.ok(/EXIT_BARRELS/.test(txt), '出口桶被摘线 ⇒ 第二顺位凭空消失,退化成猜')
  // 锁的是**语义**而非某个字面写法:出口链只认"再导出"与"星号导出"两种形态。
  // 上一版把断言写成 `k === 're' || k === 'star'` 这一具体形状,而实现是两个分支各判一次
  // —— 于是这条锁在 HEAD 上就恒红(过拟合的锁不但不防回归,还会让下一个改这里的人以为门坏了)。
  assert.ok(/=== 're'/.test(txt) && /=== 'star'/.test(txt), '出口链的两种形态被削弱 ⇒ "被 import 过"会被当成出口')
  // 重出台账不得把判断类登记表冲掉:waivers 是"这一族为什么允许不同形"的记录
  // (AGENTS O81:waivers 恒空本身就是违规),ledgerVersion 是格式版本。
  assert.ok(
    /out\.waivers = waivers/.test(txt) && /prior\.waivers/.test(txt),
    'emitBaseline 又回到 waivers: {} 清零 —— 一次重锚会冲掉全部带理由的豁免登记',
  )
  assert.ok(/prior\.ledgerVersion/.test(txt), 'ledgerVersion 未随重出带过 ⇒ 台账不再自述它是哪一版格式')
  // 属性名必须整体取(允许连字符),不得退回"跳过连字符前缀"那版过头修法:
  // 那会把 `max-width: 320rpx` 这类合法长度档一起跳掉,凭空造出分叉(实测 CategoryBar 1→4)。
  assert.ok(
    txt.includes("[a-z][\\w]*(?:-[a-z0-9]+)*"),
    '连字符属性不再整体取键 ⇒ line-height 会被读成 height、max-width 会被跳掉(两个方向都错过)',
  )
})

/**
 * ── 票 G-978049 三格的镜像锁(2026-10-11 值守席)────────────────────────────────
 * 三格各自的"复裁判据"必须各有一把常驻尺子,否则下一次读数变化时台账里那句话又只剩散文。
 * 每条都配了"摘掉新判据必读红"的构造面 / 形状锁,而不是只钉今天恰好是绿的读数。
 */

/** 构一条 finding:`verdictOf` 只读 named / geometry / radius / elementRadius 四个计数源。 */
const legFinding = (name, { geo = [], radius = [], element = 0 }) => ({
  name,
  named: [],
  geometry: { onlyMiniapp: [], onlyRn: geo },
  radius: { onlyMiniapp: [], onlyRn: radius },
  elementRadius: { mismatched: Array.from({ length: element }, (_, i) => ({ name: `e${i}` })) },
})
const MAIN_KEYS = {
  counts: 'counts',
  radius: 'radiusCounts',
  element: 'elementRadiusCounts',
  waivers: 'waivers',
}

test('T26 两把尺子不得互相顶账:主腿下降不得放行 web 腿上升,反向同理,主腿豁免不得免 web', () => {
  const ledger = {
    counts: { Foo: 2 },
    radiusCounts: { Foo: 1 },
    elementRadiusCounts: { Foo: 0 },
    webCounts: { Foo: 0 },
    webRadiusCounts: { Foo: 0 },
    webElementRadiusCounts: { Foo: 0 },
    waivers: {},
    webWaivers: {},
  }
  // 这一族主腿从锚点 2 掉到 0(真变好了),web 腿同时新出 1 档分叉。
  const mainVerdict = src.verdictOf([legFinding('Foo', {})], ledger, MAIN_KEYS)
  const webVerdict = src.verdictOf([legFinding('Foo', { radius: [8] })], ledger, src.WEB_LEDGER)
  assert.equal(mainVerdict.red.length, 0, '主腿这一轮是变好,不该红')
  assert.ok(
    mainVerdict.shrunk.some((s) => s.name === 'Foo'),
    '主腿下降必须报名(台账要靠它收紧),不得静默吞掉',
  )
  assert.deepEqual(
    webVerdict.red.map((r) => r.name),
    ['Foo'],
    'web 锚点是 0 而主腿锚点是 1/2 ⇒ 两腿一旦共用锚点,这次 web 上升会被主腿的宽名额顶掉(净零逃逸)',
  )
  // 反向对照:web 下降不得替主腿上升顶名额。
  const flip = { ...ledger, counts: { Foo: 0 }, webRadiusCounts: { Foo: 2 } }
  assert.equal(
    src.verdictOf([legFinding('Foo', { geo: [4] })], flip, MAIN_KEYS).red.length,
    1,
    '主腿新增一档而 web 恰好下降 ⇒ 主腿必须红,否则"两腿互相抵账"成为常态',
  )
  assert.equal(
    src.verdictOf([legFinding('Foo', { radius: [8] })], flip, src.WEB_LEDGER).red.length,
    0,
    'web 这一轮在锚点内,不该被主腿的红连坐(连坐会让人学会忽略整条腿)',
  )
  // 豁免也分腿:主腿记了理由,web 腿的上升照旧问责。
  const waivedMain = {
    ...ledger,
    waivers: { Foo: { reason: '主腿这一族已逐条裁过', until: '2099-01-01' } },
  }
  assert.equal(src.verdictOf([legFinding('Foo', {})], waivedMain, MAIN_KEYS).waived.length, 1)
  assert.equal(
    src.verdictOf([legFinding('Foo', { radius: [8] })], waivedMain, src.WEB_LEDGER).red.length,
    1,
    '拿主腿的豁免表去免 web 腿 = 给这条腿写个理由就能让那条腿的债凭空蒸发',
  )
})

test('T27 整腿未判定不得借另两腿的绿出合格证(失明必须折进退出码)', () => {
  const pairs = [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }]
  const text = {
    'a/Foo.tsx': '<View className="rounded-lg" />',
    'b/Foo.tsx': '<div className="rounded-xl" />',
  }
  // 行为半边:档位表取不到 ⇒ 这一腿一条 findings 都不许产出,而每一对都要落"未判定"。
  const blind = src.webRadiusAudit(pairs, text, null, {})
  assert.equal(blind.findings.length, 0, '档表失明还产出档差 = 拿猜出来的表打分')
  assert.equal(blind.undetermined.length, pairs.length, '整腿失明必须逐对报名,不得读成"没有差异"')
  assert.match(
    blind.undetermined[0].why,
    /失明|不得记/,
    `未判定的措辞要让人看出是尺子瞎了:${blind.undetermined[0].why}`,
  )
  // 两侧都读不出档 ⇒ 未判定,不是"两端同值";两侧都读到而集合不同,才叫差异。
  const emptyBoth = src.webRadiusAudit(
    pairs,
    { 'a/Foo.tsx': 'x', 'b/Foo.tsx': 'y' },
    { lg: 8, xl: 12 },
    {},
  )
  assert.equal(emptyBoth.undetermined.length, 1, '两侧零档被记成"同值"就是把没判写成判过了')
  assert.equal(
    src.webRadiusAudit(pairs, text, { lg: 8, xl: 12 }, {}).findings.length,
    1,
    '两端都读到档而集合不同,必须是差异',
  )
  // 半边"不得借绿":台账钉着 web 锚点而本轮零记录 ⇒ webGhostRed 必须存在,且**先于**主腿求和折进退出码。
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.ok(
    /const webGhostRed = webPriorKeys\.length && !web\.findings\.length/.test(txt),
    '整腿消失的判据被摘掉 ⇒ 把 web 腿目录改名就能让这一维安静,而账面只是少几行字',
  )
  assert.ok(
    /if \(webVerdict\.red\.length \|\| webGhostRed\) \{[\s\S]{0,400}?return 1 \}/.test(txt),
    'web 腿的红/整腿消失没有独立折进退出码 ⇒ 主腿绿会把这一维的失效读成通过',
  )
  assert.ok(/消失不是销账/.test(txt), '整腿消失必须把结论印在报告上,只改退出码没人看得见')
})

test('T28 ① 的复裁判据:VideoPlayer 的 web 残档必须由带理由豁免接管,残档集合一变就得重裁', () => {
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  const w = led[src.WEB_LEDGER.waivers]?.VideoPlayer
  assert.ok(
    w,
    '① 的结案条件是"归零 或 被 webWaivers 带理由接管" —— 两者都没有,这一格就还开着',
  )
  assert.equal(src.waiverProblem(w), null, '接管式豁免必须带可复核理由(空理由等于没接管)')
  assert.match(w.reason, /git show|git grep|HEAD:/, '理由必须给出跑得动的现读命令,转述不算取证')
  assert.match(String(w.until ?? ''), /^\d{4}-\d{2}-\d{2}$/, '豁免必须有到期日(守门 108 同一条要求)')
  assert.ok(
    new Date(String(w.until)).getTime() > Date.now(),
    `① 的接管已过期(${w.until})⇒ 该族回到"锚点还在、理由失效"的状态,必须重新裁`,
  )
  // 真值半边(阳性对照):裁决只覆盖"web 自绘控制条的那一档";残档集合一变,豁免就得撤下来重裁。
  const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
  })
  assert.equal(r.status, 0, `索引面判红:\n${(r.stdout || r.stderr || '').slice(-500)}`)
  const j = JSON.parse(r.stdout)
  const f = (j.web?.findings ?? []).find((x) => x.name === 'VideoPlayer')
  assert.ok(f, 'web 腿不再产出 VideoPlayer 配对 ⇒ ① 换了载体,请改这一格而不是删掉断言')
  assert.deepEqual(
    f.radius.onlyRn,
    [4],
    '残档集合变了(尤其舞台档又分叉)⇒ 必须撤下豁免重新裁,不得让整族豁免遮住新的分叉',
  )
  assert.deepEqual(f.radius.onlyMiniapp, [], '小程序侧出现新档 = 这一族不再是"单侧 chrome"')
  for (const v of f.radius.onlyRn)
    assert.ok(
      w.reason.includes(String(v)),
      `豁免理由点名的档与实际残档不一致(${v})⇒ 理由不再是这条读数的取证`,
    )
  const v = src.verdictOf(
    [legFinding('VideoPlayer', { radius: [...f.radius.onlyMiniapp, ...f.radius.onlyRn] })],
    led,
    src.WEB_LEDGER,
  )
  assert.equal(v.red.length, 0, '① 接管后这一族不该红')
  assert.ok(
    v.waived.some((x) => x.name === 'VideoPlayer'),
    '必须落在"带理由豁免"而不是"没扫到" —— 后者是覆盖面消失,不是债务清偿',
  )
})

test('T29 ② 的裸档探针:必须看得见"看不见多少",且不得顺手把裸档并进提取式(三本账未同批重锚)', () => {
  const table = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, DEFAULT: 8 }
  const pairs = [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }]
  const text = {
    'a/Foo.tsx': '<View className="rounded-lg" />\n',
    'b/Foo.tsx': '<div className="rounded bg-card" />\n// rounded 写在注释里不该算\n',
  }
  const web = src.bareRoundedAudit(pairs, text, table, 'web')
  assert.equal(
    web.total,
    1,
    'web 腿那份裸档必须被点名(它今天不进档集合,于是差值被读成"那一端没写档")',
  )
  assert.equal(web.sites[0].side, 'web', 'web 腿的 rn 槽位必须报成 web,报成 rn 就是替另一条腿记账')
  assert.equal(web.sites[0].px, 8, '裸档的值必须从档位表 DEFAULT 取,取不到要落 null 而不是猜')
  assert.equal(web.defaultResolved, true)
  assert.equal(
    src.bareRoundedAudit(pairs, text, { lg: 8 }, 'web').defaultResolved,
    false,
    '表里没有 DEFAULT 时必须报"值未判定" —— 冒充成 8 就是把没判写成判过了',
  )
  assert.equal(
    src.bareRoundedAudit(pairs, text, table, 'main').sites[0].side,
    'rn',
    '主腿的同一槽位必须仍报成 rn —— 改名只发生在 web 腿,两腿的名单不得并成一个数',
  )
  // 成对反向:具名档 / full / 任意值 / 注释形态一律不算裸档。
  const named = { 'z/Foo.tsx': 'className="rounded-full rounded-[6px] rounded-lg"' }
  assert.equal(src.bareRoundedAudit([{ name: 'Foo', miniapp: '', rn: 'z/Foo.tsx' }], named, table, 'web').total, 0)
  assert.equal(bareRoundedOccurrences('// rounded 只是说明文字', table).count, 0)
  assert.equal(bareRoundedOccurrences('const a = "rounded"', table).count >= 1, true, '串里的裸档仍是一个真实取用点')
  // 装车锁:两腿都算、进 json、跟人读面同印 —— 少一处就是"有判据而没人调度"。
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.ok(
    /web: bareRoundedAudit\(webPairs, text, radiusTable, 'web'\)/.test(txt) &&
      /main: bareRoundedAudit\(pairs\?\.pairs \?\? \[\], text, radiusTable, 'main'\)/.test(txt),
    '裸档探针只剩一条腿 ⇒ 另一条腿的"看不见多少"又回到无人报名',
  )
  assert.ok(
    /bareRounded: collected\.bareRounded/.test(txt),
    '探针不进 --json ⇒ 下一票只能抄终端输出当数据源',
  )
  assert.ok(
    /裸档盲区/.test(txt),
    '探针不跟人读读数同印 ⇒ "配对文件里读到 0 处"会被读成"全仓没有裸档"',
  )
  // 反向锁(本票最关键的一条):提取式今天**不许**认裸档 —— 补认必须与守门 77 / 150 的台账同枚重锚。
  assert.deepEqual(
    radiusSetOf('<View className="rounded bg-card" />', table),
    [],
    '裸档被并进 radiusItemsInLine 了,而 77 的 HEAD 棘轮与 150 的角色档台账没在同一枚提交里重锚 ⇒ 会把别人钉着的锚顶成"新增红"(§O81 票⑬)',
  )
  const j = JSON.parse(
    spawnSync(process.execPath, [SELF, '--staged', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180000,
    }).stdout,
  )
  assert.ok(j.bareRounded && j.bareRounded.web && j.bareRounded.main, '真仓面读不到 bareRounded ⇒ 探针没装车')
  assert.equal(
    j.bareRounded.web.total,
    j.bareRounded.web.sites.reduce((s, x) => s + x.count, 0),
    '计数与名单不自洽 ⇒ 报名本身不可复核',
  )
  assert.equal(
    j.bareRounded.web.sites.every((x) => typeof x.file === 'string' && Array.isArray(x.lines) && x.lines.length === x.count),
    true,
    '站点没有逐条行号 ⇒ 下一票拿到总数也找不到地方',
  )
})

test('T30 ③ 的机制复核:web 腿端入口剔除必须真在判,且剔掉的族逐条点名(不得退回个案拆对)', () => {
  const txt = flat(readFileSync(SELF, 'utf8'))
  assert.ok(
    /web: \['apps\/web\/app'\]/.test(txt),
    'web 种子面被摘 ⇒ 可达性判据对整条腿静默失效(票 G-978049③ 的落地形态消失)',
  )
  assert.ok(
    /export function pruneUnreachableLegs\(/.test(txt) &&
      /const pruned = pruneUnreachableLegs\(/.test(txt),
    '剔除函数在而没人调 = 提交链上一路绿灯(守门 70/76/81 同型)',
  )
  assert.ok(
    !/未做端入口可达性剔除\(rn 腿那套图是从 RN 入口走的/.test(txt),
    '门内头注仍声称"未做剔除" ⇒ 文档与代码分叉,下一个人会照旧文去补一个已经存在的机制',
  )
  const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
  })
  assert.equal(r.status, 0, `索引面判红:\n${(r.stdout || r.stderr || '').slice(-500)}`)
  const j = JSON.parse(r.stdout)
  assert.ok(Array.isArray(j.web?.webUnreachable), '--json 不暴露 webUnreachable ⇒ 人读面的点名无源可查')
  assert.ok('webReachSuspended' in (j.web ?? {}), '挂起半边没有出口 ⇒ "这一轮没剔"与"都活着"在机器面上同形')
  for (const u of j.web.webUnreachable) {
    assert.ok(u.name && Array.isArray(u.legs) && u.legs.length > 0, `剔除条目没点名腿:${JSON.stringify(u)}`)
  }
  // 剔除不得静默:json 里每一条被剔的族,人读面必须有一行点名它的 ⊘ WD 条目。
  const human = spawnSync(process.execPath, [SELF, '--staged'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
  })
  for (const u of j.web.webUnreachable)
    assert.ok(
      human.stdout.includes(`⊘ WD ${u.name} ——`),
      `json 剔了 ${u.name} 而人读面没点名 ⇒ 判据输入被改动而账面只少一行字(静默删族)`,
    )
  // 个案拆对不得反过来吃掉机制:web 腿的 pairingRejects 若还在钉"死副本",就是③该接管的那一类。
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  for (const [name, w] of Object.entries(led[src.WEB_LEDGER.waivers] ?? {}))
    assert.ok(
      typeof w?.reason === 'string' && w.reason.trim().length >= 6,
      `web 腿豁免 ${name} 没有可复核的理由(接管式登记也是登记,不是消红通道)`,
    )
})
