// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/dev-stack-residency-policy.test.mjs — 镜像:直接 import 生产判据(§22c 禁第二份)
// 立因:2026-11-10 机主令「常驻服务不用时不许占用,以后也不能发生」。自启安装器与
// 看门狗默认拒注/拒复活,本测试钉住判据本体与两处接线,防后手会话悄悄拆锁。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  judgeDevAutostart,
  RESIDENCY_RULING,
  OWNER_ALLOW_ENV,
} from '../lib/dev-stack-residency-policy.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('默认拒绝:无参 / 空 env / 无关 env 一律不放行', () => {
  assert.equal(judgeDevAutostart().allowed, false)
  assert.equal(judgeDevAutostart({ env: {} }).allowed, false)
  assert.equal(judgeDevAutostart({ env: { PATH: 'x' } }).allowed, false)
  assert.equal(judgeDevAutostart({ env: {} }).why, RESIDENCY_RULING)
})

test('放行通道只认逐字 =1,近似值一律拒(失效方向=多要一次定向说明)', () => {
  for (const v of ['0', 'true', 'yes', '', ' 1', '1 ', '2']) {
    assert.equal(
      judgeDevAutostart({ env: { [OWNER_ALLOW_ENV]: v } }).allowed,
      false,
      `值 ${JSON.stringify(v)} 不应放行`,
    )
  }
  const ok = judgeDevAutostart({ env: { [OWNER_ALLOW_ENV]: '1' } })
  assert.equal(ok.allowed, true)
  assert.match(ok.why, /显式放行/)
})

test('裁决常量带日期与停服出路(文档不得写跑不通的出路)', () => {
  assert.match(RESIDENCY_RULING, /2026-11-10/)
  assert.match(RESIDENCY_RULING, /pnpm dev:safe:stop/)
  assert.equal(OWNER_ALLOW_ENV, 'IHUI_DEV_AUTOSTART_OWNER_ALLOW')
})

test('接线形状锁:两个消费方都 import 判据单源并在入口调用', () => {
  for (const rel of ['scripts/install-dev-stack-autostart.mjs', 'scripts/dev-stack-watchdog.mjs']) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    assert.match(text, /dev-stack-residency-policy\.mjs/, `${rel} 必须 import 判据单源`)
    assert.match(text, /judgeDevAutostart\(/, `${rel} 必须真调用判据`)
    assert.match(text, /residency\.allowed/, `${rel} 必须按裁决分流`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
