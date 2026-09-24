// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn / packages/app 深色模式前景/容器回归守门(blocking)。
 *
 * 四类真实事故(2026-09-23 Drawer/StudyBar/UserInfoCard/主 CTA 深色复核):
 *  R1 品牌底白字:同一 style 对象里 `backgroundColor: (tokens|tk).brand.DEFAULT` 配
 *     `color: (tokens|tk).surface.light` / `.text.primary` —— 深色下 brand.DEFAULT
 *     翻成 #FFFFFF,前景必须用 brand.foreground(深色翻黑),否则白底白字。
 *     **2026-09-23 补盲**:原判据只认 `tokens.` 前缀,而 packages/app 共享组件一律写 `tk.`,
 *     等于共享包全程不在 R1 视野内。实测补盲后现存违规 0 处(非放宽,是真无违规)。
 *  R2 硬编码浅色容器 ratchet:`backgroundColor: tokens.surface.light`(两态恒白)、
 *     `rgba(255,255,255,α≥0.5)`(近实心白)、className `bg-white`(非 dark: 变体)。
 *     每文件计数与 scripts/brand-foreground-baseline.json 的 `counts` 比对,只减不增。
 *     范围保持 apps/mobile-rn/src(基线按此口径建立,扩范围会误伤存量)。
 *  R3 纯白填充 ratchet(2026-09-23 立):`(backgroundColor|borderColor): (tokens|tk).brand.DEFAULT`
 *     在深色档案下就是**纯白**(实测压 #1A1A1A 卡面 17.4:1 = 用户报的"刺眼")。
 *     主 CTA 一律走 `brand.ctaFill`/`brand.ctaText`(浅色与 brand.DEFAULT 同值 ⇒ 存量外观零变化,
 *     深色给非纯白)。本条不拦存量(基线冻结),只拦"新增/回潮"。范围含 packages/app。
 *  R4 跨 key 品牌底白字(2026-09-24 立,补 R1 的结构性盲区):
 *     R1 只在**同一个 style 块**内配对背景与前景,而真实的 RN `StyleSheet.create` 把按钮的
 *     底和它的文字放在**兄弟 key** 里(`retryBtn` / `retryText`)—— 于是 PlazaScreen 四个按钮
 *     (brand.DEFAULT 底 × text.primary 字,实测对比度 1.06:1 纯黑压纯黑)一路 shipped 到真机。
 *     R4 用**名字**建立配对(`X`/`XText`、`XBtn`/`XButton` 与 `XBtnText`/`XButtonText`、
 *     `X`/`XLabel`,顺序无关),不用行距滑窗(滑窗必然误伤)。
 *     ⚠️ R1 的同块语义**一个字未改**(其他会话的 self-test 依赖它),R4 是叠加不是替换。
 *     R4 走基线棘轮(与 R2/R3 同形态,`r4Counts` 每文件计数只减不增),因为兄弟配对
 *     在别处可能合法(如整块 `surface.light` 底上的白字),先登记存量再逐档下调。
 *     **建门实测(2026-09-24 全量口径)**:兄弟配对 96 文件 / 127 对,其中
 *     `text.primary` 前景 **0 处**(线上那 4 处黑压黑已人工改为 brand.foreground),
 *     127 对**全部**是 `surface.light` 前景 —— 而 surface.light 现行档值
 *     (浅色 #FFFFFF / 深色 #262626)压 brand.DEFAULT(#000 / #FFF)两态都可见,
 *     故这些存量按"合法兄弟对"入基线,只冻不赦。任何**新增**兄弟对(含换成
 *     text.primary)都会使该文件计数超过基线 ⇒ 立即红。
 *     ⚠️ 已知残留口径:棘轮按**每文件对数**计,故"把某文件已有的 surface.light 兄弟对
 *     原地换成 text.primary 而不增减对数"这一种改写不会被 R4 拦到(它由 R1 在文字与底
 *     同块时兜,以及由 review 兜)。收紧到按前景 token 分档留待人工决策,不在本门范围。
 *
 * 用法:
 *   node scripts/check-brand-foreground.mjs                  # 全量
 *   node scripts/check-brand-foreground.mjs --staged         # 只看暂存文件
 *   node scripts/check-brand-foreground.mjs --update-baseline # 收紧基线(人工确认后;拒绝与 --staged 同用)
 *   node scripts/check-brand-foreground.mjs --self-test      # 逻辑自检
 * 紧急跳过:HUSKY_SKIP_BRAND_FOREGROUND=1
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(__dirname, 'brand-foreground-baseline.json')

const SKIP_ENV = 'HUSKY_SKIP_BRAND_FOREGROUND'
// 前缀 `tokens.`(apps/mobile-rn 端)与 `tk.`(packages/app 共享组件的别名)必须同时认,
// 否则共享包整片不在判据视野内 —— 这正是 2026-09-23 补的盲区。
const TKS = '(?:tokens|tk)'
const R1_BG = new RegExp(`backgroundColor:\\s*${TKS}\\.brand\\.DEFAULT\\b`)
const R1_BAD_FG = new RegExp(`color:\\s*${TKS}\\.(?:surface\\.light|text\\.primary)\\b`)
const STYLE_OBJ_START = /^\s{2}[A-Za-z_$][\w$]*:\s*\{/
/** R4 用:任意缩进的 `key: {` 起始行(共享包样式一律在 makeStyles 内 4 空格缩进) */
const ANY_STYLE_KEY_START = /^[ \t]*([A-Za-z_$][\w$]*)\s*:\s*\{/
const STYLE_OBJ_END = /^ {2}\}/
const R2_SURFACE_LIGHT = /backgroundColor:\s*tokens\.surface\.light\b/
const R2_RGBA_WHITE = /backgroundColor:\s*['"]rgba\(255,\s*255,\s*255,\s*(0?\.\d+|1)\)/
const R2_BG_WHITE_CLASS = /\bbg-white\b/
const R3_BRAND_FILL = new RegExp(`(?:backgroundColor|borderColor):\\s*${TKS}\\.brand\\.DEFAULT\\b`)
/** R4:兄弟 key 的名字后缀(文字侧 / 底侧的角色后缀) */
const TEXT_ROLE_SUFFIXES = ['Text', 'Label']
const BG_ROLE_SUFFIXES = ['Btn', 'Button']
/** R1/R3 扫描范围:RN 端 + 跨端共享包(两者深色语义同一套 rn-tokens) */
const SCAN_DIRS = ['apps/mobile-rn/src', 'packages/app/src']
/** R2 基线口径范围(扩范围会误伤未登记的存量,故与 SCAN_DIRS 分开) */
const R2_DIR = 'apps/mobile-rn/src'

/** 从源码行提取 style 属性块(2 空格缩进的顶层样式对象),返回块文本数组 */
export function extractStyleChunks(lines) {
  const chunks = []
  let current = null
  for (const line of lines) {
    if (current === null) {
      if (STYLE_OBJ_START.test(line)) {
        // 单行闭合的对象({ 与 } 配平)自成一块,防止吞并后续样式
        const opens = (line.match(/\{/g) ?? []).length
        const closes = (line.match(/\}/g) ?? []).length
        if (opens > 0 && opens === closes) chunks.push(line)
        else current = [line]
      }
    } else {
      current.push(line)
      if (STYLE_OBJ_END.test(line)) {
        chunks.push(current.join('\n'))
        current = null
      }
    }
  }
  if (current !== null) chunks.push(current.join('\n'))
  return chunks
}

/** R1:块内(或单行)同时出现 brand.DEFAULT 背景 + 恒白前景 → 白底白字缺陷 */
export function findR1Violations(lines) {
  const violations = []
  for (const chunk of extractStyleChunks(lines)) {
    if (R1_BG.test(chunk) && R1_BAD_FG.test(chunk)) violations.push(chunk.split('\n')[0].trim())
  }
  for (const line of lines) {
    if (R1_BG.test(line) && R1_BAD_FG.test(line)) violations.push(line.trim())
  }
  return violations
}

/**
 * 逐行算括号净增量,带**跨行**的字符串/注释状态机:
 * 字符串与注释里的 `{` `}` 不得参与配平(否则 `'{}'`、模板串、注释会切错块)。
 * `'` / `"` 在行尾强制复位(JS 单双引号串不得跨行;这一条同时挡住 JSX 文本里的
 * 撇号 `don't` 把整行"吃进字符串"的失真)。模板串可跨行,故保留状态。
 */
export function computeBraceDeltas(lines) {
  const deltas = new Array(lines.length).fill(0)
  let mode = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let d = 0
    let j = 0
    while (j < line.length) {
      const two = line.slice(j, j + 2)
      if (mode === '') {
        if (two === '//') {
          mode = '//'
          break
        }
        if (two === '/*') {
          mode = '/*'
          j += 2
          continue
        }
        const ch = line[j]
        if (ch === "'" || ch === '"' || ch === '`') {
          mode = ch
          j++
          continue
        }
        if (ch === '{') d++
        else if (ch === '}') d--
        j++
      } else if (mode === '/*') {
        if (two === '*/') {
          mode = ''
          j += 2
        } else j++
      } else {
        if (line[j] === '\\') {
          j += 2
          continue
        }
        if (line[j] === mode) {
          mode = ''
          j++
          continue
        }
        j++
      }
    }
    if (mode === '//' || mode === "'" || mode === '"') mode = ''
    deltas[i] = d
  }
  return deltas
}

/**
 * R4 前置:切出**具名** style 块 `{ name: { ... } }`,返回 { name, text }[]。
 * 与 extractStyleChunks 的两点差别(均为 R4 必需,且不改 R1 语义):
 *  1) 缩进无关 —— 共享包的样式一律写成 `makeStyles()` 里 4 空格缩进的
 *     `retryBtn: {`,R1 的 `^  key:` 锚定根本看不见这类文件;
 *  2) 括号配平收口 —— 闭合行是 `} as ViewStyle,`,`^  \}` 同样对不上。
 * 只产出**同层兄弟**块:命中一个块后跳到它的闭合行之后,故嵌套块被并入父块、
 * 不再单独成块(否则父子里应归 R1 的同块关系会被误报成兄弟)。
 */
export function extractNamedStyleChunks(lines) {
  const deltas = computeBraceDeltas(lines)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = ANY_STYLE_KEY_START.exec(lines[i])
    if (!m) continue
    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j++) {
      depth += deltas[j]
      if (depth <= 0) {
        end = j
        break
      }
    }
    out.push({ name: m[1], text: lines.slice(i, end + 1).join('\n') })
    i = end
  }
  return out
}

/**
 * 一个 style key 名字可能指代的"元素主干"集合。
 * `retryBtn` → {retryBtn, retry};`chatBtnText` → {chatBtnText, chatBtn, chat};
 * `card` → {card}。名字必须**真的**带后缀才剥(camelCase 大小写敏感),
 * 所以 `retry` 不会被当成 `xRetry`(无后缀关系)。
 */
function styleNameCores(name) {
  const cores = new Set([name])
  const strip = (s, suffixes) => {
    const hit = []
    for (const suf of suffixes) {
      if (s.length > suf.length && s.endsWith(suf)) hit.push(s.slice(0, -suf.length))
    }
    return hit
  }
  for (const t of strip(name, TEXT_ROLE_SUFFIXES)) {
    cores.add(t)
    for (const b of strip(t, BG_ROLE_SUFFIXES)) cores.add(b)
  }
  for (const b of strip(name, BG_ROLE_SUFFIXES)) cores.add(b)
  return cores
}

/** 名字是否构成同一视觉元素的「底 / 字」兄弟对(顺序无关,只看名字,不看行距) */
export function isSiblingStylePair(bgKey, fgKey) {
  if (!bgKey || !fgKey || bgKey === fgKey) return false
  const bgCores = styleNameCores(bgKey)
  for (const core of styleNameCores(fgKey)) if (bgCores.has(core)) return true
  return false
}

/**
 * R4:brand.DEFAULT 底在 key A、surface.light/text.primary 字在**兄弟** key B。
 * 返回 'A×B' 形态的配对清单(同块情形归 R1,这里 A!==B 故天然不重叠)。
 */
export function findR4Violations(lines) {
  const chunks = extractNamedStyleChunks(lines)
  const bgKeys = chunks.filter((c) => R1_BG.test(c.text)).map((c) => c.name)
  const fgKeys = chunks.filter((c) => R1_BAD_FG.test(c.text)).map((c) => c.name)
  const pairs = []
  for (const bg of bgKeys) {
    for (const fg of fgKeys) {
      if (isSiblingStylePair(bg, fg)) pairs.push(`${bg}×${fg}`)
    }
  }
  return pairs
}

/** R2:单文件「浅色容器」计数(surface.light 背景 / α≥0.5 白 rgba / 非 dark: 的 bg-white) */
export function countLightContainers(lines) {
  let count = 0
  for (const line of lines) {
    if (R2_SURFACE_LIGHT.test(line)) count++
    const rgba = line.match(R2_RGBA_WHITE)
    if (rgba && Number.parseFloat(rgba[1]) >= 0.5) count++
    if (R2_BG_WHITE_CLASS.test(line) && !line.includes('dark:bg-')) count++
  }
  return count
}

/** R3:单文件「brand.DEFAULT 作填充/描边」计数(深色下即纯白) */
export function countCtaFills(lines) {
  let count = 0
  for (const line of lines) if (R3_BRAND_FILL.test(line)) count++
  return count
}

function isR2Scope(rel) {
  return rel.replace(/\\/g, '/').startsWith(`${R2_DIR}/`)
}

function listTargetFiles() {
  // git ls-files 只取跟踪文件,避免扫到 gitignore 的临时副本
  const out = execFileSync('git', ['ls-files', ...SCAN_DIRS], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f))
  return out.map((rel) => path.join(ROOT, rel))
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => SCAN_DIRS.some((d) => f.startsWith(`${d}/`) && /\.(ts|tsx)$/.test(f)))
  return out.map((rel) => path.join(ROOT, rel))
}

function readLines(file) {
  return readFileSync(file, 'utf8').split('\n')
}

function run(options) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1,跳过 mobile-rn 前景/容器守门`)
    return 0
  }
  // 基线是全量口径:与 --staged 同用会拿"暂存子集"覆盖整份基线,把未暂存文件的
  // 存量清零 → 下次全量恒红或误拦(与 scan-hardcoded-zh 同一条护栏)。
  if (options.updateBaseline && options.staged) {
    console.error('❌ --update-baseline 不得与 --staged 同用(基线须按全量口径收紧)')
    return 1
  }
  const all = listTargetFiles()
  const files = options.staged ? stagedFiles().filter((f) => all.includes(f)) : all
  if (options.staged && files.length === 0) {
    console.log('⏭ 暂存区无 apps/mobile-rn/src 或 packages/app/src 文件,跳过')
    return 0
  }

  const r1 = []
  const counts = {}
  const ctaCounts = {}
  const r4ByFile = {}
  for (const file of files) {
    if (!existsSync(file)) continue
    const lines = readLines(file)
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    for (const v of findR1Violations(lines)) r1.push(`${rel} → ${v}`)
    const r4Pairs = findR4Violations(lines)
    if (r4Pairs.length > 0) r4ByFile[rel] = r4Pairs
    if (isR2Scope(rel)) {
      const c = countLightContainers(lines)
      if (c > 0) counts[rel] = c
    }
    const cc = countCtaFills(lines)
    if (cc > 0) ctaCounts[rel] = cc
  }
  const r4Counts = {}
  for (const [rel, pairs] of Object.entries(r4ByFile)) r4Counts[rel] = pairs.length

  if (options.updateBaseline) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ counts, ctaCounts, r4Counts }, null, 2)}\n`)
    const sum = (o) => `${Object.keys(o).length} 文件 / ${Object.values(o).reduce((a, b) => a + b, 0)} 处`
    console.log(`✅ 基线已更新:R2 ${sum(counts)};R3 ${sum(ctaCounts)};R4 ${sum(r4Counts)}`)
    return 0
  }

  let failed = false
  if (r1.length > 0) {
    failed = true
    console.error(`❌ R1 品牌底白字(brand.DEFAULT 背景 + surface.light/text.primary 前景,深色下白底白字):${r1.length} 处`)
    for (const v of r1) console.error(`   ${v}`)
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {}
  const r2 = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline.counts?.[file] ?? 0
    if (count > allowed) r2.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r2.length > 0) {
    failed = true
    console.error(`❌ R2 新增硬编码浅色容器(基线棘轮,只减不增):${r2.length} 文件`)
    for (const v of r2) console.error(`   ${v}`)
  }

  const r3 = []
  for (const [file, count] of Object.entries(ctaCounts)) {
    const allowed = baseline.ctaCounts?.[file] ?? 0
    if (count > allowed) r3.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r3.length > 0) {
    failed = true
    console.error(`❌ R3 新增纯白填充(brand.DEFAULT 深色档案=纯白,基线棘轮只减不增):${r3.length} 文件`)
    for (const v of r3) console.error(`   ${v}`)
  }

  const r4 = []
  const r4Detail = []
  let r4Total = 0
  for (const [file, pairs] of Object.entries(r4ByFile)) {
    r4Total += pairs.length
    const allowed = baseline.r4Counts?.[file] ?? 0
    if (pairs.length > allowed) {
      r4.push(`${file}: ${pairs.length} > 基线 ${allowed}`)
      for (const p of pairs) r4Detail.push(`   ${file} → ${p}`)
    }
  }
  if (r4.length > 0) {
    failed = true
    console.error(
      `❌ R4 跨 key 品牌底白字(兄弟 key:brand.DEFAULT 底 × surface.light/text.primary 字,基线棘轮只减不增):${r4.length} 文件`,
    )
    for (const v of r4) console.error(`   ${v}`)
    for (const v of r4Detail) console.error(v)
  }

  if (failed) {
    console.error(
      [
        '',
        '  💡 修复:容器背景用 tokens.surface.card / surface.muted / surface.inputBg;',
        '     品牌底(brand.DEFAULT)上的文字用 tokens.brand.foreground(深色自动翻黑);',
        '     R4 与 R1 同一缺陷,只是底和字被拆到了兄弟 key(retryBtn / retryText):',
        '     配对由**名字**成立,故改法是给文字 key 换前景 brand.foreground;',
        '     ⚠️ brand.ctaFill / ctaText 已于 2026-09-24 删除(AGENTS §4 品牌 CTA 同源),',
        '        不得作为修法加回来 —— 悬空引用由守门 90 R3 判红;',
        '        要调暗色主按钮观感,改 tokens.css 的 .dark --color-primary 一处,三端同时动;',
        '     主 CTA / 选中态胶囊一律 brand.DEFAULT + brand.foreground 成对(= web 的',
        '     --color-primary + --color-primary-foreground)—— 不要逐处硬写颜色;',
        '     覆盖在图片/彩色底上的白色前景属合法,基线棘轮只拦「比基线更多」。',
        '     收紧基线(人工确认后,全量口径):node scripts/check-brand-foreground.mjs --update-baseline',
        '     自检:node scripts/check-brand-foreground.mjs --self-test',
        `     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
        '',
      ].join('\n'),
    )
    return 1
  }
  console.log(
    `✅ mobile-rn/共享包 前景/容器守门通过(${files.length} 文件,R1=0,R4 ${r4Total} 处全部 ≤ 基线,R2/R3 全部 ≤ 基线;R3 存量 ${Object.values(ctaCounts).reduce((a, b) => a + b, 0)} 处)`,
  )
  return 0
}

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`❌ self-test 失败: ${msg}`)
      process.exit(1)
    }
  }
  // R1 正例:同一块内 brand 背景 + 恒白前景
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '    color: tokens.surface.light,', '  },']).length === 1,
    'R1 应命中同块 brand 背景 + surface.light 前景',
  )
  // R1 正例:text.primary 前景同样恒白(深色)
  // ⚠️ 这条断言钉的是 **R1 的同块语义**,不得因为 R4 上线而放宽 —— 其他会话依赖 R1 只判同块。
  // 跨块那一半由 R4 负责(见下方 R4 用例组),这里必须继续为 0。
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '  },', '  btnText: {', '    color: tokens.text.primary,', '  },']).length === 0,
    'R1 不应跨块命中(text.primary 在另一块)',
  )
  // R1 反例:brand.foreground 是正确前景
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '    color: tokens.brand.foreground,', '  },']).length === 0,
    'R1 不应命中 brand.foreground',
  )
  // R2 计数
  assert(countLightContainers(['    backgroundColor: tokens.surface.light,']) === 1, 'R2 surface.light 计 1')
  assert(countLightContainers(["    backgroundColor: 'rgba(255,255,255,0.6)',"]) === 1, 'R2 α=0.6 计 1')
  assert(countLightContainers(["    backgroundColor: 'rgba(255, 255, 255, 0.18)',"]) === 0, 'R2 α=0.18 是淡出层不计')
  assert(countLightContainers(['<View className="flex-1 bg-white">']) === 1, 'R2 className bg-white 计 1(Drawer 事故形态)')
  assert(countLightContainers(['<View className="bg-white dark:bg-gray-900">']) === 0, 'R2 dark: 变体不计')
  assert(countLightContainers(['  tabActive: {', '    backgroundColor: tokens.brand.DEFAULT,', '  },']) === 0, 'R2 brand 背景不计')
  // 块提取:未闭合块也应产出
  assert(extractStyleChunks(['  a: {', '    x: 1,']).length === 1, '未闭合块仍应提取')
  // R1 补盲:packages/app 共享组件一律写 `tk.`,原判据只认 tokens. → 共享包整片不可见
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.surface.light,', '  },']).length === 1,
    'R1 应命中 tk. 前缀(共享包补盲)',
  )
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.text.primary,', '  },']).length === 1,
    'R1 应命中 tk. 前缀 + text.primary 前景',
  )
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.brand.foreground,', '  },']).length === 0,
    'R1 不应命中 tk.brand.foreground(正确前景)',
  )
  // === R4 跨 key 兄弟配对(2026-09-24 立,PlazaScreen 四个黑压黑按钮的根治)===
  // R4 与 R1 的分工必须钉死:同块归 R1、兄弟 key 归 R4,两边都不得沉默。
  assert(extractNamedStyleChunks(['  retryBtn: {', '    x: 1,', '  },']).length === 1, 'R4 具名块:多行块应提取 1 块')
  assert(
    extractNamedStyleChunks(['  retryBtn: {', '    x: 1,', '  },'])[0].name === 'retryBtn',
    'R4 具名块:key 名须为 retryBtn',
  )
  assert(
    extractNamedStyleChunks(['  retryBtn: { backgroundColor: tk.brand.DEFAULT },'])
      .map((c) => c.name)
      .join() === 'retryBtn',
    'R4 具名块:单行闭合块同样提取 key 名',
  )
  // (a) retryBtn + retryText 兄弟对 → 命中(线上真实事故形态)
  assert(
    findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  retryText: {',
      '    color: tk.text.primary,',
      '  },',
    ]).join() === 'retryBtn×retryText',
    'R4 (a) 应命中 retryBtn × retryText',
  )
  // (b) 文字 key 在前、背景 key 在后 → 顺序无关,仍命中
  assert(
    findR4Violations([
      '  chatBtnText: {',
      '    color: tk.text.primary,',
      '  },',
      '  chatBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
    ]).join() === 'chatBtn×chatBtnText',
    'R4 (b) 不得依赖 key 出现顺序',
  )
  // (c) ctaFill + ctaText 配对 → 不命中(底不是 brand.DEFAULT,R4 无从成立)
  //     注:ctaFill/ctaText 已于 2026-09-24 退役(AGENTS §4),此处只作"非 brand.DEFAULT 底
  //     不得命中"的负向夹具,不构成对这两个键的推荐。
  assert(
    findR4Violations([
      '  ctaFill: {',
      '    backgroundColor: tk.brand.ctaFill,',
      '  },',
      '  ctaText: {',
      '    color: tk.brand.ctaText,',
      '  },',
    ]).length === 0,
    'R4 (c) 不应命中非 brand.DEFAULT 底(ctaFill/ctaText 夹具)',
  )
  // (d) brand.DEFAULT 底 + brand.foreground 字 → 不命中(前景合法)
  assert(
    findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  retryText: {',
      '    color: tk.brand.foreground,',
      '  },',
    ]).length === 0,
    'R4 (d) 不应命中 brand.foreground 前景',
  )
  // (e) 名字必须**真的**配对:card 有底、avatarText 有字,但主干不同 → 不命中
  assert(
    findR4Violations([
      '  card: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  avatarText: {',
      '    color: tk.text.primary,',
      '  },',
    ]).length === 0,
    'R4 (e) 名字不成对时不得靠滑窗误伤',
  )
  // (f) XBtn + XBtnText → 命中
  assert(
    findR4Violations([
      '  submitBtn: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '  },',
      '  submitBtnText: {',
      '    color: tokens.surface.light,',
      '  },',
    ]).join() === 'submitBtn×submitBtnText',
    'R4 (f) 应命中 XBtn × XBtnText',
  )
  // 名字关系单测:XButton + XButtonText / X + XLabel 同为合法配对
  assert(isSiblingStylePair('shareButton', 'shareButtonText'), 'R4 名字:XButton × XButtonText 成对')
  assert(isSiblingStylePair('section', 'sectionLabel'), 'R4 名字:X × XLabel 成对')
  assert(isSiblingStylePair('retryBtn', 'retryText'), 'R4 名字:跨后缀 XBtn × XText 成对')
  assert(!isSiblingStylePair('retryBtn', 'retryBtn'), 'R4 名字:同 key 不成对(归 R1 管辖)')
  assert(!isSiblingStylePair('primaryBtn', 'secondaryText'), 'R4 名字:主干不同不得成对')
  assert(isSiblingStylePair('Btn', 'BtnText'), 'R4 名字:Btn × BtnText 走 X/XText 规则成对')
  // 真新缺陷不得因为"同时命中 R1"而被 R4 沉默:同块 + 兄弟 key 同时存在 → 两条各自计数
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.text.primary,', '  },']).length === 1,
    'R4 上线后 R1 同块语义不变(阳性对照)',
  )
  assert(
    findR4Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    height: 32,',
      '  },',
      '  btnText: {',
      '    color: tk.text.primary,',
      '  },',
      '  unrelated: {',
      '    padding: 4,',
      '  },',
    ]).length === 1,
    'R4 应命中 btn × btnText(且只 1 对)',
  )
  // 块提取的配平卫生:字符串 / 注释内的括号不得参与收口
  assert(computeBraceDeltas(["  a: { content: '{}',"])[0] === 1, 'R4 配平:串内 {} 不计')
  assert(computeBraceDeltas(['  a: { // } 注释里的闭包不计'])[0] === 1, 'R4 配平:// 注释内不计')
  assert(computeBraceDeltas(['  a: {', "    t: 'don\\'t',", '  },'])[2] === -1, 'R4 配平:转义引号不得吃掉后文')
  assert(
    extractNamedStyleChunks(['  a: {', "    label: 'x: {',", '  },', '  b: { color: tk.text.primary },']).length === 2,
    'R4 具名块:串内 `key: {` 不得额外成块',
  )
  // R3:brand.DEFAULT 填充/描边计数;ctaFill 是正解故不计
  assert(countCtaFills(['    backgroundColor: tokens.brand.DEFAULT,']) === 1, 'R3 tokens.brand.DEFAULT 背景计 1')
  assert(countCtaFills(['    borderColor: tk.brand.DEFAULT,']) === 1, 'R3 tk.brand.DEFAULT 描边计 1')
  assert(countCtaFills(['    backgroundColor: tokens.brand.ctaFill,']) === 0, 'R3 不应命中 ctaFill(正解)')
  assert(countCtaFills(['    color: tokens.brand.foreground,']) === 0, 'R3 不计前景色')
  assert(countCtaFills(['    backgroundColor: tokens.brand.DEFAULTISH,']) === 0, 'R3 边界:同前缀字段不得误计')
  console.log('✅ check-brand-foreground self-test 全部通过')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  const options = {
    staged: argv.includes('--staged'),
    updateBaseline: argv.includes('--update-baseline'),
  }
  const code = argv.includes('--self-test') ? selfTest() : run(options)
  process.exit(code)
}

export const __test__ = {
  extractStyleChunks,
  findR1Violations,
  countLightContainers,
  countCtaFills,
  computeBraceDeltas,
  extractNamedStyleChunks,
  isSiblingStylePair,
  findR4Violations,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
