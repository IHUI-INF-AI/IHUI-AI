#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guard-status-where.mjs —— 结算/状态写点守卫(出处 b76-12e G-998159,新增文件交付,尚未接提交链)。
 *
 * 判据(票面原文):`git grep -n "set({ status" -- apps/api/src/db` 的每个命中,
 * 其后 3 行内必须出现 `status` 于 where 谓词,或显式注明无需守卫的理由
 * (注释标记 `status-guard-exempt: <理由>`,写在 set 行当行或其后 3 行内)。
 *
 * 背景:条件 UPDATE + 影响行数判失败 = "终态不可逆出"纪律(对照 order-queries.ts
 * cancelPayment / agents-queries.ts settleSettlement)。本脚本只做棘轮式报告:
 * 退出码 0 = 全部命中合规;1 = 存在裸写点(列出 file:line)。
 *
 * 用法:
 *   node scripts/guard-status-where.mjs             # 判当前工作树
 *   node scripts/guard-status-where.mjs --staged    # 判索引(git grep --cached)
 *
 * 注意:子进程 stdio 由取材层统一写死(见下「git 出口收口」)。
 * 接提交链前须在真仓 HEAD 面现跑确认结论可接受(当前存量命中多为此前遗留裸写点,
 * 直接挂 blocking 会造成恒红门,故先以报告形态交付,由主会话决定棘轮节奏)。
 *
 * 2026-10-06(G-998191)git 出口收口:本门唯一的 git 派生(`gitGrep()` 里那处 `git grep`)
 * 由 `spawnSync('git', …)` 裸调用迁到取材层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
 * —— 仓内逐文件迁移的存量债(判据在 `scripts/tests/face-reader.test.mjs` 的
 * `BARE_GIT_BASELINE`,只减不增)。收益不止"统一"本身:裸调用依赖 PATH、且每处都要各自
 * 记得写全 stdio/timeout 两项。逐条行为面对照见 `gitGrep()` 的头注
 * (其中 **quotepath 一项是纠偏**,不是等价替换 —— 它纠的是一条会抛ENOENT 崩门的哑尺子风险;
 * 而 **maxBuffer 这一项与前四枚方向相反:本门是放宽,不是收窄**)。
 */
// 2026-10-11(G-1117441):内容面不再用 `readFileSync(join(ROOT, …))` —— 那正是守门 118 判
// half-wired 的那一格(引了取材层却自己读磁盘)。取内容一律 `catBatch`,与枚举那次 grep 同面同轮。
// 2026-10-06(G-998191)迁移:本门全部 git 派生改走取材层的 `gitRaw`。此前是一处
// `spawnSync('git', …)` 裸调用,形态踩两条:① 裸 'git' 依赖 PATH(§5b"git 调用不得依赖环境",
// 换机/换服务身份就 ENOENT);② 无 timeout,索引锁住时无界挂起。
// 旧调用**自带** `stdio:['ignore','pipe','pipe']` 与 `windowsHide:true`(本仓 EBUSY 铁律的
// 既有合规写法),stdio 那一项由层按`opts.input` 有无自动分派,形态不变 —— 见下面头注。
import { gitRaw, catBatch } from './lib/face-reader.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATHSPEC = 'apps/api/src/db'
const WINDOW = 3 // set 行之后检查的行数(票面:其后 3 行内)
const EXEMPT_RE = /status-guard-exempt[:：]\s*\S+/

/** `git grep` 的 timeout:旧裸调用**无上界**(spawnSync 未传 timeout),层默认 60s 是净收益的一档;
 *  显式写出来只为让"数字 timeout"在本文件可见(与前四枚同写法),不借"层给了"蒙过去。 */
const GREP_TIMEOUT_MS = 60_000

/**
 * 取 `set({ status` 的命中面。2026-10-06(G-998191)由 `spawnSync('git', …)` 迁到层 `gitRaw`,
 * 行为面逐条对照(不靠记忆,逐项核过):
 *   · **退出码分派 —— 本次迁移唯一需要真改代码结构的地方**。旧形态用 spawnSync 的 `res.status`
 *     判"grep 无命中(1)";`gitRaw` 走 execFileSync,**非零退出即抛**,所以那条判别挪进catch:
 *     `e?.status === 1` 仍判无命中(层把 git 退出码挂在异常上,face-reader.mjs:121),
 *     其它非零/派生故障仍走原来的 exit 2。**"git 说没有"没有被折叠成"git 没跑成"**,反之亦然。
 *   · **stdio**:旧调用显式写了 `['ignore','pipe','pipe']`(本仓 EBUSY 铁律:git 子进程不吃 stdin,
 *     交互会话下建管道确定性 EBUSY —— 本次实测当场复现:同一条 spawnSync 不带 stdio 时报
 *     `EBUSY`/`status=null`,带上就正常)。`gitRaw` 把这一档**写死**在层里(face-reader.mjs:94,
 *     不带 input 即 'ignore'),不再由每个调用方各自记得传 —— 这正是本次迁移的收益本身。
 *     本调用不吃 stdin,形态逐字不变。
 *   · **绝对路径 git + safe.directory + windowsHide**:层统一给足。旧调用写死 'git' 依赖 PATH。
 *   · **maxBuffer —— 本项与前四枚方向相反,如实记:本门是放宽,不是收窄**。旧 spawnSync 调用
 *     **没传 maxBuffer**,吃 Node 默认(实测约 1MB:派生 3MB 输出 → `ENOBUFS`、`status=null`,
 *     只回 1114112 字节);层默认给 64MB。本门真实输出 = **3079 字节**(工作树面与 `--cached` 面
 *     同值,31 行),对 64MB 有 **21827x** 余量,对旧的 ~1MB 也有 340x —— 两个方向都够,
 *     所以这是一次**纯粹的放宽**,不构成任何行为漂移(前四枚是 256MB→64MB 的收窄,别照抄那个结论)。
 *   · **quotepath —— 这一项是纠偏,不是等价替换,且纠的是一条会崩门的哑尺子风险**(实测,非推断):
 *     层强制 `core.quotepath=false`,旧裸调用吃 git 默认 `true`,后者把非 ASCII 路径转义成
 *     带双引号的八进制串。逐字证据(scratch 仓 `apps/api/src/db/中文目录.ts` 一次实测):
 *       true → `"apps/api/src/db/\344\270\255\346\226\207\347\233\224\345\275\225.ts":1:x.set(...)`
 *       false → `apps/api/src/db/中文目录.ts:1:x.set(...)`
 *     本门**确实解析路径名**(`checkHit()` 的正文由 `hit.file` 那个 rev 从 `catBatch` 取,
 *     不是只读行数/空否),所以转义串会一路穿到取材:用本门 `gitGrep()` 里那条
 *     `/^(?:HEAD:)?([^:]+):(\d+):(.*)$/` 逐字跑那条 true 输出,`m[1]` = `"apps/...octal.ts"`(带引号),
 *     拿它拼出的 rev 取不到正文 ⇒
 *     `catBatch` 给 `null`,本门落 **exit 2「无法判定」并点名该文件** ⇒ 含中文/重音路径的真命中
 *     不再让本门崩掉。旧形态在此处实测抛 `ENOENT: no such file or directory`,崩在 `checkHit` 里
 *     既不是 exit 1 也不是 exit 2,是未捕获异常 —— 方向是"少一条崩门,且绝不把取不到写成通过"。
 *     (2026-10-11 G-1117441 把内容面迁到取材层时,这条失败形状随之从"崩"变成"未判定",如实改述。)
 *     ⚠️ 当前被审面**暴露为零**:全仓 `git ls-files` 非ASCII 跟踪路径 **0 条**
 *     (grep -cP '[^\x00-\x7F]' = 0),本门现读两取值输出 `diff` **逐字节相同**。
 *     这是"此刻无暴露",不是"此处无纠偏面" —— 判据读得到路径名,机制就成立。
 *     另:即便路径名不含非 ASCII,转义串的**双引号**也会让 `^([^:]+):(\d+):(.*)$` 把首字符
 *     `"` 吃进 file,同样拼不出真实路径。
 *   · **失败消息文本有一处可观察变化**:旧代码打 `res.error?.message ?? res.stderr`;
 *     层抛的 `Undetermined` 本身已经把 git 首行错误包成 `git grep 失败: …`(face-reader.mjs:117),
 *     所以这里**只留本门的前缀**,不再叠第二份 —— 否则会打出 `git grep 失败: git grep 失败: …`
 *     两遍(变异对照实测抓到过这个形态,已按"一条错误只说一次"改掉)。
 *     判据与出口码不变(仍 exit 2)。
 */
function gitGrep(cached) {
  // 2026-10-11(G-1117441):枚举面与内容面必须同面同轮 —— 旧写法缺省档让 `git grep` 扫**工作树**
  // (不带修订即按磁盘跟踪文件),而 checkHit 又 `readFileSync(join(ROOT, …))` 读磁盘,于是
  // `--staged` 档变成"索引进、磁盘出"的混面尺子(守门 118 判 half-wired 的那一型),缺省档则
  // 整门按磁盘判(共享工作树常年滞后 HEAD ⇒ 同一份 HEAD 代码在恒红/假绿之间来回跳)。
  // 现:缺省档显式带 `HEAD` 修订、`--staged` 带 `--cached`,两份 grep 输出的**路径形态不同**
  // (带修订时 git 会前缀 `HEAD:`),所以下面那条解析式必须容得下可选的修订前缀 —— 少这一格,
  // `^([^:]+):(\d+):` 会把 "HEAD" 当文件名、把真路径当行号,整门**静默 0 命中**(扫到 0 先怀疑尺子)。
  const args = ['grep', '-n', '-F', 'set({ status']
  if (!cached) args.push('HEAD')
  args.push('--', PATHSPEC)
  if (cached) args.splice(1, 0, '--cached')
  let out
  try {
    out = gitRaw(args, ROOT, { timeout: GREP_TIMEOUT_MS })
  } catch (e) {
    if (e?.status === 1) return [] // grep 无命中(git 的正常非零结论,不是故障)
    console.error(`[guard-status-where] ${e?.message ?? e}`)
    process.exit(2)
  }
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(?:HEAD:)?([^:]+):(\d+):(.*)$/)
      if (!m) return null
      return { file: m[1], line: Number(m[2]), text: m[3] }
    })
    .filter(Boolean)
}

function checkHit(hit, contentText) {
  const lines = contentText.split(/\r?\n/)
  const windowLines = lines.slice(hit.line, hit.line + WINDOW) // 其后 3 行
  const windowText = windowLines.join('\n')
  if (EXEMPT_RE.test(hit.text) || EXEMPT_RE.test(windowText)) return 'exempt'
  // where 谓词里出现 status:set 行后 3 行内同时见 where 构造与 status 列引用
  if (/status/.test(windowText) && /where|and\(|eq\(|ne\(|inArray|notInArray/.test(windowText)) {
    return 'guarded'
  }
  return 'bare'
}

const cached = process.argv.includes('--staged')
const hits = gitGrep(cached)
// 内容一律走取材层的批量读取出口(与上面那次 grep **同面同轮**):
// `--staged` 取索引 blob(`:path`),缺省档取 HEAD blob(`HEAD:path`)。
// `catBatch` 对取不到的 rev 给 `null` —— 那是"没问到",不得当成"没有命中"放过(§118/§12e 同一条禁令)。
const prefix = cached ? ':' : 'HEAD:'
const contents = catBatch(ROOT, new Set(hits.map((h) => prefix + h.file)))
const unreadable = []
const violations = []
for (const hit of hits) {
  const text = contents.get(prefix + hit.file)
  if (text === null || text === undefined) {
    unreadable.push(hit.file)
    continue
  }
  const verdict = checkHit(hit, text)
  if (verdict === 'bare') violations.push(hit)
}

console.log(`[guard-status-where] 扫描面 ${PATHSPEC},判定面 ${cached ? '索引 blob(:path)' : 'HEAD blob(HEAD:path)'},命中 ${hits.length} 处 .set({ status ...`)
for (const v of violations) console.log(`  裸写点(无 status 谓词/无豁免注记): ${v.file}:${v.line}`)
if (violations.length > 0) {
  console.error(
    `[guard-status-where] FAIL: ${violations.length} 处裸写点。` +
      '修法 = where 加 status 守卫(终态集合用 notInArray/ne),或注明 `status-guard-exempt: <理由>`。',
  )
  process.exit(1)
}
if (unreadable.length > 0) {
  const uniq = [...new Set(unreadable)]
  console.error(
    `[guard-status-where] 无法判定:${uniq.length} 个被 grep 点名的文件在 ${cached ? '索引' : 'HEAD'} 面取不到正文 —— ${uniq.join(', ')}。` +
      'git 说命中而取不到正文,是取材出了问题,不是"没有违规";不得把这一格读成通过。',
  )
  process.exit(2)
}
console.log('[guard-status-where] OK: 全部命中带 status 谓词或显式豁免')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
