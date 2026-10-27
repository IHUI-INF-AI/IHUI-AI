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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
