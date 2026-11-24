// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 接线锁:第 84 项(2026-11-21)—— 「恢复源缺席」不得被读成「刷新失败」。
// 判据不复制任何阈值/正则第二次:本测试只钉 git-guardian 消费侧的分支形状与不寄信语义。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const G = join(ROOT, 'scripts', 'git-guardian.mjs')

/** 只取 refreshRecoverySource 这一个函数体 —— 判据面越窄,越不会被别处的相似写法蒙混。 */
function fnBody() {
  const src = readFileSync(G, 'utf8')
  const from = src.indexOf('function refreshRecoverySource()')
  assert.ok(from > 0, 'refreshRecoverySource 必须在位')
  const end = src.indexOf('function ', from + 30)
  assert.ok(end > from, '函数体边界必须能切出来')
  return { src, body: src.slice(from, end) }
}

/** 缺席判据在函数体里的起点(用字面 indexOf,避免正则转义把判据自己写坏)。 */
function absentAt(body) {
  const a = body.indexOf('备份=(无)')
  const b = body.indexOf('[missing]')
  return a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b)
}

function absentBranch(body) {
  const at = absentAt(body)
  const applyAt = body.indexOf('call([], 15 * 60 * 1000)')
  assert.ok(at > 0 && applyAt > at, '缺席判据必须排在 apply 之前')
  return body.slice(at, applyAt)
}

test('① 缺席态必须先于"真跑一次 fetch"被判出来(否则每轮必然硬失败)', () => {
  const { body } = fnBody()
  const applyAt = body.indexOf('call([], 15 * 60 * 1000)')
  assert.ok(absentAt(body) > 0, '缺席判据必须在函数体里(尺子现读打印 `备份=(无)[missing]`)')
  assert.ok(applyAt > absentAt(body), '缺席分支必须排在 apply 之前,不能先失败再解释')
})

test('② 缺席态给的是可执行出路(--init),不是"下次自动重试"', () => {
  const body = fnBody().body
  const branch = absentBranch(body)
  assert.match(branch, /--init/, '缺席必须点名建镜像的命令')
  // 只看**真发出去的那句日志**:判据上方的立因注释允许引用旧措辞("旧逻辑说下次自动重试"),
  // 那是解释不是读数;不许用注释里的字面把这条牙顶回去。
  const msgAt = body.indexOf('本地恢复源缺席')
  assert.ok(msgAt > 0, '缺席必须有一句如实读数')
  const msg = body.slice(msgAt, body.indexOf('call([], 15 * 60 * 1000)'))
  assert.doesNotMatch(msg, /自动重试/, '缺席态不许写"下次自动重试"(那句话在这一态永远不成立)')
})

test('③ 缺席态不寄"刷新失败"信,且 24h 只报一次', () => {
  const { body } = fnBody()
  const branch = absentBranch(body)
  assert.doesNotMatch(branch, /notifyGuardRed/, '缺席不是故障,不得走"刷新失败"到人通道')
  assert.match(
    branch,
    /backup-absent-notice-last\.json[\s\S]*24 \* 60 \* 60 \* 1000/,
    '缺席提示必须带 24h 节流戳,否则 30min 一轮刷屏',
  )
  // 反向牙:落后/损坏那一支原样保留(重试 + 到人),本项不许顺手把它删了
  const tail = body.slice(body.indexOf('call([], 15 * 60 * 1000)'))
  assert.match(tail, /本地恢复源刷新失败/, '落后/损坏仍必须按失败到人')
  assert.match(tail, /git-backup-refresh\.mjs/, '失败文案仍必须给手动入口')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
