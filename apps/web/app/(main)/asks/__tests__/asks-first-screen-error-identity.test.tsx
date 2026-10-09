// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 需求广场(/asks)web 侧首屏失败分支的**错误身份**回归(PROJECT_PLAN「广场(AI需求广场)
 * 首屏直接进错误态」P1 的 web 半边残留)。
 *
 * 真接口取证(2026-10-08,本机 8802 在听,curl 只读 GET):
 *   GET /api/asks?page=1&pageSize=6   无凭据   → HTTP 401 {"code":401,"message":"Authentication required"}
 *   GET /api/asks?page=1&pageSize=6   坏令牌   → HTTP 401 {"code":401,"message":"Invalid or expired token"}
 *   GET /api/circles?page=1&pageSize=20 无凭据 → HTTP 200(列表公开,与 asks 子树鉴权面不同)
 * ⇒ 首屏根本不是 400;401 失败体**不带 errorCode**,能分辨"这是登录失效"的档只剩 HTTP status。
 *
 * 病灶链(修复前两处各丢一次身份,任一处在都产出实拍那句):
 *  ① `helpers.api()` 写 `throw new Error(r.error)` —— status/errorCode 被剥;
 *  ② `AsksList` 错误分支直读 `error.message` 上屏 —— 服务端英文原文摊给用户,
 *     而任何经 `toUserFriendlyMessage` 的消费者对"只剩 message"的 Error 会撞参数类
 *     正则 `/invalid|missing|required|must be|expected/i` ⇒「提交的信息有误,请检查后重试」,
 *     把"去重新登录"引导成"回去改表单"(守门 135 立项型;/plaza 族已由枚 a5f5227531 收口,
 *     apps/extension 由 plaza-page-error-identity.test.tsx 钉住,本文件补 web /asks 这一站)。
 *
 * 判据分层,每层都带反向对照:
 *  ① helpers.api() 出口臂:同一 401,"保住 status"与"只取 message"两臂文案必不同形(变异自证锚点);
 *  ② 上屏文案:AsksList 渲的是身份档,不是英文原文、也不是 400 那句;
 *  ③ 真 400 仍映射「提交的信息有误」(证明 ② 的绿不是"什么都映射成登录过期");
 *  ④ 无错误/空列表照常渲染(证明挂载桩是活的,前三条不是在空转组件上判的);
 *  ⑤ 源码锁:该族只许 helpers 一份 api() 实现,且两处不得回到丢身份写法。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import type { ApiResult } from '@ihui/types'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'

/** `@/lib/api` 会拉起 api-client + stores + vault 整条链;本票只判身份链,替身即可。 */
const fetchApiMock = vi.fn()
vi.mock('@/lib/api', () => ({
  fetchApi: (url: string, options?: RequestInit) => fetchApiMock(url, options),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `t:${key}`,
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { HelpCircle: Icon, Loader2: Icon, MessageSquare: Icon, Eye: Icon, CheckCircle2: Icon }
})

vi.mock('@ihui/ui-react', () => {
  // 具名函数表达式而非箭头:react/display-name 判的是"组件定义有没有可显示名",
  // 而 `tag => (props) => …` 柯里化后返回的是匿名箭头 ⇒ 编译期不红、lint 期判 error。
  const Passthrough =
    (tag: string) =>
    function PassthroughComponent({ children }: React.PropsWithChildren<Record<string, unknown>>) {
      return <div data-testid={tag}>{children}</div>
    }
  return {
    Card: Passthrough('card'),
    CardHeader: Passthrough('card-header'),
    CardTitle: Passthrough('card-title'),
    CardContent: Passthrough('card-content'),
  }
})

import { api } from '../helpers'
import { AsksList } from '../AsksList'

/** 真接口响应体逐字搬进来(见文件头注),不是自造夹具。 */
const REAL_401_GUEST = {
  success: false,
  error: 'Authentication required',
  status: 401,
} as const
const REAL_401_EXPIRED = {
  success: false,
  error: 'Invalid or expired token',
  status: 401,
} as const

describe('① helpers.api() 保住失败身份(守门 135 唯一出口)', () => {
  beforeEach(() => fetchApiMock.mockReset())

  it('会话过期 401 ⇒ 抛出的 Error 带 status=401,文案落"登录已过期"档', async () => {
    fetchApiMock.mockResolvedValue(REAL_401_EXPIRED satisfies ApiResult<unknown>)
    const err = await api<unknown>('/api/asks?page=1&pageSize=20').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { status?: number }).status).toBe(401)
    expect(toUserFriendlyMessage(err)).toBe('登录已过期,请重新登录')
  })

  it('游客 401 ⇒ 同一档(鉴权失败不因"从未登录"而换映射)', async () => {
    fetchApiMock.mockResolvedValue(REAL_401_GUEST satisfies ApiResult<unknown>)
    const err = await api<unknown>('/api/asks?page=1&pageSize=20').catch((e: unknown) => e)
    expect((err as Error & { status?: number }).status).toBe(401)
    expect(toUserFriendlyMessage(err)).toBe('登录已过期,请重新登录')
  })

  it('反向对照:丢身份的旧写法(new Error(r.error))必产出实拍那句', () => {
    // 这一臂就是 P1 那句「提交的信息有误」的成因:两臂必须不同形,否则本票保住的那一档并不存在。
    const messageOnly = new Error(REAL_401_EXPIRED.error)
    expect(toUserFriendlyMessage(messageOnly)).toBe('提交的信息有误,请检查后重试')
    expect(toUserFriendlyMessage(apiFailureToError(REAL_401_EXPIRED))).not.toBe(
      toUserFriendlyMessage(messageOnly),
    )
  })
})

describe('② AsksList 首屏错误态上屏身份档,不摊原文、不误判成 400 句', () => {
  afterEach(cleanup)

  async function thrownByRealFailure(): Promise<Error> {
    fetchApiMock.mockResolvedValue(REAL_401_EXPIRED satisfies ApiResult<unknown>)
    const err: unknown = await api<unknown>('/api/asks?page=1&pageSize=20').catch((e: unknown) => e)
    // 断言在先:下面的 `as Error` 只在"确实 instanceof Error"成立后才有资格收窄
    expect(err).toBeInstanceOf(Error)
    return err as Error
  }

  it('端到端(helpers 抛出 → AsksList 渲染):上屏「登录已过期,请重新登录」', async () => {
    const err = await thrownByRealFailure()
    const { container } = render(<AsksList list={[]} isLoading={false} error={err} />)
    const text = container.textContent ?? ''
    expect(text).toContain('登录已过期,请重新登录')
    // 文案必须由响应身份驱动:既不是服务端英文原文,也不是那句把人引向"改表单"的 400 类文案
    expect(text).not.toContain('Invalid or expired token')
    expect(text).not.toContain('提交的信息有误')
  })

  it('真 400 失败仍上屏「提交的信息有误」(证明判序没被改成"全映射登录过期")', () => {
    const err400 = apiFailureToError({ error: 'page must be greater than 0', status: 400 })
    const { container } = render(<AsksList list={[]} isLoading={false} error={err400} />)
    const text = container.textContent ?? ''
    expect(text).toContain('提交的信息有误,请检查后重试')
    expect(text).not.toContain('登录已过期')
  })

  it('无错误 + 空列表照常渲染空态(挂载桩是活的)', () => {
    const { container } = render(<AsksList list={[]} isLoading={false} error={null} />)
    const text = container.textContent ?? ''
    expect(text).toContain('t:empty')
    expect(text).not.toContain('登录已过期')
    expect(text).not.toContain('提交的信息有误')
  })
})

describe('③ 源码锁:该族失败分支不得回到丢身份写法', () => {
  const root = resolve(__dirname, '..')
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
  const helpersSource = read('helpers.ts')
  const listSource = read('AsksList.tsx')
  // 说明性文字也会带执行性字符(本仓 stripJsonc 那一课的镜像形态):helpers 的头注逐字写着
  // 旧写法 `throw new Error(r.error)` 作为病灶记录,而源码锁要拦的是**代码**里的它。
  // 所以反向断言必须在剥注释后的代码面上判 —— 否则锁会把"解释自己为什么存在"判成违规。
  const codeOnly = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('helpers.api() 只此一份且走唯一出口;AsksList 错误分支经 toUserFriendlyMessage', () => {
    expect(helpersSource).toMatch('apiFailureToError(r)')
    expect(codeOnly(helpersSource)).not.toMatch(/throw new Error\(\s*r\.error\s*\)/)
    expect(listSource).toMatch('toUserFriendlyMessage(error)')
    // 错误分支直读 error.message 上屏 = 守门 135 明言"不判的第二半",在这里必须锁死
    expect(codeOnly(listSource)).not.toMatch(/\{\s*error\.message\s*\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
