#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * emoji 图标守门 — 防止新增「UI 图标位置使用 emoji/字符图标」违规。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"与"图标统一用图标库(强制)":
 *   UI 图标一律用矢量图标库(web: lucide-react / RN: lucide-react-native /
 *   Taro: static/images/icons/*.svg 经 <Image> 渲染),禁止 emoji 充当图标。
 *   配置数组里的 icon: 'emoji' 须改为 icon: LucideIcon 组件引用。
 *
 * 检测两类违规(BLOCKING):
 *   1) 配置数组 icon 字段:icon: '🦄' / icon: "🌟" / icon: `🚀` → 违规
 *   2) 渲染级 emoji 图标:JSX 内 <Text>▶</Text> / <span>✅</span> /
 *      {liked ? '♥' : '♡'} 等直接渲染在 UI 图标位置的 emoji → 违规
 *
 * 加固维度(G-880 判据③,2026-10-23,棘轮档):.svg/.css/.json 此前整片在射程外;
 *   现收 css `content:"🦄"`、json `"icon":"🦄"`、svg emoji 字形三型。
 *   全量档(HEAD)对加固维度**只报数不阻断**(§0.5/§12e,防并行漂移恒红),
 *   `--staged` 档只拦本次提交新增行。立项现读精确判据存量 = 0。
 *
 * 豁免(不判违规):
 *   - 注释行(// /* * 及行内 // 之后)
 *   - i18n 文案参数:tt('key', '📺 我要开播') / t('key', {…}) 等函数参数内的 emoji
 *   - 评分星数据展示:'★'.repeat(n) / '★0'(评级渲染,非 UI 按钮图标)
 *   - 表情面板(用户输入表情选择,如 InputArea 的表情数组)
 *   - docs/营销页正文里的装饰性 emoji(AGENTS.md §4 明确豁免"文档/营销页正文装饰性 emoji";
 *     但 docs 页面的 icon: 配置字段仍判违规)
 *
 * 用法:
 *   node scripts/check-no-emoji-icons.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-no-emoji-icons.mjs             (全量扫描报告, 违规则 exit 1)
 *   node scripts/check-no-emoji-icons.mjs --worktree  (人工逃生舱: 判磁盘, 不作提交门禁)
 *
 * 判定面(AGENTS §0.4):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;
 * 清单与正文取自**同一个**被审面,取不到 ⇒ exit 2「未判定」(不冒红也不记绿),绝不回落另一个面。
 * 旧版扫的是磁盘全树(含未跟踪文件与并行会话的半编辑态) —— 提交门要判的是提交里的那一份,故改面。
 *
 * §22d:本文件既可 CLI 直跑,也可被镜像测试 import 取判据(`__test__`);模块顶层零副作用、零 exit。
 *
 * 跳过方法(紧急):HUSKY_SKIP_NO_EMOJI=1 git commit ...
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { COLORS as C } from './lib/logger.mjs'
import { Undetermined, assertRepoRoot, listFaceFiles, selectFace } from './lib/face-reader.mjs'
import { addedLineNumbers, readSources } from './lib/face-scan.mjs'

/**
 * ROOT 由脚本自身位置推导(AGENTS §15:共享工作区 cwd 不可靠,不得用 process.cwd() 定根)。
 * 旧写法 `process.cwd()` 在子目录 / `pnpm --filter` 里调用时会把"扫描了 0 个文件"读成通过。
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const HELP_TEXT = `
check-no-emoji-icons.mjs — emoji 图标守门(UI 图标位置禁 emoji)

用法:
  node scripts/check-no-emoji-icons.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-emoji-icons.mjs             全量扫描(违规则 exit 1)
  node scripts/check-no-emoji-icons.mjs --worktree  人工逃生舱:判磁盘(不作提交门禁)
  node scripts/check-no-emoji-icons.mjs --help      显示本帮助

判定(BLOCKING):
  - icon: '🦄' 配置字段(AGENTS.md 点名的违规模式)
  - JSX 渲染级 emoji(<Text>▶</Text> / <span>✅</span> / {a ? '♥' : '♡'})
  - 整行裸 emoji(被拆行的 JSX 文本子节点)

加固维度(G-880 判据③,棘轮档 — 全量面只报数,--staged 拦本次新增):
  - .css  content: "🦄"(生成位=渲染位)
  - .json "icon": "🦄"(配置字段)
  - .svg  任意 emoji 字形(矢量图标文件里出现 emoji 字符)

豁免:
  - 注释行
  - i18n 参数(tt('k','📺 文案') / t('k', …))
  - 评分星('★'.repeat(n))
  - 表情面板(InputArea 表情数组的数据行)
  - docs 正文装饰性 emoji(但 docs 的 icon: 字段仍违规)
  - asset 行级注释(css /* */ 与续行、svg <!-- -->)
`

// 排除目录:共享 EXCLUDE_DIRS + 构建产物/测试
// 2026-09-15 补:.next-static / .next-e2e* 为 Next 构建产物目录(并行会话构建时生成),
/**
 * 扫描根目录:仅前端 UI 端(界面图标规范适用域)。
 * 排除:apps/api / apps/ai-service / apps/cli / sdks(后端数据、终端输出、服务端模板,
 * 无矢量图标库概念;landing.ts 为营销页 HTML 模板正文,豁免)。
 */
const UI_SCAN_ROOTS = [
  'apps/web',
  'apps/mobile-rn',
  'apps/miniapp-taro',
  'apps/extension',
  'apps/desktop',
  'packages/app',
  'packages/ui-react',
]

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

/**
 * 加固维度(G-880 判据③,2026-10-23 立):此前 emoji 只扫 .ts/.tsx/.js/.jsx,
 * .svg/.css/.json 整片在射程外 —— css 的 `content:"🦄"`(生成位=渲染位)、json 的
 * `"icon":"🦄"`(配置字段)、svg 里的 emoji 字形(字符当图标的最直接形态)全都看不见。
 * 接法 = **HEAD 存量棘轮**(§0.5/§12e):立项时现读精确判据存量为 0(6 处含 emoji 的
 * asset 行全是注释),但"量存量"与"门生效"之间并行会话仍可落入新违规,故全量档(HEAD)
 * 对 asset 维度**只报数不阻断**,`--staged` 档经 addedLineNumbers 天然只拦本次提交新增行。
 * 存量清零后升 blocking 由后续票决定 —— 判据本体在此。
 */
const ASSET_SCAN_EXTS = ['.svg', '.css', '.json']

// 渲染级 emoji 检测(显式 Unicode 区段,排除 © U+00A9 / ® U+00AE 等版权符号)
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/** 违规 1:icon: 'emoji' / icon: "emoji" / icon: `emoji`(配置数组字段) */
const ICON_FIELD_RE = /\bicon\s*:\s*['"`][\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/**
 * 违规 2:渲染级 emoji 图标(JSX 渲染位)。
 * 覆盖:
 *   - JSX 标签直接渲染: <Text>▶</Text> / <span>✅</span>(标签后紧跟 emoji)
 *   - JSX 三元条件图标(花括号表达式): {liked ? '♥' : '♡'} / {showToken ? '🙈' : '👁'}
 *     (要求花括号包裹,避免误伤普通 JS 赋值 const x = a ? '✅' : '❌')
 * 不检测:模板字符串内 emoji(markdown 导出 / 日志文本,isExempt 中豁免)、
 *   对象属性值(text: '⏹' 等数据字段)、表格布尔标记(<td>{c.nullable ? '✓' : '—'}</td>)。
 */
const RENDER_EMOJI_RE =
  /<[a-zA-Z][^>]*>[\s]*[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]|\{[^}]*?\?\s*['"`][\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/**
 * 表情面板:文件名命中该式的,过去**整文件**豁免 ⇒ 同文件里把 emoji 摆在**按钮位**结构上看不见。
 * 实测站点(2026-09-29):`apps/miniapp-taro/src/components/InputArea.tsx` 的表情开关钮就是
 * `<Text …onClick={toggleEmoji}>😊</Text>` —— 面板数据合法(§4),按钮位违规,而旧豁免把两者一起放行,
 * 且 `--staged` / 全量两档都报绿。现豁免只认**数据行形状**,渲染位与 icon: 字段照判。
 */
const EMOJI_PICKER_FILE_RE = /InputArea\.(tsx|ts)$/

/**
 * 字符类只从上面那一份 EMOJI_RE 派生,不得再抄第四份 Unicode 区段表
 * (本文件原本已有三处逐字复制;两处算同一件事必漂移,见 AGENTS「两处算同一件事必漂移」条)。
 * 提取不到 ⇒ 本门对自己失明,当场大声退出 2,不静默降级成"什么都豁免不了"或"全放行"。
 *
 * 2026-10-23:检查从模块顶层移进 `main()` 的第一格 —— 顶层 `process.exit(2)` 会让**测试 import**
 * 这个模块时当场打死宿主(§22d 要防的正是这一型),而"判据起不来"与"有没有人 import"无关。
 * 派生失败时用空字符类兜住模块加载(空字符类在 JS 里合法,只是永不匹配),再由 `CHAR_CLASS_BROKEN`
 * 在 main 里如实折成 exit 2 —— 不静默、也不改判据。
 */
const CHAR_CLASS_ERROR =
  '❌ 无法从 EMOJI_RE 提取字符类(该区段表达式被改写过?)⇒ 面板数据判据无从成立,拒绝出具结论'
const EMOJI_CHAR_CLASS = /^\[(.*)\]$/u.exec(EMOJI_RE.source)?.[1] ?? ''
const CHAR_CLASS_BROKEN = EMOJI_CHAR_CLASS === ''
const QUOTE_CC = "['\"`]"
/** 面板数组的一行一个元素:`'😀',` / `"😊",` / `` `👍` `` */
const PANEL_ELEMENT_RE = new RegExp(`^${QUOTE_CC}[${EMOJI_CHAR_CLASS}]+${QUOTE_CC},?$`, 'u')
/** 整行写成的数组字面量:`const EMOJI_LIST = ['😀','😁']` / `EMOJI_LIST: [...]`(声明关键字可有) */
const PANEL_ARRAY_RE = new RegExp(
  `^(?:const\\s+|let\\s+|var\\s+)?[\\w$]+\\s*[:=]\\s*\\[.*[${EMOJI_CHAR_CLASS}].*\\][,;]?$`,
  'u',
)

/**
 * 违规 3:整行就是一个裸 emoji(JSX 文本子节点被 prettier 拆到独立行)。
 * 立因:`RENDER_EMOJI_RE` 是**行内**判据(`<Tag>emoji`),而真实产出形态是
 * `<Text\n className=…\n>\n  😊\n</Text>` —— 开标签与 emoji 不同行,旧判据对它零命中,
 * 这就是上面那个按钮位能活到今天的第二个原因(第一个是整文件豁免)。
 * 假阳面已量过(HEAD 同面 6 命中:5 处真违规 + 1 处 `<kbd>` 键帽 ⌫ 由豁免 7 覆盖),无引号、无运算符
 * 的裸 emoji 行在 .ts/.tsx/.js/.jsx 里只能是 JSX 文本,不构成数据。
 */
const BARE_EMOJI_LINE_RE = new RegExp(`^[${EMOJI_CHAR_CLASS}]+$`, 'u')

/**
 * 加固维度判据(asset 文件)。字符类一律从 EMOJI_CHAR_CLASS 派生(单源,见上方登记),
 * 判据按扩展名分流、维度互不污染:json 只认 icon 字段、css 只认 content 生成声明、
 * svg 认任意 emoji 字形(矢量图标文件里出现 emoji 字符 = 拿字符当图标本体)。
 */
const JSON_ICON_FIELD_RE = new RegExp(`"icon"\\s*:\\s*['"\`][${EMOJI_CHAR_CLASS}]`, 'u')
const CSS_CONTENT_EMOJI_RE = new RegExp(`\\bcontent\\s*:[^;]*[${EMOJI_CHAR_CLASS}]`, 'iu')
const SVG_EMOJI_RE = new RegExp(`[${EMOJI_CHAR_CLASS}]`, 'u')
/** asset 行级注释豁免:css 块注释起/续行(`/*`、` * `)、js 式 `//`、svg 注释 `<!--`(实测 6 处存量全在这一族) */
const ASSET_COMMENT_RE = /^\s*(?:\/\/|\/\*|\*|<!--)/

// 评分星纯数据(非 JSX 渲染位):'★'.repeat(n) 生成字符串(如导出/纯逻辑),豁免。
//   注:JSX 渲染位 <Text>★ {rating}</Text> 仍由 RENDER_EMOJI_RE 捕获,不豁免。
/** 行级豁免判定 — 返回 true 表示该行不算违规 */
function isExempt(line, file) {
  const trimmed = line.trim()
  // 豁免 1:整行注释。JSX 注释只认 `{/*` 起手 —— 旧式写了 `\{`,于是**任何** JSX 表达式行
  // (`{selected && <Text>✓</Text>}` / `{r.success ? '✓' : '✗'}`)都被当成注释放过,
  // 这一支把本门对自己立项那一型的大部分站点整族隐身(2026-09-29 现读补)。
  if (/^\s*(\/\/|\/\*|\*|\/\*\*|\{\/\*)/.test(trimmed)) return true

  // 豁免 2:表情面板的**数据行**(仅面板文件、且该行就是数组元素/数组字面量)。
  // 刻意不是整文件豁免 —— 按钮位/渲染位即使在面板文件里也照样判(见 EMOJI_PICKER_FILE_RE 上方登记)。
  if (EMOJI_PICKER_FILE_RE.test(file)) {
    if (PANEL_ELEMENT_RE.test(trimmed) || PANEL_ARRAY_RE.test(trimmed)) return true
  }

  // 豁免 3:行内 // 注释之后出现的 emoji(说明性注释)
  const em = EMOJI_RE.exec(line)
  if (em && line.slice(0, em.index).includes('//')) return true

  // 豁免 4:模板字符串内的 emoji(markdown 导出 / 日志文本 / 内容文案,非 UI 渲染位)
  if (em) {
    // 检查 emoji 是否在反引号模板字符串内(统计行内反引号数量,奇数为在模板内)
    const backticks = (line.slice(0, em.index).match(/`/g) || []).length
    if (backticks % 2 === 1) return true
  }

  // 豁免 5:i18n 参数内的 emoji:tt('k', '📺') / t('k', ...) / useTt / getTranslations
  if (em) {
    const before = line.slice(0, em.index)
    if (/\b(?:tt|t|useTt|nt|getTranslations)\s*\(/.test(before)) {
      // 确认 emoji 在引号内(前面有未闭合的 ' 或 ")
      const quoteBefore = line.slice(0, em.index).split('').reverse().join('')
      const quoteMatch = quoteBefore.match(/['"`]/)
      if (quoteMatch) return true
    }
  }

  // 豁免 6:评分星纯数据('★'.repeat(n))与表格布尔标记(<td>{c.nullable ? '✓' : '—'}</td>)
  //   注意:★/☆/❤/♡ 若出现在 JSX 渲染位(如 <Text>★ {rating}</Text>、<Text>♡ {likes}</Text>)
  //   仍判违规——它们是 UI 图标位,须替换为图标库组件(web: lucide Star/Heart, Taro: star.svg/heart.svg)。
  if (em && /[★☆]/.test(em[0]) && /\.repeat\(/.test(line)) return true
  // 表格布尔标记(<td>{c.nullable ? '✓' : '—'}</td> 数据单元格)
  if (em && /[✓✗×✕—]/.test(em[0]) && /<t[dh]\b/.test(line)) return true

  // 豁免 7:键盘快捷键符号(⌘ ⇧ ⌥ ⌃ 等非 emoji 的 UI 指示符)
  if (em && /[⌘⇧⌥⌃⌫⌦]/.test(line)) return true

  // 豁免 8:docs/营销页正文(AGENTS.md §4 明确豁免"文档/营销页正文装饰性 emoji")。
  //   含 <code>/<pre> 代码示例里的 icon: '📄' 等演示代码——属文档正文,非真实 UI 配置。
  //   兼容 Windows 反斜杠路径与正斜杠路径。
  const isDocsPage =
    file.includes('app/(main)/docs') ||
    file.includes('app\\(main)\\docs') ||
    file.includes('(marketing)')
  if (isDocsPage) return true

  return false
}

/**
 * 单行判定 —— 主循环与 `--self-test` **共用这一份**。
 * 本仓记过多次的失效型就是"判据有一份、自检另写一份",于是自检恒绿而门是瞎的。
 */
function judgeLine(line, lineNumber, file) {
  if (isExempt(line, file)) return null

  const im = ICON_FIELD_RE.exec(line)
  if (im) {
    return {
      line: lineNumber,
      col: im.index + 1,
      label: 'icon field emoji',
      snippet: line.trim().slice(0, 140),
    }
  }

  const rm = RENDER_EMOJI_RE.exec(line)
  if (rm) {
    return {
      line: lineNumber,
      col: rm.index + 1,
      label: 'render emoji icon',
      snippet: line.trim().slice(0, 140),
    }
  }

  // 违规 3:整行一个裸 emoji = 被拆成独立行的 JSX 文本子节点(前两条行内判据都看不见它)
  const bare = BARE_EMOJI_LINE_RE.exec(line.trim())
  if (bare) {
    return {
      line: lineNumber,
      col: line.length - line.trimStart().length + 1,
      label: 'bare emoji JSX child',
      snippet: line.trim().slice(0, 140),
    }
  }

  return null
}

/**
 * 加固维度单行判定(asset 文件)—— 与 judgeLine 同构:主循环与 `--self-test` 共用这一份。
 * 分流按扩展名;注释行豁免;非 asset 扩展名返回 null(代码维度请走 judgeLine)。
 */
function judgeAssetLine(rel, line, lineNumber) {
  const trimmed = line.trim()
  if (ASSET_COMMENT_RE.test(trimmed)) return null
  if (rel.endsWith('.json')) {
    const m = JSON_ICON_FIELD_RE.exec(line)
    if (m)
      return { line: lineNumber, col: m.index + 1, label: 'json icon field emoji', snippet: trimmed.slice(0, 140) }
    return null
  }
  if (rel.endsWith('.css')) {
    const m = CSS_CONTENT_EMOJI_RE.exec(line)
    if (m)
      return { line: lineNumber, col: m.index + 1, label: 'css content emoji icon', snippet: trimmed.slice(0, 140) }
    return null
  }
  if (rel.endsWith('.svg')) {
    const m = SVG_EMOJI_RE.exec(line)
    if (m)
      return { line: lineNumber, col: m.index + 1, label: 'svg emoji glyph', snippet: trimmed.slice(0, 140) }
    return null
  }
  return null
}

/**
 * `--self-test`:成对正反例。每条"豁免"都必须配一条"同一位置的另一种写法仍判违规",
 * 否则自检只能证明标记存在,不能证明它没被顺手放宽(本仓把这一型记作"恒绿的断言比没有断言更糟")。
 */
function runSelfTest() {
  const PANEL = 'apps/miniapp-taro/src/components/InputArea.tsx'
  const OTHER = 'apps/web/src/components/demo.tsx'
  // 用例登记走共用出口(scripts/lib/selftest-registrant.mjs):thunk 在消费循环里**必被调用**,
  // 值形态即算即得 —— 结构上封死"登记侧写 !!ok 而用例传箭头函数 ⇒ 恒真"的老洞(守门 41 同型)。
  // 第三参 detail 与旧 extra 同位:失败时进 got,成功时不打印。
  const { t, report } = makeRegistrar()

  // ① 面板**数据行**仍然豁免(收窄后不能把合法内容文案判红)
  t('面板文件里的数组元素行豁免', isExempt("      '😀',", PANEL))
  t('面板文件里的整行数组字面量豁免', isExempt("const EMOJI_LIST = ['😀','😁','😊']", PANEL))
  // ② 面板文件里的**渲染位**必须判违规(旧版整文件豁免吃掉的就是这两型)
  t('面板文件里的行内渲染位仍判违规', judgeLine('<Text className="x">😊</Text>', 1, PANEL) !== null)
  // 表达式行(`{…}` 起手)过去被"注释豁免"整族吃掉 —— 这两条就是那 26 处隐身的现场形态
  t(
    '{cond && <Text>✓</Text>} 必须判违规(旧豁免把它当注释)',
    judgeLine('{selected && <Text className="text-xs text-primary">✓</Text>}', 353, OTHER)?.label ===
      'render emoji icon',
  )
  t(
    '{a ? \'✓\' : \'✗\'} 必须判违规',
    judgeLine("{r.success ? '✓' : '✗'}", 1393, OTHER)?.label === 'render emoji icon',
  )
  t(
    '面板文件里的裸 emoji 行(真实现场形态)判违规',
    judgeLine('              😊', 861, PANEL)?.label === 'bare emoji JSX child',
  )
  t('面板文件里的 icon: 字段仍判违规', judgeLine("  icon: '🦄',", 1, PANEL)?.label === 'icon field emoji')
  // ③ 数据形状豁免**不外溢**到非面板文件(否则"任何 emoji 数组都算数据"就是新盲区)
  t('非面板文件的数组元素行不豁免', !isExempt("      '😀',", OTHER))
  // ④ 既有豁免族逐一守住(证明本次改动没把它们一起削掉)
  t('注释行豁免', isExempt('// 这里曾有 😊', OTHER))
  t("评分星 '★'.repeat 豁免", isExempt("  return '★'.repeat(n)", OTHER))
  t('表格布尔标记豁免', isExempt('<td>{c.nullable ? \'✓\' : \'—\'}</td>', OTHER))
  t('i18n 参数豁免', isExempt("tt('live.start', '📺 我要开播')", OTHER))
  t('键盘键帽(⌫)豁免', isExempt('⌫', OTHER))
  // ⑤ 派生字符类必须与 EMOJI_RE 同结论(单份实现的等价性证明,不是"看着像")
  const derived = new RegExp(`[${EMOJI_CHAR_CLASS}]`, 'u')
  const probes = ['😀', '😊', '★', '✓', '⭐', '⌫', 'A', '©', '®', '中', ' ', '‍']
  t(
    '派生字符类与 EMOJI_RE 逐码位同结论',
    probes.every((c) => EMOJI_RE.test(c) === derived.test(c)),
    probes.filter((c) => EMOJI_RE.test(c) !== derived.test(c)).join(' '),
  )
  // ⑥ 判据有牙的反向证明:把裸行判据喂给一个**不是**整行 emoji 的形态,不得命中
  t('带引号的裸数据形态不被违规 3 命中', judgeLine("  '😊',", 1, OTHER)?.label !== 'bare emoji JSX child')
  t('普通赋值行不被违规 3 命中', judgeLine('const x = a ? 1 : 2', 1, OTHER) === null)
  // ⑦ 加固维度(G-880 判据③,asset):每条正例配同位反向对照,且证明分流互不污染
  t('css content 生成位 emoji 判违规', judgeAssetLine('a.css', '  content: "🦄";', 3)?.label === 'css content emoji icon')
  t('css 块注释续行里的 emoji 豁免(实测 6 处存量全在这一族)', judgeAssetLine('a.css', ' * ⚠️ 说明 😊', 77) === null)
  t('json icon 字段 emoji 判违规', judgeAssetLine('a.json', '  "icon": "🦄",', 12)?.label === 'json icon field emoji')
  t('json 文案字段不判违规(非图标位)', judgeAssetLine('a.json', '  "label": "🎉 活动",', 13) === null)
  t('svg emoji 字形判违规', judgeAssetLine('a.svg', '<text>😊</text>', 4)?.label === 'svg emoji glyph')
  t('svg 注释行豁免', judgeAssetLine('a.svg', '<!-- 😊 占位说明 -->', 2) === null)
  t('asset 候选收 .css/.svg/.json', isScanCandidate('apps/web/src/a.css') && isScanCandidate('packages/ui-react/icon.svg') && isScanCandidate('apps/web/src/cfg.json'))
  t('后端 asset 仍不收(射程锁)', !isScanCandidate('apps/api/src/a.css'))
  t('分流互不污染:css 文件不吃代码维 icon 判据', judgeText('apps/web/src/a.css', "icon: '🦄'").length === 0)
  t('分流互不污染:ts 文件不吃 css 维 content 判据', judgeText(OTHER, '  content: "🦄";').length === 0)
  t('asset 判据与 EMOJI_RE 同码位集(派生单源)', ['🦄', '😊', 'A', '©', '中'].every((c) => SVG_EMOJI_RE.test(c) === EMOJI_RE.test(c)))

  const r = report()
  for (const c of r.cases) {
    console.log(`${c.pass ? '  ✅' : '  ❌'} ${c.name}${!c.pass && c.got && c.got !== 'false' ? ` — ${c.got}` : ''}`)
  }
  console.log(`自检 ${r.pass} 通过 / ${r.fail} 失败(共 ${r.cases.length} 条)`)
  return r.fail === 0 ? 0 : 1
}

/**
 * 扫描候选:只看前端 UI 端(UI_SCAN_ROOTS)下的 .ts/.tsx/.js/.jsx,且路径段不含构建产物。
 * 与旧版磁盘 walk 的目录剪枝等价(2026-09-15 那条 .next* 教训原样保留),区别只在
 * **清单来源**:旧版 walk 磁盘(含未跟踪文件与并行会话的半编辑态),现在来自被审面。
 */
function isScanCandidate(rel) {
  // 射程锁:非 UI 扫描根直接不收。生产路径里 pathspec 已保证前缀(此判据是冗余防线),
  // 但导出口必须自洽 —— 镜像测试直判本函数,"后端不在射程"不能只靠调用方记得传 pathspec。
  if (!UI_SCAN_ROOTS.some((r) => rel.startsWith(r + '/'))) return false
  const parts = rel.split('/')
  if (parts.some((p) => isExcludedDirName(p) || p.startsWith('.next'))) return false
  const base = parts[parts.length - 1] ?? ''
  return (
    SCAN_EXTS.some((e) => base.endsWith(e)) || ASSET_SCAN_EXTS.some((e) => base.endsWith(e))
  )
}

/**
 * 单文件判定 —— 判据仍只有 `judgeLine`(代码维)/ `judgeAssetLine`(asset 维)各一份,
 * 主循环与 `--self-test` 共用。按扩展名分流,维度互不污染。
 * `allowedLines` 为 null 表示不限行(全量/HEAD 档);`--staged` 档只判本次新增行。
 */
function judgeText(rel, text, allowedLines = null) {
  const asset = ASSET_SCAN_EXTS.some((e) => rel.endsWith(e))
  const findings = []
  text.split('\n').forEach((line, idx) => {
    const lineNumber = idx + 1
    if (allowedLines && !allowedLines.has(lineNumber)) return
    // 判定只有一份实现(judgeLine / judgeAssetLine 按扩展名分流)—— 主循环与自检共用,
    // 避免"自检绿而门瞎"那一型
    const f = asset ? judgeAssetLine(rel, line, lineNumber) : judgeLine(line, lineNumber, rel)
    if (f) findings.push(f)
  })
  return findings
}

/**
 * 取样 + 判定。清单与正文取自**同一个**被审面(AGENTS §0.4):取不到 ⇒ `Undetermined`
 * (调用方折成 exit 2),绝不回落另一个面 —— 混面会让报告说的和提交里的不是同一份代码。
 */
function analyze({ root = ROOT, face = 'head' } = {}) {
  const listed = listFaceFiles(root, face, { paths: UI_SCAN_ROOTS }).filter(isScanCandidate)
  if (listed.length === 0) {
    throw new Undetermined(
      `被审面 ${face} 在 ${UI_SCAN_ROOTS.length} 个 UI 扫描根下枚举到 0 个 .ts/.tsx/.js/.jsx/.svg/.css/.json 文件 ⇒ 无法判定(不冒红也不记绿)`,
    )
  }
  // --staged 档只判本次新增行(diff 解析只有 face-scan 一份实现,本文件不再自带第二份)
  const added = face === 'staged' ? addedLineNumbers(root) : null
  const targets = added ? listed.filter((rel) => added.has(rel)) : listed
  if (targets.length === 0) {
    return {
      face,
      scanned: 0,
      skippedMissing: [],
      totalViolations: 0,
      fileReports: [],
      assetStock: 0,
      assetReports: [],
      empty: true,
    }
  }
  const { texts, skippedMissing } = readSources(root, face, targets)
  let totalViolations = 0
  const fileReports = []
  let assetStock = 0
  const assetReports = []
  for (const rel of targets) {
    // 只有 worktree 档会缺正文(并发席正删着),已计入 skippedMissing;判空串等于假绿
    if (!texts.has(rel)) continue
    const findings = judgeText(rel, texts.get(rel), added ? added.get(rel) : null)
    if (findings.length === 0) continue
    // 棘轮(§0.5/§12e):asset 加固维度在**非 staged 档**(全量 HEAD / worktree)只报数不阻断;
    // staged 档 judgeText 已按新增行过滤,命中必是"本次提交带进来的新增"⇒ 并入阻断集照拦。
    if (ASSET_SCAN_EXTS.some((e) => rel.endsWith(e)) && face !== 'staged') {
      assetStock += findings.length
      assetReports.push({ file: rel, findings })
      continue
    }
    totalViolations += findings.length
    fileReports.push({ file: rel, findings })
  }
  return {
    face,
    scanned: targets.length,
    skippedMissing,
    totalViolations,
    fileReports,
    assetStock,
    assetReports,
    empty: false,
  }
}


function printBanner(face) {
  const mode = face === 'staged' ? 'staged (新增违规阻塞 commit)' : '全量 (违规则 exit 1)'
  console.log(`${C.cyan}${C.bold}[emoji 图标守门] 扫描 UI 图标位 emoji 违规...${C.reset}`)
  console.log(
    `${C.dim}规则: AGENTS.md 第 4 节 — UI 图标统一图标库(web: lucide-react / RN: lucide-react-native / Taro: SVG <Image>),禁 emoji 充当图标${C.reset}`,
  )
  console.log(`${C.dim}模式: ${mode}${C.reset}`)
  console.log('')
}

/** 报告版式与旧版逐字一致(扫描结果 / 扫描文件 / 违规数 + 修复方法 6 条),只把 exit 换成返回值。 */
function printReport(a) {
  console.log(`${C.bold}扫描结果:${C.reset}`)
  console.log(`  扫描文件: ${a.scanned} 个`)
  if (a.skippedMissing.length > 0) {
    console.log(
      `  读不到而跳过: ${a.skippedMissing.length} 个(并行会话在扫描期间增删所致,不影响判定;非 0 时如实打印而非静默)`,
    )
  }
  console.log(`  违规数:   ${a.totalViolations} 处 (BLOCKING)`)
  if (a.assetStock > 0) {
    console.log(`  加固维度存量: ${a.assetStock} 处 (.svg/.css/.json — 棘轮档,全量面只报数不阻断)`)
  }
  console.log('')

  if (a.assetReports.length > 0) {
    console.log(
      `${C.yellow}${C.bold}🔎 加固维度(asset emoji 图标位)命中 ${a.assetStock} 处 — 只拦本次提交新增(--staged),存量清零后由后续票升 blocking${C.reset}`,
    )
    for (const { file, findings } of a.assetReports) {
      console.log(`${C.yellow}${file}${C.reset}`)
      for (const f of findings) {
        console.log(
          `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.yellow}[${f.label}]${C.reset} ${f.snippet}`,
        )
      }
    }
    console.log('')
  }

  if (a.totalViolations === 0) {
    console.log(`${C.green}${C.bold}✅ emoji 图标守门通过${C.reset}`)
    return 0
  }

  console.log(`${C.red}${C.bold}❌ 发现 ${a.totalViolations} 处违规:${C.reset}`)
  console.log('')
  for (const { file, findings } of a.fileReports) {
    console.log(`${C.red}${file}${C.reset}`)
    for (const f of findings) {
      console.log(
        `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[${f.label}]${C.reset} ${f.snippet}`,
      )
    }
    console.log('')
  }
  console.log(`${C.dim}修复方法:${C.reset}`)
  console.log(`  1. web 端:lucide-react 组件(import { X } from 'lucide-react' → <X className="h-4 w-4" />)`)
  console.log(`  2. RN 端:lucide-react-native 组件(<X size={16} color={'#6b7280'} />)`)
  console.log(`  3. Taro 端:static/images/icons/*.svg + <Image src="/static/images/icons/xxx.svg" />`)
  console.log(`  4. 配置数组 icon: 'emoji' → icon: LucideIcon 组件引用`)
  console.log(`  5. 动态切换图标用三元组件: {playing ? <Pause /> : <Play />}`)
  console.log(`  6. 豁免范围:注释 / i18n 文案参数 / 评分星 / 表情面板 / docs 正文装饰(不含 icon: 字段)`)
  console.log('')

  if (a.face === 'staged') {
    console.log(`${C.red}${C.bold}❌ emoji 图标守门失败 — 提交已阻止${C.reset}`)
    console.log(`${C.dim}跳过方法:HUSKY_SKIP_NO_EMOJI=1 git commit ...${C.reset}`)
  }
  return 1
}

/** CLI 主流程。**返回退出码**而不是 process.exit —— 测试与自检要能拿到结论而不打死宿主。 */
export async function main(argv = process.argv.slice(2)) {
  if (process.env.HUSKY_SKIP_NO_EMOJI === '1') {
    console.log('⏭  emoji 图标守门(HUSKY_SKIP_NO_EMOJI=1, 跳过)')
    return 0
  }
  if (argv.includes('--help')) {
    console.log(HELP_TEXT)
    return 0
  }
  // 判据起不来 ⇒ 大声 exit 2(不静默降级成"全放行",也不冒红成"你违规")
  if (CHAR_CLASS_BROKEN) {
    console.error(CHAR_CLASS_ERROR)
    return 2
  }
  if (argv.includes('--self-test')) return runSelfTest()

  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  const { face } = picked
  try {
    assertRepoRoot(ROOT, 'emoji 图标守门')
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }

  printBanner(face)
  let result
  try {
    result = analyze({ root: ROOT, face })
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }
  if (result.empty) {
    console.log(`${C.green}✅ 暂存区无 .ts/.tsx/.js/.jsx/.svg/.css/.json 变更,跳过${C.reset}`)
    return 0
  }
  return printReport(result)
}

// §22d:模块加载不得触发主流程(镜像测试 import 判据就是这个姿势)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  isExempt,
  judgeLine,
  judgeAssetLine,
  judgeText,
  isScanCandidate,
  analyze,
  runSelfTest,
  main,
  EMOJI_RE,
  ICON_FIELD_RE,
  RENDER_EMOJI_RE,
  BARE_EMOJI_LINE_RE,
  JSON_ICON_FIELD_RE,
  CSS_CONTENT_EMOJI_RE,
  SVG_EMOJI_RE,
  ASSET_COMMENT_RE,
  PANEL_ELEMENT_RE,
  PANEL_ARRAY_RE,
  EMOJI_PICKER_FILE_RE,
  EMOJI_CHAR_CLASS,
  CHAR_CLASS_BROKEN,
  UI_SCAN_ROOTS,
  SCAN_EXTS,
  ASSET_SCAN_EXTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
