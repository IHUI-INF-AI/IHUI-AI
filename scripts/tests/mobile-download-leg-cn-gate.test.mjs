#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-download-leg-cn-gate.test.mjs — 国内腿运行态门的接线锁。
 *
 * 钉住三件事,任何一件漏了,「Gitee 上没有 APK 资产」都会重新变成全绿:
 *   1. 判据本身:量不到 = 未判定、体积不等 = 硬失败,不许被改松;
 *   2. CI 真的天天在跑这道门,而不是只把脚本放在仓库里;
 *   3. 一键发布入口真的从单源读 URL 并带 GITEE_TOKEN,不许硬编码第二条 URL。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { judgeCnLegParity, parseTotalFromContentRange } from '../check-mobile-download-leg-cn.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const GATE = readFileSync(`${ROOT}/scripts/check-mobile-download-leg-cn.mjs`, 'utf8')
const WORKFLOW = readFileSync(`${ROOT}/.github/workflows/mobile-download-leg.yml`, 'utf8')
const CFG = JSON.parse(readFileSync(`${ROOT}/scripts/data/mobile-download-leg.json`, 'utf8'))
const MIN = Number(CFG.minApkBytes)

test('判据:量不到 ⇒ 未判定,不许折算成绿', () => {
  assert.equal(judgeCnLegParity(null, 87559925, MIN).state, 'undetermined')
  assert.equal(judgeCnLegParity(87559925, null, MIN).state, 'undetermined')
  assert.equal(judgeCnLegParity(null, null, MIN).state, 'undetermined')
})

test('判据:体积低于下限 / 两条腿不等 ⇒ 硬失败', () => {
  assert.equal(judgeCnLegParity(10, 10, MIN).state, 'fail')
  assert.equal(judgeCnLegParity(87559925, 87559924, MIN).state, 'fail')
  assert.equal(judgeCnLegParity(87559925, 87559925, MIN).state, 'ok')
})

test('反向:体积对账判据不许被改成恒真', () => {
  assert.match(GATE, /cnBytes !== siteBytes/, '门里丢了「两腿总长不等即拒绝」的判据')
  assert.match(GATE, /EXIT\[verdict\.state\]/, '退出码必须由判据状态决定,不许写死 0')
})

test('Content-Range 总长解析:认不出就是 null,不是 0', () => {
  assert.equal(parseTotalFromContentRange('bytes 0-0/87559925'), 87559925)
  assert.equal(parseTotalFromContentRange('bytes 0-0/*'), null)
  assert.equal(parseTotalFromContentRange(null), null)
})

test('CI 接线:每日门真的调用这道脚本(fail-closed)', () => {
  assert.match(WORKFLOW, /check-mobile-download-leg-cn\.mjs/, 'workflow 没跑国内腿门')
  assert.match(WORKFLOW, /workflow_dispatch/, '缺手动触发入口')
  assert.match(WORKFLOW, /schedule:/, '门不能只靠人记得点')
})

test('CI 接线:一键发布从单源读 URL、带凭据、发布后立刻复验', () => {
  assert.match(WORKFLOW, /publish_cn_leg/, '缺一键补国内腿资产的入口')
  assert.match(WORKFLOW, /secrets\.GITEE_TOKEN/, '发布步没接 GITEE_TOKEN')
  assert.match(WORKFLOW, /publish-mobile-apk-gitee\.py --apk/, '发布步没调上传脚本')
  assert.match(
    WORKFLOW,
    /mobile-download-leg\.json'\)\.downloadUrl/,
    '发布步必须读单源 downloadUrl,不许再硬编码一份 URL',
  )
  const after = WORKFLOW.indexOf('publish-mobile-apk-gitee.py --apk')
  assert.ok(
    WORKFLOW.indexOf('check-mobile-download-leg-cn.mjs', after) > after,
    '上传后必须立刻复跑国内腿门(写后自证)',
  )
})

test('单源:国内腿与站点腿坐标齐全且不自相矛盾', () => {
  for (const k of [
    'downloadUrl',
    'cnLegUrl',
    'cnLegTag',
    'cnLegOwner',
    'cnLegRepo',
    'minApkBytes',
  ]) {
    assert.ok(CFG[k], `单源缺 ${k}`)
  }
  assert.ok(MIN > 50 * 1024 * 1024 - 1, '下限不得低于 50MiB')
  assert.notEqual(CFG.cnLegUrl, CFG.downloadUrl, '两条腿不能是同一个地址')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
