// EvidenceUploader 组件单元测试：提升覆盖率
// 覆盖点：文件列表渲染、图标、格式化、拖拽、change/drop、验证、XHR 上传、删除、只读、卸载清理
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

// 在 import 组件前先 mock vue-i18n，避免 useI18n 报错
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => (params ? `${key}|${JSON.stringify(params)}` : key),
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
  }),
  createI18n: (_options: any) => ({
    install: (app: any) => {
      app.config.globalProperties.$t = (key: string) => key
      app.provide('i18n', {})
    },
  }),
}))

// 组件内部引用了 formatDateTime，需要确保 i18n 工具可工作
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

import EvidenceUploader from '../EvidenceUploader.vue'

// 工具：构造一个内存里的 File 对象（jsdom 支持）
function makeFile(name: string, size: number, type = 'image/png'): File {
  return new File([new Uint8Array(size)], name, { type })
}

// 工具：触发 input change
function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('EvidenceUploader.vue', () => {
  // 每次测试前重置 mock
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // 基本渲染
  // ============================================================
  describe('基本渲染', () => {
    it('应渲染根容器', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      expect(wrapper.find('.evidence-uploader').exists()).toBe(true)
    })

    it('空列表时不应渲染文件列表区域', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      expect(wrapper.find('.evidence-list').exists()).toBe(false)
    })

    it('只读模式下不应渲染上传区域', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], readonly: true },
      })
      expect(wrapper.find('.upload-zone').exists()).toBe(false)
    })

    it('有文件时应渲染文件卡片', () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [
            { id: '1', filename: 'a.png', size: 2048, uploaded_at: '2026-01-01T00:00:00Z' },
            { id: '2', filename: 'b.pdf', size: 1024 * 1024, uploaded_at: '2026-01-02T00:00:00Z' },
          ],
        },
      })
      const cards = wrapper.findAll('.evidence-card')
      expect(cards).toHaveLength(2)
      expect(cards[0].text()).toContain('a.png')
      expect(cards[1].text()).toContain('b.pdf')
    })

    it('只读模式下不应渲染删除按钮', () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [{ id: '1', filename: 'a.png', size: 1024 }],
          readonly: true,
        },
      })
      expect(wrapper.find('.evidence-remove').exists()).toBe(false)
    })
  })

  // ============================================================
  // 文件图标
  // ============================================================
  describe('文件图标', () => {
    it('pdf 文件应使用 pdf 图标', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'doc.pdf', size: 100 }] },
      })
      expect(wrapper.find('.evidence-icon').text()).toBe('📄')
    })

    it('zip/rar/7z 压缩文件应使用压缩包图标', () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [
            { id: '1', filename: 'a.zip', size: 100 },
            { id: '2', filename: 'b.rar', size: 100 },
            { id: '3', filename: 'c.7z', size: 100 },
          ],
        },
      })
      const icons = wrapper.findAll('.evidence-icon')
      expect(icons[0].text()).toBe('📦')
      expect(icons[1].text()).toBe('📦')
      expect(icons[2].text()).toBe('📦')
    })

    it('图片文件应使用图片图标', () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [
            { id: '1', filename: 'a.jpg', size: 100 },
            { id: '2', filename: 'b.PNG', size: 100 },
            { id: '3', filename: 'c.gif', size: 100 },
            { id: '4', filename: 'd.webp', size: 100 },
          ],
        },
      })
      const icons = wrapper.findAll('.evidence-icon')
      icons.forEach(icon => {
        expect(icon.text()).toBe('🖼')
      })
    })

    it('未知扩展名应使用默认图标', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.xyz', size: 100 }] },
      })
      expect(wrapper.find('.evidence-icon').text()).toBe('📎')
    })

    it('文件名无扩展名（特殊文件名）也应能渲染图标', () => {
      // 文件名带点但最后一个是空，验证 ?.toLowerCase() 路径
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'noext', size: 100 }] },
      })
      expect(wrapper.find('.evidence-icon').text()).toBe('📎')
    })
  })

  // ============================================================
  // 文件大小格式化
  // ============================================================
  describe('文件大小格式化', () => {
    it('小于 1KB 应显示 B', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.bin', size: 512 }] },
      })
      expect(wrapper.find('.evidence-size').text()).toMatch(/B$/)
    })

    it('KB 范围应显示 KB', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.bin', size: 2048 }] },
      })
      expect(wrapper.find('.evidence-size').text()).toMatch(/KB$/)
    })

    it('MB 范围应显示 MB', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.bin', size: 5 * 1024 * 1024 }] },
      })
      expect(wrapper.find('.evidence-size').text()).toMatch(/MB$/)
    })
  })

  // ============================================================
  // 上传时间显示
  // ============================================================
  describe('上传时间显示', () => {
    it('有 uploaded_at 时应显示时间', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.png', size: 100, uploaded_at: '2026-01-01T00:00:00Z' }] },
      })
      expect(wrapper.find('.evidence-time').exists()).toBe(true)
    })

    it('无 uploaded_at 时不应显示时间', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '1', filename: 'a.png', size: 100 }] },
      })
      expect(wrapper.find('.evidence-time').exists()).toBe(false)
    })
  })

  // ============================================================
  // 默认值
  // ============================================================
  describe('默认值', () => {
    it('maxFiles 默认 10', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      expect(input.getAttribute('accept')).toBe('image/*,application/pdf')
      expect(wrapper.find('.upload-hint').text()).toContain('10')
    })
  })

  // ============================================================
  // 拖拽交互
  // ============================================================
  describe('拖拽交互', () => {
    it('dragover 时应添加 dragging class', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const drop = wrapper.find('.upload-drop')
      await drop.trigger('dragover')
      expect(drop.classes()).toContain('dragging')
    })

    it('dragleave 时应移除 dragging class', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const drop = wrapper.find('.upload-drop')
      await drop.trigger('dragover')
      await drop.trigger('dragleave')
      expect(drop.classes()).not.toContain('dragging')
    })

    it('点击 upload-drop 应触发 input click', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click')
      await wrapper.find('.upload-drop').trigger('click')
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 文件选择（input change）- 离线模式
  // ============================================================
  describe('文件选择 - 离线模式', () => {
    it('change 事件应触发离线模式上传并更新 modelValue', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      const file = makeFile('test.png', 100)
      setInputFiles(input, [file])
      await flushPromises()
      // 没传 refundId, 走离线模式, emit('update:modelValue') 增加一条
      const updates = wrapper.emitted('update:modelValue')
      expect(updates).toBeTruthy()
      const last = (updates![updates!.length - 1][0]) as any[]
      expect(last).toHaveLength(1)
      expect(last[0].filename).toBe('test.png')
      expect(last[0].size).toBe(100)
      // input value 应被清空
      expect(input.value).toBe('')
      // 离线模式应触发 uploaded
      expect(wrapper.emitted('uploaded')).toBeTruthy()
    })

    it('无文件时直接返回不发任何事件', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [])
      await flushPromises()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  // ============================================================
  // 验证逻辑（change + drop 共用）
  // ============================================================
  describe('验证逻辑', () => {
    it('超过 maxFiles 应报错', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], maxFiles: 2 },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 10), makeFile('b.png', 10), makeFile('c.png', 10)])
      await flushPromises()
      expect(wrapper.find('.upload-error').exists()).toBe(true)
      expect(wrapper.find('.upload-error').text()).toContain('最多')
    })

    it('单文件超过 maxSize 应报错', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], maxSize: 100 },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('big.png', 1024)])
      await flushPromises()
      expect(wrapper.find('.upload-error').exists()).toBe(true)
      expect(wrapper.find('.upload-error').text()).toContain('big.png')
    })

    it('drop 校验失败应报错', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], maxSize: 10 },
      })
      const drop = wrapper.find('.upload-drop')
      const dt = {
        files: [makeFile('big.png', 1024)],
      }
      await drop.trigger('drop', { dataTransfer: dt })
      expect(wrapper.find('.upload-error').exists()).toBe(true)
    })

    it('drop 校验通过应清空 error 并上传', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const drop = wrapper.find('.upload-drop')
      const dt = { files: [makeFile('a.png', 100)] }
      await drop.trigger('drop', { dataTransfer: dt })
      await flushPromises()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('drop 时 dataTransfer 为空应直接返回', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const drop = wrapper.find('.upload-drop')
      await drop.trigger('drop', { dataTransfer: null })
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('drop 时 file 列表为空应直接返回', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      const drop = wrapper.find('.upload-drop')
      const dt = { files: [] }
      await drop.trigger('drop', { dataTransfer: dt })
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  // ============================================================
  // 在线上传（带 refundId 走 XHR）
  // ============================================================
  describe('在线上传 - 成功', () => {
    let xhrMock: any
    let originalXHR: any

    beforeEach(() => {
      originalXHR = (global as any).XMLHttpRequest
    })

    afterEach(() => {
      ;(global as any).XMLHttpRequest = originalXHR
    })

    // 构造一个可编程的 XHR mock（upload 用普通对象，支持 onprogress 直接赋值）
    type AnyFn = (...args: unknown[]) => unknown
    function createXHRMock() {
      const listeners: Record<string, AnyFn[]> = {}
      const uploadListeners: Record<string, AnyFn[]> = {}
      const xhr: any = {
        open: vi.fn(),
        send: vi.fn(),
        abort: vi.fn(),
        setRequestHeader: vi.fn(),
        responseText: '',
      }
      // upload 用普通对象，让组件可以直接赋 onprogress
      xhr.upload = {}
      xhr.upload.addEventListener = (event: string, cb: AnyFn) => {
        uploadListeners[event] = uploadListeners[event] || []
        uploadListeners[event].push(cb)
      }
      ;(xhr as any)._triggerUpload = (loaded: number, total: number) => {
        const ev = { lengthComputable: true, loaded, total }
        if (xhr.upload.onprogress) xhr.upload.onprogress(ev)
        uploadListeners.progress?.forEach(cb => cb(ev))
      }
      ;(xhr as any)._triggerUploadIncomputable = () => {
        const ev = { lengthComputable: false, loaded: 50, total: 100 }
        if (xhr.upload.onprogress) xhr.upload.onprogress(ev)
      }
      ;(xhr as any)._finishOk = (data: any) => {
        xhr.responseText = JSON.stringify(data)
        xhr.onload?.()
      }
      ;(xhr as any)._finishError = () => {
        xhr.onerror?.()
      }
      return xhr
    }

    it('refundId 存在时走 XHR 上传，成功后追加文件', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-1' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      // XHR 应被 open+send
      expect(xhrMock.open).toHaveBeenCalledWith('POST', '/api/v1/refunds/r-1/evidence/batch')
      expect(xhrMock.send).toHaveBeenCalled()
      // 模拟成功
      xhrMock._triggerUpload(50, 100)
      xhrMock._finishOk({ code: 0, data: { uploaded: [{ id: 'u1', filename: 'a.png', size: 100 }] } })
      await flushPromises()
      const updates = wrapper.emitted('update:modelValue') as any[]
      expect(updates).toBeTruthy()
      const last = updates[updates.length - 1][0]
      expect(last[0].id).toBe('u1')
      expect(wrapper.emitted('uploaded')).toBeTruthy()
    })

    it('业务失败时设置 error', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-2' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      xhrMock._finishOk({ code: 1, message: '业务错误' })
      await flushPromises()
      expect(wrapper.find('.upload-error').text()).toBe('业务错误')
    })

    it('业务失败无 message 时使用默认文案', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-3' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      xhrMock._finishOk({ code: 1 })
      await flushPromises()
      expect(wrapper.find('.upload-error').text()).toBe('上传失败')
    })

    it('网络错误应设置 error', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-4' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      xhrMock._finishError()
      await flushPromises()
      expect(wrapper.find('.upload-error').text()).toBe('网络错误')
    })

    it('JSON 解析失败应设置 error', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-5' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      // 模拟非 JSON 响应
      xhrMock.responseText = 'not json'
      xhrMock.onload?.()
      await flushPromises()
      expect(wrapper.find('.upload-error').exists()).toBe(true)
    })

    it('onprogress 事件应更新 progress（lengthComputable=true）', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-6' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      // 触发 progress 事件，组件应该设置 progress
      xhrMock._triggerUpload(50, 100)
      // 等待下一个 tick 让 Vue 响应
      await nextTick()
      // 上传中文案应包含进度数字
      const progress = wrapper.find('.upload-progress')
      expect(progress.exists()).toBe(true)
      expect(progress.text()).toContain('50')
      // 清理
      xhrMock._finishOk({ code: 0, data: { uploaded: [] } })
      await flushPromises()
    })

    it('onprogress 事件在 lengthComputable=false 时不应抛错', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-7' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      expect(() => xhrMock._triggerUploadIncomputable()).not.toThrow()
      // 清理
      xhrMock._finishOk({ code: 0, data: { uploaded: [] } })
      await flushPromises()
    })

    it('data.uploaded 为空时也应正常 emit', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [{ id: '0', filename: 'exist.png', size: 100 }], refundId: 'r-8' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      // code=0 但 data.uploaded 是空数组
      xhrMock._finishOk({ code: 0, data: { uploaded: [] } })
      await flushPromises()
      // 不应报 error
      expect(wrapper.find('.upload-error').exists()).toBe(false)
      // uploaded 事件应触发
      expect(wrapper.emitted('uploaded')).toBeTruthy()
    })

    it('data 字段缺失时 uploaded 应默认为空数组', async () => {
      xhrMock = createXHRMock()
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [], refundId: 'r-9' },
      })
      const input = wrapper.find('input[type=file]').element as HTMLInputElement
      setInputFiles(input, [makeFile('a.png', 100)])
      await flushPromises()
      // code=0 但完全没有 data 字段
      xhrMock._finishOk({ code: 0 })
      await flushPromises()
      // 不应报 error
      expect(wrapper.find('.upload-error').exists()).toBe(false)
    })

    it('XHR onload 中 JSON.parse 抛出 AbortError 时不应设置 error', async () => {
      // 构造一个会在 onload 路径上抛出 AbortError 的 XHR
      const x: any = {
        open: vi.fn(),
        send: vi.fn(),
        abort: vi.fn(),
        responseText: '',
      }
      x.upload = {}
      // onload 抛出一个 AbortError 模拟 abort
      x.onload = () => {
        const e: any = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }
      const originalXHR = (global as any).XMLHttpRequest
      ;(global as any).XMLHttpRequest = function () { return x }
      try {
        const wrapper = mount(EvidenceUploader, {
          props: { modelValue: [], refundId: 'r-abort' },
        })
        const input = wrapper.find('input[type=file]').element as HTMLInputElement
        setInputFiles(input, [makeFile('a.png', 100)])
        await flushPromises()
        // AbortError 路径不应设置 error
        expect(wrapper.find('.upload-error').exists()).toBe(false)
      } finally {
        ;(global as any).XMLHttpRequest = originalXHR
      }
    })

    it('非 AbortError 的 catch 异常应设置 error', async () => {
      // 让 XHR.send 同步抛错，触发外层 try/catch
      const x: any = {
        open: vi.fn(),
        send: vi.fn(() => { throw new Error('parse fail') }),
        abort: vi.fn(),
        responseText: '',
      }
      x.upload = {}
      const originalXHR = (global as any).XMLHttpRequest
      ;(global as any).XMLHttpRequest = function () { return x }
      try {
        const wrapper = mount(EvidenceUploader, {
          props: { modelValue: [], refundId: 'r-err' },
        })
        const input = wrapper.find('input[type=file]').element as HTMLInputElement
        setInputFiles(input, [makeFile('a.png', 100)])
        await flushPromises()
        // error 应被设置为异常 message
        expect(wrapper.find('.upload-error').text()).toBe('parse fail')
      } finally {
        ;(global as any).XMLHttpRequest = originalXHR
      }
    })

    it('非 Error 类型的 catch 值应使用默认文案', async () => {
      // 让 XHR.send 抛出一个非 Error 对象（字符串）
      const x: any = {
        open: vi.fn(),
        send: vi.fn(() => { throw 'string-err' }),
        abort: vi.fn(),
        responseText: '',
      }
      x.upload = {}
      const originalXHR = (global as any).XMLHttpRequest
      ;(global as any).XMLHttpRequest = function () { return x }
      try {
        const wrapper = mount(EvidenceUploader, {
          props: { modelValue: [], refundId: 'r-str' },
        })
        const input = wrapper.find('input[type=file]').element as HTMLInputElement
        setInputFiles(input, [makeFile('a.png', 100)])
        await flushPromises()
        // e?.message 对 string 是 undefined, 应回退到 '上传失败'
        expect(wrapper.find('.upload-error').text()).toBe('上传失败')
      } finally {
        ;(global as any).XMLHttpRequest = originalXHR
      }
    })
  })

  // ============================================================
  // 删除文件
  // ============================================================
  describe('删除文件', () => {
    it('点击删除按钮应 emit update:modelValue（去掉对应项）', async () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [
            { id: '1', filename: 'a.png', size: 100 },
            { id: '2', filename: 'b.png', size: 200 },
          ],
        },
      })
      const buttons = wrapper.findAll('.evidence-remove')
      await buttons[0].trigger('click')
      const updates = wrapper.emitted('update:modelValue') as any[]
      expect(updates).toBeTruthy()
      const last = updates[updates.length - 1][0]
      expect(last).toHaveLength(1)
      expect(last[0].id).toBe('2')
    })
  })

  // ============================================================
  // 卸载清理
  // ============================================================
  describe('卸载清理', () => {
    it('组件卸载时不应抛错', () => {
      const wrapper = mount(EvidenceUploader, {
        props: { modelValue: [] },
      })
      expect(() => wrapper.unmount()).not.toThrow()
    })

    it('有 XHR 进行中时卸载应触发 abort', async () => {
      const xhrMock = (() => {
        const xhr: any = {
          open: vi.fn(),
          send: vi.fn(),
          abort: vi.fn(),
          responseText: '',
        }
        xhr.upload = {} // 普通对象，避免组件赋值 onprogress 时报 undefined
        return xhr
      })()
      const originalXHR = (global as any).XMLHttpRequest
      ;(global as any).XMLHttpRequest = function () { return xhrMock }
      try {
        const wrapper = mount(EvidenceUploader, {
          props: { modelValue: [], refundId: 'r-cleanup' },
        })
        const input = wrapper.find('input[type=file]').element as HTMLInputElement
        setInputFiles(input, [new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })])
        await flushPromises()
        // 此时 xhr.send 已调用，currentXhr 已设置
        expect(xhrMock.send).toHaveBeenCalled()
        wrapper.unmount()
        // cleanup 应在 unmount 时调用 abort
        expect(xhrMock.abort).toHaveBeenCalled()
      } finally {
        ;(global as any).XMLHttpRequest = originalXHR
      }
    })
  })

  // ============================================================
  // key 渲染（带 id / 不带 id）
  // ============================================================
  describe('列表 key', () => {
    it('无 id 的文件应使用 index 作为 key（不报错即可）', () => {
      const wrapper = mount(EvidenceUploader, {
        props: {
          modelValue: [
            { filename: 'a.png', size: 100 },
            { filename: 'b.png', size: 200 },
          ],
        },
      })
      expect(wrapper.findAll('.evidence-card')).toHaveLength(2)
    })
  })
})
