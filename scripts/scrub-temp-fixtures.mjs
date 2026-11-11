#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TEMP 里本项目测试夹具的清扫器 —— 默认**只报告不删除**。
 *
 * 为什么需要它(2026-09-25 实测):活进程 `os.tmpdir()` = `D:\caches\Temp`,该目录下
 * 本项目前缀条目 450 个 / 27,551 个文件 / 约 13 GB,最旧的 mtime 停在 2026-08-26。
 * 全链没有一个人负责收这些:
 *   - `scripts/check-c-drive-pollution.mjs` 明确"只读,不删除任何文件",且只扫 C 盘;
 *   - `scripts/c-drive-auto-maintain.ps1` 的删除面按设计钉在 C 盘(它是计划任务,扩面=改全机行为);
 *   - `scripts/clean-garbage.mjs` 完全不碰 TEMP;
 *   - `scripts/lib/scratch-dir.mjs` 只提供 mkScratch/rmScratch —— **新写的**测试有出口,
 *     历史遗留与"忘了 rm"的那批没有任何出口。
 * 即"造好没装车"的又一型:落点规约存在,回收入不存在。
 *
 * 三条不可让的护栏:
 *   1. **绝不跟随重解析点**。§26 记过真实事故:`Get-ChildItem -Recurse` / 递归删除会**穿过 junction**
 *      清空 D 盘真实目标,把改道机制变成自毁机制。所以枚举一律 `lstatSync`,遇 `isSymbolicLink()`
 *      (junction 在 Node 侧报 true)只断链或跳过,绝不递归进去。
 *   2. **名字围栏**:只有命中本项目前缀的条目才是候选,他人条目一律不判性、不删除。
 *   3. **账龄闸**:默认只碰 mtime > 7 天的;当天在跑的测试夹具不可能被误删。
 * 另加第四层:`PROTECTED_NAMES` 整目录不碰(secrets/密钥/credentials/backups 等),
 * 与 `check-parent-pollution` 同一套理由 —— 名字含 key/secret 的东西一律先补豁免再谈清理。
 *
 * ── 第二腿:宿主自产散文件的**具名族**(2026-10-16 立)──
 * 名字围栏(`OUR_PREFIXES`)判的是"**我们**造的垃圾";宿主(Qoder 会话壳 / 技能片段暂存)写在
 * 同一个 TEMP 里的散文件不属于任何前缀,于是在账面上永远是"非本项目条目"而无人回收:
 *   · `qoder-<4hex>-cwd` —— 每次 shell 调用落一枚 `pwd -P` 的一行路径面包屑(实测 11 B,最大见过 136 B)。
 *     2026-10-16 现读:`D:\DevEnv\Temp` 顶层 1,107 枚 / 13,489 B,机主当日已手删 ≥3 天者 4,600 枚,
 *     日新增实测 444–2,100 枚 ⇒ **手删跟不上产出**,这一族必须有一个自动出口。
 *   · `<uuid>.tmp.md` —— 技能片段暂存(YAML frontmatter,抽样无凭据)。同日现读 489 枚 / 5.20 MB,
 *     其中 ≥7 天 441 枚 / 4.69 MB,最大 32,934 B。
 * 这两族**不是**前缀族的放宽副本,而是一条更严的独立判据链 —— 东西是别人的程序写的,
 * 所以只有"表里点名 + 三重闸全过"才允许被删:
 *   1. **表驱动**:族一律登记在 `HOST_STRAY_FAMILIES`,每条必须带 `why`(凭什么可删)/`owner`/`reviewBy`(到期日)。
 *      到期 ⇒ 整族回退到"不碰"并**报名**(§0 铁律 7:豁免必须验过才免且会到期;本仓不存在"永久静音"这一档)。
 *   2. **三重闸**:内容闸(仅声明了 `content` 的族)+ 大小闸(`maxBytes`)+ 账龄闸(`max(族档, 调用方要求)`)。
 *      任一不过 ⇒ 不删,且**按原因逐条计数报名**(不静默跳过)。
 *   3. **只碰顶层散文件**:这一腿**绝不**递归进任何目录(条目本身是目录 ⇒ 拒收),绝不跟随重解析点,
 *      绝不碰 `PROTECTED_NAMES`,名字命中 key/secret/credential/token/password 一律拒收。
 *   4. **族级熔断**:单轮某族候选枚数 > `HOST_STRAY_ROUND_CAP` ⇒ 该族**整族本轮不删**并报名
 *      (判据被一次风暴读成海量删除,这一族方向必须是"少删一次",不是"多删一次")。
 *   5. **删除出口仍然只有一个**(`del()`),且只有 `--apply` 才走到它;`--dry-run` 显式覆盖 `--apply`
 *      —— 本仓记过"预演照样真删了 29.8 MB"的事故,默认档/预演档必须零删除动作。
 *
 * 用法:
 *   node scripts/scrub-temp-fixtures.mjs                 # 只报告(默认扫多根并集,见下)
 *   node scripts/scrub-temp-fixtures.mjs --older-than 3  # 改账龄(族档是**下限**,调不穿)
 *   node scripts/scrub-temp-fixtures.mjs --scratch-older-than-hours 6 # scratch 腿**独立**账龄
 *     (2026-10-30:此前直接拿 `--older-than 7` 乘 24 当静默闸 ⇒ 文档宣称的 6 小时族档被抬到 168 小时,
 *      守护每轮都传 7 ⇒ 这一腿事实上永不删。两条腿的生命周期不同,账龄必须分开传)
 *   node scripts/scrub-temp-fixtures.mjs --apply         # 真删(显式要求)
 *   node scripts/scrub-temp-fixtures.mjs --apply --dry-run  # 预演:显式覆盖 --apply ⇒ 零删除
 *   node scripts/scrub-temp-fixtures.mjs --root <dir>[;<dir>…] # 显式只扫这些根(测试夹具通道,生产不带)
 *   node scripts/scrub-temp-fixtures.mjs --self-test
 *
 * **为什么不止一个根**(2026-10-04,台账 G-1058525):活进程拿到的 TEMP 与注册表里刚改的 TEMP
 * 会并存很久(Windows 只在进程启动时读一次环境块),而历史残留散在三个根上。当轮现读:
 * `D:\caches\Temp` 顶层 60,805 条里本项目命名 1,616 条 = 98,081 文件 / 18.07 GB,最旧 mtime 1980-01-01;
 * `D:\tmp` 6,428 条里 362 条。只扫 `tmpdir()` 会让"另一个根有 18 GB"在账面上读成"没有残留"——
 * 所以出口只能是并集,不是放宽判据。根一律经 `devEnvRoot()` 推导盘符,不得写死(§15b/§26);
 * 推导失败**不静默少扫**,落「未判定」并让退出码为 2。
 */
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { devEnvRoot } from './seal-c-root-stray.mjs'
// scratch 落点的**唯一真相源**。本文件此前自己再推一遍 devEnv ⇒ G-158 把落点搬进仓内
// (`<repoRoot>/.DevEnv/Temp/ihui-scratch`)之后,这里仍在扫旧仓外 `D:\DevEnv` —— 仓内
// 240MB / 115 条夹具残留从来没人扫到,而汇总里表现为"候选 0",读起来跟"已清干净"一模一样
// (本仓最贵的假绿正是这一型)。§0.6:同一件事只留一处实现。
import { scratchRoot } from './lib/scratch-dir.mjs'

const OUR_PREFIXES = ['ihui-', 'IHUI-', 'next-backup-', 'probe-']
/** 整目录不碰:名字命中即跳过(按 toLowerCase 比对,大小写不敏感) */
const PROTECTED_NAMES = ['secrets', 'secret', 'credentials', 'credential', '密钥', 'backups', 'baidusyncdisk', '.pybcrypt']
const DEFAULT_MIN_AGE_DAYS = 7
const DAY_MS = 86400000

/**
 * 具名族额外的一层名称保护词:前缀族靠 `PROTECTED_NAMES` 的**精确等值**就够(那是整目录的名字),
 * 而这一族碰的是散文件 —— 一个 `qoder-…-cwd` 形状之外的名字里只要带 key/secret/token/password/apikey
 * 就不许被"表里的正则"顺路带走,所以这一层用**子串**命中(比精确等值严),且不给行内豁免出口。
 */
const NAME_GUARD_RE = /(secret|credential|token|passw|api[-_]?key|private[-_]?key|密钥)/i

/**
 * 族级熔断上限(单轮某族候选枚数)。
 * 出处 = 实测峰值的可解释倍数:2026-10-16 现读日新增峰值 2,100 枚/日(机主口径),
 * 守护轮次实际按 `--older-than 7` 跑(见 `git-guardian.mjs :: TEMP_SCRUB_MIN_AGE_DAYS`)
 * ⇒ 稳态存量上界 ≈ 2,100 × 7 = 14,700 枚;取 20,000 ≈ 1.36 倍,给正常波动留余量,
 * 但任何"一次读成几万枚"的形态(判据被改歪、或某个程序把同一形状写疯)都会被掐住。
 */
export const HOST_STRAY_ROUND_CAP = 20000

/**
 * 宿主自产散文件的具名族表 —— 第二腿的**唯一**准入通道。
 *
 * 一条族没有 `why`/`owner`/`reviewBy` 就不许进表(§0 铁律 7 + §5e-1 可整改性):
 * `why` 回答"凭什么敢删别人程序写的东西",`reviewBy` 到期 ⇒ 整族回退到"不碰"并报名,
 * 到期日不是"提醒以后再看",而是**判据自己会失效**的那一天。
 *
 * 账龄闸取 `max(族档 minAgeDays, 调用方要求)`:族档是**下限**,`--older-than 0` 也调不穿它 ——
 * 放宽一条族的账龄只能改这张表(要过 reviewBy),不能靠命令行参数当场绕过。
 */
export const HOST_STRAY_FAMILIES = [
  {
    name: 'qoder-cwd-breadcrumb',
    // 4 位十六进制 + 固定后缀,不是前缀匹配:名字形状不吻合 ⇒ 连"候选"都进不去
    re: /^qoder-[0-9a-f]{4}-cwd$/i,
    maxBytes: 256,
    minAgeDays: 3,
    content: 'singlePathLine',
    why:
      'Qoder 会话宿主每次 shell 调用写一枚 `pwd -P` 的一行路径面包屑(实测 11 B);不是任何程序的输入, ' +
      '机主 2026-10-16 已按同一判据手删 4,600 枚。三重闸:普通文件 ∧ ≤256 B ∧ 内容去空白后单行且像路径。' +
      '(大小闸由 64 放宽到 256 是当次实测:同一形状里有 4 枚 81 B 的合法面包屑 `/c/Users/…/clash-verge-rev`,' +
      '路径长度本来就该变;真正把这一族与别的东西分开的是**名字形状 + 单行路径内容闸**,大小闸只是粗 sanity 界。)',
    owner: '机主(李春川)/ 产出方 = Qoder 会话宿主',
    reviewBy: '2027-01-16',
  },
  {
    name: 'uuid-tmp-md-fragment',
    // 严格 UUID 形状(比 2026-10-16 简报给的 `^[0-9a-f-]{36}\.tmp\.md$` 更紧):
    // 宽松式会放过 `aaaa…secret.tmp.md` 这类名字;实测 489 枚全部命中严格式,收窄零代价。
    re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp\.md$/i,
    maxBytes: 65536,
    minAgeDays: 7,
    // 内容闸刻意留空(2026-10-16 简报只要求大小闸):抽样内容是 YAML frontmatter 技能片段、无凭据。
    // 这一格不对称是**已知待复核项**,到期(reviewBy)必须重新裁定要不要补内容闸。
    content: null,
    why:
      '宿主技能片段暂存(`<uuid>.tmp.md`,抽样 = YAML frontmatter 正文,无凭据);一次 `.tmp.md` 落盘后再无人读。 ' +
      '2026-10-16 现读 489 枚 / 5.20 MB,其中 ≥7 天 441 枚 / 4.69 MB,最大 32,934 B(< 64 KB 大小闸)。',
    owner: '机主(李春川)/ 产出方 = Qoder 会话宿主',
    reviewBy: '2027-01-16',
  },
]

/**
 * 内容闸(纯函数,可单测、跨平台):去掉首尾空白后必须是**单一行**,且这一行"像一个路径"。
 *
 * 两条写法纪律(2026-10-16 立票点名):
 *  · **不写死盘符** —— 接受任意单字母盘符 `X:/` 或 `X:\`,不枚举本机 D:/G:;
 *  · **不把 `\` 归一成 `/`** —— 归一会把"内容是 Windows 路径"这件事变成判据的一部分,
 *    而非 Windows 宿主就没法测这一臂。分隔符按字符类同时接受,平台无关。
 *
 * 接受:`/a/b`(POSIX 绝对路径,含 `//srv/share`)、`D:\x` / `d:/x`(盘符路径)、`\\srv\share`(UNC)。
 * 拒绝:空、多行、URL、纯文本/数字、含控制字符、相对路径(`./x` 之类 —— 面包屑由 `pwd -P` 产出,
 * 理当是绝对路径;相对形态说明产出方变了,那要重新裁定,不该被顺手删)。
 */
export function isPathLikeBreadcrumb(text) {
  const raw = String(text ?? '')
  // 控制字符(CR/LF 之外)与 NUL ⇒ 不是"一行路径"
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(raw)) return false
  const nonEmpty = raw.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
  if (nonEmpty.length !== 1) return false
  const s = nonEmpty[0].trim()
  if (s.length < 2) return false
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+[\\/][^\s]|\/[^\s])/.test(s)
}

/** 账龄闸合成:族档是下限,调用方只被允许**加严**,调不穿。 */
export function hostStrayEffectiveMinAgeDays(family, requested = DEFAULT_MIN_AGE_DAYS) {
  const fam = Number(family?.minAgeDays)
  const req = Number(requested)
  const a = Number.isFinite(fam) ? fam : DEFAULT_MIN_AGE_DAYS
  const b = Number.isFinite(req) ? req : DEFAULT_MIN_AGE_DAYS
  return Math.max(a, b)
}

/** 到期判定(纯函数):`reviewBy` 是 ISO 日期;今天 > reviewBy ⇒ 族失效,回退到"不碰"。 */
export function hostStrayExpired(family, today = new Date()) {
  const due = Date.parse(String(family?.reviewBy ?? ''))
  if (!Number.isFinite(due)) return true // 到期日写坏 ⇒ 当作已到期(失效方向 = 少删)
  const t = Date.parse(today.toISOString().slice(0, 10))
  return Number.isFinite(t) ? t > due : Date.now() > due
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const has = (name) => process.argv.includes(name)

const isOurs = (name) => OUR_PREFIXES.some((p) => name.startsWith(p))
const isProtected = (name) => PROTECTED_NAMES.includes(name.toLowerCase())

/**
 * 该扫哪些根 —— 只许有这一处推导。
 *
 * 三条不可让:
 *  1. **盘符不得写死**:`<盘>\caches\Temp` 与 `<盘>\tmp` 是历史落点,由 `devEnvRoot()` 推出的同盘根拼出来;
 *     `devEnvRoot()` 是 §15b 唯一外置根出口(与备份/审计/恢复演练同一份),本工具不得自派生。
 *  2. **推不出来必须喊**:devEnvRoot 会在工作树位于夹具内时抛错。安静少扫两个根 = 把"没判"写成"判过了",
 *     所以落 `undetermined` 并由 CLI 以退出码 2 拒出合格证。
 *  3. **同一路径只判一次**:活 `tmpdir()` 与派生根在改过注册表之后必然重合,去重按 `resolve()` 后
 *     小写比较(Windows 大小写不敏感),否则同一批条目被删两次、报告读成"两个根各有残留"。
 */
export function defaultRoots({
  env = process.env,
  tmp = tmpdir(),
  devEnv,
  deriveDevEnv = devEnvRoot,
  deriveScratchRoot = scratchRoot,
  exists = existsSync,
  platform = process.platform,
} = {}) {
  const roots = []
  const undetermined = []
  const keyOf = (p) => resolve(p).toLowerCase().replace(/[\\/]+$/, '')
  const push = (p) => {
    if (!p) return
    const k = keyOf(p)
    if (!roots.some((r) => keyOf(r) === k)) roots.push(resolve(p))
  }
  push(tmp)
  let dev = devEnv
  if (dev === undefined) {
    // 先问 scratch-dir 的唯一真相源(2026-10-28):scratchRoot() = `<DevEnv>/Temp/ihui-scratch`,
    // 取两级父目录就是 DevEnv 根 —— 下面 push(join(dev,'Temp')) 正落在真落点上。
    // 旧写法只问 devEnvRoot()(seal-c-root-stray),它在 G-158 搬家后仍指仓外 `D:\DevEnv`
    // ⇒ 仓内 `<repo>/.DevEnv/Temp` 整枝不在扫描面里。兜底保留:scratchRoot 推导失败时退回旧源。
    try {
      const sr = deriveScratchRoot()
      if (sr) dev = dirname(dirname(resolve(sr)))
    } catch (e) {
      undetermined.push(`scratchRoot() 推导失败:${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`)
    }
    if (!dev) {
      try {
        dev = deriveDevEnv()
      } catch (e) {
        dev = null
        undetermined.push(`devEnvRoot() 推导失败:${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`)
      }
    }
  }
  if (dev) {
    push(join(dev, 'Temp'))
    push(join(parse(resolve(dev)).root, 'caches', 'Temp'))
    push(join(parse(resolve(dev)).root, 'tmp'))
  }
  // **跨盘探测**:TEMP 曾被设在哪块盘,与工作树在哪块盘是两回事。2026-10-04 实测:工作树在 `G:\`
  // 而 1,616 条本项目命名残留(18.07 GB)躺在 `D:\caches\Temp` —— 只按工作树盘推导会安静少扫整块盘,
  // 而"少扫"在这把尺子上表现为候选 0,读起来跟"已清干净"一模一样。
  // 代价是 26 次 `existsSync`(本机实测个位数毫秒);判据(名字/账龄/保护区)一条没放宽。
  if (platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const drive = `${String.fromCharCode(c)}:\\`
      if (!exists(drive)) continue
      for (const shape of [['caches', 'Temp'], ['tmp'], ['DevEnv', 'Temp']]) {
        const p = join(drive, ...shape)
        if (exists(p)) push(p)
      }
    }
  }
  for (const extra of String(env.IHUI_TEMP_SCRUB_ROOTS || '').split(';')) if (extra.trim()) push(extra.trim())
  return { roots, undetermined }
}

/** 递归量一个普通目录(调用方已保证它不是重解析点)。
 *  同时找"整条不许删"的硬阻断:目录里藏着别人/用户的凭据或备份子目录 ——
 *  一个测试夹具的内层出现 `密钥`/`secrets`,不是巧合,是它把真数据收在了自己肚子里。*/
function measure(dir) {
  let files = 0
  let bytes = 0
  let links = 0
  let protectedHit = null
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const f = join(d, e.name)
      let st
      try {
        st = lstatSync(f)
      } catch {
        continue
      }
      if (isProtected(e.name)) {
        protectedHit = protectedHit || f
        continue
      }
      if (st.isSymbolicLink()) {
        links++
        continue // 绝不穿透
      }
      if (st.isDirectory()) stack.push(f)
      else {
        files++
        bytes += st.size
      }
    }
  }
  return { files, bytes, links, protectedHit }
}

/**
 * 一次扫描。返回逐条判定 + 三类"不判但如实报数"的计数,绝不静默成"看起来干净"。
 */
export function scan({ root, minAgeDays = DEFAULT_MIN_AGE_DAYS, now = Date.now() }) {
  const candidates = []
  const protectedPaths = []
  const skipped = { protected: 0, fresh: 0, notOurs: 0, link: 0, unreadable: 0 }
  let names
  try {
    names = readdirSync(root, { withFileTypes: true })
  } catch (e) {
    return { root, error: `取不到目录清单: ${e?.message ?? e}`, candidates, protectedPaths, skipped, totalEntries: 0 }
  }
  for (const e of names) {
    if (!isOurs(e.name)) {
      skipped.notOurs++
      continue
    }
    const full = join(root, e.name)
    let st
    try {
      st = lstatSync(full)
    } catch {
      skipped.unreadable++
      continue
    }
    if (st.isSymbolicLink()) {
      // 链接本体可以断,但**本工具不做断链** —— 指向别处的夹具由持有者决定,只报数
      skipped.link++
      continue
    }
    if (now - st.mtimeMs < minAgeDays * 86400000) {
      skipped.fresh++
      continue
    }
    const m = st.isDirectory() ? measure(full) : { files: 1, bytes: st.size, links: 0, protectedHit: null }
    if (m.protectedHit) {
      // 整条不许删:里面收着凭据/备份目录,报出路径交人核,不做"递归时顺手跳过它"的半删
      skipped.protected++
      // 体积必须一起记:保护闸"恒拒"的那一族若只报名字不报 GB,读报告的人会以为这一格没多少东西,
      // 而实测这一族里最大的一条是 11.14 GB(见台账 G-1058525 ③)。
      protectedPaths.push({ path: m.protectedHit, name: e.name, files: m.files, bytes: m.bytes })
      continue
    }
    candidates.push({ name: e.name, path: full, dir: st.isDirectory(), mtime: new Date(st.mtimeMs).toISOString().slice(0, 10), ...m })
  }
  return { root, candidates, skipped, protectedPaths, totalEntries: names.length, error: null }
}

/**
 * 第二腿:宿主自产散文件的具名族扫描。**只读** —— 与 `scan()` 一样不产生任何删除动作,
 * 删除一律由调用方显式交给 `del()`,而 `del()` 只在 `--apply` 时被调用。
 *
 * 判序(每一步不过就"不删 + 按原因计数",绝不静默跳过):
 *   族名正则 ∧ 族未到期 ∧ 名称保护词 ∧ 顶层条目 ∧ 普通文件 ∧ 非重解析点 ∧ 账龄 ∧ 大小 ∧ 内容
 * 之后再套**族级熔断**:某族单轮候选 > cap ⇒ 整族本轮不删。
 */
export function scanHostStrays({
  root,
  minAgeDays = DEFAULT_MIN_AGE_DAYS,
  now = Date.now(),
  today = new Date(now),
  families = HOST_STRAY_FAMILIES,
  cap = HOST_STRAY_ROUND_CAP,
  readdir = (r) => readdirSync(r, { withFileTypes: true }),
  lstat = (p) => lstatSync(p),
  readFile = (p) => readFileSync(p),
} = {}) {
  const REJECT_KEYS = ['expired', 'nameGuard', 'unreadable', 'reparse', 'notPlainFile', 'fresh', 'tooBig', 'content', 'breaker']
  const rows = families.map((f) => {
    const rejected = Object.fromEntries(REJECT_KEYS.map((k) => [k, 0]))
    return {
      name: f.name,
      minAgeDays: hostStrayEffectiveMinAgeDays(f, minAgeDays),
      maxBytes: f.maxBytes,
      content: f.content ?? null,
      reviewBy: f.reviewBy,
      expired: hostStrayExpired(f, today),
      matched: 0,
      candidates: [],
      bytes: 0,
      rejected,
      breakerCap: cap,
      breakerTripped: false,
    }
  })
  const byName = new Map(rows.map((r) => [r.name, r]))
  const candidates = []
  let totalEntries = 0
  let other = 0
  const error = null
  let entries
  try {
    entries = readdir(root)
  } catch (e) {
    return { root, error: `取不到目录清单: ${e?.message ?? e}`, candidates, families: rows, totalEntries: 0, other }
  }
  totalEntries = entries.length
  for (const e of entries) {
    const fam = families.find((f) => f.re.test(e.name))
    if (!fam) {
      other++ // 不判性、不删,但必须报数:具名族的射程就是"表里点名的形状",别的散文件一格都不碰
      continue
    }
    const row = byName.get(fam.name)
    row.matched++
    if (row.expired) {
      row.rejected.expired++
      continue
    }
    if (isProtected(e.name) || NAME_GUARD_RE.test(e.name)) {
      row.rejected.nameGuard++
      continue
    }
    const full = join(root, e.name)
    let st
    try {
      st = lstat(full)
    } catch {
      row.rejected.unreadable++
      continue
    }
    // 重解析点(junction/符号链接)一律不碰:§26 的自毁型事故就长在这个形状上
    if (st.isSymbolicLink()) {
      row.rejected.reparse++
      continue
    }
    // 这一腿**只碰顶层散文件**:条目是目录 ⇒ 拒收,且本函数从不进入任何目录
    if (!st.isFile()) {
      row.rejected.notPlainFile++
      continue
    }
    if (now - st.mtimeMs < row.minAgeDays * DAY_MS) {
      row.rejected.fresh++
      continue
    }
    if (st.size > fam.maxBytes) {
      row.rejected.tooBig++
      continue
    }
    if (fam.content === 'singlePathLine') {
      let raw
      try {
        raw = readFile(full)
      } catch {
        row.rejected.unreadable++
        continue
      }
      if (!isPathLikeBreadcrumb(typeof raw === 'string' ? raw : String(raw ?? ''))) {
        row.rejected.content++
        continue
      }
    } else if (fam.content) {
      // 表里写了没实现的内容闸 ⇒ 当场拒收并报名,不能让"声明了但没人判"读成"判过了"(§0.3)
      row.rejected.content++
      continue
    }
    row.candidates.push(e.name)
    row.bytes += st.size
    candidates.push({
      name: e.name,
      path: full,
      dir: false,
      family: fam.name,
      mtime: new Date(st.mtimeMs).toISOString().slice(0, 10),
      files: 1,
      bytes: st.size,
    })
  }
  // 族级熔断:整族本轮不删(不是"删到上限为止")—— 一次读成海量删除时,唯一安全的出路是少要一次
  for (const row of rows) {
    if (row.candidates.length > cap) {
      row.breakerTripped = true
      row.rejected.breaker = row.candidates.length
      row.bytes = 0
      const drop = new Set(row.candidates)
      row.candidates = []
      for (let i = candidates.length - 1; i >= 0; i--) if (drop.has(candidates[i].name)) candidates.splice(i, 1)
    }
  }
  const rejectedTotal = rows.reduce((a, r) => a + Object.values(r.rejected).reduce((x, y) => x + y, 0), 0)
  const hostBytes = candidates.reduce((a, c) => a + c.bytes, 0)
  return {
    root,
    error,
    totalEntries,
    other,
    candidates,
    families: rows,
    rejectedTotal,
    hostBytes,
  }
}

/** 具名族的人类可读报告(逐族逐闸报数;候选 0 也必须说清"为什么是 0",不得读成"没问题")。 */
export function formatHostStrayReport(h, { apply }) {
  const lines = []
  if (h.error) return [`❌ 宿主散文件族 无法判定:${h.error}(不冒红也不记绿)  root=${h.root}`]
  lines.push(
    `宿主散文件具名族 · root=${h.root} · 顶层 ${h.totalEntries} 条(族外不判 ${h.other})→` +
      ` 命中 ${h.families.reduce((a, f) => a + f.matched, 0)} · 候选 ${h.candidates.length}` +
      `(${(h.hostBytes / 1048576).toFixed(2)}MB)· 拒收 ${h.rejectedTotal}`,
  )
  for (const f of h.families) {
    const rej = Object.entries(f.rejected)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')
    lines.push(
      `  ${f.expired ? '⏳' : '·  '} 族 ${f.name}:命中 ${f.matched} → 候选 ${f.candidates.length}(${(f.bytes / 1048576).toFixed(2)}MB)` +
        ` · 账龄闸 ${f.minAgeDays} 天 · 大小闸 ${f.maxBytes} B · 内容闸 ${f.content ?? '未声明'}` +
        (rej ? ` · 拒收:${rej}` : ''),
    )
    if (f.expired)
      lines.push(`     ⏳ 该族 reviewBy=${f.reviewBy} 已到期 ⇒ 回退为"不碰",需人工复核后重新登记(不是"没有残留")`)
    if (f.breakerTripped)
      lines.push(`     ⛔ 熔断:单轮候选超上限 ${f.breakerCap} 枚 ⇒ 整族本轮不删(判据被读成海量删除,方向必须是少删一次)`)
  }
  if (!apply) lines.push('  宿主散文件族:本轮未删除任何东西;要删请加 --apply')
  return lines
}

export function formatReport(r, { apply, minAgeDays }) {
  const lines = []
  if (r.error) return [`❌ 无法判定:${r.error}(不冒红也不记绿)  root=${r.root}`]
  const bytes = r.candidates.reduce((a, c) => a + c.bytes, 0)
  const files = r.candidates.reduce((a, c) => a + c.files, 0)
  lines.push(
    `TEMP 夹具清扫 · root=${r.root} · 账龄闸 ${minAgeDays} 天 · 条目 ${r.totalEntries} → 候选 ${r.candidates.length}` +
      `(文件 ${files} · ${(bytes / 1073741824).toFixed(2)} GB)`,
  )
  lines.push(
    `  跳过(不判但报数):非本项目 ${r.skipped.notOurs} · 账龄未到 ${r.skipped.fresh} · ` +
      `重解析点 ${r.skipped.link} · 保护区 ${r.skipped.protected} · 读不到 ${r.skipped.unreadable}`,
  )
  for (const c of r.candidates.slice(0, apply ? r.candidates.length : 25))
    lines.push(`  ${apply ? 'DEL ' : '·   '} ${c.mtime}  ${(c.bytes / 1048576).toFixed(2)}MB  ${c.dir ? '目录' : '文件'} ${c.name}`)
  for (const p of r.protectedPaths.slice(0, 10))
    lines.push(
      `  ⛔ 整条不删(夹具内收着凭据/备份目录,交人核): ${p.name} · ${p.files} 文件 · ${(p.bytes / 1073741824).toFixed(2)} GB · ${p.path}`,
    )
  if (r.protectedPaths.length > 10) lines.push(`  ⛔ … 另 ${r.protectedPaths.length - 10} 条保护区命中`)
  if (!apply && r.candidates.length > 25) lines.push(`  … 另 ${r.candidates.length - 25} 条(--apply 时逐条列全)`)
  if (!apply) lines.push('  本轮未删除任何东西;要删请加 --apply')
  return lines
}

/**
 * 删除。只接受 scan() 产出的候选 —— 判序(重解析点/保护区/账龄)全在 scan 里做一次,
 * 这里不重判也不放宽:两处各判一遍必然漂移,而本函数会毁数据。
 */
/**
 * 第三腿(2026-10-19 立):本项目**自己的** scratch 夹具 —— `ihui-scratch/<prefix>-XXXXXX/`。
 *
 * 为什么必须有这一腿(立因是"造好没装车"的又一型,现读量级为准):
 *   · `scripts/lib/scratch-dir.mjs` 给每个夹具注册了**进程退出钩子**,正常退出自动回收;
 *   · 但 SIGKILL / 断电 / 任务被杀不在此列 ⇒ 残留没有第二个出口;
 *   · 而前两腿都只扫 **TEMP 顶层**:`ihui-scratch` 整体只是**一个**顶层条目,目录一近期
 *     (刚建过夹具就"新鲜")就整体不判 ⇒ **结构上永远扫不到它里面的任何夹具**。
 *   · 现读:`D:\DevEnv\Temp` 73,469 项,`ihui-scratch` 一家 20,720 项(764 MB),已经把 P4a
 *     (条目阈 60000)顶红;而 P4a 指向的出路正是本工具。
 *
 * 为什么这一腿可以比前两腿**激进**一点(账龄 6 小时而不是 7 天),而方向不能反:
 *   · 名字围栏最硬:该目录下每个条目都是 `mkScratch()` 亲手建的,**没有别人的东西**;
 *   · 判据用**子树最新 mtime**而不是目录 mtime(深一层写文件不会改目录 mtime,目录 mtime
 *     对"还在写"这件事系统性失真);一轮门跑几分钟,6 小时是 20 倍余量;
 *   · 族档 6 小时是**下限**,`--older-than` 只能把它抬高,不能调穿(同族级熔断的口径);
 *   · 熔断:单轮候选 > `SCRATCH_ROUND_CAP` ⇒ 整腿本轮不删并报名(判据被一次风暴读成海量
 *     删除时,方向必须是少删一次)。
 */
export const SCRATCH_DIR_NAME = 'ihui-scratch'
export const SCRATCH_MIN_AGE_HOURS_DEFAULT = 6
export const SCRATCH_ROUND_CAP = 2000
const HOUR_MS = 3600000
/**
 * 单棵夹具子树的条目预算。**不是判据,只是遍历上限**;撞上限的条目单独报数,不得并进"读不到"。
 *
 * 2026-10-30 现读取值(原 20000):`D:\DevEnv\Temp\ihui-scratch` 里 `g1222561-head`(25163 项,
 * 整仓副本)与 `g1222561-pytest`(38320 项,pytest worker)都**超过旧预算** ⇒ 每轮判成"读不到"、
 * 结构上永不进候选 —— 这与"陈旧副本只增不减"是同一病灶换了个桶名。抬到 200000 后两枚可完整判龄。
 * 超新预算的树仍一律不删(同 `SCRATCH_ROUND_CAP` 的方向:判据被读成海量删除时少删一次),
 * 但必须在报告里点名叫 `overBudget`,不许再与"读不动"混成一档。
 */
const NEWEST_WALK_BUDGET = 200000

export function scratchEffectiveMinAgeHours(requestedHours = SCRATCH_MIN_AGE_HOURS_DEFAULT) {
  const req = Number(requestedHours)
  return Math.max(SCRATCH_MIN_AGE_HOURS_DEFAULT, Number.isFinite(req) ? req : SCRATCH_MIN_AGE_HOURS_DEFAULT)
}

/**
 * scratch 腿的**单次**子树遍历:同时量「子树最新 mtime」与「文件数 / 字节 / 链接 / 保护区命中」。
 *
 * 为什么并成一次(2026-10-30):此前先 `newestMtimeMs()` 再 `measure()` —— 同一个老夹具要走
 * 两遍全子树 lstat。实测 7 个根并集一轮 783 秒,而守护的硬上限只有 300 秒 ⇒ 每轮必被掐死,
 * 清扫器在账面上"存在",事实上**从未删掉一条**(`.ihui-agent/state/git-guardian.log` 连续三次
 * `ETIMEDOUT` 就是这一型)。并成一次 + 活夹具早退后,同机实测降到秒级。
 *
 * 早退(不改变结论,只省读数):任一后代 mtime 落在静默闸内 ⇒ 立刻判 `fresh`,
 * 活着的夹具不必再量体积(它本来就不进候选)。
 * 三态而非两态:读不动 ⇒ null(判"读不到");条目数超预算 ⇒ `{overBudget:true}`(判"没判完")。
 * 两态会把"树太大"静默说成"读不到",于是大树永远不进候选 —— 2026-10-30 现读就是这样漏掉两枚
 * 5 天前的整仓副本。两种都**绝不进候选**(§0.3 方向是少删一次)。
 *
 * @returns {null | {overBudget:true,spent:number} | {fresh:boolean,newest:number|null,files:number,bytes:number,links:number,protectedHit:string|null}}
 */
function scratchTreeStats(target, { nowMs, minAgeMs, budget = NEWEST_WALK_BUDGET, selfMtimeMs = 0 } = {}) {
  const freshAfter = nowMs - minAgeMs
  let newest = 0
  let files = 0
  let bytes = 0
  let links = 0
  let protectedHit = null
  let spent = 0
  const stack = [target]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return null
    }
    for (const e of entries) {
      if (++spent > budget) return { overBudget: true, spent: spent - 1 }
      const f = join(d, e.name)
      let st
      try {
        st = lstatSync(f)
      } catch {
        return null
      }
      if (st.mtimeMs > newest) newest = st.mtimeMs
      if (st.mtimeMs >= freshAfter) return { fresh: true }
      if (isProtected(e.name)) {
        // 记下命中但**不 continue**:同 `scan()` 侧 T3 的教训 —— 被保护闸挡住的条也必须量出体积,
        // 否则报告里 11 GB 的残留会显示成 0.00 GB,读起来像"保护区里没什么东西"。
        // 它仍然整条不进候选(判据照旧),重解析点由下面的分支继续拦住。
        protectedHit = protectedHit || f
      }
      if (st.isSymbolicLink()) {
        links++
        continue // 绝不穿透(§26:递归删除穿过 junction 会清空真实目标)
      }
      if (st.isDirectory()) stack.push(f)
      else {
        files++
        bytes += st.size
      }
    }
  }
  // 空目录(一个后代都没有):没有后代可判龄 ≠ 读不到。用条目自身 mtime 作最后活动时间,
  // 否则这类"测试建了没写就退出"的空骨架会永远停在"读不到 76"这一档里(2026-10-30 现读)。
  if (spent === 0) {
    const self = Number.isFinite(selfMtimeMs) && selfMtimeMs > 0 ? selfMtimeMs : null
    if (self === null) return { fresh: false, newest: null, files: 0, bytes: 0, links: 0, protectedHit: null }
    return { fresh: self >= freshAfter, newest: self, files: 0, bytes: 0, links: 0, protectedHit: null }
  }
  return { fresh: false, newest: newest || null, files, bytes, links, protectedHit }
}

export function scanScratchFixtures({ root, minAgeHours = SCRATCH_MIN_AGE_HOURS_DEFAULT, now = Date.now(), walkBudget = NEWEST_WALK_BUDGET } = {}) {
  const scratchRoot = join(resolve(root), SCRATCH_DIR_NAME)
  const minAge = scratchEffectiveMinAgeHours(minAgeHours)
  const skipped = { fresh: 0, protected: 0, link: 0, unreadable: 0, overBudget: 0, notOurs: 0 }
  const candidates = []
  // 保护区命中必须**点名**(名字 + 命中路径 + 体积),否则"交人核"这条唯一出路是哑的:
  // 2026-10-30 现读,两条 5 天前的残留被名字闸挡住,而报告只有一句"保护区 2",没人能核。
  const protectedPaths = []
  const base = { scratchRoot, minAgeHours: minAge, candidates, protectedPaths, skipped, cap: SCRATCH_ROUND_CAP, capTripped: false }
  let st0
  try {
    st0 = lstatSync(scratchRoot)
  } catch {
    return { ...base, totalEntries: 0, error: null, absent: true }
  }
  if (!st0.isDirectory() || st0.isSymbolicLink()) return { ...base, totalEntries: 0, error: null, absent: false, skipped: { ...skipped, notOurs: 1 } }
  let names
  try {
    names = readdirSync(scratchRoot, { withFileTypes: true })
  } catch (e) {
    return { ...base, totalEntries: 0, error: `取不到夹具清单: ${e?.message ?? e}`, absent: false }
  }
  for (const e of names) {
    if (e.name.startsWith('.')) {
      skipped.notOurs++
      continue
    }
    if (isProtected(e.name)) {
      skipped.protected++
      continue
    }
    const full = join(scratchRoot, e.name)
    let st
    try {
      st = lstatSync(full)
    } catch {
      skipped.unreadable++
      continue
    }
    if (st.isSymbolicLink()) {
      skipped.link++ // 链接本体也只报数:断链与否归持有者(同 `scan()` 的口径)
      continue
    }
    // 散文件与空目录都"没有后代可判龄" —— 它们不是"读不到",按条目自身 mtime 判龄
    // (2026-10-30 现读:scratch 根里 3 枚散文件 + 76 个空骨架全卡在"读不到",永远没人收)。
    const info = st.isDirectory()
      ? scratchTreeStats(full, { nowMs: now, minAgeMs: minAge * HOUR_MS, selfMtimeMs: st.mtimeMs, budget: walkBudget })
      : { fresh: now - st.mtimeMs < minAge * HOUR_MS, newest: st.mtimeMs, files: 1, bytes: st.size, links: 0, protectedHit: null }
    if (info === null) {
      skipped.unreadable++
      continue
    }
    // 超预算 = "没判完",不是"读不动":单列一档,否则大树会静默永远不进候选(2026-10-30 现读)。
    if (info.overBudget) {
      skipped.overBudget++
      continue
    }
    if (info.fresh) {
      skipped.fresh++
      continue
    }
    if (info.newest === null) {
      skipped.unreadable++
      continue
    }
    if (info.protectedHit) {
      skipped.protected++
      protectedPaths.push({ name: e.name, path: full, hit: info.protectedHit, files: info.files, bytes: info.bytes })
      continue
    }
    candidates.push({
      name: e.name,
      path: full,
      dir: st.isDirectory(),
      idleHours: Math.round(((now - info.newest) / HOUR_MS) * 10) / 10,
      files: info.files,
      bytes: info.bytes,
      links: info.links,
    })
  }
  if (candidates.length > SCRATCH_ROUND_CAP) {
    return { ...base, candidates: [], skipped: { ...skipped, fresh: skipped.fresh + 0 }, totalEntries: names.length, error: null, absent: false, capTripped: true }
  }
  return { ...base, totalEntries: names.length, error: null, absent: false, capTripped: false }
}

export function formatScratchReport(r, { apply } = {}) {
  const L = []
  const p = (s = '') => L.push(s)
  if (r.absent) {
    p(`scratch 夹具清扫 · root=${r.scratchRoot} —— 该根没有 scratch 目录,本腿跳过(不记残留,也不记为已清扫)`)
    return L
  }
  if (r.error) {
    p(`scratch 夹具清扫 · root=${r.scratchRoot} —— ${r.error} ⇒ 本腿未判定,不是"已清扫"`)
    return L
  }
  if (r.capTripped) {
    p(
      `scratch 夹具清扫 · root=${r.scratchRoot} —— 候选超过族级熔断(>${r.cap}) ⇒ 整腿本轮不删并报名(方向是少删一次);` +
        `请人工分批看,别把判据调松来"清掉"`,
    )
    return L
  }
  const files = r.candidates.reduce((a, c) => a + c.files, 0)
  const bytes = r.candidates.reduce((a, c) => a + c.bytes, 0)
  p(
    `scratch 夹具清扫 · root=${r.scratchRoot} · 静默闸 ${r.minAgeHours}h · 条目 ${r.totalEntries} → 候选 ${r.candidates.length}(文件 ${files} · ${(bytes / 1048576).toFixed(1)} MB)`,
  )
  p(
    `  跳过(不判但报数):静默未到 ${r.skipped.fresh} · 保护区 ${r.skipped.protected} · 重解析点 ${r.skipped.link} · 读不到 ${r.skipped.unreadable} · 超预算 ${r.skipped.overBudget} · 非夹具 ${r.skipped.notOurs}`,
  )
  for (const c of r.candidates.slice(0, 8))
    p(`  · ${String(c.idleHours).padStart(5)}h  ${c.dir ? '目录' : '文件'} ${c.name}(${c.files} 文件 / ${(c.bytes / 1048576).toFixed(2)} MB)`)
  for (const x of (r.protectedPaths || []).slice(0, 8))
    p(
      `  ⛔ 整条不删(夹具内收着凭据/备份目录,交人核): ${x.name} · ${x.files} 文件 · ${(x.bytes / 1073741824).toFixed(2)} GB · 命中 ${x.hit}`,
    )
  if ((r.protectedPaths || []).length > 8) p(`  ⛔ … 另 ${r.protectedPaths.length - 8} 条保护区命中`)
  if (r.candidates.length > 8) p(`  … 另 ${r.candidates.length - 8} 条(${apply ? '--apply 时逐条执行' : '预演'})`)
  p(apply ? `  本腿删除入口已开(--apply);实际删除仍只走 del()` : `  本轮未删除任何东西;要删请加 --apply`)
  return L
}

export function del(root, candidates) {
  let ok = 0
  let fail = 0
  let bytes = 0
  let firstError = null
  for (const c of candidates) {
    if (!c.path.startsWith(resolve(root))) {
      fail++
      // 越出 root 是判据拒的,不是"删除失败";原因必须记,否则读报告的人会把"路径不合法"当 I/O 故障
      firstError = firstError || `路径越出被扫根: ${c.path}`
      continue
    }
    try {
      rmSync(c.path, { recursive: c.dir, force: true, maxRetries: 2 })
      ok++
      bytes += c.bytes
    } catch (e) {
      fail++
      firstError = firstError || `${c.name}: ${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 160)}`
    }
  }
  return { ok, fail, bytes, firstError }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (has('--self-test')) {
    console.log('判据装配证明在镜像测试面:node --test scripts/tests/scrub-temp-fixtures.test.mjs')
    process.exit(0)
  }
  const minAgeDays = Number(arg('--older-than') || DEFAULT_MIN_AGE_DAYS)
  if (!Number.isFinite(minAgeDays) || minAgeDays < 0) {
    console.log(`❌ --older-than 需要非负数字,得到 ${arg('--older-than')}`)
    process.exit(2)
  }
  // scratch 腿的账龄与 `--older-than`(顶部残留,7 天)是两件事:夹具的生命周期是"一轮测试",
  // 不是"一份构建产物"。不传则按族档 6 小时(仍由 scratchEffectiveMinAgeHours 兜底,调不穿)。
  const scratchArg = arg('--scratch-older-than-hours')
  const scratchMinAgeHours = scratchEffectiveMinAgeHours(
    scratchArg === null ? SCRATCH_MIN_AGE_HOURS_DEFAULT : Number(scratchArg),
  )
  if (scratchArg !== null && (!Number.isFinite(Number(scratchArg)) || Number(scratchArg) < 0)) {
    console.log(`❌ --scratch-older-than-hours 需要非负数字,得到 ${scratchArg}`)
    process.exit(2)
  }
  const apply0 = has('--apply')
  const dryRun = has('--dry-run')
  const apply = apply0 && !dryRun
  if (dryRun) {
    console.log(
      apply0
        ? 'ℹ️ 显式预演:--dry-run 覆盖 --apply ⇒ 删除出口 del() 本轮一次都不会被调用'
        : 'ℹ️ 显式预演:--dry-run(默认本就是只报告)',
    )
  }
  const only = arg('--root')
  const { roots, undetermined } = only
    ? { roots: only.split(';').map((s) => s.trim()).filter(Boolean).map((s) => resolve(s)), undetermined: [] }
    : defaultRoots()
  let errs = 0
  let absent = 0
  let totalCand = 0
  let totalFiles = 0
  let totalBytes = 0
  let okAll = 0
  let failAll = 0
  let firstFail = null
  const now = Date.now()
  for (const root of roots) {
    if (!existsSync(root)) {
      // 根不存在是一个**确定的答案**,但它不是"这一格已清扫":必须点名,否则换一个根又长回来无人知
      absent++
      console.log(`TEMP 夹具清扫 · root=${root} —— 该根不存在,本根跳过(不记残留,也不记为已清扫)`)
      continue
    }
    const r = scan({ root, minAgeDays, now })
    for (const l of formatReport(r, { apply, minAgeDays })) console.log(l)
    if (r.error) {
      errs++
      continue
    }
    totalCand += r.candidates.length
    totalFiles += r.candidates.reduce((a, c) => a + c.files, 0)
    totalBytes += r.candidates.reduce((a, c) => a + c.bytes, 0)
    if (apply && r.candidates.length) {
      const d = del(resolve(root), r.candidates)
      okAll += d.ok
      failAll += d.fail
      if (d.firstError) firstFail = firstFail || d.firstError
      console.log(`  本根已删 ${d.ok} 条 / 失败 ${d.fail} 条 / 释放 ${(d.bytes / 1073741824).toFixed(2)} GB  root=${root}`)
    }
    // ── 第二腿:宿主自产散文件具名族(同一批根、同一个删除出口、同一份汇总)──
    // 汇总行里的 `候选/已删/失败` 必须把这一腿一起算进去:调度器(git-guardian)只读汇总行,
    // 把两腿分开合计等于让"另一条腿删了多少"在它眼里永远是 0。
    const h = scanHostStrays({ root, minAgeDays, now })
    for (const l of formatHostStrayReport(h, { apply })) console.log(l)
    if (h.error) {
      errs++
      continue
    }
    totalCand += h.candidates.length
    totalFiles += h.candidates.length
    totalBytes += h.hostBytes
    if (apply && h.candidates.length) {
      const d2 = del(resolve(root), h.candidates)
      okAll += d2.ok
      failAll += d2.fail
      if (d2.firstError) firstFail = firstFail || d2.firstError
      console.log(`  本根宿主散文件已删 ${d2.ok} 条 / 失败 ${d2.fail} 条 / 释放 ${(d2.bytes / 1048576).toFixed(2)} MB  root=${root}`)
    }
    // ── 第三腿:本项目自己的 scratch 夹具(同一批根、同一个删除出口、同一份汇总)──
    // 根必须是 scratch 目录本身:del() 判 `path.startsWith(root)`,给 TEMP 根会放过越界检查。
    const s = scanScratchFixtures({ root, minAgeHours: scratchMinAgeHours, now })
    for (const l of formatScratchReport(s, { apply })) console.log(l)
    if (s.error) {
      errs++
      continue
    }
    totalCand += s.candidates.length
    totalFiles += s.candidates.reduce((a, c) => a + c.files, 0)
    totalBytes += s.candidates.reduce((a, c) => a + c.bytes, 0)
    if (apply && s.candidates.length) {
      const d3 = del(resolve(s.scratchRoot), s.candidates)
      okAll += d3.ok
      failAll += d3.fail
      if (d3.firstError) firstFail = firstFail || d3.firstError
      console.log(`  本根 scratch 夹具已删 ${d3.ok} 条 / 失败 ${d3.fail} 条 / 释放 ${(d3.bytes / 1048576).toFixed(2)} MB  root=${s.scratchRoot}`)
    }
  }
  const judgable = roots.length - absent - errs
  console.log(
    `汇总 · 根 ${roots.length}(可判 ${judgable} / 不存在 ${absent} / 取不到 ${errs}) · 候选 ${totalCand}` +
      ` · 文件 ${totalFiles} · ${(totalBytes / 1073741824).toFixed(2)} GB · 已删 ${okAll} 条 / 失败 ${failAll} 条`,
  )
  for (const u of undetermined) console.log(`  ⚠️ 未判定:${u} —— 派生根没推出来,少扫的根不等于没有残留`)
  if (failAll && firstFail) console.log(`  ❌ 删除失败首个原因(不得静默):${firstFail}`)
  if (errs || undetermined.length) process.exit(2)
  if (apply && failAll) process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
