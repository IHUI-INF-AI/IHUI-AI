// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览历史的字段名口径(targetType/targetId)—— 跨三个文件的**源码契约**测试。
 *
 * 为什么用源码文本而不是渲染组件:这层要防的是**字段名漂移**,而漂移是纯文本事实
 * (有人把 targetType 抄成 resourceType),渲染断言对它半盲 —— 页面上"标签那一格"
 * 无论读哪个字段名都能渲染出东西,只有两侧字段名**不一致**时才空。
 * 直接钉住"这三个文件里不许再出现 resourceType/resourceId"更贴判据。
 *
 * 口径来源(已拍板,勿反向):共享契约 packages/types/src/app.ts:196-197 的
 * BookmarkItem 用 targetId/targetType,其注释明写"与后端 /api/favorites 契约对齐";
 * 前端 member/history 页此前是 resource*,本次改成 target* 对齐共享契约。
 *
 * 变异验证:把 member/history/page.tsx 的 targetType 退回 resourceType ⇒
 * 本文件立刻红(见"页面不许回退成 resource*"一例)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// __dirname = <repo>/apps/web/tests
const WEB_ROOT = join(__dirname, '..')
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const PAGE = join(WEB_ROOT, 'app', '(main)', 'member', 'history', 'page.tsx')
const SHARED_TYPES = join(REPO_ROOT, 'packages', 'types', 'src', 'app.ts')
const API_ROUTES = join(REPO_ROOT, 'apps', 'api', 'src', 'routes', 'other', 'history-routes.ts')

const read = (p: string) => readFileSync(p, 'utf8')

describe('浏览历史字段名口径:统一 targetType/targetId', () => {
  it('页面不许回退成 resource*(否则与共享契约对不上,列表标签恒空)', () => {
    const src = read(PAGE)
    expect(src).not.toMatch(/resourceType/)
    expect(src).not.toMatch(/resourceId/)
    expect(src).toMatch(/targetType/)
    expect(src).toMatch(/targetId/)
  })

  it('页面的类型与渲染处都走 target*(含 TYPE_ICON 取键与标签渲染)', () => {
    const src = read(PAGE)
    // 类型定义处
    expect(src).toMatch(/targetType:\s*TargetType/)
    expect(src).toMatch(/targetId:\s*string/)
    // 渲染处两处 + 回退标题一处
    expect(src).toMatch(/TYPE_ICON\[item\.targetType\]/)
    expect(src).toMatch(/\{item\.targetType\}/)
    expect(src).toMatch(/item\.title \?\? item\.targetId/)
  })

  it('共享契约 BookmarkItem 仍是 targetId/targetType(没被反向改回 resource*)', () => {
    const src = read(SHARED_TYPES)
    expect(src).toMatch(/targetId:\s*string/)
    expect(src).toMatch(/targetType:\s*BookmarkTargetType/)
  })

  it('后端 visit 端点与列表端点对外字段名也是 target*', () => {
    const src = read(API_ROUTES)
    // 列表映射出的对外字段
    expect(src).toMatch(/targetType:\s*r\.targetType/)
    expect(src).toMatch(/targetId:\s*r\.targetId/)
    // 旧名不许出现在对外映射里
    expect(src).not.toMatch(/resourceType:\s*r\./)
    expect(src).not.toMatch(/resourceId:\s*r\./)
  })

  it('写入侧的 targetType 落在后端白名单内(否则上报 400,历史永远是空的)', () => {
    const page = read(PAGE)
    const routes = read(API_ROUTES)
    // 前端页面的值域
    const union = page.match(/type TargetType = ([^\n]+)/)?.[1] ?? ''
    const pageValues = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()
    expect(pageValues).toEqual(['doc', 'file', 'post', 'project'])
    // 后端 z.enum 白名单必须逐个覆盖页面值域
    const zenum = routes.match(/targetType:\s*z\.enum\(\[([^\]]+)\]\)/)?.[1] ?? ''
    const routeValues = [...zenum.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()
    expect(routeValues).toEqual(pageValues)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
