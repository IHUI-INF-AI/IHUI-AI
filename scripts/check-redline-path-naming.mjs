#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 尺子为 CLI 工具,需 console 输出读数 */
/**
 * check-redline-path-naming.mjs — G-263 尺子:「判红行是否点名可命中路径」静态+动态两档
 *
 * 病理(台账 G-263 原文):归因铰链的第一态(点名 ⇒ 拒绝跳门)是最有牙的一态,但哪些门的
 * 红行**通篇不含仓根相对路径**只能逐门造真红才知道(159 道门 × 夹具,不在任何一票射程内)。
 * 真实事故载体:门 55 的红只打「覆盖率 86/87 + 未映射工具名(...)」,点名符号不点名文件,
 * 自引入的红被裁成 not-ours 放行跳门(留痕 ts=2026-09-27T09:05:40Z,27 分钟后由 fa9e4e64d 补)。
 *
 * 这把尺子回答的问题(逐门三档):
 *   names        —— 静态可见"铰链可认的结论行"里含可命中路径证据(字面相对路径 / 可判定为
 *                   路径的变量,含同文件常量一跳解析)。铰链第一态对该门**可达**。
 *   silent       —— 结论行枚举得全,且通篇没有任何路径证据。铰链第一态对该门**永不触发**,
 *                   该门的红只能走差分四态 —— 这就是要点名到门 id 的清单。
 *   undetermined —— 判不出(没有可识别的结论行形状 / 存在判不出的插值)。
 *                   **不得记绿**:既不记成"有牙",也不记成"无牙"。
 *
 * 与铰链的纪律关系(§22c 单一实现):
 *   - "长得像结论的行"判据 = lib/commit-gate-attribution.mjs 的 FINDING_LINE_RE(导入,不抄)。
 *   - 动态档的核对出口 = 同一份 findingLines() + lineNamesFile()(铰链自己怎么判,尺子就
 *     怎么判;抄第二份 = 必然漂移)。
 *   - **禁止**拿门 118(取材面纪律)扩面硬做 —— 它分不清"点名"与"措辞里提到文件"(G-263 原文)。
 *
 * 静态筛的已知盲区(如实登记,由动态档量准确率,不由静态自己声称):
 *   1. 缩进续行邻接:门 84 型(结论行无路径、下一缩进行有路径)靠"bullet 模板 + 可判定路径
 *      证据"计入 names,但**邻接未证**(静态看不出该行是否真跟在结论行后)—— 报告里单列标注。
 *   2. 经变量中转的文案:字符串先赋值再打印,静态只看字面量/模板/直接拼接(`+ f` 型已开
 *      concat-emit 通道,右操作数不可判 ⇒ 落 undetermined);多层中转仍可能漏(漏的方向是
 *      "少认 names",落 undetermined/silent,不造假绿 —— 造绿方向只有盲区 1)。
 *   3. 名字启发(`${file}` 判路径、`${name}` 判非路径)可能误判:动态档的职责就是量这个。
 *
 * 动态档(--probe):`git worktree add --detach` 建隔离面(与 safe-commit 基线面同一载体,
 * 理由同源:私有索引 GIT_INDEX_FILE 只改索引面、磁盘仍是本机在途内容,会喂假读数),
 * 在隔离面注入违规并**在隔离面内 commit**(detached,不触任何共享 ref),让默认 head 取材的
 * 门读到注入面;复跑该门,拿它**自己的真红输出**过铰链出口,核对静态档准确率。
 * 跑不通(缺 node_modules / spawn pnpm 型门)⇒ 如实报"未抽到",不计入准确率、不伪装。
 *
 * 用法:
 *   node scripts/check-redline-path-naming.mjs                 静态全量筛(head 面,人类可读)
 *   node scripts/check-redline-path-naming.mjs --json          同上,JSON(供台账/工具消费)
 *   node scripts/check-redline-path-naming.mjs --staged        读索引面(自测本票改动用)
 *   node scripts/check-redline-path-naming.mjs --worktree      读磁盘面(人工逃生舱)
 *   node scripts/check-redline-path-naming.mjs --probe[=id,..] 动态抽跑探针表并核对准确率
 *   node scripts/check-redline-path-naming.mjs --self-test     合成夹具端到端(不依赖真仓)
 *
 * 防腐烂(G-263 原文"清单进台账就要配防腐烂,参照守门 108 的到期档做法"):
 *   本尺子**不落清单文件** —— silent/undetermined 清单每次现算,腐烂在机制上不可能;
 *   台账只登记"再生成命令"。门 55 的点名证据由镜像测试 L3 钉住(它若退化回无路径红,测试即红)。
 *
 * 接线:**不接提交链** —— scripts/guardian-runner.mjs 此刻被 O81票⑰ 冻结(进行中@主会话),
 *   本工具只造尺子本体;注册与接线归冻结解除后的主会话。
 *
 * 退出码:0=读数完成(读数本身不是判红);1=尺子失效(全集为空/自检失败/探针基建不可用)。
 * 反假绿护栏:注册表解析到 0 条门 ⇒ 判"尺子失效"而非通过(与门 89 R9 同纪律)。
 * 自检:node scripts/check-redline-path-naming.mjs --self-test
 * 镜像:node --test scripts/tests/check-redline-path-naming.test.mjs
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { FINDING_LINE_RE, findingLines, lineNamesFile } from './lib/commit-gate-attribution.mjs'
import {
  catBatch,
  readWorktreeFile,
  selectFace,
  assertRepoRoot,
  gitBinary,
} from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(__dirname, '..')

// ─── 注册表解析(与 check-gate-wiring R9 同一套形状纪律)───────────────────
/**
 * 从 guardian-runner 正文抽 (id, script, mode) 三元组。
 * 纪律逐条对齐门 89 的 findAbsentGateScripts(它的教训都在注释里):
 *   - id 认引号与裸数字两形态(只认引号 ⇒ 合法注册表读成 0 条 = 假阳);
 *   - script 值必须在**属性位置**(行首/`{`/`,` 之后),否则被 `label: '…script: 说明…'`
 *     文案抢走 ⇒ 真注册行扫不到 = 假绿;
 *   - 注释行不算;值不是引号字面量 ⇒ 记 undeterminedValue,不猜。
 */
export function parseGateRegistry(runnerText) {
  const src = String(runnerText || '')
  const starts = [...src.matchAll(/\bid:\s*(?:'([^']+)'|"([^"]+)"|(\d+))/g)]
  const gates = []
  const undeterminedValue = []
  starts.forEach((m, i) => {
    const id = m[1] ?? m[2] ?? m[3]
    const body = src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length)
    const lines = body.split('\n')
    let script = null
    let mode = '?'
    // mode 先于 script 单独扫:真仓 runner 条目里 `script:` 行在 `mode:` 行**之前**,
    // 若找到 script 就 break 会永远读不到 mode(2026-09-28 真仓 184 条全落 '?' 实测)。
    for (const l of lines) {
      if (/^\s*(?:\/\/|\*|\/\*)/.test(l)) continue
      const mm = l.match(/(?:^|[,{])\s*mode:\s*'([^']+)'/)
      if (mm) {
        mode = mm[1]
        break
      }
    }
    for (let k = 0; k < lines.length; k++) {
      if (/^\s*(?:\/\/|\*|\/\*)/.test(lines[k])) continue
      const decl =
        k === 0
          ? lines[k].match(/(?:^|[,{])\s*script:\s*(.*)$/)
          : lines[k].match(/^\s*script:\s*(.*)$/)
      if (!decl) continue
      const asStr = decl[1].trim()
      const q = asStr.match(/^'([^']*)'/) || asStr.match(/^"([^"]*)"/)
      if (!q) {
        // 单行条目形态值带尾随标点(`script: VAR }`)—— 先剥掉再判"像变量"
        const asVal = asStr.replace(/[)\]},\s]+$/, '')
        if (/^[A-Za-z_$`]/.test(asVal) && !asVal.includes(' ') && !/^['"]/.test(asStr))
          undeterminedValue.push({ id, value: asVal.slice(0, 60) })
        continue
      }
      if (!/\.(?:mjs|cjs|js|ts)$/.test(q[1])) {
        undeterminedValue.push({ id, value: q[1] })
        continue
      }
      script = q[1]
      break
    }
    if (script) gates.push({ id, script, mode })
  })
  return { gates, undeterminedValue, registered: starts.length }
}

// ─── 字面量扫描器(跳注释/正则体,模板拆 text/expr)─────────────────────────
const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '~',
  '^',
  '%',
  '<',
  '>',
  '',
])
const REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
])

/**
 * 抽源码里的字符串/模板字面量,并产出一份"剥掉注释与正则体"的等长 code 文本
 * (拼接发射通道在它上面跑,否则散文里的 `console.log('x' + f)` 会被算成证据)。
 * 注释与正则体内的引号**不产字面量**
 * (门 131/70 的教训:把解释自己的散文判成违规 = 假阳;这里反向 —— 把散文里的 ❌+路径
 * 当成结论行模板同样是假阳)。
 */
export function extractLiterals(src) {
  const out = []
  const n = src.length
  let i = 0
  let prevChar = ''
  let prevWord = ''
  let line = 1
  const codeArr = src.split('')
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (codeArr[k] !== '\n') codeArr[k] = ' '
  }
  const mark = (chunk) => {
    line += chunk.split('\n').length - 1
  }
  while (i < n) {
    const c = src[i]
    if (c === '\n') {
      line++
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      let j = i + 2
      while (j < n && src[j] !== '\n') j++
      blank(i, j)
      mark(src.slice(i, j))
      i = j
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++
      j = Math.min(n, j + 2)
      blank(i, j)
      mark(src.slice(i, j))
      i = j
      continue
    }
    if (c === '/' && (REGEX_AFTER.has(prevChar) || REGEX_KEYWORDS.has(prevWord))) {
      let j = i + 1
      let inClass = false
      while (j < n) {
        const d = src[j]
        if (d === '\\') j += 2
        else if (d === '[') {
          inClass = true
          j++
        } else if (d === ']') {
          inClass = false
          j++
        } else if (d === '/' && !inClass) {
          j++
          break
        } else j++
      }
      while (j < n && /[a-z]/.test(src[j])) j++
      blank(i, j)
      mark(src.slice(i, j))
      i = j
      prevChar = ')'
      prevWord = ''
      continue
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      let val = ''
      while (j < n) {
        const d = src[j]
        if (d === '\\') {
          val += src.slice(j, j + 2)
          j += 2
          continue
        }
        if (d === c) {
          j++
          break
        }
        if (d === '\n') break // 未闭合(语法错的文件)—— 就地收口,不吞全文件
        val += d
        j++
      }
      out.push({ kind: 'str', value: val, line })
      mark(src.slice(i, j))
      i = j
      prevChar = "'"
      prevWord = ''
      continue
    }
    if (c === '`') {
      const { tpl, end, endLine } = readTemplate(src, i, line)
      out.push({ kind: 'tpl', ...tpl, line })
      i = end
      line = endLine
      prevChar = '`'
      prevWord = ''
      continue
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++
      prevWord = src.slice(i, j)
      prevChar = src[j - 1]
      i = j
      continue
    }
    // ⚠ 空白**不得**覆盖 prevChar:`const re = /x/g` 里 `/` 前是空格而非 `=`,
    // 覆盖后正则识别失效 ⇒ 正则体内的引号开成字符串态 ⇒ 整文件扫描错位
    // (2026-09-28 门 3 实测:候选集里出现 `"]/g for (const file...` 的代码碎片)。
    if (!/\s/.test(c)) {
      prevChar = c
      prevWord = ''
    }
    i++
  }
  return { literals: out, code: codeArr.join('') }
}

/** 模板字面量拆解:textParts(静态段)/ exprs(插值表达式原文)。嵌套引号与嵌套模板都跳过。 */
function readTemplate(src, start, startLine) {
  const n = src.length
  let i = start + 1
  let line = startLine
  const textParts = []
  const exprs = []
  let buf = ''
  while (i < n) {
    const c = src[i]
    if (c === '\n') {
      line++
      buf += c
      i++
      continue
    }
    if (c === '\\') {
      buf += src.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '`') {
      i++
      break
    }
    if (c === '$' && src[i + 1] === '{') {
      if (buf) textParts.push(buf)
      buf = ''
      i += 2
      let depth = 1
      let e = ''
      while (i < n && depth > 0) {
        const d = src[i]
        if (d === '\n') line++
        if (d === '{') {
          depth++
          e += d
          i++
          continue
        }
        if (d === '}') {
          depth--
          i++
          if (depth === 0) break
          e += '}'
          continue
        }
        if (d === "'" || d === '"') {
          const q = d
          e += d
          i++
          while (i < n && src[i] !== q) {
            if (src[i] === '\\') {
              e += src.slice(i, i + 2)
              i += 2
              continue
            }
            if (src[i] === '\n') line++
            e += src[i]
            i++
          }
          e += q
          i++
          continue
        }
        if (d === '`') {
          const inner = readTemplate(src, i, line)
          e += src.slice(i, inner.end)
          line = inner.endLine
          i = inner.end
          continue
        }
        e += d
        i++
      }
      exprs.push(e.replace(/\s+/g, ' ').trim())
      continue
    }
    buf += c
    i++
  }
  if (buf) textParts.push(buf)
  return { tpl: { textParts, exprs }, end: i, endLine: line }
}

// ─── 同文件常量一跳解析───────────────────────────────────────────────────
/**
 * `const X = '...'` / `const X = "..."` / `const X = \`...\`` /
 * `const X = (…) => \`...\`` —— 只收这四型(门 55 的 `${TOOL_DISPLAY_REL}` 与
 * `${sharedLocaleRel(lang)}` 正是前两型的真实组合;再多跳就进入"再造一台解释器"的射程,
 * 判不出的落 unknown 即可)。
 */
export function collectConsts(src) {
  const map = new Map()
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'([^'\n]*)'|"([^"\n]*)")/g,
  )) {
    map.set(m[1], { kind: 'str', value: m[2] ?? m[3] })
  }
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`]*)`/g,
  )) {
    if (!map.has(m[1])) {
      const t = readTemplate(`\`${m[2]}\``, 0, 1).tpl
      map.set(m[1], { kind: 'tpl', textParts: t.textParts, exprs: t.exprs })
    }
  }
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*`([^`]*)`/g,
  )) {
    if (!map.has(m[1])) {
      const t = readTemplate(`\`${m[2]}\``, 0, 1).tpl
      map.set(m[1], { kind: 'tpl', textParts: t.textParts, exprs: t.exprs })
    }
  }
  return map
}

// ─── 路径证据判据────────────────────────────────────────────────────────
/** 仓根相对路径字面:至少一段 `/` + 扩展名;或已知顶层目录前缀;或 Windows 绝对路径。 */
const PATH_LITERAL_RE =
  /(?:[A-Za-z0-9_.@+-]+[/\\]){1,}[A-Za-z0-9_.@+*-]+\.(?:[A-Za-z]{1,5})\b|(?:^|[\s'"`(,=:>])\.(?:github|husky)[/\\]|(?:^|[\s'"`(,=:>])(?:apps|packages|scripts|deploy|docs|tests|tools|config)[/\\]|[A-Za-z]:[/\\]/
const PATHISH_NAME_RE =
  /(?:^|[_$])(?:file|filepath|filename|path|paths|dir|src|source|dest|target|script|entry|rel|route|routes)(?:$|[_$])|(?:File|Path|Dir|Src|Source|Dest|Target|Script|Entry|Rel|Route)$|_(?:REL|PATH|FILE|SRC|TARGET|SCRIPT|ENTRY|ROUTE)$/
const NONPATH_NAMES = new Set([
  'count',
  'total',
  'num',
  'len',
  'length',
  'size',
  'mapped',
  'registered',
  'unmapped',
  'missing',
  'i',
  'j',
  'k',
  'n',
  'N',
  'id',
  'key',
  'keys',
  'name',
  'names',
  'lang',
  'langs',
  'symbol',
  'symbols',
  'tool',
  'tools',
  'value',
  'values',
  'msg',
  'message',
  'error',
  'err',
  'reason',
  'label',
  'sha',
  'hash',
  'version',
  'percent',
  'rate',
  'idx',
  'index',
  'face',
  'code',
  'status',
  'exit',
  'ts',
  'time',
  'date',
  'cost',
  'ms',
  'limit',
  'threshold',
  'min',
  'max',
  'avg',
  'sum',
  'diff',
  'line',
  'lines',
  'ok',
  'flag',
  'flags',
  'a',
  'b',
  'c',
  'x',
  'y',
  'z',
  'reasons',
  'violations',
  'problems',
])
const NONPATH_METHODS = new Set([
  'join',
  'split',
  'map',
  'filter',
  'sort',
  'reduce',
  'trim',
  'slice',
  'substring',
  'substr',
  'toUpperCase',
  'toLowerCase',
  'includes',
  'startsWith',
  'endsWith',
  'replace',
  'replaceAll',
  'test',
  'exec',
  'matchAll',
  'match',
  'stringify',
  'parse',
  'abs',
  'floor',
  'ceil',
  'round',
  'min',
  'max',
])
const PATH_CALL_RE = /^(?:path\.|posix\.)?(?:join|relative|resolve|normalize)\s*\(/

/**
 * 单个插值表达式的三分:path | nonpath | unknown。
 * 方向纪律:unknown **只把门推向 undetermined**,绝不借它造 names(造绿方向收紧)。
 */
export function classifyExpr(expr, consts) {
  const e = expr.trim()
  if (!e) return 'unknown'
  // 字面量
  const lit = e.match(/^(['"])((?:\\.|(?!\1).)*)\1$/)
  if (lit) return PATH_LITERAL_RE.test(lit[2]) ? 'path' : 'nonpath'
  if (/^\d+$/.test(e)) return 'nonpath'
  // 裸标识符
  const bare = e.match(/^[A-Za-z_$][\w$]*$/)
  if (bare) {
    const c = consts.get(e)
    if (c) return classifyConst(c)
    if (PATHISH_NAME_RE.test(e)) return 'path'
    if (NONPATH_NAMES.has(e)) return 'nonpath'
    return 'unknown'
  }
  // 成员表达式 X.y / X.y.z
  const member = e.match(/^([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)+)$/)
  if (member) {
    const tail = e.split('.').pop()
    if (PATHISH_NAME_RE.test(tail)) return 'path'
    if (NONPATH_NAMES.has(tail) || NONPATH_METHODS.has(tail)) return 'nonpath'
    const base = consts.get(member[1])
    if (base) return 'nonpath' // 常量对象上的成员(如 result.mapped)—— 值面未证但形状非路径
    return 'unknown'
  }
  // 调用 f(...) / X.f(...) —— 被调名取 `(` 前**最后一段**标识符(`unmapped.join(` 的动词是 join)
  const call = e.match(/^([A-Za-z_$][\w$.]*)\s*\(/)
  if (call) {
    const f = call[1].split('.').pop()
    const c = consts.get(f) || consts.get(call[1])
    if (c && c.kind === 'tpl') return classifyConst(c)
    if (PATH_CALL_RE.test(e)) return 'path'
    if (NONPATH_METHODS.has(f)) return 'nonpath'
    return 'unknown'
  }
  // 模板/复合/其余
  return 'unknown'
}

function classifyConst(c) {
  if (c.kind === 'str') return PATH_LITERAL_RE.test(c.value) ? 'path' : 'nonpath'
  const texts = (c.textParts || []).join('')
  if (PATH_LITERAL_RE.test(texts)) return 'path'
  for (const x of c.exprs || []) if (classifyExpr(x, new Map()) === 'path') return 'path'
  return 'nonpath'
}

/** 模板/字符串字面量的结论行形状判定:naming | silent | unknown */
export function verdictLiteral(lit, consts) {
  const texts = lit.kind === 'str' ? [lit.value] : lit.textParts
  const exprs = lit.kind === 'str' ? [] : lit.exprs
  let hasNaming = false
  let hasUnknown = false
  for (const t of texts) if (PATH_LITERAL_RE.test(t)) hasNaming = true
  for (const x of exprs) {
    const v = classifyExpr(x, consts)
    if (v === 'path') hasNaming = true
    else if (v === 'unknown') hasUnknown = true
  }
  if (hasNaming) return 'naming'
  if (hasUnknown) return 'unknown'
  return 'silent'
}

const BULLET_RE = /^\s*[-·•▸▹]\s/
/**
 * 拼接发射通道:`console.error('  - ' + f)` 型 —— 违规清单经**字符串拼接**流出,
 * 字面量通道看不见(门 47 实测被漏判成 silent:红行逐条打 `- <路径>`,路径在 `f` 里)。
 * 在剥注释/正则的 code 上扫;右操作数不可判 ⇒ 该门落 undetermined(不得记绿,也不许误指控)。
 */
const CONCAT_EMIT_RE =
  /(?:console\.(?:log|error|warn|info)|process\.std(?:out|err)\.write|\blog\.(?:error|warn|info|log|success|dim))\s*\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*\+\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g

/**
 * 逐门汇总(三档)。候选集 = 命中 FINDING_LINE_RE 的字面量 ∪ "bullet 形状且含可判定路径
 * 证据"的字面量 ∪ 拼接发射通道(门 84 型缩进续行与门 47 型 `+ f` 的静态代理,
 * **邻接未证** ⇒ 只贡献 names/undetermined 侧,报告单列标注,由动态档核对)。
 */
export function verdictGateSource(src) {
  const consts = collectConsts(src)
  const { literals, code } = extractLiterals(src)
  const candidates = []
  for (const lit of literals) {
    const texts = lit.kind === 'str' ? [lit.value] : lit.textParts
    const marker = texts.some((t) => FINDING_LINE_RE.test(t))
    const v = verdictLiteral(lit, consts)
    const bullet = BULLET_RE.test(texts[0] || '')
    if (!marker && !(bullet && v === 'naming')) continue
    candidates.push({
      line: lit.line,
      verdict: v,
      via: marker ? 'finding-line' : 'bullet-continuation(邻接未证)',
      text: (texts.join('') + (lit.exprs ? '${' + lit.exprs.join('}${') + '}' : ''))
        .replace(/\s+/g, ' ')
        .slice(0, 120),
    })
  }
  for (const m of code.matchAll(CONCAT_EMIT_RE)) {
    const cls = classifyExpr(m[1], consts)
    if (cls === 'nonpath') continue
    candidates.push({
      line: code.slice(0, m.index).split('\n').length,
      verdict: cls === 'path' ? 'naming' : 'unknown',
      via: 'concat-emit(邻接未证)',
      text: m[0].replace(/\s+/g, ' ').slice(0, 120),
    })
  }
  if (candidates.length === 0)
    return {
      verdict: 'undetermined',
      why: '未见铰链可认的结论行形状(FINDING_LINE_RE 零命中)',
      candidates,
    }
  if (candidates.some((c) => c.verdict === 'naming'))
    return {
      verdict: 'names',
      candidates,
      adjacencyUnproven: candidates.every(
        (c) =>
          c.verdict === 'naming' &&
          (c.via === 'bullet-continuation(邻接未证)' || c.via === 'concat-emit(邻接未证)'),
      ),
    }
  if (candidates.some((c) => c.verdict === 'unknown'))
    return { verdict: 'undetermined', why: '存在判不出的结论行模板(插值/拼接不可判定)', candidates }
  return {
    verdict: 'silent',
    why: '结论行枚举得全且通篇无路径证据 ⇒ 铰链第一态对该门永不触发',
    candidates,
  }
}

// ─── 取材(门 118 纪律:默认 head,批量预取,不读盘不补派生)────────────────
export function runScan(root, argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) return { ok: false, why: `取材面参数不合法:${error}` }
  assertRepoRoot(root, 'G-263 尺子')
  const runnerRel = 'scripts/guardian-runner.mjs'
  const prefix = face === 'worktree' ? null : face === 'staged' ? ':' : 'HEAD:'
  const readVia = (rels) => {
    if (face === 'worktree') {
      const m = new Map()
      for (const r of rels) m.set(r, readWorktreeFile(root, r))
      return m
    }
    const got = catBatch(
      root,
      rels.map((r) => `${prefix}${r}`),
    )
    const m = new Map()
    for (const r of rels) m.set(r, got.get(`${prefix}${r}`) ?? null)
    return m
  }
  const runnerText = readVia([runnerRel]).get(runnerRel)
  if (runnerText === null || runnerText === undefined)
    return { ok: false, why: `取材面(${face})取不到 ${runnerRel} ⇒ 尺子失效` }
  const { gates, undeterminedValue, registered } = parseGateRegistry(runnerText)
  if (gates.length === 0)
    return { ok: false, why: `注册表解析到 0 条门体(registered=${registered})⇒ 尺子失效,不得报绿` }
  const rels = [...new Set(gates.map((g) => `scripts/${g.script}`))]
  const contents = readVia(rels)
  const perScript = new Map()
  for (const rel of rels) {
    const src = contents.get(rel)
    const script = rel.slice('scripts/'.length)
    if (src === null || src === undefined) {
      perScript.set(script, {
        verdict: 'undetermined',
        why: `脚本不在被审面(${rel})`,
        candidates: [],
      })
    } else {
      perScript.set(script, verdictGateSource(src))
    }
  }
  const rows = gates.map((g) => ({
    id: g.id,
    script: g.script,
    mode: g.mode,
    ...perScript.get(g.script),
  }))
  return {
    ok: true,
    face,
    registered,
    undeterminedValue,
    rows,
    buckets: {
      names: rows.filter((r) => r.verdict === 'names').map((r) => r.id),
      silent: rows.filter((r) => r.verdict === 'silent').map((r) => r.id),
      undetermined: rows.filter((r) => r.verdict === 'undetermined').map((r) => r.id),
    },
  }
}

// ─── 人类可读报告─────────────────────────────────────────────────────────
export function renderReport(res) {
  if (!res.ok) return [`[G-263 尺子] ❌ 尺子失效:${res.why}`]
  const L = []
  const { names, silent, undetermined } = res.buckets
  L.push(
    `[G-263 尺子] 判红行点名静态筛(面=${res.face};注册 ${res.registered} 条,门体 ${res.rows.length} 条)`,
  )
  L.push(`  names(红行含可点名证据)     : ${names.length}`)
  L.push(`  silent(通篇无路径 ⇒ 需补点名): ${silent.length}`)
  L.push(`  undetermined(判不出,不得记绿): ${undetermined.length}`)
  const blockingSilent = res.rows.filter((r) => r.verdict === 'silent' && r.mode === 'blocking')
  if (silent.length) {
    L.push(
      '  ▸ silent 门 id 清单(逐条给修复方向:把结论喊成带 `⇒ 违规落点 <裸相对路径>` 的形状,参照门 55/56 的 2026-09-27 修法):',
    )
    for (const r of res.rows.filter((x) => x.verdict === 'silent'))
      L.push(
        `     · [${r.id}]${r.mode === 'blocking' ? ' 🚫blocking' : ` (${r.mode})`} scripts/${r.script} —— ${r.why || ''}`,
      )
  }
  if (blockingSilent.length)
    L.push(
      `  ⚠ 其中 blocking ${blockingSilent.length} 道:它们的红在铰链里只能走差分四态,永远到不了"点名⇒拒绝跳门"第一态`,
    )
  if (undetermined.length) {
    L.push('  ▸ undetermined 门 id 清单(如实判不出,不得记绿):')
    for (const r of res.rows.filter((x) => x.verdict === 'undetermined'))
      L.push(`     · [${r.id}] (${r.mode}) scripts/${r.script} —— ${r.why || ''}`)
  }
  const partial = res.rows.filter(
    (r) => r.verdict === 'names' && (r.candidates || []).some((c) => c.verdict !== 'naming'),
  )
  if (partial.length) {
    L.push(`  ▸ names 但**部分**结论行仍无路径(${partial.length} 道,逐条明细见 --json):`)
    for (const r of partial) {
      const bad = r.candidates.filter((c) => c.verdict !== 'naming')
      L.push(
        `     · [${r.id}] scripts/${r.script}:无路径/判不出的结论行 ${bad.length} 条(行 ${bad
          .slice(0, 3)
          .map((b) => b.line)
          .join(', ')})`,
      )
    }
  }
  const unprov = res.rows.filter((r) => r.verdict === 'names' && r.adjacencyUnproven)
  if (unprov.length)
    L.push(`  ▸ names 仅靠 bullet 证据(邻接未证,须动态核对): ${unprov.map((r) => r.id).join(', ')}`)
  if (res.undeterminedValue?.length)
    L.push(
      `  ▸ 注册表里 script 值非字面量的条目(不计入门体): ${res.undeterminedValue.map((u) => `[${u.id}]`).join(', ') || '无'}`,
    )
  L.push('  动态核对:node scripts/check-redline-path-naming.mjs --probe')
  return L
}

// ─── 动态档:worktree 隔离面 + 注入 + 复跑 + 铰链出口核对──────────────────
/**
 * 探针表:每条 = 一道真门 + 一个能把它的红**触发出来**的最小注入。
 * 选样纪律:纯 node 自持(隔离面没有 node_modules,spawn pnpm/tsc 型门跑不通 ⇒ 未抽到)、
 * 注入落在该门默认取材面可读的文件上、两档 verdict 都要有覆盖(names 侧与 undetermined 侧)。
 */
export const PROBES = [
  {
    gateId: '1',
    script: 'check-api-key-leak.mjs',
    rel: '.env.example',
    inject(text) {
      return `${text}\nPROBE_STEPFUN_API_KEY=sk-${'A'.repeat(12)}${'0'.repeat(24)}\n`
    },
    note: '静态预期 undetermined(违规行经 `${v}` 中转)⇒ 动态若 named,证明静态保守方向正确',
  },
  {
    gateId: '55',
    script: 'check-tool-name-display-coverage.mjs',
    rel: 'apps/ai-service/app/services/mcp_server.py',
    inject(text) {
      const anchor = '_TOOLS: list[MCPTool] = ['
      const at = text.indexOf(anchor)
      if (at === -1) return null
      const ins = at + anchor.length
      return `${text.slice(0, ins)}\n    MCPTool(name="probe_zz_missing_tool", description="probe", inputSchema={}),${text.slice(ins)}`
    },
    note: '静态预期 names(⇒ 违规落点 ${TOOL_DISPLAY_REL} 一跳可解)⇒ 动态应 named,这是正对照',
  },
  {
    gateId: '44',
    script: 'check-root-dir-clean.mjs',
    rel: 'zz-redline-probe/probe.txt',
    createNew: true,
    inject() {
      return 'redline probe artifact\n'
    },
    args: ['--staged'],
    note: '静态预期 silent(红行只打一级目录名 `${v.name}`,无文件路径)⇒ 动态应 not-named,指控侧正对照',
  },
]

function gitIn(wtDir, args, root) {
  return spawnSync(
    gitBinary(),
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.name=redline-probe',
      '-c',
      'user.email=probe@invalid',
      '-C',
      wtDir,
      ...args,
    ],
    {
      encoding: 'utf8',
      cwd: root,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 32 << 20,
    },
  )
}

/**
 * 单条探针:隔离面 = `git worktree add --detach <scratch>/wt <headSha>`,注入后**在隔离面内
 * commit**(detached HEAD,不触共享 ref)⇒ 默认 head 取材的门读到注入面。
 * 复跑姿势与 safe-commit runGateBaseline 同源(cwd=隔离面、剥 GIT_INDEX_FILE、windowsHide、
 * 数字 timeout、maxBuffer)。
 */
export function runProbe(root, headSha, probe, staticVerdict, opts = {}) {
  const scratch = opts.scratch || mkScratch('redline-probe-')
  const wt = join(scratch, 'wt')
  const cleanup = () => {
    gitIn(wt, ['worktree', 'remove', '--force', wt], root)
    gitIn(wt, ['worktree', 'prune'], root)
    try {
      rmScratch(scratch)
    } catch {
      /* §26 每日 Temp 体检兜 */
    }
  }
  if (!opts.keepScratch) process.on('exit', cleanup)
  const add = spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-C', root, 'worktree', 'add', '--detach', wt, headSha],
    {
      encoding: 'utf8',
      cwd: root,
      windowsHide: true,
      timeout: 600000,
    },
  )
  if (add.error || add.status !== 0) {
    if (!opts.keepScratch) rmScratch(scratch)
    return {
      gateId: probe.gateId,
      outcome: 'unavailable',
      why: `建隔离工作树失败:${(add.stderr || add.error?.message || '').slice(0, 160)}`,
    }
  }
  try {
    const gatePath = join(wt, 'scripts', probe.script)
    if (!existsSync(gatePath))
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: `隔离面没有该门脚本:${probe.script}`,
      }
    const target = join(wt, ...probe.rel.split('/'))
    const preExists = existsSync(target)
    if (!preExists && !probe.createNew)
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: `隔离面没有注入目标:${probe.rel}`,
      }
    const orig = preExists ? readFileSync(target, 'utf8') : ''
    const injected = probe.inject(orig)
    if (injected === null || injected === orig)
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: '注入锚点未命中(门输入结构变更?)—— 不硬造红',
      }
    if (!preExists) mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, injected)
    const a1 = gitIn(wt, ['add', '--', probe.rel], root)
    // `--no-verify` 的理由(不是偷懒):worktree 共享主 .git 的 core.hooksPath ⇒ 不加就会把
    // 183 道门全量跑一遍(实测),而**注入本身就是违规** ⇒ 探针提交永远被自己的门拦下。
    // 探针面是取证环境不是提交链:这里跳钩子恰恰是本工具存在的目的(造出带违规的 head 面)。
    const a2 = gitIn(
      wt,
      [
        'commit',
        '--no-verify',
        '-m',
        'redline-probe(injected violation, isolated detached worktree)',
      ],
      root,
    )
    if (a1.status !== 0 || a2.status !== 0)
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: `隔离面提交失败:${(a2.stderr || a1.stderr || '').slice(0, 160)}`,
      }
    const env = { ...process.env }
    delete env.GIT_INDEX_FILE
    const g = spawnSync(process.execPath, [gatePath, ...(probe.args || [])], {
      encoding: 'utf8',
      cwd: wt,
      env,
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 32 << 20,
    })
    const output = `${g.stdout || ''}${g.stderr || ''}`
    if (g.error || g.status === null)
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: `复跑被中断/超时:${g.error?.message || 'null status'}`,
      }
    if (g.status === 2 || /Cannot find module|MODULE_NOT_FOUND|ENOENT/.test(output))
      return {
        gateId: probe.gateId,
        outcome: 'unavailable',
        why: `隔离面跑不出去(exit ${g.status} / 缺依赖)⇒ 未抽到,不计入准确率`,
      }
    if (g.status === 0)
      return {
        gateId: probe.gateId,
        outcome: 'no-red',
        why: '注入后该门仍绿(注入未触发判据)⇒ 未抽到,不硬算准确率',
      }
    const lines = findingLines(output)
    const named = lines.some((l) => lineNamesFile(l, probe.rel))
    const agree =
      staticVerdict === null || staticVerdict === 'undetermined'
        ? 'excluded(静态判不出,不计准确率)'
        : named === (staticVerdict === 'names')
          ? 'agree'
          : 'DISAGREE'
    return {
      gateId: probe.gateId,
      outcome: 'red',
      named,
      staticVerdict,
      agree,
      sample:
        lines
          .filter((l) => lineNamesFile(l, probe.rel))[0]
          ?.trim()
          .slice(0, 160) ||
        lines[0]?.trim().slice(0, 160) ||
        '',
      note: probe.note,
    }
  } finally {
    cleanup()
  }
}

export function runProbes(root, argv) {
  const only = argv.find((a) => a.startsWith('--probe='))
  const ids = only
    ? only
        .slice('--probe='.length)
        .split(',')
        .map((s) => s.trim())
    : null
  const probes = ids ? PROBES.filter((p) => ids.includes(p.gateId)) : PROBES
  if (probes.length === 0) return { ok: false, why: `--probe 选样为空(ids=${ids.join('|')})` }
  const head = spawnSync(gitBinary(), ['-c', 'safe.directory=*', '-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    cwd: root,
    windowsHide: true,
    timeout: 60000,
  })
  if (head.status !== 0 || !/^[0-9a-f]{40}$/.test((head.stdout || '').trim()))
    return {
      ok: false,
      why: `取 HEAD sha 失败:${(head.stderr || head.error?.message || '').slice(0, 120)}`,
    }
  const headSha = head.stdout.trim()
  const scan = runScan(root, [])
  const verdictOf = (gid) =>
    scan.ok ? (scan.rows.find((r) => r.id === gid)?.verdict ?? null) : null
  const results = probes.map((p) => runProbe(root, headSha, p, verdictOf(p.gateId)))
  const red = results.filter((r) => r.outcome === 'red')
  const counted = red.filter((r) => r.agree === 'agree' || r.agree === 'DISAGREE')
  return {
    ok: true,
    headSha,
    results,
    accuracy: counted.length
      ? `${counted.filter((r) => r.agree === 'agree').length}/${counted.length}`
      : '0/0(无一条可计准确率的抽跑)',
  }
}

export function renderProbeReport(p) {
  if (!p.ok) return [`[G-263 动态档] ❌ ${p.why}`]
  const L = [
    `[G-263 动态档] 隔离面(worktree@${p.headSha.slice(0, 9)})抽跑 ${p.results.length} 道,准确率(仅静态可判档计)${p.accuracy}`,
  ]
  for (const r of p.results) {
    if (r.outcome === 'red')
      L.push(
        `  · [${r.gateId}] 真红 ${r.named ? '点名了注入文件' : '**未点名**'} ⇒ 静态=${r.staticVerdict} ⇒ ${r.agree}`,
      )
    else L.push(`  · [${r.gateId}] ${r.outcome}(未抽到,不计准确率):${r.why}`)
    if (r.sample) L.push(`      样例结论行: ${r.sample}`)
    if (r.note) L.push(`      ${r.note}`)
  }
  return L
}

// ─── --self-test:合成夹具端到端(不依赖真仓、不 spawn git)──────────────────
export function selfTest() {
  const fails = []
  let total = 0
  const ok = (name, cond, extra = '') => {
    total++
    if (!cond) fails.push(`${name}${extra ? ` —— ${extra}` : ''}`)
  }
  const V = (src) => verdictGateSource(src).verdict
  // 正对照:naming 三源
  ok('S1 模板文本含路径字面', V('console.error(`❌ 违规 scripts/foo.mjs 命中`)') === 'names')
  ok('S2 常量一跳', V("const REL='packages/x/y.ts';\nconsole.error(`❌ 落点 ${REL}`)") === 'names')
  ok(
    'S3 箭头模板常量一跳',
    V(
      'const rel2 = (lang) => `packages/i18n/${lang}.json`;\nconsole.error(`❌ 见 ${rel2(lang)}`)',
    ) === 'names',
  )
  ok('S4 普通字符串含路径', V("log.error('❌ 泄露位置见 apps/api/src/x.ts')") === 'names')
  ok(
    'S5 bullet 缩进续行(门 84 型)',
    V(
      'console.error("❌ 检出 1 个文件的暂存内容等于历史版本");\nconsole.error(`  - ${rel}  ==  ${sha}`)',
    ) === 'names',
  )
  // 反对照:silent
  ok(
    'S6 纯符号红',
    V('console.error(`[tool-name-coverage] ❌ 覆盖率 ${result.mapped}/${result.registered}`)') ===
      'silent',
  )
  ok('S7 名单红', V("console.error('❌ 未映射工具名(1):probe_zz')") === 'silent')
  // undetermined
  ok('S8 插值不可判', V('console.error(`❌ 未映射 ${things}`)') === 'undetermined')
  ok('S9 零结论形状', V('console.log("一切正常")') === 'undetermined')
  // 注释必须被剥(假阳方向):
  ok(
    'S10 注释里的 ❌+路径不算',
    V('// ❌ 历史事故:scripts/foo.mjs 曾漏点名\nconsole.error("❌ 覆盖率 1/2")') === 'silent',
  )
  // 正则体里的引号不得开字符串态:
  ok(
    'S11 正则体不污染扫描',
    V("const re = /['\"]/g;\nconsole.error('❌ 未映射工具名')") === 'silent',
  )
  // FINDING_LINE_RE 与铰链同源(行为锁:带行号形态必须算结论行)
  ok('S12 `:42` 形态被认作结论行', V('console.log(`  leak.ts:42: 命中 ${file}`)') === 'names')
  // 拼接发射通道(门 47 型的两个方向)
  ok(
    'S13 拼接右操作数不可判 ⇒ undetermined',
    V("console.error('❌ 有缺口:');\nfor (const f of missing) console.error('  - ' + f)") ===
      'undetermined',
  )
  ok(
    'S14 拼接右操作数路径名 ⇒ names',
    V("console.error('❌ 缺水印:');\nconsole.error('  - ' + file)") === 'names',
  )
  ok(
    'S15 拼接右操作数白名单名 ⇒ 不新增候选',
    V("console.error('❌ 计数 1/2');\nconsole.log('n=' + count)") === 'silent',
  )
  // 正则前有空格必须仍被认作正则(门 3 错位回归锁)
  ok(
    'S16 `= /re/` 带空格不吃字符串态',
    V("const re = /['\"]/g;\nconsole.error('❌ 覆盖率 ${total}/${ok_n}')") !== 'names',
  )
  // 注册表解析
  const reg = parseGateRegistry(
    "const checks = [\n  { id: '9', label: 'x', script: 'check-a.mjs', mode: 'blocking' },\n  // script: 'fake.mjs',\n  { id: '10', script: 'check-b.mjs', mode: 'warn' },\n  { id: '11', script: VAR },\n]\n",
  )
  ok(
    'R1 两条门体被抽出',
    reg.gates.length === 2 && reg.gates[0].mode === 'blocking' && reg.gates[1].mode === 'warn',
    JSON.stringify(reg.gates),
  )
  ok('R2 注释行 script 不算', !reg.gates.some((g) => g.script === 'fake.mjs'))
  ok(
    'R3 非字面量值落 undeterminedValue',
    reg.undeterminedValue.length === 1 && reg.undeterminedValue[0].id === '11',
  )
  ok(
    'R4 label 文案不抢注册行',
    parseGateRegistry("{ id: '1', label: 'a script: 说明', script: 'x.mjs' }").gates[0]?.script ===
      'x.mjs',
  )
  // 探针分类器单元
  const consts = collectConsts(
    "const TOOL_DISPLAY_REL = 'packages/shared/src/chat/tool-display.ts'\nconst sharedLocaleRel = (lang) => `packages/i18n/messages/shared/${lang}.json`",
  )
  ok('C1 _REL 常量解析为 path', classifyExpr('TOOL_DISPLAY_REL', consts) === 'path')
  ok('C2 箭头模板常量解析为 path', classifyExpr('sharedLocaleRel(lang)', consts) === 'path')
  ok('C3 join 调用判 nonpath', classifyExpr("unmapped.join(', ')", new Map()) === 'nonpath')
  ok('C4 未知标识符判 unknown', classifyExpr('mystery', new Map()) === 'unknown')
  ok('C5 成员尾 nonpath 白名单', classifyExpr('e.message', new Map()) === 'nonpath')
  // 探针表完整性:每条探针必须带 rel/inject,且 inject 对"含锚点文本"产出可检测变化
  for (const p of PROBES) {
    ok(`P1 探针 [${p.gateId}] 字段齐`, !!(p.script && p.rel && typeof p.inject === 'function'))
  }
  const p55 = PROBES.find((x) => x.gateId === '55')
  ok(
    'P2 门 55 注入器命中锚点',
    p55.inject('X = 1\n_TOOLS: list[MCPTool] = [\n]\n').includes('probe_zz_missing_tool'),
  )
  ok('P3 门 55 注入器锚点缺失时返回 null(不硬造红)', p55.inject('nothing here') === null)
  return { fails, total }
}

// ─── CLI ────────────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const { fails, total } = selfTest()
    for (const f of fails) console.error(`  ✗ ${f}`)
    console.log(
      `自检:${fails.length === 0 ? '全部通过' : `${fails.length} 条失败`}(共 ${total} 项)`,
    )
    process.exit(fails.length ? 1 : 0)
  }
  const root = (() => {
    const r = argv.find((a) => a.startsWith('--root='))
    return r ? resolve(r.slice(7)) : DEFAULT_ROOT
  })()
  if (argv.includes('--probe') || argv.some((a) => a.startsWith('--probe='))) {
    const rep = runProbes(root, argv)
    for (const l of renderProbeReport(rep)) console.log(l)
    process.exit(rep.ok ? 0 : 1)
  }
  const res = runScan(root, argv)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2))
  } else {
    for (const l of renderReport(res)) console.log(l)
  }
  process.exit(res.ok ? 0 : 1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
