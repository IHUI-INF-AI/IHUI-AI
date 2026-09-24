#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:文本箭头当图标 / 「箭头比标签还大」对账(GA 判据)
 *
 * 立因(2026-09-24 用户实拍缺陷):四端的「查看更多 / 更多」入口把尾部箭头渲染成**文本字形**
 * (`›` / `»` / 字面 `>`),而不是 lucide 的 `chevron-right` 矢量;并且给箭头设了**比自身标签更大**
 * 的字号(标签 24rpx、箭头 28/32rpx)—— 文本字形在自身 em 盒里的位置随字号变,不同字号同行
 * 必然上下错位(AGENTS.md §4「区段头『更多』入口单一源头」记的实测:「更」12px 墨迹偏上 1.0px,
 * `›` 在 14/16/18/20px 档偏下 1.0~1.5px,是相加关系 ⇒ 旧写法错位 2.0~2.5px)。
 * 四端现已统一到共享实现(`packages/app/src/components/MoreLink.tsx`、
 * `apps/web/src/components/common/view-more-link.tsx`、小程序 `SectionHeader` 经 `LineIcon`
 * 渲染 `icons.ts` 里的 `chevron-right`),但没有任何机器判据阻止新页面把字形形态再写回来,
 * 也没有判据看"箭头字号 > 标签字号"这一种。
 *
 * 为什么不并进 check-no-emoji-icons.mjs(11h):那道门顶层直接 `process.exit` 并按"暂存新增行"
 * 逐行扫盘,没有 §22d 的 isDirectRun/`__test__` 形态(测试一 import 就会跑完整 CLI 并退出进程),
 * 也没有本门必需的 HEAD/索引 blob 取材口径。把一条正在跑的 blocking 门连它的口径一起重写,
 * 爆炸半径远大于新增一个文件 —— 故新建本门,11h 逐字不动。
 *
 * 判据(三条,一律**宁漏不误报**):
 *  S0   单一实现在位 —— 上述三个共享组件必须仍在、仍引用矢量图标、仍被别处 import。
 *       防"装好被摘线":机制不在而本门仍报绿,等于没有(守门 70/76/81 同型)。
 *  GA1  文本字形当 chevron —— 一个 JSX 元素的**唯一**子内容恰好是 `›` `»` `→` `》`(或裸 `>`),
 *       或表达式子内容 `{'›'}` / `{">"}`,**且**语境可证明是 affordance:本元素属性里有
 *       onClick/onPress/onTap/onLongPress 或 role/accessibilityRole="button",或其任一祖先元素
 *       (含 Link/Pressable/TouchableOpacity/Button 这类组件名)带上述标记。
 *       不判:注释、模板字符串里拼的 HTML(串内 `<span>›</span>`)、非整格的正文含字
 *       (`查看更多 ›`)、面包屑分隔符(祖先无 handler 即放过)、比较运算符、泛型尖括号、
 *       JSX 属性语法(`&gt;` 形态刻意不纳,宁可漏)。
 *  GA2  箭头字号 > 标签字号 —— 同一文件里按命名配对:标签键名含 `more`/`showMore`/`viewAll`
 *       词元,箭头键名 = 同一词干 + `Arrow`/`arrow`(或同一对象组里唯一的那个 label × 唯一 arrow
 *       兄弟键);CSS 侧同文件按 `.show-more-text` × `.show-more-arrow` 的词干配对判。
 *       两侧都写了字号且**单位相同**时箭头更大才判红;单位不同 ⇒ 不判但如实计数。
 *       切词按词元等值比对,所以 `removeText` 不会被当成 `more`(历史误伤最常见的一类)。
 *
 * 泄压阀:行内 `glyph-arrow-exempt: <一句话原因>` —— **逐行生效且必须带原因**(守门 97 M2 同口径)。
 *
 * 内容口径(本门生命线):缺省判 **HEAD blob**,`--staged` 判**索引 blob**,
 * 棘轮锚点恒为**该文件 HEAD 版本自身的违规数**。共享工作树常年滞后 HEAD,按磁盘算会在恒红/假绿
 * 之间来回跳;而 miniapp-taro 的 setting/member 一类行尾箭头存量在百级,写死零容忍等于逼人
 * `--no-verify`、连带废掉全部守门。所以:
 *   - 全量模式 = 审计报告(GA1/GA2 存量如实报数),只有 S0 破了才红;
 *   - `--staged` = 只拦"这次改动把违规加回来了"(判定集=暂存文件,锚点=这些文件的 HEAD 自身);
 *   - `--files a b` = 按文件自验(锚点同样是该文件 HEAD 自身,新文件即零容忍);
 *   - `--worktree` = 人工排查逃生舱,不作结论。
 * GA2 额外覆盖 `.css/.scss/.less`:用户报的那一对字号(24rpx 标签 / 32rpx 箭头)在小程序端就写在
 * 端内 `.css` 里,只扫 .tsx/.ts 会让本门对**它自己立项的那一型**全盲(串内 CSS 不计,见 GA1 说明)。
 *
 * 用法:
 *   node scripts/check-glyph-arrow-icon.mjs [--all|--staged|--worktree|--files <a> <b>|--self-test|--json|--root <dir>]
 * 退出码:0=通过/无新增;1=有违规;2=无法判定(git 失败、所选取材面取不到内容、扫描面为空)
 * 紧急跳过:HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = resolveGitBin()
const SELF_SKIP = 'HUSKY_SKIP_GLYPH_ARROW_ICON'
const GIT_TIMEOUT = 120000

/** 目标面(任务书点名的四端);CSS 只在 GA2 生效 */
const SCAN_DIRS = [
  'apps/mobile-rn',
  'packages/app',
  'apps/miniapp-taro',
  'apps/web/app',
  'apps/web/src',
]
const TSX_RE = /\.tsx$/
const SRC_RE = /\.(tsx?|css|scss|less)$/
/** 本门自身与其测试必含被判据字面量 ⇒ 按路径前缀跳过并如实计数 */
const SELF_EXEMPT_RE = /check-glyph-arrow-icon\.[\w.]*mjs$/

/**
 * S0:三端「更多」入口的矢量出口(与 AGENTS.md §4「区段头『更多』入口单一源头」逐字对齐)。
 * symbol = 消费方 import 里会出现的锚点名(用于判"造好了有没有装车"),**不得**按文件名猜 ——
 * `icons.ts` 的锚点是 `LineIcon`,按 basename 取会得出 `icons` 这种满屏假接线的名字。
 */
const MECHANISMS = [
  {
    file: 'packages/app/src/components/MoreLink.tsx',
    symbol: 'MoreLink',
    icon: /\bChevronRight\b/,
    note: 'RN + 跨端共享屏层:lucide-react-native ChevronRight',
  },
  {
    file: 'apps/web/src/components/common/view-more-link.tsx',
    symbol: 'view-more-link',
    icon: /\bChevronRight\b/,
    note: 'web:lucide-react ChevronRight',
  },
  {
    file: 'apps/miniapp-taro/src/components/LineIcon/icons.ts',
    symbol: 'LineIcon',
    icon: /['"]chevron-right['"]/,
    note: '小程序:LineIcon 的 chevron-right 素材(区块头由 SectionHeader 组装),零新素材',
  },
]

/** GA1:整格文本箭头 */
const BARE_GLYPH_RE = /^[›»→》>]$/
const BRACED_GLYPH_RE = /^\{\s*(['"`])([›»→》>])\1\s*\}$/
/** affordance 证据:事件/角色属性 */
const HANDLER_ATTR_RE =
  /\bon(?:Click|Press|LongPress|PressIn|PressOut|Tap)\b|\b(?:role|accessibilityRole)\s*=\s*['"]button['"]/
/** …或组件名本身就是可点容器 */
const AFFORDANCE_TAG_RE =
  /^(?:Link|Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Touchable|Button|MoreLink|ViewMoreLink)$/

const EXEMPT_LINE_RE = /glyph-arrow-exempt:\s*\S/
const MAX_ANCESTORS = 8

/**
 * 一次 `git grep` 预筛。模式串是**判据所需字面量的严格超集**:
 * GA1 只需那四个字形 + `>`(且必须是整格子内容,所以字形必在文件里)/ GA2 只需 fontSize|font-size
 * (命名配对在筛后的内容里做)。S0 机制文件永远实读,不受预筛影响。
 * 筛不动(异常)退回全量,绝不退成"少扫文件 = 少违规"。
 */
const PREFILTER = '›|»|→|》|fontSize|font-size'

const gitOpts = {
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 64 * 1024 * 1024,
  timeout: GIT_TIMEOUT,
}
const git = (args, cwd = ROOT) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', cwd, ...args], gitOpts)

// ── 取材 ──────────────────────────────────────────────────────────────────────────────
/** 一次 cat-file --batch 读完一批 blob(逐文件 git show 在数百文件上就是钩子链上的分钟级挂起) */
function catBatch(cwd, revs) {
  if (!revs.length) return new Map()
  const out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', cwd, 'cat-file', '--batch'], {
    cwd,
    windowsHide: true,
    maxBuffer: 512 << 20,
    timeout: GIT_TIMEOUT,
    input: Buffer.from(revs.join('\n') + '\n', 'utf8'),
  })
  const map = new Map()
  let pos = 0
  for (const rev of revs) {
    const nl = out.indexOf(0x0a, pos)
    if (nl < 0) {
      map.set(rev, null)
      continue
    }
    const header = out.subarray(pos, nl).toString('utf8')
    pos = nl + 1
    const m = /^([0-9a-f]{40}) blob (\d+)$/.exec(header)
    if (!m) {
      map.set(rev, null) // "<rev>:<path> missing" 等
      continue
    }
    map.set(rev, out.subarray(pos, pos + Number(m[2])).toString('utf8'))
    pos += Number(m[2]) + 1
  }
  return map
}

/** 面 → 前缀:head 用 `HEAD:`、index 用 `:`、worktree 直读磁盘 */
const revPrefix = (face) => (face === 'head' ? 'HEAD:' : face === 'index' ? ':' : '')

function surfaceFiles(cwd, face) {
  const out =
    face === 'head'
      ? git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], cwd)
      : git(['ls-files', '-z', '--', ...SCAN_DIRS], cwd)
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => SRC_RE.test(p))
}

/** 暂存面(仅本次要提交的文件)—— --staged 的判定宇宙。不得用 ls-files:那是整个索引,
 *  在共享工作区里等于每次提交都全量重扫,而"别人已入库的存量"与本票无关。 */
function stagedFiles(cwd) {
  return git(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_DIRS],
    cwd,
  )
    .split('\0')
    .filter(Boolean)
    .filter((p) => SRC_RE.test(p))
}

/** 候选集:null = 筛不动(退回全量);Set()(含零命中)= 合法的空候选 */
function candidateSet(cwd, face) {
  const args =
    face === 'head'
      ? ['grep', '-l', '-I', '-E', PREFILTER, 'HEAD', '--', ...SCAN_DIRS]
      : face === 'index'
        ? ['grep', '--cached', '-l', '-I', '-E', PREFILTER, '--', ...SCAN_DIRS]
        : ['grep', '-l', '-I', '-E', PREFILTER, '--', ...SCAN_DIRS]
  try {
    return new Set(
      git(args, cwd)
        .split('\n')
        .filter(Boolean)
        .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/')),
    )
  } catch (e) {
    return e?.status === 1 ? new Set() : null
  }
}

function makeReader(cwd, face, files) {
  if (face === 'worktree') {
    // 工作树面**不套 try**:脚本自身缺陷(漏 import、编码错)不得被吞成"取不到内容"
    return (rel) => readFileSync(join(cwd, rel), 'utf8')
  }
  const pre = revPrefix(face)
  const batch = catBatch(
    cwd,
    files.map((p) => `${pre}${p}`),
  )
  return (rel) => {
    const v = batch.get(`${pre}${rel}`)
    return v === undefined ? null : v
  }
}

// ── 文本状态机(保行/列偏移;报不准行号的门没法逐行豁免) ─────────────────────────────
/**
 * 一次遍历同时产出:
 *  - `code`:注释整段抹为空格(换行保留),字符串**原样保留**(GA1 要认 `{'›'}` 这种串形态)
 *  - `strMask`:与 code 等长的布尔表,标记"该字符属于字符串内容" —— JSX 文本子节点必须落在串外,
 *    否则模板字符串里拼的 HTML 会被当成 JSX 命中(守门 70 的串内 `/*` 同型坑)。
 */
function stripCommentsKeepStrings(src) {
  let out = ''
  const mask = []
  let i = 0
  const n = src.length
  const put = (ch, inStr) => {
    out += ch
    mask.push(inStr)
  }
  while (i < n) {
    const ch = src[i]
    const nx = src[i + 1]
    if (ch === '/' && nx === '/') {
      while (i < n && src[i] !== '\n') {
        put(' ', false)
        i++
      }
      continue
    }
    if (ch === '/' && nx === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        put(src[i] === '\n' ? '\n' : ' ', false)
        i++
      }
      for (let k = 0; i < n && k < 2; k++, i++) put(' ', false)
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      put(ch, true)
      i++
      while (i < n) {
        if (src[i] === '\\') {
          const nl = src[i + 1] === '\n'
          put(src[i], true)
          put(nl ? '\n' : (src[i + 1] ?? ' '), true)
          i += 2
          continue
        }
        if (src[i] === ch) break
        put(src[i], true)
        i++
      }
      if (i < n) {
        put(ch, true)
        i++
      }
      continue
    }
    put(ch, false)
    i++
  }
  return { code: out, strMask: mask }
}

/** 注释与字符串都抹平(GA2 用:串里的 `content: "→"` 与生成的 CSS 文本不得算作本文件的样式) */
function stripCommentsAndStrings(src) {
  const { code, strMask } = stripCommentsKeepStrings(src)
  let out = ''
  for (let i = 0; i < code.length; i++) out += strMask[i] && code[i] !== '\n' ? ' ' : code[i]
  return out
}

function lineOf(text, idx) {
  let line = 1
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

/** 逐行生效、必须带原因;裸 `glyph-arrow-exempt:` 不生效 */
function collectExemptLines(raw) {
  const lines = new Set()
  raw.split('\n').forEach((l, idx) => {
    const m = l.match(EXEMPT_LINE_RE)
    if (m && m[0].replace('glyph-arrow-exempt:', '').trim().length > 0) lines.add(idx + 1)
  })
  return lines
}

/** 从 openIdx(指向 '{')起花括号配平取对象体;不配对返回 null */
function objectBody(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(openIdx + 1, i)
  }
  return null
}

/** 只保留**本层**声明:嵌套对象体整段抹平,避免把孙对象的 fontSize 记到父键上 */
function shallowBody(body) {
  let out = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
    out += depth > 0 && ch !== '{' && ch !== '}' ? (ch === '\n' ? '\n' : ' ') : ch
  }
  return out
}

/** 每个 `{` 的开括号处 → 其**父作用域**的 `{` 下标(顶层为 'root'),用于"同一规则组"判定 */
function braceParents(text) {
  const parent = new Map()
  const stack = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      parent.set(i, stack.length ? stack[stack.length - 1] : 'root')
      stack.push(i)
    } else if (c === '}') stack.pop()
  }
  return parent
}

// ── GA1 ───────────────────────────────────────────────────────────────────────────────
/** `<` 只有在前面不是单词字符/引号/闭括号时才是 JSX 开标签:`a<b`、`Array<Foo>` 一律拒绝 */
function prevAllowsTagStart(text, i) {
  if (i === 0) return true
  return !/[\w$)\]'"`]/.test(text[i - 1])
}

/** 从 i 处解析一个标签:属性里的 `{}`/`()`/`[]` 计入深度后才认配平的 `>`;不是标签返回 null */
export function parseTagAt(text, i, strMask) {
  if (text[i] !== '<' || strMask[i]) return null
  if (!prevAllowsTagStart(text, i)) return null
  let j = i + 1
  let closing = false
  if (text[j] === '/') {
    closing = true
    j++
  }
  const m = /^[A-Za-z_][\w.]*/.exec(text.slice(j, j + 64))
  if (!m) return null
  const name = m[0]
  let k = j + name.length
  let depth = 0
  const stop = Math.min(text.length, k + 4000)
  while (k < stop) {
    if (strMask[k]) {
      k++
      continue
    }
    const c = text[k]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') {
      if (depth === 0) return null
      depth--
    } else if (c === '>' && depth === 0) {
      const attrs = text.slice(j + name.length, k)
      // 真 JSX 属性表要么为空(`<Text>`)、要么以空白 / `/` 起头(`<Text\n  …>`);
      // `<T,>` 这类泛型/箭头类型参数attrs 直接以 `,`/`(`/`<` 起头 ⇒ 不是标签,拒。
      if (attrs && !/^[\s/]/.test(attrs)) return null
      return {
        kind: closing ? 'close' : /\/\s*$/.test(attrs) ? 'self' : 'open',
        name,
        attrs,
        end: k + 1,
      }
    } else if (c === '<') return null
    k++
  }
  return null
}

/** 该开标签之后是否"唯一子内容就是一个箭头字形",且紧随其后的闭合标签同名 */
function loneGlyphChild(text, strMask, tag) {
  let j = tag.end
  while (j < text.length && /\s/.test(text[j])) j++
  const nextLt = text.indexOf('<', j)
  if (nextLt < 0 || nextLt - j > 40) return null
  const raw = text.slice(j, nextLt)
  const tr = raw.trim()
  if (!tr) return null
  const pos = j + (raw.length - raw.trimStart().length)
  let glyph = null
  let form = null
  if (BARE_GLYPH_RE.test(tr)) {
    if (strMask[pos]) return null // 串内的 `›` 不是 JSX 文本子节点
    glyph = tr
    form = 'text-child'
  } else if (BRACED_GLYPH_RE.test(tr)) {
    glyph = BRACED_GLYPH_RE.exec(tr)[2]
    form = 'braced-string-child'
  } else return null
  const tail = text.slice(nextLt, nextLt + tag.name.length + 10)
  if (!new RegExp(`^</\\s*${tag.name.replace(/\./g, '\\.')}\\s*>`).test(tail)) return null
  return { glyph, form, pos }
}

function affordanceReason(tag, ancestors) {
  if (HANDLER_ATTR_RE.test(tag.attrs)) return '本元素自身带 onClick/onPress/role=button'
  for (const a of ancestors) {
    if (AFFORDANCE_TAG_RE.test(a.name)) return `祖先 <${a.name}> 本身就是可点容器`
    if (HANDLER_ATTR_RE.test(a.attrs)) return `祖先 <${a.name}> 带 onClick/onPress/role=button`
  }
  return null
}

/**
 * 整格文本箭头 + 可证明的 affordance 语境。
 * 单次前向遍历:栈给祖先,开标签给"唯一子内容"判定,闭合标签按名回退栈。
 */
export function findGlyphIconChildren(text, strMask) {
  const hits = []
  const stack = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== '<') {
      i++
      continue
    }
    const t = parseTagAt(text, i, strMask)
    if (!t) {
      i++
      continue
    }
    if (t.kind === 'close') {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === t.name) {
          stack.length = s
          break
        }
      }
      i = t.end
      continue
    }
    if (t.kind === 'open') {
      const lone = loneGlyphChild(text, strMask, t)
      if (lone) {
        const via = affordanceReason(t, stack.slice(-MAX_ANCESTORS))
        if (via) hits.push({ ...lone, tag: t.name, via })
      }
      stack.push(t)
    }
    i = t.end
  }
  return hits
}

// ── GA2 ───────────────────────────────────────────────────────────────────────────────
/** 标识符切词:camelCase / kebab / snake → 小写词元(`showMoreText` 与 `show-more-text` 同形) */
export function wordsOf(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s\-_./]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

const ROLE_SUFFIX_WORDS = new Set([
  'text',
  'label',
  'title',
  'copy',
  'name',
  'span',
  'link',
  'row',
  'item',
  'btn',
  'button',
  'wrap',
  'inner',
  'outer',
  'tag',
])
const ARROW_WORDS = new Set(['arrow', 'chevron'])

export function isArrowName(name) {
  return wordsOf(name).some((w) => ARROW_WORDS.has(w))
}

/** 标签名:词元含 more,或 view/show/see 紧跟 all;自身不得是箭头键 */
export function isLabelName(name) {
  if (isArrowName(name)) return false
  const w = wordsOf(name)
  if (w.includes('more')) return true
  for (let i = 0; i < w.length - 1; i++)
    if (['view', 'show', 'see'].includes(w[i]) && w[i + 1] === 'all') return true
  return false
}

/** 词干:剥掉尾部 arrow/chevron 与角色词,让 `show-more-text` 与 `show-more-arrow` 对上 */
export function stemOf(name) {
  const w = wordsOf(name)
  while (w.length && ARROW_WORDS.has(w[w.length - 1])) w.pop()
  while (w.length > 1 && ROLE_SUFFIX_WORDS.has(w[w.length - 1])) w.pop()
  return w.join('-')
}

const OBJ_GROUP_RE = /([A-Za-z_$][\w$]*)\s*:\s*\{/g
const OBJ_FS_RE = /fontSize\s*:\s*([0-9]*\.?[0-9]+)/g
const CSS_BLOCK_RE = /([^{}]+)\{([^{}]*)\}/g
const CSS_SEL_RE = /\.([A-Za-z_][\w-]*)/g
const CSS_FS_RE = /font-size\s*:\s*([0-9]*\.?[0-9]+)\s*(rpx|px|rem|em|pt)?/

/**
 * 收集"某处写了字号"的条目。
 *  - 对象形态:键 = 样式名,组 = **父对象**(兄弟键同组),值取本层 fontSize
 *  - CSS 形态:组 = 一条规则块(同文件的跨块配对在下面按词干做)
 */
export function collectFontSizes(blank) {
  const entries = []
  const parents = braceParents(blank)
  for (const m of blank.matchAll(OBJ_GROUP_RE)) {
    const braceIdx = blank.indexOf('{', m.index + m[0].length - 1)
    if (braceIdx < 0) continue
    const body = objectBody(blank, braceIdx)
    if (body === null) continue
    const group = `obj@${parents.get(braceIdx) ?? 'root'}`
    for (const f of shallowBody(body).matchAll(OBJ_FS_RE)) {
      entries.push({
        name: m[1],
        group,
        size: Number(f[1]),
        unit: '',
        line: lineOf(blank, braceIdx + 1 + f.index),
        keyLine: lineOf(blank, m.index),
      })
    }
  }
  for (const m of blank.matchAll(CSS_BLOCK_RE)) {
    const braceIdx = m.index + m[1].length
    if (blank[braceIdx] !== '{') continue
    const f = CSS_FS_RE.exec(m[2])
    if (!f) continue
    for (const s of m[1].matchAll(CSS_SEL_RE)) {
      entries.push({
        name: s[1],
        group: `css@${braceIdx}`,
        size: Number(f[1]),
        unit: f[2] || 'unitless',
        line: lineOf(blank, braceIdx + 1 + f.index),
        keyLine: lineOf(blank, m.index + m[1].indexOf(s[0])),
      })
    }
  }
  return entries
}

/**
 * 配对:同组内按词干相等;组内恰好一个 label × 一个 arrow 时按兄弟键配(任务书点名的形态)。
 * CSS 侧跨块按同词干配。单位不一致 ⇒ 不判、只计 undetermined。
 */
export function findOpticalMismatch(entries) {
  const found = []
  const undetermined = []
  const byGroup = new Map()
  for (const e of entries) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, [])
    byGroup.get(e.group).push(e)
  }
  const check = (label, arrow, sameGroup) => {
    if (label.unit !== arrow.unit) {
      undetermined.push(
        `${label.name}(${label.size}${label.unit || ''}) vs ${arrow.name}(${arrow.size}${arrow.unit || ''}) 单位不同、判不出`,
      )
      return
    }
    if (arrow.size > label.size) found.push({ label, arrow, sameGroup })
  }
  for (const list of byGroup.values()) {
    const labels = list.filter((e) => isLabelName(e.name))
    const arrows = list.filter((e) => isArrowName(e.name))
    for (const l of labels) {
      const stem = stemOf(l.name)
      const exact = arrows.filter((a) => stemOf(a.name) === stem)
      if (exact.length) for (const a of exact) check(l, a, true)
      else if (labels.length === 1 && arrows.length === 1) check(l, arrows[0], true)
    }
  }
  const css = entries.filter((e) => e.group.startsWith('css@'))
  const cssLabels = css.filter((e) => isLabelName(e.name))
  const cssArrows = css.filter((e) => isArrowName(e.name))
  for (const l of cssLabels) {
    const stem = stemOf(l.name)
    for (const a of cssArrows) if (a !== l && stemOf(a.name) === stem) check(l, a, false)
  }
  const seen = new Set()
  const violations = found.filter((v) => {
    const k = `${v.label.name}@${v.label.line}|${v.arrow.name}@${v.arrow.line}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { violations, undetermined }
}

// ── 单文件审计(返回结构化条目,不做字符串反解析) ───────────────────────────────────────
export function auditFile(rel, text) {
  const findings = []
  const notes = { exempt: 0, undetermined: [] }
  const exempt = collectExemptLines(text)
  if (TSX_RE.test(rel)) {
    const { code, strMask } = stripCommentsKeepStrings(text)
    for (const h of findGlyphIconChildren(code, strMask)) {
      const line = lineOf(code, h.pos)
      if (exempt.has(line)) {
        notes.exempt++
        continue
      }
      findings.push({
        rule: 'GA1',
        file: rel,
        line,
        msg: `文本字形「${h.glyph}」当 chevron 图标(<${h.tag}> 的唯一子内容,${h.via})—— 须改用矢量图标:共享 MoreLink / lucide chevron-right / Taro LineIcon`,
      })
    }
  }
  const mm = findOpticalMismatch(collectFontSizes(stripCommentsAndStrings(text)))
  for (const v of mm.violations) {
    if (
      exempt.has(v.arrow.line) ||
      exempt.has(v.label.line) ||
      exempt.has(v.arrow.keyLine) ||
      exempt.has(v.label.keyLine)
    ) {
      notes.exempt++
      continue
    }
    findings.push({
      rule: 'GA2',
      file: rel,
      line: v.arrow.line,
      msg: `箭头字号 ${v.arrow.size}${v.arrow.unit || ''}(L${v.arrow.line} ${v.arrow.name})> 标签字号 ${v.label.size}${v.label.unit || ''}(L${v.label.line} ${v.label.name})—— ${v.sameGroup ? '同一规则组' : '同文件规则族'}配对;文本箭头随字号移位、同行必然对不齐 ⇒ 换矢量图标或按标签同档`,
    })
  }
  notes.undetermined.push(...mm.undetermined)
  return { findings, notes }
}

// ── 扫描(纯函数:自检直接喂内存 reader,不做任何 git 写) ──────────────────────────────
export function scan(readFile, files, opts = {}) {
  const v = { s0: [], ga1: [], ga2: [] }
  const notes = {
    totalFiles: files.length,
    scanned: 0,
    selfExempt: 0,
    skipped: 0,
    unreadable: [],
    exempt: 0,
    undetermined: [],
    wiringSkipped: !opts.checkWiring,
  }
  for (const rel of files) {
    // 顺序要紧:先认自豁免(本门必含被判据字面量),再按扩展名筛 —— 反过来就永远数不到
    if (SELF_EXEMPT_RE.test(rel)) {
      notes.selfExempt++
      continue
    }
    if (!SRC_RE.test(rel)) {
      notes.skipped++
      continue
    }
    const text = readFile(rel)
    if (text === null) {
      notes.unreadable.push(rel)
      continue
    }
    notes.scanned++
    const { findings, notes: fn } = auditFile(rel, text)
    notes.exempt += fn.exempt
    for (const u of fn.undetermined) notes.undetermined.push(`${rel}: ${u}`)
    for (const f of findings) v[f.rule === 'GA1' ? 'ga1' : 'ga2'].push(f)
  }
  // S0 与屏文件走同一个取材面 —— 否则 --root/工作树通道下发的是 worktree,
  // 而 S1 偷读 HEAD,结论会自相矛盾。机制文件自身不算"消费者"(它们互相含名字,会假接线)。
  const mechSet = new Set(MECHANISMS.map((m) => m.file))
  const wiringOf = (mech) => {
    if (opts.wiring) return opts.wiring.get(mech.file) || []
    if (!opts.checkWiring) return null // 判不出 ⇒ 不判,但输出里如实说明"未判定"
    return (opts.wireUniverse || files)
      .filter((f) => !mechSet.has(f) && !SELF_EXEMPT_RE.test(f))
      .filter((f) => {
        const t = readFile(f)
        return t !== null && t.includes(mech.symbol)
      })
  }
  for (const mech of MECHANISMS) {
    const text = readFile(mech.file)
    if (text === null) {
      v.s0.push({
        file: mech.file,
        line: 0,
        msg: `取不到内容 ⇒ 无法判定共享「更多」实现在位(${mech.note})`,
      })
      continue
    }
    if (!mech.icon.test(text))
      v.s0.push({
        file: mech.file,
        line: 1,
        msg: `不再引用矢量图标(${mech.note})—— 疑似被改回文本字形`,
      })
    const wiredBy = wiringOf(mech)
    if (wiredBy !== null && wiredBy.length === 0)
      v.s0.push({
        file: mech.file,
        line: 1,
        msg: '在位但无人 import —— 共享实现造好没装车,等于没有(守门 64 同型)',
      })
  }
  return { violations: v, notes, fileCount: notes.scanned }
}

/**
 * 消费者清单(按面):一次 `git grep -l -F <符号>` 就够,且**必须**用完整扫描面而不是
 * 预筛后的候选集 —— 预筛只留"含判据字面量"的文件,拿它判"有没有人 import"会假报未接线。
 */
function computeWiring(cwd, face) {
  const map = new Map()
  for (const mech of MECHANISMS) {
    const symbol = mech.symbol
    const args =
      face === 'head'
        ? ['grep', '-l', '-I', '-F', symbol, 'HEAD', '--', ...SCAN_DIRS]
        : face === 'index'
          ? ['grep', '--cached', '-l', '-I', '-F', symbol, '--', ...SCAN_DIRS]
          : ['grep', '-l', '-I', '-F', symbol, '--', ...SCAN_DIRS]
    let out = ''
    try {
      out = git(args, cwd)
    } catch (e) {
      if (e?.status === 1) out = ''
      else throw e
    }
    map.set(
      mech.file,
      out
        .split('\n')
        .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/'))
        .filter((p) => p && p !== mech.file && !SELF_EXEMPT_RE.test(p)),
    )
  }
  return map
}

/** 仓库级扫描:清单 + 预筛 + 同面取材。explicitFiles(按文件自验)时判定宇宙太小 ⇒ 不判 wiring */
export function scanRepo(root, face, explicitFiles, opts = {}) {
  const all = explicitFiles ? explicitFiles.filter((p) => SRC_RE.test(p)) : surfaceFiles(root, face)
  let files = all
  if (!explicitFiles) {
    const cand = candidateSet(root, face)
    if (cand) files = all.filter((f) => cand.has(f) || MECHANISMS.some((m) => m.file === f))
    for (const m of MECHANISMS)
      if (!files.includes(m.file) && all.includes(m.file)) files.push(m.file)
  }
  const reader = makeReader(root, face, [...new Set([...files, ...MECHANISMS.map((m) => m.file)])])
  return {
    result: scan(reader, files, { checkWiring: !!opts.wiring, wiring: opts.wiring }),
    surface: all.length,
  }
}

/** 每个文件的违规条数(GA1+GA2),用于棘轮锚点 */
function countsByFile(result) {
  const per = new Map()
  for (const arr of [result.violations.ga1, result.violations.ga2])
    for (const f of arr) per.set(f.file, (per.get(f.file) || 0) + 1)
  return per
}

/**
 * 棘轮比对(单独成函数,好让自检能直接喂计数做正反对照)。
 * 锚点 = 该文件 HEAD 自身的条数;相等或更少 ⇒ 只算存量,更多 ⇒ 新增。
 * 没有锚点(HEAD 里没这个路径)⇒ 锚点按 0,即新文件零容忍。
 */
export function splitFresh(nowCounts, headCounts) {
  const fresh = []
  let tolerated = 0
  for (const [rel, n] of nowCounts) {
    const tol = headCounts.get(rel) || 0
    if (n > tol) fresh.push({ rel, n, tol })
    else tolerated += n
  }
  return { fresh, tolerated }
}

const fmt = (arr) => arr.map((f) => `${f.file}:${f.line} ${f.msg}`)

function report(res, meta) {
  const { violations: v, notes } = res
  const filesGA1 = new Set(v.ga1.map((f) => f.file)).size
  const filesGA2 = new Set(v.ga2.map((f) => f.file)).size
  const total = v.s0.length + v.ga1.length + v.ga2.length
  const lines = [
    `文本箭头图标对账(GA)|面=${meta.faceLabel}`,
    `  实读 ${notes.scanned} 个源文件(预筛后候选 ${notes.totalFiles},受管面共 ${meta.surface};S0 机制文件 ${MECHANISMS.length} 个恒实读)${meta.anchorLabel ? ` | ${meta.anchorLabel}` : ''}`,
    `  S0   共享矢量实现在位 ${v.s0.length ? '❌ ' + v.s0.length : '✅ 0'}`,
    `  GA1  文本字形当 chevron ${v.ga1.length ? `${meta.verdictLabel} ${v.ga1.length} 处 / ${filesGA1} 文件` : '✅ 0'}`,
    `  GA2  箭头字号 > 标签字号 ${v.ga2.length ? `${meta.verdictLabel} ${v.ga2.length} 处 / ${filesGA2} 文件` : '✅ 0'}`,
    `  自豁免(门自身与其测试必含被判据字面量):${notes.selfExempt} 个文件${notes.skipped ? `;非受管扩展名跳过 ${notes.skipped} 个` : ''}`,
  ]
  if (notes.exempt) lines.push(`  行内豁免 glyph-arrow-exempt 放过:${notes.exempt} 处`)
  if (notes.undetermined.length)
    lines.push(`  GA2 单位不一致、判不出:${notes.undetermined.length} 对(不判红,如实计数)`)
  if (notes.wiringSkipped)
    lines.push('  S0 的"是否被 import"一侧:本轮按文件自验,未判定(不静默当作通过)')
  for (const x of fmt(v.s0)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga1)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga2)) lines.push(`  ✗ ${x}`)
  return { lines, total }
}

function usage() {
  console.log(`
check-glyph-arrow-icon.mjs — 文本箭头当图标 / 「箭头比标签还大」对账(守门 GA)

用法:
  node scripts/check-glyph-arrow-icon.mjs                 全量审计(判 HEAD blob,存量只报数)
  node scripts/check-glyph-arrow-icon.mjs --staged        pre-commit(判索引 blob,锚点=该文件 HEAD 自身)
  node scripts/check-glyph-arrow-icon.mjs --files a b     按文件自验(工作树内容,锚点仍是 HEAD)
  node scripts/check-glyph-arrow-icon.mjs --worktree      逃生舱:整面按磁盘判(不作结论)
  node scripts/check-glyph-arrow-icon.mjs --json          机器可读输出(只吐一份可 jq 的文档)
  node scripts/check-glyph-arrow-icon.mjs --self-test     判据自检(正反成对,纯内存不碰 git)
  node scripts/check-glyph-arrow-icon.mjs --root <dir>    指定仓根(测试/多仓自验用)

判据:
  - S0   三端共享「更多」实现在位、仍引用矢量图标、仍被 import
  - GA1  JSX 元素的唯一子内容恰为 › » → 》 或 {'>'} 这类字形,且语境可证是 affordance
  - GA2  同一文件里 more/viewAll 标签与同词干 *Arrow* 键都写了字号,且箭头更大(单位须一致)

豁免:行内 \`glyph-arrow-exempt: <一句话原因>\`(逐行生效,裸标记不生效)
退出码:0=通过/无新增 1=有违规 2=无法判定(git 失败 / 取材面取不到 / 扫描面为空)
紧急跳过:HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...
`)
}

function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 ? resolve(argv[ri + 1]) : ROOT
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help')) {
    usage()
    return 0
  }
  const fi = argv.indexOf('--files')
  const explicit =
    fi >= 0
      ? argv
          .slice(fi + 1)
          .filter((a) => !a.startsWith('--'))
          .map((p) => p.replaceAll('\\', '/').replace(/^\.\//, ''))
      : null
  if (!explicit && process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):文本箭头图标对账未执行`)
    return 0
  }
  if (['--staged', '--worktree'].filter((f) => argv.includes(f)).length > 1) {
    console.error('❌ --staged 与 --worktree 互斥:同一轮只允许一个取材面')
    return 2
  }
  const face = explicit
    ? 'worktree'
    : argv.includes('--staged')
      ? 'index'
      : argv.includes('--worktree')
        ? 'worktree'
        : 'head'
  if (explicit && argv.includes('--worktree'))
    console.log('  (注:--files 已隐含工作树取材,--worktree 被忽略)')

  let judged
  let judgedFiles = null
  let surface = 0
  try {
    if (explicit) {
      const missing = explicit.filter((p) => !existsSync(join(root, p)))
      if (missing.length) {
        console.error(`❌ --files 里这些路径不存在 ⇒ 无法判定:${missing.join(', ')}`)
        return 2
      }
      judged = scanRepo(root, 'worktree', explicit)
    } else if (face === 'index') {
      judgedFiles = stagedFiles(root)
      if (!judgedFiles.length) {
        console.log('✅ 暂存区无受管源码文件,跳过(取材面正常)')
        return 0
      }
      judged = scanRepo(root, 'index', judgedFiles, { wiring: computeWiring(root, 'index') })
    } else {
      judged = scanRepo(root, face, null, { wiring: computeWiring(root, face) })
    }
    surface = judged.surface
  } catch (e) {
    console.error(`无法判定(git 调用失败):${e?.message ?? e}`)
    return 2
  }
  const res = judged.result
  if (!explicit && res.notes.totalFiles === 0) {
    console.error('❌ 扫描面解析到 0 个受管源文件 ⇒ 空扫不得记为通过')
    return 2
  }
  if (res.notes.unreadable.length) {
    console.error(
      `❌ ${res.notes.unreadable.length} 个文件在所选取材面取不到内容 ⇒ 无法判定(不记绿):${res.notes.unreadable.slice(0, 8).join(', ')}`,
    )
    return 2
  }

  // 棘轮:锚点恒为该文件 HEAD 自身的违规数。无命中时不必再扫 HEAD(热路径省一整轮派生)。
  const nowCounts = countsByFile(res)
  let fresh = []
  let tolerated = 0
  if (nowCounts.size) {
    try {
      const anchorFiles = [...nowCounts.keys()]
      const anchor = face === 'head' ? res : scanRepo(root, 'head', anchorFiles).result
      const headCounts = face === 'head' ? nowCounts : countsByFile(anchor)
      ;({ fresh, tolerated } = splitFresh(nowCounts, headCounts))
    } catch (e) {
      console.error(`无法判定(HEAD 锚点面读取失败):${e?.message ?? e}`)
      return 2
    }
  }
  const meta = {
    faceLabel: explicit
      ? `工作树 --files ${surface} 个(仅供自验)`
      : face === 'index'
        ? `索引 blob(--staged,判定 ${surface} 个暂存源文件)`
        : face === 'worktree'
          ? '工作树(逃生舱,不作结论)'
          : 'HEAD blob(全量审计)',
    anchorLabel:
      face === 'head'
        ? '全量模式:锚点即自身 ⇒ 存量只报数'
        : `新增 ${fresh.length} 文件 / 存量容忍 ${tolerated} 处`,
    surface,
    // 计数前的定语必须说清"这些数是存量还是新增" —— 全量模式的 GA1/GA2 是 HEAD 存量,
    // 而 --staged / --files 面里越线的才是"这次加的"(写成"违规"会让下一个人以为门在红)。
    verdictLabel: fresh.length ? '❌ 越线' : face === 'head' ? '⚠️ HEAD 存量' : '⚠️ 存量(未越线)',
  }
  const { lines, total } = report(res, meta)
  const s0Broken = res.violations.s0.length > 0
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face,
          surface,
          violations: res.violations,
          notes: res.notes,
          fresh,
          tolerated,
          ok: !s0Broken && fresh.length === 0,
        },
        null,
        2,
      ),
    )
    return s0Broken || fresh.length ? 1 : 0
  }
  lines.forEach((l) => console.log(l))
  if (s0Broken) {
    console.log(
      `\n❌ S0 红:${res.violations.s0.length} 处 —— 共享「更多」实现被摘线,四端会各自回潮。`,
    )
    console.log(`   紧急跳过:${SELF_SKIP}=1(会连同把机制回归留在 main 上,勿滥用)`)
    return 1
  }
  if (fresh.length) {
    console.log(`\n❌ 新增违规(只拦"这次把绕档加回来了",锚点 = 该文件 HEAD 自身):`)
    for (const p of fresh) console.log(`   ${p.rel}(HEAD 自身 ${p.tol} 处 → 本次 ${p.n} 处)`)
    console.log(
      `   单独复现:node scripts/check-glyph-arrow-icon.mjs --files ${fresh.map((p) => p.rel).join(' ')}`,
    )
    console.log(
      `   改法:箭头一律走共享 MoreLink / ViewMoreLink / LineIcon(chevron-right),文本字形不得再写;`,
    )
    console.log(`         确属例外写 \`glyph-arrow-exempt: <一句话原因>\``)
    console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...`)
    return 1
  }
  if (total === 0) console.log('✅ 无文本箭头字形、无字号倒挂、共享矢量实现在位')
  else
    console.log(
      `\n✅ 提交链口径无新增(GA1/GA2 为 HEAD 存量,按文件棘轮容忍 ${tolerated} 处;清理办法是把命中行的箭头换成矢量)`,
    )
  return 0
}

// ── 自检:正反成对 + 端到端(纯内存 reader,不产生任何 git 写) ───────────────────────────
const MECH_SNIPPETS = {
  'packages/app/src/components/MoreLink.tsx':
    "import { Pressable, Text } from 'react-native'\nimport { ChevronRight } from 'lucide-react-native'\nexport function MoreLink({ label }) {\n  return <Pressable onPress={() => {}}><Text>{label}</Text><ChevronRight size={12} /></Pressable>\n}\n",
  'apps/web/src/components/common/view-more-link.tsx':
    "import Link from 'next/link'\nimport { ChevronRight } from 'lucide-react'\nexport function ViewMoreLink({ label }) {\n  return <Link href='/a'><span>{label}</span><ChevronRight className='h-3 w-3' /></Link>\n}\n",
  'apps/miniapp-taro/src/components/LineIcon/icons.ts':
    "export const ICONS = {\n  'chevron-right': '<svg><path d=\"m9 18 6-6-6-6\" /></svg>',\n}\n",
}

function selfTest() {
  const cases = []
  const t = (name, pass, detail = '') => cases.push({ name, pass, detail })
  const run = (files) => {
    const read = (p) => (p in files ? files[p] : null)
    const { violations, notes } = scan(read, Object.keys(files), { checkWiring: true })
    return {
      ga1: violations.ga1,
      ga2: violations.ga2,
      s0: violations.s0,
      notes,
      n1: violations.ga1.length,
      n2: violations.ga2.length,
      n0: violations.s0.length,
    }
  }
  const only = (files) =>
    run({
      'packages/app/consumer.tsx':
        "import { MoreLink } from '@ihui/rn-app'\nimport { ViewMoreLink } from '@/components/common/view-more-link'\nimport SectionHeader from '@/components/SectionHeader'\nimport LineIcon from '@/components/LineIcon'\nexport const K = [MoreLink, ViewMoreLink, SectionHeader, LineIcon]\n",
      ...MECH_SNIPPETS,
      ...files,
    })

  // GA1:阳性对照(探针必须看得见已知目标,否则"扫到 0"毫无意义)
  const CONTROL_TSX =
    'export function Card({ go }) {\n  return (\n    <View onClick={go}>\n      <Text>最近学习</Text>\n      <Text className="text-[32rpx] text-muted-foreground">›</Text>\n    </View>\n  )\n}\n'
  t(
    'GA1 阳性对照:onClick 容器里的整格 › 看得见',
    only({ 'packages/app/x.tsx': CONTROL_TSX }).n1 === 1,
  )
  const CONTROL_INNER =
    'export function More({ go }) {\n  return <Text onPress={go}>查看更多 <Text>›</Text></Text>\n}\n'
  t(
    'GA1 阳性对照(任务书原文形态):<Text onPress>查看更多 <Text>›</Text></Text> 看得见',
    only({ 'packages/app/y.tsx': CONTROL_INNER }).n1 === 1,
  )
  const CONTROL_BRACED =
    'export function More({ go }) {\n  return <TouchableOpacity onPress={go}><Text>更多</Text><Text>{">"}</Text></TouchableOpacity>\n}\n'
  t(
    'GA1 阳性对照:{">"} 表达式子内容看得见(门让你这么写就得看得见)',
    only({ 'packages/app/z.tsx': CONTROL_BRACED }).n1 === 1,
  )
  t(
    'GA1 阳性对照:→ 与 》 同形认',
    only({
      'packages/app/z2.tsx':
        'export const X = ({ go }) => <Pressable onPress={go}><Text>→</Text><Text>》</Text></Pressable>\n',
    }).n1 === 2,
  )
  // GA1:反向(限制条件必须真在起作用)
  t(
    'GA1 反向:注释里的 › » 一律不判',
    only({ 'packages/app/a.tsx': '// 这里曾用 › 当箭头\n/* 还有 » 与 → */\nexport const k = 1\n' })
      .n1 === 0,
  )
  t(
    'GA1 反向:模板字符串里拼的 <span>›</span> 不算 JSX 子节点',
    only({ 'packages/app/b.ts': 'export const html = `<div><span>›</span></div>`\n' }).n1 === 0,
  )
  t(
    'GA1 反向:非整格的正文含字(查看更多 ›)不判',
    only({
      'packages/app/c.tsx': 'export const X = ({ go }) => <Text onPress={go}>查看更多 ›</Text>\n',
    }).n1 === 0,
  )
  t(
    'GA1 反向:面包屑分隔符(祖先无可点标记)不判',
    only({
      'packages/app/d.tsx':
        "export const Crumbs = () => <nav><a href='/1'>A</a><span>›</span><a href='/2'>B</a></nav>\n",
    }).n1 === 0,
  )
  t(
    'GA1 反向:比较运算符 / 泛型尖括号 / JSX 属性语法都不判',
    only({
      'packages/app/e.tsx':
        "export const Y = <T,>(a: T, b: number) => (a < b ? <Text>{'x'}</Text> : null)\n",
    }).n1 === 0,
  )
  t(
    'GA1 反向:闭合标签不同名 ⇒ 不认整格子内容',
    only({
      'packages/app/f.tsx': 'export const Z = ({ go }) => <View onClick={go}><Text>›</View>\n',
    }).n1 === 0,
  )
  t(
    'GA1 反向:配置字段 icon: "›" 不是渲染位,不判(交 11h 那套 emoji 判据)',
    only({ 'packages/app/g.ts': 'export const CFG = { icon: "›", arrow: "»" }\n' }).n1 === 0,
  )
  t(
    'GA1 反向:整格字形但整链无可点证据 ⇒ 放过(可证 affordance 这条限制生效)',
    only({
      'packages/app/h.tsx': 'export const X = () => <View><Text className="a">›</Text></View>\n',
    }).n1 === 0,
  )
  t(
    '行内豁免:必须带原因,且逐行生效(整文件免检就是洞)',
    collectExemptLines('a // glyph-arrow-exempt:\nb // glyph-arrow-exempt: 装饰性分隔符\nc')
      .size === 1,
  )
  t(
    '行内豁免:带原因的那一行放过',
    only({
      'packages/app/i.tsx':
        'export const X = ({ go }) => <View onClick={go}><Text>›</Text></View> // glyph-arrow-exempt: 与封面同源的指示符\n',
    }).n1 === 0,
  )
  t(
    '行内豁免:一行救不了同文件另一处',
    only({
      'packages/app/j.tsx':
        'export const X = ({ go }) => <View onClick={go}><Text>›</Text> // glyph-arrow-exempt: 原因\n<Text>»</Text></View>\n',
    }).n1 === 1,
  )

  // GA2:阳性对照与反向对
  const cssRun = (css) => only({ 'apps/miniapp-taro/src/pages/p.css': css })
  t(
    'GA2 阳性对照(任务书原文形态):.show-more-text 26rpx × .show-more-arrow 28rpx 看得见',
    cssRun(
      '.show-more-text {\n  font-size: 26rpx;\n}\n.show-more-arrow {\n  font-size: 28rpx;\n}\n',
    ).n2 === 1,
  )
  t(
    'GA2 反向:字号相等 ⇒ 0(同词干)',
    cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 26rpx;\n}\n')
      .n2 === 0,
  )
  t(
    'GA2 反向:箭头更小 ⇒ 0',
    cssRun('.show-more-text {\n font-size: 32rpx;\n}\n.show-more-arrow {\n font-size: 24rpx;\n}\n')
      .n2 === 0,
  )
  t(
    'GA2 反向:单位不同判不出,但必须如实计数',
    cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 16px;\n}\n')
      .n2 === 0 &&
      cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 16px;\n}\n')
        .notes.undetermined.length === 1,
  )
  t(
    'GA2 反向:词干不同 ⇒ 不配对(不把无关箭头算进来)',
    cssRun('.view-all-text {\n font-size: 24rpx;\n}\n.card-arrow {\n font-size: 32rpx;\n}\n').n2 ===
      0,
  )
  t(
    'GA2 反向:remove 不得被当成 more(按词元等值,不按子串)',
    cssRun('.remove-text {\n font-size: 24rpx;\n}\n.remove-arrow {\n font-size: 32rpx;\n}\n').n2 ===
      0,
  )
  t(
    'GA2 反向:串里生成的 CSS 不算本文件样式声明',
    only({
      'packages/app/s.ts':
        'export const css = `.show-more-text{font-size:24rpx}\\n.show-more-arrow{font-size:40rpx}`\n',
    }).n2 === 0,
  )
  t(
    'GA2 反向:CSS 的 content: "›" 不算整格 JSX 子内容',
    cssRun('.a::after {\n  content: "›";\n  font-size: 40rpx;\n}\n').n1 === 0,
  )
  const RN_DIRTY =
    "import { StyleSheet } from 'react-native'\nexport const styles = StyleSheet.create({\n  moreText: { fontSize: 12 },\n  moreArrow: { fontSize: 16 },\n})\n"
  t(
    'GA2 阳性对照:RN 兄弟键 moreText 12 × moreArrow 16 看得见',
    only({ 'packages/app/r.tsx': RN_DIRTY }).n2 === 1,
  )
  t(
    'GA2 反向:同组两档字号齐平 ⇒ 0',
    only({ 'packages/app/r2.tsx': RN_DIRTY.replace('fontSize: 16', 'fontSize: 12') }).n2 === 0,
  )
  t(
    'GA2 兜底形态:组内唯一 label × 唯一 arrow 即使不成词干也要配对(任务书 sibling Arrow key)',
    only({
      'packages/app/r3.tsx':
        'export const s = { showMoreLabel: { fontSize: 14 }, arrow: { fontSize: 20 } }\n',
    }).n2 === 1,
  )
  t(
    'GA2 兜底反向:组内两个 label ⇒ 不猜谁配谁',
    only({
      'packages/app/r4.tsx':
        'export const s = { showMoreLabel: { fontSize: 14 }, moreText: { fontSize: 12 }, arrow: { fontSize: 20 } }\n',
    }).n2 === 0,
  )
  t(
    'GA2 不越层:孙对象的 fontSize 不得记到父键上',
    only({
      'packages/app/r5.tsx':
        'export const s = { moreText: { padding: 4, inner: { fontSize: 12 } }, moreArrow: { fontSize: 8 } }\n',
    }).n2 === 0,
  )
  t(
    'GA2 兄弟组隔离:不同对象组里的同名字键不互配',
    only({
      'packages/app/r6.tsx':
        'export const a = { moreText: { fontSize: 12 } }\nexport const b = { moreArrow: { fontSize: 20 } }\n',
    }).n2 === 0,
  )

  // 词法单元
  t(
    'wordsOf 三种命名法切词同形',
    JSON.stringify(wordsOf('showMoreText')) === JSON.stringify(['show', 'more', 'text']) &&
      JSON.stringify(wordsOf('show-more-text')) === JSON.stringify(['show', 'more', 'text']),
  )
  t(
    'stemOf 剥箭头与角色词后同干',
    stemOf('show-more-arrow') === 'show-more' &&
      stemOf('moreText') === 'more' &&
      stemOf('moreArrow') === 'more',
  )
  t(
    'isLabelName 只认 more/viewAll 系',
    isLabelName('viewAllRow') &&
      isLabelName('moreText') &&
      !isLabelName('removeText') &&
      !isLabelName('moreArrow'),
  )
  t('剥注释不漂行号', stripCommentsKeepStrings('a\n// b\nc').code.split('\n').length === 3)
  t(
    'parseTagAt:属性里的 => 不吃掉标签尾(尾 > 才是标签终点)',
    parseTagAt('<Text onPress={() => x()}>›</Text>', 0, new Array(40).fill(false))?.end === 26,
  )
  t(
    'parseTag:a<b 与泛型尖括号一律拒绝',
    parseTagAt('a<b>', 1, new Array(4).fill(false)) === null &&
      parseTagAt('<T,>(x: T)', 0, new Array(10).fill(false)) === null,
  )
  t(
    'parseTag:串内的 < 不当标签起点(JSX 属性串/HTML 串)',
    parseTagAt('a = "<b>", <Text>', 4, [
      ...Array(4).fill(false),
      true,
      ...Array(12).fill(true),
      ...Array(6).fill(false),
    ]) === null,
  )

  // S0:机制在位 / 被摘线 / 无人 import
  t(
    'S0 反向:机制齐备且被 import ⇒ 0',
    only({ 'packages/app/ok.tsx': 'export const K = 1\n' }).n0 === 0,
  )
  t(
    'S0 阳性对照:共享组件被改回文本字形 ⇒ 必红',
    only({
      'packages/app/src/components/MoreLink.tsx':
        'export function MoreLink({ label }) {\n  return <Text>{label}</Text>\n}\n',
      'packages/app/c.tsx': 'export const K = 1\n',
    }).n0 >= 1,
  )
  t(
    'S0 阳性对照:机制在位但无人 import ⇒ 必红(没装车等于没有)',
    run({ ...MECH_SNIPPETS, 'packages/app/noise.tsx': 'export const K = 1\n' }).n0 >= 1,
  )

  // 自豁免与未判定:必须如实计数,不得静默成"看起来全绿"
  const selfRun = run({
    'scripts/check-glyph-arrow-icon.mjs': CONTROL_TSX,
    'scripts/tests/check-glyph-arrow-icon.test.mjs':
      '.show-more-text{font-size:26rpx}\n.show-more-arrow{font-size:28rpx}\n',
    ...MECH_SNIPPETS,
    'packages/app/c.tsx': 'export const K = 1\n',
  })
  t(
    '自豁免:门自身与其测试被跳过、不判红,且如实报数 2 个(其余 4 个仍实读)',
    selfRun.n1 === 0 &&
      selfRun.n2 === 0 &&
      selfRun.notes.selfExempt === 2 &&
      selfRun.notes.scanned === 4,
    `selfExempt=${selfRun.notes.selfExempt} scanned=${selfRun.notes.scanned}`,
  )
  const gapRun = run({ 'packages/app/clean.tsx': 'export const K = 1\n' })
  t(
    'S0 机制文件在取材面取不到 ⇒ 逐条点名"无法判定"(不得静默记为通过)',
    gapRun.s0.length === MECHANISMS.length && gapRun.notes.scanned === 1,
    `s0=${gapRun.s0.length} scanned=${gapRun.notes.scanned}`,
  )

  // 棘轮:锚点必须是"该文件 HEAD 自身",既不能恒红也不能恒绿
  const sf = splitFresh(
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 3],
      ['c.tsx', 1],
    ]),
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 2],
    ]),
  )
  t(
    '棘轮反向:计数与 HEAD 持平 ⇒ 存量放过(把锚点写成 0 会让 70 处存量恒红)',
    sf.fresh.every((f) => f.rel !== 'a.tsx') && sf.tolerated === 3,
  )
  t(
    '棘轮阳性:计数比 HEAD 多 ⇒ 判新增并点名差值',
    sf.fresh.length === 2 && sf.fresh.some((f) => f.rel === 'b.tsx' && f.n === 3 && f.tol === 2),
  )
  t(
    '棘轮:HEAD 无锚点的新文件按 0 容忍 ⇒ 直接判新增',
    sf.fresh.some((f) => f.rel === 'c.tsx' && f.tol === 0),
  )
  t(
    '棘轮:计数比 HEAD 少(清理了存量)⇒ 放过',
    splitFresh(new Map([['a.tsx', 1]]), new Map([['a.tsx', 5]])).fresh.length === 0,
  )

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases)
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`)
  console.log(`${cases.length - failed.length}/${cases.length} 通过`)
  return failed.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  scan,
  scanRepo,
  auditFile,
  splitFresh,
  countsByFile,
  findGlyphIconChildren,
  parseTagAt,
  collectFontSizes,
  findOpticalMismatch,
  shallowBody,
  braceParents,
  wordsOf,
  stemOf,
  isLabelName,
  isArrowName,
  stripCommentsKeepStrings,
  stripCommentsAndStrings,
  collectExemptLines,
  objectBody,
  lineOf,
  BARE_GLYPH_RE,
  BRACED_GLYPH_RE,
  HANDLER_ATTR_RE,
  AFFORDANCE_TAG_RE,
  PREFILTER,
  SCAN_DIRS,
  MECHANISMS,
  SELF_EXEMPT_RE,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
