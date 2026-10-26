// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

/**
 * 侧边栏「自定义」栏偏好的服务端判据形状锁(2026-10-25 立)。
 *
 * 立因(与机主报障同一条链):GET 处理段原本对解析结果做 `.slice(0, SIDEBAR_NAV_MAX)`。
 * 上限放在**读取**侧是有损的 —— 客户端每次改动都把整表 PUT 回来覆盖(那条判据由
 * apps/web/src/components/sidebar/__tests__/custom-nav-sync.test.ts 里
 * 「上推的必须是完整列表」钉住),于是被截掉的尾部会在用户改任意一项的那一刻永久消失,
 * 且全程没有任何提示。正解是只在写入侧拒收(schema 的 max(SIDEBAR_NAV_MAX))。
 *
 * 为什么不 import 路由模块做行为测试:它会拉起 db/服务整条依赖链,而本机没有测试库
 * (§5 测试隔离铁律禁止连生产库)。本文件按仓内既有先例(见
 * tests/user-preferences-group-unify.test.ts)只做源码形状锁,行为面留给 web 侧那批用例 ——
 * 两侧合起来才是完整判据,任一侧单独看都不算。
 */

// 只为让 drizzle/schema 的 import 期副作用不发生;本文件不建池、不连库。
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {}, dbScoped: {} }))

const here = dirname(fileURLToPath(import.meta.url))
// apps/api/tests → 仓库根
const repoRoot = resolve(here, '../../..')
const readSrc = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8')

const settingsPath = 'apps/api/src/routes/user/settings-routes.ts'
const src = readSrc(settingsPath)

/** 取两个锚点之间的处理段;取不到就当场抛,不静默返回空串冒充"没有违规"。 */
function region(startMarker: string, endMarker: string): string {
  const s = src.indexOf(startMarker)
  const e = src.indexOf(endMarker)
  if (s < 0) throw new Error(`区间前锚不在位: ${startMarker}`)
  if (e < 0) throw new Error(`区间后锚不在位: ${endMarker}`)
  if (e <= s) throw new Error(`区间反了(后锚在前锚之前): ${startMarker} → ${endMarker}`)
  return src.slice(s, e)
}

const getHandler = () =>
  region(`server.get('/settings/sidebar-nav'`, `server.put('/settings/sidebar-nav'`)
const putHandler = () =>
  region(`server.put('/settings/sidebar-nav'`, `server.get('/settings/devices'`)
const bodySchema = () => region('const sidebarNavBodySchema', `server.get('/settings/sidebar-nav'`)

describe('侧边栏自定义栏偏好:上限只收在写入侧,读取侧不得有损截断', () => {
  it('GET 处理段不做 slice(读取截断会被客户端整表覆盖写放大成永久丢数据)', () => {
    expect(getHandler()).not.toContain('.slice(')
  })

  it('GET 仍逐元素判类型(形状清洗不许连着截断一起被删掉)', () => {
    expect(getHandler()).toContain(`typeof h === 'string'`)
  })

  it('写入侧仍按上限拒收(上限没被"顺手改成无界"抹掉)', () => {
    expect(bodySchema()).toContain('max(SIDEBAR_NAV_MAX)')
    expect(src).toContain('const SIDEBAR_NAV_MAX = ')
  })

  it('exists 标记在 GET/PUT 两处同形回(少了它,"被显式清空"与"从未设置过"在响应上同形)', () => {
    expect(getHandler()).toContain('exists: row !== undefined')
    expect(putHandler()).toContain('exists: true')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
