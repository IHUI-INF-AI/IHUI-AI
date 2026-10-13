#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816012:错误归因唯一出口的对账门(本票**不**接 guardian-runner 注册,注册由主会话单做)。
//
// 背景:上游把 `message.includes(` 散在 40 处是反面教材;我方票面存量 6 处(实测 = 5 处判定
// + token-manager.ts:295 一处反写法注释)+ 可选链同形 2 处,已在同批收进
// packages/shared/src/utils/error-attribution.ts。这道门管的是"下一个人不再抄第七份"。
//
// 三条判据(--self-test 里各有成对夹具,少任一条这道门就是造跳门机):
//   ① 反第二份 —— 生产面(排除 test/spec/e2e、排除出口自身)出现 `.message.includes(` /
//      `.message?.includes(` 形态的错误文本判定 ⇒ 判红,逐条报 file:line:col 与**原文**片段。
//      不设棘轮:本票同批把存量清零,此后任何一处即红。
//   ② 引用出口 —— 调用 `attributeError(` 的生产文件必须从唯一出口导入;出口文件必须真的导出
//      `attributeError`;且至少有一个**端外**生产消费者(只有 barrel re-export 不算消费者 ——
//      G-816009 那一课:出口零消费者 = 判据挂在半空,门只判了纯形状)。
//   ③ 反向锁 —— 站点键 = 文件 + 行 + 列 + 该处**原文**片段,绝不按文本归并、也绝不按归因结果 /
//      规则归并:同一行两个不同文本 = 两个站点('超时' 与 'timeout' 是同一规则的两个 needle,
//      但它们是两处判定);同一文本出现在两处 = 两个站点。按归因结果去重会把第二处违规抹平。
//
// 遮罩:判定在 `maskCommentsStringsAndRegex` 遮罩面上跑 —— 注释与字符串里的该形态不是判定
// (token-manager.ts:295 那行注释**禁止**的就是这个写法,门若咬它就是判自己的散文,守门 131 同型)。
//
// 已知边界(点名,不静默,两条都不得把本门的绿读成那一族也守住了):
//   (a) 裸标识 `message.includes(…)` 与"别名洗一层"不在射程 —— 同名不同义的 3 处现量
//       与已知盲区逐条点名见 PATTERNS 处的注释(强判它们 = 红在非归因代码上,是判据错了);
//   (b) 本门只判 includes 形态。`.message.startsWith(` 形态现存量 3 处
//       —— apps/api/src/services/wechat-pay.ts:395 与 apps/cli/src/tools/subagent.ts:553 是
//       "自造哨兵前缀判身份"(正确修法是 typed error class,另计),apps/web 下
//       AgentCanvasClient.tsx:198 是日志行过滤(不是错误归因)。这三处不在本门射程。
//
// 判定面沿用守门口径:全量档判 HEAD blob,--staged 判索引 blob,--worktree 只作人工逃生舱。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskComments, maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const EXIT_FILE = 'packages/shared/src/utils/error-attribution.ts'
/** barrel 只转发不消费:它不算出口的生产消费者(否则"只有转发"会被读成已接线) */
const BARREL_FILE = 'packages/shared/src/utils/index.ts'
const EXIT_EXPORT_RE = /export function attributeError\b/
/** 只认**本票出口**的包路径:apps/web 另有同名的 lib/error-attribution.ts(既有分桶求解器),
 *  宽松按尾名匹配会把它的 importer 数成出口消费者 —— 假消费者 = "零消费者"判据被假绿顶掉。 */
const EXIT_SPECIFIER_RE = /['"]@ihui\/shared\/utils\/error-attribution(\.js)?['"]/
const CALL_RE = /\battributeError\s*\(/
const LOCAL_DEF_RE = /\bfunction\s+attributeError\s*\(|\bconst\s+attributeError\s*=/

const GIT_TIMEOUT = 60_000
const SELF_EXEMPT = [
  'scripts/check-error-attribution-single-source.mjs',
  'scripts/tests/check-error-attribution-single-source',
]
const SCAN_DIRS = ['apps', 'packages']
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const TEST_PATH_RE = /(^|\/)(tests|__tests__|e2e|test)\//

/**
 * 形态清单:**票面形态** = 属性访问 `.message.includes(` / `.message?.includes(`
 * (`git grep -nE "\.message\.includes\("` 同款),可选链与否是同一形态的两种书写 ——
 * 只判其中一种等于给抄法留后门。
 *
 * 形态边界(点名,不静默 —— 窄一格是判据正确性的代价,不是放水):
 *   · 裸标识 `message.includes(…)` 不判:仓内现有 3 处全是**同名不同义**
 *     (rules-service.ts:750 对聊天输入做关键词匹配、fetch-url-egress.ts:207 做脱敏改写、
 *      points-mall-user.ts:141 把 `(e as Error).message` 赋给局部变量再判)——
 *     文本上无法与"错误对象取 message 判成因"区分,强判必然红在非归因代码上;
 *     别名洗一层(`const m = e.message; m.includes(…)`)同样逃逸,这一格是**已知盲区**,
 *     --self-test 里有负例把边界钉住(改宽前会先红在那里,提醒改的人连带清点存量)。
 *   startsWith/match 族的边界另见文件头。
 */
const PATTERNS = [
  { why: '.message.includes(', re: /\.message\s*\.\s*includes\s*\(/g },
  { why: '.message?.includes(', re: /\.message\s*\?\.\s*includes\s*\(/g },
]

/**
 * 逐处判定:**按出现次数**记站点(③ 反向锁的载体)。
 * 原文片段从 rawLine 按列位切 —— 遮罩等长,所以列位在两把面上通用;只报遮罩面会把
 * `'超时'` 与 `'timeout'` 报成两个一样的空白片段,读的人无从分辨两条是不是同一规则。
 * 片段右界按**配对括号**扫到实参末尾(遮罩面上字符串体等长填白,括号配对不漂),
 * 所以 `message.includes('超时')` 与 `message.includes('timeout')` 是两段可分辨的原文;
 * 括号不配对时退回匹配本体长度(宁可短,不可越行错切)。
 */
function spanEnd(maskedLine, start, fallbackLen) {
  let depth = 0
  for (let i = start; i < maskedLine.length; i++) {
    const ch = maskedLine[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return i + 1
    } else if (ch === ';' && depth === 0) break
  }
  return start + fallbackLen
}

function findSites(text) {
  const maskedLines = maskCommentsStringsAndRegex(text).split('\n')
  const rawLines = text.split('\n')
  const out = []
  for (let i = 0; i < maskedLines.length; i++) {
    const maskedLine = maskedLines[i]
    for (const { why, re } of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(maskedLine)) !== null) {
        const end = spanEnd(maskedLine, m.index, m[0].length)
        out.push({
          line: i + 1,
          col: m.index + 1,
          why,
          text: rawLines[i].slice(m.index, end),
          excerpt: rawLines[i].trim().slice(0, 90),
        })
        re.lastIndex = Math.max(end, m.index + m[0].length)
        if (m[0].length === 0) re.lastIndex += 1
      }
    }
  }
  return out
}

function isSelfExempt(rel) {
  const norm = rel.split(path.sep).join('/')
  return SELF_EXEMPT.some((p) => norm === p || norm.startsWith(p))
}

/** 取景:扩展名 + 测试面排除 + 出口自身 + 门自身(判定函数只吃 contents,取景口径必须与真面同一条) */
function scanSet(contents) {
  return Object.keys(contents).filter((rel) => {
    if (!SRC_EXT.test(rel)) return false
    if (TEST_PATH_RE.test(rel)) return false
    if (rel === EXIT_FILE) return false
    if (isSelfExempt(rel)) return false
    return true
  })
}

/**
 * 纯判据:输入 = {rel: text},输出 = 三判据的全部读数。
 * 盲区(exitExports:false / consumers:0)**一定**参与退出码 —— 只打印不改退出码 = 下一次没人看。
 */
function decide({ contents }) {
  const exitText = contents[EXIT_FILE]
  const exitPresent = typeof exitText === 'string'
  const exitExports = exitPresent && EXIT_EXPORT_RE.test(maskCommentsStringsAndRegex(exitText))
  const sites = []
  const defFiles = []
  const callFiles = []
  const unwired = []
  const importers = []
  let scanned = 0
  for (const rel of scanSet(contents)) {
    scanned += 1
    const masked = maskCommentsStringsAndRegex(contents[rel])
    // 导入语句的 specifier **就是字符串字面量**:在"抹字符串面"上永远看不见它 ⇒
    // 出口引用判定走"只遮注释面"(字符串逐字保留),否则 importer 全体被误报未接线。
    const codeFace = maskComments(contents[rel])
    if (LOCAL_DEF_RE.test(masked)) defFiles.push(rel)
    const importsExit = EXIT_SPECIFIER_RE.test(codeFace)
    if (importsExit) importers.push(rel)
    if (CALL_RE.test(masked)) {
      callFiles.push(rel)
      if (!importsExit) unwired.push(rel)
    }
    for (const hit of findSites(contents[rel])) sites.push({ file: rel, ...hit })
  }
  // 出口的"端外生产消费者":barrel 只转发不算;出口文件自身更不算
  const consumers = importers.filter((f) => f !== BARREL_FILE)
  const reds = [
    ...sites.map((s) => ({ kind: 'inline-text-judgment', ...s })),
    ...defFiles.map((f) => ({ kind: 'second-definition', file: f, line: null, text: '' })),
    ...unwired.map((f) => ({ kind: 'call-without-import', file: f, line: null, text: '' })),
  ]
  const blind = !exitExports
  const deadExit = !blind && consumers.length === 0
  return {
    blind,
    exitPresent,
    exitExports,
    scanned,
    sites,
    defFiles,
    callFiles,
    unwired,
    consumers,
    reds,
    deadExit,
  }
}

/** 清单与内容同面同轮:HEAD 档 ls-tree;staged 档按**索引全量**枚举(只列变更文件会让
 *  无关提交在 staged 档被误判成"出口零消费者"—— 那是清单面与内容面错位造出来的假红);
 *  worktree 档额外带 `--others --exclude-standard`:出口本票新建、可能尚未 add,
 *  不枚举未跟踪文件会把"出口在盘上"读成"出口不在面上"的假失明。 */
function listCandidates(face) {
  const out = new Set()
  for (const dir of SCAN_DIRS) {
    const args =
      face === 'head'
        ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', dir]
        : face === 'worktree'
          ? ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', dir]
          : ['ls-files', '-z', '--', dir]
    const raw = gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
    if (typeof raw !== 'string') throw new Undetermined(`清单枚举失败:${dir}`)
    for (const p of raw.split('\0')) {
      if (!p) continue
      if (!SRC_EXT.test(p)) continue
      if (TEST_PATH_RE.test(p)) continue
      if (isSelfExempt(p)) continue
      out.add(p)
    }
  }
  return [...out]
}

function readFace(face) {
  const paths = listCandidates(face)
  if (paths.length === 0)
    throw new Undetermined(`枚举到 0 个源码文件(${SCAN_DIRS.join(', ')})—— 空扫不记绿`)
  const contents = {}
  const missing = []
  const note = (p) => missing.push(p)
  if (face === 'worktree') {
    for (const p of paths) {
      const text = readWorktreeFile(ROOT, p)
      if (typeof text !== 'string') note(p)
      else contents[p] = text
    }
  } else {
    // staged 档前缀空串 ⇒ `:path` 读**索引 blob**;head 档 `HEAD:path`。
    // (写成 `${prefix}${p}` 会让 staged 档退化成裸路径 —— cat-file 认不出对象名,整面取空。)
    const prefix = face === 'staged' ? '' : 'HEAD'
    const specs = paths.map((p) => `${prefix}:${p}`)
    const got = catBatch(ROOT, specs, { timeout: 120_000 })
    for (let i = 0; i < paths.length; i++) {
      const text = got.get(specs[i])
      if (typeof text !== 'string') note(paths[i])
      else contents[paths[i]] = text
    }
  }
  // 出口文件在该面不存在(如 HEAD 档早于本票提交)是**可判的红**(decide 报 blind),
  // 不是无法判定;其余任何文件取不到都不得记绿。
  const realMissing = missing.filter((p) => p !== EXIT_FILE)
  if (realMissing.length > 0) {
    throw new Undetermined(`内容取不到 ${realMissing.length} 个文件,首个:${realMissing[0]}`)
  }
  return contents
}

function main(argv) {
  const json = argv.includes('--json')
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  const face = picked.face
  try {
    const contents = readFace(face)
    const res = decide({ contents })
    if (res.scanned === 0) throw new Undetermined('扫描面为空(空扫不记绿)')
    if (json) {
      console.log(JSON.stringify({ face, ...res }, null, 2))
    } else {
      console.log(`判定面 = ${face} · 扫描 ${res.scanned} 文件 · 出口 = ${EXIT_FILE}`)
      console.log(
        `EA0 出口在位:${
          res.blind
            ? res.exitPresent
              ? '❌ 出口文件在而 attributeError 导出被摘 ⇒ 本门对"第二份真相"整族失明'
              : '❌ 出口文件不在面上 ⇒ 本门对"第二份真相"整族失明'
            : '在位且仍导出 attributeError'
        }`,
      )
      console.log(
        `EA1 反第二份:站点 = ${res.sites.length} 处 / ${new Set(res.sites.map((s) => s.file)).size} 文件`,
      )
      for (const s of res.sites)
        console.log(`  ✗ ${s.file}:${s.line}:${s.col} [${s.why}] ${s.text} :: ${s.excerpt}`)
      console.log(
        `EA2 引用出口:调用 attributeError 的文件 = ${res.callFiles.length} / 未接线 = ${res.unwired.length} / 第二份定义 = ${res.defFiles.length} / 出口生产消费者 = ${res.consumers.length}${
          res.deadExit ? ' ❌(只有 barrel 转发或零消费者 ⇒ 判据挂在半空)' : ''
        }`,
      )
      console.log(
        res.blind || res.deadExit || res.reds.length > 0
          ? `结论:判红 ${res.reds.length} 处 + ${res.blind ? '出口失明' : ''}${res.deadExit ? ' 出口零消费者' : ''} —— 错误归因的唯一出口是 ${EXIT_FILE},请改为 import`
          : '结论:通过(生产面 0 处内联错误文本判定,调用点全部走唯一出口)',
      )
    }
    return res.blind || res.deadExit || res.reds.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(不记为通过):${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e && e.stack ? e.stack : e}`)
    return 2
  }
}

/** 构造面自检:判据有牙只能用"它应当红的夹具"证明,不能只看它此刻的颜色 */
function selfTest() {
  const results = []
  // 判据:cond 必须是已求值布尔(函数对象恒 truthy ⇒ 断言从未求值)
  const t = (name, cond) =>
    results.push({ name, ok: cond === true, isFn: typeof cond === 'function' })

  const EXIT_SRC = `// 唯一出口(夹具)
const NEEDLES = ['未配置']
export function attributeError(err) {
  if (typeof err?.message === 'string' && err.message.includes(NEEDLES[0])) {
    return { errorSource: 'config', failureReason: 'not-configured', ruleId: 'config.missing', attributed: true }
  }
  return { errorSource: 'unknown', failureReason: 'unattributed', ruleId: 'unattributed', attributed: false }
}
`
  const IMPORTING = `import { attributeError } from '@ihui/shared/utils/error-attribution'\nexport const f = (e) => attributeError(e)\n`
  const CLEAN = 'export const g = (e) => 1\n'
  const base = { [EXIT_FILE]: EXIT_SRC, 'apps/x/consumer.ts': IMPORTING }
  const V1 = "export const h = (e) => e.message.includes('boom')"
  const V2 = "export const h = (e) => e.message?.includes('boom')"

  // —— 判据②正向:各处引用出口 ⇒ 绿 ——
  const green = decide({ contents: { ...base, 'apps/x/clean.ts': CLEAN } })
  t(
    '② 各处引用出口 ⇒ 绿(sites 0 / 不失明 / 不挂空)',
    (() => {
      return (
        green.reds.length === 0 &&
        green.blind === false &&
        green.deadExit === false &&
        green.consumers.length === 1
      )
    })(),
  )

  // —— 判据①正向:抄第二份 ⇒ 红 ——
  const copy1 = decide({ contents: { ...base, 'apps/x/copy.ts': V1 } })
  t(
    '① 抄 .message.includes( 第二份 ⇒ 红',
    copy1.reds.length === 1 && copy1.reds[0].file === 'apps/x/copy.ts',
  )
  const copy2 = decide({ contents: { ...base, 'apps/x/copy.ts': V2 } })
  t('① 抄 .message?.includes( 同样红(可选链不是豁免形态)', copy2.reds.length === 1)

  // —— 判据③反向锁:不同错误文本不得被读成重复规则 ——
  const twoTexts = decide({
    contents: {
      ...base,
      'apps/x/timeout.ts':
        "export const h = (e) => e.message.includes('超时') || e.message.includes('timeout')",
    },
  })
  t(
    '③ 同一行两个不同文本 = 两个站点(不按文本归并)',
    (() => {
      return (
        twoTexts.sites.length === 2 &&
        twoTexts.sites[0].text !== twoTexts.sites[1].text &&
        twoTexts.sites[0].col !== twoTexts.sites[1].col
      )
    })(),
  )
  t(
    '③ 两个站点各自的原文片段可分辨(遮罩面留列位)',
    (() => {
      return (
        twoTexts.sites[0].text.includes("'超时'") && twoTexts.sites[1].text.includes("'timeout'")
      )
    })(),
  )
  const sameTextTwoFiles = decide({
    contents: { ...base, 'apps/x/a.ts': V1, 'apps/y/b.ts': V1 },
  })
  t('③ 同一文本出现在两处 = 两个站点(不按规则归并)', sameTextTwoFiles.sites.length === 2)

  // —— 注释与字符串里的该形态不得判成站点(门不得判自己的散文)——
  const commentCase = decide({
    contents: {
      ...base,
      'apps/x/doc.ts': '// 调用点不许再写 `err.message.includes(...)`\nexport const a = 1\n',
    },
  })
  t('注释里的形态不得计入(token-manager.ts:295 同型)', commentCase.sites.length === 0)
  const blockCommentCase = decide({
    contents: {
      ...base,
      'apps/x/doc2.ts':
        "/**\n * 旧写法 err.message.includes('x') 已收口\n */\nexport const a = 1\n",
    },
  })
  t('块注释里的形态不得计入', blockCommentCase.sites.length === 0)
  const stringCase = decide({
    contents: {
      ...base,
      'apps/x/doc3.ts': 'export const doc = "e.message.includes(\'x\') 是旧形态"\n',
    },
  })
  t('字符串字面量里的形态不得计入', stringCase.sites.length === 0)

  // —— 形态边界:负例把"不判什么"钉住,防止下一手顺手放宽形态却不清点存量 ——
  const bareForm = decide({
    contents: {
      ...base,
      'apps/x/bare.ts': "export const k = (message: string) => message.includes('关键词')\n",
    },
  })
  t(
    '边界:裸标识 message.includes( 不判(rules-service.ts:750 同名不同义)',
    bareForm.sites.length === 0,
  )
  const aliasLaunder = decide({
    contents: {
      ...base,
      'apps/x/alias.ts':
        "export const k = (e: Error) => {\n  const m = e.message\n  return m.includes('x')\n}\n",
    },
  })
  t(
    '边界(已知盲区,点名不静默):别名洗一层不判 —— 想改宽形态先清点存量',
    aliasLaunder.sites.length === 0,
  )

  // —— 假消费者:apps/web 另有同名 lib/error-attribution.ts,它的 importer 不是本票出口的消费者 ——
  const foreign = decide({
    contents: {
      [EXIT_FILE]: EXIT_SRC,
      'apps/web/src/lib/other.ts':
        "import { resolveErrorAttribution } from './error-attribution'\nexport const x = resolveErrorAttribution\n",
    },
  })
  t(
    '同名他模块的 importer 不得数成出口消费者(假消费者 = 假绿)',
    (() => {
      return foreign.consumers.length === 0 && foreign.deadExit === true
    })(),
  )

  // —— 取景:测试面 / 门自身 / 出口自身 ——
  const testFace = decide({
    contents: { ...base, 'apps/x/tests/copy.ts': V1, 'apps/y/__tests__/copy.ts': V1 },
  })
  t('test/spec/e2e 面不参与判定', testFace.sites.length === 0 && testFace.scanned === 1)
  const exitSelf = decide({ contents: { ...base, 'apps/x/clean.ts': CLEAN } })
  t('出口自身文件不计站点(它就是允许地)', exitSelf.sites.length === 0)

  // —— 判据②反向:出口被摘线的三种形态全部红 ——
  const noExit = decide({ contents: { 'apps/x/consumer.ts': IMPORTING } })
  t('出口整块不在面上 ⇒ 失明', noExit.blind === true && noExit.deadExit === false)
  const declGone = decide({
    contents: { [EXIT_FILE]: 'export const x = 1\n', 'apps/x/consumer.ts': IMPORTING },
  })
  t('出口在而 attributeError 导出被摘 ⇒ 仍判失明', declGone.blind === true)
  const deadExit = decide({
    contents: { [EXIT_FILE]: EXIT_SRC, [BARREL_FILE]: "export * from './error-attribution.js'\n" },
  })
  t('只有 barrel 转发、零端外消费者 ⇒ 判挂空', deadExit.deadExit === true)
  const secondDef = decide({
    contents: {
      ...base,
      'apps/x/shadow.ts': 'function attributeError(e) {\n  return e.message.includes("boom")\n}\n',
    },
  })
  t(
    '第二份定义 attributeError ⇒ 红并点名',
    secondDef.defFiles.length === 1 && secondDef.defFiles[0] === 'apps/x/shadow.ts',
  )
  const unwired = decide({
    contents: { ...base, 'apps/x/caller.ts': 'export const c = (e) => attributeError(e)\n' },
  })
  t('调用 attributeError 却不从出口导入 ⇒ 红(未接线/第二份实现)', unwired.unwired.length === 1)
  const barrelOnly = decide({
    contents: {
      [EXIT_FILE]: EXIT_SRC,
      [BARREL_FILE]: "export * from './error-attribution.js'\n",
      'apps/x/clean.ts': CLEAN,
    },
  })
  t('barrel 转发不算消费者(反向锁:②不许被"只有转发"骗绿)', barrelOnly.deadExit === true)

  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.isFn ? ' [cond 是函数 ⇒ 该断言从未求值]' : ''}`)
  }
  console.log(`--self-test 结果:${results.length - failed}/${results.length} 通过`)
  return failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const rc = argv.includes('--self-test') ? selfTest() : main(argv)
  process.exit(rc)
}

// 判据本体只有一份:这里导出的是判据本身(形态清单 / 逐处判定 / 裁定入口 / 取景谓词),
// 镜像测试若自己再写一遍正则或再写一遍取景口径,两边必然漂开(§22c)。
// 新增导出键**不改变任何判定行为**:下方 main()/selfTest() 用的仍是同一批函数与同一张 PATTERNS 表。
export const __test__ = {
  PATTERNS,
  findSites,
  decide,
  scanSet,
  EXIT_FILE,
  BARREL_FILE,
  SELF_EXEMPT,
  TEST_PATH_RE,
  SRC_EXT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
