import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import RefundStatus from '@/components/RefundStatus.vue'
import EvidenceUploader from '@/components/EvidenceUploader.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} },
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
}

describe('RefundStatus 组件', () => {
  it('渲染 8 种状态', () => {
    const statuses = ['pending', 'reviewing', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled']
    for (const s of statuses) {
      setActivePinia(createPinia())
      const w = mount(RefundStatus, {
        props: { status: s, timeline: [], evidence: [] },
        global: { plugins: [i18n, makeRouter()] },
      })
      expect(w.find(`.status-${s}`).exists()).toBe(true)
    }
  })

  it('显示时间线', () => {
    setActivePinia(createPinia())
    const timeline = [
      { ts: '2026-06-18T10:00:00Z', action: 'create', operator: 'user', note: '提交' },
      { ts: '2026-06-18T11:00:00Z', action: 'review', operator: 'admin', note: '审核' },
    ]
    const w = mount(RefundStatus, {
      props: { status: 'approved', timeline, evidence: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    const items = w.findAll('.timeline-item')
    expect(items.length).toBe(2)
  })

  it('可撤销状态显示按钮', () => {
    setActivePinia(createPinia())
    const w = mount(RefundStatus, {
      props: { status: 'pending', timeline: [], evidence: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.find('.cancel-btn').exists()).toBe(true)
  })

  it('已完成状态不显示撤销按钮', () => {
    setActivePinia(createPinia())
    const w = mount(RefundStatus, {
      props: { status: 'completed', timeline: [], evidence: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.find('.cancel-btn').exists()).toBe(false)
  })

  it('凭证列表渲染', () => {
    setActivePinia(createPinia())
    const evidence = [
      // 2026-06-25 修复: 用 mock:// 协议占位符代替 /tmp/, 避免在 Windows 上被误解释为 G:\\tmp\\
      { id: '1', filename: 'a.png', stored_path: 'mock://evidence/a.png', size: 1024, uploaded_at: '2026-06-18T10:00:00Z' },
      { id: '2', filename: 'b.pdf', stored_path: 'mock://evidence/b.pdf', size: 2048, uploaded_at: '2026-06-18T10:01:00Z' },
    ]
    const w = mount(RefundStatus, {
      props: { status: 'pending', timeline: [], evidence },
      global: { plugins: [i18n, makeRouter()] },
    })
    const items = w.findAll('.evidence-item')
    expect(items.length).toBe(2)
  })

  it('点击撤销 emit cancel', async () => {
    setActivePinia(createPinia())
    const w = mount(RefundStatus, {
      props: { status: 'pending', timeline: [], evidence: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    await w.find('.cancel-btn').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})

describe('EvidenceUploader 组件', () => {
  it('空状态显示上传区', () => {
    setActivePinia(createPinia())
    const w = mount(EvidenceUploader, {
      props: { modelValue: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.find('.upload-drop').exists()).toBe(true)
  })

  it('已有凭证显示列表', () => {
    setActivePinia(createPinia())
    const files = [
      { id: '1', filename: 'a.png', size: 1024, uploaded_at: '2026-06-18T10:00:00Z' },
    ]
    const w = mount(EvidenceUploader, {
      props: { modelValue: files },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.findAll('.evidence-card').length).toBe(1)
  })

  it('只读模式不显示上传区', () => {
    setActivePinia(createPinia())
    const w = mount(EvidenceUploader, {
      props: { modelValue: [], readonly: true },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.find('.upload-drop').exists()).toBe(false)
  })

  it('接受的最大文件数限制', () => {
    setActivePinia(createPinia())
    const w = mount(EvidenceUploader, {
      props: { modelValue: [], maxFiles: 5 },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.find('.upload-hint').text()).toContain('5')
  })

  it('无 refundId 离线模式', () => {
    setActivePinia(createPinia())
    const w = mount(EvidenceUploader, {
      props: { modelValue: [] },
      global: { plugins: [i18n, makeRouter()] },
    })
    expect(w.props('refundId')).toBeUndefined()
  })
})
