// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  PLUGIN_VIEW_SANDBOX,
  hostInitMessage,
  iframePropsFor,
  isPluginViewMessage,
  validatePluginViewManifest,
} from '../plugin-view-runtime'

describe('插件视图 manifest 校验', () => {
  it('合法 srcdoc 视图通过', () => {
    const r = validatePluginViewManifest({ id: 'panel-a', title: '面板A', html: '<p>hi</p>' })
    expect(r.ok).toBe(true)
    expect(r.manifest?.id).toBe('panel-a')
  })

  it('合法 https 视图通过', () => {
    const r = validatePluginViewManifest({
      id: 'panel-b',
      title: 'B',
      src: 'https://cdn.example.com/view.html',
    })
    expect(r.ok).toBe(true)
    expect(r.manifest?.src).toContain('https://')
  })

  it('html 与 src 同时给 ⇒ 拒绝(歧义)', () => {
    const r = validatePluginViewManifest({
      id: 'x',
      title: 'x',
      html: '<p>1</p>',
      src: 'https://e.com/a.html',
    })
    expect(r.ok).toBe(false)
    expect(r.problems.join()).toContain('二选一')
  })

  it('html 与 src 都不给 ⇒ 拒绝(空视图)', () => {
    const r = validatePluginViewManifest({ id: 'x', title: 'x' })
    expect(r.ok).toBe(false)
  })

  it('src 为 http 明文 ⇒ 拒绝', () => {
    const r = validatePluginViewManifest({ id: 'x', title: 'x', src: 'http://e.com/a.html' })
    expect(r.ok).toBe(false)
    expect(r.problems.join()).toContain('https')
  })

  it('src 为 data: 内联脚本 ⇒ 拒绝', () => {
    const r = validatePluginViewManifest({
      id: 'x',
      title: 'x',
      src: 'data:text/html,<script>alert(1)</script>',
    })
    expect(r.ok).toBe(false)
  })

  it('id 非法字符 ⇒ 拒绝', () => {
    const r = validatePluginViewManifest({ id: 'bad id!', title: 'x', html: '<p>1</p>' })
    expect(r.ok).toBe(false)
  })

  it('非对象输入 ⇒ 拒绝', () => {
    expect(validatePluginViewManifest(null).ok).toBe(false)
    expect(validatePluginViewManifest('x').ok).toBe(false)
  })
})

describe('沙箱桥', () => {
  it('iframePropsFor 恒给 allow-scripts 断源 sandbox(核心安全铁律)', () => {
    const m = validatePluginViewManifest({ id: 'a', title: 'A', html: '<p>1</p>' }).manifest!
    const props = iframePropsFor(m)
    expect(props.sandbox).toBe(PLUGIN_VIEW_SANDBOX)
    expect(props.sandbox).toBe('allow-scripts')
    expect(props.sandbox).not.toContain('allow-same-origin')
    expect(props.srcDoc).toBe('<p>1</p>')
  })

  it('https 视图走 src 而非 srcDoc', () => {
    const m = validatePluginViewManifest({
      id: 'b',
      title: 'B',
      src: 'https://e.com/v.html',
    }).manifest!
    const props = iframePropsFor(m)
    expect(props.src).toContain('https://')
    expect(props.srcDoc).toBeUndefined()
    expect(props.sandbox).toBe('allow-scripts')
  })

  it('hostInitMessage 形状合法且能被 isPluginViewMessage 接受', () => {
    const msg = hostInitMessage('panel-a')
    expect(isPluginViewMessage(msg)).toBe(true)
    expect(msg.kind).toBe('ready')
  })

  it('isPluginViewMessage 拒绝非法 kind / 缺 pluginId / 非 json', () => {
    expect(isPluginViewMessage({ type: 'ihui-plugin-view', pluginId: 'a', kind: 'nope' })).toBe(
      false,
    )
    expect(isPluginViewMessage({ type: 'ihui-plugin-view', kind: 'ready' })).toBe(false)
    expect(isPluginViewMessage('raw string')).toBe(false)
    expect(isPluginViewMessage(null)).toBe(false)
  })

  it('白名单外 kind 被守卫拒绝(超出 ready/resize/navigate/error)', () => {
    expect(isPluginViewMessage({ type: 'ihui-plugin-view', pluginId: 'a', kind: 'eval' })).toBe(
      false,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
