#!/usr/bin/env node

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
import { join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { devEnvRoot } from './seal-c-root-stray.mjs'

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
    maxBytes: 64,
    minAgeDays: 3,
    content: 'singlePathLine',
    why:
      'Qoder 会话宿主每次 shell 调用写一枚 `pwd -P` 的一行路径面包屑(实测 11 B);不是任何程序的输入, ' +
      '机主 2026-10-16 已按同一判据手删 4,600 枚。三重闸:普通文件 ∧ ≤64 B ∧ 内容去空白后单行且像路径。',
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
    try {
      dev = deriveDevEnv()
    } catch (e) {
      dev = null
      undetermined.push(`devEnvRoot() 推导失败:${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`)
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
  let error = null
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
