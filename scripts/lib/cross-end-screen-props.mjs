// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * cross-end-screen-props.mjs —— 共享屏「必填 props」的权威解析器(判据单源,供造页器与守门 import)。
 *
 * 为什么不能用正则猜:第一版探针按 `interface X {...}` 全文抽字段,把屏内的**数据项类型**
 * (AutomationItem 的 id/name/active…)当成屏的 props,又把 props 本体在别处声明的那 76 枚
 * 读成"无必填 props"⇒ 量出「可当场复用 0 枚」。那是坏尺子,不是仓库的事实(§0.3:取不准
 * 必须显式未判定,不能拿假 0 冒充结论)。正解 = 让类型系统自己回答。
 *
 * 口径:
 *  - 编译面取 **apps/mobile-rn/tsconfig.json**(packages/app 本就在 RN 端被 typecheck,
 *    react-native / lucide 的类型只在那儿齐);解析不出 ⇒ 逐条落 `undetermined`,不记绿也不记红。
 *  - 必填 = props 类型里非 optional 的属性名;平台可注入档见 INJECTABLE(取词/主题/导航回调)。
 *  - 判定分三档:`reusable`(必填全落在可注入集) / `needs-data(点名缺哪些)` / `undetermined`。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const RN_TSCONFIG = join(ROOT, 'apps', 'mobile-rn', 'tsconfig.json')

/** 平台侧能当场注入的 prop(不需要业务数据):取词、主题档、返回/跳转类回调、入口清单 */
export const INJECTABLE = new Set([
  't',
  'tt',
  'tx',
  'colorScheme',
  'scheme',
  'theme',
  'themeMode',
  'resolvedTheme',
  'tokens',
  'styles',
  'onBack',
  'onClose',
  'onDismiss',
  'onRetry',
  'onPress',
  'onNavigate',
  'onRegister',
  'onOpenPortal',
  'onShare',
  'navigate',
  'navigation',
  'entries',
  'actions',
  'className',
  'testID',
])

let programCache = null

function loadProgram() {
  if (programCache) return programCache
  const cfgFile = ts.readConfigFile(RN_TSCONFIG, ts.sys.readFile)
  if (cfgFile.error) throw new Error(`读不到 ${RN_TSCONFIG}:${ts.flattenDiagnosticMessageText(cfgFile.error.messageText, ' ')}`)
  const parsed = ts.parseJsonConfigFileContent(cfgFile.config, ts.sys, dirname(RN_TSCONFIG))
  programCache = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true, skipLibCheck: true },
  })
  return programCache
}

/** 取某共享屏文件里那个 *Screen 导出组件的 props 必填字段名 */
export function requiredPropsOf(specRel) {
  const absolute = join(ROOT, specRel)
  let program
  try {
    program = loadProgram()
  } catch (error) {
    return { state: 'undetermined', reason: `编译面取不到:${String(error?.message ?? error).slice(0, 120)}`, required: [] }
  }
  const source = program.getSourceFile(absolute)
  if (!source) return { state: 'undetermined', reason: '该文件不在 RN 编译面里(路径或 tsconfig include 漂移)', required: [] }
  const checker = program.getTypeChecker()
  const symbol = checker.getSymbolAtLocation(source)
  if (!symbol) return { state: 'undetermined', reason: '模块符号解析失败', required: [] }

  const candidates = checker
    .getExportsOfModule(symbol)
    .filter((s) => /Screen$/.test(s.getName()) || /Screen$/.test(s.getName().replace(/^Shared/, '')))
  if (candidates.length === 0) {
    return { state: 'undetermined', reason: '模块出口里没有 *Screen 组件(出口形态漂移)', required: [] }
  }

  const propsTypes = []
  for (const cand of candidates) {
    const decl = cand.valueDeclaration ?? cand.declarations?.[0]
    if (!decl) continue
    const sig = checker.getSignatureFromDeclaration(decl)
    const param = sig?.getParameters?.()[0]
    if (param) {
      propsTypes.push(checker.getTypeOfSymbol(param))
      continue
    }
    // 变量式导出(const XScreen = (props) => …):取声明类型的第一个参数
    const t = checker.getTypeOfSymbolAtLocation(cand, decl)
    for (const s of t.getCallSignatures()) {
      const p = s.getParameters()[0]
      if (p) propsTypes.push(checker.getTypeOfSymbol(p))
    }
  }
  if (propsTypes.length === 0) {
    return { state: 'undetermined', reason: '组件签名里没有 props 参数(可能是零 props 组件)', required: [] }
  }

  const required = new Set()
  for (const type of propsTypes) {
    for (const prop of type.getProperties()) {
      if ((prop.flags & ts.SymbolFlags.Optional) === 0) required.add(prop.getName())
    }
  }
  const list = [...required].sort()
  const unknown = list.filter((n) => !INJECTABLE.has(n))
  return {
    state: unknown.length === 0 ? 'reusable' : 'needs-data',
    required: list,
    unknown,
  }
}

export const __test__ = { requiredPropsOf, INJECTABLE, ROOT, RN_TSCONFIG }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
