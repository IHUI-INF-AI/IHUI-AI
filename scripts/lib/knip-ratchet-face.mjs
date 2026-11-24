#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/knip-ratchet-face.mjs — Knip 棘轮的"口径可比性"判据(纯函数,不含派生)。
 *
 * 为什么单拆一层:`knip --reporter json` 读的是**磁盘**,而基线锚点是**内容**上的历史读数。
 * 共享工作区常年带着并发会话的未提交改动(本机实测几十个路径),此时量到的数与
 * CI 的干净检出**结构上不可比** —— 拿它判红会误伤,拿它 `--update` 写基线更糟:
 * 数会被永久记偏(偏高=从此看不见真新增,偏低=之后每次 CI 都红)。
 * 本仓对"判据必须与被审面同形"已有多次教训(守门 77/83/118),这一层是同一规矩的落地。
 *
 * 判定只认两个输入:是否 CI 环境、脏路径条数(问不到时由调用方传 null ⇒ 判"无法判定")。
 */

/**
 * @param {{ ci: boolean, dirtyCount: number | null, insideRepo?: boolean | null }} input
 *   `insideRepo` = `git rev-parse --is-inside-work-tree` 是否成功。**必须是三态**:
 *   `null` 表示 git 本身问不到(锁/超时/坏配置),那才是"无法判定";
 *   `false` 表示这里根本不是一个 git 检出 —— 本仓做 HEAD 干净检出验证用的就是
 *   `git archive` 出去的隔离树(见 AGENTS §"隔离 HEAD 检出"那条实测),那棵树的内容
 *   就是被量面,把它判成"不可比/无法判定"会让这道闸门恰好挡住唯一正确的记录方式。
 * @returns {{ verdict: 'comparable'|'incomparable'|'undetermined', reason: string }}
 */
export function classifyFace({ ci, dirtyCount, insideRepo = true }) {
  if (insideRepo === false) {
    return {
      verdict: 'comparable',
      reason: '非 git 检出(git archive 出的隔离 HEAD 树)⇒ 树内容即被量面,与 CI 同形',
    }
  }
  if (dirtyCount === null || dirtyCount === undefined) {
    return {
      verdict: 'undetermined',
      reason: 'git status 问不到脏路径条数 ⇒ 无法判定口径,不冒判可比也不冒判不可比',
    }
  }
  if (ci) {
    // CI 上 checkout 干净是前提;若真脏,那是 CI 配置故障,照旧如实报出来
    return dirtyCount > 0
      ? { verdict: 'incomparable', reason: `CI 环境却有 ${dirtyCount} 个未提交改动 —— checkout/缓存配置异常` }
      : { verdict: 'comparable', reason: 'CI 干净检出,与问责面同形' }
  }
  return dirtyCount > 0
    ? {
        verdict: 'incomparable',
        reason: `工作树有 ${dirtyCount} 个未提交改动,knip 量的是磁盘 ⇒ 与 CI(干净检出)不可比`,
      }
    : { verdict: 'comparable', reason: '工作树与 HEAD 同形,读数可比' }
}

/**
 * 写基线时的出处标注 —— 人工在脏树上下意识要放行,那就**把这件事写进文件**,
 * 让下一个读基线的人知道这个数是从哪份内容量出来的(禁静默)。
 * @param {{ comparable: boolean, dirtyCount: number | null, forced: boolean, isolated?: boolean }} input
 */
export function provenanceNote({ comparable, dirtyCount, forced, isolated = false }) {
  if (isolated) return 'recordedFrom: isolated HEAD checkout(git archive 出的干净树,无 .git)—— 与 CI 同形'
  if (comparable) return 'recordedFrom: clean face (工作树 == HEAD 或 CI 干净检出)'
  const n = dirtyCount === null ? '?' : dirtyCount
  return forced
    ? `recordedFrom: ⚠️ DIRTY worktree(${n} 个未提交改动) —— 经 --allow-dirty 人工放行,该数与 CI 不可比,须复核`
    : `recordedFrom: DIRTY worktree(${n})`
}

/**
 * 从 knip 的 stderr 里认出「插件配置文件加载失败」。
 *
 * 为什么这是一条**必判**的判据,而不是日志噪音(2026-11-04 取证):
 * knip 的 WorkspaceWorker 在配置加载抛错时只做两件事 —— `logError` 一行,然后
 * `this.cache.removeEntry(configFilePath)` 把它从**入口面**摘掉,进程照常 exit 0
 * (见 node_modules/knip/dist/WorkspaceWorker.js 的 hasLoadConfigError 分支)。
 * 于是读数不是"红",而是"少了一整块面却仍以为自己量过" —— 本仓把这种失败叫
 * 静默降级,判据方向只能是"读数不可比",绝不能当噪音吞掉。
 *
 * 实测面(2026-11-04 干净检出,5 处同时失败):apps/mobile-rn/app.config.js(WX 守卫、
 * knip 用 dummy config 上下文调用)、apps/mobile-rn/metro.config.cjs(nativewind 的
 * configPath 默认相对 cwd)、apps/extension/{wxt,vitest}.config.ts(.wxt/tsconfig.json
 * 未生成)、packages/database/drizzle.config.ts(缺 DATABASE_URL 时 fail-closed)。
 *
 * 形态:knip 的格式是 `ERROR: Error loading <相对路径> (<cause>)`。路径里可能带括号
 * (本仓有 `app/(main)/…` 这种 Next 路由段),所以只能以「空格 + 左括号」作分隔点,不能
 * 用第一个左括号;cause 里可能再带括号,故取到行尾最后一个右括号。
 *
 * @param {string} stderr
 * @returns {Array<{ path: string, cause: string }>} 空数组 = 没有加载失败
 */
export function detectConfigLoadFailures(stderr) {
  const failures = []
  for (const line of String(stderr ?? '').split('\n')) {
    const m = /^ERROR: Error loading (.+?) \((.*)\)\s*$/.exec(line)
    if (m) failures.push({ path: m[1], cause: m[2] })
  }
  return failures
}

/**
 * 把 knip 的 JSON 报告展平成「可比的符号清单」(2026-11-20 立,差值棘轮的判据基础)。
 *
 * 为什么必须从「计数」升级到「清单」(实测代价):
 *   计数基线的容差恒为 0,而 knip 对同一份内容在不同平台上会抖 1-2 项(实测 CI=本机+1),
 *   于是要么永远红、要么被迫放宽容差;放宽之后又看不见真正的新增。更致命的是**存量替换**:
 *   清掉 3 个旧死导出、同时新进 3 个新死导出,计数不变 ⇒ 门判绿而新债已入库。
 *   逐项清单把这两件事同时解决:只拦「当前有、基线没有」的键,行号抖动不产生新键。
 *
 * 键的形态(行号/列号**故意不入键** —— 一次 append 就挪位,和 AGENTS 里"证据指针禁行号"同源):
 *   · files            → 文件路径本身
 *   · exports/types/…  → `namespace.name`(有命名空间时)或 `name`
 *   · duplicates       → 同一文件里的重复名用 `|` 串起来(该类的 item 是数组,不是对象)
 *   · 其余(依赖/二进制等) → `name`
 *
 * 返回 `{ [category]: { [file]: string[] } }`,每个文件的键已排序去重,便于 diff 与稳定序列化。
 *
 * @param {{ issues?: Array<Record<string, unknown>> }} report knip --reporter json 的产物
 * @param {readonly string[]} categories 需要展开的类别清单(与棘轮 CATEGORIES 同源)
 */
export function expandItems(report, categories) {
  const out = Object.fromEntries(categories.map((c) => [c, new Map()]))
  for (const issue of report?.issues ?? []) {
    const file = typeof issue.file === 'string' ? issue.file : ''
    for (const c of categories) {
      const arr = issue[c]
      if (!Array.isArray(arr)) continue
      const bucket = out[c]
      if (!bucket.has(file)) bucket.set(file, new Set())
      const keys = bucket.get(file)
      for (const item of arr) {
        const k = itemKey(item)
        if (k) keys.add(k)
      }
    }
  }
  const result = {}
  for (const c of categories) {
    const files = {}
    for (const [file, keys] of out[c]) {
      if (keys.size > 0) files[file] = [...keys].sort()
    }
    result[c] = files
  }
  return result
}

/** 单个 knip issue 条目 → 稳定键。认不出的形状返回空串(宁可漏一个键,不制造假键)。 */
function itemKey(item) {
  if (Array.isArray(item)) {
    // duplicates:一条 = 一个文件里的一组同名导出
    const names = item.map((x) => (x && typeof x.name === 'string' ? x.name : '')).filter(Boolean)
    return names.length > 0 ? names.join('|') : ''
  }
  if (!item || typeof item.name !== 'string' || item.name === '') return ''
  const ns = typeof item.namespace === 'string' && item.namespace !== '' ? `${item.namespace}.` : ''
  return `${ns}${item.name}`
}

/**
 * 清单差值:当前面相对基线**新增了哪些项**、清偿了哪些项。
 *
 * 语义与 AGENTS §0.5「棘轮锚点 = 该文件 HEAD 自身的违规数、只拦把违规加回来」同向:
 *   · `added`    当前有、基线没有 ⇒ 这才是红;
 *   · `resolved` 基线有、当前没有 ⇒ 存量被清偿,合法,只作收紧提示。
 *
 * @param {Record<string, Record<string, string[]>>} current expandItems 的产物
 * @param {Record<string, Record<string, string[]>>} baseline 基线里的同名结构
 */
export function diffItems(current, baseline) {
  const added = {}
  const resolved = {}
  const files = new Set([...Object.keys(current ?? {}), ...Object.keys(baseline ?? {})])
  for (const c of files) {
    const hitAdded = []
    const hitResolved = []
    const filesCur = current?.[c] ?? {}
    const filesBase = baseline?.[c] ?? {}
    const allFiles = new Set([...Object.keys(filesCur), ...Object.keys(filesBase)])
    for (const file of allFiles) {
      const cur = new Set(filesCur[file] ?? [])
      const base = new Set(filesBase[file] ?? [])
      for (const k of cur) if (!base.has(k)) hitAdded.push({ file, key: k })
      for (const k of base) if (!cur.has(k)) hitResolved.push({ file, key: k })
    }
    added[c] = hitAdded
    resolved[c] = hitResolved
  }
  return { added, resolved }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
