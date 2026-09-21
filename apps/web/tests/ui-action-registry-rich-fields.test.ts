// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// file / contenteditable / Monaco 三类控件的采集与填写回归 + link target 补全 + describe 路由检索透传
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

import {
  buildUiSnapshot,
  configureUiControlBridge,
  executeUiAction,
} from '@/lib/ui-action-registry'
import type { UiRegistrySnapshot } from '@ihui/types'

function mount(html: string): void {
  document.body.innerHTML = html
}

function registryOf(data: Record<string, unknown> | undefined): UiRegistrySnapshot {
  return (data ?? {}).registry as UiRegistrySnapshot
}

interface MonacoModelHost extends HTMLElement {
  _modelData?: { model: { setValue(value: string): void; getValue(): string } }
}

beforeAll(() => {
  // happy-dom 无排版引擎,offsetParent 恒 null;模拟"内联 display:none → null"语义(与既有套件一致)
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
  configureUiControlBridge({ navigate: vi.fn() })
})

describe('input[type=file] 采集与如实拒绝', () => {
  it('上传位进快照:kind=file + accept/multiple 约束', () => {
    mount(
      '<main><input type="file" id="up" aria-label="上传头像" accept="image/*,.pdf" multiple></main>',
    )
    const snap = buildUiSnapshot()
    const file = snap.elements.find((e) => e.kind === 'file')
    expect(file?.label).toBe('上传头像')
    expect(file?.constraint).toBe('accept=image/*,.pdf multiple')
    expect(file?.value).toBeUndefined()
  })

  it('fill file → PERMISSION_DENIED 且错误说明浏览器安全策略', async () => {
    mount('<main><input type="file" aria-label="选择文件"></main>')
    const r = await executeUiAction('fill', {
      target: 'input[type="file"]',
      value: 'C:/x/秘钥.txt',
    })
    expect(r.ok).toBe(false)
    expect(r.errorCode).toBe('PERMISSION_DENIED')
    expect(r.error).toContain('浏览器禁止脚本写入本地路径')
  })
})

describe('contenteditable 富文本', () => {
  it('采集 kind=richtext + 当前文本 value;嵌套 editable 只采外层', () => {
    mount(
      '<main><div contenteditable="true" aria-label="文章正文">旧文</div>' +
        '<div contenteditable="true"><div contenteditable="true">内层</div></div></main>',
    )
    const snap = buildUiSnapshot()
    const richtexts = snap.elements.filter((e) => e.kind === 'richtext')
    expect(richtexts).toHaveLength(2)
    expect(richtexts[0]?.value).toBe('旧文')
    expect(richtexts[1]?.label).toBe('内层') // 内层被去重,外层以自身文本为标签
  })

  it('fill 直写 textContent 并派发 input+change(React 监听方可见);clear:false 追加', async () => {
    mount('<main><div contenteditable="true" aria-label="文章正文">旧文</div></main>')
    const el = document.querySelector<HTMLElement>('[contenteditable="true"]')!
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => inputCount++)
    el.addEventListener('change', () => changeCount++)
    const r = await executeUiAction('fill', { target: '文章正文', value: '新的一章' })
    expect(r.ok).toBe(true)
    expect(el.textContent).toBe('新的一章')
    expect(inputCount).toBe(1)
    expect(changeCount).toBe(1)
    expect(r.data?.kind).toBe('richtext')
    const r2 = await executeUiAction('fill', { target: '文章正文', value: '续', clear: false })
    expect(r2.ok).toBe(true)
    expect(el.textContent).toBe('新的一章续')
  })
})

describe('Monaco 代码编辑器', () => {
  it('容器 kind=code;内嵌 textarea 不单独入表;能取到模型时 fill 走 setValue', async () => {
    mount(
      '<main><div class="monaco-editor" aria-label="脚本编辑器"><textarea></textarea></div></main>',
    )
    let current = 'const a=1'
    const host = document.querySelector<HTMLElement>('.monaco-editor') as MonacoModelHost
    host._modelData = {
      model: {
        setValue: (v: string) => {
          current = v
        },
        getValue: () => current,
      },
    }
    const snap = buildUiSnapshot()
    expect(snap.elements).toHaveLength(1)
    expect(snap.elements[0]?.kind).toBe('code')
    expect(snap.elements[0]?.value).toBe('const a=1')
    const r = await executeUiAction('fill', { target: '脚本编辑器', value: 'let b=2' })
    expect(r.ok).toBe(true)
    expect(current).toBe('let b=2')
    expect(r.data?.kind).toBe('code')
  })

  it('取不到 editor 实例 → UNSUPPORTED_ACTION 如实说明,不假成功', async () => {
    mount('<main><div class="monaco-editor"><textarea></textarea></div></main>')
    const r = await executeUiAction('fill', { target: '.monaco-editor', value: 'x' })
    expect(r.ok).toBe(false)
    expect(r.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(r.error).toContain('Monaco')
  })
})

describe('link 元素补 target', () => {
  it('a[href] 描述符带 target=href,模型不再靠猜', () => {
    mount('<main><a href="/wallet/recharge">去充值</a></main>')
    const snap = buildUiSnapshot()
    const link = snap.elements.find((e) => e.kind === 'link')
    expect(link?.target).toBe('/wallet/recharge')
  })
})

describe('describe 路由检索透传', () => {
  it('冷 describe:routes 只有摘要,无 matches', async () => {
    const r = await executeUiAction('describe', {})
    const routes = registryOf(r.data).routes
    expect(routes?.total).toBeGreaterThan(800)
    expect(routes?.matches).toBeUndefined()
    expect(routes?.query).toBeUndefined()
  })

  it('带 query 的 describe:回 top-N 命中', async () => {
    const r = await executeUiAction('describe', { query: 'wallet', limit: 10 })
    const routes = registryOf(r.data).routes
    expect(routes?.query).toBe('wallet')
    expect((routes?.matches ?? []).length).toBeGreaterThan(0)
    expect((routes?.matches ?? []).length).toBeLessThanOrEqual(10)
  })

  it('同 fixture 冷回执改前/改后字节差 = routes 摘要 + link target 增量', async () => {
    let html = '<main>'
    for (let i = 0; i < 32; i++) html += `<button aria-label="按钮${i}">b</button>`
    for (let i = 0; i < 32; i++) html += `<a href="/admin/item-${i}" aria-label="链接${i}">l</a>`
    html += '</main>'
    mount(html)
    const full = JSON.stringify(buildUiSnapshot())
    const snap = buildUiSnapshot()
    // "改前形态"还原:去掉 routes 字段与 link.target,即旧版回执
    const legacy = JSON.stringify({
      ...snap,
      routes: undefined,
      elements: snap.elements.map((e) => ({ ...e, target: undefined })),
    })
    const enc = new TextEncoder()
    const before = enc.encode(legacy).length
    const after = enc.encode(full).length
    console.info(
      `[bytes] 64 元素 fixture 冷回执 改前=${before}B 改后=${after}B 增量=${after - before}B`,
    )
    expect(after).toBeGreaterThan(before)
    expect(after - before).toBeLessThan(2500)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
