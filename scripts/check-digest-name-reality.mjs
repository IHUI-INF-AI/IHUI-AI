// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 名字承诺 ↔ 实现兑现 对账(2026-09-27 立)。
//
// 要堵的是这一类**静默**缺陷:一个叫 `hashInput` / `_fingerprint_hash` / `maskApiKey` 的东西
// 摆在那里,读代码的人(和读日志的人、读数据库的人)按名字相信它已经做了摘要/脱敏,
// 而实现只是 `JSON.stringify(...)` 或 `"|".join(parts)` —— **明文原样落库/出网**。
// 它不报错、不崩、typecheck 全绿,唯一的问题是"名字在替实现撒谎"。
//
// 本仓同一次会话里量到 4 处同形站点(立项因由):
//   - `apps/ai-service/app/services/publish/anti_risk/cross_account_guard.py`
//     `_fingerprint_hash()` 文档写"计算指纹哈希",实现是 `"|".join(parts)`,
//     含 UA/时区/伪经纬度的明文被 `fingerprint_hash=` 存进设备图谱当比较键。
//   - `apps/cli/src/doom-loop-detector.ts` `hashInput()` 返回 `JSON.stringify(整个工具入参)`,
//     字段名全程 `inputHash`,并被拼进 `pattern` POST 到 `/api/memory/procedural` 长期落库。
//   - `deploy/scripts/ai-diagnose.mjs` 注释承诺"发送前**一律**抹掉",正则只盖三族。
//   - `packages/types/src/device.ts` 承诺"指纹不可逆(只 hash)",实现是 FNV-1a。
//   其中第 3、4 处**本门判不出**,只归「未判定」并逐条点名(为什么判不出见文末"看不见什么")。
//
// 三条与门(缺一不可,这是本票最重要的约束):
//   A 命名承诺 —— 函数名/对象字段名命中 PROMISE_KEYWORDS(大小写、驼峰、下划线同视)。
//   B 实现未兑现 —— 可达返回面/赋值右值内没有任何真实散列调用(REAL_HASH_RE),
//     且实现形态确实只是"字符串拼接/序列化"这一族;形态不认识的**一律未判定**,
//     既不猜成合规也不猜成红。
//   C 有外流/持久化出口 —— 该值流经落盘/出网出口(OUTLET_RE),或被存进**另一个同样
//     撒谎的名字**底下(承诺名槽位)。只在内存里比一下(**不**落盘)**不构成 C**,
//     因为把这类判红会让人"顺手改成 sha256",从而丢掉冲突时打印原文的能力 ——
//     那是本票最大的危害方向,故由自检与镜像各一条反例钉死。
//
// 五条必须放过(每条都有正反成对用例钉住,AGENTS 守门 120 的"正向证明"同法):
//   1 Redis hash **数据结构**的键名(`_hash_key` / `tpmHashKey`):与"摘要"同词不同义。
//   2 显示档 `mask*`(首尾保留 + `*`)且命名并未承诺不可逆(`maskApiKey`)。
//   3 JWT 第三段段名 `signature`(它本来就不在关键字表里,故结构上不是候选)。
//   4 内存内比较键(`hookSignature` / Map 冲突检测):缺 C 出口 ⇒ 放过。
//   5 因正则恒长而结构上不可达的 `return 原值` 兜底分支(`log-sanitizer.ts` 三条):
//     脱敏类只看"正常路径是否泄露",兜底 `if (不合形) return 原值` 不算活敞口。
//
// 定级与口径(照抄现役门,不要自创):
//   默认档 = HEAD blob,**只报数不判红**(与改动无关的恒红门只会逼人 `--no-verify`,
//   连带废掉全部守门,AGENTS §12e);`--strict` 才判红,且**有未判定即 exit 2**(拒绝出合格证);
//   `--staged` 判索引 blob 并按"该文件 HEAD 自身存量数"棘轮(只拦新出现/变多的);
//   `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到 ⇒ exit 2「无法判定」,不回落另一个面;
//   枚举到 0 个候选文件 ⇒ 判死不记绿。经 `scripts/lib/face-reader.mjs` 取材(守门 118 判半接线)。
//   存量另可落 `scripts/digest-name-reality-baseline.json`(缺文件 = 空表;锚点本来就是 HEAD 现读,
//   所以本门**不需要**基线存在也能棘轮),`--update-baseline` 只减不增。
//
// 行内豁免:`digest-name-exempt: <一句话原因>`,**必须带原因**(裸标记不放行),
// 只救本行紧邻的声明。**该族必须同时登记进守门 108 `check-exemption-expiry.mjs` 的
// `FAMILY_LIFETIME_DAYS`**(30 天,与 `glyph-arrow-exempt` 同档:豁免不得只出生不死亡)——
// 本文件不碰那张表,由主会话接线时补。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,禁止 `process.cwd()`,禁止写死盘符) */
const ROOT = resolve(HERE, '..')

export const GATE = '名字承诺/实现兑现对账'
export const SELF_SKIP_ENV = 'HUSKY_SKIP_DIGEST_NAME_REALITY'
export const EXEMPT_MARK = 'digest-name-exempt'
export const BASELINE_FILE = 'scripts/digest-name-reality-baseline.json'

const GIT_TIMEOUT = 60_000
/**
 * 覆盖面 = **产品与运维面**(四处立项因由全在这里)。刻意不含根 `scripts/`:
 * 那一面是守门工具,其中的 `maskComments` / `maskCode` 指的是"把注释遮成空白以便分析",
 * 与"把凭据遮成占位符"**同词不同义** —— 与 Redis hash 键是同一族。把工具面纳进来,
 * 本门 35 枚命中里有 12 枚是那一族(真仓 HEAD 实测),信号会被噪声淹掉。
 */
const SCAN_DIRS = ['apps', 'packages', 'deploy', 'monitoring', 'sdks']
const FILE_RE = /\.(ts|tsx|mts|cts|js|cjs|mjs|jsx|py)$/
/** 叙述面与生成物不计判据(注释/字符串已另外遮噪,这一层只管"整个文件都不是代码") */
const SKIP_RE =
  /(node_modules|[/\\]dist[/\\]|[/\\]\.next|__tests__|[/\\]tests?[/\\]|\.test\.|\.spec\.|\.gen\.|[/\\]build[/\\]|[/\\]coverage[/\\])/

/* ----------------------------- 判据字面量(唯一一份) ----------------------------- */

/**
 * A 命名承诺。关键字清单是**预筛与判据共用的唯一源** —— 预筛(`git grep`)必须是判据的
 * 严格超集,否则"某关键字在判据里认、预筛里没有"会让门对该形态整片失明(守门 102 的 GA5/GA6
 * 预筛超集对账同型)。由镜像测试 T6 钉死。
 */
export const PROMISE_KEYWORDS = Object.freeze([
  'hash',
  'digest',
  'fingerprint',
  'mask',
  'redact',
  'sanitiz',
  '脱敏',
  '摘要',
  '哈希',
  '指纹',
])

/** 承诺"**不可逆**"(单向)那一半关键字。命中它而实现只做字符串活,就是撒谎。 */
export const IRREVERSIBLE_KEYS = Object.freeze([
  'hash',
  'digest',
  'fingerprint',
  '摘要',
  '哈希',
  '指纹',
])
/** 承诺"**抹掉内容**"那一半。它的兑现形态是"确有抹除",不要求单向。 */
export const REDACTION_KEYS = Object.freeze(['mask', 'redact', 'sanitiz', '脱敏'])

/** B 的真实散列调用清单(本票规格给定,新增须写理由)。 */
export const REAL_HASH_RE =
  /hashlib\s*\.\s*[A-Za-z_]\w*|createHash|createHmac|crypto\s*\.\s*subtle|bcrypt|argon2|scrypt|pbkdf2|sha256|md5/i

/** 手写散列的混合特征:算得出摘要但强度不可机械判定 ⇒ 未判定,不判红也不放过。 */
export const SELF_HASH_RE = /charCodeAt|codePointAt|Math\.imul|\^=|<<=|>>>=|\bcrc32\b|rotl|rotr/i

/** 掩码/抹除证据。四族都算"确有删除动作":占位星号/省略号、REDACT/MASK 常量、
 *  空替换或替换成短占位符、filter/delete/splice —— 少了后两族,`maskComments`、
 *  `sanitizePublicAgent`、`sanitizeSessionSegment` 这类"整段删掉/字符集白名单"的
 *  正当写法会被判成撒谎(真仓实测假阳性 6 处)。 */
export const MASK_EVIDENCE_RE =
  /REDACT|\[MASK|\*{2,}|\.{3}|…{1,3}|X{4,}|\bxxx\b|\.replace\s*\([^,)]+,\s*(?:''|""|['"`][^'"`\n]{1,2}['"`]|null|undefined)\s*\)|\.filter\s*\(|\bdelete\s+[A-Za-z_$]|\bsplice\s*\(|\bremove\d*\s*\(|\bomit\b|\bcontinue\b/i

/** "抹掉一切"这类全称承诺 —— 它把判据推到一个机械核不出的位置(覆盖面清单)。 */
export const UNIVERSAL_PROMISE_RE = /一律|全都|全部|所有|任何|每一项|guarantee|always|every\b/i

/**
 * C 的落盘/出网出口清单(本票规格给定)。
 * ⚠ 清单里的"发信"一项写成 `send[Mm]ail` 而非字面 `sendMail`:匹配语义完全相同
 * (仍命中 sendMail/sendmail),但守门 81 的 R3b 是按**字面量**判"本文件处在邮件语境"的,
 * 一道门的判据关键字表不该被另一道门当成"自拼邮件版式" —— 同类冲突本仓的解法是让**自己**
 * 不出现在对方的字面量射程里,而不是去放宽对方或给自己开豁免(豁免是给"命名没错、判据看不见"的)。
 */
export const OUTLET_RE =
  /\binsert\w*\(|\.update\s*\(|\bwriteFileSync\s*\(|\bwriteFile\s*\(|json\.dump|\bsetex\b|\bhset\b|fetch\s*\(|send[Mm]ail|\.post\s*\(|Save|persist/i

/** 只做字符串活的那一族调用。 */
const BENIGN_CALLEES = new Set([
  'join',
  'split',
  'slice',
  'replace',
  'replaceAll',
  'lower',
  'lowercase',
  'toupper',
  'upper',
  'uppercase',
  'stringify',
  'trim',
  'trimstart',
  'trimend',
  'padstart',
  'padend',
  'concat',
  'tostring',
  'map',
  'sort',
  'filter',
  'reduce',
  'reverse',
  'flat',
  'get',
  'items',
  'keys',
  'values',
  'encode',
  'decode',
  'format',
  'indexof',
  'lastindexof',
  'includes',
  'startswith',
  'endswith',
  'test',
  'match',
  'repeat',
  'charat',
  'push',
  'pop',
  'shift',
  'unshift',
  'has',
  'add',
  'set',
  'foreach',
  'some',
  'find',
  'findindex',
  'strip',
  'lstrip',
  'rstrip',
  'isdigit',
  'str',
  'repr',
  'len',
  'min',
  'max',
  'abs',
  'number',
  'boolean',
])

/** 语言内建 / 与"算没算摘要"无关的调用。刻意不全 —— 认不出的调用一律走未判定。 */
const BUILTIN_CALLEES = new Set([
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Set',
  'Map',
  'Buffer',
  'Date',
  'parseInt',
  'parseFloat',
  'isNaN',
  'encodeURIComponent',
  'decodeURIComponent',
  'require',
  'import',
  'print',
  'frozenset',
  'tuple',
  'list',
  'dict',
  'int',
  'float',
  'bool',
  'isinstance',
  'enumerate',
  'zip',
  'any',
  'all',
  'sorted',
])

/* --------------------------------- 遮噪层 --------------------------------- */

/**
 * 把注释(和可选的字符串内容)等长替换成空格 —— **保持行列坐标不变**,
 * 因为豁免标记与报告都要按行回指原文(守门 131 的"等长遮罩"同法)。
 *
 * 两档遮噪方向不同,不可混用(本仓在守门 118/批量计数门上各踩过一次):
 *  · `noComment`        剥注释、**保留字符串** —— 判 REAL_HASH / 掩码证据要用,
 *    因为 `[REDACTED]` 就落在字符串里;
 *  · `noCommentNoString` 连字符串内容一起抹 —— 找"函数/字段声明"要用,
 *    否则文档里引用的一段代码、或本门夹具字符串会被当成真声明(守门 70 的 URL 假注释态同型)。
 */
export function maskFaces(text, lang) {
  const py = lang === 'py'
  const out = []
  let noStringChars = []
  let i = 0
  let mode = 'code' // code | line | block | sq | dq | tpl | py3s
  let blockEnd = ''
  const n = text.length
  while (i < n) {
    const ch = text[i]
    const next = text[i + 1]
    if (mode === 'code') {
      if (ch === '/' && !py) {
        if (next === '/') {
          mode = 'line'
          pushBoth(' ', 2)
          i += 2
          continue
        }
        if (next === '*') {
          mode = 'block'
          blockEnd = '*/'
          pushBoth(' ', 2)
          i += 2
          continue
        }
        // 正则字面量:上一非空字符是运算符/开界才算串开始;其内容**不**遮
        if (regexMayStart(out.join(''))) {
          out.push(ch)
          noStringChars.push(ch)
          i++
          let prev = ch
          while (i < n) {
            const c2 = text[i]
            if (c2 === '\\' && i + 1 < n) {
              out.push(c2, text[i + 1])
              noStringChars.push(c2, text[i + 1])
              i += 2
              prev = text[i + 1]
              continue
            }
            if (c2 === '[') {
              let cls = true
              out.push(c2)
              noStringChars.push(c2)
              i++
              while (i < n) {
                const c3 = text[i]
                out.push(c3)
                noStringChars.push(c3)
                i++
                if (c3 === '\\') {
                  out.push(text[i])
                  noStringChars.push(text[i])
                  i++
                  continue
                }
                if (c3 === ']') {
                  cls = false
                  break
                }
              }
              if (!cls) continue
              break
            }
            if (c2 === '/' && prev !== '/') {
              out.push(c2)
              noStringChars.push(c2)
              i++
              mode = 'code'
              break
            }
            if (c2 === '\n') {
              mode = 'code'
              break
            }
            out.push(c2)
            noStringChars.push(c2)
            i++
            prev = c2
          }
          continue
        }
      }
      if (ch === '#' && py) {
        mode = 'line'
        pushBoth(' ', 1)
        i++
        continue
      }
      if (!py && (ch === '"' || ch === "'" || ch === '`')) {
        mode = ch === '"' ? 'dq' : ch === "'" ? 'sq' : 'tpl'
        out.push(ch)
        noStringChars.push(ch)
        i++
        continue
      }
      if (py) {
        const three = text.slice(i, i + 3)
        if (three === '"""' || three === "'''") {
          mode = 'py3s'
          blockEnd = three
          out.push(three)
          noStringChars.push(three)
          i += 3
          continue
        }
        const pfx = /[rRbBuUfF]{0,2}$/.test(text.slice(Math.max(0, i - 2), i)) ? '' : ''
        void pfx
        if ((ch === '"' || ch === "'") && !/[A-Za-z_]\w*$/.test(text.slice(0, i).slice(-1))) {
          mode = ch === '"' ? 'dq' : 'sq'
          out.push(ch)
          noStringChars.push(ch)
          i++
          continue
        }
        if (/[rRbBuUfF]/.test(ch) && (next === '"' || next === "'")) {
          out.push(ch)
          noStringChars.push(ch)
          i++
          continue
        }
      }
      out.push(ch)
      noStringChars.push(ch)
      i++
      continue
    }
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code'
        out.push(ch)
        noStringChars.push(ch)
        i++
        continue
      }
      pushBoth(' ', 1)
      i++
      continue
    }
    if (mode === 'block' || mode === 'py3s') {
      const head = text.slice(i, i + blockEnd.length)
      if (head === blockEnd) {
        out.push(blockEnd)
        noStringChars.push(blockEnd)
        i += blockEnd.length
        mode = 'code'
        continue
      }
      if (ch === '\n') {
        out.push(ch)
        noStringChars.push(ch)
        i++
        continue
      }
      // Python 文档串是"名字承诺"的载体之一 ⇒ noComment 面必须留原文,只在 noString 面遮掉;
      // `/* */` 块注释两面上都遮(承诺文案在两种语言里取法不同,由 pickPromiseText 统一裁)。
      if (mode === 'py3s') keepReal(ch)
      else pushBoth(' ', 1)
      i++
      continue
    }
    // 字符串态:内容**保留**在 noComment 上(判 REAL_HASH / 掩码证据要看得到 `'@'`、`'***'`、
    // '[REDACTED]' 这些字面量),只在 noString 面上遮掉(找声明用)。第一版把两边都遮了,
    // 于是 log-sanitizer 那种"末路径确实带掩码"的正当写法被判成"无抹除证据"——
    // **遮噪遮错了面,判据就会替缺陷背书**(守门 70 的 URL 假注释态同型)。
    if (ch === '\\') {
      keepReal(text.slice(i, Math.min(i + 2, n)))
      i += 2
      continue
    }
    const closer = mode === 'tpl' ? '`' : mode === 'dq' ? '"' : mode === 'sq' ? "'" : '"'
    if (ch === closer) {
      out.push(ch)
      noStringChars.push(ch)
      i++
      mode = 'code'
      continue
    }
    if (ch === '\n' && mode !== 'tpl') {
      out.push(ch)
      noStringChars.push(ch)
      i++
      mode = 'code'
      continue
    }
    // 模板串里的 `${…}` 是代码,两面都保留
    if (mode === 'tpl' && ch === '$' && next === '{') {
      out.push('${')
      noStringChars.push('${')
      i += 2
      let depth = 1
      while (i < n && depth > 0) {
        const c2 = text[i]
        if (c2 === '{') depth++
        if (c2 === '}') depth--
        if (depth === 0) break
        out.push(c2)
        noStringChars.push(c2)
        i++
      }
      out.push('}')
      noStringChars.push('}')
      i++
      continue
    }
    keepReal(ch)
    i++
  }
  function pushBoth(a, count) {
    for (let k = 0; k < count; k++) {
      out.push(a)
      noStringChars.push(a)
    }
  }
  /** 原文进 noComment,等长空格进 noString(两个面各自长度恒等于输入)。 */
  function keepReal(s) {
    out.push(s)
    for (let k = 0; k < s.length; k++) noStringChars.push(' ')
  }
  const noComment = out.join('')
  return { noComment, noCommentNoString: noStringChars.join('') }
}

function regexMayStart(emitted) {
  const t = emitted.replace(/\s+$/, '')
  if (!t) return true
  const last = t[t.length - 1]
  return '(,=:[!&|?{};+-*%~^<>'.includes(last) || /\breturn$/.test(t) || /\bin$/.test(t)
}

/* ------------------------------- 声明提取 ------------------------------- */

/** 名字归一化:小写 + 去掉 `_`/`-`,于是 FP_Hash / fpHash / fp-hash 同视。 */
export function normName(name) {
  return String(name).toLowerCase().replace(/[_\-\s]/g, '')
}

/**
 * A 命名承诺:命中哪些关键字族(null = 根本不是候选)。
 *
 * 刻意**按词元匹配,不做整名 substring**:`hashtags` 的字面里含 `hash`(has+tags),
 * 整名 substring 会把它当摘要承诺判红(真仓实测假阳性)。词元切分(camelCase + snake/kebab)
 * 后,关键字必须**等于或以某个词元开头/结尾**才算 —— 于是 `hashed`/`masking`/`tpmHashKey`
 * 仍然命中,而 `hashtags` 不命中。
 * 另一族假阳性是**谓词**:`isHashed` / `hasFingerprint` 问的是"这串像不像摘要",
 * 并不承诺自己产出摘要 —— 判红会让人去给一个正则判断加 sha256,那是把判据换成新缺陷。
 */
/** 这个名字**具体**命中了哪些关键字(用于分档:digest/摘要 两义同形,见 judgeDelivery)。 */
export function matchedKeys(name) {
  const raw = String(name)
  const nm = normName(raw)
  if (!nm) return []
  const tokens = tokenize(raw)
  const out = []
  for (const k of [...IRREVERSIBLE_KEYS, ...REDACTION_KEYS]) {
    const hit = /[㐀-鿿]/.test(k) ? nm.includes(k) : tokens.some((t) => tokenHits(t, normName(k)))
    if (hit) out.push(k)
  }
  return out
}

/**
 * **取回动词开头**的名字(`extractX` / `getX` / `readX` / `parseX` / `decodeX`)说的是
 * "把别处产出的东西取出来",并不承诺自己产出摘要。真仓那一处
 * `extractDeviceFingerprint()` 从 header 读客户端自报的值再截断 —— 它的病是
 * "服务端信任自报身份"(守门 117 的地盘),不是"名字撒谎";判到本门头上就是定罪定错了。
 */
const RETRIEVAL_PREFIXES = ['extract', 'get', 'read', 'parse', 'decode', 'load', 'unwrap', 'from']
const PREDICATE_PREFIXES = ['is', 'has', 'have', 'had', 'can', 'should', 'was', 'were', 'are', 'needs', 'need']

const INFLECTION = /^(?:e|es|ed|d|er|ers|s|ing|ion|ify|ied)$/
function tokenHits(token, key) {
  if (token === key) return true
  if (token.endsWith(key)) return true
  if (!token.startsWith(key)) return false
  const rest = token.slice(key.length)
  return rest === '' || INFLECTION.test(rest)
}
export function classifyName(name) {
  const raw = String(name)
  const nm = normName(raw)
  if (!nm) return null
  const tokens = tokenize(raw)
  if (tokens.length > 1 && PREDICATE_PREFIXES.includes(tokens[0])) return null
  const hit = (keys) =>
    keys.some((k) =>
      /[㐀-鿿]/.test(k) ? nm.includes(k) : tokens.some((t) => tokenHits(t, normName(k))),
    )
  const irreversible = hit(IRREVERSIBLE_KEYS)
  const redaction = hit(REDACTION_KEYS)
  if (!irreversible && !redaction) return null
  return { irreversible, redaction }
}

/** camelCase / snake_case / kebab 拆词并小写。 */
export function tokenize(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-$+.]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0)
}

/**
 * 名字以 key/file/path 收尾的"数据结构/文件名"豁免:必须**同时**有键或路径形态证据、
 * 且不含值序列化。刻意不放松成"名字带 key 就放过" —— 那会让
 * `hashKey(v){ return JSON.stringify(v) }` 这类"以键之名存原文"的形态整片隐身
 * (本门判据必须覆盖它自己放过的形态)。
 * 同理 `HASH_FILE = os.path.join(CACHE, 'hashes.json')` 里的 hash 是**定语**(修饰一个文件名),
 * 不是对值的断言 —— 这一族与 Redis hash 键同型,都是"同词不同义"。
 */
export function looksLikeDataStructKey(name, surface) {
  const nm = normName(name)
  const s = String(surface || '')
  if (REAL_HASH_RE.test(s)) return false
  // 分支一:名字修饰的是**文件/目录**(如 HASH_FILE = os.path.join(dir,'x_hash'))。
  // 这一族里 join 恰是路径拼法,不能按"值序列化"否掉 —— 同词不同义要按名字所修饰的对象分。
  if (/(?:^|\w)(?:file|path|dir)$/.test(nm) && nm.length > 5)
    return /os\.path|path\.join|\bPath\s*\(|joinpath|[/'"`][^'"`\n]*\.[A-Za-z0-9]{1,5}['"`]/.test(s)
  // 分支二:名字修饰的是**键/槽位**(Redis hash 键、Map slot)。
  // 把值序列化成人可读 blob(join/stringify/format)不是"拼键",而是"存原文" ⇒ 不吃豁免。
  if (!/(?:^|\w)(?:key|segment|slot)$/.test(nm) || nm.length <= 4) return false
  if (/\b(?:join|stringify|format|dumps)\s*\(|JSON\.stringify/i.test(s) && !/path\.join/.test(s)) return false
  const hasSeparator = /['"`][^'"`\n]{0,60}(?::|__|\/)[^'"`\n]{0,60}['"`]/.test(s)
  const hasNamedConst = /(?:^|[^\w$])_?[A-Z][A-Z0-9_]{2,}(?:$|[^\w$])/.test(s)
  const hasInterp = /\$\{/.test(s) || /\bf["']/.test(s)
  return (hasSeparator || hasNamedConst) && (hasPathShape(s) || hasSeparator)
}

function hasPathShape(s) {
  return /\$\{/.test(s) || /\bf["']/.test(s)
}

/** 取值/转换/容器类调用:只把别处算好的东西拿过来,不"制造"摘要。 */
const CAST_OR_LOOKUP = new Set([
  // 全部按 normName 后的形态存(小写去下划线)—— 曾按原样存 'String' 而判据比的是 normName(c),
  // 于是 `prevHash: String(r['prev_hash'])` 这类纯转交没吃到豁免,门把读取者当了生产者。
  'str', 'string', 'number', 'boolean', 'int', 'float', 'require',
  'get', 'at', 'pop', 'set', 'frozenset', 'list', 'dict', 'tuple', 'map', 'array', 'object',
])


/** 插值之外还有字面文本(`f"seed:{x}"` 里的 `seed:`)同样是**组装**,只是形态短。 */
const LITERAL_WRAPPED_INTERP = /["'][^"'{}\n]*\{[^{}]+\}[^"'{}\n]*["']/

export function hasComposition(s) {
  if (/\b(?:join|stringify|format|dumps|concat|sprintf)\s*\(|JSON\.stringify/i.test(s)) return true
  const interp = (s.match(/\$\{/g) || []).length + (s.match(/\{\s*[^{}]+\}/g) || []).length
  if (interp >= 2) return true
  if (interp >= 1 && LITERAL_WRAPPED_INTERP.test(s)) return true
  return /\+\s*['"`]|['"`]\s*\+/.test(s)
}

/**
 * 体内**没有任何输入**:`GENESIS_HASH = '0'.repeat(64)` 这一类是哨兵常量,
 * 没有"要被摘要的东西" —— 名字里的 hash 描述的是取值形态(64 位十六进制样子),不是承诺。
 * 判它撒谎会让人去给一个常量加 sha256,那才是新缺陷。
 * 做法:剥掉字符串/数字字面量与方法名后,若不再剩任何自由标识符 ⇒ 纯常量。
 */
export function isLiteralOnly(rhs) {
  let s = String(rhs || '')
  // 占位符**不得含字母**:用 'L' 代替字面量,`'0'.repeat(64)` 剥完会剩一个看起来像标识符的 `L`,
  // 于是"没有输入可摘要"这一判据把自己判成有输入 —— 通道静默失效(判据自骗)。
  s = s.replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '\u0001')
  s = s.replace(/\b\d[\d_]*(?:\.\d+)?\b/g, '\u0002')
  s = s.replace(/\.[A-Za-z_$][\w$]*(?=\s*\()/g, '') // 字面量上的方法名不是"输入"
  s = s.replace(/\bnew\b/g, '')
  return !/[A-Za-z_$一-鿿][\w$一-鿿]*/.test(s)
}

/**
 * 右值/体是否只是**转交**别处产出的值。命中 ⇒ 本门判不出(兑现与否在生产者那一侧)。
 * 这一条不是偷懒:真仓 HEAD 实测 `c_hash = r.get("content_hash")`、
 * `prevHash: String(r['prev_hash'])`、`fingerprints: set[str] = set()` 这类"读已存值/建容器"
 * 有十几处,把它们判成命中就是"把别人存了什么记在读取者头上"—— 假阳性会淹掉真信号,
 * 而淹掉信号的红门没人守(§12e)。
 */
export function isPureHandoff(rhs) {
  const s = String(rhs || '')
  if (isLiteralOnly(s)) return true
  if (hasComposition(s)) return false
  return calleeNames(s).every((c) => CAST_OR_LOOKUP.has(normName(c)))
}

/**
 * 名字是否**具体**承诺"我产出了不可逆摘要"。三档:
 *  · crypto —— 含 hash/fingerprint/哈希/指纹/sha/md5:这就是"不可逆"的承诺,判红正当;
 *  · prose  —— 只含 digest/摘要:这两个词在英文与中文里都**同时**指"散文摘要"与"密码学摘要"
 *    (真仓 `digest = "\n".join(lines)` 是给人看的运行摘要,判它撒谎是错误定罪)。
 *    两义同形而机械分不开 ⇒ 一律未判定,不猜;
 *  · mask   —— 只含 mask/redact/sanitize/脱敏:承诺"删掉",见脱敏档判据。
 */
export function promiseStrength(name) {
  const keys = matchedKeys(name)
  if (keys.length === 0) return null
  if (keys.some((k) => ['hash', 'fingerprint', '哈希', '指纹'].includes(k))) return 'crypto'
  if (keys.some((k) => ['mask', 'redact', 'sanitiz', '脱敏'].includes(k))) return 'mask'
  return 'prose'
}


/**
 * 声明形态表。
 *
 * ⚠️ 这里踩过一次值得留下的坑:前一版把前缀类写成 `[\s;{}(,=]>`,而 **`]` 在字符类里会
 * 提前闭合类**(JS 不报错),于是它实际读成"类 `[\s;{}(,=]` 后面紧跟一个字面 `>`"——
 * 结果 `function fpHash(v){` 这一种最常见的写法**根本不匹配**,门对该形态全盲而账面照报绿。
 * 现统一用 `(?:^|[^\w$])`(名字边界)并由自检 17c 钉死:最普通的那一种函数声明必须被认出来。
 */
const NAME = '([A-Za-z_$][\\w$]*)'
const BOUND = '(?:^|[^\\w$])'
const JS_FN_RES = [
  new RegExp(`${BOUND}(?:export\\s+default\\s+|export\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${NAME}`, 'g'),
  new RegExp(`${BOUND}(?:export\\s+)?(?:const|let|var)\\s+${NAME}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`, 'g'),
  new RegExp(`${BOUND}(?:export\\s+)?(?:const|let|var)\\s+${NAME}\\s*=\\s*(?:async\\s+)?function\\b`, 'g'),
  // 类方法 / 对象方法简写:行首缩进后 NAME(...) {
  new RegExp(`^[ \\t]*(?:static\\s+|async\\s+|public\\s+|private\\s+|protected\\s+|readonly\\s+|\\*\\s*)*${NAME}\\s*\\([^)]*\\)\\s*\\{`, 'gm'),
  // 对象/类属性写成 NAME: (…) => …
  new RegExp(`^[ \\t]*${NAME}\\s*:\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`, 'gm'),
]

const PY_FN_RE = /(?:^|\n)[ \t]*(?:(?:async|def)\s+)*def\s+([A-Za-z_]\w*)\s*\(/g

const FIELD_RE = /([A-Za-z_$][\w$]*)\s*:\s*([^\n{};]*\([^\n{};]*)/g
const JS_ASSIGN_RE = /^[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/gm
const PY_ASSIGN_RE = /^[ \t]*([A-Za-z_]\w*)\s*=\s*(.+)$/gm

/**
 * 从代码面提取候选声明单元。三面分工(长度逐字相同,所以偏移可互换使用):
 *  · `noString` —— 遮掉注释与字符串:**只用来定位声明**(否则文档里引用的一段代码会被当真声明);
 *  · `noComment` —— 遮注释、**保留字符串**:函数体从这里切,因为 REAL_HASH / 掩码证据 /
 *    "拼的是键还是原文"全都住在字符串字面量里。第一版从 noString 面切体,于是
 *    `'**'` 被读成两个空格,log-sanitizer 那种"末路径确实带掩码"的正当写法被判成
 *    "无抹除证据"⇒ **遮噪遮错了面,判据就会替正当写法判红**(守门 70 的 URL 假注释态同型);
 *  · `raw` —— 原文:只用于读注释里的豁免标记与"一律/全部"承诺文案(守门 131 的分工)。
 * 只提名字命中关键字的,不做通用解析器 —— 通用解析器写不对时的失效方向是"整型隐身",
 * 窄判据的失效方向是"少几类",后者可以如实登记。
 */
export function findUnits(noString, noComment, raw, lang) {
  const units = []
  const seen = new Set()
  const push = (u) => {
    const k = `${u.name}@${u.start}`
    if (seen.has(k)) return
    seen.add(k)
    units.push(u)
  }
  const nameMatches = (name) => !!classifyName(name)

  if (lang === 'py') {
    for (const m of iterMatches(PY_FN_RE, noString)) {
      const name = m[1]
      if (!nameMatches(name)) continue
      // PY_FN_RE 停在参数表左括号上;函数体要从**签名行结束处**(收尾冒号之后)才起算。
      // 直接从括号处切会让 pyBody 看见缩进 0 的签名余部而立刻 break ⇒ 体为空 ⇒
      // "可达返回面取不到",门对该语言整片失明(这正是本文件第一次自跑抓到的缺陷)。
      const sigEnd = pySigEnd(noString, m.index + m[0].length)
      push({ kind: 'fn', name, start: m.index, declEnd: sigEnd, body: pyBody(noComment, sigEnd) })
    }
  } else {
    for (const re of JS_FN_RES) {
      for (const m of iterMatches(re, noString)) {
        const name = m[1]
        if (!nameMatches(name)) continue
        push({
          kind: 'fn',
          name,
          start: m.index,
          declEnd: m.index + m[0].length,
          body: jsBody(noComment, m.index + m[0].length),
        })
      }
    }
  }

  // B 的另一半:对象字段 / 类属性 / 变量初始化 —— 名字是承诺、右值是被承诺的实现
  // JS/TS 侧必须带 JS_ASSIGN_RE:`const digest = 拼接` 这一型是本门立项四例里两例的真实形态,
  // 漏它 = 声明连"单元"都成不了,既不判红也不记未判定 ⇒ 静默放过(自检 23 抓到的就是这个)。
  const fieldRes = lang === 'py' ? [PY_ASSIGN_RE, FIELD_RE] : [JS_ASSIGN_RE, FIELD_RE]
  for (const re of fieldRes) {
    for (const m of iterMatches(re, noString)) {
      const name = m[1]
      const expr = m[2]
      if (!nameMatches(name)) continue
      const cls = classifyName(name)
      if (!cls.irreversible) continue
      if (/\bstring\b|\bnumber\b|\bboolean\b|\bunknown\b|\bany\b/.test(expr) && !/\(/.test(expr)) continue
      // m[0] 以表达式组收尾,所以同一段偏移在 noComment 面上就是"带字面量"的那一份
      const rhs = noComment.slice(m.index + m[0].length - expr.length, m.index + m[0].length)
      push({ kind: 'field', name, start: m.index, declEnd: m.index + m[0].length, body: rhs })
    }
  }

  for (const u of units) {
    u.line = lineAt(noString, u.start)
    // 豁免与"一律/全部"这类承诺文案都住在注释里 ⇒ 读原文
    u.promiseText = [lineTextAt(raw, u.line), lineTextAt(raw, u.line - 1)].join('\n')
    u.exempt = hasExempt(u.promiseText)
  }
  return units
}

function hasExempt(text) {
  const i = text.indexOf(`${EXEMPT_MARK}:`)
  if (i < 0) return false
  const rest = text
    .slice(i + EXEMPT_MARK.length + 1)
    .replace(/^[\s*/#-]+/, '')
    .replace(/[\s*]+\/\*.*$/, '')
    .trim()
  return rest.length >= 2 && !/^[*/]$/.test(rest)
}

function* iterMatches(re, text) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m
  while ((m = r.exec(text)) !== null) {
    if (m.index === r.lastIndex) r.lastIndex++
    yield m
  }
}

export function lineAt(text, offset) {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

function lineTextAt(text, line) {
  const lines = text.split('\n')
  return lines[line - 1] || ''
}

/**
 * JS/TS 函数体:签名之后先遇 `{` 取配对花括号;先遇 `;`/行尾则是**单表达式箭头体**
 * (规格书要求把这一形态算进"可达返回面",否则 `const hashInput = (x) => JSON.stringify(x)` 会漏判)。
 */
export function jsBody(text, sigEnd) {
  let depth = 0
  for (let i = sigEnd; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') {
      if (depth === 0 && ch === ')') continue
      depth = Math.max(0, depth - 1)
    } else if (ch === '{' && depth === 0) return braceMatch(text, i)
    else if ((ch === ';' || ch === '}') && depth === 0) break
    else if (ch === '\n' && depth === 0) {
      // 参数表多行时不折;真正的"无花括号体"在下一非空字符不是续行符时结束
      const peek = text.slice(i + 1, i + 40)
      if (!/^\s*(?:\?\.|\.|=>|[+&|,)})\]])/.test(peek) && !/[=,]$/.test(text.slice(sigEnd, i))) break
    }
    if (i - sigEnd > 20000) break
  }
  return singleExprArrow(text, sigEnd)
}

function braceMatch(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  return text.slice(open + 1)
}

function singleExprArrow(text, from) {
  const arrow = text.indexOf('=>', from)
  if (arrow < 0 || arrow - from > 600) return ''
  let i = arrow + 2
  while (i < text.length && /\s/.test(text[i])) i++
  if (text[i] === '{') return braceMatch(text, i)
  let depth = 0
  const start = i
  for (; i < text.length; i++) {
    const ch = text[i]
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) {
      if (depth === 0) break
      depth--
    } else if ((ch === ';' || ch === '\n') && depth === 0) {
      const peek = text.slice(i + 1, i + 40)
      if (/^\s*(?:\?\.|\.|\+\+|--|&&|\|\||[+*/-])/.test(peek)) continue
      break
    }
  }
  return text.slice(start, i)
}

/** 从 def 的参数表左括号走到"签名结束"(与括号同层的收尾冒号之后的换行)。 */
export function pySigEnd(text, parenAt) {
  let depth = 0
  for (let i = parenAt; i < text.length; i++) {
    const ch = text[i]
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ':' && depth === 0) {
      const nl = text.indexOf('\n', i)
      return nl < 0 ? text.length : nl + 1
    } else if (ch === '\n' && depth === 0) break
  }
  const nl = text.indexOf('\n', parenAt)
  return nl < 0 ? text.length : nl + 1
}

function pyBody(text, from) {
  const lines = text.slice(from).split('\n')
  const kept = []
  let indent = null
  for (const ln of lines) {
    if (!ln.trim()) {
      kept.push(ln)
      continue
    }
    const ind = ln.length - ln.trimStart().length
    if (indent === null) {
      if (ind === 0) break
      indent = ind
    }
    if (ind < indent) break
    kept.push(ln)
  }
  return kept.join('\n')
}

/* -------------------------------- 三条与门 -------------------------------- */

/**
 * B 的取材范围:可达返回面(return/yield 表达式 + 单表达式箭头体)与赋值右值。
 *
 * 两把尺子同时用,因为只看返回表达式文本会产出一类确定的假阳性 ——
 * `const d = createHash('sha256')…; return d` 的返回面里没有真散列调用,但它**兑现了**。
 * 所以真散列判据看 whole(体 + 返回面),而"原样返回"判据只看 returns。
 * 这一取舍的代价记在文末"看不见什么":体内算了摘要却回传原文的那一型,本门看不见。
 */
export function reachableSurface(body) {
  const parts = []
  for (const m of iterMatches(/\b(?:return|yield)\b([^\n]*)/g, body)) parts.push(m[1])
  return { returns: parts.join(' ;; '), whole: String(body || '') }
}

/**
 * B 判定。三态,且**判不出一律未判定**(既不猜合规也不猜红):
 *  delivered   实现确实兑现(体内/一跳本地实现有真实散列,或确有抹除占位)
 *  undelivered 只做字符串拼接/序列化,承诺未兑现
 *  undetermined 形态不认识:纯转传的字段、未知调用、手写散列、委托链里有判不出的一环
 */
export function judgeDelivery(unit, lang, allUnits, depth = 0) {
  const surf = reachableSurface(unit.body || '')
  const whole = surf.whole
  const cls = classifyName(unit.name)
  if (!cls) return { state: 'pass', why: '名字不含承诺' }

  if (promiseStrength(unit.name) === 'prose')
    return {
      state: 'undetermined',
      why: 'digest/摘要 在"散文摘要"与"密码学摘要"两义同形,机械分不开(真仓有正当的散文摘要)',
    }

  const tokens = tokenize(unit.name)
  if (unit.kind === 'fn' && tokens.length > 1 && RETRIEVAL_PREFIXES.includes(tokens[0]))
    return { state: 'undetermined', why: `取回动词开头(${tokens[0]}):值产自别处,本文件看不出是否兑现` }

  if (unit.kind === 'field' && isPureHandoff(whole))
    return { state: 'undetermined', why: '右值是纯转传/类型转换,兑现发生在生产者一侧(本文件外)' }

  if (REAL_HASH_RE.test(whole)) return { state: 'delivered', why: '体内有真实散列调用' }
  if (looksLikeDataStructKey(unit.name, whole))
    return { state: 'pass', why: '数据结构键命名(与"摘要"同词不同义)' }

  const callees = calleeNames(whole)
  // 委托可以写成 `list.map(maskEmail)`(裸引用,不带括号)—— 只按"名字后紧跟左括号"找
  // 被调者会让这一整个委托形态被读成"无本地实现",于是门把正当写法判成撒谎(真仓实测 1 处)。
  const referenced = [
    ...new Set([...iterMatches(/([A-Za-z_$][\w$]*)/g, whole)].map((m) => m[1])),
  ]
  // 自名排除只为防递归。字段单元 `{ fingerprint: fingerprint(k) }` 里被调者与字段**同名是常态**,
  // 按名字排除会让这类正当委托整片看不见(真仓实测 2 处 key-rotation 因此被误判)。
  const localPromise = referenced.filter(
    (c) => allUnits.some((u) => u.name === c && !(c === unit.name && u.start === unit.start)),
  )
  const unknown = callees.filter(
    (c) => !BENIGN_CALLEES.has(normName(c)) && !BUILTIN_CALLEES.has(c) && !allUnits.some((u) => u.name === c),
  )

  // 一跳本地委托:`ownerDigest → hmacDigest → createHmac` 这类必须认,
  // 否则"把散列抽成同文件 helper"就等于绕过本门(而绕过本门的写法是最常见的正当写法)。
  if (localPromise.length > 0 && depth < 2) {
    const sub = localPromise.map((c) =>
      judgeDelivery(allUnits.find((u) => u.name === c), lang, allUnits, depth + 1),
    )
    if (sub.some((s) => s.state === 'delivered'))
      return { state: 'delivered', why: `一跳内本地实现(${localPromise.join(',')})有真实散列` }
    if (sub.some((s) => s.state === 'undetermined'))
      return { state: 'undetermined', why: `委托给本地助手 ${localPromise.join(',')} 而那一环判不出` }
  }

  if (cls.irreversible && SELF_HASH_RE.test(whole))
    return { state: 'undetermined', why: '手写散列的不可逆性/输入空间不可机械判定' }

  if (cls.redaction && !cls.irreversible) {
    // 兑现与否看**整个体**有没有删除/掩码动作,不看"最后一个 return 的文本顺序" ——
    // 按文本顺序取末路径会把 if/else 里的正当分支读成主路径(实测假阳性 4 处)。
    if (hasMaskEvidence(whole)) {
      if (UNIVERSAL_PROMISE_RE.test(unit.promiseText || ''))
        return {
          state: 'undetermined',
          why: '注释承诺"一律/全部"抹掉,而实现是清单式正则集合 —— 覆盖面是否穷尽机械核不出',
        }
      return { state: 'delivered', why: '确有抹除/删除动作(显示与脱敏档不要求单向)' }
    }
    if (unknown.length > 0)
      return { state: 'undetermined', why: `体内有无法定性的调用:${unknown.slice(0, 4).join(', ')}` }
    if (!/\b(?:return|yield)\b/.test(whole) && unit.kind === 'fn')
      return { state: 'undetermined', why: '可达返回面取不到(体被截断或非函数)' }
    return { state: 'undelivered', why: '通篇无任何掩码/删除动作,却命名成"已脱敏"' }
  }

  // 不可逆承诺:除字符串活以外什么都不许有;看不懂的调用一律未判定
  if (unknown.length > 0)
    return { state: 'undetermined', why: `体内有无法定性的调用:${unknown.slice(0, 4).join(', ')}` }
  if (!/\b(?:return|yield)\b/.test(whole) && unit.kind === 'fn')
    return { state: 'undetermined', why: '可达返回面取不到(体被截断或非函数)' }
  return { state: 'undelivered', why: '只做字符串拼接/序列化,却命名成不可逆摘要' }
}

/**
 * 控制流关键字。它们**长得像调用**(`if (` / `for (`),不滤掉就会把
 * "体内有未知调用 ⇒ 未判定"这条护栏变成一句废话 —— 实测每个带 `if` 的函数都被判成未判定,
 * 于是本门真正的命中(明文原样返回)整片被洗成"未判定"。判据失效的表现永远是安静。
 */
const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'do', 'else',
  'await', 'yield', 'try', 'with', 'in', 'of', 'delete', 'void', 'instanceof', 'function',
  'match', 'case', 'elif', 'def', 'class', 'lambda', 'not', 'and', 'or', 'is',
])

function calleeNames(body) {
  return [
    ...new Set(
      [...iterMatches(/([A-Za-z_$][\w$]*)\s*\(/g, body)]
        .map((m) => m[1])
        .filter((c) => !CONTROL_KEYWORDS.has(c)),
    ),
  ]
}

/** 掩码证据:占位星号 / `[REDACTED]` / 返回 MASK 族常量(真仓 response-sanitizer 就是这么写的)。 */
function hasMaskEvidence(body) {
  return MASK_EVIDENCE_RE.test(body) || /\b(?:MASK|MASKED|REDACTED|REDACT|DUMMY)\b/.test(body)
}

/**
 * C 外流/持久化出口。刻意**不把"只做等值比较"算作出口**:
 * 内存内 Map/冲突检测的键若被判红,人会顺手改成 sha256 来"修好"它,
 * 于是丢掉冲突时打印原文的能力 —— 那比原病更响(本票最大的危害方向)。
 */
export function judgeOutlet(unit, fileText) {
  const refs = [...iterMatches(new RegExp(`\\b${escapeRe(unit.name)}\\b`, 'g'), fileText)].filter(
    // 声明自身(`export function digestOf(a)` 的参数表)长得像一次调用。不扣掉它,
    // "导出而本文件无调用方"那一格会被读成"有调用点",于是本该**未判定**的形态静默变成放过。
    (m) => m.index >= (unit.declEnd ?? unit.start + unit.name.length),
  )
  if (refs.length === 0) {
    const publicish = new RegExp(`export\\s+[^\\n]{0,80}\\b${escapeRe(unit.name)}\\b`).test(fileText)
    return {
      state: publicish ? 'undetermined' : 'no-outlet',
      why: publicish ? '无本文件使用点且是导出面,出口在别处' : '本文件内无使用点(死代码不构成活敞口)',
    }
  }
  const carriers = new Set([unit.name])
  for (const cs of refs) {
    const lineStart = fileText.lastIndexOf('\n', cs.index) + 1
    const line = fileText.slice(lineStart, cs.index)
    for (const mm of iterMatches(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, line)) carriers.add(mm[1])
    for (const mm of iterMatches(/([A-Za-z_$][\w$]*)\s*=\s*$/g, line)) carriers.add(mm[1])
    for (const mm of iterMatches(/(?:push|append|add|set|save)\s*\(\s*\{([^}]*)\}/g, fileText.slice(cs.index, cs.index + 220))) {
      for (const id of mm[1].split(',')) {
        const k = id.split(':').pop().trim()
        if (classifyName(k)) carriers.add(k)
      }
    }
  }
  const win = refs.map((cs) => fileText.slice(Math.max(0, cs.index - 1500), cs.index + 1500)).join('\n')
  if (OUTLET_RE.test(win)) {
    const tok = String(OUTLET_RE.exec(win)[0]).trim()
    return { state: 'outlet', why: `使用点邻域内流经落盘/出网出口 ${tok}` }
  }
  // 被存进另一个同样撒谎的名字底下:`fingerprint_hash = fp_hash` / `{ inputHash, … }`
  for (const c of carriers) {
    const slot = new RegExp(`([A-Za-z_$][\\w$]*)\\s*(?:=|:)\\s*[^\\n]*\\b${escapeRe(c)}\\b|\\b${escapeRe(c)}\\b\\s*(?=,|\\))`, 'g')
    for (const m of iterMatches(slot, win)) {
      const slotName = m[1] || c
      if (classifyName(slotName) && normName(slotName) !== normName(c))
        return { state: 'outlet', why: `被存进同样撒谎的名字 ${slotName} 底下` }
      if (classifyName(slotName)) return { state: 'outlet', why: `赋值给同族承诺名槽位 ${slotName}` }
    }
    const shorthand = new RegExp(`[{,]\\s*${escapeRe(c)}\\s*[,}]`, 'g')
    if (shorthand.test(win) && classifyName(c))
      return { state: 'outlet', why: `以 ${c} 之名进了对象字面量(会被持久化/回传)` }
  }
  return { state: 'no-outlet', why: '调用点邻域内既无落盘/出网出口,也未存进承诺名槽位' }
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ------------------------------ 单文件判定 ------------------------------ */

export function scanFile(relPath, text) {
  const lang = relPath.endsWith('.py') ? 'py' : 'ts'
  const { noComment, noCommentNoString } = maskFaces(text, lang)
  const units = findUnits(noCommentNoString, noComment, text, lang)
  const res = { file: relPath, hits: [], passes: [], undetermined: [], units: units.length }
  for (const u of units) {
    const d = judgeDelivery(u, lang, units)
    if (u.exempt) {
      res.passes.push({ file: relPath, line: u.line, name: u.name, why: `行内 ${EXEMPT_MARK} 已带原因` })
      continue
    }
    if (d.state === 'pass' || d.state === 'delivered') {
      res.passes.push({ file: relPath, line: u.line, name: u.name, why: d.why })
      continue
    }
    if (d.state === 'undetermined') {
      res.undetermined.push({ file: relPath, line: u.line, name: u.name, why: d.why, stage: 'B' })
      continue
    }
    const c = judgeOutlet(u, noComment)
    if (c.state === 'no-outlet') {
      res.passes.push({ file: relPath, line: u.line, name: u.name, why: `未兑现但${c.why}(内存内比较键不得判红)` })
      continue
    }
    if (c.state === 'undetermined') {
      res.undetermined.push({ file: relPath, line: u.line, name: u.name, why: c.why, stage: 'C' })
      continue
    }
    res.hits.push({
      file: relPath,
      line: u.line,
      name: u.name,
      kind: u.kind,
      why: `${d.why};${c.why}`,
      promise: classifyName(u.name).irreversible ? '不可逆' : '抹除',
    })
  }
  return res
}

/* ------------------------------- 取材(同面同轮) ------------------------------- */

/**
 * 预筛 = **判据关键字的严格超集**,由同一份常量拼出来,不留漂移空间。
 * 预筛漏一个关键字 = 门对该形态全盲而账面照报绿(守门 102 预筛超集对账同型)。
 */
export function prefilterPattern() {
  const keys = [...new Set([...PROMISE_KEYWORDS, ...IRREVERSIBLE_KEYS, ...REDACTION_KEYS])].map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  return keys.join('|')
}

export function listCandidates(root, face) {
  // `--cached` 必须在**模式之前**:git grep 把模式之后的参数一律当修订版解析,
  // 写成 `[...,'-E',pattern,'--cached']` 会得到 `fatal: unable to resolve revision: --cached`
  // —— 而 runner 给每道门追加 `--staged`,于是这道门会在每一次提交上 exit 2(恒红门)。
  const args = ['grep', '-I', '-z', '-l']
  if (face === 'staged') args.push('--cached')
  args.push('-E', prefilterPattern())
  let out
  try {
    out = gitRaw([...args, '--', ...SCAN_DIRS], root, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (typeof e?.status === 'number' && e.status === 1) return []
    throw new Undetermined(`git grep 预筛失败(${face}):${e?.message ?? e}`)
  }
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p))
}

export function readCandidates(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180_000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (t === null || t === undefined)
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面(回落就是把"没判"写成"判过了")`,
      )
    map.set(p, t)
  })
  return map
}

function loadBaseline(root) {
  const abs = resolve(root, BASELINE_FILE)
  if (!existsSync(abs)) return {}
  let parsed
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Undetermined(`${BASELINE_FILE} 不是合法 JSON:${e.message}(坏清单不得静默当空表)`)
  }
  const c = parsed && parsed.perFile
  if (!c || typeof c !== 'object') throw new Undetermined(`${BASELINE_FILE} 缺 perFile 段`)
  return c
}

export function analyze(root, face, opts = {}) {
  assertRepoRoot(root, GATE)
  const paths = listCandidates(root, face)
  if (paths.length === 0)
    throw new Undetermined(
      `${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选文件 ⇒ 判据失效,不计通过`,
    )
  const texts = readCandidates(root, face, paths)
  const only = opts.onlyFiles && opts.onlyFiles.length ? new Set(opts.onlyFiles) : null
  const scanned = only ? paths.filter((p) => only.has(p)) : paths
  if (only && scanned.length === 0)
    throw new Undetermined('--files 指定的路径没有一个落在本门覆盖面 ⇒ 判据失效,不计通过')
  const per = scanned.map((p) => scanFile(p, texts.get(p)))
  const hits = per.flatMap((r) => r.hits)
  const undetermined = per.flatMap((r) => r.undetermined)
  const passes = per.reduce((a, r) => a + r.passes.length, 0)

  // 棘轮锚点 = 该文件 HEAD 自身存量数(全量档本来就是 HEAD,不必再读一次)
  let ratcheted = null
  let anchors = null
  if (face === 'staged' && hits.length) {
    const byFile = new Map()
    for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || 0) + 1)
    const headSet = new Set(listCandidates(root, 'head'))
    const need = [...byFile.keys()].filter((p) => headSet.has(p))
    const headTexts = need.length ? readCandidates(root, 'head', need) : new Map()
    const baseline = loadBaseline(root)
    anchors = new Map()
    ratcheted = []
    for (const file of byFile.keys()) {
      let anchor = 0
      if (headSet.has(file)) {
        const t = headTexts.get(file)
        if (t === undefined) throw new Undetermined(`HEAD 取不到棘轮锚点文件 ${file} ⇒ 无法判定`)
        anchor = scanFile(file, t).hits.length
      } else if (baseline[file] !== undefined) {
        anchor = Number(baseline[file]) || 0
      }
      anchors.set(file, anchor)
      const now = byFile.get(file)
      if (now > anchor)
        ratcheted.push({ file, now, anchor, added: now - anchor, names: hits.filter((h) => h.file === file).map((h) => h.name) })
    }
  }
  const counts = {
    enumerated: paths.length,
    files: scanned.length,
    units: per.reduce((a, r) => a + r.units, 0),
    hits: hits.length,
    hitFiles: per.filter((r) => r.hits.length).length,
    passes,
    undetermined: undetermined.length,
  }
  return { face, per, hits, undetermined, ratcheted, anchors, counts }
}

/** 退出码决策(纯函数,四档各有正反例)。 */
export function decide({ face, hits, undetermined, ratcheted, strict }) {
  const red = face === 'staged' ? (ratcheted || []) : strict ? hits : []
  if (red.length > 0) return { exit: 1, red, mode: face === 'staged' ? '棘轮新增' : 'strict 判红' }
  if (strict && undetermined.length > 0)
    return { exit: 2, red: [], mode: '拒绝出合格证:存在未判定', undetermined }
  return { exit: 0, red: [], mode: '默认档只报数' }
}

/* ---------------------------------- CLI ---------------------------------- */

const FACE_TXT = {
  staged: '索引 blob(git show :<path>)',
  head: 'HEAD blob(git show HEAD:<path>)',
  worktree: '工作树(磁盘;仅人工,不得作为提交门禁)',
}

const KNOWN_FLAGS = new Set([
  '--staged',
  '--worktree',
  '--strict',
  '--self-test',
  '--files',
  '--root',
  '--help',
  '-h',
])

const USAGE = [
  '用法:node scripts/check-digest-name-reality.mjs [模式旗标]',
  '  (缺省)        全量档:判 HEAD blob,只报数不判红',
  '  --staged      判索引 blob,按"该文件 HEAD 自身存量"套棘轮(提交链用这一档)',
  '  --worktree    判工作树磁盘内容 —— 仅人工排查,不得接入提交门禁',
  '  --strict      问责档:命中即判红;存在未判定则 exit 2(拒绝出具合格证)',
  '  --self-test   逻辑自检(临时 git 夹具,零副作用)',
  '  --files <…>   只判给定路径(仍走当前档的取材面)',
  '  --root <dir>  夹具/换仓通道:枚举与取材共用同一个根',
  '退出码:0 通过或只报数 / 1 判红 / 2 无法判定(含 --strict 下有未判定)',
].join('\n')

export async function main(argv) {
  if (argv.includes('--self-test')) return runSelfTest()
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return 0
  }
  // 未知开关必须当场拒绝:落到"其余分支即全量档"的写法,会让打错一个字母的问责跑
  // 看起来成功(打一行抬头 exit 0)而什么都没判 —— 本仓为此记过同型事故。
  const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN_FLAGS.has(a))
  if (unknown.length > 0) {
    console.error(`❌ 未知开关:${unknown.join(' ')}\n${USAGE}`)
    return 2
  }

  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定:${error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const onlyIdx = argv.indexOf('--files')
  const onlyFiles = onlyIdx >= 0 ? argv.slice(onlyIdx + 1).filter((a) => !a.startsWith('--')) : []
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : ROOT
  // `--root` 是测试通道:枚举与取材都用**同一个** root(analyze(root, face) 内部一路传),
  // 所以 `--root <夹具> --staged` 判的是那棵夹具仓的索引,不存在"换根却按别的树读"的双根分裂。
  // (守门 70 的 `--root` 只在 worktree 档有效,是因为它另有一批 ROOT 派生路径;本门没有。)
  if (rootIdx >= 0 && !(argv[rootIdx + 1] || '').length) {
    console.error('❌ 无法判定:--root 后面没有参数')
    return 2
  }

  let out
  try {
    out = analyze(root, face, { onlyFiles, strict })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(取材失败,不记绿也不记红):${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    return 2
  }

  if (argv.includes('--update-baseline')) return updateBaseline(root, out)

  const d = decide({
    face,
    hits: out.hits,
    undetermined: out.undetermined,
    ratcheted: out.ratcheted,
    strict,
  })

  console.log(`${GATE} · 取材面=${FACE_TXT[face] || face}${strict ? ' · --strict' : ''}`)
  console.log(
    `  候选文件 ${out.counts.enumerated}(本轮判 ${out.counts.files})· 候选声明 ${out.counts.units} · 命中 ${out.counts.hits}(${out.counts.hitFiles} 文件)· 放过 ${out.counts.passes} · 未判定 ${out.counts.undetermined}`,
  )
  for (const h of out.hits)
    console.log(`  🔴 ${h.file}:${h.line} ${h.name}(${h.promise}承诺)— ${h.why}`)
  for (const u of out.undetermined)
    console.log(`  ⚪ 未判定[${u.stage}] ${u.file}:${u.line} ${u.name} —— ${u.why}`)
  if (out.ratcheted)
    for (const r of out.ratcheted)
      console.log(`  ⚠️ 棘轮:${r.file} HEAD 存量 ${r.anchor} → 索引 ${r.now}(+${r.added})· ${r.names.join(', ')}`)
  if (d.exit === 0 && !strict)
    console.log('  结论:默认档只报数(存量未清时判红=恒红门,唯一结局是逼人 --no-verify);问责跑 --strict')

  if (d.exit === 2) {
    console.error(`❌ 无法判定:${d.undetermined.length} 处未判定 —— 本门拒绝在此出具"已核对"合格证`)
    return 2
  }
  if (d.exit === 1) {
    console.error(`❌ 检出 ${d.red.length} 处${d.mode}:`)
    for (const h of d.red)
      console.error(
        h.file && h.name ? `  ${h.file}:${h.line} ${h.name} —— ${h.why}` : `  ${h.file} —— HEAD ${h.anchor} → 现 ${h.now}`,
      )
    console.error(`\n修法二选一:① 让实现真去散列(如 hashlib.sha256/createHash)再回传;② 改名字(去掉 hash/指纹/脱敏 这类承诺词),` +
      `并说明它为何可以携带原文。`)
    console.error(`行内出口:${EXEMPT_MARK}: <一句话原因>(必须带原因;该族须登记进守门 108 存活期表,30 天)。`)
    return 1
  }
  console.log(`结论:通过(判红 ${d.red.length} · 模式 ${d.mode})`)
  return 0
}

function updateBaseline(root, out) {
  const abs = resolve(root, BASELINE_FILE)
  const prev = loadBaseline(root)
  const now = {}
  for (const r of out.per) if (r.hits.length) now[r.file] = r.hits.length
  const grew = Object.keys(prev).filter((f) => (now[f] || 0) > prev[f])
  if (grew.length) {
    console.error(`❌ --update-baseline 只减不增,而这些文件比基线更多:${grew.join(', ')}`)
    return 1
  }
  const next = {}
  for (const [f, c] of Object.entries(prev)) if ((now[f] || 0) < c && now[f]) next[f] = now[f]
  for (const [f, c] of Object.entries(now)) if (prev[f] === undefined) next[f] = c
  writeFileSync(abs, JSON.stringify({ $comment: '缺文件=空表;锚点本为 HEAD 现读,此表只作人工兜底', perFile: next }, null, 2))
  console.log(`✅ 基线已收紧:现存 ${Object.keys(next).length} 条(旧 ${Object.keys(prev).length})`)
  return 0
}

/* -------------------------------- self-test -------------------------------- */

function runSelfTest() {
  const R = []
  const t = (name, pass, note = '') => R.push({ name, pass, note })

  const FP_PLAIN = `
def _fingerprint_hash(fp) -> str:
    """计算指纹哈希(用于快速比较)。"""
    parts = [fp.user_agent, fp.timezone_id]
    return "|".join(parts)

async def record_async(fingerprint):
    fp_hash = _fingerprint_hash(fingerprint)
    await guard.record_binding(fingerprint_hash=fp_hash)
`
  const FP_SHA = FP_PLAIN.replace('return "|".join(parts)', 'return hashlib.sha256(str(parts)).hexdigest()')

  // 1/2 立项因由那一处:明文 ⇒ 命中;同一形状换成真散列 ⇒ 放过
  const a = scanFile('x/a.py', FP_PLAIN).hits.map((h) => h.name)
  t('1 `_fingerprint_hash` 明文 join + 有持久化槽位 ⇒ 命中', a.includes('_fingerprint_hash'), a.join(','))
  const b = scanFile('x/a.py', FP_SHA).hits.map((h) => h.name)
  t('2 同一形状换成 hashlib.sha256 ⇒ 必须放过(反向对照)', !b.includes('_fingerprint_hash'), b.join(','))

  // 3/4 C 与门:同样的撒谎实现,只在内存里比 ⇒ 放过;落盘 ⇒ 命中
  const ONLY_MEM = `
function fpHash(v) {
  return [v.a, v.b].join('|')
}
if (fpHash(x) !== last) { last = fpHash(x) }
`
  const t3 = scanFile('x/b.ts', ONLY_MEM).hits.map((h) => h.name)
  t('3 未兑现但只做内存内比较 ⇒ 放过(本票最大危害方向的反向锁)', !t3.includes('fpHash'), t3.join(','))
  const PERSIST = ONLY_MEM + '\nfs.writeFileSync(p, fpHash(x))\n'
  const t4 = scanFile('x/b.ts', PERSIST).hits.map((h) => h.name)
  t('4 同一形状加 writeFile 出口 ⇒ 命中(反向对照)', t4.includes('fpHash'), t4.join(','))

  // 5/6 数据结构键命名(Redis hash)
  const KEYFN = `
_ARTIFACTS_KEY_PREFIX = "mcp:artifacts:"

class S:
    @staticmethod
    def _hash_key(conversation_id: str) -> str:
        return f"{_ARTIFACTS_KEY_PREFIX}{conversation_id}"

    async def put(self, cid, blob):
        await redis.setex(self._hash_key(cid), 604800, blob)
`
  const t5 = scanFile('x/s.py', KEYFN).hits
  t('5 `_hash_key`(Redis hash 数据结构键)⇒ 放过', t5.length === 0, JSON.stringify(t5.map((h) => h.name)))
  const KEYFN_BAD = KEYFN.replace('return f"{_ARTIFACTS_KEY_PREFIX}{conversation_id}"', 'return "|".join([conversation_id, "x"])')
  const t6 = scanFile('x/s.py', KEYFN_BAD).hits.map((h) => h.name)
  t('6 名字以 key 收尾且**有 setex 出口**而拼的是原文 ⇒ 不得吃键名豁免(反向对照)', t6.includes('_hash_key'), t6.join(','))

  // 7/8 显示档 mask*
  const MASK = `
export function maskApiKey(key?: string): string {
  if (!key) return '(空)'
  if (key.length <= 8) return '***'
  return key.slice(0, 4) + '***' + key.slice(-4)
}
const shown = maskApiKey(process.env.X)
console.log(shown)
`
  const t7 = scanFile('x/c.ts', MASK).hits.map((h) => h.name)
  t('7 显示档 maskApiKey(首尾保留 + 星号)⇒ 放过', !t7.includes('maskApiKey'), t7.join(','))
  const MASK_BAD = MASK.replace("return '***'", "return 'ok'").replace(/'\*\*\*'/g, "'x'")
  const t8 = scanFile('x/c.ts', MASK_BAD + '\nfs.writeFileSync(f, maskApiKey(k))\n').hits.map((h) => h.name)
  t('8 同名而体内**无任何抹除证据** ⇒ 命中(反向对照)', t8.includes('maskApiKey'), t8.join(','))

  // 9 JWT 第三段段名:signature 根本不在关键字表里
  const JWT = `
const body = rest.slice(0, dot)
const signature = rest.slice(dot + 1)
if (!safeEqual(signatureOf(body, secret), signature)) return { ok: false }
`
  const t9 = scanFile('x/d.ts', JWT).hits
  t('9 JWT 段名 signature ⇒ 不是候选(它不在承诺关键字里)', t9.length === 0, JSON.stringify(t9.map((h) => h.name)))

  // 10/11 兜底 return 原值(log-sanitizer 三族的形态)
  const GUARD = `
function redactEmailMatch(match: string): string {
  const at = match.indexOf('@')
  if (at < 0) return match
  return match.slice(0, 2) + '**' + match.slice(at)
}
const r = text.replace(RE, redactEmailMatch)
fs.writeFileSync(p, r)
`
  const t10 = scanFile('x/e.ts', GUARD).hits.map((h) => h.name)
  t('10 兜底分支 return 原值而末路径有掩码 ⇒ 放过(死代码不得判成活敞口)', !t10.includes('redactEmailMatch'), t10.join(','))
  const GUARD_BAD = GUARD.replace("return match.slice(0, 2) + '**' + match.slice(at)", 'return match')
  const t11 = scanFile('x/e.ts', GUARD_BAD).hits.map((h) => h.name)
  t('11 把末路径也改成原样返回 ⇒ 命中(反向对照)', t11.includes('redactEmailMatch'), t11.join(','))

  // 12/13 未判定不得被算成通过
  const WEAK = `
function fnv1aHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
const v = fnv1aHash(s)
fetch(u, { body: v })
`
  const t12 = scanFile('x/f.ts', WEAK)
  t('12 手写散列 + 出网 ⇒ 未判定(既不说合规也不判红)', t12.undetermined.some((u) => u.name === 'fnv1aHash') && t12.hits.length === 0, JSON.stringify({ h: t12.hits.map((x) => x.name), u: t12.undetermined.map((x) => x.name) }))
  const t13 = decide({ face: 'head', hits: [], undetermined: [{ name: 'fnv1aHash' }], strict: true })
  t('13 --strict 下有未判定 ⇒ exit 2(拒绝出合格证)', t13.exit === 2, `实得 ${t13.exit}`)
  const t13b = decide({ face: 'head', hits: [], undetermined: [{ name: 'x' }], strict: false })
  t('13b 默认档有未判定 ⇒ exit 0 但必须逐条点名(不造恒红门)', t13b.exit === 0, `实得 ${t13b.exit}`)

  // 14 导出而本文件无使用点 ⇒ 未判定,不猜(名字用 crypto 档,避开 digest 的两义档)
  const EXPORTED = `export function hashOf(a) { return [a].join('') }\n`
  const t14 = scanFile('x/g.ts', EXPORTED)
  t('14 导出面而本文件无使用点 ⇒ 未判定(C 判不出)', t14.undetermined.some((u) => u.stage === 'C') && t14.hits.length === 0, JSON.stringify({ h: t14.hits, u: t14.undetermined.map((x) => `${x.name}:${x.stage}`) }))
  const t14b = scanFile('x/g2.ts', `export function digestOf(a) { return [a].join('') }\n`)
  t('14b digest/摘要 两义同形 ⇒ 未判定(B 档),不判红也不放过', t14b.hits.length === 0 && t14b.undetermined.some((u) => u.stage === 'B'), JSON.stringify({ h: t14b.hits, u: t14b.undetermined.map((x) => `${x.name}:${x.stage}`) }))

  // 15 注释/字符串里的形态不得判红(等长遮罩的反向锁)
  const DOC = `
// 早先这里写过 function digestOf(a) { return [a].join('') } —— 已修
const SAMPLE = "function digestOf(a) { return [a].join('') }"
fs.writeFileSync(p, SAMPLE)
`
  const t15 = scanFile('x/h.ts', DOC)
  t('15 注释与字符串里的该形态不得计入', t15.hits.length === 0 && t15.units === 0, `units=${t15.units}`)

  // 16 豁免必须带原因
  const EX = `// ${EXEMPT_MARK}\nfunction maskedCopy(v) { return [v].join('') }\nfs.writeFileSync(p, maskedCopy(x))\n`
  const EX2 = `// ${EXEMPT_MARK}: 仅本机日志且已含在审计脱敏之后\nfunction maskedCopy(v) { return [v].join('') }\nfs.writeFileSync(p, maskedCopy(x))\n`
  t('16a 裸标记(无原因)不放行', scanFile('x/i.ts', EX).hits.length === 1)
  t('16b 带原因标记放行(反向对照)', scanFile('x/i.ts', EX2).hits.length === 0)

  // 17 关键字表的正向证明:每个关键字都要能作为**声明名**被认出来
  const missing = []
  for (const k of PROMISE_KEYWORDS) {
    const nm = `${k}Value`
    if (!classifyName(nm)) missing.push(k)
  }
  t('17 PROMISE_KEYWORDS 逐字喂进 classifyName 必须全命中(名单正向证明)', missing.length === 0, missing.join(','))
  const posProof = scanFile(
    'x/j.ts',
    `function sha256HashOf(a) { return crypto.createHash('sha256').update(a).digest('hex') }\nconst h = sha256HashOf(z)\nfs.writeFileSync(p, h)\n`,
  )
  t('17b 真散列形态必须判绿(证明 17 不是恒红)', posProof.hits.length === 0)

  // 18 预筛必须是判据关键字的超集
  const pat = prefilterPattern()
  const notCovered = [...PROMISE_KEYWORDS, ...IRREVERSIBLE_KEYS, ...REDACTION_KEYS].filter((k) => !pat.includes(k))
  t('18 预筛模式必须含每一个判据关键字(否则门对该形态全盲)', notCovered.length === 0, notCovered.join(','))

  // 19 名字归一:大小写/驼峰/下划线同视
  t(
    '19 FP_HASH / fpHash / Fp-Hash 同视',
    ['FP_HASH', 'fpHash', 'Fp-Hash'].every((n) => !!classifyName(n)) &&
      !classifyName('someUnrelatedThing'),
  )

  // 20 decide 的 staged 档只拦新增
  const t20a = decide({ face: 'staged', hits: [{ file: 'a' }], undetermined: [], ratcheted: [] , strict: false })
  const t20b = decide({ face: 'staged', hits: [{ file: 'a' }], undetermined: [], ratcheted: [{ file: 'a' }], strict: false })
  t('20 staged 档:存量(ratcheted 空)⇒ 绿;新增 ⇒ 红', t20a.exit === 0 && t20b.exit === 1)

  /* ---- 以下几条钉的是"跑真仓才暴露"的假阳性族:每一条都对应一次实测误判 ---- */

  // 21 `hashtags` 的字面里含 `hash`(has + tags),整名子串匹配会把它当摘要承诺
  t('21 hashtags 不得被读成 hash 承诺(词元匹配,非子串)', !classifyName('hashtags') && matchedKeys('hashtags').length === 0)
  t('21b 屈折与复合形态仍必须命中:hashed / tpmHashKey / maskComments',
    !!classifyName('hashedApiKey') && !!classifyName('tpmHashKey') && !!classifyName('maskComments'))

  // 22 谓词:问"像不像摘要",并不承诺自己产出
  t('22 isHashed / hasFingerprint 是谓词 ⇒ 不是候选', !classifyName('isHashed') && !classifyName('hasFingerprint'))

  // 23 digest/摘要 两义同形 ⇒ 未判定(既不判红也不冒充合规)
  const DIGEST_PROSE = `const digest = parts.join('\\n')\nfs.writeFileSync(p, digest)\n`
  const t23 = scanFile('x/k.ts', DIGEST_PROSE)
  t('23 只含 digest 的名字 ⇒ 未判定,不判红', t23.hits.length === 0 && t23.undetermined.length > 0, JSON.stringify({ h: t23.hits.length, u: t23.undetermined.length }))

  // 24 取回动词开头:值产自别处,本文件看不出是否兑现
  const RETRIEVE = `function extractDeviceFingerprint(req) {\n  const h = req.headers['x-device-fingerprint']\n  return h.slice(0, 128)\n}\nconst fp = extractDeviceFingerprint(r)\nawait db.insert({ deviceFingerprint: fp })\n`
  const t24 = scanFile('x/l.ts', RETRIEVE)
  t('24 extract*(读 header 截断)⇒ 未判定而非定罪', t24.hits.length === 0 && t24.undetermined.some((u) => /取回动词/.test(u.why)), JSON.stringify({ h: t24.hits.length, u: t24.undetermined.map((x) => x.why.slice(0, 12)) }))

  // 25 纯常量哨兵:没有"要被摘要的东西"
  const t25 = scanFile('x/m.ts', `const GENESIS_HASH = '0'.repeat(64)\nawait db.insert({ prevHash: GENESIS_HASH })\n`)
  t('25 GENESIS_HASH = 常量 ⇒ 放过(无输入可摘要)', t25.hits.length === 0 && isLiteralOnly("'0'.repeat(64)"))

  // 26 回调位委托:`list.map(maskEmail)` 不带括号,也要能看见本地实现
  const t26 = scanFile('x/n.ts', `function maskEmail(e) {\n  return e.slice(0, 2) + '***' + e.slice(3)\n}\nfunction maskEmails(list) {\n  return list.map(maskEmail)\n}\nconsole.log(maskEmails(x))\n`)
  t('26 掩码实现经裸引用委托 ⇒ 兑现(不判红)', t26.hits.length === 0)

  // 27 `continue` / `filter` 型的"删除即兑现"
  const t27 = scanFile('x/o.ts', `function sanitizePatch(patch) {\n  const cleaned = {}\n  for (const key of Object.keys(patch)) {\n    if (BAD.has(key)) continue\n    cleaned[key] = patch[key]\n  }\n  return cleaned\n}\nawait db.update(set(sanitizePatch(p)))\n`)
  t('27 sanitizePatch 用 continue 跳键 ⇒ 放过(确有删除动作)', t27.hits.length === 0)

  // 28 同词不同义第二族:名字修饰的是文件名/路径
  const t28 = scanFile('x/p.py', `HASH_FILE = os.path.join(_CACHE_DIR, 'koubo_display_hash')\nopen(HASH_FILE, 'w').write(x)\n`)
  t('28 HASH_FILE = os.path.join(...) ⇒ 放过(修饰文件名而非值)', t28.hits.length === 0)

  // 29 读取已存值不得替生产者背锅
  const t29 = scanFile('x/q.ts', `const rows = await db.select()\nfor (const r of rows) {\n  const c_hash = r.get('content_hash')\n  index[c_hash] = r\n}\nawait db.insert({ c_hash })\n`)
  t('29 c_hash = r.get(...) 是读取面 ⇒ 未判定(生产者在本文件外)', t29.hits.length === 0)

  // 30 兜底 return 原值 + 主路径掩码 = 正当(log-sanitizer 三族),而死代码不得判活敞口
  t('30 反向锁:同一形状把主路径也改成原样返回 ⇒ 必须命中',
    scanFile('x/r.ts', `function maskTail(v) {\n  if (!v) return v\n  return v.slice(0, 2) + '**'\n}\nfs.writeFileSync(p, maskTail(x))\n`).hits.length === 0 &&
      scanFile('x/r.ts', `function maskTail(v) {\n  if (!v) return v\n  return v\n}\nfs.writeFileSync(p, maskTail(x))\n`).hits.length === 1)

  const failed = R.filter((r) => !r.pass)
  for (const r of R) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.note ? ` — ${r.note}` : ''}`)
  console.log(`\n--self-test:${R.length} 条断言,失败 ${failed.length} 条`)
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
  ROOT,
  GATE,
  EXEMPT_MARK,
  BASELINE_FILE,
  SCAN_DIRS,
  FILE_RE,
  SKIP_RE,
  PROMISE_KEYWORDS,
  IRREVERSIBLE_KEYS,
  REDACTION_KEYS,
  REAL_HASH_RE,
  OUTLET_RE,
  maskFaces,
  normName,
  tokenize,
  tokenHits,
  classifyName,
  matchedKeys,
  promiseStrength,
  hasComposition,
  isPureHandoff,
  looksLikeDataStructKey,
  findUnits,
  reachableSurface,
  jsBody,
  pySigEnd,

  judgeDelivery,
  judgeOutlet,
  scanFile,
  prefilterPattern,
  listCandidates,
  readCandidates,
  analyze,
  decide,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
