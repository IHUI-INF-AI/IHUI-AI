#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * gen-tool-name-sets.mjs —— 工具名单「单一真相源 → Python 可读生成物」的唯一出口。
 *
 * ## 立因(2026-10-29,现读量到的漂移,不是假想)
 *
 * 同一件事在前后端各有一份手写清单,而且已经漂开:
 *   - `apps/ai-service/app/routers/llm.py` 的 `_build_tool_summary` 里三行函数内
 *     `frozenset({"file_edit", "write_file"})` 等字面量;
 *   - 前端三处各自一份:`packages/shared/src/chat/task-status.ts` 的 `FILE_WRITE_TOOLS`、
 *     `apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx` 的
 *     `FILE_SEARCH_TOOLS` / `WEB_SEARCH_TOOLS` / `FILE_MODIFY_TOOLS`、
 *     `apps/web/src/components/ai/progress-sections/tool-category.ts` 的 `EXACT_MAP`。
 * 实测差异:后端 `_FILE_MODIFY_TOOLS` 只有 2 枚(`file_edit`/`write_file`),前端同名口径
 * 5 枚(多 `edit_file`/`create_file`/`delete_file`)⇒ 同一会话两边算出不同的"改了几个文件",
 * 而用户在界面上看到的是前端那个数。§0.6 明令"同类判据/清单全仓只许一份",这一处是违反。
 *
 * ## 取向:方案 A(不动前端既有真相源,只让后端跟它对齐)
 *
 * 本仓已有"TS 常量 ← 权威 JSON"的生成器(`scripts/generate-command-policy-ts.mjs`,
 * command_policy.json → command-policy.generated.ts),但没有反向"TS → Python"的通道:
 * Python 侧读的是 `apps/ai-service/app/data/*.json`(`command_policy.json` /
 * `default_models.json` 都是这个形态,由 `Path(__file__).parent.parent/"data"/…` 加载)。
 * 所以本脚本补的正是**反向那一半**,形态沿用既有 data/*.json 约定:
 *
 *   TS 真相源(只读,一个字符都不改)
 *     → scripts/gen-tool-name-sets.mjs(本文件,唯一实现)
 *     → apps/ai-service/app/data/tool_name_sets.json
 *     → llm.py 模块级 frozenset(导入期一次,不再每次调用重建)
 *
 * 为什么不选"新增一份 JSON 作双向真相源":那要改前端既有集合的读法(把字面量换成读 JSON),
 * 而禁区里点名的 `progress-sections/**` 正在他席手上;风险与收益不成比例。
 *
 * ## 漂移可检测(光同步一次不够)
 *
 * `--check` 档:只算不写,与磁盘上的生成物逐字节比对,不一致 ⇒ exit 1 并点名差异。
 * 判据消费方 = `apps/ai-service/tests/test_tool_summary.py`(后端集合 ↔ JSON ↔ TS 源三面),
 * 所以"改了 TS 源但忘了重跑生成器"在 pytest 与 CI 上当场红,而不是等到线上数字对不上。
 *
 * ## 解析为什么不用 typescript 包
 *
 * CI 的 `test-python` job 只 `uv pip install`,**没有 npm install** ⇒ 依赖 typescript 的
 * 生成器在 CI 上会 ERR_MODULE_NOT_FOUND,而那条判据就会以"环境红"的形式长期失明(本仓记过
 * 多次同型)。所以这里只用 node 内置 + `scripts/lib/code-mask.mjs`(纯 JS、零依赖):
 * 先按仓库口径遮掉**注释**、保留字符串,再按受限形态匹配常量声明。遮罩这一步不是可选装饰 ——
 * `task-status.ts` 的注释里逐字写着 `FILE_WRITE_TOOLS`,不遮就会把散文读成定义。
 *
 * 取不到任何一项 ⇒ exit 2「未判定」并点名(缺失不等于空集:空集会让人数恒 0,那才是最坏的
 * 失效方向)。绝不回落硬编码默认值 —— 回落就等于把第二份真相源又种回来。
 *
 * ## 用法
 *   node scripts/gen-tool-name-sets.mjs            # 生成/更新生成物(内容无变化则不写盘)
 *   node scripts/gen-tool-name-sets.mjs --check     # 只判同步(rc 0 一致 / 1 漂移 / 2 未判定)
 *   node scripts/gen-tool-name-sets.mjs --json      # 把算出来的对象打到 stdout(排查用)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 真相源清单。**只增不改路径**;新增一档必须在 llm.py 侧同笔有消费方(§"声明必须有消费者")。 */
const SOURCES = Object.freeze({
  taskStatus: 'packages/shared/src/chat/task-status.ts',
  toolCategory: 'apps/web/src/components/ai/progress-sections/tool-category.ts',
  summaryCard: 'apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx',
})

/** 生成物落点:与 command_policy.json / default_models.json 同目录(Python 侧的既有读法)。 */
const OUT_REL = 'apps/ai-service/app/data/tool_name_sets.json'

/** 每一项的出处写在生成物里,后人不必再猜"这个名单是谁的"。 */
const ORIGIN = Object.freeze({
  fileWrite: `${SOURCES.taskStatus} · FILE_WRITE_TOOLS`,
  pathArgKeys: `${SOURCES.taskStatus} · PATH_ARG_KEYS`,
  fileSearch: `${SOURCES.summaryCard} · FILE_SEARCH_TOOLS`,
  webSearch: `${SOURCES.summaryCard} · WEB_SEARCH_TOOLS`,
  fileModify: `${SOURCES.summaryCard} · FILE_MODIFY_TOOLS`,
  categoryByTool: `${SOURCES.toolCategory} · EXACT_MAP`,
  commandTools: `${SOURCES.toolCategory} · EXACT_MAP 中 === 'command' 的键(等价投影,见生成器注释)`,
  fileCategoryTools: `${SOURCES.toolCategory} · EXACT_MAP 中 startsWith('file_') 的键(等价投影)`,
})

/** 未判定出口:一条原因字符串(调用方据此 exit 2),绝不返回空集冒充"没工具"。 */
class Undetermined extends Error {}

function readSource(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch (e) {
    throw new Undetermined(`真相源读不到:${rel}(${e?.code ?? e?.message ?? e})`)
  }
}

/** 只遮注释、保留字符串(§0.6 遮罩单源)。返回等长以外的文本也够用 —— 本文件不报行号。 */
function withoutComments(text) {
  return maskComments(text)
}

/** 抽 `const NAME … = new Set([ … ])` 的字符串成员;抽不出返回 null(由调用方判未判定)。 */
function setMembers(text, name) {
  const re = new RegExp(`const\\s+${name}\\b[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`)
  const m = text.match(re)
  if (!m) return null
  const out = []
  for (const lit of m[1].matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) out.push(lit[1] ?? lit[2])
  return out
}

/** 抽 `const NAME … = [ 'a', 'b' ]` 的字符串成员。 */
function stringList(text, name) {
  const re = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\]`)
  const m = text.match(re)
  if (!m) return null
  const out = []
  for (const lit of m[1].matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) out.push(lit[1] ?? lit[2])
  return out
}

/**
 * 抽 `const NAME … = { key: 'value', … }` 的映射表(EXACT_MAP 形态)。
 * 只认"单层、值为单引号字面量"的条目 —— 这正是 EXACT_MAP 的形状;形态变了就抽不出来,
 * 于是落"未判定"而不是抽到一半的半张表(半张表比没有更危险:它会静默少判一类)。
 */
function stringRecord(text, name) {
  const re = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`)
  const m = text.match(re)
  if (!m) return null
  const out = {}
  for (const line of m[1].split('\n')) {
    const row = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*'([^']+)'\s*,?\s*$/)
    if (!row) continue
    out[row[1] ?? row[2] ?? row[3]] = row[4]
  }
  return Object.keys(out).length > 0 ? out : null
}

/** 去重 + 字典序(同一份源算出同一份字节,生成物 diff 才可读)。 */
const sorted = (xs) => [...new Set(xs)].sort()

/**
 * 纯计算:真相源文本 → 生成物对象。**不做 IO 判定**,取不到就抛 Undetermined 点名缺哪一项。
 * @param {{taskStatus: string, toolCategory: string, summaryCard: string}} texts
 */
export function buildToolNameSets(texts) {
  const missing = []
  const need = (value, label) => {
    if (value === null || value === undefined) missing.push(label)
    return value
  }

  const task = withoutComments(texts.taskStatus)
  const category = withoutComments(texts.toolCategory)
  const card = withoutComments(texts.summaryCard)

  const fileWrite = need(setMembers(task, 'FILE_WRITE_TOOLS'), `FILE_WRITE_TOOLS(${SOURCES.taskStatus})`)
  const pathArgKeys = need(stringList(task, 'PATH_ARG_KEYS'), `PATH_ARG_KEYS(${SOURCES.taskStatus})`)
  const fileSearch = need(setMembers(card, 'FILE_SEARCH_TOOLS'), `FILE_SEARCH_TOOLS(${SOURCES.summaryCard})`)
  const webSearch = need(setMembers(card, 'WEB_SEARCH_TOOLS'), `WEB_SEARCH_TOOLS(${SOURCES.summaryCard})`)
  const fileModify = need(setMembers(card, 'FILE_MODIFY_TOOLS'), `FILE_MODIFY_TOOLS(${SOURCES.summaryCard})`)
  const categoryByTool = need(stringRecord(category, 'EXACT_MAP'), `EXACT_MAP(${SOURCES.toolCategory})`)

  if (missing.length) throw new Undetermined(`抽不出这些常量:${missing.join(', ')}`)

  // 顺序即语义的只有 pathArgKeys(前端 pickFilePath 按此序取第一个字符串键),其余排序。
  const catMap = {}
  for (const key of Object.keys(categoryByTool).sort()) catMap[key] = categoryByTool[key]

  // ── 派生出"按类目取工具名"的两组(前端 resolveToolCategory 的等价投影) ──
  // 前端的 terminalCommands = `resolveToolCategory(name) === 'command'`,
  // directories 的参与面 = `resolveToolCategory(name).startsWith('file_')`。
  // 而 resolveToolCategory 的回落分支只产 'mcp' / 'other'(MCP 命名约定 / 认不出),
  // **永远不会产 'command' 或 file_*** ⇒ 这两档的成员集恒等于 EXACT_MAP 里同值的那批键。
  // 所以这里**把等价投影算成名单**交给 Python,避免后端再抄一遍类目判定逻辑(§0.6:
  // 同一件事的第二份实现必然漂移,而且 Python 侧抄错不会在任何 TS 编译期暴露)。
  // 不变式(两侧都断言):commandTools == {k | map[k]==='command'},
  //                      fileCategoryTools == {k | map[k].startsWith('file_')}。
  const commandTools = sorted(Object.keys(catMap).filter((k) => catMap[k] === 'command'))
  const fileCategoryTools = sorted(Object.keys(catMap).filter((k) => catMap[k].startsWith('file_')))
  if (!commandTools.length) throw new Undetermined('EXACT_MAP 里一枚 command 类目工具都抽不到')
  if (!fileCategoryTools.length) throw new Undetermined('EXACT_MAP 里一枚 file_ 类目工具都抽不到')

  return {
    _generatedBy: 'scripts/gen-tool-name-sets.mjs',
    _doNotEdit: '本文件由生成器产出,手改会被 --check 判漂移。改名单请改 _origin 指向的 TS 真相源并重跑本脚本。',
    _origin: { ...ORIGIN },
    fileWrite: sorted(fileWrite),
    pathArgKeys: [...pathArgKeys],
    fileSearch: sorted(fileSearch),
    webSearch: sorted(webSearch),
    fileModify: sorted(fileModify),
    categoryByTool: catMap,
    commandTools,
    fileCategoryTools,
  }
}

/** 规范化序列化:对象键递归排序、数组保持原序(顺序有语义的那一项已在 build 时定死)。 */
export function stableStringify(value, indent = 2) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v).sort()) out[k] = norm(v[k])
      return out
    }
    return v
  }
  return `${JSON.stringify(norm(value), null, indent)}\n`
}

/** 逐档列出差异(供 --check 的失败信息点名:哪几个成员只在某一侧)。 */
export function diffToolNameSets(expected, actual) {
  const diffs = []
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
  for (const k of [...keys].sort()) {
    const e = expected[k]
    const a = actual[k]
    if (k === 'categoryByTool') {
      const em = e ?? {}
      const am = a ?? {}
      for (const name of new Set([...Object.keys(em), ...Object.keys(am)])) {
        if (em[name] !== am[name]) {
          diffs.push(`categoryByTool[${name}]:生成器=${em[name] ?? '(缺)'} 磁盘=${am[name] ?? '(缺)'}`)
        }
      }
      continue
    }
    if (Array.isArray(e) || Array.isArray(a)) {
      const es = new Set(Array.isArray(e) ? e : [])
      const as = new Set(Array.isArray(a) ? a : [])
      const onlyE = [...es].filter((x) => !as.has(x))
      const onlyA = [...as].filter((x) => !es.has(x))
      if (onlyE.length) diffs.push(`${k}:只存在于生成器侧 ${onlyE.join(', ')}`)
      if (onlyA.length) diffs.push(`${k}:只存在于磁盘生成物 ${onlyA.join(', ')}`)
      if (!onlyE.length && !onlyA.length && Array.isArray(e) && Array.isArray(a) && e.length !== a.length) {
        diffs.push(`${k}:顺序不同(顺序对该项有语义)`)
      }
      continue
    }
    if (JSON.stringify(e) !== JSON.stringify(a)) {
      // 键序不是判据(stableStringify 落盘时已按键排序,内存里的对象按声明序)⇒ 比规范化后的字面。
      if (stableStringify(e ?? null, 0).replace(/\s+/g, '') !== stableStringify(a ?? null, 0).replace(/\s+/g, '')) {
        diffs.push(`${k}:生成器=${JSON.stringify(e)} 磁盘=${JSON.stringify(a)}`)
      }
    }
  }
  return diffs
}

function readExpected() {
  return buildToolNameSets({
    taskStatus: readSource(SOURCES.taskStatus),
    toolCategory: readSource(SOURCES.toolCategory),
    summaryCard: readSource(SOURCES.summaryCard),
  })
}

function readActual() {
  const abs = join(ROOT, OUT_REL)
  let raw
  try {
    raw = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`生成物读不到:${OUT_REL}(${e?.code ?? e?.message ?? e});先跑一次不带 --check 的生成`)
  }
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Undetermined(`生成物不是可解析 JSON:${OUT_REL}(${e?.message ?? e})`)
  }
}

function reportDiffs(diffs) {
  for (const d of diffs) console.error(`  ❌ ${d}`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/gen-tool-name-sets.mjs [--check] [--json]\n' +
        `  TS 真相源 → ${OUT_REL}\n` +
        '  --check 只判同步:rc 0 一致 / 1 生成物漂移 / 2 未判定(取不到源或生成物)。',
    )
    process.exit(0)
  }

  let expected
  try {
    expected = readExpected()
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 未判定:${e.message}`)
      process.exit(2)
    }
    throw e
  }

  if (argv.includes('--json')) {
    // 只读档:打到 stdout 供排查,**不写盘**(与 --check 一样是"算而不落"的语义)
    process.stdout.write(stableStringify(expected))
    process.exit(0)
  }

  if (argv.includes('--check')) {
    let actual
    try {
      actual = readActual()
    } catch (e) {
      if (e instanceof Undetermined) {
        console.error(`⚠️ 未判定:${e.message}`)
        process.exit(2)
      }
      throw e
    }
    const diffs = diffToolNameSets(expected, actual)
    if (diffs.length) {
      console.error(`❌ 生成物与 TS 真相源不同步(${OUT_REL}):`)
      reportDiffs(diffs)
      console.error('  修法:node scripts/gen-tool-name-sets.mjs')
      process.exit(1)
    }
    console.log(`✅ 生成物与 TS 真相源同步:${OUT_REL}`)
    process.exit(0)
  }

  const text = stableStringify(expected)
  const abs = join(ROOT, OUT_REL)
  let current = null
  try {
    current = readFileSync(abs, 'utf8')
  } catch {
    /* 首次生成:没有旧文件属正常,不是未判定 */
  }
  if (current === text) {
    console.log(`✅ 无变化:${OUT_REL}`)
    process.exit(0)
  }
  writeFileSync(abs, text, 'utf8')
  console.log(`✅ 已生成 ${OUT_REL}(${text.length} chars)`)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  ROOT,
  SOURCES,
  OUT_REL,
  setMembers,
  stringList,
  stringRecord,
  withoutComments,
  readExpected,
  readActual,
  Undetermined,
}
