#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一返回键防私接守门(守门 46;2026-09-09 立,2026-10-05 按台账"机器可见的欠账清单 B"根治覆盖面)。
 *
 * 规矩:web 端 `router.back()` / `history.back()` 是统一返回键的专属行为,只允许住在
 * `GlobalTopBar.tsx` / `BackButton.tsx` / `stores/topbar-back.ts` 那三处唯一实现里。页面私写它
 * 会让返回行为绕过顶栏(动画 / 降级 / 优先级全部失效),而 typecheck、lint、其余门都不响。
 *
 * 本票修的是**覆盖面**,不是判据强度:旧版把 `TARGET_DIR` 写死 `apps/web/src`,而 web 的页面
 * 全在 `apps/web/app/**`(Next.js App Router)⇒ 该门对"它立项要防的那一型"当前拦零
 * (台账实测 16 处 / 9 个文件全在 `app/` 下,门一路打印 `✅ 通过(1259 个文件,0 处私接)`)。
 * 同票登记的另外两型一并收掉:
 *   · `ROOT = process.cwd()` ⇒ 扫哪棵树由调用者站哪决定,镜像测试靠 cwd 定位夹具的那套**结构上失效**
 *     (守门 70 的镜像 13/14 恒红同型);现由脚本自身位置推导,`--root` 只作测试通道且仅 `--worktree` 档有效。
 *   · `readdirSafe` 用 `execSync('node -e "…' + 路径 + '"')` 拼字符串 ⇒ 路径里任何引号都是命令注入,
 *     且无 timeout(守门 80 判的那一型)。现直接走 `node:fs`,一次派生都不做。
 *   · 按磁盘判 ⇒ 共享工作树常年滞后 HEAD,同一份代码在恒红与假绿之间来回跳(守门 118)。
 *     现:全量判 **HEAD blob**、`--staged` 判索引 blob、`--worktree` 仅人工、两面旗同给 exit 2、
 *     清单与正文**同面同轮**、枚举到 0 个跟踪文件**判死不记绿**。
 *
 * 存量(台账那 16 处 + src 侧非白名单命中)套**该文件 HEAD 自身违规数**棘轮:
 * 只拦"这次改动把私接加回来了",不追别人欠的债 —— 存量当场判红就是一台与任何提交都无关的恒红门,
 * 唯一结局是逼人 `--no-verify`,连带链上全部守门对该提交作废(§12e)。
 *
 * 手动:`node scripts/check-inline-back-button.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 紧急跳过:`HUSKY_SKIP_INLINE_BACK_GUARD=1`(由 guardian-runner 的 skipEnv 统一 honors,2026-09-24 已补真)
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 120_000

/** 覆盖面:web 两个源码树都扫。加目录必须同批改本注释与镜像测试的覆盖面锁,否则"扫到了但没判"照旧静默。 */
export const SCAN_DIRS = ['apps/web/src', 'apps/web/app']
/** 统一返回键的三处唯一实现(声明/渲染/存储)。新增唯一实现点必须同笔登记,不得用行内豁免遮。 */
export const ALLOWLIST = [
  'apps/web/src/components/layout/GlobalTopBar.tsx',
  'apps/web/src/components/common/BackButton.tsx',
  'apps/web/src/stores/topbar-back.ts',
]
export const BANNED = [/router\s*\.\s*back\s*\(/, /\bhistory\s*\.\s*back\s*\(/]
const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs)$/

const norm = (p) => String(p).replace(/\\/g, '/')

function isCommentLine(line) {
  const t = line.trimStart()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/**
 * 判一份内容。注释行跳过(文档性提及不是私接);其余逐行过 BANNED。
 * 返回命中行号与文本 —— 判红要能点名,只报计数会让人找不到站点。
 */
export function scanContent(rel, src) {
  const hits = []
  const lines = String(src).split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i])) continue
    if (BANNED.some((re) => re.test(lines[i])))
      hits.push({ file: norm(rel), line: i + 1, text: lines[i].trim().slice(0, 100) })
  }
  return hits
}

/** 该文件在射程内(扩展名 + 未被白名单摘掉)。抽成函数是为了让镜像测试能问"app/ 下的页面算不算在射程"。 */
export function inScope(rel) {
  const p = norm(rel)
  if (!SCAN_EXT.test(p)) return false
  if (ALLOWLIST.includes(p)) return false
  return SCAN_DIRS.some((d) => p.startsWith(`${d}/`))
}

function listWorktree(dirAbs, base, out) {
  let names
  try {
    names = readdirSync(dirAbs)
  } catch {
    return out
  }
  for (const name of names) {
    const rel = base ? `${base}/${name}` : name
    const full = join(dirAbs, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) listWorktree(full, rel, out)
    else if (st.isFile() && SCAN_EXT.test(name)) out.push(rel)
  }
  return out
}

/**
 * 清单与内容**同面同轮**。
 *  - head:用 `ls-tree HEAD` 枚举(旧版这里用 `git ls-files`/磁盘 ⇒ 索引里有而 HEAD 没有的文件会被
 *    当成被审内容,取不到 blob 又落进"未判定");
 *  - staged:只认本次暂存集(全量扫索引会把别人欠的债算到每一次提交头上);
 *  - worktree:磁盘遍历,仅此档允许,且必须显式喊"仅人工"。
 */
export function listFiles({ face, root = ROOT, git, timeout = GIT_TIMEOUT_MS }) {
  if (face === 'worktree') {
    const out = []
    for (const d of SCAN_DIRS) out.push(...listWorktree(join(root, d), d, []))
    return out.map(norm).sort()
  }
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR', '--', ...SCAN_DIRS]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS]
  const raw = git(args, root, { timeout, maxBuffer: 1 << 26 })
  return String(raw)
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(norm)
    .sort()
}

/** 判定核心:给定"当前面"与"锚点面"的文件集合,产出红/存量/未判定三态(绝不并桶)。 */
export function judge({ files, read, readAnchor }) {
  const hits = []
  const undetermined = []
  let scanned = 0
  for (const rel of files) {
    if (!inScope(rel)) continue
    const src = read(rel)
    if (src === null || src === undefined) {
      undetermined.push(`${rel}(内容取不到)`)
      continue
    }
    scanned++
    hits.push(...scanContent(rel, src))
  }
  // 锚点面:每个涉事文件在 HEAD 自身的命中数。锚点取不到 ⇒ 走最严方向(按 0)并如实报名,
  // 因为"取不到就当没有存量"等于让存量债变成每一次提交的红。
  const anchor = new Map()
  for (const f of new Set(hits.map((h) => h.file))) {
    let n = 0
    const a = readAnchor(f)
    if (a === null || a === undefined) {
      undetermined.push(`${f}(HEAD 锚点取不到 ⇒ 按 0 计,新增一律判红)`)
      n = 0
    } else n = scanContent(f, a).length
    anchor.set(f, n)
  }
  const byFile = new Map()
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || 0) + 1)
  const violations = []
  const stock = []
  for (const [file, n] of byFile) {
    const cap = anchor.get(file) ?? 0
    if (n > cap) violations.push(...hits.filter((h) => h.file === file))
    else if (n > 0) stock.push({ file, count: n, cap })
  }
  return { scanned, violations, stock, undetermined, emptyScan: scanned === 0 }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, extra = '') => {
    if (typeof cond === 'function') {
      fail++
      console.log(`❌ ${name} —— cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})())`)
      return
    }
    if (cond) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? ` —— ${extra}` : ''}`)
    }
  }
  const A = 'apps/web/app/(main)/asks/[id]/PageClient.tsx'
  const PRIV = 'function c(){\n  router.back()\n}\n'
  t('B1 app/ 下的私接必须命中(旧版对该目录整面失明)', scanContent(A, PRIV).length === 1)
  t('B2 src/ 同样在射程', scanContent('apps/web/src/pages/x.tsx', PRIV).length === 1)
  t('B3 注释行不判(文档性提及不是私接)', scanContent(A, '  // router.back()\n').length === 0)
  t('B4 三处唯一实现被白名单摘掉', !inScope(ALLOWLIST[0]) && !inScope(ALLOWLIST[2]))
  t('B5 射程外的目录一律不判(端外同名件不算 web 页头)', !inScope('apps/miniapp-taro/src/a.tsx'))
  t('B6 history.back() 同形认', scanContent(A, 'history.back()\n').length === 1)
  const cur = { [A]: PRIV + PRIV }
  const mk = (m) => (f) => (f in m ? m[f] : null)
  const r1 = judge({ files: [A], read: mk(cur), readAnchor: mk({ [A]: PRIV }), strict: false })
  t(
    'B7 棘轮:同一文件命中数上升 ⇒ 红',
    r1.violations.length === 2 && r1.stock.length === 0,
    JSON.stringify(r1.violations.length),
  )
  const r2 = judge({
    files: [A],
    read: mk({ [A]: PRIV }),
    readAnchor: mk({ [A]: PRIV }),
    strict: false,
  })
  t(
    'B8 存量相等 ⇒ 只报数不判红(否则 16 处当场变恒红门)',
    r2.violations.length === 0 && r2.stock[0]?.count === 1,
  )
  const r3 = judge({
    files: [A],
    read: mk({ [A]: '' }),
    readAnchor: mk({ [A]: PRIV }),
    strict: false,
  })
  t('B9 存量下降(有人清偿)⇒ 绿', r3.violations.length === 0 && r3.stock.length === 0)
  const r4 = judge({ files: [A], read: mk({}), readAnchor: mk({}), strict: false })
  t(
    'B10 内容取不到 ⇒ 落未判定,不冒绿也不冒红',
    r4.undetermined.length > 0 && r4.violations.length === 0,
  )
  const r5 = judge({ files: [A], read: mk(cur), readAnchor: mk({}), strict: false })
  t(
    'B11 锚点取不到 ⇒ 按最严方向(0)计并报名,不得当"没有存量"洗绿',
    r5.violations.length === 2 && r5.undetermined.some((s) => /锚点/.test(s)),
  )
  const t2 = selectFace({ staged: true, worktree: true, def: 'head' })
  t('B12 两面旗同给 ⇒ 判死', !!t2.error)
  return { pass, fail }
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const { pass, fail } = selfTest()
    console.log(`\n[inline-back] 自检 ${pass} 通过 / ${fail} 失败`)
    // 覆盖面自证:被审清单里必须**两个目录都有份**,否则"app/ 整面失明"那一型会安静回来
    try {
      const fl = listFiles({ face: 'head', root: ROOT, git })
      const per = SCAN_DIRS.map(
        (d) => `${d}=${fl.filter((f) => f.startsWith(`${d}/`)).length}`,
      ).join(' ')
      if (!SCAN_DIRS.every((d) => fl.some((f) => f.startsWith(`${d}/`)))) {
        console.log(`❌ 自检:HEAD 清单里缺整个目录(${per})⇒ 覆盖面没有真的扩开,不记通过`)
        return 1
      }
      console.log(`✅ 自检覆盖面:HEAD 清单 ${fl.length} 个文件 · ${per}`)
    } catch (e) {
      console.log(
        `❌ 自检覆盖面跑不动(未判定,不等于通过):${String(e?.message ?? e).split('\n')[0]}`,
      )
      return 2
    }
    return fail > 0 ? 1 : 0
  }
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : ROOT
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  let face = sel.face
  if (root !== ROOT && face !== 'worktree') {
    console.error(`❌ --root 只在 --worktree 档有效(换根却仍按 HEAD/索引读 = 双根分裂)`)
    return 2
  }
  let files
  try {
    files = listFiles({ face, root, git })
  } catch (e) {
    console.error(`❌ 无法判定:清单取不到(${String(e?.message ?? e).split('\n')[0]})`)
    return 2
  }
  // 暂存档"本次没有射程内文件"必须**回退全量并喊出来**,不得判成无法判定:文档/语言包/脚本类提交
  // 结构上不带 web 文件,判它空扫就是替每一次无关提交挡路,而恒挡的唯一结局是各会话走应急跳门(§12e,
  // 门 135/157 都记过同一格)。
  if (face === 'staged' && !files.some(inScope)) {
    console.log(
      '[inline-back] --staged:本次没有射程内(apps/web)文件 ⇒ 回退 HEAD 全量(只报存量,不判"无法判定")。',
    )
    face = 'head'
    try {
      files = listFiles({ face, root: ROOT, git })
    } catch (e) {
      console.error(`❌ 无法判定:回退清单取不到(${String(e?.message ?? e).split('\n')[0]})`)
      return 2
    }
  }
  const strict = argv.includes('--strict')
  const specs = files.map((f) => (face === 'staged' ? `:${f}` : `HEAD:${f}`))
  const anchors = files.map((f) => `HEAD:${f}`)
  let curMap, ancMap
  try {
    curMap =
      face === 'worktree'
        ? null
        : catBatch(root, specs, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 27 })
    ancMap =
      face === 'head'
        ? curMap
        : catBatch(root, anchors, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 27 })
  } catch (e) {
    console.error(`❌ 无法判定:内容取不到(${String(e?.message ?? e).split('\n')[0]})`)
    return 2
  }
  const keyOf = (rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
  const read =
    face === 'worktree'
      ? (rel) => readWorktreeFile(root, rel)
      : (rel) => {
          const v = curMap.get(keyOf(rel))
          return v === undefined ? null : v
        }
  const readAnchor = (rel) => {
    if (face === 'worktree') {
      try {
        return git(['show', `HEAD:${rel}`], root, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 26 })
      } catch {
        return null
      }
    }
    const v = ancMap.get(`HEAD:${rel}`)
    return v === undefined ? null : v
  }
  const r = judge({ files, read, readAnchor, strict })
  if (r.emptyScan) {
    console.error(`❌ 枚举到 0 个射程内文件(判定面=${face})⇒ 判据失明,不记通过`)
    return 2
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { face: face, root: face === 'worktree' ? 'worktree-only' : ROOT, ...r },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[inline-back] 判定面=${face === 'worktree' ? '工作树(仅人工)' : face}:扫 ${r.scanned} 文件 · 私接 ${r.violations.length} 处(新增)· 存量 ${r.stock.reduce((a, b) => a + b.count, 0)} 处 · 未判定 ${r.undetermined.length}`,
    )
    for (const v of r.violations) console.error(`  ❌ ${v.file}:${v.line} ${v.text}`)
    for (const s of r.stock)
      console.log(`  · 存量(该文件 HEAD 自身 ${s.cap} 处,本轮不问责):${s.file} ×${s.count}`)
    for (const u of r.undetermined) console.log(`  ℹ 未判定:${u}`)
    if (r.violations.length === 0) console.log('✅ 无"把私接加回来"的改动。')
    else
      console.error(
        '\n   修复方式(声明而非实现):\n' +
          '   - 二级及以上子页面:零代码,TopBarBackAutoRegister 已自动声明\n' +
          '   - 页内视图级返回(详情→列表):useTopBarBack(selected ? { onBack: () => setX(null) } : null)\n' +
          '   - 指定降级路由:<BackButton fallbackHref="/parent" />\n',
      )
  }
  if (r.violations.length > 0) return 1
  if (strict && (r.stock.length > 0 || r.undetermined.length > 0)) return 2
  return 0
}

/** git 一律走 face-reader 的 transport(不在门里拼字符串派生);守门 118 判的就是这一型。 */
const git = (args, root = ROOT, opts = {}) => gitRaw(args, root, opts)

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  scanContent,
  inScope,
  listFiles,
  judge,
  ALLOWLIST,
  SCAN_DIRS,
  BANNED,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
