// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序镜像判定台账完整性 — 每行都必须有 route / verdict / evidence。
 *
 * 立因(2026-11-03):台账此前只有 shared+verdict+evidence,消费方无法从一行直接
 * 定位小程序承载路由,缺字段的行也会被静默接受。本测试把「字段齐全」钉成硬判据:
 * 缺任一字段即红,不允许用空行或 '-'(除非 not-applicable 确无路由)蒙混。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  VERDICTS_PATH,
  VERDICT_KINDS,
  verdictKey,
  serializeVerdicts,
} from '../lib/cross-end-verdicts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'
const CHAT_SHARED = 'packages/app/src/features/chat/ChatScreen.tsx'
const STUDY_PROGRESS_SHARED = 'packages/app/src/features/study-progress/StudyProgressScreen.tsx'

function readLedger() {
  const text = readFileSync(join(ROOT, VERDICTS_PATH), 'utf8')
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch {
        assert.fail(`台账第 ${index + 1} 行不是 JSON`)
      }
    })
}

function readRegistryRoutes() {
  const registry = JSON.parse(readFileSync(join(ROOT, REGISTRY_PATH), 'utf8'))
  // 立因(2026-11-06 批次②):同一 shared 可有多条 miniapp 路由(合法多路别名,301 记为
  // multi-route-alias)。旧实现 `new Map([[shared, miniapp]])` 会让末条静默覆盖前条,
  // 拿它跟台账首条比 ⇒ 假红(StudyProgressScreen)。改为按 route 列表逐条比对。
  const map = new Map()
  for (const entry of registry.entries || []) {
    if (!map.has(entry.shared)) map.set(entry.shared, [])
    map.get(entry.shared).push(entry.miniapp)
  }
  return map
}

describe('miniapp-mirror-verdicts 完整性', () => {
  it('每行都有 shared / route / verdict / evidence,且 verdict 在词表内', () => {
    const rows = readLedger()
    assert.ok(rows.length > 0, '台账不能是空的')

    for (const row of rows) {
      assert.ok(row && typeof row === 'object', '行必须是对象')
      assert.equal(typeof row.shared, 'string', `${row.shared}: shared 必须是字符串`)
      assert.ok(row.shared.length > 0, 'shared 不能为空')
      assert.ok(Object.prototype.hasOwnProperty.call(row, 'route'), `${row.shared}: 缺 route 字段`)
      assert.equal(typeof row.route, 'string', `${row.shared}: route 必须是字符串`)
      assert.ok(row.route.length > 0, `${row.shared}: route 不能为空(无路由写 '-')`)
      assert.ok(Object.prototype.hasOwnProperty.call(row, 'verdict'), `${row.shared}: 缺 verdict 字段`)
      assert.ok(VERDICT_KINDS.includes(row.verdict), `${row.shared}: verdict 非法 ${String(row.verdict)}`)
      assert.ok(Object.prototype.hasOwnProperty.call(row, 'evidence'), `${row.shared}: 缺 evidence 字段`)
      assert.equal(typeof row.evidence, 'string', `${row.shared}: evidence 必须是字符串`)
      assert.ok(row.evidence.trim().length > 0, `${row.shared}: evidence 不能为空`)
    }
  })

  it('同一 shared 不得重复登记(按 verdictKey:错配档才按 shared+route 分键)', () => {
    const rows = readLedger()
    const seen = new Set()
    for (const row of rows) {
      const key = verdictKey(row)
      assert.ok(!seen.has(key), `重复登记:${key.replace('\u0000', ' @ ')}`)
      seen.add(key)
    }
  })

  it('route 与 registry 一致:generated 必须是 registry 里的一条真实路由,not-applicable 无路由写 -', () => {
    const rows = readLedger()
    const routes = readRegistryRoutes()
    for (const row of rows) {
      const expectedList = routes.get(row.shared) || []
      if (row.verdict === 'generated') {
        assert.ok(expectedList.length > 0, `${row.shared}: generated 行必须能在 registry 找到 miniapp 路由`)
        assert.ok(
          expectedList.includes(row.route),
          `${row.shared}: route 与 registry 不一致(registry=[${expectedList.join(',')}], 台账=${row.route})`,
        )
      } else {
        assert.ok(
          row.route === '-' || expectedList.includes(row.route),
          `${row.shared}: not-applicable 行 route 必须取 registry 里的一条或 '-'`,
        )
      }
    }
  })

  it('StudyProgressScreen 两条 miniapp 路由都被逐条检查(不被 Map 末条覆盖)', () => {
    const rows = readLedger()
    const routes = readRegistryRoutes()
    const expectedList = routes.get(STUDY_PROGRESS_SHARED)
    assert.ok(Array.isArray(expectedList), `${STUDY_PROGRESS_SHARED}: registry 必须登记该屏`)
    assert.equal(expectedList.length, 2, `${STUDY_PROGRESS_SHARED}: 应恰有两条 miniapp 路由`)
    // 显式断言"两条路由都被检查":两条都必须进入本轮比对集合,且台账 route 落其中一条。
    assert.deepEqual(
      [...expectedList].sort(),
      ['pages/study/index', 'pkg-mirror3/study-progress/index'],
      '两条路由必须都在比对集合里(顺序不敏感)',
    )
    const row = rows.find((r) => r.shared === STUDY_PROGRESS_SHARED)
    assert.ok(row, `台账缺 StudyProgressScreen 行:${STUDY_PROGRESS_SHARED}`)
    assert.ok(expectedList.includes(row.route), `台账 route ${row.route} 必须是两条之一`)
  })

  it('Chat 已登记为 not-applicable 且带真实小程序路由', () => {
    const rows = readLedger()
    const chat = rows.find((row) => row.shared === CHAT_SHARED)
    assert.ok(chat, `台账缺 Chat 行:${CHAT_SHARED}`)
    assert.equal(chat.verdict, 'not-applicable')
    assert.equal(chat.route, 'pkg-ai/ai/chat')
  })

  it('序列化必须保留 route,否则下一次写入会静默删字段', () => {
    const line = serializeVerdicts([
      {
        shared: 'packages/app/src/features/x/XScreen.tsx',
        route: 'pkg-x/x/index',
        verdict: 'missing',
        evidence: 'evidence',
        at: '2026-11-03',
        source: 'test',
      },
    ])
    const parsed = JSON.parse(line)
    assert.equal(parsed.route, 'pkg-x/x/index')
    assert.equal(parsed.verdict, 'missing')
    assert.equal(parsed.evidence, 'evidence')
  })
})
