// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳承载引用的唯一判据面(守门 251 C5 与跨端覆盖尺共用,§0.6 单一真相源)。
 *
 * 为什么单独立一份:两把尺子都要问同一件事 —— 「这页 `@rn-shells/<X>` 指过去的那个 RN 壳
 * 到底在不在面上」。各写一份正则 ⇒ 早晚一边认一边不认(本仓记过多次的失效型);
 * 而它必须是共享的一份,因为**覆盖率计数与构建可行性不能各说各话**:
 * 指向不存在壳的页编不过,若覆盖尺仍把它算成"已镜像",账面就是绿的、产物是坏的。
 *
 * 刻意放 lib 而不是让两道门互 import:check-rn-compat-coverage 已经 import 覆盖尺,
 * 反向 import 会成环(环里顶层常量在求值期可能还没初始化)。
 */
export const RN_SHELL_ALIAS_PREFIX = '@rn-shells/'
export const RN_SCREENS_DIR = 'apps/mobile-rn/src/screens'

/** 一页文本里的壳引用名集合(不认 glob、不认别名变体:形态不符就是没引用)。 */
export function shellRefsOf(text) {
  const out = new Set()
  for (const m of String(text ?? '').matchAll(/from\s*['"]@rn-shells\/([A-Za-z0-9_]+)['"]/g)) out.add(m[1])
  return out
}

/** 壳引用的落点(别名口径:同名 RN 屏文件)。 */
export function shellTargetRel(name) {
  return `${RN_SCREENS_DIR}/${name}.tsx`
}

/**
 * 壳文件的导出形态。生成器与门都读它:
 * `import X from '@rn-shells/X'`(默认导入)与 `export function X()`(具名导出)凑在一起时,
 * webpack 只给一条 "export 'default' was not found" 警告,页面渲染出来是 undefined ——
 * 2026-10-26 实测 5 枚壳承载页里有 4 枚正是这一型(只有 DomainHubScreen 有默认导出)。
 * 所以"该用哪种 import"必须由壳文件的现读形态决定,不能凭写法猜。
 */
export function shellExportShapeOf(text) {
  const t = String(text ?? '')
  const names = new Set()
  for (const m of t.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1])
  for (const m of t.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const piece of m[1].split(',')) {
      const n = piece.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
      if (n && n !== 'default') names.add(n.trim())
    }
  }
  return { hasDefault: /export\s+default\b/.test(t), names }
}

/**
 * 一页对某个壳的取用形态(默认 / 具名),用于把"取用方式"和"壳的真导出"对上。
 * 返回 [{name, asDefault}] —— 同一壳被多处取用时逐条列,任一不符即点名。
 */
export function shellBindingsOf(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(
    /import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"]@rn-shells\/([A-Za-z0-9_]+)['"]|import\s+(\w+)\s+from\s*['"]@rn-shells\/([A-Za-z0-9_]+)['"]/g,
  )) {
    if (m[4]) out.push({ target: m[5], asDefault: true, imported: m[4] })
    else {
      for (const piece of m[2].split(',')) {
        const n = piece.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]
        if (n) out.push({ target: m[3], asDefault: false, imported: n })
      }
    }
  }
  return out
}

/**
 * 这页是否引了面上不存在的壳。`readTarget(rel)` 由调用方给(它决定判哪个面:HEAD / 索引 / 工作树),
 * 本模块不碰任何读取 ⇒ 面纪律(§0.4 同面同轮)留在调用方,不在这里被暗中固定成一个面。
 */
export function hasDanglingShell(text, readTarget) {
  for (const name of shellRefsOf(text)) {
    const t = readTarget(shellTargetRel(name))
    if (t === null || t === undefined) return name
  }
  return null
}

/** 这页对壳的取用形态与壳的真导出对不对得上;返回第一条不符的描述(全对则 null)。 */
export function mismatchedShellBinding(text, readShell) {
  for (const b of shellBindingsOf(text)) {
    const shape = shellExportShapeOf(readShell(shellTargetRel(b.target)) ?? '')
    if (b.asDefault && !shape.hasDefault)
      return `${b.target}:页面按默认导入 ${b.imported},而壳只有具名导出 {${[...shape.names].join(',')}} ⇒ 运行时拿到 undefined`
    if (!b.asDefault && !shape.names.has(b.imported))
      return `${b.target}:页面具名导入 ${b.imported},而壳的具名出口是 {${[...shape.names].join(',')}}`
  }
  return null
}

/**
 * 选承载壳:同名优先,否则取"文本里出现该共享屏名"的第一枚(按路径排序)。
 * refs = [rel, text] 的可迭代(Map / 数组);返回 { rel, name } 或 null(不编壳名)。
 *
 * 为什么允许异名:平台侧薄壳常叫 PlanScreen / NewsScreen 而它渲染的共享屏是
 * PlanListScreen / SquareScreen(现读 5 例被还原度尺判过 other,实为合法委托)。
 * 本函数只做**候选选择**;"壳真消费该屏"的强判据留给调用方(cov.rnConsumes /
 * hostingFormOf 的三腿),因为它要判 @ihui/rn-app 取用,而本模块不能反向 import 覆盖尺(成环)。
 */
export function pickCarrierShell(refs, sharedName) {
  const entries = [...refs]
  if (entries.length === 0) return null
  const re = new RegExp(`\\b${sharedName}\\b`)
  const carriers = entries.filter(([, t]) => re.test(String(t ?? ''))).map(([rel]) => rel)
  if (carriers.length === 0) return null
  const same = shellTargetRel(sharedName)
  const rel = carriers.includes(same) ? same : carriers.sort()[0]
  return { rel, name: rel.split('/').pop().replace(/\.tsx$/, '') }
}

/**
 * 页面是否**直接**渲染共享屏(不经 RN 壳):具名导入自 `@ihui/rn-app`(含深路径)且 JSX 真用该符号。
 * 这是与「@rn-shells 壳承载」并列的第二种合法委托形态(现读 pkg-about/about-shared/index:
 * 页面自己注入 t/colorScheme/onBack 等平台事实,布局与数据仍是共享源那一份)。
 * 只 import 不渲染不算(可能是类型或条件分支)——那种情况仍按手写逐键数,失效方向恒为"多算一份手写"。
 */
export function directSharedUsage(text, sharedName) {
  const t = String(text ?? '')
  const aliases = []
  for (const m of t.matchAll(/import\s+\{([^}]*)\}\s*from\s*['"]@ihui\/rn-app(?:\/[^'"]*)?['"]/g)) {
    for (const piece of m[1].split(',')) {
      const p = piece.trim().replace(/^type\s+/, '')
      if (!p) continue
      const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim())
      if (orig === sharedName) aliases.push(alias || orig)
    }
  }
  return aliases.find((a) => new RegExp(`<${a}(?=[\\s/>])`).test(t)) ?? null
}

/**
 * 页面从「声明的那一屏所在的共享模块」里渲染了**哪个**符号。
 *
 * 2026-11-13 立(port_all_23 B 类拍板)。立因:B 类拆子页(language/theme/avatar/member)是
 * 真单一源,但它们 import 的不是整屏 `SettingsScreen` 而是**该屏模块导出的一个 section**
 * (`SettingsLanguageSection` / `SettingsThemeSection` / `AvatarEditor` / `VipLevelsSection`,
 * 经 `@ihui/rn-app/features/<域>/<屏>` 深路径)。旧 `directSharedUsage` 只认「整屏名 ∧ JSX
 * 直用」⇒ 这四页判 hand,把整屏 21 键摊给只渲染 1 个 section 的子页 → 假缺口 21/21。
 *
 * 放宽到「同模块任一导出符号」后仍必须真渲染(只 import 不渲染不算,失效方向恒为多算手写,
 * 与 directSharedUsage 同一铁律)。返回值分两档:
 *   · `{ name, via:'direct' }` —— 渲染的正是整屏本体 ⇒ 调用方照旧记 hosted(分母=整屏)
 *   · `{ name, via:'section' }` —— 渲染的是 section/子组件 ⇒ 记 section(分母缩到该符号真消费的键)
 * 这档区分是**防假绿的关键**:section 收 props、t() 在父页时,整屏其它 section 的键绝不能被
 * 误算成「已还原」。识别「真渲染」用宽松匹配(JSX 标签 `<X` 或作为 prop 值 `=X` / `={X`)——
 * section 普遍以 `<X ... />` 直用,但也可能作为回调/渲染器传入,漏判会退回假缺口。
 */
export function renderedSharedSymbol(text, sharedName, moduleExportNames) {
  const t = String(text ?? '')
  const imports = []
  for (const m of t.matchAll(
    /import\s+\{([^}]*)\}\s*from\s*['"]@ihui\/rn-app(?:\/([^'"]*))?['"]/g,
  )) {
    const path = m[2] ? `/${m[2]}` : ''
    for (const piece of m[1].split(',')) {
      const p = piece.trim().replace(/^type\s+/, '')
      if (!p) continue
      const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim())
      // 整屏本体:符号名 == 屏名(不论从根 `@ihui/rn-app` 还是深路径导入)
      if (orig === sharedName) imports.push({ sym: alias || orig, kind: 'screen', path })
      else imports.push({ sym: alias || orig, kind: 'other', orig, path })
    }
  }
  // 渲染判定:JSX 标签 `<X`,或作为值传递 `=X` / `={X` / ` X,`(渲染器)。宽松但不把「只 import」
  // 算渲染 —— 那种页连这里都进不来(JSX/值位都搜不到该符号)。
  const rendered = (sym) =>
    new RegExp(`<${sym}(?=[\\s/>])`).test(t) || new RegExp(`[=(,]\\s*${sym}\\b`).test(t)
  // 优先整屏本体(保持 directSharedUsage 原语义)
  const screenHit = imports.find((i) => i.kind === 'screen' && rendered(i.sym))
  if (screenHit) return { name: screenHit.sym, via: 'direct' }
  // 其次:渲染的符号属「该屏模块的导出」⇒ section。moduleExportNames 取不到时退回「深路径
  // 同文件导入」作近似 —— 深路径 `@ihui/rn-app/features/<域>/<屏>` 的模块就是那一屏的文件。
  const screenPath = `/${String(sharedName).replace(/\.[jt]sx$/, '')}`
  const sectionHit = imports.find(
    (i) =>
      i.kind === 'other' &&
      rendered(i.sym) &&
      (Array.isArray(moduleExportNames)
        ? moduleExportNames.includes(i.orig)
        : i.path.endsWith(screenPath)),
  )
  if (sectionHit) return { name: sectionHit.sym, via: 'section' }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
