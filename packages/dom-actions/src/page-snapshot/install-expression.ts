// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注入表达式的**唯一装配点**：把页内安装函数变成一段"自带所需辅助符"的自足表达式。
 *
 * 为什么需要这个文件（`Function.prototype.toString()` 的固有约束）：
 * CLI 在页外，只能经 CDP `Runtime.evaluate` 把安装函数的**源码文本**送进页面执行。
 * `.toString()` 拿到的是**当前转译档案下的 JS 文本** —— 而打包器会往里注入自己的辅助符：
 * esbuild 的 keepNames 会给具名函数插 `__name(fn, "名字")`，而那个 `__name` 声明在**模块作用域**里，
 * 页面看不到。症状即"vitest 全绿、tsx/真实 CLI 路径每个页面快照必炸"
 * （`ReferenceError: __name is not defined`）。换打包器不算修好：可执行性绑在打包器上，
 * 下一个档案（minify / 别的转译器）会引出别的辅助符。
 *
 * 所以注入表达式必须**自带**它需要的东西。三条不变量：
 * 1. 需要哪些辅助符**按当次源码实测得出**（`injectedHelperNeeds` 扫源码），不是凭猜列一长串；
 * 2. 表达式字符串只在这里拼一次，CLI / 扩展两端共用，端内不得各拼一次；
 * 3. 页内函数体**仍不得闭包模块作用域的任何东西**（共享值一律经 `opts` 传入）—— 本文件只兜
 *    打包器辅助符这一类，兜不住"引用了模块里的常量/函数"那一类，后者由
 *    `apps/cli/tests/browser-page-snapshot-injection.test.ts` 的干净作用域回归钉死。
 */
import { pageApiInstallerSource, type IhuiPageApiOptions } from './page-api.js'

/**
 * 已知辅助符的实现表。**只登记实测出现过的**（当前转译档案下实测唯一命中 `__name`）。
 * 扫出来却不在表里的辅助符 ⇒ 装配期抛错，而不是把一段注定 `ReferenceError` 的表达式发进页面：
 * 抛在宿主侧可诊断，崩在页面里只会得到一次"快照失败"。
 */
const KNOWN_HELPER_IMPLS: Readonly<Record<string, string>> = {
  // esbuild keepNames：给函数挂上 name 后原样返回目标（与 esbuild 产出语义一致）
  __name: "function (target, value) { try { Object.defineProperty(target, 'name', { value: value, configurable: true }) } catch (e) {} return target }",
}

/** 辅助符命名形状：打包器注入的辅助一律是 `__camelCase` 且以**调用**形态出现。 */
const HELPER_CALL_SHAPE = /(^|[^$.\w])(__[a-z][A-Za-z0-9]*)\s*\(/g

/** 该标识符是否在源码里自带声明（有则不必我们兜）。 */
function declaredInSource(source: string, name: string): boolean {
  return new RegExp(`\\b(?:var|let|const|function|class)\\s+${name}\\b`).test(source)
}

/**
 * 实测源码**真正需要**的辅助符名（去重、按出现序）。
 * 保守偏多：字符串里恰好写着 `__foo(` 也会被算进来 —— 多定义一个辅助符无害，
 * 少定义一个则是页面里的 `ReferenceError`，所以宁可多算。
 */
export function injectedHelperNeeds(source: string): string[] {
  const needs: string[] = []
  for (const match of source.matchAll(HELPER_CALL_SHAPE)) {
    const name = match[2] as string
    if (needs.includes(name) || declaredInSource(source, name)) continue
    needs.push(name)
  }
  return needs
}

/** 把任意安装函数源码包成自足表达式（已知辅助符就地定义，未知的当场抛错）。 */
export function wrapInstallerSource(source: string, invocation: string): string {
  const needs = injectedHelperNeeds(source)
  const unknown = needs.filter((name) => !(name in KNOWN_HELPER_IMPLS))
  if (unknown.length > 0) {
    throw new Error(
      `注入源码引用了未登记的打包器辅助符：${unknown.join(', ')}。` +
        `请在 KNOWN_HELPER_IMPLS 里按该辅助符的真实语义补实现，并补一条干净作用域回归测试。`,
    )
  }
  const preamble = needs.map((name) => `var ${name} = ${KNOWN_HELPER_IMPLS[name]};`).join('\n')
  return `(function () {\n${preamble}\nreturn (${source})(${invocation});\n})()`
}

/**
 * 装配页内安装的**完整表达式字符串**（宿主直接把它交给 CDP / executeScript）。
 *
 * @param opts 注入选项（契约值由 `buildPageApiOptions` 装配，页内不自抄字面量）
 */
export function buildPageApiInstallExpression(opts: IhuiPageApiOptions): string {
  return wrapInstallerSource(pageApiInstallerSource(), JSON.stringify(opts))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
