#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 盘根卫生守门(warn,巡检档)— 判"项目产物是否外流到盘根"与"worktree 是否落在合法落点"。
 *
 * 立因(2026-09-30 G 盘清理收口):用户明确"除了项目主文件夹外不允许有任何东西出去"。
 * 本轮实测:盘根残留 13 个 IHUI-AI-wt-* 陈旧检出(452MB)、.pytest_tmp_* 168MB、tmp-check 等,
 * 而仓内既有 check-root-dir-clean 只判**仓库根一级**,盘根(G:\)与 worktree 登记面无人看守
 * ⇒ 清完必回潮。本尺子补这两格。
 *
 * 为什么 warn(不进提交链):判的是**机器/磁盘状态**,提交者结构上满足不了 —— 挂 blocking
 * 就是每台每次被逼 --no-verify,连带废掉全部守门(§12e;check-host-timezone /
 * check-service-binary-paths 同一定级逻辑)。出口 = git-guardian 每 30 分钟巡检 + 到人;
 * 手动问责:`node scripts/check-disk-root-hygiene.mjs --strict`。
 *
 * 两维判据:
 *   H1 盘根白名单对账 —— 扫 G:\ 一级(非递归),条目必须落在 config/disk-root-allowlist.json
 *      的声明集合内;未列入逐条点名。声明式封闭集合:新增合法条目必须显式改配置并随 commit
 *      提交(= 显式审批),同 check-root-dir-clean 的白名单哲学。
 *   H2 worktree 落点对账 —— `git worktree list --porcelain` 现读登记面,主工作树豁免,
 *      落在 sanctionedPrefixes 之外的登记 worktree 逐条点名待回收(prunable 的顺带点名)。
 *      2026-09-30 起 worktree 落点 = G:\IHUI-AI\.worktrees\(AGENTS §12d)。
 *
 * 2026-10-03 补记(为什么"永久红"必须从配置侧解):告警到人的出口是 git-guardian 的
 * 盘根巡检格,而它 30 分钟一趟、4 小时去重窗口 —— 一条**永远判红且没人整改**的判据等于
 * 每 4 小时到人一次。本尺子立起三周实测 27 封同因告警,违规集合逐字不变:两个盘根条目
 * (.pytest_tmp / .pytest_tmp_runs)每次跑 pytest 必然重建,申报它们不是"放水",是承认
 * 它们本就是 pytest 基础设施的设计落点(理由见 config 的 _pytestBasetempNote)。
 * 一般教训:**新增这一格判据时先问"它红了能整改吗"** —— 不能整改的判据要么进白名单
 * (写明理由,随 commit 审批),要么就别挂在到人通道上;挂上去只会训练人忽略这封信。
 *
 * 2026-10-05 两处口径更正(同一台**开发机**上它把 §5b 的禁删项判成了待回收):
 *   ① **"未判定"与"违规"不得共用一个数组**。原先盘根不可读时把 `{kind:'undetermined'}`
 *      push 进同一个 violations 数组,而 `main()` 与 verdict 只看长度 ⇒ "G:\ 在这台机上
 *      根本不存在"被算成一条外流违规 → 派红信。现分 `{violations, undetermined}` 两桶,
 *      verdict 顺序 = 有真违规才 red,否则有未判定就 undetermined,全绿才 green;
 *      一维未判定**不得**吞掉另一维已量到的结论(与下面 H2 同一条规矩)。
 *   ② **合法落点不得只由配置里的盘符字面量给**。`worktreePolicy.exemptPaths` 只有
 *      `G:\IHUI-AI`,而本仓在多台机上 checkout(D:\、G:\):在 D: 这份上,主工作树没被
 *      豁免,更要命的是 `git worktree list --porcelain` 的第一条(= git 契约里的**主工作树**)
 *      在"指针 + 外置 gitdir"形态下就是 `D:/IHUI-AI-git-repo` —— 那正是 §5b 明令**禁止删除**
 *      的恢复源,而本尺子当时喊的是"按 §12d 回收"。一把会指挥人删恢复源的尺子比没有尺子坏。
 *      现三层豁免,前两层机器无关:① 结构性 —— porcelain 的第一个 worktree 条目按 git 契约
 *      就是主工作树,恒豁免;② 运行时派生 —— 仓根、`resolveGitdir()` 的真实 gitdir、
 *      仓内 `.worktrees/`(全部走 `scripts/lib/gitdir.mjs` 那一份解析,不抄第二套盘符);
 *      ③ 配置的盘符字面量保留(它是**另一台机**的申报,不是本机事实的来源)。
 *      ② 派生不出来 ⇒ H2 整维判"未判定"而不是继续判红:**把"没算出来"写成"落点外"
 *      等于用一把失明的尺子指控人**。
 *   ③ 落点外的出路措辞按 prunable 分档:可 prune 的直接给命令;不可 prune 的**先核实归属**
 *      (多会话并行时那很可能是别人正在用的隔离检出,不是垃圾)。
 *
 * 2026-10-05(G-998191)git 出口收口:本门唯一的 git 派生(`git worktree list --porcelain`)
 * 由 `execFileSync('git', …)` 裸调用迁到取材层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
 * —— 仓内逐文件迁移的存量债(判据在 `scripts/tests/face-reader.test.mjs` 的
 * `BARE_GIT_BASELINE`,只减不增)。收益不止"统一"本身:裸调用依赖 PATH、默认 stdio 会把
 * 子进程 stderr 透进本门的读数、且无 timeout;层把这三项逐条写死。逐条行为面对照见
 * `currentWorktreePorcelain()` 的头注(其中 quotepath 一项是**纠偏**,不是等价替换)。
 *
 * 用法:
 *   node scripts/check-disk-root-hygiene.mjs              # 报告档(违规仍 exit 0)
 *   node scripts/check-disk-root-hygiene.mjs --strict     # 问责档(违规 exit 1)
 *   node scripts/check-disk-root-hygiene.mjs --self-test  # 自检
 * 测试通道:--root <dir>(替身盘根)、--wt-file <file>(替身 porcelain 输出)、--config <file>。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
// 合法落点必须由**运行时解析**给出(见头注 ②):盘符字面量只能是别的机器的申报,
// 不能是本机事实的来源。此处只引那一份实现,不在本文件再抄一套指针/gitdir 推导。
import { resolveGitdir } from './lib/gitdir.mjs'
// 2026-10-05(G-998191)迁移:本门唯一的 git 派生改走取材层的 `gitRaw`。此前是
// `execFileSync('git', …)` 一处裸调用 —— 那形态同时踩三条:① 裸 'git' 依赖 PATH
// (AGENTS §5b"git 调用不得依赖环境",换机/换服务身份就 ENOENT);② 默认 stdio 把子进程
// stderr 直接透到父进程,本门的 stdout 逐行读数会被 git 的杂音污染;③ 无 timeout,
// 索引锁住时无界挂起。
import { gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

function parseArgv(argv) {
  const out = { _: [] }
  const BOOLS = new Set(['self-test', 'strict', 'json'])
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      if (BOOLS.has(key)) {
        out[key] = true
      } else {
        out[key] = argv[i + 1]
        i++
      }
    } else out._.push(argv[i])
  }
  return out
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** 规范化路径便于前缀比较:统一 / 分隔、去尾分隔符。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}

/** 人读/信文用的"盘根 + 条目"拼接:盘根声明以 `D:\` 结尾,直接再拼 sep 会长出 `D:\\x`。 */
function rootJoined(root, entry) {
  return String(root).replace(/[\\/]+$/, '') + sep + entry
}

/**
 * 把 `path.parse(...).root` 归一到 config.roots 的键形(Windows `D:\` / POSIX `/`)。
 * **分隔符只能取当次平台的 `sep`,不能写死 `\`** —— 必需 job 跑在 ubuntu-latest,写死反斜杠
 * 会让这台尺子在 Linux 上算出 `\`,config 永远申报不上 ⇒ 盘根维度永久"未判定"
 * (2026-10-05 我落地当轮由镜像测试暴露)。单独成函数是为了**跨平台可证**:
 * `parse`/`resolve` 绑平台,在 Windows 上喂不进 POSIX 路径,而这条归一式是纯字符串活。
 */
export function normalizeRootKey(rawRoot, platformSep = sep) {
  if (!rawRoot) return null
  return String(rawRoot).replace(/[\\/]+$/, '') + platformSep
}

/** 本机仓根所在盘根,归一到与 config.roots 的键同形。取不到 ⇒ null。 */
export function currentDriveRoot(repoRoot = REPO_ROOT) {
  try {
    return normalizeRootKey(parse(resolve(repoRoot)).root)
  } catch {
    return null
  }
}

/** 机器无关的合法落点(头注 ② 的第②层)。派生不出来 ⇒ null ⇒ H2 判未判定,不继续判红。 */
export function deriveSanctioned() {
  try {
    const gitdir = resolveGitdir(REPO_ROOT)
    if (!gitdir) return null
    return {
      exempt: [REPO_ROOT, gitdir],
      prefixes: [join(REPO_ROOT, '.worktrees')],
    }
  } catch {
    return null
  }
}

/**
 * H1:盘根一级条目对账。
 * 返回 `{ violations, undetermined }` —— **两桶不得并**(头注 ①):盘根读不到是"没看清",
 * 写成违规就会让一台不存在的盘每 4 小时寄一封"项目产物外流"。
 */
export function auditDiskRoot(rootDir, allowlist) {
  const violations = []
  const undetermined = []
  let readable = false
  try {
    readable = existsSync(rootDir) && statSync(rootDir).isDirectory()
  } catch {
    readable = false
  }
  if (!readable) {
    undetermined.push({ kind: 'undetermined', root: rootDir, why: '盘根不可读(不存在或不是目录)' })
    return { violations, undetermined }
  }
  const allow = new Set(allowlist)
  for (const entry of readdirSync(rootDir)) {
    if (!allow.has(entry)) violations.push({ kind: 'stray-root-entry', entry, path: join(rootDir, entry) })
  }
  return { violations, undetermined }
}

/**
 * H2:worktree 登记面对账。三层豁免(结构性 → 运行时派生 → 配置盘符),返回违规数组。
 * `derived` 省略 ⇒ 只按配置字面量判(**仅测试通道**这么用);生产档传 null 时由 main()
 * 先把整维降级成未判定,不会走到这里。
 */
export function auditWorktreeRegistry(porcelainText, policy, derived) {
  const violations = []
  const prefixes = (policy?.sanctionedPrefixes ?? []).map(normPath)
  const exempt = new Set((policy?.exemptPaths ?? []).map(normPath))
  for (const p of derived?.prefixes ?? []) prefixes.push(normPath(p))
  for (const p of derived?.exempt ?? []) exempt.add(normPath(p))
  const blocks = porcelainText.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  let seenPaths = 0
  for (const block of blocks) {
    const m = block.match(/^worktree\s+(.+)$/m)
    if (!m) continue
    // git 的 --porcelain 契约:第一个 worktree 条目就是**主工作树**。这条与盘符、
    // 与 `.git` 是指针还是目录都无关,所以它是本维最硬的一层豁免。
    const isMainWorktree = seenPaths === 0
    seenPaths++
    if (isMainWorktree) continue
    const wt = normPath(m[1])
    if (exempt.has(wt)) continue
    if (prefixes.some((p) => wt === p || wt.startsWith(p + '/'))) continue
    const prunable = /prunable/i.test(block)
    violations.push({ kind: 'worktree-outside-sanctioned-root', path: m[1], prunable })
  }
  return violations
}

/** 取当前仓的 worktree porcelain 面;取不到 ⇒ null(判"无法判定",不冒红也不记绿)。
 *
 *  2026-10-05(G-998191)迁到取材层 `gitRaw`,行为面逐条对齐:
 *   · stdio 三态是本仓实测铁律(2026-09-30):git 子进程不吃 stdin ⇒ stdin 必须 'ignore',
 *     否则交互会话下 spawnSync 报 EBUSY(check-root-dir-clean 同型调用已带同参)。
 *     `gitRaw` 把这一档**写死**在层里(face-reader.mjs:94,不带 input 即 'ignore'),
 *     不再由每个调用方各自记得传 —— 这正是本次迁移的收益本身。
 *   · 绝对路径 git(层内 `resolveGitBin()`)+ `-c safe.directory=*` + windowsHide + 数字
 *     timeout + 64MB maxBuffer:全部由层给足,本函数不再有"少写一项就只在本机炸"的余地。
 *   · quotepath:层强制 `core.quotepath=false`。旧裸调用用 git 默认的 quotepath=true,
 *     登记面上的非 ASCII 落点会被转义成八进制 ⇒ `auditWorktreeRegistry` 的前缀比较
 *     对含中文/重音的路径会**误判成落点外**。故这一项是迁移带来的纠偏而非等价替换,
 *     方向是"少一条假指控"(与头注 ② 同一原则)。
 *   · 失败语义保持不变:层抛 `Undetermined`(Error 子类),这里 catch 后仍返回 null,
 *     交 main() 落"未判定"那一维 —— 迁移不把"取不到"折叠成"没有违规"。 */
const WORKTREE_GIT_TIMEOUT_MS = 60_000
function currentWorktreePorcelain() {
  try {
    return gitRaw(['worktree', 'list', '--porcelain'], REPO_ROOT, { timeout: WORKTREE_GIT_TIMEOUT_MS })
  } catch {
    return null
  }
}

export function selfTest() {
  const cases = []
  const t = (name, fn) => {
    try {
      fn()
      cases.push(`  ✅ ${name}`)
    } catch (e) {
      cases.push(`  ❌ ${name}\n      ${e.message}`)
      process.exitCode = 1
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }

  t('H1 白名单内条目不点名', () => {
    const r = auditDiskRoot('/probe-root-fake', ['a', 'b'])
    // /probe-root-fake 不存在 ⇒ 必须判"无法判定",且**不得**落在违规桶里
    assert(r.violations.length === 0, `不可读盘根不得计违规,实得 ${JSON.stringify(r.violations)}`)
    assert(r.undetermined.length === 1 && r.undetermined[0].kind === 'undetermined', '不可读盘根必须判 undetermined')
  })

  t('H1 未列入条目逐条点名', () => {
    const r = auditDiskRoot(join(REPO_ROOT, 'scripts', 'tests', 'fixtures'), ['check-root-dir-clean'])
    // fixtures 目录里凡不在白名单的一级条目都该被点名(该目录非空 ⇒ 至少 1 条)
    assert(r.violations.length > 0, '非空目录只给一条白名单条目时必须有点名')
    assert(r.violations.every((x) => x.kind === 'stray-root-entry'), '只应产出 stray-root-entry')
    assert(r.undetermined.length === 0, '可读目录不得落未判定')
  })

  t('H1 空盘根 ⇒ 0 违规(空不是 undetermined)', () => {
    // 构造:用 repo 内一个可控空目录不可行,改用语义反向 —— 白名单含全部条目时 0 违规
    const dir = join(REPO_ROOT, 'config')
    const entries = readdirSync(dir)
    const r = auditDiskRoot(dir, entries)
    assert(r.violations.length === 0, `白名单全覆盖时违规应为 0,实得 ${r.violations.length}`)
    assert(r.undetermined.length === 0, '白名单全覆盖时未判定应为 0')
  })

  t('H2 主工作树豁免(配置盘符与本机不同形时,仍靠结构性第一条豁免)', () => {
    const txt = 'worktree D:/IHUI-AI-git-repo\nHEAD abc\nbranch refs/heads/main\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 0, `主工作树(登记面第一条)应结构性豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 主工作树豁免:配置字面量命中形态照旧绿(旧用例正向保留)', () => {
    const txt = 'worktree G:/IHUI-AI\nHEAD abc\nbranch refs/heads/main\n\nworktree G:/IHUI-AI\\.worktrees\\wt-a\nHEAD def\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 0, `主工作树 + 合法落点应豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 合法落点(.worktrees)内豁免', () => {
    const txt = 'worktree G:/IHUI-AI\nHEAD abc\n\nworktree G:\\IHUI-AI\\.worktrees\\wt-demo\nHEAD abc\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 0, `合法落点应豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 运行时派生豁免:另一台机的外置 gitdir 与仓内 .worktrees 不得被喊成待回收', () => {
    // 本机真实形态:第一条 = 外置 gitdir(§5b 禁删项),第二条 = 仓内 .worktrees 下的检出。
    const derived = deriveSanctioned()
    assert(derived, 'deriveSanctioned() 在本机必须算得出来(算不出来这条要红,不得静默跳过)')
    // 对照面显式注入**假盘符**(G-1059131):本用例模拟的是"另一台机的 checkout"——
    // 仓根盘符与 config 字面量(G:)不同盘。旧写法直接拿 derived.prefixes[0](真盘符)拼
    // 登记 ⇒ 在仓根本就在 G: 的机器上,夹具路径与配置字面量恰好同形,"摘掉 derived 仍绿",
    // 下面那条变异对照在这台机上恒红 —— 夹具赌了本机盘符。现按 §5b"凡盘符每次现取":
    // 把真派生结果的盘根整体换成一个**合成盘根**(运行时保证 ≠ 配置字面量的盘符字母),
    // 派生豁免集同步搬到同一假盘 ⇒ "derived 与配置不同盘"在任何机器上结构成立。
    // 路径只进纯字符串比对(auditWorktreeRegistry 不碰 fs),合成盘不需要真实存在。
    const CONFIG_REPO = 'G:\\IHUI-AI'
    const cfgDriveLetter = CONFIG_REPO[0] // 配置字面量的盘符,运行时现取,不写死比较对象
    const fakeDriveLetter = cfgDriveLetter === 'Q' ? 'R' : 'Q' // 结构性保证 ≠ 配置盘符
    const fakeRoot = `${fakeDriveLetter}:\\`
    // 把任一本机真实路径整体搬到假盘:摘掉原盘根(parse 取各自平台的根形)、接上假盘根。
    const toFakeDrive = (p) => fakeRoot + String(p).slice(parse(p).root.length)
    const fakeDerived = { exempt: derived.exempt.map(toFakeDrive), prefixes: [toFakeDrive(derived.prefixes[0])] }
    const gitdir = normPath(fakeDerived.exempt[1])
    const txt = `worktree ${gitdir}\nHEAD abc\nbranch refs/heads/main\n\nworktree ${normPath(fakeDerived.prefixes[0])}/wt-live\nHEAD def\ndetached\n\n`
    const policy = { exemptPaths: [CONFIG_REPO], sanctionedPrefixes: [CONFIG_REPO + '\\.worktrees\\'] }
    const vConfigOnly = auditWorktreeRegistry(txt, policy)
    const vDerived = auditWorktreeRegistry(txt, policy, fakeDerived)
    assert(vDerived.length === 0, `派生豁免必须吃掉这两条,实得 ${JSON.stringify(vDerived)}`)
    // 变异对照(= 本次要修的假指控):摘掉 derived ⇒ 假盘上的仓内 .worktrees 不被 G: 的
    // 字面量前缀命中,于是被喊成"落点外待回收"。登记面第一条(外置 gitdir)由上一层
    // 结构性豁免兜住,那条的变异对照见「主工作树豁免(配置盘符与本机不同形…)」。
    assert(vConfigOnly.length === 1, `变异必须复现旧误判(1 条 .worktrees),实得 ${vConfigOnly.length}`)
  })

  t('H2 落点外登记逐条点名(prunable 单列)', () => {
    const txt = 'worktree G:/IHUI-AI\nHEAD abc\n\nworktree G:/IHUI-AI-wt-b674\nHEAD abc\ndetached prunable\n\nworktree G:/tmp-probe/wt-x\nHEAD def\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 2, `应点名 2 处,实得 ${v.length}`)
    assert(v.some((x) => x.prunable) && v.some((x) => !x.prunable), 'prunable 标记必须逐条区分')
  })

  t('H2 大小写与分隔符不构成隐身(Windows 路径同义形态)', () => {
    const txt = 'worktree G:/IHUI-AI\nHEAD abc\n\nworktree g:/ihui-ai-wt-x\nHEAD abc\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    // g:/ihui-ai-wt-x 与豁免前缀 G:/IHUI-AI 不同路径(前者是盘根残壳),必须点名
    assert(v.length === 1, `同义形态不得误豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 空登记面 ⇒ 0 违规', () => {
    const v = auditWorktreeRegistry('', { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: [] })
    assert(v.length === 0, '空面不是违规')
  })

  t('H2 结构性豁免只给第一条,不得被"没有 worktree 行"的块顶掉名额', () => {
    // 首个块解析不出路径(畸形)时,真正的第一条 worktree 仍须被当主工作树豁免。
    const txt = 'garbage-block\n\nworktree G:/IHUI-AI\nHEAD abc\n\nworktree G:/elsewhere/wt\nHEAD def\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: [], sanctionedPrefixes: [] })
    assert(v.length === 1 && v[0].path === 'G:/elsewhere/wt', `实得 ${JSON.stringify(v)}`)
  })

  t('currentDriveRoot 与 config.roots 的键同形(反斜杠收尾)', () => {
    const r = currentDriveRoot(join(REPO_ROOT, 'scripts'))
    assert(r === parse(resolve(REPO_ROOT)).root.replace(/[\\/]+$/, '') + '\\', `实得 ${r}`)
    assert(/\\$/.test(r ?? ''), '键必须与 config 里 "G:\\\\" 同形,否则本机盘根永远匹配不上声明')
  })

  console.log(cases.join('\n'))
  console.log(`\n自检:pass ${cases.filter((c) => c.includes('✅')).length} / fail ${cases.filter((c) => c.includes('❌')).length}`)
}

async function main() {
  const argv = parseArgv(process.argv.slice(2))
  if (argv['self-test']) {
    selfTest()
    return
  }

  const json = !!argv.json
  const configPath = argv.config ? resolve(argv.config) : join(REPO_ROOT, 'config', 'disk-root-allowlist.json')
  const confAll = readJson(configPath)
  const declaredRoots = Object.keys(confAll?.roots ?? {})
  const here = currentDriveRoot()
  // 扫哪些盘根 = 配置声明的 ∪ 本机仓根所在盘。后者必须并进来,否则"这台机的盘根"
  // 这一维永远没人看(配置只有 G:\,而本仓在 D:\ 也有一份 checkout)。
  // --root 是测试通道:只扫给定的替身盘根,保持确定性。
  const roots = argv.root ? [resolve(argv.root)] : [...new Set([...declaredRoots, ...(here ? [here] : [])])]
  if (!roots.length) {
    console.error('❌ 既取不到盘根声明(config/disk-root-allowlist.json 缺 roots),也解析不出本机仓根 ⇒ 无法判定')
    process.exitCode = 2
    return
  }

  const all = []
  const rootUndetermined = []
  // 三态分开:违规 / 未判定(该量而量不到,拒绝出合格证) / 本机不适用(声明来自另一份
  // checkout 的盘,这台机根本没有它)。**不适用不得降级成未判定**,否则在任一 checkout
  // 上另一台机的盘根都会把整轮结论拖成"没判过";但也不得并进"已判干净" —— 它单独报名。
  const notApplicable = []
  if (!here) {
    rootUndetermined.push({ kind: 'undetermined', root: '(本机仓根)', why: '解析不出本机仓根所在盘 ⇒ 盘根维度未判定(不冒红也不记绿)' })
  }
  for (const root of roots) {
    let conf = null
    if (argv.root) {
      conf = { allow: readdirSync(root), note: '测试通道:替身盘根全量放行' }
    } else {
      conf = confAll.roots[root]
      if (!conf) {
        // 未申报 ≠ 无违规,也 ≠ 有违规:这一格只能落"未判定",出路是补申报(显式审批),
        // 不是让本尺子替人猜一个白名单。旧写法在这里 exit 2 并把**整轮**结论作废,
        // 于是别的盘根已量到的违规一起被吞掉。
        rootUndetermined.push({
          kind: 'undetermined',
          root,
          why:
            root === here
              ? '本机盘根未在 config 申报 ⇒ 该维未判定(出口:向 config/disk-root-allowlist.json 增补该盘的 allow+note 并随 commit 审批)'
              : '声明了该盘根而 config 里缺它的条目 ⇒ 该维未判定',
        })
        continue
      }
    }
    const r = auditDiskRoot(root, conf.allow)
    for (const v of r.violations) all.push({ root, ...v })
    for (const u of r.undetermined) {
      if (here && root !== here) notApplicable.push({ root, why: `${u.why};本机没有这块盘 ⇒ 该维在本机不适用(声明来自另一份 checkout)` })
      else rootUndetermined.push({ root, ...u })
    }
  }

  const policy = confAll.worktreePolicy
  const porcelain = argv['wt-file'] ? readFileSync(argv['wt-file'], 'utf8') : currentWorktreePorcelain()
  // 派生合法落点算不出来 ⇒ H2 整维未判定(头注 ② 末句):把"没算出来"写成"落点外"
  // 等于用一把失明的尺子指控人,而指控内容("回收 gitdir")按 §5b 是禁止动作。
  // --wt-file 测试通道除外:那份登记面是人工构造的,豁免集就按用例给的字面量判。
  const derived = argv['wt-file'] ? undefined : deriveSanctioned()
  const derivedMissing = !argv['wt-file'] && derived === null
  // 输出顺序铁律:盘根维度先出结果,porcelain 取不到只降级它自己那一维 ——
  // 不许让一维"无法判定"把另一维已量到的违规整个吞掉(那等于把"没看清"写成"没问题")。
  // `=== null || === undefined` 而非原来的 `== null`:后者靠 eqeqeq 的 smart 模式才合规,
  // 而本仓 eslint 走 always 模式(既存债,2026-10-03 提交时暴露)。两者语义逐字等价 ——
  // currentWorktreePorcelain() 只 return null 或字符串,readFileSync 失败即抛,
  // 但保留 undefined 分支是为了不把"以后有人改成 return undefined"变成静默行为变更。
  const wtUndetermined = porcelain === null || porcelain === undefined || derivedMissing
  const wtWhy = derivedMissing ? '派生合法落点失败(resolveGitdir 不可用)⇒ 不判红,免得把外置 gitdir 喊成待回收' : 'git worktree list 取不到'
  const wtViolations = wtUndetermined ? [] : auditWorktreeRegistry(porcelain, policy, derived)
  const undetermined = [
    ...rootUndetermined,
    ...(wtUndetermined ? [{ kind: 'undetermined', root: '(worktree 登记面)', why: wtWhy }] : []),
  ]
  const violationCount = all.length + wtViolations.length
  // verdict 顺序:有真违规才 red;否则有未判定就 undetermined(拒绝出合格证);全绿才 green。
  // notApplicable **不参与** verdict(它既不是指控也不是合格证,是一句"这一维本机没得量")。
  const verdict = violationCount ? 'red' : undetermined.length ? 'undetermined' : 'green'

  if (json) {
    // 机器可读档(git-guardian 巡检消费):纯 JSON,不混人读行(混入 = parse 必败)。
    // counts 的几把尺各自独立:diskRootStray / worktreeOutside 是**违规**,
    // diskRootUndetermined / worktreeUndetermined 是**未判定**,diskRootNotApplicable 是
    // **本机不适用** —— 三族不得互相顶账。
    console.log(
      JSON.stringify({
        verdict,
        counts: {
          diskRootStray: all.length,
          worktreeOutside: wtViolations.length,
          diskRootUndetermined: rootUndetermined.length,
          worktreeUndetermined: wtUndetermined ? 1 : 0,
          diskRootNotApplicable: notApplicable.length,
        },
        violations: [...all, ...wtViolations],
        undetermined,
        notApplicable,
      }),
    )
    if (argv.strict && verdict !== 'green') process.exitCode = 1
    return
  }

  console.log('── 盘根卫生(warn 尺子,巡检档)──')
  for (const v of all) {
    console.log(`  🚨 盘根外流: ${v.path || rootJoined(v.root, v.entry)}`)
  }
  for (const v of wtViolations) {
    const remedy = v.prunable
      ? '⇒ 登记项已失效:git worktree prune'
      : '⇒ 先核实归属(可能是他人在飞的隔离检出),确认无人使用才 worktree remove + prune'
    console.log(`  🚨 worktree 落点外: ${v.path}${v.prunable ? ' (prunable)' : ''} ${remedy}`)
  }
  for (const u of undetermined) {
    console.log(`  ⚠️ 未判定: ${u.root} —— ${u.why}`)
  }
  for (const n of notApplicable) {
    console.log(`  ℹ️ 不适用: ${n.root} —— ${n.why}`)
  }
  if (verdict === 'green') {
    console.log('  ✅ 盘根白名单对账 0 违规;worktree 登记面全部落在合法落点(主工作树/仓内 .worktrees)')
  }
  console.log(
    `\n读数:盘根外流 ${all.length} / worktree 落点外 ${wtViolations.length} / 未判定 ${undetermined.length}` +
      `(盘根 ${rootUndetermined.length}、worktree 维 ${wtUndetermined ? 1 : 0})/ 不适用 ${notApplicable.length}`,
  )
  if (argv.strict && verdict !== 'green') {
    console.error('\n--strict:存在违规或未判定 ⇒ exit 1(问责档;未判定不出合格证)')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('❌ 尺子自身异常:', e && e.message)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
