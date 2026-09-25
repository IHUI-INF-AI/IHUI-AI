#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(scripts/guardian-runner.mjs 现值为准,勿照抄文档编号):miniapp 原生 chrome 派生对账。
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-chrome.mjs — 判 `apps/miniapp-taro/src/theme.json` 与
 * `apps/miniapp-taro/src/lib/theme.ts`(THEME_CHROME)两份原生 chrome 副本是否仍是
 * `packages/design-tokens/src/styles/tokens.css` 的派生态。
 *
 * 立项依据(AGENTS §4「端内 CSS/色值副本一律是派生态」):这两份副本此前**零覆盖** —— 没有任何
 * 生成器写它、没有任何守门看它(`grep -rl "theme.json" scripts/*.mjs` 立项时零命中)。写副本的人
 * 与改 token 的人不重叠时,唯一能兜住的就是这道门。
 * 写回的一侧是 `scripts/sync-miniapp-chrome.mjs`;**判据只有那一份实现**(本门 import 其 checkChrome,
 * 不重写第二套判据 —— 同一判据两处不同形是本仓反复记录的成因)。
 *
 * 四类红(与生成器 syncCopies 的 blocking/drifted 分流同形):
 *   drifted        派生字段 ≠ tokens.css 对应档(修复 = 跑生成器,原位写回)
 *   thirdValue     登记字段被改成"登记值与源头值之外的第三个值"(改副本必须同改登记与理由)
 *   rot            登记表腐烂:登记值与 nearToken 源头重新同值 ⇒ 这条分歧不再成立,删登记挪回派生
 *   unregistered   副本出现派生表与登记表都盖不住的色值键(新字段或被静默摘走的登记)
 * 无法判定(源头缺档 / 结构不认识 / 取不到文件)⇒ **exit 2**,既不冒红也不记绿。
 * 非色枚举字段(navTxtStyle / tabBorderStyle / tabBorder)只计数,不属本门。
 *
 * 取材面(与守门 36 同口径):默认判**磁盘**,`--staged` 判**索引 blob**(这次提交会带走的那一份;
 * 盘上随后改对不算修好)。任一面取不到 ⇒ exit 2。
 *
 * 用法:
 *   node scripts/check-miniapp-chrome.mjs            全量(磁盘)
 *   node scripts/check-miniapp-chrome.mjs --staged   索引面
 *   node scripts/check-miniapp-chrome.mjs --quiet    只出错才说话
 *   node scripts/check-miniapp-chrome.mjs --self-test 判红→退出码映射的自检(纯内存,不碰真仓)
 * 退出码:0 = 一致;1 = drifted/thirdValue/rot/unregistered;2 = 无法判定
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { gitRaw } from './lib/face-reader.mjs'
import {
  checkChrome,
  classifyFailures,
  TOKENS_SOURCE_REL,
  THEME_JSON_REL,
  THEME_TS_REL,
} from './sync-miniapp-chrome.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const staged = args.includes('--staged')

function gitShow(spec) {
  try {
    return gitRaw(['show', spec], root, { maxBuffer: 1 << 28 })
  } catch {
    return null
  }
}

/** 判哪个面就按哪个面取**全部三份**:源与两份副本混面会产出与真实提交相反的结论。 */
function readFace(rel) {
  if (!staged) {
    try {
      return readFileSync(join(root, rel), 'utf8')
    } catch {
      return null
    }
  }
  const idx = gitShow(`:${rel}`)
  return idx === null ? gitShow(`HEAD:${rel}`) : idx
}

/** 纯映射: failures → { red, undetermined } —— 与生成器 blocking 分流同形,自检钉的就是它。 */
function verdictOf({ failures }) {
  const { red, undetermined } = classifyFailures(failures)
  const note = red.filter((f) => f.kind === 'rot').length
  return { red, undetermined, rotCount: note }
}

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)
  const mk = (kind) => ({ kind, target: 'x', where: 'light.y', value: '#000000' })
  const v1 = verdictOf({
    failures: [mk('drifted'), mk('thirdValue'), mk('rot'), mk('unregistered'), mk('undeterminedInfo')],
  })
  ok('X1 四类红 + 未判定混合输入 ⇒ red 恰 4 / undetermined 恰 1 / rot 计数 1',
    v1.red.length === 4 && v1.undetermined.length === 1 && v1.rotCount === 1,
    JSON.stringify({ red: v1.red.length, und: v1.undetermined.length, rot: v1.rotCount }))
  const v2 = verdictOf({ failures: [] })
  ok('X2 空清单 ⇒ 双零(绿)', v2.red.length === 0 && v2.undetermined.length === 0)
  const v3 = verdictOf({ failures: [mk('undeterminedInfo')] })
  ok('X3 只有未判定 ⇒ 不记红(红绿都不能冒,exit 2 语义)', v3.red.length === 0 && v3.undetermined.length === 1)
  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

function main() {
  if (args.includes('--self-test')) return selfTest()
  const tokensCss = readFace(TOKENS_SOURCE_REL)
  const themeJson = readFace(THEME_JSON_REL)
  const themeTs = readFace(THEME_TS_REL)
  const missing = [
    [TOKENS_SOURCE_REL, tokensCss],
    [THEME_JSON_REL, themeJson],
    [THEME_TS_REL, themeTs],
  ].filter(([, t]) => t === null)
  if (missing.length) {
    console.error(
      `[check-miniapp-chrome] 取不到 ${missing.map(([r]) => r).join(' / ')} ⇒ 无法判定(不记为通过)`
    )
    process.exit(2)
  }
  let verdict
  try {
    verdict = checkChrome({ tokensCss, themeJson, themeTs })
  } catch (e) {
    console.error(`[check-miniapp-chrome] 副本结构不认识: ${e.message} ⇒ 无法判定`)
    process.exit(2)
  }
  const { red, undetermined } = verdictOf(verdict)
  if (undetermined.length) {
    for (const f of undetermined)
      console.error(`[check-miniapp-chrome] ⚠️ 无法判定 ${f.target} ${f.where}: ${f.why ?? '源头档缺失'}`)
    console.error('[check-miniapp-chrome] 既不冒红也不记绿 —— 先修源头档或映射表。')
    process.exit(2)
  }
  if (red.length === 0) {
    if (!quiet)
      console.log(
        `[check-miniapp-chrome] ✅ 两份 chrome 副本与 tokens.css 同形(派生 ${verdict.counts.derived} / 登记 ${verdict.counts.registered};另有 ${verdict.counts.nonColor} 个非色字段不属本门)`
      )
    process.exit(0)
  }
  for (const f of red)
    console.error(
      `  ❌ ${f.kind} ${f.target} ${f.where}: 现值 ${f.value}` +
        (f.want ? ` ≠ 源头 ${f.want}(${f.token})` : '') +
        (f.registered ? `(登记值 ${f.registered}${f.nearToken ? `,nearToken ${f.nearToken}` : ''})` : '') +
        (f.why ? ` —— ${f.why}` : '')
    )
  console.error(`[check-miniapp-chrome] Found ${red.length} 处红(取材面:${staged ? '索引' : '磁盘'})`)
  console.error('  漂移类修复:node scripts/sync-miniapp-chrome.mjs(原位写回,幂等;thirdValue 会写回登记值)')
  console.error('  rot/unregistered:归表必须显式 —— 见 scripts/sync-miniapp-chrome.mjs 的两张表与依据。')
  process.exit(1)
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { verdictOf, readFace }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
