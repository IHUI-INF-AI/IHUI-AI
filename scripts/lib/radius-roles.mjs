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

import { maskCommentsAndStrings, maskedSpans } from './code-mask.mjs'

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
    stems: ['panel', 'modal', 'dialog', 'drawer', 'sheet'],
    evidence: 'PayPopup / ModelDetailDialog / Drawer / RightPanel —— 面板弹窗档 xl',
  },
  popover: {
    stems: ['popover', 'menu', 'contextmenu', 'ctxmenu', 'tooltip'],
    evidence: 'TerminalContextMenu / FileContextMenu / TagsView 右键菜单 / add-menu-popover —— 轻量浮层档 md',
  },
  bubble: {
    stems: ['bubble', 'chatbubble', 'messagebubble'],
    evidence: '会话流消息盒(voice.tsx / ai-assistant 气泡)—— 与卡片不同类,档 2xl',
  },
  hero: {
    stems: ['hero', 'banner', 'spotlight'],
    /**
     * **名字不得替元素认领尺寸档**(2026-09-27 实测三条 false claim):`compactionBanner` 是一条
     * 6dp 高的提示条、`.special-banner` 是普通横幅,都被词干推成 hero ⇒ 要求 16px,
     * 而把它们真拧到 16px 是可见的观感回归。hero 是全表里唯一**纯尺寸**的主张,
     * 只有显式取用(`rnRadiusFor.hero` / `RADIUS_ROLES.hero`)才算这个类别被说出来;
     * 词干命中一律不计(既不计红也不计通过)。其余角色(卡片/控件/芯片)名字本身就是类别。
     */
    nameCannotClaim: true,
    evidence: '首页主视觉 / 活动横幅 —— 特大容器档 2xl(须显式 rnRadiusFor.hero 取用方判)',
  },
  tiny: {
    stems: ['dot', 'indicator', 'marker', 'bullet'],
    evidence: '状态点 / 进度指示 / 列表符号 —— 极小档 xs',
  },
}

/**
 * **不是身份**的实用类前缀(2026-09-28 立,由 HEAD 实测 5 处 `role-conflict` 逼出)。
 * `z-popover` / `z-modal` 写的是**层叠档**(项目里 z 档名就是 popover/modal/max/loading 这一族,
 * 见守门 27 的 z-index 契约),把它们当"这个元素是哪一类"的证据,就会出现
 * `<div className="z-popover … bg-card">` 同时被认成 panel 与 card 这种**互斥类别** ——
 * 判据只能落 role-conflict,而世界其实一点歧义都没有。
 * 刻意只列 `z`:颜色/描边族(`bg-card`、`border-input`)确实是弱身份证据,继续走 weak 档;
 * 放宽到"所有非 rounded 前缀"等于把类别证据整片关掉(那是放宽判据,不是收窄误报)。
 */
const NON_IDENTITY_PREFIXES = ['z']

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

/** 单个类名 token 剥掉变体与实用类前缀后的语义词元(`bg-card`→card、`z-popover`→null)。 */
export function semanticTokenOfClassToken(token) {
  const t = String(token || '').replace(/^[\w[\].-]+:/, '')
  const parts = nameTokens(t)
  if (!parts.length) return null
  const head = parts[parts.length - 1]
  // 层叠档名不是身份 —— 见 NON_IDENTITY_PREFIXES 的实测理由(HEAD 5 处 role-conflict 的唯一成因)
  if (parts.length > 1 && NON_IDENTITY_PREFIXES.includes(parts[parts.length - 2])) return null
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
    // 纯尺寸档(hero)不接受"名字里带这个词"的认领 —— 见 ROLE_STEMS.hero.nameCannotClaim 的理由;
    // 显式取用走另一条路(f.role 直接来自形态),不受这里影响,所以这不是放宽,只是不猜。
    if (spec.nameCannotClaim) continue
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
 * 模态载体的**标签名**(后缀匹配:`<LoginPopUp>` / `<BottomSheet>` / `<Modal>` 都算)。
 * 为什么按后缀而不是头词元:`PopUp` 切词后头词元是 `up`,按头词元判会把这一族整片漏掉 ——
 * 与"档位键 '2xl' 被按字母开头识别漏掉"、"角色表值支 `hero:'2xl'` 不被识别"是同一条教训的
 * 第三个实例:**名字的切分方式不能替名字做语义决定**。
 */
export const MODAL_TAG_SUFFIXES = ['modal', 'popup', 'dialog', 'drawer', 'sheet', 'overlay', 'mask', 'actionsheet']

/** 满屏遮罩这一**几何角色**的样式键名(它活在键上,不在标签上)。 */
export const OVERLAY_KEY_STEMS = ['overlay', 'mask', 'backdrop', 'scrim', 'dimmer']

export function isModalTag(tag) {
  const s = String(tag || '').toLowerCase()
  return MODAL_TAG_SUFFIXES.some((x) => s.endsWith(x))
}

export function isOverlayName(name) {
  const toks = nameTokens(name)
  if (!toks.length) return false
  if (OVERLAY_KEY_STEMS.includes(toks[toks.length - 1])) return true
  return toks.join('') === 'absolutefill' // `StyleSheet.absoluteFill` 就是满屏遮罩本身
}

/** 该元素的**自有名字**里有没有 card 族(样式键 + 组件标签)。 */
function cardNamesOf(el, roleOf) {
  const out = []
  for (const k of el.keys || []) if (roleOf(k).includes('card')) out.push(k)
  if (el.base && roleOf(el.base).includes('card')) out.push(el.base)
  return out
}

/** 该元素是不是"面板族"(模态载体 / 遮罩 / 明确命名为 panel)。 */
function isPanelCarrier(el, roleOf) {
  if (!el) return false
  if (isModalTag(el.base)) return true
  if (roleOf(el.base || '').includes('panel')) return true
  for (const k of el.keys || []) if (isOverlayName(k) || roleOf(k).includes('panel')) return true
  return false
}

/**
 * **包含关系解析**:找出"模态面"元素,以及它们用到的样式键。
 *
 * 判据(两条同时成立才算面,缺一不算):
 *  ① 元素自有的某个名字属于 card 族(它自称"卡片");
 *  ② 从它往外走,第一个给出类别信号祖先**是模态载体**(标签是 `<Modal>/<*Popup>/…`,
 *     或祖先自己应用了 `overlay`/`backdrop`/`StyleSheet.absoluteFill` 这类遮罩键,
 *     或祖先自己的名字是 panel 族)。
 * 往外走时若先撞上另一张 card ⇒ 它是**模态内容里的卡片**,不是面(内层卡仍按 card 判)。
 *
 * 为什么这一格必须由容器而不是由名字定:实测四个 RN 模态件(ConfirmPurchasePopUp /
 * LoginPopUp / PrivacyPolicyModal / VerifyCodeModal)与小程序 `.pp-card` 同形 ——
 * 弹窗本体一律命名 `card:`,而它是**面板**:按名字判就会把"模态面应收 xl"这一维整片读成
 * "卡片应收 lg",反过来逼端上给弹窗补一个卡片档圆角 —— 那是拿尺子改设计。
 *
 * 同名键既当过面又当过普通卡 ⇒ `contested`:不改判,交调用方报名。
 * 这是刻意选的失效方向:一个键在同一个文件里身份不同时,任何一边的改判都有一半是错的。
 *
 * @param {object[]} elements `lib/jsx-scope.scanJsx().elements`
 * @param {{roleOf?: (name: string) => string[]}} [opts]
 */
export function classifySurfaces(elements, opts = {}) {
  const roleOf = opts.roleOf || rolesOfName
  /**
   * 只在**这个文件本身就是一个浮层组件**时启用改判。实测两头都踩过:
   *  - 一律沿祖先链改判 ⇒ `meal/page.tsx`、`prompts/page.tsx` 里"对话框内容区排的 `<Card>` 数据卡"
   *    被当成浮层体,并把同名键记成 `contested`(整键从此不改判);
   *  - 只认直接父元素 ⇒ 真目标(LoginPopUp / PayPopup / NoteEditor 的 card 盒)不满足(中间还隔一层
   *    布局 View),改判数从 25 掉到 16 并凭空造出 9 处红。
   * 真正的判别是文件级身份:浮层组件的文件名自己就说"我是浮层",页面文件里的对话框只是内容容器。
   * 页面里确有一层"自称 card 的浮层体"时,出路是显式身份标记 `ui-panel`,不是让启发式去猜。
   */
  if (!opts.modalFile) return { surfaceIdx: new Set(), surfaceKeys: new Set(), contestedKeys: new Set(), cardElements: 0 }
  const surfaceIdx = new Set()
  const keyState = new Map()
  let cardElements = 0
  for (let i = 0; i < (elements || []).length; i++) {
    const el = elements[i]
    const own = cardNamesOf(el, roleOf)
    if (!own.length) continue
    cardElements++
    let surface = false
    const chain = el.ancestorsIdx || []
    for (let j = chain.length - 1; j >= 0; j--) {
      const a = elements[chain[j]]
      if (cardNamesOf(a, roleOf).length) break // 外层已有卡 ⇒ 本元素是内容卡
      if (isPanelCarrier(a, roleOf)) {
        surface = true
        break
      }
    }
    if (surface) surfaceIdx.add(i)
    for (const k of own) {
      const st = keyState.get(k) || { surface: 0, other: 0 }
      if (surface) st.surface++
      else st.other++
      keyState.set(k, st)
    }
  }
  const surfaceKeys = new Set()
  const contestedKeys = new Set()
  for (const [k, st] of keyState) {
    if (st.surface && st.other) contestedKeys.add(k)
    else if (st.surface) surfaceKeys.add(k)
  }
  return { surfaceIdx, surfaceKeys, contestedKeys, cardElements }
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
  /**
   * 字符串区间直接取自 code-mask 那一遍词法(**不另起词法器**),供 JSX 扫描器跳过串内的
   * `<View`。它与下面 `kept` 的回填判序有一处刻意的不同:`kept` 对"未配对引号"选择不回填
   * (老口径,门 150 的锚点就是按它钉的),而 JSX 扫描要的是"词法器认为这里是串"的事实。
   * 两者各有其用,不构成第二套遮罩 —— 判定用的区间与回填用的区间都来自同一份 `maskedSpans`。
   */
  const strings = maskedSpans(src).filter((s) => s.kind === 'string')
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
  return { code, kept: kept.join(''), strings }
}

/**
 * 一行里 `className=` / `class=` 属性的**字符串字面量内容**。
 * 锚点取自 `code` 面(证明属性是真的),内容取自原文(类名活在字符串里)。
 *
 * 两个字面量之间必须**仍在同一个 class 表达式里** —— 实测原写法靠"距离 ≤60 字符"连采 3 段,
 * 于是 `className="rounded-xl border bg-card" data-testid="plan-review-panel"` 把**兄弟属性**的值
 * 也当类名收了,产出一条根本不存在的 `panel` 弱证据,和 `bg-card` 的 card 撞成 `role-conflict`。
 * 判据越界的表现不是"多算一个角色",而是**把能判的格写成判不出**。
 * 允许继续采集的间隔只可能是 `cn(` / `,` / `||` / `? :` / `+` 这类表达式连接符;
 * 出现 `=`(新属性)、`>`(开标签结束)、`}`(表达式收尾)一律停。
 */
export function classStringsInLine(codeLine, rawLine) {
  const out = []
  let m
  const RE = /\bclass(?:Name)?\s*=\s*/g
  while ((m = RE.exec(codeLine))) {
    const rest = rawLine.slice(m.index)
    let taken = 0
    let prevEnd = -1
    for (const lit of rest.matchAll(/(["'`])([^"'`\n]*)\1/g)) {
      if (lit.index > 60) break // 离锚点太远的那段字符串不属于这个属性
      if (prevEnd >= 0 && /[=>}]/.test(rest.slice(prevEnd, lit.index))) break // 已离开本属性
      if (lit[2] && /\S/.test(lit[2])) {
        out.push(lit[2])
        prevEnd = lit.index + lit[0].length
        if (++taken >= 3) break
      } else {
        prevEnd = lit.index + lit[0].length
      }
    }
  }
  return out
}

/**
 * 声明作用域表:`function X(...){}` / `const X = () => {}` / `const X = function` 的**行区间**。
 * 取材面必须是已抹注释与字符串的 code 面(否则注释里的假声明会造出不存在的区间)。
 * 括号配平失败(不闭合)⇒ 该声明**不记**,判"归属判不出"而不是猜一个范围。
 * @returns {{name:string, start:number, end:number, exported:boolean}[]} 按 start 升序
 */
export function declarationRanges(codeSource) {
  const lines = String(codeSource || '').split('\n')
  const RE =
    /(?:^|\s)(export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+|const\s+|let\s+|var\s+)([A-Z][\w$]*)\s*(?:[=(:]|\s*function)/
  const found = []
  for (let i = 0; i < lines.length; i++) {
    const m = RE.exec(lines[i])
    if (!m) continue
    if (!/^[A-Z]/.test(m[2])) continue // 只有 PascalCase 才是"这是个界面元素"的主张
    let depth = 0
    let seen = false
    let end = -1
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') {
          depth++
          seen = true
        } else if (ch === '}') {
          depth--
          if (seen && depth === 0) {
            end = j + 1
            break
          }
        }
      }
      if (end > 0) break
      if (j - i > 1200) break // 病态文件护栏:配平不到就判"判不出",不扫全文件
    }
    if (end > 0) found.push({ name: m[2], start: i + 1, end, exported: Boolean(m[1]) })
  }
  return found
}

/** 某行的**内层**声明归属(取区间最小者 = 最内层);没有 ⇒ null(判不出,不是"没有组件")。 */
export function ownerOfLine(ranges, line) {
  let best = null
  for (const r of ranges || []) {
    if (line < r.start || line > r.end) continue
    if (!best || r.end - r.start < best.end - best.start) best = r
  }
  return best
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

/**
 * **身份通道**(2026-09-28 票㉘):类别不该只靠猜 —— 代码里已经写着"这是什么"的三处权威信号,
 * 此前一律没被采:
 *  ① ARIA 「role=」(menu / dialog / tooltip / listbox / button…)—— ARIA 角色就是元素的身份;
 *  ② 「data-testid」(annotation-popover / plan-review-panel / tagsview-context-menu)—— 作者自己给这个盒子起的名字;
 *  ③ 身份标记类 「ui-<role>」(§3.1 的角色名,封闭集)—— 给"连名字都没有"的元素留的显式出口。
 * 另加一条窄口径:色档名里只有 **popover** 算身份(bg-popover 说的是"这是一层浮出",
 * 项目里它就是浮层的类族);bg-card / bg-muted 仍只是背景档,**不**算身份 ——
 * 那正是上一票 5 处 role-conflict 的成因,放宽到它们等于把身份判据整片关掉。
 */
export const IDENTITY_ROLES = ['tiny', 'control', 'chip', 'card', 'panel', 'popover', 'bubble', 'hero']
const ARIA_ROLE_TO_RADIUS = {
  menu: 'popover',
  menuitem: 'control',
  listbox: 'card',
  combobox: 'control',
  button: 'control',
  tab: 'control',
  tooltip: 'popover',
  dialog: 'panel',
  alertdialog: 'panel',
  drawer: 'panel',
}
const IDENTITY_CLASS_PREFIX = 'ui-'

/** 一行里的身份证据(强档)。返回 {roles:Set, via:string[]}。 */
export function identityEvidenceInLine(codeLine, rawLine) {
  const roles = new Set()
  const via = []
  const add = (r, from) => {
    if (!r || !IDENTITY_ROLES.includes(r)) return
    if (!roles.has(r)) {
      roles.add(r)
      via.push(from)
    }
  }
  for (const m of String(rawLine || '').matchAll(/\brole\s*=\s*["']([\w-]+)["']/g)) {
    add(ARIA_ROLE_TO_RADIUS[String(m[1]).toLowerCase()], 'aria')
  }
  for (const m of String(rawLine || '').matchAll(/\bdata-(?:testid|test-id|test)\s*=\s*["']([^"'\n]+)["']/g)) {
    for (const r of rolesOfName(m[1])) add(r, 'testid')
  }
  for (const c of classStringsInLine(codeLine, rawLine)) {
    for (const tok of String(c).split(/[\s,{}'"]+/)) {
      const t = String(tok || '').replace(/^[\w[\].-]+:/, '')
      if (t.startsWith(IDENTITY_CLASS_PREFIX)) add(t.slice(IDENTITY_CLASS_PREFIX.length), 'marker')
      // 只有 popover 这一色档算身份(浮层类族名),其余色档继续走弱证据
      if (t === 'bg-popover' || t === 'text-popover-foreground') add('popover', 'popover-tier')
    }
  }
  /**
   * 身份标记还要**按整行认一遍**:RN/Taro 的样式表里类名是对象里的裸字符串
   * (`'flex shrink-0 ui-card rounded-lg bg-card',` —— 没有 `className=` 锚点),
   * 只走 classStringsInLine 会看不见自己写下的标记 ⇒ 门对"已声明身份"的元素继续报判不出。
   * `ui-<role>` 是封闭集的显式声明,整行认不会有误判(不像 `bg-card` 那样要靠颜色猜)。
   */
  for (const m of String(rawLine || '').matchAll(new RegExp('\\b' + IDENTITY_CLASS_PREFIX + '([a-z]+)\\b', 'g'))) add(m[1], 'marker')
  return { roles, via }
}
