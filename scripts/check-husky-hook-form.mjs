#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 智汇AI · 守门 226 —— git 钩子装载形态对账(blocking,stagedTriggers=.husky/)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 立门因由(2026-10-19 实测,机主令「修复所有报警邮件的问题 根治 防复发 杜绝」):
 *
 *   git 按 OS 的 shebang 机制直接执行 core.hooksPath 指向的钩子文件。本机
 *   core.hooksPath=.husky ⇒ .husky/post-commit 一旦写成 #!/usr/bin/env node,
 *   它能不能跑就**取决于触发提交的那一侧 PATH 里有没有 node**:有 ⇒ 正常;
 *   没有 ⇒ Git for Windows 回落用 sh 解释本文件,第 2 行的 JS 注释当场报
 *   "command not found",而 post-commit **不拦提交** ⇒ safe-commit 照样打
 *   "post-commit hook 将自动调用 git-push-guard 推送",整条链(自动推送、
 *   lost-commit/backup 标签双备份同步、LFS、污染巡检、台账自愈)**静默没跑**。
 *
 *   两枚实测证据(同日同面,不是推论):
 *     · 2026-10-16 17:05 已修过一次(薄壳改 sh + 正文迁 scripts/lib/post-commit-hook.js),
 *       头注写得很清楚:"13:04 跑过、13:15 死" —— 间歇性正是它的形态。
 *     · 2026-10-18 20:05 一枚只动 apps/cli 的 ws 取档提交(00eab50bc96)把旧基线的
 *       node 正文整份写回 .husky/post-commit(并席索引层回写,与"钩子"毫无关系),
 *       修复被抹掉;10-19 现读:07:19:20 那枚提交三条腿日志都动了(07:19:21/24/34),
 *       07:31:17 那枚**一条没动**。
 *
 *   为什么必须有门而不是"记住要写 sh":这条链一死,丢的是**推送与双备份**——
 *   提交没推上去就是 §20 的协作事故,标签没同步就是"备份只剩本地一份",台账没自愈
 *   就是下一次 ff 被滞台副本挡死并寄"停摆"CRITICAL。全都是往机主邮箱里寄东西的源头,
 *   而且失效方向是**安静**(判据失效的表现永远是安静,§12f)。
 *
 * 本门的立场:
 *   - H1 形态:钩子文件第一行必须是 POSIX sh 解释器。node/python/pwsh 一律红 ——
 *     不是偏好,是"钩子必须能被 git 无条件启动"这一条性质;sh 由 git 自带,不随
 *     触发方 PATH 浮动。
 *   - H2 出路可达:薄壳经 wscript 启动的包装文件与 node 正文必须**在被审面上存在**
 *     (§0.8 文档/钩子不许写跑不通的出路)。正文丢失时薄壳只报"脚本找不到",
 *     同样是死链,得在提交口拦。
 *   - 取材面纪律(守门 118):全量档判 **HEAD blob**(清单 = `ls-tree HEAD:.husky`,
 *     内容 = 同轮 `cat-file --batch`)、`--staged` 判**索引 blob**(清单 =
 *     `ls-files --cached -- .husky`)、`--worktree` 仅人工逃生舱;两面旗同给 exit 2;
 *     取不到判「无法判定」,不回落另一个面、不按"剩下的"记绿。
 *   - 覆盖面自证:枚举到 0 枚钩子 ⇒ 判死(exit 2),不记绿。
 *
 * 处置指引(命中时打印):把 node 正文搬到 scripts/lib/<hook>-hook.js,钩子文件本身
 *   只留 sh 薄壳(样板 = .husky/pre-commit 与 .husky/post-commit,经
 *   scripts/hook-run-hidden.vbs 启动,失败进 .ihui-agent/state/hook-logs/<label>.log 并回显)。
 *
 * 验证:`node scripts/check-husky-hook-form.mjs --self-test`(条数现读)+
 *   镜像 scripts/tests/check-husky-hook-form.test.mjs(判据 import 本文件 __test__,
 *   §22c 不许复制常量)。
 * 跳过:HUSKY_SKIP_HOOK_FORM=1(应急,须留痕)
 */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const HOOK_DIR = '.husky'
/** git 认的钩子名(不含扩展名)。README.md、_ 目录、*.sample 等一律不是判定对象。 */
const GIT_HOOK_NAMES = new Set([
  'applypatch-msg',
  'commit-msg',
  'post-applypatch',
  'post-checkout',
  'post-commit',
  'post-merge',
  'post-receive',
  'post-rewrite',
  'post-update',
  'pre-applypatch',
  'pre-auto-gc',
  'pre-commit',
  'pre-merge-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'push-to-checkout',
  'reference-transaction',
  'update',
])

/** 只认 sh 一族解释器:git 自带 sh,不随触发方 PATH 浮动。 */
const SH_SHEBANGS = [
  '#!/bin/sh',
  '#!/usr/bin/sh',
  '#!/usr/bin/env sh',
  '#!/bin/bash',
  '#!/usr/bin/bash',
  '#!/usr/bin/env bash',
]

function specOf(face, p) {
  return face === 'head' ? `HEAD:${p}` : face === 'staged' ? `:${p}` : p
}

/** 纯函数:某面的清单文本(NUL 分隔)→ 钩子相对路径数组(只取 .husky 直属、且名字是 git 钩子)。 */
function filterHookPaths(nulListText) {
  const out = []
  for (const raw of String(nulListText).split('\0')) {
    const p = raw.trim()
    if (!p || !p.startsWith(`${HOOK_DIR}/`)) continue
    const name = p.slice(HOOK_DIR.length + 1)
    if (!name || name.includes('/')) continue
    if (GIT_HOOK_NAMES.has(name)) out.push(p)
  }
  return out.sort()
}

/**
 * 纯函数 H1:首行 shebang 判定。返回违规描述或 null。
 * 无 shebang(不以 #! 开头)同样红 —— git 无从按解释器启动它,静默死法一模一样。
 */
function judgeShebang(text, p) {
  const first = String(text).split('\n', 1)[0].trim()
  if (SH_SHEBANGS.some((s) => first.startsWith(s))) return null
  return {
    rule: 'H1',
    path: p,
    detail: `首行是「${first || '(空文件)'}」,不是 sh 解释器 ⇒ 钩子能否启动取决于触发方 PATH。git 的钩子由 OS 按 shebang 直接执行,写成 node/pwsh/python 或干脆没有 shebang 时,PATH 里没有它就被 sh 当脚本逐行解释、第二行即报错,而钩子失败不拦提交 ⇒ 整条链静默没跑`,
  }
}

/**
 * 纯函数 H2:薄壳经 wscript 引用的包装文件与 node 正文必须在同一面存在。
 * 只解析 `wscript ... <vbs> <label> <script>` 这一形态;不引用 vbs 的钩子(直调 node)
 * 也红 —— 那正是 H1 拦的形态,由 H1 点名,本判据不重复计。
 */
function judgeDispatchRefs(text, facePaths) {
  const hits = []
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trim()
    if (/^(#|\/\/|\*|\/\*)/.test(line)) continue // 注释里的示例形态不是出路,拿它判死链就是自造恒红
    const m = /wscript\s+(?:\/\/nologo\s+)?(\S+\.vbs)\s+(\S+)\s+(\S+)/i.exec(line)
    if (!m) continue
    for (const ref of [m[1], m[3]]) {
      const rel = ref.replace(/\\/g, '/')
      if (!facePaths.has(rel)) {
        hits.push({
          rule: 'H2',
          detail: `薄壳引用的「${rel}」在判定面上不存在 ⇒ 每次触发都只会报"找不到文件",链子等于没接(§0.8 不许写跑不通的出路)`,
        })
      }
    }
  }
  return hits
}

/** 纯函数:一枚钩子的文本 → 违规数组。facePaths = **该面全部在位路径**(不是钩子清单)。 */
function judgeHook(p, text, facePaths) {
  const v = []
  const s = judgeShebang(text, p)
  if (s) v.push(s)
  for (const h of judgeDispatchRefs(text, facePaths)) v.push({ ...h, path: p })
  return v
}

/**
 * 面清单一次取全:返回 { hooks, all }。
 * all 必须是**整面**的路径集 —— H2 查的是钩子引用的包装/正文是否在位,
 * 拿钩子清单当全集会把每一处 wscript 引用都判成死链(自建门第一版就踩了这格,
 * 由 T7' 的成对夹具钉住)。枚举到 0 枚钩子 ⇒ 判死。
 */
function listFace(root, face) {
  let listing
  if (face === 'head') {
    listing = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], root, { timeout: 120_000 })
  } else {
    listing = gitRaw(['ls-files', '--cached', '-z'], root, { timeout: 120_000 })
  }
  const all = new Set(
    String(listing)
      .split('\0')
      .map((s) => s.trim())
      .filter((s) => s !== ''),
  )
  const hooks = filterHookPaths(listing)
  if (hooks.length === 0) {
    throw new Undetermined(
      `判定面(${face})在 ${HOOK_DIR}/ 直属枚举到 0 枚 git 钩子 —— 清单本身可疑,不判"没问题"`,
    )
  }
  return { hooks, all }
}

/** 面内容:返回 Map<p, text>;任何一枚取不到 ⇒ Undetermined 点名,绝不按"剩下的"记绿。 */
function readHooks(root, face, paths) {
  const texts = new Map()
  if (face === 'worktree') {
    const missing = []
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null) missing.push(p)
      else texts.set(p, t)
    }
    if (missing.length)
      throw new Undetermined(
        `worktree 面 ${missing.length} 枚钩子读不到(如 ${missing[0]})——不回落另一个面`,
      )
    return texts
  }
  const specs = paths.map((p) => specOf(face, p))
  const map = catBatch(root, specs)
  const missing = []
  for (let i = 0; i < paths.length; i++) {
    const t = map.get(specs[i])
    if (t === null || t === undefined) missing.push(paths[i])
    else texts.set(paths[i], t)
  }
  if (missing.length) {
    throw new Undetermined(
      `${face} 面 ${missing.length}/${paths.length} 枚钩子 blob 取不到(如 ${missing[0]})⇒ 未判定,绝不按"剩下的"记绿`,
    )
  }
  return texts
}

/** 全链判定(纯输入输出,供镜像测试直接喂夹具)。facePaths 必须是整面路径集。 */
function auditHookTexts(entries, facePaths) {
  const set = facePaths instanceof Set ? facePaths : new Set(facePaths || [])
  const violations = []
  for (const e of entries) {
    for (const v of judgeHook(e.p, e.s, set)) violations.push(v)
  }
  return { violations, scanned: entries.length }
}

/**
 * H3 装载位(2026-10-21 实测事故,机主令「彻底杜绝根治」):
 *   core.hooksPath 被写成 `.git/no-hooks`(该目录根本不存在)⇒ git 静默跑 **0 个**钩子,
 *   而 H1/H2 只看 `.husky/` 里的内容,对"整片钩子没被装载"完全失明。
 *   事故后果:post-commit 的自动推送/双备份整链停摆两天,本地积压 7 枚提交后才在手工
 *   收敛时暴露 —— 失效方向是安静(§12f)。
 * 判据:解析后的钩子目录必须真实存在,且 pre-commit / post-commit 两枚薄壳都在。
 *   safe-commit 的 `-c core.hooksPath=<临时转发目录>` 一样满足(它逐文件转发 .husky 全部钩子)。
 * configValue / exists 可注入,供 --self-test 与镜像测试用真值判定。
 */
function judgeHooksInstall(root, { configValue, exists = existsSync } = {}) {
  let val = configValue
  if (val === undefined) {
    try {
      val = String(gitRaw(['config', '--get', 'core.hooksPath'], root, { timeout: 30_000 })).trim()
    } catch {
      val = '' // 未设置:git 回落到 .git/hooks(本仓默认无钩子 ⇒ 下面按缺件判红)
    }
  }
  // 干净检出/CI 未安装 husky：hooksPath 未设置且 .husky/_ 不存在 ⇒ 装载面本身不存在,
  // 判 H3 红是拿"没装"当"装错了"(结构上不可能满足,恒红)。按未判定放行,不记绿。
  if (!val && !exists(join(root, '.husky', '_'))) {
    return {
      rule: 'H3',
      path: 'core.hooksPath',
      undetermined:
        '未安装 husky(core.hooksPath 未设置且 .husky/_ 不存在) ⇒ 钩子装载面不存在,不判 H3',
    }
  }
  const dir = val ? (isAbsolute(val) ? val : resolve(root, val)) : resolve(root, '.git', 'hooks')
  const missing = ['pre-commit', 'post-commit'].filter((h) => !exists(join(dir, h)))
  if (missing.length === 0) return null
  return {
    rule: 'H3',
    path: 'core.hooksPath',
    detail: `${val ? `= ${val}` : '未设置(默认 .git/hooks)'} ⇒ 钩子目录 ${dir} 缺 ${missing.join('/')} ⇒ git 静默跑 0 个钩子,自动推送/双备份整链停摆。修法:git config core.hooksPath .husky`,
  }
}

function runAudit({ root = ROOT, face = 'head', json = false } = {}) {
  const lines = []
  try {
    const listed = listFace(root, face)
    const paths = listed.hooks
    const texts = readHooks(root, face, paths)
    const { violations, scanned } = auditHookTexts(
      paths.map((p) => ({ p, s: texts.get(p) })),
      listed.all,
    )
    // H3:钩子写得再对,没被装载也等于没有(2026-10-21 core.hooksPath=.git/no-hooks 事故)
    const install = judgeHooksInstall(root)
    if (install) {
      if (install.undetermined) lines.push(`⚪ 未判定:${install.undetermined}(不记绿也不冒红)`)
      else violations.push(install)
    }
    if (json) {
      return {
        status: violations.length > 0 ? 1 : 0,
        lines: [JSON.stringify({ face, scanned, violations })],
      }
    }
    for (const v of violations) lines.push(`  ❌ [${v.rule}] ${v.path} — ${v.detail}`)
    if (violations.length > 0) {
      lines.push(
        `❌ 钩子形态对账(${face} 面,扫 ${scanned} 枚):判出 ${violations.length} 处。修法:node 正文搬进 scripts/lib/<hook>-hook.js,钩子文件只留 sh 薄壳(样板 .husky/pre-commit),包装与正文路径必须在同面存在。禁止改判据消红;应急 HUSKY_SKIP_HOOK_FORM=1(须留痕)`,
      )
      return { status: 1, lines }
    }
    lines.push(
      `✅ 钩子形态对账(${face} 面):${scanned} 枚钩子全部 sh 薄壳、且薄壳引用的包装/正文在同面在位`,
    )
    return { status: 0, lines }
  } catch (e) {
    if (e instanceof Undetermined) {
      lines.push(`⚪ 未判定:${e.message}(不记绿也不冒红;取到输入后重跑本命令)`)
      return { status: 2, lines }
    }
    lines.push(`⚪ 未判定:门体自身异常(${String(e && e.message ? e.message : e)})`)
    return { status: 2, lines }
  }
}

export const __test__ = {
  GIT_HOOK_NAMES,
  SH_SHEBANGS,
  filterHookPaths,
  judgeShebang,
  judgeDispatchRefs,
  judgeHook,
  judgeHooksInstall,
  auditHookTexts,
  listFace,
  readHooks,
  runAudit,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(selfTest())
  }
  let face = 'head'
  try {
    const sel = selectFace({
      staged: argv.includes('--staged'),
      worktree: argv.includes('--worktree'),
    })
    face = sel.face
  } catch (e) {
    console.log(`⚪ 未判定:${e.message}`)
    process.exit(2)
  }
  const r = runAudit({ face, json: argv.includes('--json') })
  for (const l of r.lines) console.log(l)
  process.exit(r.status)
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const NODE_BODY =
    '#!/usr/bin/env node\n// ─── post-commit(跨平台 Node 钩子) ───\nconst { execSync } = require("child_process")\n'
  const SH_SHELL =
    '#!/bin/sh\nunset GIT_DIR\nwscript //nologo scripts/hook-run-hidden.vbs post-commit scripts/lib/post-commit-hook.js "$@" || exit 1\n'

  t('T1 事故原形:node shebang 钩子必判 H1 红', () => {
    const v = judgeShebang(NODE_BODY, '.husky/post-commit')
    if (!v || v.rule !== 'H1')
      throw new Error('node 正文钩子未被判红(这正是 10-18 被并席写回的那份)')
  })
  t('T2 正控:sh 薄壳不报;bash/env sh 也算 sh 族', () => {
    if (judgeShebang(SH_SHELL, '.husky/post-commit') !== null) throw new Error('sh 薄壳被误判')
    for (const s of ['#!/bin/sh\nx\n', '#!/bin/bash\nx\n', '#!/usr/bin/env sh\nx\n']) {
      if (judgeShebang(s, '.husky/pre-commit') !== null)
        throw new Error(`sh 族被误判:${s.split('\n')[0]}`)
    }
  })
  t('T3 反控:无 shebang / python 解释器同样判红(静默死法同型)', () => {
    if (!judgeShebang('node scripts/x.mjs\n', '.husky/commit-msg'))
      throw new Error('无 shebang 被放过')
    if (!judgeShebang('#!/usr/bin/env python3\nprint(1)\n', '.husky/pre-push'))
      throw new Error('python 钩子被放过')
    if (!judgeShebang('', '.husky/post-merge')) throw new Error('空钩子被放过')
  })
  t('T4 H2:薄壳引用的正文不在位 ⇒ 判红(死链拦在提交口)', () => {
    const facePaths = new Set(['.husky/post-commit', 'scripts/hook-run-hidden.vbs'])
    const hits = judgeDispatchRefs(SH_SHELL, facePaths)
    if (hits.length !== 1 || !/post-commit-hook\.js/.test(hits[0].detail))
      throw new Error(`正文丢失未被点名:${JSON.stringify(hits)}`)
  })
  t('T5 H2:包装与正文都在位 ⇒ 不报', () => {
    const facePaths = new Set([
      '.husky/post-commit',
      'scripts/hook-run-hidden.vbs',
      'scripts/lib/post-commit-hook.js',
    ])
    if (judgeDispatchRefs(SH_SHELL, facePaths).length !== 0) throw new Error('齐备薄壳被误判')
  })
  t('T5b H2:注释里的示例形态不是出路,不得判成死链(自造恒红反例)', () => {
    const commented =
      '#!/bin/sh\n#   wscript //nologo scripts/hook-run-hidden.vbs(GUI 子系统)\nprintf x\n'
    const hits = judgeDispatchRefs(commented, new Set(['.husky/x']))
    if (hits.length !== 0) throw new Error(`注释被当成引用去判在位性:${JSON.stringify(hits)}`)
  })
  t('T6 清单过滤:直属钩子名收,README/子目录/非钩子名一律不收', () => {
    const list = [
      '.husky/post-commit',
      '.husky/README.md',
      '.husky/_/h',
      '.husky/pre-commit.sample',
      '.husky/commit-msg',
      'scripts/post-commit',
    ].join('\0')
    const got = filterHookPaths(list)
    if (got.join(',') !== '.husky/commit-msg,.husky/post-commit')
      throw new Error(`清单错位:${JSON.stringify(got)}`)
  })
  t('T7 覆盖面:枚举 0 枚 ⇒ 判死(不记绿)', () => {
    const dir = mkScratch('hook-form-nogit')
    try {
      let threw = false
      try {
        listFace(dir, 'head')
      } catch (e) {
        threw = e instanceof Undetermined
      }
      if (!threw) throw new Error('0 候选/取不到面未判死(§0.3)')
    } finally {
      rmScratch(dir)
    }
  })
  t('T8 真仓取材:HEAD 面枚举到 ≥5 枚钩子、逐枚取得到内容,且 H2 不误咬真仓薄壳', () => {
    const listed = listFace(ROOT, 'head')
    if (listed.hooks.length < 5)
      throw new Error(`真仓 HEAD 面只枚举到 ${listed.hooks.length} 枚 —— 覆盖面可疑,判据可能空转`)
    const texts = readHooks(ROOT, 'head', listed.hooks)
    if (texts.size !== listed.hooks.length)
      throw new Error(`取到 ${texts.size} 枚 ≠ 清单 ${listed.hooks.length} 枚`)
    const r = auditHookTexts(
      listed.hooks.map((p) => ({ p, s: texts.get(p) })),
      listed.all,
    )
    const h2 = r.violations.filter((v) => v.rule === 'H2')
    if (h2.length > 0) {
      throw new Error(
        `真仓薄壳的包装/正文引用被判成死链(整面路径集没传对?):${h2.map((v) => `${v.path} ${v.detail}`).join(' | ')}`,
      )
    }
  })
  t('T9 变异成对锁:事故原形判 1 处 H1、薄壳零违规、摘掉正文引用即翻 H2 红', () => {
    const all = new Set([
      '.husky/post-commit',
      'scripts/hook-run-hidden.vbs',
      'scripts/lib/post-commit-hook.js',
    ])
    const bad = auditHookTexts([{ p: '.husky/post-commit', s: NODE_BODY }], all)
    if (bad.violations.length !== 1 || bad.violations[0].rule !== 'H1') {
      throw new Error(`事故原形应恰好 1 处 H1,实得 ${JSON.stringify(bad.violations)}`)
    }
    const good = auditHookTexts([{ p: '.husky/post-commit', s: SH_SHELL }], all)
    if (good.violations.length !== 0)
      throw new Error(`合规薄壳被误判:${JSON.stringify(good.violations)}`)
    const broken = auditHookTexts(
      [{ p: '.husky/post-commit', s: SH_SHELL }],
      new Set(['.husky/post-commit', 'scripts/hook-run-hidden.vbs']),
    )
    if (broken.violations.length !== 1 || broken.violations[0].rule !== 'H2') {
      throw new Error(`正文从面上消失应判 1 处 H2,实得 ${JSON.stringify(broken.violations)}`)
    }
  })
  t('T10 两面旗同给 ⇒ selectFace 拦(不回落任一面)', () => {
    const sel = selectFace({ staged: true, worktree: true })
    if (!sel.error) throw new Error('selectFace 未拦两面同给')
  })
  t('T11 runAudit 三档:真仓全量档取不到面 ⇒ 2,不冒红也不记绿', () => {
    const r = runAudit({ root: ROOT, face: 'worktree' })
    if (r.status !== 0 && r.status !== 1) throw new Error(`worktree 档应给出裁决,实得 ${r.status}`)
    const bad = runAudit({ root: dirname(ROOT), face: 'head' })
    if (bad.status !== 2) throw new Error(`非仓库根应落未判定,实得 ${bad.status}`)
  })

  t('T12 H3 装载位:事故原形(.git/no-hooks 不存在)判红,`.husky` 齐备判绿', () => {
    const red = judgeHooksInstall(ROOT, { configValue: '.git/no-hooks', exists: existsSync })
    if (!red || red.rule !== 'H3')
      throw new Error('core.hooksPath 指向不存在目录未被判红(10-21 事故原形)')
    const green = judgeHooksInstall(ROOT, { configValue: '.husky', exists: existsSync })
    if (green !== null) throw new Error(`真仓 .husky 被误判:${JSON.stringify(green)}`)
  })

  let pass = 0
  const fails = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
    } catch (e) {
      fails.push(`${c.name} — ${e && e.message ? e.message : String(e)}`)
    }
  }
  for (const f of fails) console.log(`  ❌ ${f}`)
  console.log(
    `\n自检 ${pass}/${cases.length} 通过${fails.length ? `,失败 ${fails.length} 条` : ''}`,
  )
  return fails.length ? 1 : 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
