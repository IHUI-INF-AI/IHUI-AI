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
 * 全仓现读存量 81 枚(其中 `.ihui-agent/tmp/` 61 枚),没有一道门在看这一格。
 *
 * 判据(两档,永不恒红):
 *  - **拦新增**(blocking):本次提交**新增**的路径(`git diff --cached --diff-filter=A`)里,
 *    凡命中 `git check-ignore` 的 ⇒ 红并逐条点名。这一档天生增量,不会因存量而恒红(§12e)。
 *  - **存量只报数**:`git ls-files -i -c --exclude-standard` 的计数照实打印,不判红 ——
 *    存量得靠"取消跟踪"逐个清,而不是把所有人的提交挡住。
 *
 * 为什么是"新增"而不是"全部":`.gitignore` 与既有意图本来就有一处不一致(见 README 里
 * `.ihui-agent/archive/` 那类"故意入库却整目录被忽略"的历史遗留),把存量判红就是恒红门,
 * 唯一结局是人人 `--no-verify`、连带废掉全部守门。
 *
 * 退出码(§0.3):0 无新增违规 / 1 有新增违规 / 2 取不到输入(未判定,不记绿也不冒红)。
 * 应急:`HUSKY_SKIP_TRACKED_IGNORED=1`(会进跳门留痕)。
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120_000

/**
 * 跑一条 git。`okCodes` 之外的退出码一律抛(调用方落 exit 2)。
 *
 * `git check-ignore` **一条都不命中时退出码是 1**(不是错误),所以它必须把 1 当合法值 ——
 * 用 execFileSync 会把"全仓没有命中"读成"取不到输入",那正是 §0.3 最怕的"没判当判过"。
 */
function git(args, { input, okCodes = [0] } = {}, root = ROOT) {
  const r = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    // 一律三管接管(带 input 必须 pipe;不带时也 pipe,由进程退出关闭)—— 写成三元分支会让
    // 守门 193 读不出 stdio 值,落进"判不出"桶(实测该桶第一次出现就是本文件)。
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: GIT_TIMEOUT,
  })
  if (r.error) throw r.error
  if (!okCodes.includes(r.status))
    throw new Error(
      `git ${args[0]} exit ${r.status}:${String(r.stderr ?? '')
        .trim()
        .slice(0, 160)}`,
    )
  return r.stdout ?? ''
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

/** 取不到就抛(调用方落 exit 2),绝不返回空集冒充"没有" */
function loadFaces(face) {
  const added = git(
    face === 'staged'
      ? ['diff', '--cached', '--diff-filter=A', '--name-only', '-z']
      : ['ls-files', '-z'],
  )
    .split('\0')
    .filter(Boolean)
  if (added.length === 0) return { added, ignored: new Set() }
  return { added, ignored: new Set(ignoredAmong(added)) }
}

function stockCount() {
  const out = git(['ls-files', '-i', '-c', '--exclude-standard']).trim()
  return out === '' ? 0 : out.split('\n').length
}

export function main(argv = process.argv.slice(2)) {
  const staged = argv.includes('--staged')
  const strict = argv.includes('--strict')
  const face = staged ? 'staged' : 'head'

  let faces
  let stock
  try {
    faces = loadFaces(face)
    stock = stockCount()
  } catch (e) {
    console.error(
      `❌ check-tracked-ignored 未判定:取不到 ${face} 面或存量清单(${String(e?.message ?? e).slice(0, 200)})`,
    )
    return 2
  }

  const bad = classifyAdded(faces.added, faces.ignored)
  const head = `[tracked-ignored] 面=${face} 新增 ${faces.added.length} 条 / 命中 ignore ${bad.length} 条 / 存量(只报数)${stock} 条`

  if (bad.length > 0) {
    console.error(head)
    for (const p of bad)
      console.error(`  ✗ ${p} —— 该路径被 .gitignore 命中 ⇒ gitignored 的内容不得进版本控制`)
    console.error(
      '  修法:改落点(写盘/写 gitignored 的运行态目录)或从本次声明集里去掉;**不要**用 git add -f 绕过,',
    )
    console.error('  也不要把 .gitignore 的否定规则放宽到整个目录(那会把噪音一起放进仓)。')
    return 1
  }

  const tail = strict && stock > 0 ? ` ⇒ --strict 下存量 ${stock} 条判红` : ''
  console.log(`${head}${tail}`)
  if (strict && stock > 0) {
    console.error('  ✗ --strict:存量不为零(逐条:git ls-files -i -c --exclude-standard)')
    return 1
  }
  return 0
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

export const __test__ = { classifyAdded, ignoredAmong }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
