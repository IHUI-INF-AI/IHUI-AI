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
import { describe, it, expect } from 'vitest'
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

/** 把片段当作内存文件编一次,返回全部诊断(语法 + 类型)。 */
function diagnose(snippet: string): readonly ts.Diagnostic[] {
  const host = ts.createCompilerHost(OPTIONS, true)
  const realGetSourceFile = host.getSourceFile.bind(host)
  const realFileExists = host.fileExists.bind(host)
  const realReadFile = host.readFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    normPath(fileName) === PROBE_KEY
      ? ts.createSourceFile(PROBE_PATH, snippet, languageVersion, true, ts.ScriptKind.TS)
      : realGetSourceFile(fileName, languageVersion, onError, shouldCreate)
  host.fileExists = (fileName) => normPath(fileName) === PROBE_KEY || realFileExists(fileName)
  host.readFile = (fileName) =>
    normPath(fileName) === PROBE_KEY ? snippet : realReadFile(fileName)
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
]

describe('G-675 · HookActionConfig 跨族互斥在构造点不可赋值', () => {
  it('探针 harness 有牙:四族正例 + 空配置 ⇒ 零诊断', () => {
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
