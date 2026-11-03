#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-tracked-ignored.mjs —— 拦住"把 gitignore 里的东西提交进去"(blocking,2026-10-23 立)。
 *
 * 立因(实测,不是假想):`plan-pointer-purge.mjs` 每轮清偿都把自己的取证台账写进
 * `.ihui-agent/tmp/`(**gitignored**),却同时塞进 commit 的 entries ⇒ 每轮在 HEAD 里多一枚
 * tracked-but-ignored 文件。清理侧逐枚 `git rm --cached`(988a243cd12 60 枚、33a433dd491 …),
 * 合并侧又按对侧副本把它们带回 ⇒ `git-sync-converge` 每轮被门 168 拦一次(2026-10-23 同一晚
 * 撞了两轮,每次都只能靠 `IHUI_SKIP_CONVERGE_DELETION_RESURRECTION` + 理由放行)。
 * 立时现读存量 81 枚(其中 `.ihui-agent/tmp/` 61 枚),没有一道门在看这一格;存量枚数一律现读,
 * 不在此写死(2026-10-23 全量档现读 25 条)。
 *
 * 判据(三档,永不恒红;档位 ⇄ 退出码一一对应):
 *  - **`--staged` 拦新增**(blocking):本次提交**新增**的路径(`git diff --cached --diff-filter=A`)里,
 *    凡命中 `git check-ignore --no-index` 的 ⇒ 红(exit 1)并逐条点名。这一档天生增量,
 *    不会因存量而恒红(§12e)。其中落在 **G-926 台账**(
 *    `scripts/data/lint-staged-ignored-tracked.json`)且未过期的目录 ⇒ 逐条点名但放行:
 *    那些目录是"登记过、有归属、有到期日"的存量,一律拦就是第二把尺子(§0.6);
 *    台账取不到/坏了 ⇒ 同样落 exit 2,不得当成"没有台账"把全部新增判红。
 *  - **全量/HEAD 档只报数**:`git ls-files -i -c --exclude-standard` 的存量逐条打印 + 计数,
 *    **exit 0,绝不判红**。存量得靠"取消跟踪"逐个清,而不是把所有人的提交挡住。
 *    2026-10-23 修:旧实现把 `git ls-files` 的**全量** tracked 路径(现读 15,805 条)当"新增"
 *    喂给 `check-ignore --no-index` ⇒ HEAD 里那 25 条存量每次全量档都全判红 = 恒红门,
 *    与本节头两句自相矛盾(§12e)。现在全量档**根本不取"新增"面**,只取存量清单。
 *    这也正是 AGENTS「tracked-but-ignored(236)…存量只报数」所写的口径。
 *  - **`--strict` 问责档(显式 opt-in,不进提交链、runner 也不追加)**:存量 > 0 ⇒ exit 1。
 *    人工清库存时用的尺子;默认档位里没有任何一条会因存量翻红。
 *
 * 为什么是"新增"而不是"全部":`.gitignore` 与既有意图本来就有一处不一致(见 README 里
 * `.ihui-agent/archive/` 那类"故意入库却整目录被忽略"的历史遗留),把存量判红就是恒红门,
 * 唯一结局是人人 `--no-verify`、连带废掉全部守门。
 *
 * 退出码(§0.3):0 通过(含"全量档有存量、只报数") / 1 有新增违规(`--staged`)或
 * `--strict` 下存量不为零 / 2 取不到输入(未判定,不记绿也不冒红;豁免台账取不到同样落 2)。
 * 应急:`HUSKY_SKIP_TRACKED_IGNORED=1`(会进跳门留痕)。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120_000

/**
 * 跑一条 git。`okCodes` 之外的退出码一律抛(调用方落 exit 2)。
 *
 * `git check-ignore` **一条都不命中时退出码是 1**(不是错误),所以它必须把 1 当合法值 ——
 * 用只认 exit 0 的派生会把"全仓没有命中"读成"取不到输入",那正是 §0.3 最怕的"没判当判过"。
 *
 * 派生一律走 `scripts/lib/face-reader.mjs` 的 `gitRaw`(G-927):绝对路径 git、safe.directory、
 * quotepath、windowsHide、stdio 两态与 EBUSY 兜底都在层里,本文件不再自拼子进程。
 */
function git(args, { input, okCodes = [0] } = {}, root = ROOT) {
  try {
    return gitRaw(args, root, { input, timeout: GIT_TIMEOUT })
  } catch (e) {
    // 合法非零码是**结论**不是故障(exit 1 的 check-ignore 没有 stdout,恒为空)。
    if (typeof e?.status === 'number' && okCodes.includes(e.status)) return ''
    throw e
  }
}

/**
 * 纯判据:新增路径里哪些被 ignore 命中。`ignoredSet` 由 `git check-ignore --stdin` 给,
 * 返回值保序(与入参同序),便于逐条点名与镜像测试。
 */
export function classifyAdded(addedPaths, ignoredSet) {
  return addedPaths.filter((p) => ignoredSet.has(p))
}

/**
 * 给定一组路径,返回其中**被 .gitignore 命中**的那些(保序)。
 *
 * `--no-index` 是这道门的命门:git check-ignore 默认**跳过已在索引里的路径**(对已跟踪文件
 * 直接不判忽略),而本门要抓的恰恰是"刚被 add 进来 / add -f 强行绕过"的那一条 —— 少了它,
 * 门恒报 0 命中、与"没有违规"同形(实测:全量档 15845 条路径命中 0,而存量读数 86)。
 * 一条都不命中时 check-ignore **exit 1** ⇒ 把 1 列为合法码。
 *
 * `root` 可注入:镜像用例在自己那个 scratch 仓里跑同一段判据(§22c 不复制第二份)。
 */
export function ignoredAmong(paths, { root = ROOT } = {}) {
  if (paths.length === 0) return []
  const out = git(
    ['check-ignore', '--no-index', '--stdin', '-z'],
    { input: paths.join('\0') + '\0', okCodes: [0, 1] },
    root,
  )
  const ignored = new Set(out.split('\0').filter(Boolean))
  return classifyAdded(paths, ignored)
}

/**
 * 仓里**已有的**ignored-tracked 目录台账(G-926)。本门必须认它,否则就是第二把尺子(§0.6):
 * 那些目录是"登记过、有归属、有到期日"的存量,门若一律拦新增,等于把别人已裁决的口径当违规。
 * 本门只做一件事:把**台账没覆盖的**新增拦住;台账覆盖且未过期的,照实点名但放行。
 */
const LEDGER_REL = join('scripts', 'data', 'lint-staged-ignored-tracked.json')

/** 读台账;取不到/坏了 ⇒ 抛(调用方落 exit 2),不得当成"没有台账"从而把全部新增判红 */
function loadLedger() {
  const p = join(ROOT, LEDGER_REL)
  if (!existsSync(p)) throw new Error(`台账 ${LEDGER_REL} 不存在`)
  let j
  try {
    j = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error(`台账 ${LEDGER_REL} 不是合法 JSON:${e.message}`)
  }
  if (!Array.isArray(j.entries)) throw new Error(`台账 ${LEDGER_REL} 缺 entries 数组`)
  return j.entries
    .filter((e) => e && typeof e.dir === 'string' && typeof e.until === 'string')
    .map((e) => ({ dir: e.dir.replace(/\/+$/, ''), until: e.until }))
}

/**
 * 纯判据:把"新增且被 ignore 命中"的路径按台账分两桶。
 * 命中口径为**目录前缀**(台账的 dir 是目录),且到期日必须 ≥ 今天 —— 过期即回到 red。
 */
export function classifyWithLedger(
  ignoredPaths,
  entries,
  today = new Date().toISOString().slice(0, 10),
) {
  const exempt = []
  const red = []
  for (const p of ignoredPaths) {
    const hit = entries.find((e) => p === e.dir || p.startsWith(e.dir + '/'))
    if (hit && hit.until >= today) exempt.push({ path: p, dir: hit.dir, until: hit.until })
    else red.push(p)
  }
  return { exempt, red }
}

/**
 * 存量清单(单源):tracked 且被 `.gitignore` 命中的路径。`-z` 是为了含换行的路径不被拆错。
 * 取不到就抛(调用方落 exit 2),绝不返回空清单冒充"没有存量"。
 */
function loadStock(root) {
  return git(['ls-files', '-i', '-c', '--exclude-standard', '-z'], {}, root)
    .split('\0')
    .filter(Boolean)
}

/** 本次提交**新增**的路径(`git diff --cached --diff-filter=A`,索引面)。取不到就抛。 */
function loadAdded(root) {
  return git(['diff', '--cached', '--diff-filter=A', '--name-only', '-z'], {}, root)
    .split('\0')
    .filter(Boolean)
}

/** 全量档名录打印上限(纯展示闸;超出的条数必须显式报出,不许静默截断)。 */
const STOCK_PRINT_CAP = 50

/**
 * 单源判据:返回 `{ code, face, added, bad, exempt, stock, stdout, stderr }`,自己**不**写 console。
 * `root` 可注入:镜像用例在自己那个 scratch 真仓里跑同一段实现(§22c 不复制第二份)。
 * `ledger` 可注入(测试直供台账条目);缺省时只对**真仓**(`root === ROOT`)读盘上台账,
 * 取不到/坏了 ⇒ 抛 ⇒ 落 exit 2 —— 不把"读不到台账"当成"没有台账"(那会把全部新增判红)。
 *
 * 面纪律(§0.4):`--staged` 判**索引面新增**;全量档只判"存量清单取不取得到",**不判存量本身**。
 */
export function evaluate(argv = [], { root = ROOT, ledger = null } = {}) {
  const staged = argv.includes('--staged')
  const strict = argv.includes('--strict')
  const face = staged ? 'staged' : 'head'

  let stock
  let added = []
  let bad = []
  let exempt = []
  try {
    stock = loadStock(root)
    if (staged) {
      added = loadAdded(root)
      bad = ignoredAmong(added, { root })
      // G-926 台账豁免:命中且落在台账(未过期)目录里的 ⇒ 逐条点名但放行(§0.6,不是第二把尺子)。
      // 台账只对**真仓**加载 —— root 被注入时跑的是镜像用例的 scratch 合成仓,那里没有台账,
      // 也不该凭空产生豁免(§22c:镜像结论不得随主仓配置漂移);调用方直供 ledger 则照用。
      // 台账取不到/坏了 ⇒ 抛 ⇒ 落 exit 2(fail-closed),绝不当作"没有台账"把全部新增判红。
      const entries = ledger ?? (root === ROOT ? loadLedger() : [])
      const cls = classifyWithLedger(bad, entries)
      exempt = cls.exempt
      bad = cls.red
    }
  } catch (e) {
    return {
      code: 2,
      face,
      added: [],
      bad: [],
      exempt: [],
      stock: [],
      stdout: [],
      stderr: [
        `❌ check-tracked-ignored 未判定:取不到 ${face} 面 / 存量清单 / 豁免台账(${String(e?.message ?? e).slice(0, 200)})`,
      ],
    }
  }

  const stockNote = `存量(只报数)${stock.length} 条`

  // ---- 全量/HEAD 档:只报数,exit 0(判存量 = 恒红门,§12e)----
  if (!staged) {
    const stdout = [`[tracked-ignored] 面=head ${stockNote} —— 本档只报数,不判红`]
    for (const p of stock.slice(0, STOCK_PRINT_CAP)) stdout.push(`  · ${p}`)
    if (stock.length > STOCK_PRINT_CAP)
      stdout.push(
        `  … 还有 ${stock.length - STOCK_PRINT_CAP} 条未列出(列全:git ls-files -i -c --exclude-standard)`,
      )
    if (strict && stock.length > 0) {
      return {
        code: 1,
        face,
        added,
        bad,
        exempt,
        stock,
        stdout: [`${stdout[0]} ⇒ --strict 下存量 ${stock.length} 条判红`],
        stderr: ['  ✗ --strict:存量不为零(逐条:git ls-files -i -c --exclude-standard)'],
      }
    }
    return { code: 0, face, added, bad, exempt, stock, stdout, stderr: [] }
  }

  // ---- --staged 档:只看本次新增(天生增量;台账豁免已在上面 try 里分流)----
  const ledgerNote = exempt.length ? `(台账内 ${exempt.length} · 无台账 ${bad.length})` : ''
  const head =
    `[tracked-ignored] 面=staged 新增 ${added.length} 条 / 命中 ignore ${bad.length + exempt.length} 条` +
    `${ledgerNote} / ${stockNote}`
  // 豁免不是静默通过:每一票都点名(目录 + 到期日),台账上与日志上看得见的是同一份
  const exemptLines = exempt.map(
    (e) => `  · ${e.path} —— 落在已登记目录 ${e.dir}(至 ${e.until}),按 G-926 台账放行`,
  )

  if (bad.length > 0) {
    return {
      code: 1,
      face,
      added,
      bad,
      exempt,
      stock,
      stdout: exemptLines,
      stderr: [
        head,
        ...bad.map((p) => `  ✗ ${p} —— 该路径被 .gitignore 命中 ⇒ gitignored 的内容不得进版本控制`),
        '  修法:改落点(写盘/写 gitignored 的运行态目录)或从本次声明集里去掉;**不要**用 git add -f 绕过,',
        '  也不要把 .gitignore 的否定规则放宽到整个目录(那会把噪音一起放进仓)。',
      ],
    }
  }

  if (strict && stock.length > 0) {
    return {
      code: 1,
      face,
      added,
      bad,
      exempt,
      stock,
      stdout: [`${head} ⇒ --strict 下存量 ${stock.length} 条判红`, ...exemptLines],
      stderr: ['  ✗ --strict:存量不为零(逐条:git ls-files -i -c --exclude-standard)'],
    }
  }

  return { code: 0, face, added, bad, exempt, stock, stdout: [head, ...exemptLines], stderr: [] }
}

export function main(argv = process.argv.slice(2), opts = {}) {
  const r = evaluate(argv, opts)
  for (const line of r.stdout) console.log(line)
  for (const line of r.stderr) console.error(line)
  return r.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { classifyAdded, ignoredAmong, classifyWithLedger, evaluate }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
