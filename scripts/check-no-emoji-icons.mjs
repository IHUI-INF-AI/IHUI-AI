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
 *
 * 跳过方法(紧急):HUSKY_SKIP_NO_EMOJI=1 git commit ...
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isHelp = process.argv.includes('--help')

if (process.env.HUSKY_SKIP_NO_EMOJI === '1') {
  console.log('⏭  emoji 图标守门(HUSKY_SKIP_NO_EMOJI=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-no-emoji-icons.mjs — emoji 图标守门(UI 图标位置禁 emoji)

用法:
  node scripts/check-no-emoji-icons.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-emoji-icons.mjs             全量扫描(违规则 exit 1)
  node scripts/check-no-emoji-icons.mjs --help      显示本帮助

判定(BLOCKING):
  - icon: '🦄' 配置字段(AGENTS.md 点名的违规模式)
  - JSX 渲染级 emoji(<Text>▶</Text> / <span>✅</span> / {a ? '♥' : '♡'})

豁免:
  - 注释行
  - i18n 参数(tt('k','📺 文案') / t('k', …))
  - 评分星('★'.repeat(n))
  - 表情面板(InputArea 表情数组)
  - docs 正文装饰性 emoji(但 docs 的 icon: 字段仍违规)
`)
  process.exit(0)
}

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
 */
const EMOJI_CHAR_CLASS = /^\[(.*)\]$/u.exec(EMOJI_RE.source)?.[1]
if (!EMOJI_CHAR_CLASS) {
  console.error('❌ 无法从 EMOJI_RE 提取字符类(该区段表达式被改写过?)⇒ 面板数据判据无从成立,拒绝出具结论')
  process.exit(2)
}
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
 * `--self-test`:成对正反例。每条"豁免"都必须配一条"同一位置的另一种写法仍判违规",
 * 否则自检只能证明标记存在,不能证明它没被顺手放宽(本仓把这一型记作"恒绿的断言比没有断言更糟")。
 */
function runSelfTest() {
  const PANEL = 'apps/miniapp-taro/src/components/InputArea.tsx'
  const OTHER = 'apps/web/src/components/demo.tsx'
  const cases = []
  const t = (name, ok, extra = '') => cases.push({ name, ok: !!ok, extra })

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

  let pass = 0
  let fail = 0
  for (const c of cases) {
    if (c.ok) pass++
    else fail++
    console.log(`${c.ok ? '  ✅' : '  ❌'} ${c.name}${c.extra && !c.ok ? ` — ${c.extra}` : ''}`)
  }
  console.log(`自检 ${pass} 通过 / ${fail} 失败(共 ${cases.length} 条)`)
  process.exit(fail === 0 ? 0 : 1)
}

if (process.argv.includes('--self-test')) runSelfTest()

function collectFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    // 2026-09-15:.next* 前缀统一跳过(.next-static/.next-e2e-*/.next-bak-* 等构建产物
    // 目录名带随机/日期后缀,EXCLUDE_DIRS 精确名匹配覆盖不到,曾致 minified chunk
    // 里的 emoji 字面量被误判为 UI 图标违规,blocking 全体 commit)
    if (isExcludedDirName(entry) || entry.startsWith('.next')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, result)
    } else if (SCAN_EXTS.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

function getStagedAddedLines() {
  const result = new Map()
  let output
  try {
    output = execSync('git diff --cached -U0 --diff-filter=ACM --no-color', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      curFile = null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行,不推进 curLine
      } else {
        curLine++
      }
    }
  }
  return result
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => !isExcludedDirName(f.split('/')[0]))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

console.log(`${C.cyan}${C.bold}[emoji 图标守门] 扫描 UI 图标位 emoji 违规...${C.reset}`)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — UI 图标统一图标库(web: lucide-react / RN: lucide-react-native / Taro: SVG <Image>),禁 emoji 充当图标${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规阻塞 commit)' : '全量 (违规则 exit 1)'}${C.reset}`,
)
console.log('')

let files = []
let addedLinesMap = new Map()

if (isStaged) {
  addedLinesMap = getStagedAddedLines()
  files = getStagedFiles().filter((f) => addedLinesMap.has(f))
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .ts/.tsx/.js/.jsx 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  for (const sub of UI_SCAN_ROOTS) {
    files = files.concat(collectFiles(join(ROOT, sub)))
  }
}

let totalViolations = 0
const fileReports = []
// 扫的是整棵工作树,而并行会话随时在增删文件:`readdirSync` 列到、`readFileSync` 读不到
// 是**常态**不是异常。旧写法让这种竞态以未捕获 ENOENT 崩出去 ⇒ Node 退出码 1 ⇒
// 一道 blocking 门把"我读不到"报成"你违规"(按项目口径读不到应是 2/无法判定)。
// 现在:消失的文件计入 skipped 并如实打印,不影响判定。
let unreadable = 0

for (const file of files) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT' || e?.code === 'EACCES' || e?.code === 'EBUSY') {
      unreadable++
      continue
    }
    throw e
  }
  const lines = src.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    // 判定只有一份实现(judgeLine)—— 主循环与自检共用,避免"自检绿而门瞎"那一型
    const f = judgeLine(line, lineNumber, file)
    if (f) findings.push(f)
  })

  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
if (unreadable > 0) {
  console.log(
    `  读不到而跳过: ${unreadable} 个(并行会话在扫描期间增删所致,不影响判定;非 0 时如实打印而非静默)`,
  )
}
console.log(`  违规数:   ${totalViolations} 处 (BLOCKING)`)
console.log('')

if (totalViolations === 0) {
  console.log(`${C.green}${C.bold}✅ emoji 图标守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
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

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ emoji 图标守门失败 — 提交已阻止${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_NO_EMOJI=1 git commit ...${C.reset}`)
}
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
