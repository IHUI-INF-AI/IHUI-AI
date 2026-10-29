#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-verbatim-resurrection.mjs + git-guardian 的派发腿
 *
 * 纪律(§22c):判据一律 `import { __test__ } from '../check-verbatim-resurrection.mjs'`,
 * 本文件**不复制任何判据常量**;这里只钉三件事:
 *  T1 装车锁 —— 尺子在 git-guardian 的**被审面(HEAD blob)**上确实既被定义又被调用(§0.9 造好没装车=没有);
 *  T2 三态退出码 —— 未判定优先于红,红优先于绿(纯函数构造面证明,不碰 git);
 *  T3 阳性对照 —— 钉在事故枚 `1fe3a2b42d` 的全量 sha 上,不钉 HEAD(否则账还清那天这台尺子就失效);
 *  T4 形状锁 —— 出参键名是派发腿直接取的字段,漂了就当场红。
 * 取不到输入一律 skip 并大声报名,绝不把"没判"写成"判过"(§0.3)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

import { __test__ as V } from '../check-verbatim-resurrection.mjs'

const GIT = (args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
  })

/** 事故枚(2026-10-29 的对象空间嫁接)。钉全量 sha,不钉 ref 名,也不钉 HEAD。 */
const INCIDENT_SHA = '1fe3a2b42d1781498208697cd50c50c033cc145a'

test('T1 装车锁:尺子在 git-guardian 的 HEAD blob 面上既被定义又被派发', () => {
  let src
  try {
    src = GIT(['show', 'HEAD:scripts/git-guardian.mjs'])
  } catch {
    src = null
  }
  assert.ok(src !== null, '取不到 HEAD:scripts/git-guardian.mjs ⇒ 未判定(不记绿)')
  assert.match(src, /export function auditVerbatimResurrection\(/, '定义缺失')
  assert.match(src, /auditVerbatimResurrection\(\)/, '调用点缺失')
  assert.match(src, /check-verbatim-resurrection\.mjs/, '未引用尺子文件名(等于挂空)')
  // 结构配平:调用点必须在"非 --check"那一支 —— 挂进 CHECK_ONLY 分支等于永不执行(本仓记过两次)
  const callIdx = src.indexOf('if (!CHECK_ONLY) auditVerbatimResurrection()')
  assert.ok(callIdx > 0, '调用点必须是 `if (!CHECK_ONLY) auditVerbatimResurrection()` 这一形')
})

test('T1b 反向对照:摘掉调用点即翻红(证明 T1 的牙不是摆设)', () => {
  const src = GIT(['show', 'HEAD:scripts/git-guardian.mjs'])
  const mangled = src.replace('if (!CHECK_ONLY) auditVerbatimResurrection()', '/* 摘掉 */')
  assert.notEqual(mangled, src, '替换没命中 ⇒ 本例的对照面不成立')
  assert.doesNotMatch(mangled, /if \(!CHECK_ONLY\) auditVerbatimResurrection\(\)/)
})

test('T2 三态退出码:未判定 > 红 > 绿(纯构造面)', () => {
  assert.equal(V.exitCodeOf({ unjudged: true, undetermined: [], hits: [] }), 2, '取不到输入必须 2')
  assert.equal(V.exitCodeOf({ unjudged: false, undetermined: ['取证上限余额'], hits: [{ path: 'x' }] }), 2, '未判定优先于红')
  assert.equal(V.exitCodeOf({ unjudged: false, undetermined: [], hits: [{ path: 'x' }] }), 1, '有命中共 1')
  assert.equal(V.exitCodeOf({ unjudged: false, undetermined: [], hits: [] }), 0, '判过且零命中才 0')
})

test('T3 阳性对照:事故枚上必须量得到那型回潮(钉 sha 不钉 HEAD)', () => {
  let exists = true
  try {
    GIT(['cat-file', '-e', INCIDENT_SHA])
  } catch {
    exists = false
  }
  if (!exists) {
    // 历史件被 GC 掉属极端情形:大声报"本例未判定",不静默通过
    console.log('  ⓘ T3 跳过:事故枚 ' + INCIDENT_SHA.slice(0, 11) + ' 在本仓不可解析 ⇒ 本例未判定(不记绿)')
    return
  }
  // 窗口 40 够含住正控:事故枚就是被审面的顶点,它那枚的 A 行必然被扫到;
  // 300 那档实测 215s(每枚候选一次删除出处派生),把镜像测试拖到没人愿意跑 = 判据作废的另一条路。
  const res = V.auditVerbatim({ ref: INCIDENT_SHA, window: 40 })
  assert.equal(res.unjudged, false, '事故枚面应可判')
  if (res.undetermined.length > 0) {
    console.log('  ⓘ T3 有未判定维:' + res.undetermined[0].slice(0, 120))
  }
  const paths = res.hits.map((h) => h.path)
  assert.ok(
    paths.includes('.github/workflows/mirror-to-cn.yml'),
    `正控失败:事故面应点名 mirror-to-cn.yml,实得 ${JSON.stringify(paths.slice(0, 12))}`,
  )
  const hit = res.hits.find((h) => h.path === '.github/workflows/mirror-to-cn.yml')
  assert.equal(hit.addedBy, INCIDENT_SHA, '加回枚必须是那枚嫁接本身')
  assert.equal(hit.verbatim, true, '该路径与被删版本逐字节同形,verbatim 必须为真')
})

test('T4 形状锁:派发腿直接取的键都在出参里(漂了当场红)', () => {
  const need = ['ref', 'window', 'commits', 'candidates', 'allowEntries', 'hits', 'undetermined']
  const sample = V.auditVerbatim({ ref: 'no-such-ref-xyz', window: 1 })
  for (const k of need) assert.ok(k in sample, `出参缺键 ${k}(git-guardian 的正文直接取这些字段)`)
  assert.equal(typeof V.LOOKUP_CAP, 'number', '取证上限必须是数字(它进未判定文案)')
  assert.match(V.formatReport(sample), /未判定/, '未判定的面必须被 formatReport 大声报出')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
