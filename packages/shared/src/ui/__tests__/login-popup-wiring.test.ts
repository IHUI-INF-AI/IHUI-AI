// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LoginPopUp「跨端档位一致性」契约(O02 票④,LoginPopUp 族)。
 *
 * 本测试与守门 128 的分工:门 128 判的是**两端取值集合的差**(某一档只在一端出现 ⇒ 分叉),
 * 它**看不见"两端同值但各写一份"** —— 那正是本票要拆的形态(改一端不带着另一端走)。
 * 所以这里补的是门 128 结构上补不了的那一维,并且**刻意不靠"两端此刻都引用了它"来圈定范围**:
 * 那样圈出来的范围会在某一端把引用删掉时**跟着缩**,尺子自己把被测对象缩没了 ⇒ 静默放行。
 *
 *  ① **登记面与现状对账**:本文件登记的"跨端共用档"清单是**真相源**(不是从源码反推的),
 *     三条对账保证它不会静默过期:清单里的档必须仍从 spec 导出、必须两端都真引用、
 *     且**现状两端都在用的档必须全部登记**(漏登记 ⇒ 红灯,不许静默少测一档)。
 *  ② **同档两端取值一致(表达式求值)**:把该档落到屏幕上的**逻辑 px** 在两端各自现算出来再比 ——
 *     小程序端 `toUnit(T)` = T px、`rpx(N)` = N/2 px,RN 端裸数值 = px。
 *     取数点按**窗口法**定位(以档名为锚向两侧吞掉算式片段),所以 `T * 2` 这类**改写**
 *     会被算成两倍而不是档值本身 —— 只比"档名两边都在"是恒真的空转尺子。
 *  ③ **端内不得有第二份真相(块级反向锁)**:同一个样式块里既引用了档 T、又出现与 T 同值的
 *     裸字面量 ⇒ 那一处尺寸有两个来源(改一端不带另一端走)。块级限定是**归因受控**的关键:
 *     全端扫裸数字会把别的元素(别的档、别的机制)误伤 —— 那是"归因过宽"。
 *  ④ **本锁有牙**:用"改坏的源码"回喂同一把尺子,断言它必须红 —— 缺这一半就是一条空转的尺子。
 *  ⑤ **单端档归属表(25 枚)**:门 128 的 SL 维只说"这一档只在一端出现",说不出那是
 *     "另一端根本没有这个元素"还是"本该同值却各写一份"。这张表把判词写死:谁往"另一端"
 *     补一个取数点(典型动机 = 让 diffCount 变小),这里就红。**门现读 SL LoginPopUp(24)
 *     与本表 25 的差是被门漏掉的负值档 `LOGIN_POPUP_NOTE_MARGIN_TOP_PX`(-6):门内 spec 档
 *     解析只认非负字面量(`\d+(\.\d+)?`),负号档不进 tiers ⇒ 不进 SL;本表按 spec 导出面
 *     补登它,不照抄门的漏读。**
 *  ⑥ **导出面全覆盖**:每枚 spec 导出档必须有真消费方(腿取数点);"造好没装车"不算收敛。
 *  ⑦ **端内未具名档**:门 128 的本族几何读数里有一枚 40 不是 spec 档 —— 它是小程序
 *     `app.css` 的 `.login-input { height: 80rpx }`(=40,密码登录退路表单),RN 没有
 *     账号密码表单 ⇒ A 类。本表钉住"它不得入 spec(单端档入表会让门 SL 新增单侧判红)",
 *     同时钉住它的出处与单端归属。
 *
 * 判据一律是**源码级** readFileSync + 剥注释:两端组件文件不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc(与 input-area-wiring 同口径)。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as loginPopupSpec from '../login-popup-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数(定长 `../../..` 一旦文件搬家就
 * 静默指向别处,把"耦合已断"报成"文件读不到")。找不到就抛 —— 取材前提没了不许退化成跳过。
 */
function repoRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url))
  for (let up = 0; up < 12; up += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
      return dir
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 跨端接线对账无从取材')
}

const ROOT = repoRoot()

/** 两端各自的 LoginPopUp 腿(守门 128 在册配对的两条腿文件)。 */
const LEGS = [
  { name: 'miniapp-taro', file: 'apps/miniapp-taro/src/components/LoginPopUp.tsx' },
  { name: 'mobile-rn', file: 'apps/mobile-rn/src/components/LoginPopUp.tsx' },
] as const

type LegName = (typeof LEGS)[number]['name']

/**
 * 跨端共用档清单 —— 本测试的**真相源**(14 枚,2026-10-28 按 spec 导出面 ⊕ 两端源码现读)。
 *
 * 为什么手写而不"从源码反推两端交集":反推出来的集合会**跟着现状缩** ——
 * 某一端把引用删了(退化回"各写一份裸数字"),交集随之少一枚,那条档就此退出被测范围,
 * 尺子自己把被测对象缩没了 ⇒ 静默放行。所以清单写死在此,并用三条对账把它钉住:
 * ① 每一枚仍从 spec 导出(档被删/改名 ⇒ 红灯);② 每一枚两端都真引用(某腿脱线 ⇒ 红灯);
 * ③ 现状两端都在用的档**必须全部登记**(漏登记 ⇒ 红灯,不许静默少测)。
 */
const CROSS_END_TIERS = [
  'LOGIN_POPUP_AVATAR_BOX_PX',
  'LOGIN_POPUP_AVATAR_HINT_GAP_PX',
  'LOGIN_POPUP_BODY_FONT_PX',
  'LOGIN_POPUP_BUTTON_FONT_PX',
  'LOGIN_POPUP_BUTTON_HEIGHT_PX',
  'LOGIN_POPUP_CARD_PADDING_BOTTOM_PX',
  'LOGIN_POPUP_CARD_PADDING_X_PX',
  'LOGIN_POPUP_CHANGE_HINT_FONT_PX',
  'LOGIN_POPUP_PILL_FONT_PX',
  'LOGIN_POPUP_PILL_HEIGHT_PX',
  'LOGIN_POPUP_PILL_PADDING_X_PX',
  'LOGIN_POPUP_ROW_HEIGHT_PX',
  'LOGIN_POPUP_ROW_PADDING_X_PX',
  'LOGIN_POPUP_SECTION_GAP_PX',
] as const

/**
 * 单端档归属表 —— 本族"两端不一样"的 25 枚具名档各自只许在哪一端出现。
 *
 * 三类归属(与 login-popup-spec 头注 O02 段逐条对应):
 *   A 一端根本没有该元素/该形态(往另一端补引用 = 往屏幕上加一个不存在的节点);
 *   B 同一元素、两端按已裁决的承载契约取不同档(取任一端会破另一端的版);
 *   C 同槽位两端各由自身机制决定 —— 本族**没有 C 类具名档**(圆角走 77 单源、遮罩颜色
 *     走 tokens,都不是 spec 几何档,故不在此表)。
 *
 * 这枚差值的来源要写死:门 128 现读 SL LoginPopUp(24)= 仅小程序 2 + 仅 RN 22,
 * 而 spec 导出面的单端档实为 25 —— 差的 `LOGIN_POPUP_NOTE_MARGIN_TOP_PX`(-6)因门只解析
 * 非负字面量而不在门 tiers 里。本表按 spec 导出面补登,不沿用门的漏读(§0.3)。
 */
const SINGLE_END_TIERS: ReadonlyArray<{
  tier: string
  owner: LegName
  kind: 'A' | 'B'
  why: string
}> = [
  // ── 小程序端单侧(dialog 承载) ──
  {
    tier: 'LOGIN_POPUP_DIALOG_PADDING_TOP_PX',
    owner: 'miniapp-taro',
    kind: 'B',
    why: 'B 与 RN SHEET_PADDING_TOP 8 同一卡顶内距:居中卡四边均匀 24 vs 抽屉顶被拖拽条占用 8,取任一端会破另一端版',
  },
  {
    tier: 'LOGIN_POPUP_DIALOG_MAX_WIDTH_PX',
    owner: 'miniapp-taro',
    kind: 'A',
    why: 'A 居中弹窗形态独有(卡靠屏居中需要宽度上限 300);RN 抽屉整宽,没有宽度上限这一档',
  },
  // ── RN 端单侧(sheet / 授权卡 / 资料卡独有) ──
  {
    tier: 'LOGIN_POPUP_SHEET_PADDING_TOP_PX',
    owner: 'mobile-rn',
    kind: 'B',
    why: 'B 同上:抽屉顶距 8 被拖拽条占用,与小程序居中卡 24 是同一槽位的承载差异',
  },
  {
    tier: 'LOGIN_POPUP_DRAG_BAR_WIDTH_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 抽屉把手独有;小程序居中卡没有把手',
  },
  {
    tier: 'LOGIN_POPUP_DRAG_BAR_HEIGHT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:把手高度',
  },
  {
    tier: 'LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:把手与内容的距离(与分块间距同值但语义独立,不并档)',
  },
  {
    tier: 'LOGIN_POPUP_TITLE_FONT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 授权卡标题块;小程序弹窗无标题',
  },
  {
    tier: 'LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:标题底距',
  },
  {
    tier: 'LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 授权卡描述块;小程序弹窗无描述',
  },
  {
    tier: 'LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 授权卡次按钮与协议行之间的留白;小程序无次按钮与协议行',
  },
  {
    tier: 'LOGIN_POPUP_AGREEMENT_FONT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 协议行;小程序登录协议由微信授权面板承载,整行不存在',
  },
  {
    tier: 'LOGIN_POPUP_AGREEMENT_GAP_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 协议勾选框与文案间距;小程序无该行',
  },
  {
    tier: 'LOGIN_POPUP_CHECKBOX_SIZE_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 协议勾选框;小程序无该行',
  },
  {
    tier: 'LOGIN_POPUP_AGREEMENT_MARK_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 勾选内 lucide Check 的 size;小程序无该行',
  },
  {
    tier: 'LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 右上 × 关闭钮;小程序关闭是底部整宽文字按钮(承载形态差异,两档不得互抄)',
  },
  {
    tier: 'LOGIN_POPUP_CLOSE_ICON_FONT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A × 字形字号;小程序无该元素',
  },
  {
    tier: 'LOGIN_POPUP_CLOSE_ICON_LINE_HEIGHT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A × 字形行盒(18+4 的基线补偿);小程序无该元素',
  },
  {
    tier: 'LOGIN_POPUP_CLOSE_INSET_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A × 按钮距卡顶/右;小程序无该元素',
  },
  {
    tier: 'LOGIN_POPUP_ICON_BADGE_SIZE_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 资料行首图标徽标;小程序资料卡行没有前缀徽标',
  },
  {
    tier: 'LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:徽标与输入/文字的间距',
  },
  {
    tier: 'LOGIN_POPUP_ICON_GLYPH_FONT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 徽标内 lucide 图标尺寸;小程序无该元素',
  },
  {
    tier: 'LOGIN_POPUP_NOTE_FONT_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 行内 hint/error 行;小程序校验失败走 Taro.showToast,没有行内提示块',
  },
  {
    tier: 'LOGIN_POPUP_NOTE_MARGIN_TOP_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:hint/error 行顶距 -6(负值,门 SL 现读漏报的那一枚)',
  },
  {
    tier: 'LOGIN_POPUP_FOOTER_MARGIN_TOP_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 保存/登出块;小程序弹窗没有该块(保存由父页面承载)',
  },
  {
    tier: 'LOGIN_POPUP_FOOTER_GAP_PX',
    owner: 'mobile-rn',
    kind: 'A',
    why: 'A 同上:保存/登出按钮横向间距',
  },
]

/**
 * B 类机制对 —— 同一槽位、两端各一档,且**必须保持不同值**。
 *
 * 这一条单独成表而不是并进归属表的原因:归属表只判"每枚只在登记端出现",它拦不住
 * "有人把 8 改成 24 把两端拉平"(那样每枚仍只在各自端出现,归属表全绿,而抽屉顶部
 * 会把拖拽条挤下去)。本表把"必须不同值"写成断言,并配 ⑫ 的变异自证。
 */
const MECHANISM_TIER_PAIRS: ReadonlyArray<{ a: string; b: string; why: string }> = [
  {
    a: 'LOGIN_POPUP_DIALOG_PADDING_TOP_PX',
    b: 'LOGIN_POPUP_SHEET_PADDING_TOP_PX',
    why: '同一卡顶内距:居中卡 24(四边均匀)vs 抽屉 8(拖拽条占位);拉平会破一端版',
  },
]

/**
 * 端内未具名档 —— 门 128 读得出、却**不该进 spec** 的那一型(2026-10-28 现读)。
 *
 * `40` 来自小程序 `app.css` 的 `.login-input { height: 80rpx }`(密码登录退路表单的输入行)。
 * 它不是 spec 档,也**不能**收进 spec:它只在小程序端出现,入表会让门 128 的 SL 维新增一条
 * 单侧判红(与 input-area 的 `catChip.maxWidth: 96` 同一条边界)。故登记为 A 类端内档,
 * 用"出处仍在 + 只在 owner 端 + 未入 spec"三条件钉住。
 */
const UNNAMED_END_TIERS: ReadonlyArray<{
  px: number
  owner: LegName
  anchor: string
  cssFile: string
  cssBlock: string
  cssHeightPattern: string
  why: string
}> = [
  {
    px: 40,
    owner: 'miniapp-taro',
    anchor: 'login-field',
    cssFile: 'apps/miniapp-taro/src/app.css',
    cssBlock: '.login-input',
    cssHeightPattern: 'height:\\s*(\\d+(?:\\.\\d+)?)rpx',
    why: 'A 密码登录输入行高 80rpx(=40);RN 没有账号密码表单,该元素整块不存在',
  },
]

/**
 * 几何槽位白名单 —— 只有这些属性名上的裸字面量算"尺寸真相"。
 * 白名单之外(flex / zIndex / opacity / 事件参数 …)不参与第二份真相判定:
 * 那些不是尺寸,判进去是"归因过宽"。
 */
const GEOMETRY_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginVertical',
  'marginHorizontal',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingVertical',
  'paddingHorizontal',
  'gap',
  'rowGap',
  'columnGap',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'borderWidth',
  'borderRadius',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
])

/**
 * 剥注释但**保留字符串内容** —— 剥字符串会把 `className="w-[85%]"` 一起抹掉(判据失明),
 * 留注释会把说明性文字(含历史数字)喂进判据。与守门 128 的同名函数同一形状;
 * 本文件不引 scripts/(测试不依赖守门实现)。
 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    const n = src.charAt(i + 1)
    if (mode === 'code') {
      if (quote !== '') {
        out += c
        if (c === '\\') {
          out += n
          i += 1
        } else if (c === quote) {
          quote = ''
        }
        continue
      }
      if (c === '/' && n === '/') {
        mode = 'line'
        out += '  '
        i += 1
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        out += '  '
        i += 1
        continue
      }
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else {
        out += ' '
      }
      continue
    }
    if (c === '*' && n === '/') {
      mode = 'code'
      out += '  '
      i += 1
      continue
    }
    out += c === '\n' ? c : ' '
  }
  return out
}

/**
 * 去掉 import 语句(import 块里的档名是"已接线"的声明,**不是取数点**)。
 * 若把 import 里的档名算成取数点,两端"都引用了"这条正向对照会**恒真**。
 */
function stripImportLines(src: string): string {
  const out: string[] = []
  let inImport = false
  for (const line of src.split('\n')) {
    if (!inImport && /^\s*import\b/.test(line)) inImport = true
    if (inImport) {
      if (/from\s*['"][^'"]*['"]/.test(line) || /^\s*import\s*['"][^'"]*['"]/.test(line))
        inImport = false
      out.push('')
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * 把字符串内容涂成空格(保留引号与行数)—— 让**字面量扫描**看不见字符串里的数字
 * (`placeholderStyle="font-size: 28rpx;"` 这类),同时不破坏大括号配平。
 */
function maskStrings(src: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    if (quote !== '') {
      if (c === '\\') {
        out += '  '
        i += 1
        continue
      }
      if (c === quote) {
        quote = ''
        out += c
        continue
      }
      out += c === '\n' ? '\n' : ' '
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      continue
    }
    out += c
  }
  return out
}

/** 一端用于判定的源码:剥注释 → 去 import → 涂字符串。 */
function prepare(src: string): string {
  return maskStrings(stripImportLines(stripComments(src)))
}

const LEG_SRC = Object.fromEntries(
  LEGS.map((l) => [l.name, prepare(readFileSync(join(ROOT, l.file), 'utf8'))]),
) as Record<LegName, string>

/**
 * 两端源码的**原始面**(只剥注释、保留字符串)—— 给"类名锚点"类判据用。
 * `prepare` 会把字符串内容涂成空格(那是为了不让字符串里的数字喂进几何判据),
 * 于是 `className="login-field"` 在 LEG_SRC 里不可见;而端内未具名档的归属恰恰要靠
 * 这个类名锚点来钉,所以这里另取一份原始面。两份面各有各的用途,不互相替代。
 */
const RAW_LEG_SRC = Object.fromEntries(
  LEGS.map((l) => [l.name, stripComments(readFileSync(join(ROOT, l.file), 'utf8'))]),
) as Record<LegName, string>

/**
 * spec 导出面里所有 `_PX` 数字档 —— 算式求值时的符号表,以及"档值"的唯一真相。
 * 现读,不手抄:手抄的表在新增档后会静默过期 ⇒ 判据变成"两倍误差也能过"的空转尺子。
 */
function specTierValues(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [k, v] of Object.entries(loginPopupSpec as Record<string, unknown>)) {
    if (/^[A-Z][A-Z0-9_]*_PX$/.test(k) && typeof v === 'number') out.set(k, v)
  }
  return out
}

const TIER_VALUES = specTierValues()

/**
 * 小程序端 `toUnit` 的换算系数(rpx/px)。**现读**自两端源码,不在本文件写死 2:
 * 换算系数变了而本测试还按 2 折算,断言就变成"两倍误差也能过"的空转尺子。
 */
function taroRpxPerPx(): number {
  const mini = LEG_SRC['miniapp-taro']
  if (!/const\s+toUnit\s*=\s*\(px:\s*number\)\s*=>\s*rpx\(px\s*\*\s*TARO_RPX_PER_PX\)/.test(mini)) {
    throw new Error('小程序端 toUnit 不再是 rpx(px * TARO_RPX_PER_PX)⇒ 本测试的换算前提已失效')
  }
  const geo = readFileSync(join(ROOT, 'packages/design-tokens/src/geometry.js'), 'utf8')
  const hit = geo.match(/\bTARO_RPX_PER_PX\s*=\s*(\d+(?:\.\d+)?)/)
  if (!hit) throw new Error('geometry.js 读不到 TARO_RPX_PER_PX ⇒ 本测试的换算前提已失效')
  return Number(hit[1])
}

const RPX_PER_PX = taroRpxPerPx()

/* ───────────────────────── 表达式求值(逻辑 px 口径) ───────────────────────── */

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  const re = /\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[()+\-*/]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const t = m[0]
    if (/^\d/.test(t)) out.push({ k: 'num', v: Number(t) })
    else if (/^[A-Za-z_$]/.test(t)) out.push({ k: 'id', v: t })
    else out.push({ k: 'op', v: t })
  }
  return out
}

/**
 * 极简算式求值器:支持数值、spec 档名、`toUnit(…)` / `rpx(…)`、括号与 `+ - * /`。
 * 认不出的标识符 ⇒ 返回 null(**不可求值**),绝不猜一个值。
 *
 * 量纲约定(全部折算到**逻辑 px**,两端同量纲才可比):
 *  - `toUnit(x)` = x px(rpx(px × 2) 在 750 设计宽下渲染回 x px)
 *  - `rpx(n)`    = n / RPX_PER_PX px
 *  - 裸数值      = 该数值 px(RN 端 dp / 小程序端 style 数值)
 */
class Expr {
  private i = 0

  constructor(
    private readonly toks: Tok[],
    private readonly rpxPerPx: number,
  ) {}

  parse(): number | null {
    const v = this.expr()
    if (v === null) return null
    return this.i === this.toks.length ? v : null
  }

  private peek(): Tok | undefined {
    return this.toks[this.i]
  }

  private expr(): number | null {
    let left = this.term()
    if (left === null) return null
    for (;;) {
      const t = this.peek()
      if (!t || t.k !== 'op' || (t.v !== '+' && t.v !== '-')) return left
      this.i += 1
      const right = this.term()
      if (right === null) return null
      left = t.v === '+' ? left + right : left - right
    }
  }

  private term(): number | null {
    let left = this.factor()
    if (left === null) return null
    for (;;) {
      const t = this.peek()
      if (!t || t.k !== 'op' || (t.v !== '*' && t.v !== '/')) return left
      this.i += 1
      const right = this.factor()
      if (right === null) return null
      if (t.v === '*') left = left * right
      else {
        if (right === 0) return null
        left = left / right
      }
    }
  }

  private factor(): number | null {
    const t = this.peek()
    if (!t) return null
    if (t.k === 'num') {
      this.i += 1
      return t.v
    }
    if (t.k === 'op' && t.v === '-') {
      this.i += 1
      const v = this.factor()
      return v === null ? null : -v
    }
    if (t.k === 'op' && t.v === '(') {
      this.i += 1
      const v = this.expr()
      const close = this.peek()
      if (v === null || !close || close.k !== 'op' || close.v !== ')') return null
      this.i += 1
      return v
    }
    if (t.k === 'id') {
      this.i += 1
      const next = this.peek()
      if (next && next.k === 'op' && next.v === '(') {
        this.i += 1
        const arg = this.expr()
        const close = this.peek()
        if (arg === null || !close || close.k !== 'op' || close.v !== ')') return null
        this.i += 1
        if (t.v === 'toUnit') return arg
        if (t.v === 'rpx') return arg / this.rpxPerPx
        return null
      }
      const v = TIER_VALUES.get(t.v)
      return v === undefined ? null : v
    }
    return null
  }
}

/** 求一个算式片段的逻辑 px 值;不可求值 ⇒ null。 */
function evalExpr(text: string, rpxPerPx: number): number | null {
  const toks = tokenize(text)
  if (!toks.length) return null
  return new Expr(toks, rpxPerPx).parse()
}

/** 算式片段里可能出现的字符(窗口法的边界集合)。 */
const ARITH_CHAR = /[A-Za-z0-9_$.+\-*/()\s]/

interface Usage {
  /** 1 基行号 */
  line: number
  /** 该取数点所在的算式片段 */
  window: string
}

/**
 * 窗口法定位取数点:以档名为锚,向左右吞掉算术片段。
 * 吞到的是**这一处取数的完整算式**(含 `toUnit(…)` / `rpx(…)` 包装与 `* 2` 之类改写),
 * 于是"档被放大/缩小"能被算出来,而不是一律当成档值本身。
 */
function usagesOf(src: string, tier: string): Usage[] {
  const out: Usage[] = []
  const re = new RegExp(`\\b${tier}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let s = m.index
    while (s > 0 && ARITH_CHAR.test(src.charAt(s - 1))) s -= 1
    let e = m.index + m[0].length
    while (e < src.length && ARITH_CHAR.test(src.charAt(e))) e += 1
    out.push({ line: src.slice(0, m.index).split('\n').length, window: src.slice(s, e) })
  }
  return out
}

interface Taking {
  px: number
  line: number
}

function takeingsOf(
  src: string,
  tier: string,
  rpxPerPx: number,
): { takeings: Taking[]; sites: Usage[] } {
  const sites = usagesOf(src, tier)
  const takeings: Taking[] = []
  for (const site of sites) {
    const px = evalExpr(site.window, rpxPerPx)
    if (px !== null) takeings.push({ px, line: site.line })
  }
  return { takeings, sites }
}

/**
 * 一档两端取值是否一致 + 各自是否真引用 —— 判据核心。
 * @returns {{problems:string[], miniPx:number[], rnPx:number[]}} 问题列表;空 = 通过
 */
function tierParityProblems(
  tier: string,
  miniSrc: string,
  rnSrc: string,
  rpxPerPx: number,
): { problems: string[]; miniPx: number[]; rnPx: number[] } {
  const problems: string[] = []
  const mini = takeingsOf(miniSrc, tier, rpxPerPx)
  const rn = takeingsOf(rnSrc, tier, rpxPerPx)
  if (!mini.sites.length) {
    problems.push(`小程序端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
  if (!rn.sites.length) {
    problems.push(`RN 端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
  if (!mini.takeings.length && mini.sites.length) {
    problems.push(`小程序端对 ${tier} 的取数点全部不可求值 ⇒ 本测试对该档失明`)
  }
  if (!rn.takeings.length && rn.sites.length) {
    problems.push(`RN 端对 ${tier} 的取数点全部不可求值 ⇒ 本测试对该档失明`)
  }
  const miniPx = [...new Set(mini.takeings.map((t) => t.px))]
  const rnPx = [...new Set(rn.takeings.map((t) => t.px))]
  if (miniPx.length > 1) {
    problems.push(`小程序端对 ${tier} 取到了多个值 ${miniPx.join('/')} ⇒ 同一档名身不自洽`)
  }
  if (rnPx.length > 1) {
    problems.push(`RN 端对 ${tier} 取到了多个值 ${rnPx.join('/')} ⇒ 同一档名身不自洽`)
  }
  if (miniPx.length === 1 && rnPx.length === 1 && miniPx[0] !== rnPx[0]) {
    problems.push(`${tier} 两端取值不同:小程序 ${miniPx[0]}px vs RN ${rnPx[0]}px`)
  }
  const specPx = TIER_VALUES.get(tier)
  if (specPx !== undefined && miniPx.length === 1 && miniPx[0] !== specPx) {
    problems.push(`${tier} 小程序端落屏 ${miniPx[0]}px ≠ spec 档值 ${specPx}px ⇒ 档被改写`)
  }
  if (specPx !== undefined && rnPx.length === 1 && rnPx[0] !== specPx) {
    problems.push(`${tier} RN 端落屏 ${rnPx[0]}px ≠ spec 档值 ${specPx}px ⇒ 档被改写`)
  }
  return { problems, miniPx, rnPx }
}

/* ───────────────────── 块级反向锁:端内第二份真相 ───────────────────── */

interface LevelHit {
  tiers: { name: string; px: number; line: number }[]
  /** 几何槽位上的裸字面量(已折算到逻辑 px) */
  lits: { px: number; line: number; key: string }[]
}

/**
 * 块级扫描:同一个**最内层块**里既引用了档 T、又出现与 T 同值的裸字面量 ⇒ 第二份真相。
 *
 * 为什么限定"最内层块":同一块里的槽位属于**同一个控件/同一条样式**,
 * 那里再写一份同值字面量,就是"同一处尺寸有两个来源" ⇒ 改一端不带另一端走。
 * 反之,跨块/跨元素的巧合同值是常态(不同控件同尺寸),扫全端会把它们误伤 —— 那是"归因过宽"。
 */
function doubleTruthProblems(src: string, side: string, rpxPerPx: number): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const levels: (LevelHit | undefined)[] = []
  let depth = 0
  let line = 1
  /** 当前层里"最近一个几何槽位的键名" */
  let key: string | null = null
  /** 刚读到 `:` ⇒ 下一个值若为裸数字,算作该键的值 */
  let expectValue = false

  const level = (): LevelHit | undefined => levels[depth]

  for (let p = 0; p < src.length; p += 1) {
    const c = src.charAt(p)
    if (c === '\n') {
      line += 1
      expectValue = false
      continue
    }
    if (c === '{') {
      depth += 1
      levels[depth] = { tiers: [], lits: [] }
      key = null
      expectValue = false
      continue
    }
    if (c === '}') {
      const hit = levels[depth]
      if (hit) {
        for (const tier of hit.tiers) {
          for (const lit of hit.lits) {
            if (lit.px !== tier.px) continue
            const dedupe = `${tier.name}|${lit.px}|${lit.line}`
            if (seen.has(dedupe)) continue
            seen.add(dedupe)
            problems.push(
              `${side} L${lit.line}:同一块内已引档 ${tier.name}(${tier.px}px),` +
                `${lit.key} 却又写了同值裸字面量 ${lit.px}px ⇒ 第二份真相`,
            )
          }
        }
      }
      levels[depth] = undefined
      depth = Math.max(0, depth - 1)
      key = null
      expectValue = false
      continue
    }
    const hit = level()
    if (!hit) continue
    if (/\s/.test(c)) continue
    // 标识符
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(p))
      if (!m) continue
      const name = m[0]
      const rest = src.slice(p + name.length)
      if (name === 'rpx' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg) {
          if (expectValue && key && GEOMETRY_KEYS.has(key)) {
            hit.lits.push({ px: Number(arg[1]) / rpxPerPx, line, key })
          }
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      if (name === 'toUnit' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg) {
          if (expectValue && key && GEOMETRY_KEYS.has(key)) {
            hit.lits.push({ px: Number(arg[1]), line, key })
          }
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      const px = TIER_VALUES.get(name)
      if (px !== undefined) hit.tiers.push({ name, px, line })
      const after = /^\s*:/.exec(rest)
      if (after) {
        key = GEOMETRY_KEYS.has(name) ? name : null
        expectValue = true
        p += name.length + after[0].length - 1
        continue
      }
      key = null
      expectValue = false
      p += name.length - 1
      continue
    }
    // 数值
    if (/[0-9]/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(p))
      if (!m) continue
      if (expectValue && key && GEOMETRY_KEYS.has(key)) {
        hit.lits.push({ px: Number(m[0]), line, key })
      }
      expectValue = false
      p += m[0].length - 1
      continue
    }
    key = null
    expectValue = false
  }
  return problems
}

/** 两端"都在用"的档集合(取数点口径,import 不算)。 */
function tiersUsedByBoth(miniSrc: string, rnSrc: string): string[] {
  const out: string[] = []
  for (const name of TIER_VALUES.keys()) {
    if (usagesOf(miniSrc, name).length > 0 && usagesOf(rnSrc, name).length > 0) out.push(name)
  }
  return out.sort()
}

/** 单端档归属判据:返回问题清单(空 = 每枚档只在登记的那一端有取数点)。 */
function singleEndProblems(srcs: Record<LegName, string>): string[] {
  const problems: string[] = []
  for (const { tier, owner, kind, why } of SINGLE_END_TIERS) {
    if (!TIER_VALUES.has(tier)) {
      problems.push(`${tier} 已不在 spec 导出面(档被删/改名)⇒ 归属表过期;${kind} ${why}`)
      continue
    }
    const other: LegName = owner === 'miniapp-taro' ? 'mobile-rn' : 'miniapp-taro'
    if (usagesOf(srcs[owner], tier).length === 0)
      problems.push(`${owner} 不再消费 ${tier} ⇒ 真实取数点丢了(${kind} ${why})`)
    if (usagesOf(srcs[other], tier).length > 0)
      problems.push(`${other} 也引用了 ${tier} ⇒ 给单端补引用凑平,不是收敛(${kind} ${why})`)
  }
  return problems
}

/**
 * B 类机制对判据:两档都必须存在、必须在**不同**端被消费、且值必须**不相等**。
 * 前两条与 singleEndProblems 重叠(那里按单枚判),这里多出来的是第三条 ——
 * "把两端顶距拉平"在归属表上是全绿的,只有这一条能拦。
 */
function mechanismPairProblems(
  srcs: Record<LegName, string>,
  values: Map<string, number>,
): string[] {
  const problems: string[] = []
  for (const { a, b, why } of MECHANISM_TIER_PAIRS) {
    const va = values.get(a)
    const vb = values.get(b)
    if (va === undefined) problems.push(`${a} 已不在 spec 导出面 ⇒ 机制对清单过期(${why})`)
    if (vb === undefined) problems.push(`${b} 已不在 spec 导出面 ⇒ 机制对清单过期(${why})`)
    if (va === undefined || vb === undefined) continue
    if (va === vb)
      problems.push(`${a}(${va}) 与 ${b}(${vb}) 取值被拉平 ⇒ 承载差异被抹成同一档(${why})`)
    const ea = usagesOf(srcs['miniapp-taro'], a).length + usagesOf(srcs['mobile-rn'], a).length
    const eb = usagesOf(srcs['miniapp-taro'], b).length + usagesOf(srcs['mobile-rn'], b).length
    if (ea === 0) problems.push(`${a} 两端都无取数点 ⇒ 机制对清单里这一枚是幻影档(${why})`)
    if (eb === 0) problems.push(`${b} 两端都无取数点 ⇒ 机制对清单里这一枚是幻影档(${why})`)
  }
  return problems
}

/**
 * 端内未具名档判据(空 = 每一枚仍是"只在 owner 端、未入 spec、出处仍在")。
 * `read` 只是为变异自证留的注入点(默认现读磁盘),判据本身零复制。
 */
function unnamedEndTierProblems(opts: {
  legSrcs: Record<LegName, string>
  values: Map<string, number>
  read?: (rel: string) => string
}): string[] {
  const problems: string[] = []
  const read =
    opts.read ?? ((rel: string): string => stripComments(readFileSync(join(ROOT, rel), 'utf8')))
  const specPx = new Set(opts.values.values())
  for (const t of UNNAMED_END_TIERS) {
    if (specPx.has(t.px))
      problems.push(
        `${t.px} 已作为 spec 导出档存在 ⇒ 端内未具名档被收进表:单端档入表会让门 128 的 SL 维新增单侧判红(${t.why})`,
      )
    const other: LegName = t.owner === 'miniapp-taro' ? 'mobile-rn' : 'miniapp-taro'
    if (!opts.legSrcs[t.owner].includes(t.anchor))
      problems.push(`${t.owner} 不再渲染 ${t.anchor} ⇒ 该未具名档的真实元素丢了(${t.why})`)
    if (opts.legSrcs[other].includes(t.anchor))
      problems.push(`${other} 也出现了 ${t.anchor} ⇒ 给单端补元素凑平,不是收敛(${t.why})`)
    let css = ''
    try {
      css = read(t.cssFile)
    } catch {
      problems.push(`${t.cssFile} 读不到 ⇒ 未判定,不得记成"出处仍在"(§0.3)`)
      continue
    }
    const blockIdx = css.indexOf(t.cssBlock)
    if (blockIdx < 0) {
      problems.push(
        `${t.cssFile} 里已找不到 ${t.cssBlock} ⇒ 该未具名档的出处消失,本表过期(${t.why})`,
      )
      continue
    }
    const body = css.slice(blockIdx, css.indexOf('}', blockIdx) + 1)
    const hit = body.match(new RegExp(t.cssHeightPattern))
    if (!hit) {
      problems.push(`${t.cssBlock} 里读不到 height 的 rpx 值 ⇒ 未判定(${t.why})`)
      continue
    }
    const px = Number(hit[1]) / RPX_PER_PX
    if (px !== t.px)
      problems.push(`${t.cssBlock} 高度已从 ${t.px}px 变成 ${px}px ⇒ 本表登记值过期(${t.why})`)
  }
  return problems
}

/**
 * 幻影档判据:每枚 spec 导出档必须在两条腿之一有真消费方(import 不算)。
 * 本族没有跨件投影消费方(spec 只被两端组件引用),所以不需要投影表。
 */
function phantomTierProblems(opts: {
  legSrcs: Record<LegName, string>
  specExports: string[]
}): string[] {
  const problems: string[] = []
  for (const tier of opts.specExports) {
    const legs = (Object.keys(opts.legSrcs) as LegName[]).filter(
      (leg) => usagesOf(opts.legSrcs[leg], tier).length > 0,
    )
    if (legs.length === 0)
      problems.push(
        `${tier} 从 spec 导出却没有任何消费方(两条腿都无取数点)⇒ 幻影档:接上真实取数点,或把档删掉`,
      )
  }
  return problems
}

describe('LoginPopUp 跨端档位一致性(O02 票④)', () => {
  it('① 登记面与现状对账:清单仍从 spec 导出、两端都真引用、现状共用档全部登记', () => {
    for (const tier of CROSS_END_TIERS) {
      expect(
        TIER_VALUES.has(tier),
        `${tier} 已不在 spec 导出面 ⇒ 清单过期(档被删或改名),请同步本清单`,
      ).toBe(true)
      for (const leg of LEGS) {
        expect(
          usagesOf(LEG_SRC[leg.name], tier).length,
          `${leg.file} 不再引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`,
        ).toBeGreaterThan(0)
      }
    }
    const both = tiersUsedByBoth(LEG_SRC['miniapp-taro'], LEG_SRC['mobile-rn'])
    expect(
      both,
      `现状两端都在用的档未登记进 CROSS_END_TIERS:${both.join(',')} ⇒ 新增共用档必须进清单,否则少测一档`,
    ).toEqual([...CROSS_END_TIERS].sort())
  })

  it('② 两端共用的每一枚档,两端落屏的逻辑 px 相等(算式现算,不认字面名)', () => {
    for (const tier of CROSS_END_TIERS) {
      const { problems } = tierParityProblems(
        tier,
        LEG_SRC['miniapp-taro'],
        LEG_SRC['mobile-rn'],
        RPX_PER_PX,
      )
      expect(problems, `${tier} 两端取值不一致`).toEqual([])
    }
  })

  it('③ 端内不得有第二份真相:块级反向锁', () => {
    for (const leg of LEGS) {
      expect(
        doubleTruthProblems(LEG_SRC[leg.name], leg.name, RPX_PER_PX),
        `${leg.file} 上有"同一块内既引档又写同值裸字面量"的第二份真相`,
      ).toEqual([])
    }
  })

  it('④ 本锁有牙:一端把档放大(TIER → TIER * 2)⇒ 取值一致性判据必须红', () => {
    const tier = 'LOGIN_POPUP_AVATAR_BOX_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /width:\s*LOGIN_POPUP_AVATAR_BOX_PX,/,
      'width: LOGIN_POPUP_AVATAR_BOX_PX * 2,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(problems.length, '把档放大 2 倍后取值一致性判据仍绿 ⇒ 判据没在比值').toBeGreaterThan(0)
  })

  it('⑤ 本锁有牙:某一端整枚档退出引用 ⇒ 脱线判据必须红(改一端不带另一端走)', () => {
    const tier = 'LOGIN_POPUP_AVATAR_BOX_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replaceAll(tier, '__gone__')
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    expect(usagesOf(dirtyRn, tier).length).toEqual(0)
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(
      problems.length,
      '一端整枚档退出引用后取值一致性判据仍绿 ⇒ 判据只认"名字在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑥ 本锁有牙:块内一个槽位改成同值裸数字 ⇒ 块级反向锁必须红(端内第二份真相)', () => {
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /width:\s*LOGIN_POPUP_AVATAR_BOX_PX,\s*\n\s*height:\s*LOGIN_POPUP_AVATAR_BOX_PX,/,
      'width: LOGIN_POPUP_AVATAR_BOX_PX,\n    height: 70,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const problems = doubleTruthProblems(dirtyRn, 'mobile-rn', RPX_PER_PX)
    expect(problems.length, '块内混入同值裸字面量后反向锁仍绿 ⇒ 锁没生效').toBeGreaterThan(0)
  })

  it('⑦ 本锁有牙:小程序端单槽位退回 rpx(140) 写法 ⇒ 端内第二份真相必须红', () => {
    // 这一例是本票要拆的形态:两端数值同档(70)但小程序写 rpx(140)、RN 写档名。
    // 只换一格(高度仍走共享档)⇒ 同一块内同时出现"档引用"与"同值裸字面量",锁必须红。
    const dirtyMini = LEG_SRC['miniapp-taro'].replace(
      /width:\s*toUnit\(LOGIN_POPUP_AVATAR_BOX_PX\),/,
      'width: rpx(140),',
    )
    expect(dirtyMini).not.toBe(LEG_SRC['miniapp-taro'])
    const problems = doubleTruthProblems(dirtyMini, 'miniapp-taro', RPX_PER_PX)
    expect(
      problems.length,
      '小程序端单槽位退回 rpx(140) 后反向锁仍绿 ⇒ 锁认不出"rpx 字面量也是同值裸真相"',
    ).toBeGreaterThan(0)
  })

  it('⑧ 单端档归属表:每枚只在登记的那一端有取数点(另一端补引用 = 凑平,必须红)', () => {
    expect(SINGLE_END_TIERS.length, '归属表空了 ⇒ 这条尺子没在测任何东西').toBeGreaterThan(20)
    expect(
      SINGLE_END_TIERS.filter((x) => x.kind === 'A').length,
      'A 类应为大多数(本族是 dialog↔sheet 两承载,大部分档另一端根本没有该元素)',
    ).toBeGreaterThan(20)
    expect(
      SINGLE_END_TIERS.filter((x) => x.kind === 'B').length,
      'B 类(同一卡顶内距两端各一档)至少 1 对',
    ).toBeGreaterThan(0)
    expect(
      singleEndProblems(LEG_SRC),
      '单端档归属被破坏(要么真实取数点丢了,要么有人往另一端补引用凑平)',
    ).toEqual([])
  })

  it('⑨ 本锁有牙:两端各做一次变异 ⇒ ⑧ 必须红', () => {
    // 变异一:往"另一端"补一个取数点 —— 本票明令禁止的"给单端补数字凑平"。
    const tier = 'LOGIN_POPUP_DIALOG_MAX_WIDTH_PX'
    const padded: Record<LegName, string> = {
      ...LEG_SRC,
      'mobile-rn': `${LEG_SRC['mobile-rn']}\nconst __probe = { width: ${tier} }\n`,
    }
    expect(padded['mobile-rn']).not.toBe(LEG_SRC['mobile-rn'])
    expect(
      singleEndProblems(padded).length,
      '另一端补引用后归属判据仍绿 ⇒ 锁拦不住"凑平"',
    ).toBeGreaterThan(0)

    // 变异二:把 owner 那一端的真实取数点删掉(元素被误删 / 退化回裸数字)。
    const rnTier = 'LOGIN_POPUP_FOOTER_GAP_PX'
    const stripped: Record<LegName, string> = {
      ...LEG_SRC,
      'mobile-rn': LEG_SRC['mobile-rn'].replaceAll(rnTier, '__gone__'),
    }
    expect(stripped['mobile-rn']).not.toBe(LEG_SRC['mobile-rn'])
    expect(
      singleEndProblems(stripped).length,
      'owner 端取数点被删后归属判据仍绿 ⇒ 锁只认"另一侧没有",不认"这一侧还在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑩ 导出面全覆盖:每一枚 spec 档都有真消费方(幻影档 = 造好没装车 ⇒ 红)', () => {
    const exports = [...TIER_VALUES.keys()]
    expect(exports.length, 'spec 导出面读空 ⇒ 本用例在测一个不存在的东西').toBeGreaterThan(30)
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, specExports: exports }),
      '存在无消费方的导出档(AGENTS §0.9 造好没装车 = 没有)',
    ).toEqual([])
  })

  it('⑪ 本锁有牙:凭空加一枚无人取数的档 / 摘掉唯一消费腿 ⇒ ⑩ 必须红', () => {
    const exports = [...TIER_VALUES.keys()]
    const phantom = 'LOGIN_POPUP___PROBE_PHANTOM_PX'
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, specExports: [...exports, phantom] }).length,
      '凭空加一枚无人引用的档后幻影判据仍绿 ⇒ 导出面没人对账',
    ).toBeGreaterThan(0)

    const onlyMiniTier = 'LOGIN_POPUP_DIALOG_MAX_WIDTH_PX'
    const stripped: Record<LegName, string> = {
      ...LEG_SRC,
      'miniapp-taro': LEG_SRC['miniapp-taro'].replaceAll(onlyMiniTier, '__gone__'),
    }
    expect(
      phantomTierProblems({ legSrcs: stripped, specExports: exports }).length,
      '摘掉唯一消费腿后幻影判据仍绿 ⇒ 它其实只看了 import 面',
    ).toBeGreaterThan(0)
  })

  it('⑫ B 类机制对:同一卡顶内距两端各一档且必须不同值(拉平 = 破一端版 ⇒ 红)', () => {
    expect(MECHANISM_TIER_PAIRS.length, '机制对清单空了 ⇒ 这条尺子没在测任何东西').toBeGreaterThan(
      0,
    )
    expect(
      mechanismPairProblems(LEG_SRC, TIER_VALUES),
      '机制对判据被破坏(档被删/拉平/无人消费)',
    ).toEqual([])
    // 变异:把抽屉顶距改成 24(与居中卡拉平)⇒ 必须红。
    const flattened = new Map(TIER_VALUES)
    flattened.set('LOGIN_POPUP_SHEET_PADDING_TOP_PX', 24)
    expect(
      mechanismPairProblems(LEG_SRC, flattened).length,
      '把两端顶距拉平后判据仍绿 ⇒ 锁只认"每枚只在各自端",拦不住凑平',
    ).toBeGreaterThan(0)
  })

  it('⑬ 端内未具名档:40px 只在小程序(不得入 spec、出处仍在)', () => {
    expect(UNNAMED_END_TIERS.length, '未具名档表空了 ⇒ 这条尺子没在测任何东西').toBeGreaterThan(0)
    expect(
      unnamedEndTierProblems({ legSrcs: RAW_LEG_SRC, values: TIER_VALUES }),
      '端内未具名档归属被破坏(入表 / 另一端补元素 / 出处消失)',
    ).toEqual([])
  })

  it('⑭ 本锁有牙:未具名档入 spec 或往 RN 补锚点 ⇒ ⑬ 必须红', () => {
    const inflated = new Map(TIER_VALUES)
    inflated.set('LOGIN_POPUP___PROBE_LOGIN_FIELD_HEIGHT_PX', 40)
    expect(
      unnamedEndTierProblems({ legSrcs: LEG_SRC, values: inflated }).length,
      '把 40 收进 spec 后判据仍绿 ⇒ 锁拦不住"单端档入表"(门 128 SL 会新增判红)',
    ).toBeGreaterThan(0)

    const padded: Record<LegName, string> = {
      ...RAW_LEG_SRC,
      'mobile-rn': `${RAW_LEG_SRC['mobile-rn']}\nconst __probe = 'login-field'\n`,
    }
    expect(
      unnamedEndTierProblems({ legSrcs: padded, values: TIER_VALUES }).length,
      '往 RN 补 login-field 锚点后判据仍绿 ⇒ 锁拦不住"给单端补元素凑平"',
    ).toBeGreaterThan(0)
  })

  it('⑮ spec 导出面 = 共用档 ∪ 单端档(不多不少,防漏登/多登)', () => {
    const single = [...TIER_VALUES.keys()]
      .filter((t) => !(CROSS_END_TIERS as readonly string[]).includes(t))
      .sort()
    expect(
      single,
      'spec 导出面里出现了既不在 CROSS_END_TIERS 也不在 SINGLE_END_TIERS 的档 ⇒ 新增档必须归属',
    ).toEqual(SINGLE_END_TIERS.map((x) => x.tier).sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
