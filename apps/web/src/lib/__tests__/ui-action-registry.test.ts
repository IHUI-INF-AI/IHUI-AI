// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

import {
  buildUiSnapshot,
  configureUiControlBridge,
  executeUiAction,
  isAllowedNavigatePath,
  resolveUiTarget,
} from '@/lib/ui-action-registry'
import { useModeStore } from '@/stores/mode'

const navigateMock = vi.fn()

function mount(html: string): void {
  document.body.innerHTML = html
}

beforeAll(() => {
  // happy-dom 无排版引擎,offsetParent 恒为 null;按"自身或祖先内联 display:none /
  // visibility:hidden → null"模拟真实浏览器语义,让实现的可见性过滤可被测试
  Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- getter 必须持有元素本身做祖先链遍历
      let cur: HTMLElement | null = this
      while (cur && cur !== document.body) {
        if (cur.style.display === 'none' || cur.style.visibility === 'hidden') return null
        cur = cur.parentElement
      }
      return document.body
    },
  })
})

beforeEach(() => {
  mount('')
  navigateMock.mockClear()
  configureUiControlBridge({ navigate: navigateMock })
})

describe('target 四级解析', () => {
  it('① describe 快照 id ② 精确文本 ③ 子串文本 ④ CSS 选择器', () => {
    mount(
      `
      <button id="go-btn" aria-label="提交草稿">GO</button>
      <button aria-label="保存">保存</button>
      <span class="mark">占位</span>
      `,
    )
    const snap = buildUiSnapshot()
    const byId = snap.elements.find((e) => e.label === '提交草稿')
    expect(byId).toBeDefined()
    expect(resolveUiTarget(byId!.id)?.id).toBe('go-btn')
    expect(resolveUiTarget('保存')?.getAttribute('aria-label')).toBe('保存')
    expect(resolveUiTarget('草稿')?.id).toBe('go-btn')
    expect(resolveUiTarget('.mark')).not.toBeNull()
    expect(resolveUiTarget('根本不存在的东西xyz')).toBeNull()
  })

  it('click 走 id 定位并回传人类可读标签', async () => {
    mount('<button aria-label="展开更多">+</button>')
    const snap = buildUiSnapshot()
    const id = snap.elements[0]!.id
    const spy = vi.fn()
    document.querySelector('button')!.addEventListener('click', spy)
    const r = await executeUiAction('click', { target: id })
    expect(r.ok).toBe(true)
    expect(r.data?.clicked).toBe('展开更多')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('解析不到 → SELECTOR_NOT_FOUND', async () => {
    const r = await executeUiAction('click', { target: '不存在' })
    expect(r.ok).toBe(false)
    expect(r.errorCode).toBe('SELECTOR_NOT_FOUND')
  })

  it('禁用元素 click → EXECUTION_FAILED,快照标 disabled', async () => {
    mount('<button aria-label="暂不可用" disabled>no</button>')
    const snap = buildUiSnapshot()
    expect(snap.elements[0]?.disabled).toBe(true)
    const r = await executeUiAction('click', { target: '暂不可用' })
    expect(r.errorCode).toBe('EXECUTION_FAILED')
  })
})

describe('敏感字段闸门', () => {
  it('password / api_key 字段不进快照、计入 suppressed、fill 拒绝', async () => {
    mount(`
      <input type="password" id="pwd" name="password">
      <input id="apikey" name="api_key">
      <input id="captcha" aria-label="短信验证码">
    `)
    const snap = buildUiSnapshot()
    expect(snap.elements).toHaveLength(0)
    expect(snap.suppressed).toBe(3)
    for (const sel of ['#pwd', '#apikey', '#captcha']) {
      const r = await executeUiAction('fill', { target: sel, value: 'x' })
      expect(r.ok).toBe(false)
      expect(r.errorCode).toBe('PERMISSION_DENIED')
    }
  })

  it('read 不回传敏感字段值', async () => {
    mount(`
      <input type="password" id="pwd" value="s3cret">
      <input id="amt" aria-label="充值金额" value="100">
    `)
    const r = await executeUiAction('read', {})
    const values = (r.data?.values ?? {}) as Record<string, string>
    expect(values['充值金额']).toBe('100')
    expect(JSON.stringify(values)).not.toContain('s3cret')
  })
})

describe('破坏性操作拦截', () => {
  it('click 命中删除/支付类词 → DESTRUCTIVE_BLOCKED 且不触发原生 click', async () => {
    mount(`
      <button id="del" aria-label="删除全部数据">del</button>
      <button id="pay" aria-label="确认支付">pay</button>
      <button id="save" aria-label="保存草稿">save</button>
    `)
    const spyDel = vi.fn()
    const spyPay = vi.fn()
    document.querySelector('#del')!.addEventListener('click', spyDel)
    document.querySelector('#pay')!.addEventListener('click', spyPay)
    const r1 = await executeUiAction('click', { target: '#del' })
    expect(r1.errorCode).toBe('DESTRUCTIVE_BLOCKED')
    expect(r1.error).toContain('需用户手动执行')
    expect(spyDel).not.toHaveBeenCalled()
    expect((await executeUiAction('click', { target: '#pay' })).errorCode).toBe(
      'DESTRUCTIVE_BLOCKED',
    )
    expect((await executeUiAction('click', { target: '#save' })).ok).toBe(true)
  })

  it('submit 表单内含破坏性按钮 → DESTRUCTIVE_BLOCKED', async () => {
    mount('<form aria-label="账户设置"><button type="submit">注销账号</button></form>')
    const r = await executeUiAction('submit', {})
    expect(r.errorCode).toBe('DESTRUCTIVE_BLOCKED')
  })
})

describe('navigate 白名单', () => {
  it('静态路由与 :param 路由放行', async () => {
    expect(isAllowedNavigatePath('/settings/preferences').ok).toBe(true)
    expect(isAllowedNavigatePath('/orders/42').ok).toBe(true)
    const r = await executeUiAction('navigate', { path: '/settings/preferences' })
    expect(r.ok).toBe(true)
    expect(r.data?.path).toBe('/settings/preferences')
    expect(navigateMock).toHaveBeenCalledWith('/settings/preferences')
    expect((await executeUiAction('navigate', { path: '/orders/42' })).ok).toBe(true)
  })

  it('login/sso/api/javascript:/未知路由一律拒绝', async () => {
    for (const bad of [
      '/login',
      '/sso/callback',
      '/api/evil',
      'javascript:alert(1)',
      '/no/such/route-xyz',
    ]) {
      const r = await executeUiAction('navigate', { path: bad })
      expect(r.ok).toBe(false)
      expect(r.errorCode).toBe('ROUTE_NOT_ALLOWED')
    }
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('React 受控组件赋值', () => {
  it('fill 经原生 setter 写值并派发 input+change 事件', async () => {
    mount('<input id="amt">')
    const el = document.querySelector<HTMLInputElement>('#amt')!
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => inputCount++)
    el.addEventListener('change', () => changeCount++)
    const r = await executeUiAction('fill', { target: '#amt', value: 100 })
    expect(r.ok).toBe(true)
    expect(el.value).toBe('100')
    expect(inputCount).toBe(1)
    expect(changeCount).toBe(1)
    expect(r.data?.value).toBe('100')
    // clear:false → 追加
    const r2 = await executeUiAction('fill', { target: '#amt', value: '元', clear: false })
    expect(r2.data?.value).toBe('100元')
  })

  it('select 按 value/text 匹配选项并派发事件;checkbox 布尔点击', async () => {
    mount(`
      <select id="plan"><option value="a">方案A</option><option value="b">方案B</option></select>
      <input type="checkbox" id="agree" aria-label="同意条款">
    `)
    const sel = document.querySelector<HTMLSelectElement>('#plan')!
    let inputCount = 0
    sel.addEventListener('input', () => inputCount++)
    expect((await executeUiAction('fill', { target: '#plan', value: '方案B' })).ok).toBe(true)
    expect(sel.value).toBe('b')
    expect(inputCount).toBe(1)
    expect((await executeUiAction('fill', { target: '#plan', value: '不存在' })).ok).toBe(false)
    const cb = document.querySelector<HTMLInputElement>('#agree')!
    const r = await executeUiAction('fill', { target: '#agree', value: true })
    expect(r.ok).toBe(true)
    expect(cb.checked).toBe(true)
    expect(r.data?.value).toBe('true')
  })
})

describe('快照容量与结构', () => {
  it('elements 上限 80,超限与敏感项一并计入 suppressed', () => {
    let html = ''
    for (let i = 0; i < 90; i++) html += `<button aria-label="按钮${i}">b</button>`
    html += '<input type="password" aria-label="密码">'
    mount(html)
    const snap = buildUiSnapshot()
    expect(snap.elements).toHaveLength(80)
    expect(snap.suppressed).toBe(11)
  })

  it('外壳元素挤满时表单字段仍进快照(截断按优先级而非 DOM 顺序)', () => {
    // 真机复现:应用外壳(侧栏/AI 面板)常驻 200+ 链接按钮,把页面输入框挤出 80 上限,
    // 导致 describe 回清单里没有可填字段,AI 无从下手
    let html = '<aside role="complementary">'
    for (let i = 0; i < 120; i++) html += `<a href="/x${i}" aria-label="侧栏链接${i}">l</a>`
    html += '</aside>'
    html +=
      '<main><label for="amt">充值数量</label>' +
      '<input id="amt" name="amount" aria-label="充值数量" value="0">' +
      '<button aria-label="立即充值">go</button></main>'
    mount(html)
    const snap = buildUiSnapshot()
    expect(snap.elements).toHaveLength(80)
    const labels = snap.elements.map((e) => e.label)
    expect(labels).toContain('充值数量')
    expect(labels).toContain('立即充值')
    expect(snap.elements.map((e) => e.kind)).toContain('input')
    // 入选集合按 DOM 顺序回排(保持 id 稳定),所以判据是"谁被挤掉":
    // 122 候选 - 80 上限 = 42 被抑制,且被挤掉的全是外壳链接
    expect(snap.suppressed).toBe(42)
    expect(snap.elements.filter((e) => e.label.startsWith('侧栏链接'))).toHaveLength(78)
  })

  it('同节点跨多次 describe 复用同一 id', () => {
    mount('<button aria-label="稳定钮">x</button>')
    const first = buildUiSnapshot().elements[0]!.id
    const second = buildUiSnapshot().elements[0]!.id
    expect(second).toBe(first)
    expect(first).toMatch(/^el:button#\d+$/)
  })

  it('forms 聚合字段,commands 收编 BUILTIN_COMMANDS + 限量路由提示', () => {
    mount(`
      <form aria-label="充值表单">
        <input aria-label="金额" value="50">
        <button type="submit">提交</button>
      </form>
    `)
    const snap = buildUiSnapshot()
    expect(snap.version).toBe(1)
    expect(snap.page.path).toBe(window.location.pathname)
    expect(snap.forms).toHaveLength(1)
    expect(snap.forms[0]!.title).toBe('充值表单')
    expect(snap.forms[0]!.action).toBe('submit')
    expect(snap.forms[0]!.fields.map((f) => f.label)).toEqual(['金额', '提交'])
    expect(snap.elements.every((e) => e.group === snap.forms[0]!.id)).toBe(true)
    const ids = new Set(snap.commands.map((c) => c.id))
    expect(ids.has('chat')).toBe(true)
    expect(ids.has('modePlan')).toBe(true)
    expect(snap.commands.find((c) => c.id === 'modePlan')?.group).toBe('mode')
    expect(snap.commands.find((c) => c.id === 'browser')?.group).toBe('panel')
    expect(snap.commands.find((c) => c.id === 'editor')?.group).toBe('ide')
    const routeCmds = snap.commands.filter((c) => c.id.startsWith('route:'))
    expect(routeCmds.length).toBeGreaterThan(0)
    expect(routeCmds.length).toBeLessThanOrEqual(40)
  })

  it('不可见元素不进快照', () => {
    mount(`
      <button aria-label="隐藏钮" style="display:none">h</button>
      <button aria-label="可见钮">v</button>
    `)
    const snap = buildUiSnapshot()
    expect(snap.elements.map((e) => e.label)).toEqual(['可见钮'])
  })
})

describe('invoke 命令', () => {
  it('mode 命令切换 ChatMode 并记录 MRU;未知命令 SELECTOR_NOT_FOUND', async () => {
    const prev = useModeStore.getState().currentMode
    const r = await executeUiAction('invoke', { name: 'modePlan' })
    expect(r.ok).toBe(true)
    expect(useModeStore.getState().currentMode).toBe('plan')
    expect(r.data?.invoked).toBe('modePlan')
    useModeStore.getState().setMode(prev)
    expect((await executeUiAction('invoke', { name: 'no-such-cmd' })).errorCode).toBe(
      'SELECTOR_NOT_FOUND',
    )
  })

  it('invoke 路由名等价 navigate', async () => {
    const r = await executeUiAction('invoke', { name: '/settings/preferences' })
    expect(r.ok).toBe(true)
    expect(navigateMock).toHaveBeenCalledWith('/settings/preferences')
  })
})

describe('describe / read', () => {
  it('describe 回传完整 registry 快照', async () => {
    mount('<button aria-label="面板钮">x</button>')
    const r = await executeUiAction('describe', {})
    expect(r.ok).toBe(true)
    const registry = r.data?.registry as ReturnType<typeof buildUiSnapshot>
    expect(registry.version).toBe(1)
    expect(registry.elements.some((e) => e.label === '面板钮')).toBe(true)
  })

  it('read 文本超 4000 字符截断加标记', async () => {
    mount(`<p>${'x'.repeat(5000)}</p>`)
    const r = await executeUiAction('read', {})
    const text = String(r.data?.text)
    expect(text.startsWith('xxx')).toBe(true)
    expect(text.endsWith('…[truncated]')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(4012)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
