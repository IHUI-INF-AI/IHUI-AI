// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-checkin-assistant-double-submit.test.ts — 小程序「签到助手」写操作互斥回归锁
 *
 * 背景:同屏 RN 实现在 checkin/toggle 上以 busyId + 早退做互斥,小程序这份独立实现
 * 两处写操作都没有任何 in-flight 锁 —— 用户连点会并发 POST/PATCH 同一账号。
 * 本端只有渲染层,无 DOM 测试环境(仓库未引入 jsdom),故以源码形制锁固定:
 *  ① 每个写操作入口必须有同 tick 生效的 busyRef 早退;
 *  ② busy 状态必须在 finally 复位,避免一次失败后永久锁死。
 *
 * 修前必须真红:旧实现既无 busyRef 早退,也无 finally 复位。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(
  path.resolve(dir, '../src/pkg-user/checkin-assistant/index.tsx'),
  'utf8',
)

function asyncBodyOf(name: string): string {
  const start = src.indexOf(`const ${name} = async`)
  expect(start, `${name} 入口应存在`).toBeGreaterThanOrEqual(0)
  const end = src.indexOf('\n  }', start + 20)
  expect(end, `${name} 函数体边界应可定位`).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('小程序签到助手 · 写操作互斥', () => {
  it('checkin 与 toggle 都必须在 await 之前用 ref 早退(同 tick 连点只能进一次)', () => {
    for (const name of ['checkin', 'toggle']) {
      const body = asyncBodyOf(name)
      expect(body, `${name} 缺少 busyRef 早退`).toMatch(/if\s*\(busyRef\.current\)\s*return/)
      const guardAt = body.search(/if\s*\(busyRef\.current\)\s*return/)
      const awaitAt = body.indexOf('await')
      expect(guardAt, `${name} 早退必须在 await 之前`).toBeLessThan(awaitAt)
    }
  })

  it('checkin 与 toggle 都必须在 finally 复位 busy 状态', () => {
    for (const name of ['checkin', 'toggle']) {
      const body = asyncBodyOf(name)
      expect(body, `${name} 缺少 finally 复位`).toMatch(
        /finally\s*\{\s*busyRef\.current\s*=\s*false[\s\S]*?setBusyId\(null\)/,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
