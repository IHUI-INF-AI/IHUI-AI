// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-675:HookActionConfig 的跨族矛盾组合必须在**构造点**判 TS2322。
 *
 * 这一族的字段互斥此前只存在于 apps/ai-service 的 Pydantic 分支,类型层是全 optional 的
 * 平铺接口 ⇒ 任何组合都能构造。判据搬到类型层之后,"用例"也必须是类型级的 —— 而
 * packages/types 的 tsconfig 只把 src 纳入 typecheck(本仓各端一致把 tests 排除在外),
 * 所以把 `@ts-expect-error` 写在这里**永远不会被求值**。本文件因此用 TypeScript 编译器
 * API 现编一个探针 Program,把"应报错"与"不应报错"的片段各喂一次:
 *   ① 正例 ⇒ 0 条诊断 —— 这一条同时是本把尺子的**有牙证明**:探针 harness 若坏了
 *      (模块解析不到 hooks.ts、路径未归一、lib 缺失),正例那臂会一起红,而不是静默通过;
 *   ② 负例 ⇒ 必出 TS2322;
 *   ③ 反向对照 ⇒ 去掉矛盾键后同一表达式必须落回 0 诊断(证明红的是矛盾组合本身)。
 * 探针文件只存在于内存 host 里、且必须放在 rootDir 之内(否则 TS6059 not under rootDir),
 * 全程不落盘(§15 工作区卫生:不在仓库内造临时产物)。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 虚拟探针路径:必须在 rootDir(src)之内,且带正斜杠以匹配 TS 内部的规范路径。 */
const PROBE_PATH = `${(PKG_DIR + '/src/__g675_probe__.ts').replace(/\\/g, '/')}`
const normPath = (p: string) => p.replace(/\\/g, '/').toLowerCase()
const PROBE_KEY = normPath(PROBE_PATH)

const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(resolve(PKG_DIR, 'tsconfig.json'), (p) => readFileSync(p, 'utf8')).config,
  ts.sys,
  PKG_DIR,
)
const OPTIONS: ts.CompilerOptions = { ...parsed.options, noEmit: true }
// 平铺出来的增量编译选项在单文件 Program 上不成立(TS5074),逐键摘掉。
delete OPTIONS.incremental
delete OPTIONS.tsBuildInfoFile
delete OPTIONS.composite

/**
 * 一次编一个片段,返回全部诊断(语法 + 类型)。
 *
 * 为什么要自建 host 并缓存 SourceFile:每个用例都 `ts.createCompilerHost(...)` + 新 Program,
 * 就要把 `lib.*.d.ts` 与 `hooks.ts` 的整棵声明图**重新读盘 + 重新解析**一遍。12 个用例 ⇒ 12 份
 * 同样的成本。本地实测 ~250ms/例还能忍,CI runner 上同一枚文件直接越过 vitest 默认 5000ms
 * 超时(实测红在 :94 / :98 / :105 三处,报 "Test timed out in 5000ms")—— 而红的表现是
 * "测试超时",不是"判据不成立",很容易被人当成 CI 抖动重跑一次了事。
 *
 * 缓存的**只有探针以外**的真实文件:这些 .d.ts 在一次进程内不会变,解析结果可以安全共享
 * (TS 的 SourceFile 解析后视为不可变;类型信息住在每个 Program 自己的 Checker 里,不跨 Program)。
 * 探针文件每次重新解析 ⇒ 用例之间**不共享诊断**。这条隔离不是靠我说:最后那条反向对照
 * (一个干净表达式必须落 0 诊断)跑在 11 条负例之后,任何"上一个用例的 TS2322 漏到下一个"
 * 都会让它当场红。
 */
const host = ts.createCompilerHost(OPTIONS, true)
const realGetSourceFile = host.getSourceFile.bind(host)
const realFileExists = host.fileExists.bind(host)
const realReadFile = host.readFile.bind(host)
const parsedFileCache = new Map<string, ts.SourceFile>()
/** 当前探针内容;host 的 readFile/getSourceFile 按它取值(每次 diagnose 前替换)。 */
let probeSnippet = ''

host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
  if (normPath(fileName) === PROBE_KEY) {
    return ts.createSourceFile(PROBE_PATH, probeSnippet, languageVersion, true, ts.ScriptKind.TS)
  }
  const cacheKey = `${normPath(fileName)}@${languageVersion}`
  const hit = parsedFileCache.get(cacheKey)
  if (hit) return hit
  const created = realGetSourceFile(fileName, languageVersion, onError, shouldCreate)
  if (created) parsedFileCache.set(cacheKey, created)
  return created
}
host.fileExists = (fileName) => normPath(fileName) === PROBE_KEY || realFileExists(fileName)
host.readFile = (fileName) =>
  normPath(fileName) === PROBE_KEY ? probeSnippet : realReadFile(fileName)

function diagnose(snippet: string): readonly ts.Diagnostic[] {
  probeSnippet = snippet
  // 刻意**不**把上一次的 Program 当 oldProgram 传进去:那只省一点绑定成本,代价是
  // "诊断跨用例泄漏"变成一个可能被读成绿色的形态。省下的这点不值这个风险。
  return ts.getPreEmitDiagnostics(ts.createProgram([PROBE_PATH], OPTIONS, host))
}

const describeDiags = (diags: readonly ts.Diagnostic[]) =>
  diags.map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)

const HEAD = `import type { HookActionConfig } from './hooks.js'\n`

/** 正例:四族各自合法的组合,以及两侧都缺席的空配置(`config` 允许 `{}`)。 */
const VALID = `${HEAD}
export const w: HookActionConfig = { url: 'https://a.example/hook' }
export const w2: HookActionConfig = { url: 'https://a.example/hook', method: 'POST', headers: { 'x-a': '1' }, body: '{{event}}' }
export const s: HookActionConfig = { command: 'echo hi' }
export const n: HookActionConfig = { channel: 'toast', message: '{{event}} 完成' }
export const n2: HookActionConfig = { channel: 'webhook' }
// notify × webhook 渠道同键:apps/web/src/stores/hooks.ts 构造的真形态(执行侧 _run_notify
// 的 webhook 分支就读 url/method/headers)——它必须编译得动,否则类型层是在钉红正当写法。
export const nw: HookActionConfig = { channel: 'webhook', url: 'https://a.example/hook', method: 'POST', headers: { 'x-a': '1' }, message: 'm' }
export const l: HookActionConfig = { message: 'log line' }
export const empty: HookActionConfig = {}
`

/** 负例:每一行都是一个跨族矛盾组合(两键同给),按票面要求必 TS2322。 */
const INVALID: readonly string[] = [
  '{ url: "https://a.example/hook", command: "echo hi" }', // webhook × script
  '{ url: "https://a.example/hook", channel: "toast" }', // webhook × notify
  '{ url: "https://a.example/hook", message: "hi" }', // webhook × notify/log
  '{ command: "echo hi", channel: "toast" }', // script × notify
  '{ command: "echo hi", message: "hi" }', // script × notify/log
  '{ channel: "email", url: "https://a.example/hook" }', // notify × webhook(反序同判)
  '{ headers: { "x-a": "1" }, command: "echo hi" }', // webhook 附属键 × script
  '{ body: "{{event}}", channel: "toast" }', // webhook 附属键 × notify
  // 渠道设错仍不可构造:webhook 那批键只随 channel:'webhook' 合法(放行真形态不等于放开一切)
  '{ channel: "toast", url: "https://a.example/hook" }',
  '{ channel: "email", command: "echo hi" }',
]

/**
 * 预热整棵声明图(lib.*.d.ts + hooks.ts 的模块解析),把这**一次性**成本搬到 import 阶段。
 *
 * 缓存 host 之后,第一个用例仍要独自承担第一次真实读盘 + 解析(本地实测 403ms,其余用例
 * 59–83ms)。本地看不出问题,而 CI runner 上这枚文件此前**每一枚**用例都超 5000ms(≈17 倍
 * 慢),所以"只有第一枚慢"在 CI 上就是"第一枚红"。放在模块顶层 ⇒ 它落在 vitest 的 import
 * 阶段,不计进任何单用例的 testTimeout(本文件没有配 testTimeout,用的就是默认 5000ms)。
 * 结果:12 枚用例本地全部 ≤83ms,最快的那台 CI 上也不接近阈值。
 */
diagnose(`${HEAD}export const __warmup__: HookActionConfig = {}\n`)

describe('G-675 · HookActionConfig 跨族互斥在构造点不可赋值', () => {
  beforeAll(() => {
    // 上面那行预热必须**真的跑过**:摘掉它时这一条必须红。否则第一枚用例又会在 CI 上独自
    // 承担整棵 lib 图的解析 —— 本地 403ms 完全看不出问题,而 CI 上是 5000ms 超时。
    // 判据只问"缓存里有没有东西",不问数量对不对:预热失败的唯一表现就是它空着。
    expect(parsedFileCache.size, '编译探针的 SourceFile 缓存未被预热').toBeGreaterThan(0)
  })

  it('探针 harness 有牙:各族正例(含 notify×webhook 真形态)+ 空配置 ⇒ 零诊断', () => {
    expect(describeDiags(diagnose(VALID))).toEqual([])
  })

  it.each(INVALID)('负例 %s ⇒ 必出 TS2322', (expr) => {
    const codes = diagnose(`${HEAD}export const bad: HookActionConfig = ${expr}\n`).map(
      (d) => d.code,
    )
    expect(codes).toContain(2322)
  })

  it('反向对照:去掉矛盾键后不得再报 TS2322', () => {
    const diags = diagnose(
      `${HEAD}export const ok: HookActionConfig = { url: "https://a.example/hook" }\n`,
    )
    expect(diags.map((d) => d.code)).not.toContain(2322)
    expect(diags).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
