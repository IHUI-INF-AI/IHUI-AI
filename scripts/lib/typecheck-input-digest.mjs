// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// tsc 输入面摘要(typecheck 回执的键)。
//
// 立因(2026-11-18,机主实测):typecheck 单门 136s,占一次推送 160s 的 85%。它的回执键是
// `HEAD^{tree}` ⇒ 任何文件变化(README、plan、脚本、甚至一次 lint 改写)都会让 tree 变 ⇒
// 回执必失效 ⇒ 每次提交后都跑一遍全量 tsc。多 agent 并行时,别人改一个 md,你的类型结论就作废。
//
// 判据(与 check-typecheck.mjs 头注「无 TS 输入面档」同一条论证,只换用途):
//   tsc 的结论只由 **program 的输入文件内容 + 编译配置** 决定;这些字节不变,结论必然不变。
// 所以回执键取「全部 TS 输入条目的 (路径, blob sha) 排序后的 sha256」,而不是整棵树。
//
// 保守边界(任一不满足 ⇒ 调用方回落到整棵树键,宁慢勿假绿):
//   ① 树清单取不到(git 失败/超时) ⇒ 返回 null;
//   ② 任一 tsconfig 开 `allowJs:true` ⇒ .js/.jsx/.mjs/.cjs 也进 program,本 lib 不猜,直接 null;
//   ③ 条目数异常(0) ⇒ 返回 null。
// 刻意做宽的部分(宁可多失效一次,也不漏掉输入):
//   - `packages/tsconfig/**` 这类共享基座(文件名不含 tsconfig)按目录前缀纳入;
//   - 任何层级的 package.json / pnpm-lock.yaml / pnpm-workspace.yaml / .npmrc 纳入(workspace 拓扑);
//   - 所有 tsconfig*.json 纳入(extends 链)。
import { createHash } from 'node:crypto'

export const TS_INPUT_EXT_RE = /\.(ts|tsx|mts|cts)$/i
export const JS_INPUT_EXT_RE = /\.(js|jsx|mjs|cjs)$/i
export const TS_INPUT_BASENAMES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
])
export const SHARED_TSCONFIG_DIRS = ['packages/tsconfig/']

/**
 * 解析 `git ls-tree -r -z HEAD` 的输出(NUL 分隔)。
 * @param {string} raw
 * @returns {Array<{mode:string,type:string,sha:string,path:string}>}
 */
export function parseLsTree(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return []
  const out = []
  for (const rec of raw.split('\0')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).split(' ')
    if (meta.length < 3) continue
    out.push({ mode: meta[0], type: meta[1], sha: meta[2], path: rec.slice(tab + 1) })
  }
  return out
}

/** 该路径是否是 tsc program 的输入(不含 allowJs 时的 .js 家族)。 */
export function isTsInputPath(p, { allowJs = false } = {}) {
  const f = String(p).replace(/\\/g, '/')
  const base = f.slice(f.lastIndexOf('/') + 1)
  if (TS_INPUT_EXT_RE.test(f)) return true
  if (allowJs && JS_INPUT_EXT_RE.test(f)) return true
  if (TS_INPUT_BASENAMES.has(base)) return true
  if (/^tsconfig.*\.json$/i.test(base)) return true
  if (SHARED_TSCONFIG_DIRS.some((d) => f.startsWith(d))) return true
  return false
}

/**
 * 从条目清单算摘要。只算 blob(ls-tree 里的 tree 条目不含内容,但目录本身不构成 tsc 输入)。
 * @returns {{digest:string, count:number, jsFamily:number}}
 */
export function digestEntries(entries, { allowJs = false } = {}) {
  const rows = []
  let jsFamily = 0
  for (const e of entries || []) {
    if (!e || e.type !== 'blob') continue
    if (!isTsInputPath(e.path, { allowJs })) continue
    if (!TS_INPUT_EXT_RE.test(e.path) && JS_INPUT_EXT_RE.test(e.path)) jsFamily += 1
    rows.push(`${e.path}\0${e.sha}\n`)
  }
  rows.sort()
  const digest = createHash('sha256').update(rows.join('')).digest('hex').slice(0, 40)
  return { digest, count: rows.length, jsFamily }
}

/**
 * 环境指纹:tsc 还会读 node_modules 里的第三方 .d.ts 与各包 dist。
 * 依赖树/编译器版本变了就必须让回执失效 —— 用「node 版本 + typescript 版本 + node_modules 布局文件尺寸」近似。
 * 取不到的部分写成 `unknown`(仍参与比较,保证"同一未知值"不会误命中跨环境)。
 */
export function envFingerprint({ nodeVersion, tsVersion, nodeModulesLayoutSize }) {
  return [
    `node=${nodeVersion || 'unknown'}`,
    `ts=${tsVersion || 'unknown'}`,
    `nm=${Number.isFinite(nodeModulesLayoutSize) ? nodeModulesLayoutSize : 'unknown'}`,
  ].join(';')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
