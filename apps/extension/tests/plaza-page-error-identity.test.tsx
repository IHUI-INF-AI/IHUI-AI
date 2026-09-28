// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * 广场聚合页(侧边栏)首屏失败分支的**错误身份**回归。
 *
 * 病灶:`load()` 原先写 `setError(res.error || t('common.failed'))` —— 把服务端原始 message
 * 直接上屏。而 `GET /api/plaza/list` 的鉴权失败体是 `{code:401,message:'Invalid or expired token'}`
 * **不带 errorCode**(该事实由 apps/api/tests/plaza-list-first-screen-surface.test.ts 在真实
 * 路由上钉死),所以端上能救回"这是登录过期"的**只剩 HTTP status 一档**;不走
 * `apiFailureToText` 就一定丢。这不是措辞偏好:同一句原文在 mobile-rn 上实拍成
 * 「提交的信息有误,请检查后重试」,把用户从"去重新登录"引导成"回去改表单"。
 *
 * 三条用例各管一件事:
 *  ① 真 401 → 「登录已过期,请重新登录」，且**不得**是英文原文、**不得**是 400 那句(阳性对照)。
 *  ② 真 400 → 「提交的信息有误,请检查后重试」(反向对照:证明 ① 的绿不是"什么都映射成登录过期")。
 *  ③ 什么都没带 → 落调用方自己的词表键(证明换成共享出口没把本地兜底文案吃掉)。
 *  ④ 成功分支照常渲染列表(证明挂载桩本身是活的,前三条不是在空转的组件上判的)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const { getPlazaList } = vi.hoisted(() => ({ getPlazaList: vi.fn() }))

vi.mock('@ihui/api-client', () => ({
  getPlazaList,
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    // 刻意让 `common.failed` 返回**中文**译文:共享出口对"调用方兜底文案"的 honored 条件是
    // `isMostlyEnglish === false`(见 error-messages.ts 第 4 步)。若 t() 返回英文字面量
    // ("Failed to load"),它会被第 5 步的 /failed to/ 吞成通用 zh 兜底 —— 那是共享出口的既有
    // 行为、影响全部 apiFailureToText 调用点,不是本票引入的,已单独登记为残余。
    t: (key: string) => (key === 'common.failed' ? '加载失败' : key),
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

import PlazaPage from '../entrypoints/sidepanel/pages/PlazaPage'

let container: HTMLDivElement
let root: Root

async function mountWithResult(result: unknown): Promise<string> {
  getPlazaList.mockResolvedValue(result)
  await act(async () => {
    root.render(<PlazaPage />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return container.textContent ?? ''
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('chrome', { tabs: { create: vi.fn() } })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('PlazaPage 失败分支走 apiFailureToText(错误身份不再被丢)', () => {
  it('① 401 Invalid or expired token ⇒ 出「登录已过期,请重新登录」，不出英文原文也不出 400 那句', async () => {
    const text = await mountWithResult({
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    })
    expect(text).toContain('登录已过期,请重新登录')
    expect(text).not.toContain('Invalid or expired token')
    expect(text).not.toContain('提交的信息有误')
  })

  it('② 真 400 ⇒ 仍出「提交的信息有误」（反向对照:① 不是把一切都映射成登录过期）', async () => {
    const text = await mountWithResult({
      success: false,
      error: 'Number must be less than or equal to 100',
      status: 400,
    })
    expect(text).toContain('提交的信息有误,请检查后重试')
    expect(text).not.toContain('登录已过期')
  })

  it('③ 失败体既无 message 也无 status ⇒ 落本页自己的兜底文案(没被共享出口吃掉)', async () => {
    const text = await mountWithResult({ success: false, error: '' })
    expect(text).toContain('加载失败')
    expect(text).not.toContain('操作失败,请稍后重试')
    expect(text).not.toContain('登录已过期')
  })

  it('④ 成功分支照常渲染列表(挂载桩是活的)', async () => {
    const text = await mountWithResult({
      success: true,
      data: { list: [{ id: 'a-1', title: '帮我做一个爬虫' }], total: 1, page: 1, pageSize: 20 },
    })
    expect(text).toContain('帮我做一个爬虫')
    expect(text).not.toContain('common.loading')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
