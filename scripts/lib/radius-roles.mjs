// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 圆角**角色档**判据的共享实现(供 `scripts/check-radius-role-conformance.mjs` 与其镜像测试用)。
//
// 为什么单独成文件,而不是写在门里:
//  - 档位表与角色表**一份都不许抄**。真值只在 `packages/design-tokens/src/radius.js`,
//    取法只在 `scripts/lib/radius-tokens.mjs` 的 `radiusLookup`(它按**被审面**的源码解析)。
//    本文件不出现任何档位数字,所有 px 都由那张表推导。
//  - 遮罩只有一份实现:注释/字符串的抹法是 `scripts/lib/code-mask.mjs` 的
//    `maskCommentsAndStrings`。本文件不重写词法器,只在它的产物上做一次"字符串回填"
//    (见 `maskFaces`)—— 判断"这段遮蔽是不是字符串"用的仍是 code-mask 那份词法结果,
//    本文件不认识任何注释语法,所以不构成第二套遮罩实现。
//
// 三条与门缺一不可的判据要素(缺一即误报或失明):
//  ① 形态(哪种写法)、② 换算后的 px(与档位表比)、③ 类别证据(这个元素是哪一类)。
// 类别证据判不出 ⇒ 落「未判定」逐条点名,**绝不静默算通过**;一个类别信号都没有的元素
// 不在本门射程(如实报数,不写成"已合规")—— 与"射程边界必须报名、不得只报数"同一条。

import { maskCommentsAndStrings } from './code-mask.mjs'

/**
 * 角色 → 可用于识别该角色的**词元**(whole token,不是子串)。
 *
 * 为什么必须按词元而不是子串:`tag` 是 `stage` 的子串、`dot` 是 `dotted` 的子串 ——
 * 子串筛会凭空造出候选,而凭空造出的红会把人指使去"修"没坏的东西(守门 128 票⑫里
 * `box-shadow` 的阴影半径因键名含 `box` 命中几何键、把一族顶过自己锚点,即同一型事故)。
 *
 * 词元只取名字的**头词元**(camelCase / kebab / snake 切分后的最后一个):
 * `userCard`→card ✓、`primaryButton`→button ✓、`cardHeader`→header ✗。
 * 后者刻意不纳 —— 卡片的**子部件**(标题条/正文/封面)不是一张卡片,按卡片档判它
 * 就是在要求给一个内嵌条补圆角,那属于改设计而不是收敛。
 *
 * `evidence` 一栏是给下一个接手人看的出处,不是装饰:新增词元必须能说出"仓里哪一类元素
 * 用它命名",说不出就是猜(与 §4 对 `RN_ONLY_BRAND_KEYS` 的教训同条)。
 */
export const ROLE_STEMS = {
  card: {
    stems: ['card'],
    evidence: 'Card / UserInfoCard / bg-card —— 卡片容器(§4 定档:一律 lg)',
  },
  control: {
    stems: [
      'button',
      'btn',
      'input',
      'textarea',
      'select',
      'combobox',
      'searchbox',
      'switch',
      'slider',
      'checkbox',
      'radio',
      'fab',
    ],
    evidence: 'Button / IconButton / SearchInput / Switch / 悬浮 FAB —— 控件档 sm',
  },
  chip: {
    stems: ['chip', 'tag', 'badge', 'pill'],
    evidence: 'Tag / CountBadge / UnreadBadge / CategoryChip —— 胶囊**类**元素,不是胶囊形状',
  },
  panel: {
    stems: ['panel', 'modal', 'dialog', 'drawer', 'sheet', 'popover'],
    evidence: 'PayPopup / ModelDetailDialog / Drawer / RightPanel —— 面板弹窗档 xl',
  },
  hero: {
    stems: ['hero', 'banner', 'spotlight'],
    evidence: '首页主视觉 / 活动横幅 —— 特大容器档 2xl',
  },
  tiny: {
    stems: ['dot', 'indicator', 'marker', 'bullet'],
    evidence: '状态点 / 进度指示 / 列表符号 —— 极小档 xs',
  },
}

/** Tailwind/CSS 实用类前缀:剥掉后才好认头词元(`bg-card` → `card`)。 */
const UTILITY_PREFIXES = ['bg', 'text', 'border', 'ring', 'shadow', 'fill', 'stroke', 'outline']

/** 名字 → 词元数组(camelCase / PascalCase / kebab / snake / 数字边界都切)。 */
export function nameTokens(name) {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

/** 头词元(一个元素名字的语义重心);空名返回 null。 */
export function headToken(name) {
  const toks = nameTokens(name)
  return toks.length ? toks[toks.length - 1] : null
}

/** 单个类名 token 剥掉变体与实用类前缀后的语义词元(`bg-card`→card、`hover:rounded-lg`→lg)。 */
export function semanticTokenOfClassToken(token) {
  const t = String(token || '').replace(/^[\w[\].-]+:/, '')
  const parts = nameTokens(t)
  if (!parts.length) return null
  const head = parts[parts.length - 1]
  if (parts.length > 1 && UTILITY_PREFIXES.includes(parts[parts.length - 2])) return head
  return head
}

/**
 * 一个**元素名**命中哪些角色(样式键 / CSS 类名 / JSX 组件名)。
 * @returns {string[]} 去重角色数组;空 = 这个名字不构成类别证据
 */
export function rolesOfName(name) {
  const head = headToken(name)
  if (!head) return []
  const hits = []
  for (const [role, spec] of Object.entries(ROLE_STEMS)) {
    if (spec.stems.includes(head)) hits.push(role)
  }
  return hits
}

/** 从 className 串里取角色证据(逐类名,剥前缀后按头词元判)。 */
export function rolesOfClassList(classText) {
  const hits = new Set()
  for (const raw of String(classText || '').split(/[\s,{}'"]+/)) {
    if (!raw) continue
    const sem = semanticTokenOfClassToken(raw)
    if (!sem) continue
    for (const r of rolesOfName(sem)) hits.add(r)
  }
  return [...hits]
}

/**
 * 两份遮罩面(方向不同,各有其用,不得混为一谈):
 *
 *  - `code`:注释 + 字符串内容都抹(`maskCommentsAndStrings` 原样出口)。
 *    用来**证明一个锚点是真代码**:`className=` / `<Tag` / `key:` 这些标识符本来就在字符串外,
 *    所以它们在 `code` 面上出现才算真出现;一句写在模板字符串里的
 *    `'<Card className="rounded-xl">'`(文档样例、夹具)不得造出候选。
 *  - `kept`:只抹注释、**字符串内容保留**。
 *    本门要找的取值形态绝大多数就落在字符串里(`className="card rounded-lg"`、生成式 CSS),
 *    拿 `code` 面找它们等于整片失明 —— 与"两处遮噪方向不同(判写链要剥注释+保留字符串,
 *    判 import 说明符连字符串一起抹会直接失明)"是同一条经验的正反面。
 *
 * 回填实现:整段消费被抹内容,按**段首字符**分注释与字符串(判据见函数内注释)。
 * 词法判断仍然只有 code-mask 一份 —— 本函数不认注释语法,只在它的产物上分诊。
 */
export function maskFaces(src) {
  const code = maskCommentsAndStrings(src)
  const kept = [...code]
  const isQuote = (c) => c === '"' || c === "'" || c === '`'
  /**
   * 单向推进扫描:每遇一段"被抹掉的内容"就**整段消费**,消费时先看它的起点是什么字符。
   *
   *  - 起点是 `/`(注释)⇒ 按注释语法跳到行尾 / `* /`,保持抹除;
   *  - 起点是引号 ⇒ 是字符串,跳到配对引号(单双引号不跨行),把原文那一段照抄回 `kept`;
   *  - 起点是别的字符 ⇒ 不猜,跳一格。
   *
   * 两条第一版各错一次、都由探针实测抓出的洞(方向差异很关键,别退回任何一版):
   *  ① 只按"code 面连续空白"找段 —— 原文件本来就有的空格在两个面上都是空格,于是
   *    `borderRadius: '8px'` 的段起点落在冒号后那个**真空格**上(不是引号)⇒ 整段回填失败
   *    ⇒ 本门要收的字符串形态一片隐身,而账面读起来像"这个文件没有圆角"(判据失明表现为安静);
   *  ② 反过来只按"原文是引号且该位被抹"找串 —— 行注释里的撇号(`// 用 'rounded-lg' 说明`)
   *    同样满足 ⇒ 把**注释内容**回填成取用(注释冒充代码)。
   * 先整段消费注释、再谈引号,两个洞一起堵:注释里的引号永远轮不到当锚点。
   * 未配对的引号一律不回填(宁可漏这一行,绝不把后面整份文件当字符串)。
   */
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\n' || code[i] === c) {
      i++
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      if (src[i + 1] === '/') {
        const e = src.indexOf('\n', i)
        i = e < 0 ? src.length : e
      } else {
        const e = src.indexOf('*/', i + 2)
        i = e < 0 ? src.length : e + 2
      }
      continue
    }
    if (isQuote(c)) {
      let j = i + 1
      let closed = false
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === '\n' && c !== '`') break
        if (src[j] === c) {
          closed = true
          break
        }
        j++
      }
      if (closed) {
        for (let k = i; k <= j; k++) kept[k] = src[k]
        i = j + 1
      } else {
        i = j
      }
      continue
    }
    i++
  }
  return { code, kept: kept.join('') }
}

/**
 * 一行里 `className=` / `class=` 属性的**字符串字面量内容**。
 * 锚点取自 `code` 面(证明属性是真的),内容取自原文(类名活在字符串里)。
 */
export function classStringsInLine(codeLine, rawLine) {
  const out = []
  let m
  const RE = /\bclass(?:Name)?\s*=\s*/g
  while ((m = RE.exec(codeLine))) {
    const rest = rawLine.slice(m.index)
    let taken = 0
    for (const lit of rest.matchAll(/(["'`])([^"'`\n]*)\1/g)) {
      if (lit.index > 60) break // 离锚点太远的那段字符串不属于这个属性
      if (lit[2] && /\S/.test(lit[2])) {
        out.push(lit[2])
        if (++taken >= 3) break
      }
    }
  }
  return out
}

/** px → 档位名列表(同值可能不止一档:`DEFAULT` 与 `lg` 都是 8)。 */export function stepsForPx(table, px) {
  return Object.keys(table || {}).filter((k) => !k.startsWith('role:') && table[k] === px)
}

/** 报告用档名:同值多档时优先设计档名(裸 `rounded`/`DEFAULT` 只是 8px 的别名)。 */
export function stepNameForPx(table, px) {
  const s = stepsForPx(table, px)
  if (!s.length) return null
  return s.find((k) => k !== 'DEFAULT') || 'DEFAULT'
}

/** 角色 → `{role, step, px}`;角色不在表里 ⇒ null(调用方落未判定,不得猜一档)。 */
export function roleSpec(table, role) {
  const px = table?.[`role:${role}`]
  if (!Number.isFinite(px)) return null
  return { role, px, step: stepNameForPx(table, px) }
}

/** 表里的角色清单(证据表按它对账,唯一来源仍是 radius.js 的解析结果)。 */
export function rolesInTable(table) {
  return Object.keys(table || {})
    .filter((k) => k.startsWith('role:'))
    .map((k) => k.slice(5))
}

/** 表里的档位清单(形态正则按它构造,不抄档名)。 */
export function stepsInTable(table) {
  return Object.keys(table || {}).filter((k) => !k.startsWith('role:'))
}

/** 交替式:长的排前面,避免 `2xl` 被 `xl` 抢先半个字。 */
function altOf(names) {
  return [...names].sort((a, b) => b.length - a.length).join('|')
}

// 全部用非捕获组:本仓踩过的"捕获组编号漂一位 ⇒ 判据读到自己不认识的字段"不止一次,
// 少一个捕获组就少一处能漂的地方。
const DIR = String.raw`(?:t|b|l|r|x|y|ss|se|es|ee|tl|tr|bl|br)`
const CAMEL_DIR = String.raw`(?:Top|Bottom)?(?:Left|Right)?`

/**
 * 一行源码里的**圆角取用形态** → 记录数组。
 *
 * 每条记录 `{ kind, px, steps, role, dir, slot, form, offScale }`:
 *  - `px` 换算后的逻辑 px(`rpx` 折半,与 `radius-tokens` 同口径);
 *  - `steps` 该 px 在表里对应的档位名(同值可能两档);
 *  - `role` 形态**自带**的角色(如 `rnRadiusFor.panel`),没有则 null;
 *  - `dir` / `slot` 方向形态的角标与简写位序,空 = 四角同档;
 *  - `offScale` px 不在档位表上 ⇒ true(绕档是守门 77 那一维,本门落未判定、不重复计债)。
 *
 * 覆盖形态(任务书第 7 条,一条不许漏):`rounded` 裸档 / `rounded-<step>` / **方向形态
 * `rounded-t-xl`** / `rounded-[24rpx]` / `rounded-[16px]` / `rounded-[var(--radius-lg)]` /
 * `var(--radius-<step>)` 与裸 `var(--radius)` / `rnRadius.x` 与 `rnRadius['2xl']` 两形态 /
 * `rnRadiusFor.<role>`(点与括号)/ `RADIUS_ROLES.<role>` 同条声明 / RN 驼峰
 * `border…Radius:`(含 `borderTopLeftRadius`)/ CSS 声明 `border-*-radius`(含
 * `8px 8px 0 0` 四值简写)/ **字符串形态** `borderRadius: '8px'` 与 `"6px 6px 0 0"`。
 *
 * 刻意**不收**:`rounded-full`、`rounded-none`、`border-radius: 50%` —— 正圆与无圆角没有
 * "该取哪一档"这个问题(守门 11 管胶囊与红点底),收进来会把真圆头像一律判红。
 *
 * @param {string} line `maskFaces().kept` 的一行(注释已抹、字符串保留)
 * @param {Record<string, number>} table `radiusLookup` 的产物
 */
export function radiusFormsInLine(line, table) {
  const out = []
  const seen = new Set()
  const steps = stepsInTable(table)
  if (!steps.length) return out
  const stepAlt = altOf(steps)
  const push = (rec) => {
    const key = `${rec.kind}|${rec.dir || ''}|${rec.slot ?? ''}|${rec.form}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(rec)
  }
  const describe = (px) => {
    const v = Math.round(px * 100) / 100
    const s = stepsForPx(table, v)
    return { px: v, steps: s, offScale: s.length === 0 }
  }

  let m
  // 1) Tailwind 档名类(含方向形态:`rounded-t-xl` / `rounded-tl-lg` / `rounded-x-md` …)
  const roundedStep = new RegExp(
    String.raw`(^|[^A-Za-z0-9_-])rounded-(?:(${DIR})-)?(${stepAlt})(?![A-Za-z0-9_-])`,
    'g',
  )
  while ((m = roundedStep.exec(line))) {
    push({ kind: 'tailwind', dir: m[2] || '', role: null, form: m[0].trim(), ...describe(table[m[3]]) })
  }
  // 1b) 裸 `rounded`(= 表里的 DEFAULT 档)
  if ('DEFAULT' in table) {
    const bare = /(^|[^A-Za-z0-9_-])rounded(?![\w-])/g
    while ((m = bare.exec(line))) {
      push({ kind: 'tailwind', dir: '', role: null, form: 'rounded', ...describe(table.DEFAULT) })
    }
  }
  // 1c) 任意值 `rounded-[24rpx]` / `rounded-[16px]` / `rounded-[8]`(方向形态同视)
  const arb = new RegExp(
    String.raw`(^|[^A-Za-z0-9_-])rounded-(?:(${DIR})-)?\[\s*(\d+(?:\.\d+)?)\s*(rpx|px)?\s*\]`,
    'g',
  )
  while ((m = arb.exec(line))) {
    const px = m[4] === 'rpx' ? Number(m[3]) / 2 : Number(m[3])
    push({
      kind: 'tailwind-arbitrary',
      dir: m[2] || '',
      role: null,
      form: m[0].trim(),
      ...describe(px),
    })
  }
  // 2) CSS 变量:`var(--radius-lg)`(由表拼,不抄档名)
  const cssVar = new RegExp(String.raw`var\(\s*--radius(?:-(${stepAlt}))?\s*\)`, 'g')
  while ((m = cssVar.exec(line))) {
    const step = m[1] || 'DEFAULT'
    if (!(step in table)) continue
    push({ kind: 'css-var', dir: '', role: null, form: m[0], ...describe(table[step]) })
  }
  // 3) RN 档位入口:点号与括号**两形态同视**(§77 B6 的课 —— 门让你怎么写,门就得怎么看见)
  //    标识符先**泛抓再查表**:表里没有的名字(拼错、动态下标)必须落「未判定」并点名,
  //    不得因为"正则没匹配上"就从账面上消失 —— 那是把没判写成判过了。
  const rnStep = new RegExp(
    String.raw`\b(?:rnRadius|RADIUS_STEPS)\s*(?:\.\s*([A-Za-z_$][\w$]*)\b|\[\s*([^\]\n]{0,40}?)\s*\])`,
    'g',
  )
  while ((m = rnStep.exec(line))) {
    const raw = m[1] || m[2] || ''
    const quoted = /^['"](.*)['"]$/.exec(raw)
    const step = quoted ? quoted[1] : raw
    if (step && step in table) {
      push({ kind: 'rn-step', dir: '', role: null, form: m[0], ...describe(table[step]) })
      continue
    }
    push({ kind: 'rn-step', dir: '', role: null, form: m[0], px: null, steps: [], offScale: true })
  }
  // 4) 角色入口(自带类别,最强证据)。同样先泛抓标识符再查表。
  const rnRole = new RegExp(
    String.raw`\b(?:rnRadiusFor|radiusFor|RADIUS_ROLES)\s*(?:\.\s*([A-Za-z_$][\w$]*)\b|\[\s*([^\]\n]{0,40}?)\s*\])`,
    'g',
  )
  while ((m = rnRole.exec(line))) {
    const raw = m[1] || m[2] || ''
    const quoted = /^['"](.*)['"]$/.exec(raw)
    const role = quoted ? quoted[1] : raw
    const px = table[`role:${role}`]
    push({
      kind: 'role',
      dir: '',
      role: role || null,
      form: m[0],
      ...(Number.isFinite(px) ? describe(px) : { px: null, steps: [], offScale: true }),
    })
  }
  // 5) RN 驼峰属性(含方向):`borderRadius` / `borderTopLeftRadius` / `borderBottomRadius` …
  const rnPropNum = new RegExp(
    String.raw`\bborder(${CAMEL_DIR})Radius\s*:\s*(\d+(?:\.\d+)?)(?![\w.])`,
    'g',
  )
  while ((m = rnPropNum.exec(line))) {
    push({ kind: 'rn-prop', dir: m[1] || '', role: null, form: m[0].trim(), ...describe(Number(m[2])) })
  }
  // 5b) **字符串形态**:`borderRadius: '8px'` / `"6px 6px 0 0"`(守门 77 曾经的盲区)
  const rnPropStr = new RegExp(
    String.raw`\bborder(${CAMEL_DIR})Radius\s*:\s*(?:\[\s*)?(['"])([^'"\n]*)\2`,
    'g',
  )
  while ((m = rnPropStr.exec(line))) {
    for (const rec of parseRadiusValueList(m[3], table, m[1] || '', m[0].trim())) push(rec)
  }
  // 6) CSS 声明:`border-radius` 与四个方向变体,值可以是 1~4 段
  const cssProp = new RegExp(
    String.raw`\b(border(?:-(?:top|bottom))?(?:-(?:left|right))?-radius)\s*:\s*([^;}'\n]+)`,
    'g',
  )
  while ((m = cssProp.exec(line))) {
    for (const rec of parseRadiusValueList(m[2], table, cssDirOf(m[1]), m[0].trim())) push(rec)
  }
  /**
   * `0` 一律丢弃(两条路径都会产它:RN 的 `borderTopLeftRadius: 0` 与 CSS 简写里的某个角)。
   * 0 是"这个角不圆",不是一个可选档位 —— 拿它去比"应有档"必然判红,而"故意做一个直角"
   * 在本仓是真用法(消息气泡的底角)。`stepsForPx(0)` 也为空,不过滤会先落一堆 off-scale 噪声。
   */
  return out.filter((r) => r.px !== 0)
}

/** `border-top-left-radius` → `TopLeft`(方向形态必须报得出**是哪个角**,否则四角同档与三角同档读起来一样)。 */
export function cssDirOf(propName) {
  const s = String(propName || '')
  const v = s.includes('-top-') ? 'Top' : s.includes('-bottom-') ? 'Bottom' : ''
  const h = s.includes('-left-') ? 'Left' : s.includes('-right-') ? 'Right' : ''
  return `${v}${h}`
}

/**
 * 一段圆角**值串** → 记录数组。同时吃 `8px 8px 0 0`、`'6px 6px 0 0'`、`12`、`16rpx`。
 *
 * 三条规矩都有实测理由:
 *  - `rpx` 折半(750 稿半单位)、`px` 与无单位按逻辑 px;
 *  - **0 值跳过**:0 是"这个角不圆",不是一个档位,拿它比"应有档"必然判红;
 *  - **`%` 整条跳过**:百分比是正圆/胶囊几何(守门 11 那一维)。
 * 多值时带 `slot`(CSS 简写位序:0 左上 / 1 右上 / 2 右下 / 3 左下),报告才说得出"哪一角跑偏"。
 */
export function parseRadiusValueList(text, table, dir, form) {
  const out = []
  const toks = String(text)
    // var() 由第 2 组正则负责;整型数字带 `px` 后缀
    .replace(/var\(\s*--radius[^)]*\)/g, '')
    .match(/-?\d+(?:\.\d+)?(?:rpx|px|%)?/g)
  if (!toks) return out
  const n = toks.length
  toks.forEach((raw, idx) => {
    if (/%$/.test(raw)) return
    const num = Number(raw.replace(/(?:rpx|px)$/, ''))
    if (!Number.isFinite(num)) return
    const px = /rpx$/.test(raw) ? num / 2 : num
    if (px === 0) return
    out.push({
      kind: 'value-list',
      dir: dir || '',
      role: null,
      slot: n === 1 ? 0 : cornerSlotOf(n, idx),
      form,
      ...describeOf(table, px),
    })
  })
  return out
}

function describeOf(table, px) {
  const v = Math.round(px * 100) / 100
  const s = stepsForPx(table, v)
  return { px: v, steps: s, offScale: s.length === 0 }
}

/** CSS 简写位序 → 角标(1 值=四角;2 值=上下/左右;3 值=上/左右/下;4 值=四角顺次)。 */
export function cornerSlotOf(count, idx) {
  if (count === 2) return idx === 0 ? 0 : 2
  if (count === 3) return [0, 1, 2][idx] ?? 0
  return idx % 4
}

export const CORNER_NAMES = ['左上', '右上', '右下', '左下']

/**
 * `radius-role-exempt: <原因>` —— 本门的行内出口。三条严格性不得放宽:
 *  ① **必须带原因**:裸标记、以及"裸标记 + 注释闭合符冒充原因"都不放行;
 *  ② **只在命中行或紧邻上一行生效**(一行标记救不了整棵子树);
 *  ③ 判它的是**原文行** —— 豁免标记活在注释里,遮罩之后就永远匹配不到,等于自己抹掉出口。
 */
export function roleExemptReason(rawLine) {
  const m = /radius-role-exempt\s*:\s*(.+)/.exec(String(rawLine || ''))
  if (!m) return null
  // 只剥包裹用的注释符号与空白,**不**把 `*/` 当原因(那正是"闭合符冒充原因"那一洞)
  const reason = m[1].replace(/^[\s*/]+/, '').replace(/[\s*/]+$/, '').trim()
  return reason.length >= 2 ? reason : null
}

export function isRoleExemptAt(rawLines, i) {
  if (roleExemptReason(rawLines[i])) return true
  return i > 0 && !!roleExemptReason(rawLines[i - 1])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
