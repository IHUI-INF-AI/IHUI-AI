#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 194 —— 台账"同题多号"检测(2026-10-13 立,根治同题跨号漂移)
 *
 * 根因链(机主 2026-10-13 拍板根治):
 *   ① 取号令牌 {{NEXT_ID}} 只查"号是否空闲",不查"题是否已登记" ⇒ 并发取号撞号后
 *      让号重登,每次重登都是一份新副本;
 *   ② union 并集合并把"两侧各自的旧态副本"当成各自独有整批带回(G-461);
 *   ③ F4 逐字等值判据抓不住"正文有漂移的同题副本"(G-1104165) ⇒ 同题不同号永久漂移,
 *      派单口径被同题多行灌水,"任务永远做不完"。
 *
 * 判据:对每条未勾登记行提取"标题指纹"(归一化:去编号引用/日期/注记段/空白/标点),
 * 指纹相同且票号不同的行 ⇒ "同题多号"组。指针行(〔【归并】开头,自述不再单独派单)
 * 不算独立任务,豁免。已勾行随归档走,不在本门视野。
 *
 * 档位:默认档只报数(存量先清偿,避免恒红门逼人 --no-verify);--strict 判红(exit 1)。
 * 配套:取号器(live-doc-edit {{NEXT_ID}} 展开处)发号前调 extractTaskFingerprint
 * 查重,命中同题拒发号(2026-10-13 同批接线)。
 * 跳过:HUSKY_SKIP_PLAN_DUP_TITLE=1(慎用:跳过即放行同题漂移回潮)。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const LEDGER_NAME = 'PROJECT_PLAN.md'

/** 指纹提取:从登记行提取归一化标题指纹(导出供取号器与镜像测试复用,§22d) */
export function extractTaskFingerprint(line) {
  if (typeof line !== 'string') return null
  let s = line.trim()
  if (!/^- \[[ x]\]/.test(s)) return null
  // 指针行/租约残行:自述不再单独派单,不算独立任务。
  // 覆盖形态:行首〔【归并】/【【归并】/（【归并】,以及状语在前(如 (待派/XX)〔【归并】…)的行内归并注记
  if (/^-\s*\[[ x]\]\s*[〔（【]{0,2}\s*【归并】/.test(s)) return null
  if (/【归并】(重复登记副本|同题多号收拢)/.test(s) && /不再单独派单|让号|派单以那条为准|派单以持有行为准/.test(s)) return null
  // 去行首 checkbox
  s = s.replace(/^-\s*\[[ x]\]\s*/, '')
  // 去前置状语:(进行中@...)/(待派/XXX)/✅(date) 等
  s = s.replace(/^[（(【\[]?(进行中|待派|已完成|✅)[^】）)〕\]]*[】）)〕\]]?\s*/g, '')
  s = s.replace(/^✅\(\d{4}-\d{2}-\d{2}\)\s*/, '')
  // 去注记段(〔…〕)——注记是进度/归并留痕,不参与身份
  s = s.replace(/〔[^〕]*〕/g, '')
  // 提取标题段:标题=粗体内文本;粗体恰是票号时取其后至"——"前;无粗体取票号后至"——"前
  // (尾巴"—— 详情/取证…"是各会话各自写的进度叙述,不参与身份)
  const bold = s.match(/\*\*([^*]+)\*\*/)
  let title = ''
  if (bold) {
    if (/^[A-Z]-?\d+/.test(bold[1].replace(/[.。:：\s]/g, ''))) {
      const after = s.slice((bold.index ?? 0) + bold[0].length)
      title = after.split(/——|--/)[0] || bold[1]
    } else {
      title = bold[1]
    }
  } else {
    title = s.split(/——|--/)[0]
  }
  // 归一化:小写、去编号引用、去日期、去空白与标点差异
  title = title.toLowerCase()
  title = title.replace(/[a-z]{1,3}-?\d{2,}/g, '') // 编号引用 G-123/G-99/D1047/O86…
  title = title.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '') // 日期
  title = title.replace(/[\s\p{P}\p{S}]+/gu, '') // 空白+标点+符号
  // 长度门槛:按"有效权重"算(中日韩字符权重 2,其余 1)——中英文标题量纲统一
  let weight = 0
  for (const ch of title) weight += /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 1
  if (weight < 16) return null // 过短指纹不可靠,不参与对账
  return title.slice(0, 60)
}

/** 从台账全文找同题多号组(导出供镜像测试复用) */
export function findDuplicateGroups(content) {
  const byFp = new Map()
  const lines = String(content ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^- \[ \]/.test(raw)) continue // 只审未勾行
    const fp = extractTaskFingerprint(raw)
    if (!fp) continue
    const ids = [...raw.matchAll(/\b([A-Z])-(\d{2,})\b/g)].map((m) => `${m[1]}-${m[2]}`)
    const selfId = ids[0] ?? null
    if (!byFp.has(fp)) byFp.set(fp, [])
    byFp.get(fp).push({ line: i + 1, selfId, preview: raw.slice(0, 120) })
  }
  const groups = []
  for (const [fp, members] of byFp) {
    const distinctIds = new Set(members.map((m) => m.selfId).filter(Boolean))
    // 同题且票号不同(或同号多行——那归 F4/F10,本门只管跨号)
    if (members.length > 1 && distinctIds.size > 1) {
      groups.push({ fingerprint: fp, members, distinctIds: [...distinctIds] })
    }
  }
  return groups
}

/** 按单个指纹直查面上同题行(取号器发号前查重用;不要求面上已成组) */
export function findSameFingerprint(content, fp) {
  if (!fp) return []
  const hits = []
  const lines = String(content ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^- \[ \]/.test(raw)) continue
    if (extractTaskFingerprint(raw) !== fp) continue
    const ids = [...raw.matchAll(/\b([A-Z])-(\d{2,})\b/g)].map((m) => `${m[1]}-${m[2]}`)
    hits.push({ line: i + 1, selfId: ids[0] ?? null, preview: raw.slice(0, 120) })
  }
  return hits
}

function isDirectRun() {
  const arg = process.argv[1] ? path.resolve(process.argv[1]) : ''
  return arg === path.resolve(fileURLToPath(import.meta.url))
}

async function main() {
  const argv = process.argv.slice(2)
  const strict = argv.includes('--strict')
  const selfTest = argv.includes('--self-test')
  if (selfTest) {
    return runSelfTest()
  }
  const ledgerPath = path.resolve(SCRIPT_DIR, '..', LEDGER_NAME)
  let content
  try {
    content = readFileSync(ledgerPath, 'utf8')
  } catch (e) {
    console.error(`❌ [plan-dup-title] 读不到 ${LEDGER_NAME}: ${e.message}`)
    process.exit(2)
  }
  const groups = findDuplicateGroups(content)
  const total = groups.reduce((a, g) => a + g.members.length, 0)
  console.log(`[plan-dup-title] 同题多号组 ${groups.length} 组 / 涉及行 ${total} 行(判定面:工作树)`)
  for (const g of groups.slice(0, 40)) {
    console.log(`  ⚠️ 同题组(${g.distinctIds.join(' vs ')}):`)
    for (const m of g.members) console.log(`     L${m.line} ${m.preview}`)
  }
  if (groups.length > 40) console.log(`  …其余 ${groups.length - 40} 组略`)
  if (strict && groups.length > 0) {
    console.error(`❌ [--strict] 同题多号 ${groups.length} 组 ⇒ 判红。收拢:每组保留持有行,其余行补〔【归并】同题多号收拢〕指针后重跑。`)
    process.exit(1)
  }
  console.log('结论:通过(默认档只报数;--strict 问责)')
  process.exit(0)
}

function runSelfTest() {
  const cases = [
    { name: '同题不同号必命中', lines: ['- [ ] G-100 **修复登录超时问题** 详情甲', '- [ ] G-999 **修复登录超时问题。** 详情乙(2026-10-13)'], expect: 1 },
    { name: '不同题不命中', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ] G-101 **新增导出报表功能**'], expect: 0 },
    { name: '同号多行不算本门(F4地盘)', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ] G-100 **修复登录超时问题**'], expect: 0 },
    { name: '指针行豁免', lines: ['- [ ] G-100 **修复登录超时问题**', '- [ ]〔【归并】重复登记副本:本行与 G-100 同题,派单以那条为准〕'], expect: 0 },
    { name: '编号引用不污染指纹', lines: ['- [ ] G-100 **修复 G-99 引起的登录超时**', '- [ ] G-101 **修复 G-88 引起的登录超时**'], expect: 1 },
    { name: '前置状语归一', lines: ['- [ ]（进行中@2026-10-05/g1-main）G-401 **MCP 工具免批准重跑（需拍板）**', '- [ ]G-768 **MCP 工具免批准重跑（需拍板）**'], expect: 1 },
    { name: '已勾行不审', lines: ['- [x] G-100 **修复登录超时问题**', '- [ ] G-101 **修复登录超时问题**'], expect: 0 },
    { name: '过短指纹不参与', lines: ['- [ ] G-100 **修超时**', '- [ ] G-101 **修超时**'], expect: 0 },  ]
  let pass = 0
  for (const c of cases) {
    const got = findDuplicateGroups(c.lines.join('\n')).length
    if (got === c.expect) {
      pass++
    } else {
      console.error(`❌ self-test 失败: ${c.name} 期望 ${c.expect} 实测 ${got}`)
    }
  }
  console.log(`[plan-dup-title] self-test ${pass}/${cases.length}`)
  process.exit(pass === cases.length ? 0 : 1)
}

/* istanbul ignore next */
if (isDirectRun()) {
  main().catch((e) => {
    console.error('❌ 异常:', e?.stack ?? e)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
