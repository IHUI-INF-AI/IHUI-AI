#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `git grep -n <rev> -- <paths>` 的行格式解析 —— 全仓唯一实现。
 *
 * 为什么要有这个文件(守门 191 报的一对真复制逼出来的):门 `check-db-blind-updatedat-set.mjs`
 * 与镜像测试 `clamp-percent-single-source.test.mjs` 各写了一遍
 * `<rev>:<path>:<line>:<content>` 的拆解。复制的虽然只是"管线"不是判据,但**两处算同一个
 * 行格式必然漂开** —— 一旦有人改用别的 rev 前缀、或给路径加了转写,一侧改一侧不改的表现是
 * "普查少了一批行而账面全绿"(与本仓"判据失效的表现永远是安静"同一条禁令)。
 *
 * 语义与两处的原写法逐字等价:路径不得含冒号(含则判不出、返回 null,不猜),行号必须是纯数字。
 */
import { pathToFileURL } from 'node:url'

/** 一行的前缀:`<rev>:`。抽出来是为了让"换 rev"只有一处要改。 */
export function grepRowPrefix(rev = 'HEAD') {
  return `${rev}:`
}

/**
 * 拆一行 `git grep -n` 输出。
 * @returns {{path:string,line:number,text:string}|null} 拆不出即 null(调用方必须跳过而不是猜)
 */
export function parseGrepRow(row, rev = 'HEAD') {
  const s = String(row ?? '')
  const prefix = grepRowPrefix(rev)
  if (!s.startsWith(prefix)) return null
  const m = s.slice(prefix.length).match(/^([^:]+):(\d+):(.*)$/)
  if (!m) return null
  return { path: m[1], line: Number(m[2]), text: m[3] }
}

/** 只要路径的场合:明确是 parseGrepRow 的投影,不得再写第二条行格式正则。 */
export function grepRowPath(row, rev = 'HEAD') {
  return parseGrepRow(row, rev)?.path ?? null
}

/**
 * 只读自检(构造面,不碰仓库):四条各自正反成对,给"共用层被绕开"留一条会响的尺。
 * 出口 rc:0 全绿 / 1 有失败。
 */
function selfTest() {
  const results = []
  const eq = (label, got, want) => results.push({ label, ok: got === want, got, want })
  eq(
    '正常行拆出三段',
    JSON.stringify(parseGrepRow('HEAD:apps/api/src/x.ts:12:const a = 1')),
    JSON.stringify({ path: 'apps/api/src/x.ts', line: 12, text: 'const a = 1' }),
  )
  eq(
    '非该 rev 前缀 ⇒ null(不猜一个方向)',
    String(parseGrepRow('main:apps/a.ts:1:x', 'HEAD')),
    'null',
  )
  eq(
    '换 rev 只改入参 ⇒ 同一实现照样拆',
    parseGrepRow('main:apps/a.ts:1:x', 'main')?.path,
    'apps/a.ts',
  )
  eq('路径含冒号时判不出而不是错拆', String(parseGrepRow('HEAD:a:b.ts:1:x')), 'null')
  eq('行号非数字判不出', String(parseGrepRow('HEAD:a.ts:x:1')), 'null')
  eq(
    'grepRowPath 是 parseGrepRow 的投影(同一夹具同答案)',
    grepRowPath('HEAD:apps/api/src/x.ts:12:const a = 1'),
    parseGrepRow('HEAD:apps/api/src/x.ts:12:const a = 1').path,
  )
  eq('空行不抛错', String(parseGrepRow('')), 'null')
  let failed = 0
  for (const x of results) {
    console.log(`${x.ok ? '✅' : '❌'} ${x.label}${x.ok ? '' : ` got=${x.got} want=${x.want}`}`)
    if (!x.ok) failed++
  }
  console.log(`git-grep-rows 自检 ${results.length} 例,失败 ${failed}`)
  return failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (process.argv.includes('--self-test')) {
    process.exitCode = selfTest()
  } else {
    console.log(
      '用法: node scripts/lib/git-grep-rows.mjs --self-test(本模块是给门与测试 import 的共用层)',
    )
  }
}

export const __test__ = { selfTest, grepRowPrefix, parseGrepRow, grepRowPath }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
