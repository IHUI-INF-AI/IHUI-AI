// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 圆角**角色档一致性**对账 —— 「这一类元素该取哪一档」的第一把尺子。
//
// 立因(为什么必须新起一道门,而不是把守门 77 改严):
//  `packages/design-tokens/src/radius.js` 的 `RADIUS_STEPS` 只把档位**值**收成一份;
//  2026-09-27 新增的 `RADIUS_ROLES` 才第一次写下「card→lg / control→sm / chip→md /
//  panel→xl / hero→2xl / tiny→xs」这张**角色 → 档位**表。但表落地当天只有 AGENTS §4 一句
//  散文约束,没有任何判据问过「一枚卡片是不是取了 card 档」。守门 77 判的是「有没有绕开档位表
//  写死数字」—— 两端各自规矩地引用 token 时它一路报绿(HEAD 面实测 0 违规),所以
//  「同一个元素两端各按直觉选档」这一型**两台尺子互相指认、无人看守**,即用户实拍
//  「App 端、小程序端还有那么多容器圆角没按 token」的成因。本门补的就是这一格。
//
// 判据四条(缺一不可,任一条单独用都会满天假红):
//  C1 **取用形态**:七类写法全部要看见(含 `rounded-t-xl` 方向形态、`rnRadius['2xl']` 括号形态、
//     `borderRadius: '8px'` 字符串形态、CSS `border-radius: 8px 8px 0 0` 四值简写与方向变体)
//     —— 方向形态是既有解析的实测盲区,本门不得复制它。
//  C2 **类别证据**:角色只由证据推出(形态自带 `rnRadiusFor.<role>` / 同条声明的 `RADIUS_ROLES.<role>`
//     / 样式键·CSS 类·JSX 组件·className 的**头词元**命中角色词元表),**不做语义猜**。
//  C3 **档位比**:实际 px 与该角色的应有 px 比(两数都来自被审面上的那张表,门内零抄表)。
//  C4 **包含关系优先于名字**(2026-09-28 立,`scripts/lib/jsx-scope.mjs` + `classifySurfaces`):
//     一个元素自称 card、而它的祖先链上第一个给出类别信号的是**模态载体**(`<Modal>` / `<*Popup>` /
//     遮罩键 `overlay|backdrop|StyleSheet.absoluteFill`)⇒ 它是**模态面**,按 panel 判而非 card。
//     立因是实测:四个 RN 模态件与小程序 `.pp-card` 都把弹窗本体命名为 `card:` —— 按名字判就是在
//     要求给模态面补一个卡片档圆角(拿尺子改设计)。反向条件同时成立才算面:往外先撞上另一张
//     card ⇒ 那是模态内容里的卡片,仍按 card 判;同一个键既当过面又当过卡 ⇒ `contested`,**不改判**
//     只报名(两边各有一半是错的,猜哪边都是假账)。
//     证据分级同批收紧:属性区跨行的开标签(`<select` 在 119 行、`className=` 在 122 行)现在认得出
//     "这行属于哪个元素" ⇒ 元素自己的标签是强证据,祖先标签不再混进同一集合(HEAD 实测 5 处
//     `role-conflict` 由此消解;`z-popover` 这类**层叠档名**也不再冒充类别)。
//
// 三态与诚实性(本仓最高频失效型就是"把没判写成判过了"):
//  · 判红 = 一条元素有**恰好一个**类别信号、档位表读得出该角色、而实际档 ≠ 应有档;
//  · 未判定 = 同一条上出现**多个**类别信号(冲突)/ 角色或档位名查表落空 / 值不在档位表上
//    —— **逐条报名**,`--strict` 下有未判定即 exit 2(拒绝出具合格证);
//  · 不在射程 = 取用存在但**没有任何**类别信号(匿名块、utility 串里没有角色词元)——
//    它既不是"判过"也不是"判不出",结论行按第四个数字单列,`--all` 可逐条列出。
//    把这一格并进"未判定"会造出一台永远洗不清的恒红门,并进"通过"就是把没判写成判过了。
//
// 存量不得判红(立门即恒红是本仓最高反面教训,唯一结局是逼人绕过钩子、连带全部守门作废):
//  棘轮锚点 = **该文件 HEAD 自身的「文件 × 角色」违规数**,键粒度到角色为止 —— 只到文件层的
//  锚点会让"把一处 card 改成 control 写法"净零逃逸(守门 134 扩布尔档键时同一课)。
//
// 人工出口 `radius-role-exempt: <原因>`:必须带原因(裸标记、以及"裸标记 + 注释闭合符冒充原因"
//  都不放行),且只在命中行或其紧邻上一行生效。30 天存活期由守门 108 管 —— **须由主会话把
//  `radius-role-exempt` 登记进 `FAMILY_LIFETIME_DAYS`,本票不改那个文件**(并行改注册表必互撞)。
//
// ⚠️ 本门**刻意不自行接进提交链**:注册表由主会话单写(门 93/128 记过同型覆盖事故)。
//    接线条目建议值(编号请现读空闲号,勿照抄本文):
//      id: <当次空闲号>, mode: 'blocking', skipEnv: 'HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE',
//      script: 'scripts/check-radius-role-conformance.mjs',
//      stagedTriggers: ['apps/', 'packages/'],   // 圆角取用可发生在任意 UI 路径,收窄会放过整类
//    接线前置:① 首次入锚(--emit-baseline 的产物进 scripts/radius-role-conformance-baseline.json,
//    与门体**同枚**提交 —— 注册指向不存在的脚本/台账是 README 门那晚的事故);② HEAD 面默认档 exit 0。
//    接线后必须复验**落在哪个数组**:runner 的迭代入口是 `pushGate ? pushGateChecks : checks`,
//    实测本门第一次被并进的是 pushGateChecks —— grep 注册表查得到、全量批 180 道门里没有它,
//    这种"装在另一条链上"的形态比没装更难发现(镜像 T1 现在钉的就是这一条)。
//
// 用法:
//   node scripts/check-radius-role-conformance.mjs                # 全量(HEAD blob),存量不判红
//   node scripts/check-radius-role-conformance.mjs --staged       # 索引 blob(提交链用)
//   node scripts/check-radius-role-conformance.mjs --strict       # 有未判定 ⇒ exit 2(拒绝出合格证)
//   node scripts/check-radius-role-conformance.mjs --json         # stdout 只有 JSON
//   node scripts/check-radius-role-conformance.mjs --all          # 连"不在射程"那格也逐条列出
//   node scripts/check-radius-role-conformance.mjs --files <a> <b>  # 按文件自验(仍判被审面)
//   node scripts/check-radius-role-conformance.mjs --emit-baseline  # 重出锚点(只允许下降)
//   node scripts/check-radius-role-conformance.mjs --self-test    # 判据自检(含真仓阳性对照)
//   人工排查:--worktree(会大声打印"正在按磁盘判",不得作为结论)
//
// @ts-check

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { isRadiusExemptAt, radiusLookup, blockOwnerOf, constantMapOf } from './lib/radius-tokens.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { scanJsx, hasJsxShape } from './lib/jsx-scope.mjs'
import { boxDims, objectDims, boxDimsOwn, halvedSideVerdict } from './lib/box-geometry.mjs'
import {
  CORNER_NAMES,
  ROLE_STEMS,
  classStringsInLine,
  identityEvidenceInLine,
  classifySurfaces,
  headToken,
  isRoleExemptAt,
  isModalTag,
  isOverlayName,
  declarationRanges,
  maskFaces,
  radiusFormsInLine,
  ownerOfLine,
  roleSpec,
  rolesInTable,
  rolesOfClassList,
  rolesOfName,
  stepNameForPx,
} from './lib/radius-roles.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RADIUS_TABLE_REL = 'packages/design-tokens/src/radius.js'
const BASELINE_REL = 'scripts/radius-role-conformance-baseline.json'
/**
 * 胶囊的形状维哨兵角色 —— 锚点键不能落 `文件|undefined`(理由见判定处那条)。
 * 它刻意不是一个真实角色档:`roleSpec(table, CAPSULE_ROLE)` 取不到档,所以这条永远不会被
 * 当成"应有档 X"去比对 —— 形状一旦成立,档位问题就不再是它的问题。
 */
const CAPSULE_ROLE = 'capsule'
/**
 * 真仓阳性对照的取材 ref —— **钉清偿前的出处提交,不钉 HEAD**:账还完那天"HEAD 上还能量到这条违规"
 * 这条前提当场失效,阳性对照会跟着一起消失而自检照绿(票㉗ 由镜像 T18 钉死;票㉘ 用例 69 又踩一次)。
 * 可用 env 覆盖,便于出处搬家时不改代码。
 */
const PROBE_REF = process.env.IHUI_RADIUS_PROBE_REF || 'acf1927e96'
/**
 * 短边达到这个数才算可点/可读的盒子,细于它的是 §4 保护的装饰族(进度条 4px、骨架行 12px、
 * 指示点 6px)—— 那些形态任何档位半径都会两端全圆,判红等于逼设计改方角。
 */
const CAPSULE_MIN_SHORT = Number(process.env.IHUI_CAPSULE_MIN_SHORT || 16)
const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(磁盘)' }

/**
 * 扫描面 = 会**渲染界面**的源码。
 *  - 只走 `git ls-tree`/`ls-files`,不按磁盘枚举(共享工作树常年滞后 HEAD,且并行会话的
 *    半编辑态会把别人的在飞现场算成本仓债务 —— 守门 70/77/83 同取向);
 *  - 排除目录经 `isExcludedDirName` 与下方 TEST_RE 两轨;
 *  - OUT_OF_SCOPE 是**报名式**排除:每条带 why。没有这一格,"我没扫到"和"我声明不扫"
 *    就长得分不开,新增一个端等于静默绕开整道门(守门 77 的判据 C 同一条理由)。
 */
const UI_EXT = /\.(tsx|jsx|ts|js|css|scss|less)$/
const TEST_RE = /(^|\/)(?:tests?|__tests__|e2e|test)\//
const SPEC_RE = /\.(test|spec)\.[cm]?[jt]sx?$/
const GEN_RE = /(\.gen\.|\.generated\.|(^|\/)generated\/)/

export const OUT_OF_SCOPE = [
  {
    re: /^packages\/design-tokens\//,
    why: '档位表与派生副本自身(radius.js / tokens.css / rn-tokens.ts),真值一致性归守门 77 的 A 判据',
  },
  { re: /^packages\/i18n\//, why: '语言包与其构建产物,不渲染界面' },
  { re: /^packages\/database\//, why: 'schema 与迁移,不含 UI' },
  { re: /^packages\/types\//, why: '跨端类型声明(.d 语义),取值形态不是界面取用' },
  { re: /^apps\/api\//, why: '后端;swagger 主题等生成式 CSS 已由守门 77 的 B3 覆盖,本门判的是元素类别,后端无此概念' },
  { re: /^apps\/ai-service\//, why: 'Python 服务与发布内容渲染,不属"这个界面元素该取哪档"的射程' },
  { re: /(^|\/)(static|assets|public)\/.*\.(svg|png|jpg|jpeg|gif|webp)$/, why: '静态美术资产,rx/ry 是图形轮廓不是容器圆角' },
]

/** 角色词元表 ↔ 档位表 的对账(名单类判据必须能被自己发现腐烂)。 */
export function roleTableProblems(table) {
  const inTable = new Set(rolesInTable(table))
  const stemRoles = Object.keys(ROLE_STEMS)
  const problems = []
  for (const r of stemRoles) if (!inTable.has(r)) problems.push(r)
  return problems
}

/**
 * 单文件 → 三态结果(纯函数,夹具与被真仓 blob 都能喂,自检因此可端到端)。
 *
 * @param {string} rel 仓库相对路径(只用于点名)
 * @param {string} src 该文件在**被审面**上的正文
 * @param {Record<string, number>} table radiusLookup 的产物
 */
export function auditFileText(rel, src, table) {
  const out = {
    violations: [],
    undetermined: [],
    unclassified: [],
    weakFindings: [],
    compliant: 0,
    exempted: 0,
    usages: 0,
    surfaceOverrides: 0,
    componentEvidence: 0,
    identityEvidence: 0,
    componentUndetermined: [],
    /** C6 胶囊候选队列(只点名不判红,升级前置见判定处注释) */
    capsuleFindings: [],
    scopeFallback: 0,
    scopeAmbiguous: 0,
    scopeCorrupt: 0,
    contested: [],
    /**
     * C6 几何定性(票㉚)的三个计数:
     *  trueCircle = 正方盒 + 半径取到半边 ⇒ 真圆装饰件(点/红点/圆头像),不在角色档射程;
     *  capsule = 非正方盒 + 半径取到半边 ⇒ **胶囊**,判红且**不吃任何豁免标记**;
     *  dimsUndetermined = 有圆角取用但量不出盒形 ⇒ 只报名(不得静默算通过)。
     */
    trueCircle: 0,
    capsule: 0,
    /** 圆头端点(细于物理下限的两端全圆):出射程、不判红,但必须计数报名 —— 它与真圆不是一回事。 */
    roundedEnd: 0,
    dimsUndetermined: 0,
    exemptionIgnored: 0,
  }
  const rawLines = src.split('\n')
  // 注释与字符串的抹法只有一份实现(lib/code-mask.mjs);本门要的两面都由它派生(见 radius-roles)。
  const { code, kept, strings } = maskFaces(src)
  /**
   * 除法形态半径(`60 / 2`、`VOICE_BTN_SIZE / 2`)的被除数常量**多数定义在同一份文件里**,
   * 所以按整份源码归集一次供逐行使用;跨文件 import 的常量解不到,由除法支落一条
   * `undivided` 记录、本门按「未判定」报名(不得让这一行从账面上消失)。
   */
  const consts = constantMapOf(src)
  const codeLines = code.split('\n')
  const keptLines = kept.split('\n')
  /**
   * C4 的输入:**元素作用域**。只在"这一面里确实有 JSX"时才解析(纯 CSS / 纯 TS 不必付这个钱);
   * 解析器判不出归属的行一律**退回旧逐行判序**并计 `scopeFallback` —— 解析失败不得被读成
   * "这个元素没有祖先"(那会把判不出写成判过了,本仓最高频失效型)。
   */
  let scope = null
  let surfaces = null
  if (hasJsxShape(kept)) {
    scope = scanJsx(kept, { strings })
    // C4 只在**浮层组件自己的文件**里启用(理由见 classifySurfaces 头注:页面文件里的 `<Card>`
    // 是对话框内容区的数据卡,不是浮层体 —— 一律启用会造出假阳与 contested 死锁)
    const base = rel.split('/').pop() || ''
    const stemName = base.replace(/\.[^.]+$/, '')
    // 浮层身份用**同一套词表**(MODAL_TAG_SUFFIXES / OVERLAY_KEY_STEMS)判定 ——
    // 面板词干里刻意没收 'popup'(它是标签后缀不是角色词干),各写一份就会漏掉 LoginPopUp 这类真目标
    const modalFile = rolesOfName(stemName).includes('panel') || isModalTag(stemName) || isOverlayName(stemName)
    surfaces = classifySurfaces(scope.elements, { roleOf: rolesOfName, modalFile })
    out.scopeCorrupt = scope.corrupt
    for (const k of surfaces.contestedKeys) out.contested.push({ file: rel, key: k })
  }
  /**
   * **组件名档**证据(C5,2026-09-28 由 HEAD 唯一一处 `role-conflict` 逼出):
   * 一个组件的名字说的是**它自己那棵 JSX 树的根容器**,不是文件里每个元素,也不是内联小组件的外层名字 ——
   * 所以归属走 `declarationRanges()`(code 面括号配平出的行区间)+ `ownerOfLine()`(取最内层)。
   * 只在该行**确实是 JSX 根**(没有 JSX 祖先)时启用;它压在元素自身名字之后、颜色实用类之前:
   * `plan-review-panel.tsx` 的根 `<div className="rounded-xl border bg-card">` 里,`bg-card` 说的是
   * 背景档,而 `PlanReviewPanel` 说的是"这是什么" —— 名字赢,判 panel,`xl` 合规。
   * 归属判不出(不在任何区间 / 名字给不出唯一角色)⇒ **不启用**并计数报名,绝不猜一档。
   */
  const declRanges = declarationRanges(code)
  const rolesOfOwner = (line) => {
    const own = ownerOfLine(declRanges, line)
    if (!own) return null
    const set = new Set(rolesOfName(own.name))
    return set.size === 1 ? { roles: set, name: own.name } : null
  }
  /** @type {{names: string[], indent: number}[]} */
  const stack = []
  let pending = ''
  for (let i = 0; i < keptLines.length; i++) {
    const line = keptLines[i]
    const t = line.trim()
    if (!t) continue
    const indent = line.length - line.trimStart().length
    const closer = /^[})\]]/.test(t)
    if (closer) while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    let names = stack.length ? stack[stack.length - 1].names : []
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/[}\]]/g) || []).length
    if (opens > 0) {
      /**
       * 一行里可能有**多个** `{`(`const s = { card: { borderRadius: rnRadius.xl } }`),
       * 归属必须逐次重算并让**最后一个** `{` 的拥有者生效 —— 只取第一个会把整行的取用
       * 记到外层 `s` 头上,而 `s` 不是角色名 ⇒ 该族静默落"无类别证据"。
       * 实测这条就是第一版自检里 5 个"卡片判红"用例全绿的原因(判据看不见嵌套层)。
       */
      let prelude = pending
      pending = ''
      let from = 0
      let k
      while ((k = line.indexOf('{', from)) >= 0) {
        const seg = (prelude + ' ' + line.slice(from, k)).trim()
        /**
         * 一行里有**多个** `{` 时,最后一个 `{` 的主人整行生效(见上面注释与自检 55c):
         * 紧凑单行声明 `create({ backdrop: {…}, card: {…} })` 里,最后一个 `{` 之前的尾巴是
         * ` flex: 1 }, ` —— 取不到 `card` 这个主人,于是这一行**落"无类别证据"**(如实报数),
         * 而不是被安到一个猜出来的主人头上。刻意不去"修好"它:把尾巴切掉会让最后一个键
         * (`overlay`)冒充前一个取用(`card`)的主人 —— 那是把"判不出"换成"判错",
         * 而判错的代价是逼人改一个本来对的东西(假阳比漏报更贵,门 118 记过)。
         * 真仓的样式声明绝大多数是一行一键,这一格只影响压行的写法。
         */
        const owner = blockOwnerOf(seg)
        if (owner.names.length) names = owner.names
        prelude = ''
        from = k + 1
      }
      if (closes < opens) stack.push({ names, indent })
    } else if (!closer && /^\.{1,2}[A-Za-z_]/.test(t)) {
      pending = (pending + ' ' + t).slice(-400)
      continue
    } else if (!closer) {
      pending = ''
    }
    const forms = radiusFormsInLine(line, table, consts)
    if (!forms.length) continue
    out.usages += forms.length
    /**
     * C6 · 几何定性,**排在豁免判定之前** —— 形状是量出来的事实,不是一个可以被谁豁免掉的偏好。
     * 半径取到短边一半时只剩两种形状:正方盒 ⇒ **真圆装饰件**(点 / 红点 / 圆头像 / 编辑徽标),
     * 它从来不在"容器该取哪一档"的射程里(旧写法给人挂 `radius-role-exempt` 标记,共 8 处 ——
     * 标记既掩盖真形也拦不住回潮);非正方盒 ⇒ **胶囊**,正是用户点名要根除的形态,零豁免。
     *
     * 取属性区分两路:JSX 行走**该元素自己的**属性区(`boxDimsOwn`,不确定闭合就不判),StyleSheet / CSS 行走**所属对象内部**
     * (`objectDims`)。拿 JSX 窗口去量 StyleSheet 会 blead 邻行尺寸 —— 实测把一枚 8×8 圆点
     * 量成 40×8 并报成胶囊;假阳比漏报贵,它指使人去改本来对的东西。
     * 量材的文本用**原文**:`w-[690rpx]` / `width: 8` 常常就写在 className 字符串里,遮罩面看不见。
     */
    const gd = (() => {
      const gi = scope ? scope.byLine.get(i + 1) : undefined
      if (gi && !gi.ambiguous) {
        /**
         * 两把尺子,方向不同,不许互换:
         *  - `wide`(宽窗)只用于**圆点排除**。它可能把父子的尺寸混在一起,但那最多让一个真圆装饰件
         *    少一次豁免性归类、退回角色档比对(= 本门改前的既有行为),不会凭空造出红点之外的红。
         *  - `own`(窄窗,必须能确定开标签闭合)才用于**胶囊判红**。宽窗会把 `<Icon className="h-4 w-4">`
         *    算进父盒(HEAD 现读 14 处候选里 9 处就是这么假阳的);而没有 JSX 词法器时"找闭合"又会把
         *    `[&>svg]`、字符串里的 `>` 读断 —— 判红一侧只用它,不确定就计入 dimsUndetermined(报名不判)。
         */
        const own = boxDimsOwn(rawLines, i, consts)
        const wide = boxDims(rawLines, i, consts)
        return { own: own.confident ? own : null, wide }
      }
      const o = objectDims(rawLines, i, consts)
      return { own: o, wide: o }
    })()
    const shortOf = (d) =>
      d.shape === 'square' || d.shape === 'wide'
        ? Math.min(d.w || Number.POSITIVE_INFINITY, d.h || Number.POSITIVE_INFINITY)
        : Number.NaN
    const ownShort = gd.own ? shortOf(gd.own) : Number.NaN
    const wideShort = shortOf(gd.wide)
    /** 宽窗只用于"正方真圆"的排除(方向性理由见上)。 */
    const isTrueCircle = (f) =>
      Number.isFinite(f.px) &&
      Number.isFinite(wideShort) &&
      gd.wide.shape === 'square' &&
      f.px >= wideShort / 2
    /**
     * 胶囊判红的三个必要条件,缺一即只进队列:
     *  ① 属性区能确定闭合且量出**非正方**盒 —— 否则父子尺寸混在一起,菜单/按钮会被量成细条;
     *  ② 短边 ≥ `CAPSULE_MIN_SHORT` —— 细于它的(进度条 4px、骨架行 12px、指示点 6px)在 §4 里属于
     *     "不得方档化把形状改坏"的装饰族,任何档位半径都会让它两端全圆,判红等于逼设计改成方角;
     *  ③ 半径 ≥ 短边一半。
     */
    const geomShort = Number.isFinite(ownShort) ? ownShort : wideShort
    const halfHit = (f) => Number.isFinite(f.px) && Number.isFinite(geomShort) && f.px >= geomShort / 2
    const capsuleWide = (f) => !!gd.own && gd.own.shape === 'wide' && halfHit(f)
    const capsuleRed = (f) => capsuleWide(f) && ownShort >= CAPSULE_MIN_SHORT
    if (!gd.wide.shape && !(gd.own && gd.own.shape)) out.dimsUndetermined += 1
    const marked = isRoleExemptAt(rawLines, i) || isRadiusExemptAt(rawLines, i)
    const capsuleHere = forms.some(capsuleRed)
    if (marked && capsuleHere) out.exemptionIgnored += forms.length
    if (marked && !capsuleHere) {
      out.exempted += forms.length
      continue
    }
    /**
     * 证据分强弱,强弱不可混判(实测理由,不是偏好):
     *  - **强**:样式键 / CSS 类选择器 / JSX 组件标签 / 形态自带的 `rnRadiusFor.<role>` ——
     *    都是**作者给这个元素起的名字**,他说得出这是什么。
     *  - **弱**:`className` 串里的颜色实用类(`bg-card`、`text-panel` …)。它写的是**色档**,
     *    不是容器身份 —— 实测 `<button className="bg-card … rounded-md">`(退出登录按钮)
     *    被按"卡片应为 lg"判红,就是拿一个颜色名去要求改按钮圆角。**假阳比漏报更贵**:
     *    它指使人去改一个本来对的东西(门 118 记过同一课)。
     * 所以:有强证据时只用强证据;只有弱证据时**照判但只点名不判红**(单列一栏交人裁)。
     * 这样 DrawerComponent 的 `rounded-t-xl` 仍被点名(阳性对照成立),而颜色类名不再造红。
     */
    /** @type {Set<string>} */
    const strong = new Set()
    /** @type {Set<string>} */
    const weak = new Set()
    for (const n of names) for (const r of rolesOfName(n)) strong.add(r)
    const codeLine = codeLines[i] || ''
    /**
     * 这一行落在某个元素的**开标签区间**里 ⇒ 该元素自己就是取证对象:它的标签名与它应用的
     * 样式键都是作者给**这个元素**起的名字(强证据),而祖先不再混进同一个集合。
     * 归属不明(区间并列 / 解析器失配)⇒ 退回旧的"整行抓 `<Tag`",并计一次 scopeFallback:
     * 旧行为继续有效,新判据只在不明的地方不生效,这样覆盖面扩大不会把任何人已有结论顶红。
     */
    const info = scope ? scope.byLine.get(i + 1) : undefined
    let thisElementIsSurface = false
    const isJsxRoot = !!(info && !info.ambiguous && (info.ancestors?.length || 0) === 0)
    /** 组件名档按**最内层声明**归属 ⇒ 同文件内联的小组件不会被外层名字顶判 */
    const compOwner = isJsxRoot ? rolesOfOwner(i + 1) : null
    if (info && !info.ambiguous) {
      for (const r of rolesOfName(info.selfName)) strong.add(r)
      for (const k of info.keys) for (const r of rolesOfName(k)) strong.add(r)
      thisElementIsSurface = surfaces ? surfaces.surfaceIdx.has(info.self) : false
    } else {
      if (info) out.scopeAmbiguous++
      let flatTags = 0
      for (const m of codeLine.matchAll(/<([A-Za-z][\w.]*[-\w.]*)/g)) {
        flatTags++
        for (const r of rolesOfName(m[1].split(/[./]/).pop() || '')) strong.add(r)
      }
      // 只在这一行**真的**靠整行抓到了标签时才计退回:否则每一行 StyleSheet 声明都会被算成
      // "容器维没生效",读数会大得没有意义(报数也要报得能看懂)。
      if (flatTags && scope) out.scopeFallback++
    }
    const classText = classStringsInLine(codeLine, rawLines[i] || '').join(' ')
    if (classText) for (const r of rolesOfClassList(classText)) weak.add(r)
    /**
     * 身份通道(票㉘)。**先并进 strong,但只在该行还没有元素级强证据时定音** ——
     * 标签名/样式键是比 aria/testid 更贴身的名字,顺序不能倒;而它必须压过颜色档(weak),
     * 否则 「bg-card」 会一直把浮层顶成卡片(票㉖ 那唯一一处 role-conflict 的真实成因)。
     */
    const ident = identityEvidenceInLine(codeLine, rawLines[i] || '')
    if (ident.roles.size) {
      out.identityEvidence++
      if (!strong.size) for (const r of ident.roles) strong.add(r)
    }
    /**
     * "组件名判不出"的报名**必须排在身份通道之后** —— 身份已经给出类别的行再报一次
     * "组件名判不出"是同一格计两遍债,读数会被读成两倍待办(本仓"报数也要报得能看懂"那条)。
     */
    if (isJsxRoot && !compOwner && !strong.size && !ident.roles.size && !forms.some((x) => x.role)) {
      const own = ownerOfLine(declRanges, i + 1)
      if (own) out.componentUndetermined.push({ file: rel, line: i + 1, owner: own.name })
    }
    const ownerName = names.length ? names[names.length - 1] : null
    const keyIsSurface = !!(surfaces && ownerName && surfaces.surfaceKeys.has(ownerName))

    for (const f of forms) {
      const rec = { file: rel, line: i + 1, form: f.form, kind: f.kind }
      if (f.dir || typeof f.slot === 'number') {
        const corner = f.dir || CORNER_NAMES[f.slot] || ''
        if (corner) rec.corner = corner
      }
      // 形态自带角色时它是唯一权威(写 `rnRadiusFor.panel` 的人已经把类别说清楚了)
      let roles
      let evidence
      if (f.role) {
        roles = new Set([f.role])
        evidence = 'declared'
      } else if (strong.size) {
        roles = strong
        evidence = 'strong'
      } else if (compOwner) {
        roles = compOwner.roles
        evidence = 'component'
        rec.via = 'component'
        rec.owner = compOwner.name
        out.componentEvidence++
      } else if (weak.size) {
        roles = weak
        evidence = 'weak'
      } else {
        roles = new Set()
        evidence = 'none'
      }
      /**
       * C4:自称 card 而容器给出的是模态面 ⇒ 按 panel 判。
       * 只在**恰好一个** card 信号时生效:角色已经冲突时改判等于替人挑一个(那才是假账)。
       */
      if (evidence !== 'declared' && roles.size === 1 && roles.has('card') && (thisElementIsSurface || keyIsSurface)) {
        roles = new Set(['panel'])
        evidence = 'surface'
        rec.via = 'surface'
        out.surfaceOverrides++
      }
      if (evidence === 'declared') rec.declared = true
      else if (evidence === 'weak') rec.evidence = 'weak'
      /**
       * C6 的两条几何结论,排在 off-scale **之前**。顺序不是审美,是这一族能不能被看见的唯一决定因素:
       * 真圆与胶囊的半径天然等于"边长的一半"(30 / 28 / 32 / 24…),而档位表只有
       * 2/4/6/8/12/16 —— 所以**这种值必然 off-scale**。旧判序先判 off-scale 并 continue,
       * 于是所有真圆与胶囊候选都在这一步退出,`capsule=0` 从来不是"项目里没有胶囊",
       * 而是"所有候选都没走到判胶囊那一步"。形状一旦成立,再比档位已经没有意义。
       *  (计 trueCircle,不判红也不计合规 —— 这一格替掉的是原先人挂的 `radius-role-exempt` 标记。)
       */
      /**
       * 先问**字面同形**:`width: VOICE_BTN_SIZE` 配 `borderRadius: VOICE_BTN_SIZE / 2` 是把推导
       * 写在源码里的,与常量取什么值无关。纯数值路线(`f.px` + `gd.shape`)对跨文件常量两头落空,
       * 于是同一行在守门 77 判 capsule、在本门判不出 —— 两台尺子互相指认,那一格没人看守。
       * 字面路线给出结论就直接采用,不再退回去猜数值。
       */
      const lv = f.radiusText ? halvedSideVerdict(rawLines, i, f.radiusText) : null
      if (lv === 'circle') {
        out.trueCircle += 1
        rec.circle = true
        rec.via = 'literal-half-side'
        continue
      }
      if (lv === 'rounded-end') {
        /**
         * 细于物理下限的**圆头端点**(进度条 / 骨架行 / 指示点):§4 明令装饰族不得方档化,
         * 对它判红等于逼设计改方角。但它**不是真圆**(形状是胶囊的两端),所以不能并进 trueCircle ——
         * 并进去就等于把"两端全圆的细条"记成"圆点",下一个人按圆点处置会把它改成方角。
         */
        out.roundedEnd += 1
        rec.end = true
        continue
      }
      if (isTrueCircle(f)) {
        out.trueCircle += 1
        rec.circle = true
        continue
      }
      if (lv === 'capsule' || capsuleRed(f)) {
        out.capsule += 1
        rec.reason = 'capsule'
        rec.detail = `盒 ${gd.own.w || '?'}×${gd.own.h || '?'} / 半径 ${f.px} ≥ 短边一半 ⇒ 胶囊型(本项目不允许,且不吃豁免)`
        /**
         * 判红要三个条件同时成立(见 `capsuleWide` / `CAPSULE_MIN_SHORT`):属性区闭合可确定、
         * 盒形非正方、短边 ≥ 16。这是票㉚ 那条前置的落地 —— 宽窗会把子节点 `h-4 w-4` 算进父盒
         * (HEAD 现读候选里大半就是这么假阳的),所以判红一侧只认窄窗;窄窗不确定就计"未判定"
         * 报名。短边细于 16 的只进队列不判红 —— §4 明令进度条/骨架行/指示点"不得方档化把形状改坏",
         * 对它们判红等于逼设计改方角,那是拿尺子改设计。
         * 最后一道分档同理:**只有颜色弱证据**(类别是从 `bg-card` 这类实用类推出来的)仍进
         * 队列不判红 —— 实测拿 `bg-card` 冒充按钮那一型判红就是把人往错方向推,与"低置信只开
         * 队列"那条一致。两种情形都不吃豁免标记:标记是人的断言,形状是量出来的事实。
         */
        if (evidence === 'weak') out.weakFindings.push(rec)
        else {
          /**
           * 胶囊是**形状维**,不是语义角色。判序把它提到类别检查之前之后,`rec.role` 还没赋值,
           * 直接入账会得到锚点键 `文件|undefined` —— undefined 桶是公共垃圾桶:任何新胶囊都往
           * 同一个键里塞,第一个人的红替所有人付了(门 134 的 BK1"锚点粒度不够 ⇒ 换个写法净零
           * 逃逸"同一课)。给它一个显式哨兵,键就是 `文件|capsule`,同族内按数量套棘轮。
           */
          rec.role = rec.role || CAPSULE_ROLE
          out.violations.push(rec)
        }
        continue
      }
      /**
       * 数值解不到 ⇒ 未判定。**必须排在字面同形路线之后**:`width: VOICE_BTN_SIZE` 配
       * `borderRadius: VOICE_BTN_SIZE / 2` 的常量来自跨文件 import,本门拿不到它的值(f.px 为 null),
       * 可"分子与边长逐字同形"本身就是作者写下的证明,与数值无关。把它排在前面,等于让这条证明
       * 永远没机会说话 —— 自检 89 第一版就是这么红的(承诺的补位路线被上一步 continue 掉)。
       * 这一格也**必须单列理由**:它与"档位名拼错"是两种缺陷,前者是尺子够不到(该扩射程),
       * 后者是代码写错(该改代码);合成一条,报告就再也说不清该由谁修。
       */
      if (f.px === null || !Number.isFinite(f.px)) {
        rec.reason = f.undivided
          ? 'divide-operand-unknown'
          : f.kind === 'role'
            ? 'role-not-in-table'
            : 'unknown-step'
        rec.detail = f.undivided
          ? `半径写成 ${f.undivided} / 右值,而本门解不到该被除数的值(常量来自跨文件 import)—— 不得拿被除数凑数`
          : f.role || f.form
        out.undetermined.push(rec)
        continue
      }
      if (capsuleWide(f)) {
        out.capsuleFindings.push(rec)
        continue
      }
      if (f.offScale) {
        rec.reason = 'off-scale'
        rec.detail = `${f.px}px 不在档位表上(绕档归守门 77)`
        out.undetermined.push(rec)
        continue
      }
      if (roles.size === 0) {
        rec.detail = `${f.px}px(${stepNameForPx(table, f.px)})无类别证据`
        out.unclassified.push(rec)
        continue
      }
      if (roles.size > 1) {
        rec.reason = 'role-conflict'
        rec.detail = [...roles].join('/')
        out.undetermined.push(rec)
        continue
      }
      const role = [...roles][0]
      const want = roleSpec(table, role)
      if (!want) {
        rec.reason = 'role-not-in-table'
        rec.detail = role
        out.undetermined.push(rec)
        continue
      }
      rec.role = role
      rec.actualPx = f.px
      rec.actualStep = stepNameForPx(table, f.px)
      rec.expectedStep = want.step
      rec.expectedPx = want.px
      if (f.px === want.px) out.compliant += 1
      else if (rec.evidence === 'weak') out.weakFindings.push(rec)
      else out.violations.push(rec)
    }
  }
  return out
}

/**
 * 锚点键 = `文件|角色`。文件级锚点会被"换个角色写法"净零逃逸绕过(门 134 的 BK1 同一课)。
 */
export function anchorKey(v) {
  return `${v.file}|${v.role}`
}

export function countByKey(violations) {
  const m = {}
  for (const v of violations) {
    const k = anchorKey(v)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

/**
 * 棘轮:`本次计数 > 该键锚点` 才算红。锚点取**被审面的 HEAD/索引台账**,所以
 *  · 存量红不会变成人人跳门(默认档台账里都有锚);
 *  · 别人欠的债不算在本次提交头上(锚点是该文件自身的计数)。
 * 台账缺某个键 ⇒ 视作 0(新增即拦,不留"清单外免判"的空档)。
 */
export function applyRatchet(counts, anchors) {
  const red = []
  for (const [key, n] of Object.entries(counts)) {
    const cap = Number(anchors?.[key] ?? 0)
    if (n > cap) red.push({ key, count: n, cap })
  }
  return red.sort((a, b) => b.count - b.cap - (a.count - a.cap) || a.key.localeCompare(b.key))
}

/**
 * 台账只允许下降或持平;第一次入锚(空台账)除外。
 *
 * **新键带违规同样拒绝**:`--emit-baseline` 是一条命令就能跑的东西,若允许它往已建立的
 * 台账里塞新键,那每一次判红都可以被同一道命令洗成豁免 —— 棘轮就只剩"拦得住没人想起来
 * 重跑台账"的力度了。要把新发现的存量纳进台账,必须人工改 JSON(改动进 diff、可被 review)。
 */
export function anchorRegression(prev, next) {
  const had = Object.keys(prev || {}).length > 0
  if (!had) return []
  const bad = []
  for (const [k, cap] of Object.entries(prev || {})) {
    const n = Number(next?.[k])
    if (!Number.isFinite(n)) bad.push(`${k}:锚点消失(旧 ${cap})`)
    else if (n > cap) bad.push(`${k}:锚点上升 ${cap} → ${n}`)
  }
  for (const [k, n] of Object.entries(next || {})) {
    if (k in prev) continue
    if (Number(n) > 0) bad.push(`${k}:新键带账(${n})—— 台账一经建立只许下调,存量要纳管请人工改并写明理由`)
  }
  return bad
}

export function parseBaseline(text, label) {
  if (text === null || text === undefined) return null
  try {
    const j = JSON.parse(text)
    if (!j || typeof j !== 'object' || !j.anchors || typeof j.anchors !== 'object')
      throw new Error('缺 anchors 字段')
    return j
  } catch (e) {
    throw new Undetermined(`${label}解析失败:${e.message} —— 坏台账不得静默当空锚点用`)
  }
}

/** 清单按面取:`ls-tree` 不认 `--cached`,索引面只能走 `ls-files`;内容与清单**同面同轮**。 */
function listTracked(repoRoot, face) {
  const args = face === 'staged' ? ['ls-files'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  const out = gitRaw(args, repoRoot, {})
  if (out === null || out === undefined) throw new Undetermined(`${FACE_TXT[face]}取不到文件清单`)
  return out
    .split('\n')
    .map((s) => s.trim().replaceAll('\\', '/'))
    .filter(Boolean)
}

export function isInScope(rel) {
  if (!UI_EXT.test(rel)) return false
  if (TEST_RE.test(rel) || SPEC_RE.test(rel) || GEN_RE.test(rel)) return false
  // 排除目录只认共享清单(构建产物 / 依赖 / 副本族)—— 各门自己抄一份 EXCLUDED 是本仓腐烂源头
  const segs = rel.split('/')
  if (segs.some((s) => isExcludedDirName(s))) return false
  // 点开头目录(`.github` 例外:workflow 里也会写样式)已由 isExcludedDirName 覆盖 .cache/.next 族,
  // 这里补的是"任何隐藏目录里的源码不参与 UI 对账"
  if (segs.some((s, i) => i < segs.length - 1 && s.startsWith('.') && s !== '.github')) return false
  return !OUT_OF_SCOPE.some((o) => o.re.test(rel))
}

/**
 * 全量/暂存档的取数与判定:一次 `cat-file --batch` 把**内容 + 档位表 + 台账**同面同轮读满。
 * 任一份取不到 ⇒ 抛 Undetermined(不冒红也不记绿);档位表解析成空 ⇒ 判失明。
 */
export function runAudit(repoRoot, face, { only } = {}) {
  let files = listTracked(repoRoot, face).filter(isInScope)
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    files = files.filter((f) => want.has(f))
    if (!files.length) throw new Undetermined(`--files 指定的路径一个都不在被审面里:${[...want].join(' ')}`)
  }
  if (!files.length) throw new Undetermined(`${FACE_TXT[face]}上枚举到 0 个在射程文件 —— 空扫不记绿`)
  const specs = [...files, RADIUS_TABLE_REL, BASELINE_REL].map((p) =>
    face === 'staged' ? `:${p}` : `HEAD:${p}`,
  )
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  const tableSrc = got.get(face === 'staged' ? `:${RADIUS_TABLE_REL}` : `HEAD:${RADIUS_TABLE_REL}`)
  if (tableSrc === null || tableSrc === undefined)
    throw new Undetermined(`${FACE_TXT[face]}取不到档位表 ${RADIUS_TABLE_REL} ⇒ 本门判据失明`)
  const table = radiusLookup(tableSrc)
  if (!table)
    throw new Undetermined(`${RADIUS_TABLE_REL} 在 ${FACE_TXT[face]} 上解析不出档位表(空表不等于零违规)`)
  const baseSpec = face === 'staged' ? `:${BASELINE_REL}` : `HEAD:${BASELINE_REL}`
  const baselineSrc = got.get(baseSpec)
  const baseline =
    baselineSrc === null || baselineSrc === undefined
      ? { anchors: {}, $note: '台账不在被审面上 —— 本次按"零锚点"判,任何存量都会判红(接线前须先入锚)' }
      : parseBaseline(baselineSrc, BASELINE_REL)
  const violations = []
  const undetermined = []
  const unclassified = []
  const weakFindings = []
  const contested = []
  let usages = 0
  let exempted = 0
  let compliant = 0
  let surfaceOverrides = 0
  let componentEvidence = 0
  let identityEvidence = 0
  const componentUndetermined = []
  const capsuleFindings = []
  let scopeFallback = 0
  let scopeAmbiguous = 0
  let scopeCorrupt = 0
  let trueCircle = 0
  let capsule = 0
  let roundedEnd = 0
  let dimsUndetermined = 0
  let exemptionIgnored = 0
  for (const rel of files) {
    const src = got.get(face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
    if (src === null || src === undefined)
      throw new Undetermined(`${FACE_TXT[face]}取不到 ${rel}(清单与内容必须同面同轮)`)
    const r = auditFileText(rel, src, table)
    usages += r.usages
    exempted += r.exempted
    compliant += r.compliant
    surfaceOverrides += r.surfaceOverrides
    componentEvidence += r.componentEvidence
    identityEvidence += r.identityEvidence
    componentUndetermined.push(...r.componentUndetermined)
    capsuleFindings.push(...r.capsuleFindings)
    scopeFallback += r.scopeFallback
    scopeAmbiguous += r.scopeAmbiguous
    scopeCorrupt += r.scopeCorrupt
    trueCircle += r.trueCircle
    capsule += r.capsule
    roundedEnd += r.roundedEnd
    dimsUndetermined += r.dimsUndetermined
    exemptionIgnored += r.exemptionIgnored
    contested.push(...r.contested)
    violations.push(...r.violations)
    undetermined.push(...r.undetermined)
    unclassified.push(...r.unclassified)
    weakFindings.push(...r.weakFindings)
  }
  return {
    face,
    files,
    table,
    baseline,
    violations,
    undetermined,
    unclassified,
    weakFindings,
    contested,
    usages,
    exempted,
    compliant,
    surfaceOverrides,
    componentEvidence,
    identityEvidence,
    componentUndetermined,
    capsuleFindings,
    scopeFallback,
    scopeAmbiguous,
    scopeCorrupt,
    trueCircle,
    capsule,
    roundedEnd,
    dimsUndetermined,
    exemptionIgnored,
    red: applyRatchet(countByKey(violations), baseline.anchors || {}),
    roleTableProblems: roleTableProblems(table),
  }
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) throw new Undetermined(error)
  return face
}

/** 工作树档:只供人工排查,大声喊,不作为结论(两面旗同给已在 selectFace 里判死)。 */
function runAuditWorktree(repoRoot, only) {
  let files = listTracked(repoRoot, 'head').filter(isInScope)
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    files = files.filter((f) => want.has(f))
  }
  if (!files.length) throw new Undetermined('工作树档枚举到 0 个在射程文件 —— 空扫不记绿')
  const tableSrc = readWorktreeFile(repoRoot, RADIUS_TABLE_REL)
  if (tableSrc === null) throw new Undetermined(`磁盘上取不到 ${RADIUS_TABLE_REL}`)
  const table = radiusLookup(tableSrc)
  if (!table) throw new Undetermined('档位表解析不出内容(空表不判绿)')
  const baseSrc = readWorktreeFile(repoRoot, BASELINE_REL)
  const baseline = baseSrc ? parseBaseline(baseSrc, BASELINE_REL) : { anchors: {} }
  const violations = []
  const undetermined = []
  const unclassified = []
  const weakFindings = []
  const contested = []
  let usages = 0
  let exempted = 0
  let compliant = 0
  let surfaceOverrides = 0
  let componentEvidence = 0
  let identityEvidence = 0
  const componentUndetermined = []
  const capsuleFindings = []
  let scopeFallback = 0
  let scopeAmbiguous = 0
  let scopeCorrupt = 0
  let trueCircle = 0
  let capsule = 0
  let roundedEnd = 0
  let dimsUndetermined = 0
  let exemptionIgnored = 0
  for (const rel of files) {
    const src = readWorktreeFile(repoRoot, rel)
    if (src === null) continue
    const r = auditFileText(rel, src, table)
    usages += r.usages
    exempted += r.exempted
    compliant += r.compliant
    surfaceOverrides += r.surfaceOverrides
    componentEvidence += r.componentEvidence
    identityEvidence += r.identityEvidence
    componentUndetermined.push(...r.componentUndetermined)
    capsuleFindings.push(...r.capsuleFindings)
    scopeFallback += r.scopeFallback
    scopeAmbiguous += r.scopeAmbiguous
    scopeCorrupt += r.scopeCorrupt
    trueCircle += r.trueCircle
    capsule += r.capsule
    roundedEnd += r.roundedEnd
    dimsUndetermined += r.dimsUndetermined
    exemptionIgnored += r.exemptionIgnored
    contested.push(...r.contested)
    violations.push(...r.violations)
    undetermined.push(...r.undetermined)
    unclassified.push(...r.unclassified)
    weakFindings.push(...r.weakFindings)
  }
  return {
    face: 'worktree',
    files,
    table,
    baseline,
    violations,
    undetermined,
    unclassified,
    weakFindings,
    contested,
    usages,
    exempted,
    compliant,
    surfaceOverrides,
    componentEvidence,
    identityEvidence,
    componentUndetermined,
    capsuleFindings,
    scopeFallback,
    scopeAmbiguous,
    scopeCorrupt,
    trueCircle,
    capsule,
    roundedEnd,
    dimsUndetermined,
    exemptionIgnored,
    red: applyRatchet(countByKey(violations), baseline.anchors || {}),
    roleTableProblems: roleTableProblems(table),
  }
}

export function emitBaseline(violations, baseline) {
  const anchors = { ...(baseline?.anchors || {}) }
  const counts = countByKey(violations)
  for (const [k, n] of Object.entries(counts)) anchors[k] = n
  /**
   * 本次读数为 0 的既有族**降到 0 而不是删键**:键消失与"台账被并发旧基线整文件回写"
   * 在账面上长得一模一样,而后者是本仓记过最多次的故障型(守门 83 的 R3 一天被回退三次)。
   * 留 0 同样严格(下次出现 1 处即 1 > 0 判红),但多了一处可核对的痕迹。
   */
  for (const k of Object.keys(anchors)) if (!(k in counts)) anchors[k] = 0
  return {
    $note:
      '圆角角色档一致性锚点(键 = 文件|角色,值 = 该文件该角色在被审面上的存量违规数)。' +
      '只拦"这次改动把该族的绕档加回来了",存量另计批清偿;键消失即视为台账被回写,拒绝落盘。',
    anchors,
  }
}

export function lineOf(v) {
  const corner = v.corner ? `[${v.corner}]` : ''
  return `  ${v.file}:${v.line}${corner} 角色 ${v.role} 取 ${v.actualStep}(${v.actualPx}px),应为 ${v.expectedStep}(${v.expectedPx}px) —— ${v.form}`
}

export async function main(argv = process.argv.slice(2), repoRoot = ROOT) {
  if (argv.includes('--self-test')) return await selfTest(repoRoot)
  const strict = argv.includes('--strict')
  const idx = argv.indexOf('--files')
  const only = idx >= 0 ? argv.slice(idx + 1).filter((a) => !a.startsWith('--')) : []
  let res
  try {
    const face = faceFromArgv(argv)
    res = face === 'worktree' ? runAuditWorktree(repoRoot, only) : runAudit(repoRoot, face, { only })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  if (argv.includes('--emit-baseline')) {
    const next = emitBaseline(res.violations, res.baseline)
    const regress = anchorRegression(res.baseline?.anchors || {}, next.anchors)
    if (regress.length) {
      console.error(`× 拒绝出台账:${regress.length} 条锚点上升/消失/新键带账(只允许下降或持平)`)
      for (const r of regress.slice(0, 20)) console.error(`  - ${r}`)
      return 1
    }
    console.log(JSON.stringify(next, null, 2))
    console.error(`台账按 ${FACE_TXT[res.face]} 面生成;逐条核过再放进 ${BASELINE_REL}`)
    return 0
  }
  const undetFileCount = new Set(res.undetermined.map((u) => u.file)).size
  if (argv.includes('--json')) {
    // stdout 只准出现 JSON:任何尾随说明行都会砸碎镜像测试的 JSON.parse
    console.log(
      JSON.stringify({
        face: res.face,
        scannedFiles: res.files.length,
        usages: res.usages,
        exempted: res.exempted,
        compliant: res.compliant,
        violationCount: res.violations.length,
        violations: res.violations,
        red: res.red,
        undetermined: res.undetermined,
        undeterminedCount: res.undetermined.length,
        unclassifiedCount: res.unclassified.length,
        unclassified: argv.includes('--all') ? res.unclassified : undefined,
        weakFindings: res.weakFindings,
        surfaceOverrides: res.surfaceOverrides,
        componentEvidence: res.componentEvidence,
        identityEvidence: res.identityEvidence,
        componentAmbiguous: res.componentUndetermined.length,
        componentUndetermined: res.componentUndetermined,
        capsuleFindings: res.capsuleFindings,
        scopeFallback: res.scopeFallback,
        scopeAmbiguous: res.scopeAmbiguous,
        scopeCorrupt: res.scopeCorrupt,
        trueCircle: res.trueCircle,
        capsule: res.capsule,
        dimsUndetermined: res.dimsUndetermined,
        exemptionIgnored: res.exemptionIgnored,
        contested: res.contested,
        roleTableProblems: res.roleTableProblems,
        baselineAnchors: Object.keys(res.baseline?.anchors || {}).length,
        undetFileCount,
      }),
    )
  } else {
    if (res.face === 'worktree')
      console.log('⚠️⚠️ 正在按**磁盘**判(工作树档):共享工作树常年滞后 HEAD,本档只供人工排查,不得作为结论 ⚠️⚠️')
    console.log(
      `判定面 ${FACE_TXT[res.face]}:扫 ${res.files.length} 个在射程文件、读到 ${res.usages} 处圆角取用` +
        `(豁免 ${res.exempted} 处;台账锚点 ${Object.keys(res.baseline?.anchors || {}).length} 条)`,
    )
    if (res.roleTableProblems.length) {
      console.log(
        `  ✗ 档位表里读不到这些角色的档位:${res.roleTableProblems.join('/')} —— ` +
          '本门对该族**零判据**(证据表有词元、表里没档位)。成因在共享解析 `radiusLookup` 而不是本门,' +
          '修它之前不得把这一族读成"已收口"。',
      )
    }
    if (res.red.length) {
      console.log(`❌ 判红(${res.red.length} 个「文件×角色」族超出自身锚点):`)
      for (const r of res.red.slice(0, 40)) {
        const vs = res.violations.filter((v) => anchorKey(v) === r.key)
        console.log(`  ${r.key}:本次 ${r.count} 处 / 锚点 ${r.cap}`)
        for (const v of vs.slice(0, 5)) console.log(lineOf(v))
      }
      if (res.red.length > 40) console.log(`  …其余 ${res.red.length - 40} 族见 --json`)
    } else if (res.violations.length) {
      console.log(
        `◦ 读到 ${res.violations.length} 处角色档不一致,全部不超过各自文件的 HEAD 锚点 ⇒ 存量,不判红` +
          '(清一处就 `--emit-baseline` 下调,不得为过门调高)',
      )
    } else {
      console.log('✅ 未发现"类别与档位不同源"的取用(在射程内)')
    }
    if (res.undetermined.length) {
      console.log(
        `⚠ 未判定 ${res.undetermined.length} 处(分布在 ${undetFileCount} 个文件)—— 判不出不等于通过,逐条报名:`,
      )
      const byReason = {}
      for (const u of res.undetermined) byReason[u.reason] = (byReason[u.reason] || 0) + 1
      console.log('   成因分布:' + Object.entries(byReason).map(([k, v]) => `${k} ${v}`).join(' / '))
      for (const u of res.undetermined.slice(0, 30))
        console.log(`  ${u.file}:${u.line} [${u.reason}] ${u.detail ?? ''} —— ${u.form}`)
      if (res.undetermined.length > 30)
        console.log(`  …其余 ${res.undetermined.length - 30} 条:--json 全量 / --strict 会判死`)
    }
    if (res.weakFindings.length) {
      console.log(
        `◦ 弱证据档不一致 ${res.weakFindings.length} 处(类别只由 className 里的**颜色实用类**认出)` +
          ` ⇒ 只点名、不判红,逐条交人裁:`,
      )
      for (const v of res.weakFindings.slice(0, 15)) console.log(lineOf(v).replace(/^ {2}/, '   '))
      if (res.weakFindings.length > 15)
        console.log(`   …其余 ${res.weakFindings.length - 15} 条见 --json 的 weakFindings`)
    }
    console.log(
      `◦ 身份通道(票㉘):ARIA role / data-testid / ui-<role> / bg-popover 给得出身份的 ${res.identityEvidence} 行。
   ` +
      `◦ 组件名档(C5):根容器按组件名判 ${res.componentEvidence} 处、名字给不出唯一角色而不启用 ${res.componentUndetermined.length} 处(不启用 ≠ 通过,逐条报名)。\n   ` +
      `◦ 包含关系(C4):按模态面改判 ${res.surfaceOverrides} 处(自称 card 而容器是模态载体)、` +
        `同名既当过面又当过卡 ⇒ 不改判 ${res.contested.length} 键、` +
        `归属判不出退回旧判序 ${res.scopeFallback} 行(其中并列候选 ${res.scopeAmbiguous} 行)、` +
        `闭合失配 ${res.scopeCorrupt} 处。退回与失配都**不是通过**:那些行仍按原逐行判序判,` +
        '只是容器这一维对它们不生效(判不出必须报名,不得静默当成"没有祖先")。',
    )
    console.log(
      `◦ 几何定性(C6):真圆装饰件(正方盒 + 半径=半边)${res.trueCircle} 处 ⇒ 出了角色档射程,` +
        `不再需要任何标记;胶囊判红 ${res.capsule} 处(三个条件同时成立才判:属性区闭合可确定 + 非正方盒 + ` +
        `短边 ≥ ${CAPSULE_MIN_SHORT}px;半径≥短边一半即两端全圆,本项目不允许,且**不吃豁免标记**` +
        `—— 本轮 ${res.exemptionIgnored} 处标记因形状成立而被忽略);` +
        `字面同形的圆头端点 ${res.roundedEnd} 处(半径写成 <边长> / 2 而该边细于下限,§4 的装饰族)` +
        `⇒ 出射程不判红,但它不是真圆,不与上面那档合并计数;` +
        `另有 ${res.capsuleFindings.length} 处细于可点尺寸的装饰条/骨架行进队列不判红(§4 明令装饰族不得方档化,` +
        `对它判红等于逼设计改方角);量不出盒形 ${res.dimsUndetermined} 行 ⇒ 只报名,不记通过。`,
    )
    if (argv.includes('--all') && res.componentUndetermined.length) {
    console.log('◦ 组件名档判不出(根容器所在组件名给不出唯一角色),逐条报名:')
    for (const u of res.componentUndetermined.slice(0, 60)) {
      console.log('     ' + u.file + ':' + u.line + ' 组件 ' + u.owner)
    }
    if (res.componentUndetermined.length > 60) console.log('     …其余 ' + (res.componentUndetermined.length - 60) + ' 条见 --json')
  }
  if (res.capsuleFindings.length) {
    console.log(
      `◦ C6 胶囊候选 ${res.capsuleFindings.length} 处(队列,不判红 —— 盒形量算会被子节点污染,升级前置写在判定处注释):`,
    )
    if (argv.includes('--all'))
      for (const u of res.capsuleFindings.slice(0, 60)) {
        console.log('     ' + u.file + ':' + u.line + ' ' + u.form + '  ' + u.detail)
      }
  }
  if (res.contested.length) {
      console.log('   contested(不改判,逐条报名):')
      for (const c of res.contested.slice(0, 10)) console.log(`     ${c.file} 键 ${c.key}`)
      if (res.contested.length > 10)
        console.log(`     …其余 ${res.contested.length - 10} 条见 --json 的 contested`)
    }
    console.log(
      `结论(五个体各算各的,谁也不替谁背书):判红 ${res.red.length} 族 / ` +
        `已判合规 ${res.compliant} 处(角色档一致)/ ` +
        `角色档不一致 ${res.violations.length} 处(其中超出自身锚点的就是上面 ${res.red.length} 族)/ ` +
        `弱证据待裁 ${res.weakFindings.length} 处(不判红)/ ` +
        `未判定 ${res.undetermined.length} 处(逐条报名,不是通过)/ ` +
        `不在射程 = 无类别证据的取用 ${res.unclassified.length} 处` +
        `${argv.includes('--all') ? '(--all 已逐条列出)' : '(--all 逐条列出)'}`,
    )
  }
  if (res.red.length) return 1
  if (strict && (res.undetermined.length || res.roleTableProblems.length)) return 2
  return 0
}

/** 自检:构造面 + 真仓 HEAD 阳性对照(两条同时成立才叫"遮罩关掉的是误报、不是判据")。 */
export async function selfTest(repoRoot = ROOT) {
  const results = []
  const t = (name, cond, extra = '') => {
    /**
     * 断言必须已经被求值。`t('...', () => {...})` 传进来的是**函数**,`!!fn` 恒真 ⇒ 这条用例
     * 从上线起就没判过任何东西,而账面永远 ✅(本会话就造出过 5 条这样的空断言)。
     * 与其修一次,不如把这条路堵死:传函数直接判失败并点名,谁再写这种形态都会当场红。
     */
    if (typeof cond === 'function') {
      results.push({ name, ok: false, extra: 'cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})() )' })
      return
    }
    results.push({ name, ok: !!cond, extra })
  }
  const got = catBatch(repoRoot, [`HEAD:${RADIUS_TABLE_REL}`], { maxBuffer: 1 << 26 })
  const tableSrc = got.get(`HEAD:${RADIUS_TABLE_REL}`)
  const table = tableSrc ? radiusLookup(tableSrc) : null
  /** 全部用例共用;**声明必须在使用点之前** —— 上一版写在第 1400 行,而最早的使用点在 1269 行。 */
  const A5 = (src, rel) => auditFileText(rel || 'x/T.tsx', src, table)
  t('00 档位表从被审面解析得到(自检不得靠手抄数字跑)', !!table && table.lg === 8 && table.xl === 12)
  if (!table) {
    for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.extra ? ` —— ${r.extra}` : ''}`)
    console.log('--self-test: 1 条,失败 1 条')
    return 1
  }
  const F = (line) => radiusFormsInLine(line, table)
  // 遮罩类用例必须走 `kept` 面 —— 直接把注释文本喂给 F 判的是"正则能不能匹配注释",
  // 而本门的实际取用面是 mask 之后的那一面(第一版自检就在 26/27/28 上判错了对象)。
  const FM = (line) => radiusFormsInLine(maskFaces(line).kept, table)
  const one = (line) => F(line)[0]
  // —— C1 取用形态:一条形态一个正反例,方向形态是既有解析的盲区,必须单独钉
  t('01 Tailwind 档名 rounded-lg → 8', one('x="rounded-lg"')?.px === 8)
  t('02 方向形态 rounded-t-xl → 12 且带角标(盲区不得复制)', one('x="rounded-t-xl"')?.px === 12 && one('x="rounded-t-xl"')?.dir === 't')
  t('03 角方向 rounded-tl-lg → 8', one('x="rounded-tl-lg"')?.dir === 'tl')
  t('04 裸 rounded → DEFAULT 档 8', one('x="flex rounded bg-card"')?.px === 8)
  t('05 任意值 rounded-[24rpx] → 12(rpx 折半)', one('x="rounded-[24rpx]"')?.px === 12)
  t('06 任意值 rounded-[16px] → 16', one('className="rounded-[16px]"')?.px === 16)
  t('07 任意值 rounded-[10px] 不在档位表上 → offScale(不猜一档)', one('x="rounded-[10px]"')?.offScale === true)
  t('08 CSS 变量 var(--radius-md) → 6', one('border-radius: var(--radius-md);')?.px === 6)
  t('09 裸 var(--radius) → 8', one('border-radius: var(--radius);')?.px === 8)
  t('10 rnRadius.xl 点号形态 → 12', one('r: rnRadius.xl')?.px === 12)
  t('11 rnRadius[\'2xl\'] 括号形态 → 16(§77 B6 同一课)', one(`r: rnRadius['2xl']`)?.px === 16)
  t('12 rnRadius.foo 查表落空 → px null(不得静默消失)', one('r: rnRadius.foo')?.px === null)
  t('13 rnRadius[step] 动态下标 → px null 并报名', one('r: rnRadius[step]')?.px === null)
  t('14 rnRadiusFor.panel → 自带角色 panel', one('r: rnRadiusFor.panel')?.role === 'panel')
  t('15 radiusFor[\'chip\'] 括号形态 → 角色 chip', one(`r: radiusFor['chip']`)?.role === 'chip')
  t('16 RADIUS_ROLES.card 同条声明 → 角色 card', one('x: RADIUS_ROLES.card')?.role === 'card')
  /**
   * 17 的原文是「`rnRadiusFor.hero` 表里无此档 → null」—— 它把**解析器丢项**当成了规格写进断言。
   * 角色表的值支以数字开头(`hero: '2xl'`)不被识别,role:hero 因此不存在,于是这条断言恒真,
   * 而真正该判的东西(hero 这一档)永不可判。修好解析器时它当场翻红,正是这条红把缺陷指出来的:
   * 断言不能只对"当前行为"负责,要对它**声称的那件事**负责。
   * 现拆成一对:表里真没有的角色必须 null(判据的原意),表里有的 hero 必须解出 16(不得再退回 null)。
   */
  t(
    '17 表里没有的角色 → null;表里有的 hero → 必须解出 16(成对,禁止把解析丢项当规格)',
    one('r: rnRadiusFor.notARoleAtAll')?.px === null && one('r: rnRadiusFor.hero')?.px === 16,
  )
  t('18 RN 数值属性 borderRadius: 12', one('borderRadius: 12,')?.px === 12)
  t('19 RN 方向属性 borderTopLeftRadius: 8', one('borderTopLeftRadius: 8,')?.px === 8 && one('borderTopLeftRadius: 8,')?.dir === 'TopLeft')
  t('20 **字符串形态** borderRadius: \'8px\'', one(`borderRadius: '8px',`)?.px === 8)
  t('21 字符串四值形态 "6px 6px 0 0" → 只收非零角', (() => {
    const fs = F(`borderRadius: "6px 6px 0 0",`)
    return fs.length === 2 && fs.every((x) => x.px === 6)
  })())
  t('22 CSS 声明 16rpx → 8', one('.a{border-radius:16rpx;}')?.px === 8)
  t('23 CSS 方向声明 border-top-left-radius 带 TopLeft', one('.a{border-top-left-radius:12px;}')?.dir === 'TopLeft')
  t('24 四值简写按位序分角(左上/右上/右下/左下)', (() => {
    const fs = F('.a{border-radius:2px 4px 6px 8px;}')
    return fs.length === 4 && fs.map((x) => x.slot).join() === '0,1,2,3'
  })())
  t('25 rounded-full / rounded-none / 50% 一律不收(正圆不是档位问题)', F('x="rounded-full"; border-radius: 50%; y="rounded-none"').length === 0)
  // —— 遮罩:注释不得冒充取用(走 kept 面,与生产路径同源)
  t('26 行注释里的 rounded-xl 不得计入', FM('// 这里写 rounded-xl 只是说明').length === 0)
  t('27 块注释里的 border-radius 不得计入', FM('/* border-radius: 24rpx */').length === 0)
  t('28 JSX 注释 {/* */} 里的形态不得计入', FM('{/* x="rounded-xl" */}').length === 0)
  t('29 真代码里的形态仍要计入(遮罩只关误报)', FM('const a = 1 // 说明').length === 0 && FM('a="rounded-xl"').length === 1)
  t('30 模板字符串里的假 className 不造类别证据(锚点判据面)', (() => {
    const s = 'const doc = `<Card className="rounded-xl">`'
    const { code, kept } = maskFaces(s)
    return radiusFormsInLine(kept, table).length === 1 && classStringsInLine(code, s).length === 0
  })())
  // —— C2/C3 端到端:元素类别 + 档位比
  const A = (src) => auditFileText('x/T.tsx', src, table)
  t('31 卡片取 xl ⇒ 判红(card/应为 lg)', A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]?.role === 'card')
  t('32 卡片取 lg ⇒ 合规', A('const s = { card: { borderRadius: rnRadius.lg } }').compliant === 1)
  t('33 报告说得出实际档与应有档', (() => {
    const v = A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]
    return v?.actualStep === 'xl' && v?.expectedStep === 'lg' && v?.expectedPx === 8
  })())
  t('34 颜色类名单独出现 ⇒ 弱证据:只点名、不判红', (() => {
    const r = A('<View className="bg-card rounded-t-xl" />')
    return r.violations.length === 0 && r.weakFindings[0]?.role === 'card' && r.weakFindings[0]?.evidence === 'weak'
  })())
  t('34b 组件标签是强证据,压过颜色类名', A('const s = <Button className="bg-card rounded-xl" />').violations[0]?.role === 'control')
  t('34c 同行两个 { 必须认到嵌套样式键(只认第一个 = 整族静默失证据)', A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]?.role === 'card')
  t('35 控件取 md ⇒ 判红(control 应为 sm)', A('const s = { primaryButton: { borderRadius: rnRadius.md } }').violations[0]?.role === 'control')
  t('36 头词元规则:cardHeader 不算卡片(子部件不判)', A('const s = { cardHeader: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('37 词元而非子串:stage 不得被读成 tag', A('const s = { stage: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('38 两个类别信号 ⇒ 未判定 role-conflict,不猜一边', (() => {
    // 组件标签 Card 与 Button 同现 ⇒ 两条强证据互斥,门不许替人挑一个(挑错就是改错设计)
    const r = A('const s = <Card><Button className="rounded-xl" /></Card>')
    return r.violations.length === 0 && r.undetermined[0]?.reason === 'role-conflict'
  })())
  t('39 无类别证据 ⇒ 不在射程(既不判红也不记通过)', A('const s = { shell: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('40 CSS 选择器 .card 取 xl ⇒ 判红', A('.card { border-radius: 24rpx; }').violations[0]?.role === 'card')
  t('41 后代选择器只算最后一个类(祖先不得漏档给子元素)', A('.card .notice { border-radius: 24rpx; }').unclassified.length === 1)
  t('42 自带角色的取用压过名字证据:rnRadiusFor.panel ⇒ 合规', A('const s = { card: { borderRadius: rnRadiusFor.panel } }').compliant === 1)
  // —— 豁免
  t('43 带原因的 radius-role-exempt 放行本行', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-role-exempt: 主视觉卡').violations.length === 0)
  t('44 标记写在紧邻上一行也放行', A('const s = {\n  // radius-role-exempt: 与广告位同档\n  card: { borderRadius: rnRadius.xl },\n}').violations.length === 0)
  t('45 裸标记(无原因)不放行', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-role-exempt:').violations.length === 1)
  t('46 注释闭合符不得冒充原因', A('const s = { card: { borderRadius: rnRadius.xl } } /* radius-role-exempt: */').violations.length === 1)
  t('47 标记救不了整棵子树(只放行命中行)', A('const s = { // radius-role-exempt: 只该管一行\n  card: { borderRadius: rnRadius.xl },\n  chip: { borderRadius: rnRadius.lg },\n}').violations.length === 1)
  t('48 radius-exempt(守门 77 那一族)在本门同样生效', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-exempt: 真圆').violations.length === 0)
  // —— 棘轮与台账
  const counts = { 'a.tsx|card': 2, 'b.tsx|chip': 1 }
  t(
    '49 锚点相等 ⇒ 该族不判红(存量不拦);无锚的那族仍判红(新增即拦)',
    applyRatchet(counts, { 'a.tsx|card': 2 }).every((r) => r.key !== 'a.tsx|card') &&
      applyRatchet(counts, { 'a.tsx|card': 2 }).length === 1,
  )
  t('50 超出锚点 ⇒ 判红并点名键', applyRatchet(counts, { 'a.tsx|card': 1 })[0]?.key === 'a.tsx|card')
  t('51 台账缺键 ⇒ 视作 0(新增即拦,不留清单外空档)', applyRatchet(counts, {})[0]?.count === 2)
  t('52 锚点粒度到「文件×角色」:换角色写法不能净零逃逸', (() => {
    const before = applyRatchet({ 'a.tsx|card': 1 }, { 'a.tsx|card': 1 })
    const after = applyRatchet({ 'a.tsx|control': 1 }, { 'a.tsx|card': 1 })
    return before.length === 0 && after.length === 1
  })())
  t('53 重锚只允许下降:上升必拒', anchorRegression({ 'a|card': 1 }, { 'a|card': 2 }).length === 1)
  t('54 重锚只允许下降:锚点消失也必拒', anchorRegression({ 'a|card': 1 }, {}).length === 1)
  t('55 第一次入锚(空台账)不受"只降"限制', anchorRegression({}, { 'a|card': 3 }).length === 0)
  t(
    '55b 台账一经建立,新键带违规必拒 —— 否则每次判红都能被同一条 --emit-baseline 洗成豁免',
      anchorRegression({ 'a|card': 1 }, { 'a|card': 1, 'b|chip': 2 }).length === 1 &&
        anchorRegression({ 'a|card': 1 }, { 'a|card': 0, 'b|chip': 0 }).length === 0,
  )
  t(
    '55c 一行里多族并列时归属不可判 ⇒ 落未判定,不得挑一个族判红(假阳比漏报更贵)',
      (() => {
        const r = A('const s = { card: { borderRadius: rnRadius.xl }, chip: { borderRadius: rnRadius.lg } }')
        return r.violations.length === 0 && r.compliant === 0 && r.unclassified.length === 2
      })(),
  )
  t('56 emitBaseline 幂等(重跑不产生第二份真相)', (() => {
    const vs = A('const s = { card: { borderRadius: rnRadius.xl } }').violations
    const once = emitBaseline(vs, { anchors: {} }).anchors
    const twice = emitBaseline(vs, { anchors: once }).anchors
    return JSON.stringify(once) === JSON.stringify(twice) && once['x/T.tsx|card'] === 1
  })())
  t('57 清偿完的族降到 0 而不是删键(键消失 = 台账被旧基线回写的指纹)', (() => {
    const next = emitBaseline([], { anchors: counts }).anchors
    return Object.keys(next).length === 2 && Object.values(next).every((v) => v === 0)
  })())
  let threw = false
  try {
    parseBaseline('{"nope":1}', 'x')
  } catch (e) {
    threw = e instanceof Undetermined
  }
  t('58 坏台账 ⇒ 无法判定,不得当空锚点用', threw)
  // —— 射程与面
  t('59 在射程:apps/web 的 tsx', isInScope('apps/web/src/a.tsx'))
  t('60 不在射程:apps/api(生成式 CSS 归 77)', !isInScope('apps/api/src/x.ts'))
  t('61 不在射程:design-tokens 档位表自身', !isInScope('packages/design-tokens/src/radius.js'))
  t('62 不在射程:测试与夹具', !isInScope('apps/web/src/a.test.tsx') && !isInScope('apps/web/tests/a.tsx'))
  t('63 不在射程:构建产物/依赖族经共享排除清单', !isInScope('apps/web/node_modules/a.tsx') && !isInScope('apps/web/.next-static/a.tsx'))
  t('64 语言包不参与', !isInScope('packages/i18n/messages/web/zh-CN.ts'))
  t('65 两面旗同给 ⇒ 判死', (() => {
    try {
      faceFromArgv(['--staged', '--worktree'])
      return false
    } catch (e) {
      return e instanceof Undetermined
    }
  })())
  t('66 缺省档 = HEAD(不是磁盘)', faceFromArgv([]) === 'head' && faceFromArgv(['--staged']) === 'staged')
  t('67 OUT_OF_SCOPE 每条都必须带 why(报名式排除)', OUT_OF_SCOPE.every((o) => o.why && o.why.length > 8))
  t('68 角色词元表只覆盖档位表里有的角色(对账,不猜)', (() => {
    const stemRoles = Object.keys(ROLE_STEMS)
    const withRole = stemRoles.filter((r) => table[`role:${r}`] !== undefined)
    return withRole.length > 0 && roleTableProblems(table).every((r) => stemRoles.includes(r))
  })())
  // —— 真仓阳性对照(关键):同一条违规,写在代码里必命中、只写进注释必不命中
  const PROBE = 'apps/miniapp-taro/src/components/DrawerComponent.tsx'
  const probeSrc = catBatch(repoRoot, [`${PROBE_REF}:${PROBE}`], { maxBuffer: 1 << 26 }).get(`${PROBE_REF}:${PROBE}`)
  let hit = null
  let blind = false
  if (probeSrc) {
    const pr = A(probeSrc)
    hit = [...pr.violations, ...pr.weakFindings].find((v) => v.form.includes('rounded-t-xl')) || null
    const rewritten = probeSrc
      .split('\n')
      .map((l) => (l.includes('rounded-t-xl') ? `// ${l.trim()}` : l))
      .join('\n')
    const again = A(rewritten)
    blind = ![...again.violations, ...again.weakFindings].some((v) => v.form.includes('rounded-t-xl'))
  }
  t(`69 真仓出处阳性对照(${PROBE_REF.slice(0, 9)}):${PROBE.split(String.fromCharCode(47)).pop()} 的 rounded-t-xl 必须被点名`, !!hit, hit ? `角色 ${hit.role} / 实际 ${hit.actualStep} / 应为 ${hit.expectedStep}` : '未命中 = 判据失明')
  t('70 同一形态只写进注释 ⇒ 必不命中(否则遮罩关掉的是判据)', !!probeSrc && blind)
  /**
   * 71–73:角色表**值支**必须认得数字开头的档名(`hero: '2xl'`)。
   * 立因:解析器原先只认"字母开头标识符"或"纯数字"两种值 ⇒ `hero:'2xl'` 整行不匹配,
   * 表里没有 role:hero,于是三个 hero 站点被报成 role-not-in-table(读起来像代码写错,
   * 其实是尺子丢项),而 hero 这一档从此**永不可判**。这是同一条"漏读一侧不表现为少几个数"
   * 的缺陷第三次出现(前两次:档位键 '2xl'、Tailwind 方向形态)。
   */
  t(
    '71 角色表值支认数字开头档名 ⇒ role:hero 必须解出 16',
    (() => {
      const tbl = table
      if (!tbl) return false
      const hero = roleSpec(tbl, 'hero')
      return !!hero && hero.px === 16 && hero.step === '2xl' && rolesInTable(tbl).includes('hero')
    })(),
  )
  t(
    '72 名字不得替元素认领纯尺寸档(hero/banner),但普通类别仍由名字判(成对)',
    (() => {
      const banner = rolesOfName('compactionBanner')
      const heroName = rolesOfName('heroSection')
      const card = rolesOfName('userCard')
      return (
        !banner.includes('hero') &&
        !heroName.includes('hero') &&
        ROLE_STEMS.hero?.nameCannotClaim === true &&
        card.includes('card')
      )
    })(),
  )
  t(
    '73 显式取用仍是唯一可判 hero 的路(收窄推理不等于放宽判据)',
    (() => {
      const tbl = table
      if (!tbl) return false
      const spec = roleSpec(tbl, 'hero')
      // 显式声明走 f.role 直取,不经 rolesOfName ⇒ 一定拿得到档;拿不到就是两处路径都断了
      return !!spec && spec.px === tbl['2xl'] && tbl['2xl'] === 16
    })(),
  )
  /**
   * —— C4 包含关系(容器优先于名字)。四条成对 + 两条真仓对照,缺一不算数:
   *  74/75 是**同一段样式声明**换一个容器 ⇒ 结论必须翻;75 证明"有模态面判据"不等于
   *  "凡是 card 都改判"(那才是真放宽)。76 证明内层卡不被外层的面吃掉。77 证明载体可以是
   *  遮罩键而不是 `<Modal>` 标签。78 证明同名键身份冲突时**不改判**而是报名。
   */
  const MODAL_FX = `const styles = StyleSheet.create({
  box: { flex: 1 },
  card: { borderRadius: rnRadius.xl },
})
export default function Pop() {
  return (
    <Modal visible>
      <View style={styles.box}>
        <View style={styles.card} />
      </View>
    </Modal>
  )
}`
  /**
   * C4 的用例必须在**以浮层命名的文件**里跑 —— 门现在把"自称 card 的盒子按 panel 判"限制在
   * 浮层组件文件内(页面文件里的 <Card> 是对话框内容区的数据卡)。这条边界本身就是一条用例,
   * 所以这里同时留正例(浮层文件 ⇒ 改判)与反例(页面文件 ⇒ 不改判),不让启发式单方面说了算。
   */
  const AM = (src) => auditFileText('x/LoginModal.tsx', src, table)
  const AP = (src) => auditFileText('x/ManagementPage.tsx', src, table)
  t('73b 页面文件里对话框内的 <Card> 不被改判(它是内容卡,不是浮层体)', (() => {
    const src = [
      'export function ManagementPage() {',
      '  return (',
      '    <Dialog>',
      '      <DialogContent>',
      '        <div className="grid gap-2">',
      '          <Card className="rounded-lg">x</Card>',
      '        </div>',
      '      </DialogContent>',
      '    </Dialog>',
      '  )',
      '}',
    ].join('\n')
    const r = AP(src)
    return r.violations.length === 0 && r.undetermined.length === 0 && r.surfaceOverrides === 0
  })())
  t('74 自称 card 而容器是模态面 ⇒ 按 panel 判(xl 合规)并记 via=surface', (() => {
    const r = AM(MODAL_FX)
    return (
      r.violations.length === 0 &&
      r.compliant === 1 &&
      r.surfaceOverrides === 1 &&
      r.contested.length === 0
    )
  })())
  t(
    '75 同一段声明换一个**非模态**容器 ⇒ 仍按 card 判红(容器判据不是免罪通道)',
    (() => {
      const r = AM(MODAL_FX.replace('<Modal visible>', '<Pressable onPress={x}>').replace('</Modal>', '</Pressable>'))
      return r.violations[0]?.role === 'card' && r.surfaceOverrides === 0
    })(),
  )
  t(
    '76 模态里再嵌一张卡:外层键是面、内层键仍是卡(两层各自判,不合并)',
    (() => {
      // 两层必须用**不同键名**:同一个键既当过面又当过卡属于 78 的 contested,不是嵌套测试。
      const nested = `const s = StyleSheet.create({
  card: { borderRadius: rnRadius.xl },
  noticeCard: { borderRadius: rnRadius.xl },
})
export default function P() {
  return (
    <Modal visible>
      <View style={s.card}>
        <View style={s.noticeCard} />
      </View>
    </Modal>
  )
}`
      const r = AM(nested)
      return r.compliant === 1 && r.violations.length === 1 && r.violations[0].role === 'card'
    })(),
  )
  t(
    '77 载体也可以是遮罩键(没有 <Modal> 标签时同样成立)',
    (() => {
      const noModal = `const s = StyleSheet.create({
  backdrop: { flex: 1 },
  card: { borderRadius: rnRadius.xl },
})
export default function P() {
  return (
    <View style={s.backdrop}>
      <View style={s.card} />
    </View>
  )
}`
      const r = AM(noModal)
      return r.compliant === 1 && r.surfaceOverrides === 1
    })(),
  )
  t(
    '78 同一个键既当过面又当过卡 ⇒ 不改判,contested 报名(猜一边就是造一半假账)',
    (() => {
      const contested = `const s = StyleSheet.create({
  overlay: { flex: 1 },
  card: { borderRadius: rnRadius.xl },
})
export default function P() {
  return (
    <View>
      <View style={s.card} />
      <Modal visible>
        <View style={s.overlay}>
          <View style={s.card} />
        </View>
      </Modal>
    </View>
  )
}`
      const r = AM(contested)
      return (
        r.surfaceOverrides === 0 &&
        r.contested.length === 1 &&
        r.contested[0].key === 'card' &&
        r.violations[0]?.role === 'card'
      )
    })(),
  )
  t(
    '79 层叠档名不得冒充类别:`z-popover` + `bg-card` 只给一个 card 弱证据(不再 role-conflict)',
    (() => {
      const r = AM('<div className="z-popover min-w-[16rem] rounded-xl border bg-card p-1" />')
      return r.undetermined.length === 0 && r.weakFindings[0]?.role === 'card'
    })(),
  )
  t(
    '80 跨行开标签:属性行认得出自己的标签(select ⇒ control 强证据,不再靠色档猜)',
    (() => {
      const r = A(
        'const x = (\n  <select\n    value={k}\n    onChange={f}\n    className="h-7 rounded-md border bg-card px-1.5"\n  />\n)',
      )
      return r.undetermined.length === 0 && r.violations[0]?.role === 'control' && r.violations[0]?.evidence !== 'weak'
    })(),
  )
  t(
    '81 归属并列(同一行两个等宽开标签)⇒ 计 ambiguous 并退回旧判序,绝不挑一个元素当祖先',
    (() => {
      const r = A('const s = <Card><Button className="rounded-xl" /></Card>')
      return r.scopeAmbiguous >= 1 && r.scopeFallback >= 1 && r.undetermined[0]?.reason === 'role-conflict'
    })(),
  )
  // —— 身份通道(票㉘):ARIA role / data-testid / ui-<role> / bg-popover —— 每条都要有"能命中"与"不得命中"两只
  t('98 身份标记 ui-panel:rounded-xl 合规,rounded-md 必须判红(标记不是豁免)', (() => {
    const ok = A5('<div className="ui-panel rounded-xl">x</div>', 'x/T.tsx')
    const bad = A5('<div className="ui-panel rounded-md">x</div>', 'x/T.tsx')
    return ok.violations.length === 0 && ok.compliant === 1 && bad.violations[0]?.role === 'panel' && bad.violations[0]?.expectedStep === 'xl'
  })())
  t('99 ARIA role 是身份:role=menu 判 popover、role=dialog 判 panel(不靠颜色猜)', (() => {
    const menu = A5('<div role="menu" className="rounded-xl">x</div>', 'x/T.tsx').violations[0]
    const dlg = A5('<div role="dialog" className="rounded-xl">x</div>', 'x/T.tsx')
    return menu?.role === 'popover' && menu?.expectedStep === 'md' && dlg.violations.length === 0 && dlg.compliant === 1
  })())
  t('100 data-testid 是作者给盒子起的名字:plan-review-panel 压过 bg-card(票㉖ 那处 role-conflict 的实形)', (() => {
    const r = A5('<div className="rounded-xl border bg-card" data-testid="plan-review-panel">x</div>', 'x/ReviewPanel.tsx')
    return r.undetermined.length === 0 && r.violations.length === 0 && r.compliant === 1
  })())
  t('101 bg-popover 算身份(浮层类族),rounded-xl 的浮层要降到 md', (() => {
    const v = A5('<div className="rounded-xl border bg-popover">x</div>', 'x/T.tsx').violations[0]
    return v?.role === 'popover' && v?.expectedStep === 'md'
  })())
  t('102 反向:bg-card 仍只是背景档 —— 不得被升成身份(否则颜色又开始替元素定性)', (() => {
    const r = A5('<div className="rounded-md bg-card">x</div>', 'x/T.tsx')
    return r.violations.length === 0 && r.weakFindings.length === 1 && r.weakFindings[0].role === 'card'
  })())
  t('103 StyleSheet 裸串里的标记也要认(没有 className= 锚点那一型)', (() => {
    const r = A5("const s = { row: { a: 'flex ui-card rounded-lg bg-card' } }", 'x/T.tsx')
    return r.violations.length === 0 && r.compliant === 1
  })())
  t('104 反向:注释里写的 ui-panel 不得算身份(遮罩面之外判据就成自证)', (() => {
    const r = A5('// ui-panel\n<div className="rounded-md">x</div>', 'x/Panel.tsx')
    return r.violations.filter((v) => v.role === 'panel').length === 0
  })())
  /**
   * —— C6 几何定性。五条成对读:①"正方⇒不判"必须由"同档半径落在扁盒上⇒进队列"钉住,
   * 否则不判可能只是判据没跑;②"胶囊不吃标记"必须由"真圆带同样标记⇒标记照旧生效"钉住,
   * 否则 exemptionIgnored 可能是个恒真的计数器。
   */
  // —— C5:组件名档(根容器按**它自己的**组件名判,内联小组件不被外层顶判)

  t('106 正方盒 + 半径=半边 ⇒ 判真圆装饰件:不判红、不计合规、也不需要任何标记', (() => {
    const r = A5('const s = { card: { width: 16, height: 16, borderRadius: rnRadius.lg } }', 'x/Dot.tsx')
    return r.trueCircle === 1 && r.violations.length === 0 && r.compliant === 0 && r.capsuleFindings.length === 0
  })())
  t('107 同档半径落在 40×16 的扁盒上 ⇒ **判红** reason=capsule(短边达到可点尺寸)', (() => {
    const r = A5('const s = { card: { width: 40, height: 16, borderRadius: rnRadius.lg } }', 'x/Bar.tsx')
    return r.violations.length === 1 && r.violations[0].reason === 'capsule' && r.capsuleFindings.length === 0
  })())
  t('108 胶囊不吃豁免:挂 radius-role-exempt 的扁盒仍判红,并计 exemptionIgnored', (() => {
    const r = A5(
      'const s = { card: { width: 40, height: 16, borderRadius: rnRadius.lg } } // radius-role-exempt: 想免检',
      'x/Bar2.tsx',
    )
    return r.violations.length === 1 && r.exemptionIgnored >= 1 && r.exempted === 0
  })())
  t('109 反向:同样标记落在正方真圆上 ⇒ 标记照旧生效(忽略只给形状成立那一侧)', (() => {
    const r = A5(
      'const s = { card: { width: 16, height: 16, borderRadius: rnRadius.lg } } // radius-role-exempt: 圆点',
      'x/Dot2.tsx',
    )
    return r.exemptionIgnored === 0 && r.exempted >= 1
  })())
  t('110 量不出盒形 ⇒ 计 dimsUndetermined 报名,绝不静默当成"判过了"', (() => {
    const r = A5('const s = { card: { borderRadius: rnRadius.lg } }', 'x/NoDims.tsx')
    return r.dimsUndetermined >= 1 && r.trueCircle === 0 && r.violations.length === 0
  })())
  t('111 短边低于可点尺寸(60×8 指示条)⇒ 只进队列不判红 —— §4 明令装饰族不得方档化', (() => {
    const r = A5('const s = { card: { width: 60, height: 8, borderRadius: rnRadius.sm } }', 'x/Thin.tsx')
    return r.capsuleFindings.length === 1 && r.violations.length === 0
  })())
  /**
   * 这条是"判红一侧只认窄窗"的存在理由:宽窗会把子节点 `<Icon className="h-4 w-4">` 的尺寸算进
   * 父元素,于是 `w-40 rounded-md` 的浮层被量成 160×10 的"胶囊"。HEAD 现读 14 处候选里 9 处就是
   * 这一型假阳 —— 把它们判红,唯一结局是各会话跳门、连带全部守门作废。
   */
  t('112 子节点尺寸不得算进父盒:带 h-4 w-4 子图标的 w-40 rounded-md 浮层 ⇒ 不判红', (() => {
    const src = [
      'export function Menu() {',
      '  return (',
      '    <div className="w-40 rounded-md border">',
      '      <Icon className="h-4 w-4" />',
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    const r = A5(src, 'x/Menu.tsx')
    return r.violations.filter((v) => v.reason === 'capsule').length === 0
  })())
  const C5_ROOT = [
    'export function ConfigPanel() {',
    '  return (',
    '    <div className="rounded-xl">',
    '      <span className="rounded-sm" />',
    '    </div>',
    '  )',
    '}',
  ].join('\n')
  t('89 C5 组件根容器按组件名判 panel ⇒ rounded-xl 合规(带 via=component)', (() => {
    const r = A5(C5_ROOT, 'x/ConfigPanel.tsx')
    return r.violations.length === 0 && r.compliant >= 1
  })())
  t('90 C5 牙的证明:同一根容器改成 rounded-lg 必须判红且 role=panel', (() => {
    const r = A5(C5_ROOT.replace('rounded-xl', 'rounded-lg'), 'x/ConfigPanel.tsx')
    const v = r.violations.find((x) => x.via === 'component')
    return v?.role === 'panel' && v?.expectedStep === 'xl' && v?.line === 3
  })())
  t('91 C5 只在 JSX **根**启用:子元素不得吃组件名(rounded-sm 不该被顶成 panel)', (() => {
    const r = A5(C5_ROOT, 'x/ConfigPanel.tsx')
    return !r.violations.some((v) => v.line === 4) && r.undetermined.length === 0
  })())
  t('92 C5 内联小组件的根按它自己的证据判,不被外层组件名顶判', (() => {
    const src = [
      'export function ConfigPanel() {',
      '  return (',
      '    <div className="rounded-xl">',
      '      <EditButton />',
      '    </div>',
      '  )',
      '}',
      'function EditButton() {',
      '  return <button className="rounded-lg">x</button>',
      '}',
    ].join('\n')
    const r = A5(src, 'x/ConfigPanel.tsx')
    const v = r.violations.find((x) => x.line === 9)
    return v?.role === 'control' && v?.expectedStep === 'sm' && v?.via !== 'component'
  })())
  t('92b C5 内联小组件无标签证据时,按**自己的**组件名判 control(而非外层 ConfigPanel 的 panel)', (() => {
    const src = [
      'export function ConfigPanel() {',
      '  return (',
      '    <div className="rounded-xl">',
      '      <EditButton />',
      '    </div>',
      '  )',
      '}',
      'function EditButton() {',
      '  return <div className="rounded-lg">x</div>',
      '}',
    ].join('\n')
    const r = A5(src, 'x/ConfigPanel.tsx')
    const v = r.violations.find((x) => x.line === 9)
    return v?.role === 'control' && v?.owner === 'EditButton' && v?.via === 'component'
  })())
  t('93 C5 声明括号配不平 ⇒ 判"归属判不出"不启用,绝不猜一个区间', (() => {
    const src = 'export function BrokenPanel() {\n  return <div className="rounded-lg">x</div>\n'
    const r = A5(src, 'x/BrokenPanel.tsx')
    return r.violations.filter((v) => v.via === 'component').length === 0
  })())
  t('94 类名取证不得越界采兄弟属性(真实站点文本:兄弟属性的值曾被当成类名)', (() => {
    const line = '<div className="rounded-xl border bg-card" data-testid="plan-review-panel">'
    const got = classStringsInLine(line, line)
    return got.length === 1 && got[0].includes('bg-card') && !got.join('').includes('plan-review-panel')
  })())
  t('94b 同一个 class 属性的多段形态必须收全(收窄不许变成失明)', (() => {
    const line = '<div className={cn("rounded-xl bg-card", "px-3 py-2")}>'
    return classStringsInLine(line, line).length === 2
  })())
  // —— C4 的真仓双向对照(夹具只能证明函数会给答案,证明不了有人在问它)
  /**
   * 取材 ref 钉在**清偿前的出处提交**而不是 HEAD:票⑳ 把该形态从 HEAD 清掉之后,"HEAD 上还能量到"
   * 这条前提当天失效 —— 阳性对照若跟着账一起消失,门就退化成没有牙的尺子而自检照绿。
   * 与 A13 投影等价性取 `git show dd5142f2255^` 历史源码快照是同一手法(出处逐字取回,不重写)。
   */
  const SURF_PROBE = 'apps/mobile-rn/src/components/LoginPopUp.tsx'
  const NOTSURF_PROBE = 'packages/app/src/features/course-detail/CourseDetailScreen.tsx'
  const surfSrc = catBatch(repoRoot, [`${PROBE_REF}:${SURF_PROBE}`], { maxBuffer: 1 << 27 }).get(
    `${PROBE_REF}:${SURF_PROBE}`,
  )
  const notsurfSrc = catBatch(repoRoot, [`${PROBE_REF}:${NOTSURF_PROBE}`], { maxBuffer: 1 << 27 }).get(
    `${PROBE_REF}:${NOTSURF_PROBE}`,
  )
  let surfOk = false
  if (surfSrc) {
    const r = auditFileText(SURF_PROBE, surfSrc, table)
    const overridden = r.compliant + r.violations.filter((v) => v.role === 'panel').length
    // 面成立的两条同时要看:改判确实发生,且 16px 的模态面**仍被判红**(panel 应 xl=12)
    surfOk =
      r.surfaceOverrides >= 1 &&
      r.violations.some((v) => v.role === 'panel' && v.actualStep === '2xl' && v.expectedStep === 'xl') &&
      overridden >= 1
  }
  t(
    '95 真仓 HEAD 对照:plan-review-panel.tsx 的根容器取证链必须给得出唯一角色(不得再落 role-conflict)',
    (() => {
      const rel = 'apps/web/src/components/ai/plan-review-panel.tsx'
      const src = catBatch(repoRoot, ['HEAD:' + rel], { maxBuffer: 1 << 27 }).get('HEAD:' + rel)
      if (!src) return false
      const r = auditFileText(rel, src, table)
      return r.undetermined.length === 0 && r.violations.length === 0
    })(),
  )
  t(
    `82 真仓出处阳性对照(${PROBE_REF.slice(0, 9)}):${SURF_PROBE.split(String.fromCharCode(47)).pop()} 的 card 键必须改判 panel,且 2xl 仍判红`,
    surfOk,
  )
  t(
    `83 真仓反向对照:${NOTSURF_PROBE.split(String.fromCharCode(47)).pop()} 的 btn/tag 不得被容器判据吃掉`,
    (() => {
      if (!notsurfSrc) return false
      const r = auditFileText(NOTSURF_PROBE, notsurfSrc, table)
      const roles = new Set(r.violations.map((v) => v.role))
      return roles.has('control') && roles.has('chip') && r.surfaceOverrides === 0
    })(),
  )
  /**
   * 票㉞ 的成对用例。判序与提取式各改了一半都会出现"账面正常而这一族没人看",
   * 所以五条都写成**双向**:该成立的成立、该不成立的不成立(只断言"命中"的用例,
   * 在提取式整个坏掉时同样会绿)。
   */
  t(
    '84 见方盒 + `N / 2` ⇒ 几何真圆出射程(旧判序先落 off-scale 未判定,于是真圆永远证不出)',
    (() => {
      const r = A5('const s = {\n  dot: { width: 60, height: 60, borderRadius: 60 / 2 },\n}\n')
      return (
        r.trueCircle === 1 &&
        r.undetermined.length === 0 &&
        r.capsule === 0 &&
        r.violations.length === 0
      )
    })(),
  )
  t(
    '85 非见方盒 + 半径=短边一半 ⇒ 胶囊判红(此前这类候选全部在 off-scale 那格提前退出)',
    (() => {
      const r = A5('const s = {\n  bar: { width: 120, height: 40, borderRadius: 20 },\n}\n')
      return (
        r.capsule === 1 &&
        r.violations.length === 1 &&
        r.violations[0].reason === 'capsule' &&
        r.trueCircle === 0
      )
    })(),
  )
  t(
    '86 被除数是跨文件常量 ⇒ 落 divide-operand-unknown 报名,既不静默也不拿被除数凑数',
    (() => {
      const r = A5('const s = {\n  a: { width: 56, height: 56, borderRadius: EXTERNAL_PX / 2 },\n}\n')
      const hit = r.undetermined.find(u => u.reason === 'divide-operand-unknown')
      return (
        !!hit &&
        r.trueCircle === 0 &&
        r.compliant === 0 &&
        String(hit.detail).includes('EXTERNAL_PX')
      )
    })(),
  )
  t(
    '87 除法不得双记:同一处圆角只产一条档(旧行为把被除数与商各记一次,凭空多一档 ⇒ 造出假分叉)',
    (() => {
      const f = radiusFormsInLine('  borderRadius: rnRadius.lg / 2,', table, new Map())
      return f.length === 1 && f[0].px === 4
    })(),
  )
  t(
    '88 CSS 侧除法不得被值串解析切成两档(`60rpx / 2` 只认商 15;calc 包裹同形)',
    (() => {
      const f = radiusFormsInLine('border-radius: 60rpx / 2;', table, new Map())
      const g = radiusFormsInLine('border-radius: calc(60rpx / 2);', table, new Map())
      return f.length === 1 && f[0].px === 15 && g.length === 1 && g[0].px === 15
    })(),
  )
  t(
    '89 跨文件常量解不到值,但半径与边长**字面同形** ⇒ 仍按几何定性出射程(数值路线两头落空时字面路线补位)',
    (() => {
      const src =
        "import { VOICE_BTN_SIZE } from '@ihui/shared/ui/x-spec'\n" +
        'const s = {\n  mic: { width: VOICE_BTN_SIZE, height: VOICE_BTN_SIZE, borderRadius: VOICE_BTN_SIZE / 2 },\n}\n'
      const r = A5(src)
      return r.trueCircle === 1 && r.capsule === 0 && r.undetermined.length === 0
    })(),
  )
  t(
    '90 除法 + 非正方 ⇒ 走字面路线判 capsule,锚点键必须是 capsule 而不是 undefined',
    (() => {
      const r = A5('const s = {\n  bar: { width: 300, height: 36, borderRadius: 36 / 2 },\n}\n')
      return (
        r.capsule === 1 &&
        r.violations.length === 1 &&
        r.violations[0].role === 'capsule' &&
        anchorKey(r.violations[0]) === `x/T.tsx|capsule`
      )
    })(),
  )
  t(
    '91 反向:分子与本盒边长不同形 ⇒ 不得按几何放行(声称在算一半 ≠ 证明)',
    (() => {
      const r = A5('const s = {\n  a: { width: 40, height: 40, borderRadius: OTHER_SIZE / 2 },\n}\n')
      return r.trueCircle === 0 && r.capsule === 0
    })(),
  )
  t(
    '92 自引用常量不得崩栈(上一版注释写着"最多再解一层,防环"而实现里根本没有 depth)',
    (() => {
      const r = A5('const A = A\nconst s = {\n  x: { width: A, height: A, borderRadius: A / 2 },\n}\n')
      // 修前:radiusOperandPx 无限互调 ⇒ RangeError 把整门打挂。修后:解不到值,但分子与边长逐字
      // 同形 ⇒ 字面路线仍然给出真圆。两个结论都要成立,只断"不崩"就等于允许它判不出。
      return r.trueCircle === 1 && r.capsule === 0
    })(),
  )
  const SURF_PROVE_NAME = (p) => p.split('/').pop()
  const bad = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.extra ? ` —— ${r.extra}` : ''}`)
  console.log(`--self-test: ${results.length} 条,失败 ${bad.length} 条`)
  return bad.length ? 1 : 0
}

// §22d:双形态入口守护 —— 镜像测试 import 判据时不得触发 CLI(它会派生 git)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  ROOT,
  RADIUS_TABLE_REL,
  BASELINE_REL,
  OUT_OF_SCOPE,
  isInScope,
  auditFileText,
  anchorKey,
  countByKey,
  applyRatchet,
  anchorRegression,
  emitBaseline,
  parseBaseline,
  faceFromArgv,
  runAudit,
  roleTableProblems,
  selfTest,
  headToken,
  maskCommentsAndStrings,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
