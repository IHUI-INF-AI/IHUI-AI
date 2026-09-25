// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 名单型判据「正向证明义务」对账(2026-09-26 立)。
//
// 要堵的是本仓一类反复出现的结构性失明:**"已有名单"类判据只有反向证明,从来没有正向证明。**
// 反向证明是"喂一个坏值、看它红不红";它能证明判据会喊,却不能证明那张表还连着。
// 一张被删空、被键名写错、或被 `Set.has()` 拿错大小写的名单,在反向证明下表现得和
// 一张好名单一模一样 —— 直到真的放行了一次内网请求 / 一次可见窗口 / 一次第三方归属反噬。
//
// 实测锚点(第七/八轮机制取证):SSRF 侧的网段表在接入本门前,全仓没有任何一处把它当
// **输入**用过;而 `apps/cli/src/tools/fetch-url.ts` 只判 `^https?://` 前缀,
// 于是"有 SSRF 判据"这件事在仓库里以注释和文档的形态存在,不以证据的形态存在。
//
// 判据(P1):登记表里每一条名单,其**成员字面量**至少要在该门的取证面(镜像测试 /
// 同文件 self-test 区)出现过一次;或者该名单标识符出现在遍历语境里(for..of / some /
// every / map / forEach / includes / toContain)。**一条都没有 ⇒ 红**,即"名单从未被当输入"。
//
// 两条防伪绿设计(比判据本身更值得记):
//  ① **取证面必须剥掉名单自身的声明块**。self-test 常写在名单所在文件的下半部,
//     若整文件搜字面量,声明那几行自己就能"证明"名单被用过 —— 一把在完好仓库上恒绿的尺子
//     等于没有尺子(守门 77/96 记过同型)。
//  ② 判不出不判红:名单解析不出成员 / 取证文件在本档取不到 ⇒ `undetermined`,只报数。
//     与本次改动无关的红点只会逼人 `--no-verify`,连带废掉全部守门(§12e 同型)。
//
// 口径同守门 70/77/83/98/101/113:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
// `--worktree` 仅人工逃生舱;取不到该档 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
// 存量棘轮:`--staged` 档只拦"HEAD 不红而索引红"的条目,即只拦"这次把正向证明弄丢的人"。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

const GIT_TIMEOUT = 20_000

export const SELF_SKIP_ENV = 'HUSKY_SKIP_LIST_POSITIVE_PROOF'

/**
 * 登记表面向「名单驱动」的判据。加条目的唯一正当理由:该判据的裁决确实由一张表决定。
 * 不得为"让本门看起来有覆盖面"去凑条目 —— 表腐烂正是本门要防的东西。
 */
export const REGISTRY = [
  {
    id: 'gate-52-console-executables',
    title: '守门 52 控制台程序白名单',
    list: { kind: 'js', file: 'scripts/check-no-visible-spawn.mjs', name: 'CONSOLE_LITERALS' },
    proofs: ['scripts/tests/check-no-visible-spawn.test.mjs', 'scripts/check-no-visible-spawn.mjs'],
  },
  {
    id: 'gate-80-git-readonly-verbs',
    title: '守门 80 git 只读动词表',
    list: { kind: 'js', file: 'scripts/check-git-read-timeout.mjs', name: 'READ_ONLY' },
    proofs: ['scripts/tests/check-git-read-timeout.test.mjs', 'scripts/check-git-read-timeout.mjs'],
  },
  {
    id: 'gate-107-third-party-roots',
    title: '守门 107 第三方来源 roots',
    list: {
      kind: 'json',
      files: [
        'config/third-party-provenance/embedded.json',
        'config/third-party-provenance/copied.json',
        'config/third-party-provenance/overrides.json',
      ],
      pick: 'roots',
    },
    proofs: ['scripts/tests/provenance-ledger.test.mjs', 'scripts/provenance-ledger.mjs'],
  },
  {
    id: 'ssrf-denied-cidrs',
    title: 'SSRF 拒发网段表',
    list: { kind: 'js', file: 'packages/shared/src/utils/ssrf-guard.ts', name: 'DENIED_CIDRS' },
    proofs: ['apps/cli/tests/ssrf-outbound.test.ts'],
  },
]

/**
 * 遍历语境模板。占位符 `__LIST__` 两侧**不得**是单词字符,否则替换找不到它。
 * 首版在这里栽过一次:当时用 `.replace(/\bNAME\b/g, ...)`,而模式串里 `NAME` 紧挨着
 * `\b` 的字面字母 `b`(同为单词字符),词边界根本不成立 ⇒ 替换永不发生,留下的模式是
 * 字面量 `\bNAME\b`,对任何真实代码都不匹配。表现不是报错,而是"遍历型证明一律不被承认"
 * —— 一条静默失效的判据(自检第 9/9b 例钉死方向)。
 *
 * 覆盖三种真写法(名单被当输入源消费):
 *   A `for (const v of LIST)`          —— 名单在 `of` 之后
 *   B `LIST.some( / .every( / .map(`   —— 名单是**接收者**,在方法名之前(方向最易写反)
 *   C `[...LIST]` / `LIST[i]` 展开     —— 遍历前物化
 * 刻意不覆盖 `expect(LIST).toHaveLength(n)`:那只证明表非空,不证明任何成员被当过输入。
 */
const ITERATION_TEMPLATE =
  '(?:for\\s*\\(\\s*(?:const|let|var)\\s+[A-Za-z_$][\\w$]*\\s+of\\s+__LIST__\\b' +
  '|\\b__LIST__\\s*\\.\\s*(?:forEach|some|every|map|filter|includes)\\s*\\(' +
  '|\\[\\.\\.\\.__LIST__\\s*\\])'

/** 由名单标识符构造遍历正则;占位符没被替换掉就直接抛 —— 宁可炸也不静默失效。 */
export function iterationRegex(listName) {
  if (!ITERATION_TEMPLATE.includes('__LIST__')) {
    throw new Error('遍历模板占位符丢失:判据已失效,拒绝冒绿')
  }
  return new RegExp(ITERATION_TEMPLATE.split('__LIST__').join(`\\b${listName}\\b`), 'g')
}

/**
 * 从 JS/TS 源里取出 `export const NAME = [...]` / `= new Set([...])` 的成员字面量,
 * 并回报声明块的起止偏移(取证面要按它剥)。
 * 解析不出即返回 null —— 由调用方判「无法判定」,绝不当成「名单是空的所以没人用」。
 */
export function extractJsList(text, name) {
  const declRe = new RegExp(
    `\\b(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*(?:new\\s+Set\\s*\\(\\s*)?\\[`,
    'g',
  )
  let match
  while ((match = declRe.exec(text)) !== null) {
    const openBracket = text.indexOf('[', match.index)
    if (openBracket < 0) continue
    const close = matchClosingBracket(text, openBracket)
    if (close < 0) continue
    const body = text.slice(openBracket + 1, close)
    const members = [...body.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)]
      .map((m) => m[2])
      .filter((v) => v.length > 0)
    if (members.length === 0) continue
    return { members, declStart: match.index, declEnd: close + 1 }
  }
  return null
}

function matchClosingBracket(text, open) {
  let depth = 0
  let inString = null
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    const prev = text[i - 1]
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** 把名单自身的声明块换成等长空白(保持行号,便于报告指回原位)。 */
export function stripDeclaration(text, declStart, declEnd) {
  const slice = text.slice(declStart, declEnd)
  return text.slice(0, declStart) + slice.replace(/[^\n]/g, ' ') + text.slice(declEnd)
}

/** JSON 台账里的 roots 汇总(守门 107)。解析失败返回 null,不返回空数组。 */
export function extractJsonRoots(parsed, pick) {
  if (!parsed || typeof parsed !== 'object') return null
  const entries = Array.isArray(parsed.entries) ? parsed.entries : null
  if (!entries) return null
  const values = []
  for (const entry of entries) {
    const raw = entry?.[pick]
    if (Array.isArray(raw)) values.push(...raw.filter((v) => typeof v === 'string' && v.length > 0))
  }
  return values.length > 0 ? [...new Set(values)] : null
}

/** 本档里这张名单是否被当过输入。返回用到的成员 + 是否靠遍历证据。 */
export function findProof(members, listName, proofTexts) {
  const used = []
  let viaIteration = false
  for (const { path, text } of proofTexts) {
    if (typeof text !== 'string') continue
    for (const member of members) {
      const quoted = [`'${member}'`, `"${member}"`, `\`${member}\``]
      if (quoted.some((q) => text.includes(q)) && !used.includes(member)) used.push(member)
    }
    const re = iterationRegex(listName)
    if (re.test(text)) viaIteration = true
    if (used.length > 0 || viaIteration) return { path, used, viaIteration }
  }
  return { path: null, used, viaIteration }
}

/**
 * 逐条判定。
 * 返回 status: 'proven' | 'unproven'(=红) | 'undetermined'(=只报数,永不判红)
 */
export function judgeEntry(entry, readText, readJson) {
  let members = []
  let decl = null
  if (entry.list.kind === 'js') {
    const text = readText(entry.list.file)
    if (typeof text !== 'string') {
      return { status: 'undetermined', why: `名单源在本档取不到:${entry.list.file}` }
    }
    decl = extractJsList(text, entry.list.name)
    if (!decl) {
      return {
        status: 'undetermined',
        why: `名单 ${entry.list.name} 解析不出成员(${entry.list.file})`,
      }
    }
    members = decl.members
  } else {
    const collected = []
    const missedFiles = []
    for (const file of entry.list.files) {
      const parsed = readJson(file)
      if (parsed === null) {
        missedFiles.push(file)
        continue
      }
      const roots = extractJsonRoots(parsed, entry.list.pick)
      if (roots) collected.push(...roots)
    }
    if (collected.length === 0) {
      return {
        status: 'undetermined',
        why: `roots 取不到成员${missedFiles.length ? `(缺文件:${missedFiles.join(', ')})` : ''}`,
      }
    }
    members = [...new Set(collected)]
  }

  // 取证面:名单所在的那份文件要**先剥掉名单自身的声明块**,否则声明即"证据"。
  const proofTexts = []
  const unreadable = []
  for (const path of entry.proofs) {
    let text = readText(path)
    if (typeof text !== 'string') {
      unreadable.push(path)
      continue
    }
    if (decl && path === entry.list.file)
      text = stripDeclaration(text, decl.declStart, decl.declEnd)
    proofTexts.push({ path, text })
  }
  if (proofTexts.length === 0) {
    return { status: 'undetermined', why: `取证文件在本档全部取不到:${unreadable.join(', ')}` }
  }

  const listName = entry.list.kind === 'js' ? entry.list.name : 'roots'
  const proof = findProof(members, listName, proofTexts)
  if (proof.used.length > 0 || proof.viaIteration) {
    return {
      status: 'proven',
      memberCount: members.length,
      via:
        proof.used.length > 0 ? `成员字面量(${proof.used.slice(0, 3).join(', ')})` : '名单遍历语境',
      members: members.length,
    }
  }
  return {
    status: 'unproven',
    why: `${members.length} 个成员在取证面(${entry.proofs.join(' / ')})里一次都没作为输入出现`,
    memberCount: members.length,
  }
}

/** 主判定:对给定取材函数跑完整张登记表。纯函数,取证与 self-test 共用。 */
export function judgeAll(registry, readText, readJson) {
  const rows = []
  for (const entry of registry) {
    rows.push({ id: entry.id, title: entry.title, ...judgeEntry(entry, readText, readJson) })
  }
  return rows
}

function makeReaders(root, face, paths) {
  const cache = new Map()
  if (face === 'worktree') {
    for (const p of paths) {
      try {
        cache.set(p, readWorktreeFile(root, p))
      } catch {
        cache.set(p, null)
      }
    }
  } else {
    const rev = face === 'staged' ? '' : 'HEAD'
    const specs = paths.map((p) => `${rev}:${p}`)
    const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
    paths.forEach((p, i) => cache.set(p, got.get(specs[i]) ?? null))
  }
  const readText = (p) => cache.get(p) ?? null
  const readJson = (p) => {
    const text = readText(p)
    if (typeof text !== 'string') return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return { readText, readJson }
}

function registryPaths(registry) {
  const paths = new Set()
  for (const entry of registry) {
    if (entry.list.kind === 'js') paths.add(entry.list.file)
    else for (const f of entry.list.files) paths.add(f)
    for (const p of entry.proofs) paths.add(p)
  }
  return [...paths]
}

export async function main(argv) {
  if (argv.includes('--self-test')) return runSelfTest()

  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定:${error}`)
    return 2
  }

  try {
    assertRepoRoot(ROOT, '名单正向证明对账')
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }

  const paths = registryPaths(REGISTRY)
  let current
  try {
    const readers = makeReaders(ROOT, face, paths)
    current = judgeAll(REGISTRY, readers.readText, readers.readJson)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(取材失败,不记绿也不记红):${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e?.message ?? e}`)
    return 2
  }
  if (current.length === 0) {
    console.error('❌ 无法判定:登记表为空 —— 空扫正是本门要防的那一型')
    return 2
  }

  // 棘轮:staged 档只拦"HEAD 不红而索引红"的条目(与改动无关的红只会逼人跳门)。
  let headUnproven = new Set()
  if (face === 'staged') {
    try {
      const headReaders = makeReaders(ROOT, 'head', paths)
      headUnproven = new Set(
        judgeAll(REGISTRY, headReaders.readText, headReaders.readJson)
          .filter((row) => row.status === 'unproven')
          .map((row) => row.id),
      )
    } catch {
      headUnproven = new Set()
    }
  }

  const proven = current.filter((r) => r.status === 'proven')
  const undetermined = current.filter((r) => r.status === 'undetermined')
  const blocking = current.filter(
    (r) => r.status === 'unproven' && !(face === 'staged' && headUnproven.has(r.id)),
  )
  const ratcheted = current.filter(
    (r) => r.status === 'unproven' && face === 'staged' && headUnproven.has(r.id),
  )

  console.log(`名单正向证明对账 · 取材面=${face}`)
  console.log(
    `  登记 ${current.length} 条 · 有正向证明 ${proven.length} · 未判定 ${undetermined.length}`,
  )
  for (const row of proven) console.log(`  ✅ ${row.id}(成员 ${row.members} 个;证据:${row.via})`)
  for (const row of undetermined) console.log(`  ⚪ ${row.id}:未判定 —— ${row.why}`)
  for (const row of ratcheted) console.log(`  ⚠️ ${row.id}:HEAD 已红(存量,本门不追)—— ${row.why}`)

  if (blocking.length === 0) {
    console.log(`结论:通过(判红 ${blocking.length} 条)`)
    return 0
  }
  console.error(`❌ 检出 ${blocking.length} 条名单从未被当作输入用过:`)
  for (const row of blocking) console.error(`  ${row.id}(${row.title})—— ${row.why}`)
  console.error('\n修法:在该判据的 --self-test 或镜像测试里,把名单的**某个成员值**当一次断言输入。')
  console.error('      这不是仪式:一张没人当输入用过的表,删空它不会有任何一道门变红。')
  return 1
}

/**
 * 取证:纯函数 + 构造面,**不依赖仓库瞬时状态**(守门 103 的教训:拿真仓当夹具,
 * 别人的一次改动就能让一条"证明"永远不再证明任何事)。
 */
function runSelfTest() {
  const results = []
  const t = (name, pass, note = '') => results.push({ name, pass, note })

  const LIST = `export const DENIED = [\n  'a-alpha',\n  'b-beta',\n] as const\n`
  const read = (map) => (p) => map.get(p) ?? null
  const readJson = (map) => (p) => {
    const s = map.get(p)
    if (typeof s !== 'string') return null
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  const jsEntry = (proofs) => ({
    id: 'x',
    title: 'x',
    list: { kind: 'js', file: 'list.js', name: 'DENIED' },
    proofs,
  })

  // 1 正向:成员字面量出现在取证文件里
  const m1 = new Map([
    ['list.js', LIST],
    ['t.mjs', "expect(isDenied('a-alpha')).toBe(true)"],
  ])
  t(
    '1 成员字面量命中 ⇒ proven',
    judgeEntry(jsEntry(['t.mjs']), read(m1), readJson(m1)).status === 'proven',
  )

  // 2 反向:名单完好但从没被当输入 ⇒ unproven(本门的核心红点)
  const m2 = new Map([
    ['list.js', LIST],
    ['t.mjs', 'expect(1).toBe(1)'],
  ])
  t(
    '2 名单从未当输入 ⇒ unproven',
    judgeEntry(jsEntry(['t.mjs']), read(m2), readJson(m2)).status === 'unproven',
  )

  // 3 **防伪绿**:唯一的"证据"就是名单自己的声明行 ⇒ 必须判 unproven
  const m3 = new Map([['list.js', LIST + '\n// 没有任何 self-test\n']])
  t(
    '3 声明块自身不得充当证据 ⇒ unproven',
    judgeEntry(jsEntry(['list.js']), read(m3), readJson(m3)).status === 'unproven',
  )

  // 3b 对照:同一文件、声明块之外真用了一次 ⇒ proven(证明 3 不是恒红)
  const m3b = new Map([['list.js', LIST + "\nassert(has('b-beta'))\n"]])
  t(
    '3b 声明外真用一次 ⇒ proven(反向对照)',
    judgeEntry(jsEntry(['list.js']), read(m3b), readJson(m3b)).status === 'proven',
  )

  // 4 遍历语境也算(名单标识符被 for..of 消费)
  const m4 = new Map([
    ['list.js', LIST],
    ['t.mjs', 'for (const v of DENIED) expect(fn(v)).toBe(true)'],
  ])
  t(
    '4 遍历名单 ⇒ proven',
    judgeEntry(jsEntry(['t.mjs']), read(m4), readJson(m4)).status === 'proven',
  )

  // 4b 反向对照:只 import 名字、不遍历 ⇒ 不得算证明
  const m4b = new Map([
    ['list.js', LIST],
    ['t.mjs', "import { DENIED } from './list.js'; expect(1).toBe(1)"],
  ])
  t(
    '4b 仅 import 不消费 ⇒ unproven(反向对照)',
    judgeEntry(jsEntry(['t.mjs']), read(m4b), readJson(m4b)).status === 'unproven',
  )

  // 5 名单源取不到 ⇒ undetermined,绝不冒红
  const m5 = new Map([['t.mjs', 'anything']])
  const r5 = judgeEntry(jsEntry(['t.mjs']), read(m5), readJson(m5))
  t('5 名单源缺失 ⇒ undetermined(不判红)', r5.status === 'undetermined', r5.why)

  // 6 取证文件全取不到 ⇒ undetermined
  const m6 = new Map([['list.js', LIST]])
  t(
    '6 取证文件缺失 ⇒ undetermined',
    judgeEntry(jsEntry(['gone.mjs']), read(m6), readJson(m6)).status === 'undetermined',
  )

  // 7 名单解析不出成员(被改名)⇒ undetermined,不是"空名单所以没人用"
  const m7 = new Map([
    ['list.js', "export const RENAMED = ['a']\n"],
    ['t.mjs', 'x'],
  ])
  t(
    '7 名单改名 ⇒ undetermined(判据失明要喊,不能判红)',
    judgeEntry(jsEntry(['t.mjs']), read(m7), readJson(m7)).status === 'undetermined',
  )

  // 8 JSON 台账 roots
  const jsonEntry = {
    id: 'j',
    title: 'j',
    list: { kind: 'json', files: ['a.json'], pick: 'roots' },
    proofs: ['t.mjs'],
  }
  const m8 = new Map([
    ['a.json', JSON.stringify({ entries: [{ roots: ['apps/web/public/x'] }] })],
    ['t.mjs', "expect(roots).toContain('apps/web/public/x')"],
  ])
  t('8 JSON roots 命中 ⇒ proven', judgeEntry(jsonEntry, read(m8), readJson(m8)).status === 'proven')

  const m8b = new Map([
    ['a.json', JSON.stringify({ entries: [{ roots: ['apps/web/public/x'] }] })],
    ['t.mjs', 'expect(1).toBe(1)'],
  ])
  t(
    '8b JSON roots 未当输入 ⇒ unproven(反向对照)',
    judgeEntry(jsonEntry, read(m8b), readJson(m8b)).status === 'unproven',
  )

  // 9 判据自身的活性锁:三种真写法各须匹配 —— 首版把方向写反过。
  t(
    '9 A 式 `for..of LIST` 必须匹配(判据活性锁)',
    iterationRegex('DENIED').test('for (const v of DENIED) expect(fn(v)).toBe(true)') === true,
  )
  t(
    '9b B 式 `LIST.some(..)`(名单是接收者)必须匹配 —— 方向写反即红',
    iterationRegex('DENIED').test('DENIED.some((v) => check(v))') === true,
  )
  t(
    '9c C 式 `[...LIST]` 展开必须匹配',
    iterationRegex('DENIED').test('const all = [...DENIED]') === true,
  )
  t(
    '9d 只 import 名字 / 只测表长度 都不算证明(反向锁,防判据过宽)',
    !iterationRegex('DENIED').test("import { DENIED } from './x'") &&
      !iterationRegex('DENIED').test('expect(DENIED).toHaveLength(3)'),
  )

  const failed = results.filter((r) => !r.pass)
  for (const r of results)
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.note ? ` — ${r.note}` : ''}`)
  console.log(`\n--self-test:${results.length} 条断言,失败 ${failed.length} 条`)
  return failed.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  REGISTRY,
  extractJsList,
  extractJsonRoots,
  stripDeclaration,
  iterationRegex,
  findProof,
  judgeEntry,
  judgeAll,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
