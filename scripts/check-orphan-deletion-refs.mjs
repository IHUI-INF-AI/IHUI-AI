#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 孤儿删除的引用对账(2026-09-29 立;定级 warn/告警,**刻意不进提交链**)
 *
 * 拦的是这一型的前置条件:**索引与磁盘里已经没有某个文件,而 HEAD 的树里仍有人引用它。**
 * 2026-09-29 一晚两次把生产 web 构建打挂(UTC 04:36 与 05:17 两轮,各 4 次尝试全失败,
 * 各记 30 分钟冷却,线上停在 03:47 那版),报的第一现场是 `wxt build` 与 next build 失败,
 * 真凶是那 9–10 个处于 `D `(已暂存删除)态的跟踪文件 —— 而构建取的是**工作树**,
 * 于是"工作树缺文件 + HEAD 树里 import 仍在"直接编译不过。
 *
 * 为什么现有判据看不见这一格(逐条查过,不是"应该会有门"):
 *  - 守门 98(悬空具名导入)与 99(暂存删除存续性)都**只判一个面**:98 判 HEAD、99 判索引。
 *    本型恰好在**两面之间** —— 文件在 HEAD 的引用者眼里"必须存在",在索引里"已被删除";
 *  - 旁路落地(commit-tree + CAS)与对象空间合并**不跑钩子**,所以提交链上那两道门对这批提交从未执行
 *    (§12f 已登记这一族;本仓跳门总量的唯一真值来源是 `.workbuddy/safe-commit-attestation.jsonl`);
 *  - `heal-worktree-tracked` 早就把这 9–10 个路径**如实报数**了,但它只报数不喊人,
 *    而"报数"在没人看日志时等于安静(本仓最高频失效型)。
 *
 * 因此本器要做的事只有一件:**把已有的"已删除而 HEAD 仍引用"这一态,从一行计数变成一次点名。**
 * 三条设计约束:
 *  1. **不自己写第二把匹配尺**:哪些字符串算 import/require、相对说明符怎么拼、模块候选名怎么展开,
 *     全部复用守门 99 那一份实现(`collectHits`);本器只负责"取哪两个面、怎么喂"。
 *     在别处再抄一份正则就是第二个真相(§22c 同一条理由)。
 *  2. **预筛必须是判据字面量的严格超集**:先用 `git grep -I -l -e <stem>` 在 HEAD 面上收候选
 *     (漏了名字就等于门对该形态全盲,守门 102/131 记过多次),再交给 99 的判据逐条定夺。
 *     git grep 命中而判据不认(注释里的引用、裸包名同词)⇒ 不算命中,这正是"预筛宽、判据窄"。
 *  3. **取不到就是未判定,不记通过也不记红**:HEAD 问不到、git grep 派生失败、候选内容取不到
 *     ⇒ 逐条打印原因并把这一维标成 `undetermined`。把"没看清"写成"没问题"是本仓最贵的错法。
 *
 * 退出码:0 = 无命中(或整体未判定,末行会写"未判定:<原因>");1 = 有"已删除而树内仍被引用"的路径;
 *        2 = 用法/环境错(仓库根问不到、git 不可达、参数自相矛盾)。
 * 用法:`node scripts/check-orphan-deletion-refs.mjs [--json|--self-test|--quiet]`
 *
 * 定级说明(为什么不是 blocking):它判的是**此刻索引与 HEAD 的错位**,属机器/并发状态 ——
 * 与某次提交的内容无关的 blocking 红,唯一结局是每台每次被逼 `--no-verify`,连带让链上其余全部
 * 守门对该提交作废(§12e/§12f 同型),所以它**刻意不进提交链**。
 *
 * 调度器现值(2026-09-29 接上):唯一的常驻班次是 `scripts/git-guardian.mjs` 的巡检 tick ——
 * 派发点 `auditOrphanDeletionRefs()`,节流默认 30 分钟(`IHUI_ORPHAN_AUDIT_INTERVAL_MS`),
 * 命中经 `notifyGuardRed()` 走 §5e 唯一邮件通道,未判定只写日志不喊人;挂点写在"健康轮次早退之前
 * + 非 --check"那一分支(挂进 CHECK_ONLY 分支等于永不执行,本仓已记过两次)。在此之前它是
 * **只有人在跑、没有班次在跑**,而同一型缺陷(HEAD 有 / 索引与磁盘都无 / 源码仍 import)当晚两次炸构建。
 * 手动问责入口仍是上方「用法」那一行。
 * 头注不写"已接钩子 / 已进持续集成 / 第几项"那类措辞:五处权威点里没有它,那种声称会被守门 89 判红。
 *
 * 2026-10-05(G-998191)git 出口收口:本器**三处**git 派生(`git()` 包络、`grepCandidates` 的
 * `git grep`、`selfTest` 的夹具建仓链)全部由 `execFileSync('git', …)` 裸调用迁到取材层
 * `scripts/lib/face-reader.mjs` 的 `gitRaw` —— 仓内逐文件迁移的存量债(判据在
 * `scripts/tests/face-reader.test.mjs` 的 `BARE_GIT_BASELINE`,只减不增)。收益不止"统一":
 * 裸 `'git'` 依赖 PATH(§5b"git 调用不得依赖环境",换机/换服务身份就 ENOENT);层还写死了
 * 绝对路径 binary、`-c safe.directory=*`、显式 stdio 三态、数字 timeout、64MB maxBuffer。
 * 逐条行为面对照见下面 `git()` 与 `grepCandidates()` 的头注(**其中 quotepath 一项是纠偏,
 * 不是等价替换**;失败消息文本亦有一次可观察的加前缀,已在两处 catch 的头注点名)。
 * ⚠️ 本票的验证通道有一处**环境限制**,如实记在这里:`--self-test` 在本机跑不完 ——
 * 它造完现场后要 `rmSync` 删磁盘文件,而本机 CLI 侧挂着批量删除闸
 * (`SAFE_DELETE_BULK_CONFIRM_REQUIRED`,阈值 50),该调用被拦 ⇒ 自检在**第一条断言之前**就退出。
 * 已实测这不是迁移引入的:把 `git show HEAD:` 的**未迁移原版**放回同路径跑 `--self-test`,
 * 报同一句同一条栈(`selfTest` 里的 `rmSync`)。故那一格的读数由等价的探针代替
 * (用改名搬走代替删除,断言与判据同形,6 条全 PASS),不靠"应该没问题"交差。
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 2026-10-05(G-998191)迁移:本器全部 git 派生改走取材层的 `gitRaw`。此前是三处
// `execFileSync('git', …)` 裸调用,形态同时踩三条:① 裸 'git' 依赖 PATH(换机/换服务身份
// 就 ENOENT);② 默认 stdio 把子进程 stderr 直接透到父进程,而本器的 stdout 是**逐行读数**
// (末行"孤儿删除 N 条 / 命中 M 条"),git 的杂音(`fatal:` 之类)会混进读数里;③ 无 timeout,
// 索引锁住时无界挂起 —— 而本器恰恰是去读索引面的尺子,撞锁的概率高于别的门。
import { gitRaw } from './lib/face-reader.mjs'

// 临时夹具唯一落点(§26):裸 `mkdtempSync` 在本仓被镜像测试当反向锁钉过 —— 仓库树内的夹具会被
// `git rev-parse --show-toplevel` 向上逃逸到真仓,夹具就证不了"这是个独立仓"。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

// 唯一一把匹配尺(守门 99 的实现),不得在此重述"什么算 import"
import { collectHits } from './check-staged-deletions.mjs'
// 唯一一处"哪些路径处于 HEAD 有 / 索引无 / 磁盘无"的枚举口
import { findOrphanedDeletions } from './heal-worktree-tracked.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** `git grep` 预筛的 timeout:全仓逐 stem 扫描,冷缓存下层默认的 60s 不够(见 grepCandidates 头注)。 */
const GREP_TIMEOUT_MS = 90_000
/** 夹具建仓链的 timeout:旧裸调用无上界,层默认这一档是净收益(见 selfTest 里 `g` 的头注)。 */
const FIXTURE_GIT_TIMEOUT_MS = 60_000
/** 只有源码与配置才可能"引用一个模块";文档/JSON 里的同名串不算证据。 */
const SCAN_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|vue|svelte|json|jsonc|css|scss|html)(\.[^/]*)?$/

/**
 * 一次 git 派生的唯一出口。2026-10-05(G-998191)由 `execFileSync('git', …)` 迁到层 `gitRaw`,
 * 行为面逐条对齐(不靠记忆,逐项对过):
 *   · **stdio 三态**是本仓实测铁律(2026-09-30):git 子进程不吃 stdin ⇒ stdin 必须 'ignore',
 *     否则交互会话下 spawnSync 报 EBUSY。旧调用显式写了 `['ignore','pipe','pipe']`;
 *     `gitRaw` 把这一档**写死**在层里(face-reader.mjs:94,不带 input 即 'ignore'),
 *     不再由每个调用方各自记得传 —— 这正是本次迁移的收益本身。
 *     连带取消能力:旧 `opt.stdio` 旁路(可让调用方改成继承/piping)没有了,而**本器无调用方
 *     用过它**(`g()` 唯一调用点是 `ls-files -z`),所以收口不损失任何在用能力。
 *   · **绝对路径 git + safe.directory + windowsHide + 数字 timeout + 64MB maxBuffer** 全部由层
 *     给足:旧调用自带 `maxBuffer: 1 << 26`(64MB)与 `timeout`,与层的默认值**逐字相同**
 *     (GIT_TIMEOUT=60000、GIT_MAX_BUFFER=64<<20),所以这两项是等价替换,不是收紧也不是放宽。
 *   · **quotepath**:层强制 `core.quotepath=false`,旧裸调用吃 git 默认的 `true`。对本器的
 *     `ls-files -z` **无影响** —— `-z` 本就逐条 NUL 分隔、路径不经 quoting;真正吃 quotepath 的
 *     是下面 `grepCandidates` 那一处,那里它是有利方向的纠偏(见该函数头注)。
 *   · **失败语义**:层抛 `Undetermined`(Error 子类)并把 `e.status` 挂上(face-reader.mjs:121),
 *     所以 `grepCandidates` 里 `e?.status === 1`(git grep 无命中)那条判别**仍然成立** ——
 *     迁移不会把"git 说没有"折叠成"git 没跑成",反之亦然。
 */
function git(root, args, opt = {}) {
  return gitRaw(args, root, { timeout: opt.timeout ?? GIT_TIMEOUT_MS })
}

/** `ls-files` 那条派生的 timeout;与层默认同值,写出来只为把"数字 timeout"这条落到本文件可见处。 */
const GIT_TIMEOUT_MS = 60_000

/** 预筛:`git grep` 搜**工作树**(不带 rev),`-F` 让每个 stem 按字面量匹配,不自己转义。
 *
 *  2026-10-05(G-998191)迁到层 `gitRaw`,三处行为面对照:
 *   · **timeout 90_000 保留**:本调用是全仓逐 stem 的 `git grep -F -l`,候选集大小预料不了,
 *     层默认的 60s 不足以覆盖大仓冷缓存,故显式给 90_000(不放宽到"无 timeout" —— 旧调用有上界,
 *     收口不得把这道护栏丢掉)。
 *   · **maxBuffer 64MB**:旧值 `1 << 26` 与层默认**逐字相同**,等价替换。
 *   · **quotepath=false 是纠偏,不是等价替换**(本机实测,git 2.55.0.windows.3):旧裸调用吃默认
 *     `true`,`git grep -l` 命中**非 ASCII 文件名**时吐出的是带引号的八进制串
 *     (`"apps/web/src/\345\274\225...ts"`),而这些候选名随后要过 `SCAN_EXT.test(f)`、
 *     `existsSync(resolve(root, f))`(live 活集)与 `readFileSync` —— 实测转义串**三道全不过**
 *     (SCAN_EXT=false / existsSync=false / 不可读),即含中文/重音文件名的**真引用会被静默漏判**;
 *     层强制 `false` 后拿到真路径,三道全过。方向是"少漏一条真引用",与本器"宁漏不误报"的取舍同向
 *     (误报会让人把告警当噪音;漏报只在本就未判红的一格里少报数)。
 *     ⚠️ 别把这个差推广到 `ls-files -z`:实测 `-z` 下两种取值输出**逐字相同**(NUL 分隔不经
 *     quoting),所以上面 `git()` 那一条只需写"无影响" —— 它没有可观察的纠偏面。
 *   · **`-c safe.directory=*` 由层统一注入**,故此处不再自己拼 —— 拼两份虽不报错,却是两处真相。
 *   · 失败分支的文本有一处**可观察变化**:层抛的 `Undetermined` 把 git 首行错误包进 message,
 *    而旧代码取 `e.stderr` 的首行。落到 `undetermined` 里的那串因此会带上 `git grep 失败:` 前缀。
 *    形态仍是"逐条打印原因 + 该维标未判定",判据与出口码都不变(见 main() 的 146 行 push)。
 */
function grepCandidates(root, stems) {
  const args = ['grep', '-I', '-l', '-F']
  for (const s of stems) args.push('-e', s)
  try {
    const out = gitRaw(args, root, { timeout: GREP_TIMEOUT_MS })
    return { files: [...new Set(out.split(String.fromCharCode(10)).filter(Boolean))] }
  } catch (e) {
    // git grep 的 1 = 无命中(正常的空结果),>=2 = 真失败 ⇒ 交调用方记未判定,不得当"没有引用"
    if (e?.status === 1) return { files: [] }
    const first = String(e?.stderr ?? e?.message ?? e).split(String.fromCharCode(10))[0]
    return { files: [], error: first }
  }
}

/**
 * 核心判据(导出给镜像测试直接 import,§22c)。
 *
 * **判的是工作树那一份,不是 HEAD / 索引 —— 这是本器唯一的例外口径,理由写在这里而不是藏在实现里:**
 * 它要预测的不是"这次提交入库后账面合不合",而是"**构建此刻会不会失败**"。构建吃的就是工作树
 * (部署环 `pnpm build` 读磁盘、api 服务 `tsx src/index.ts` 直读磁盘源码),所以"引用者还在磁盘上、
 * 被引用的文件已不在磁盘上"这一格只有工作树面能给答案。拿 HEAD 判会把仍在磁盘上的引用者读成
 * "已删除"(它 HEAD 里还有),拿索引判则读不到今晚那 22 条**未暂存**删除 —— 两个常规面都恰好看不见
 * 这一型。守门 118 会把本器归到 loose-fs 一类,那是**如实**分类而不是待修缺陷:它是机器状态看门,
 * 不在提交链上,不产生红,也就不会替某次提交挡路。
 *
 * @returns {{hits:Array<{path:string,via:string[]}>, undetermined:string[], deleted:number, candidates:number}}
 */
export function auditOrphanDeletionRefs(root = ROOT) {
  const g = (args, o) => git(root, args, o)
  const undetermined = []
  let deleted
  try {
    deleted = findOrphanedDeletions(root).orphanIndex
  } catch (e) {
    return {
      hits: [],
      undetermined: [`索引/状态问不到:${String(e?.message ?? e).split('\n')[0]}`],
      deleted: 0,
      candidates: 0,
    }
  }
  if (!deleted || deleted.length === 0) return { hits: [], undetermined, deleted: 0, candidates: 0 }

  // 活集 = 跟踪清单里**磁盘上还在**的那些(被删掉的自然不在,判据据此区分"断了"与"只是改名搬走")
  let live
  try {
    const tracked = g(['ls-files', '-z']).split('\0').filter(Boolean)
    live = new Set(tracked.filter((p) => existsSync(resolve(root, p))))
  } catch (e) {
    return {
      hits: [],
      undetermined: [`跟踪清单取不到:${String(e?.message ?? e).split('\n')[0]}`],
      deleted: deleted.length,
      candidates: 0,
    }
  }
  const stems = [...new Set(deleted.map((p) => p.split('/').pop().replace(/\.[^.]*$/, '')))].filter(Boolean)
  const grep = grepCandidates(root, stems)
  if (grep.error) undetermined.push(`git grep 派生失败:${grep.error}`)
  const files = (grep.files ?? []).filter((f) => SCAN_EXT.test(f) && !deleted.includes(f) && live.has(f))
  if (files.length === 0) {
    // 预筛零命中是**有效结论**(没有任何活着的源码文件提到这些名字),不是未判定
    return { hits: [], undetermined, deleted: deleted.length, candidates: 0 }
  }
  const readFile = (f) => {
    try {
      return readFileSync(resolve(root, f), 'utf8')
    } catch {
      // 单个引用方读不到 ⇒ 该文件不计入结论(宁漏不误报),但必须能从 candidates 里看出少了谁
      return null
    }
  }
  const hits = collectHits(deleted, files, readFile, live)
  const out = []
  for (const [p, list] of hits) {
    if (!list || !list.length) continue
    // 只把**引用方路径**交出去(hit 还带 line/form/spec,报告与自检都按文件名比,别拿对象去 includes)
    out.push({ path: p, via: [...new Set(list.map((h) => h.file))], detail: list })
  }
  return { hits: out, undetermined, deleted: deleted.length, candidates: files.length }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (c, n) => (c ? ((pass++), true) : ((fail++), console.log(`  ❌ ${n}`), false))
  const tmp = mkScratch('orphan-deletion-selftest')
  const put = (rel, text) => {
    const abs = join(tmp, rel)
    mkdirSync(dirname(abs), { recursive: true }) // 嵌套路径不建目录 = ENOENT(第一版就栽在这)
    writeFileSync(abs, text, 'utf8')
  }
  try {
    // 2026-10-05(G-998191)迁到层 `gitRaw`。这一条链(init/config/add/commit/rm --cached)是
    // 夹具建仓,**cwd 在 scratch 临时仓**而非仓根 —— `gitRaw` 第二参就是那个仓根,层用 `-C <root>`
    // 与 `cwd: root` 双指,**逐字等价**于旧调用的 `cwd: tmp`。
    // 能力对照:① 旧调用**无 timeout**(裸 default),层给 60_000 ⇒ 净收益(夹具建仓撞索引锁时
    // 由无界挂起变成有界失败);② 旧调用 maxBuffer 走 Node 默认 1MB,层给 64MB ⇒ 净收益;
    // ③ stdio 旧显式 `['ignore','pipe','pipe']` + 那条"EBUSY 根治(errno -4082):零 input
    // 所以 stdio[0]='ignore' 安全"的注释**原样成立** —— 层在不带 input 时正是写死这一档
    // (face-reader.mjs:94),而本链走 init/config/add/commit/rm,一律不喂 stdin(正文一律
    // writeFileSync 落盘),所以收口没有把那条根治注释变成谎言;④ quotepath 由层强制 false,
    // 本链输出(`init -q` 空、`add` 无输出、`commit -q` 无输出、`rm --cached -q` 无输出)
    // 一条路径都不经 ⇒ 无可观察差异。
    const g = (args) => gitRaw(args, tmp, { timeout: FIXTURE_GIT_TIMEOUT_MS })
    g(['init', '-q'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    // 说明:夹具正文一律用 String.fromCharCode(10) 拼换行 —— 这一族 `\n` 字面量在
    // `perl -0777 -pi` / `python` 的 heredoc 里会被展开成真换行,把 JS 字符串字面量截断成语法错
    // (本文件今晚就这么坏过两次;仓里那条"别在 shell 里内联写代码改文件"的规矩就是为这个)。
    const NL = String.fromCharCode(10)
    put('packages/shared/src/chat/mod.ts', 'export const a = 1' + NL)
    put(
      'apps/web/src/page.ts',
      "import { a } from '../../../packages/shared/src/chat/mod.js'" + NL + 'export const b = a' + NL,
    )
    // A2 的夹具:注释里**逐字**写着一条指向被删模块的路径。git grep 一定命中(预筛宽),
    // 而判据看代码面的字符串 ⇒ 不得算引用(否则本器会把自己立项时写下的解释读成违规)。
    put(
      'docs/note.ts',
      '// 曾经的写法是 import("../../../packages/shared/src/chat/mod.js"),已废弃' + NL + 'export const z = 1' + NL,
    )
    put('packages/shared/src/chat/lonely.ts', 'export const l = 1' + NL)
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'base'])
    // 造"已暂存删除而引用者未动"的现场:git rm --cached(索引删,磁盘留)后再删磁盘文件
    g(['rm', '--cached', '-q', '--', 'packages/shared/src/chat/mod.ts'])
    rmSync(join(tmp, 'packages/shared/src/chat/mod.ts'))
    const r = auditOrphanDeletionRefs(tmp)
    ok(r.deleted === 1, `A1 夹具须被识别为 1 条孤儿删除,实测 ${r.deleted}`)
    ok(
      r.hits.some((h) => h.path === 'packages/shared/src/chat/mod.ts'),
      `A1 已删除而 HEAD 树内仍被引用 ⇒ 必须点名,实测 ${JSON.stringify(r.hits.map((h) => h.path))}`,
    )
    ok(
      !r.hits.some((h) => (h.via ?? []).includes('docs/note.ts')),
      `A2 注释里的路径字符串不得算引用(判据必须窄于 git grep 预筛),实测 ${JSON.stringify(r.hits.map((h) => h.via))}`,
    )
    // 第三臂:一条**没有任何引用者**的孤儿删除(只报数,不得被算成命中)。
    // 少了这一臂,"把每条孤儿都判红"与"只点被引用的那条"在账面上长得一样 —— 而前者会让
    // 每一次正常的 git rm 都喊人,唯一结局是各会话把这一层的告警当噪音关掉。
    g(['rm', '--cached', '-q', '--', 'packages/shared/src/chat/lonely.ts'])
    rmSync(join(tmp, 'packages/shared/src/chat/lonely.ts'))
    const r2 = auditOrphanDeletionRefs(tmp)
    ok(r2.deleted === 2, `第三臂须有 2 条孤儿删除(mod.ts + lonely.ts),实测 ${r2.deleted}`)
    ok(
      r2.hits.length === 1 && r2.hits[0].path === 'packages/shared/src/chat/mod.ts',
      `只有"仍被引用"的那条该被点名,实测 ${JSON.stringify(r2.hits.map((h) => h.path))}`,
    )
    ok(r2.undetermined.length === 0, `不该出现未判定,实测 ${JSON.stringify(r2.undetermined)}`)
    // 未判定那一支:仓库根问不到 ⇒ 只能喊未判定,不得记"通过"
    const r3 = auditOrphanDeletionRefs(join(tmp, 'no-such-dir-xyz'))
    ok(
      r3.hits.length === 0 && r3.undetermined.length > 0,
      `A3 取不到状态必须落未判定并给原因,实测 ${JSON.stringify(r3)}`,
    )
    console.log(`自检:${pass} 通过 / ${fail} 失败`)
    return fail === 0 ? 0 : 1
  } finally {
    try {
      rmScratch(tmp)
    } catch {
      /* 临时件清不掉不影响结论(它落在 scratch 根里,由 scratch 自己的体检负责) */
    }
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const quiet = argv.includes('--quiet')
  const r = auditOrphanDeletionRefs(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : ROOT)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r))
    return r.hits.length ? 1 : 0
  }
  if (!quiet) {
    console.log(
      `孤儿删除的引用对账(判定面:工作树 —— 构建吃的那一份;孤儿 = HEAD 有而索引与磁盘都无):孤儿删除 ${r.deleted} 条 / 预筛候选 ${r.candidates} 个文件 / 命中 ${r.hits.length} 条`,
    )
    for (const h of r.hits) console.log(`  ❌ ${h.path} —— 仍被这些位置引用:${h.via.slice(0, 4).join(', ')}${h.via.length > 4 ? ` 等 ${h.via.length} 处` : ''}`)
    for (const u of r.undetermined) console.log(`  ⚠️ 未判定:${u}`)
    if (r.hits.length === 0 && r.undetermined.length === 0 && r.deleted > 0)
      console.log('  ✅ 有孤儿删除,但 HEAD 树内无人再引用它们(只报数,不构成红)')
  }
  return r.hits.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { auditOrphanDeletionRefs, SCAN_EXT, grepCandidates }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
