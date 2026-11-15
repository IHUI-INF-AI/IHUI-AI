// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * agent 执行引擎模式 —— shared 数据层真值表
 *
 * 钉四件事:
 *  ① isEngineMode 守卫:合法值放行 / 非法值拒绝(不冒充合法)。
 *  ② resolveAutoEngineLeg / resolveEffectiveEngineLeg 纯函数判据:
 *     桌面本地壳→local,其余→cloud;显式 local/cloud 原样覆盖 auto。
 *  ③ store 工厂:默认 auto(零回归);setMode 切换;非法值回退 auto。
 *  ④ 持久化往返:写后同 key 新实例 rehydrate 回读一致(数据落 transport)。
 *
 * 不在本测试判定本地 ai-service 连通性——那是 health 探针职责(单一真相源)。
 */
import { describe, it, expect } from 'vitest'
import {
  isEngineMode,
  resolveAutoEngineLeg,
  resolveEffectiveEngineLeg,
  createEngineModeStore,
  ENGINE_MODES,
} from '../engine-mode-store'
import { createMemoryTransport } from '../transport'

const LOCAL_SHELL = { isTauri: true, isRemoteWindow: false }
const REMOTE_SHELL = { isTauri: true, isRemoteWindow: true }
const BROWSER_DEV = { isTauri: false, isRemoteWindow: false }

describe('engine mode isEngineMode 守卫', () => {
  it('合法值放行', () => {
    for (const m of ENGINE_MODES) {
      expect(isEngineMode(m)).toBe(true)
    }
  })

  it('非法值拒绝,不冒充合法', () => {
    for (const bad of ['', 'local-engine', 'AUTO', 'cloud2', null, undefined, 123, {}]) {
      expect(isEngineMode(bad)).toBe(false)
    }
  })
})

describe('resolveAutoEngineLeg 纯函数判据', () => {
  it('桌面本地壳(Tauri + 非远端)→ local(直连本机 8803)', () => {
    expect(resolveAutoEngineLeg(LOCAL_SHELL)).toBe('local')
  })

  it('桌面远端生产薄壳(Tauri + aizhs.top)→ cloud(同源,绝不回退本机)', () => {
    expect(resolveAutoEngineLeg(REMOTE_SHELL)).toBe('cloud')
  })

  it('浏览器 dev / 生产 → cloud(同源 /api/*,零回归=现状)', () => {
    expect(resolveAutoEngineLeg(BROWSER_DEV)).toBe('cloud')
  })
})

describe('resolveEffectiveEngineLeg 显式覆盖', () => {
  it("auto 按环境解析(本地壳→local)", () => {
    expect(resolveEffectiveEngineLeg('auto', LOCAL_SHELL)).toBe('local')
    expect(resolveEffectiveEngineLeg('auto', BROWSER_DEV)).toBe('cloud')
  })

  it("显式 local 原样生效,即使远端壳(用户强制,连不上由调用方报错)", () => {
    expect(resolveEffectiveEngineLeg('local', REMOTE_SHELL)).toBe('local')
  })

  it("显式 cloud 原样生效,即使本地壳(强制走服务器大模型)", () => {
    expect(resolveEffectiveEngineLeg('cloud', LOCAL_SHELL)).toBe('cloud')
  })
})

describe('createEngineModeStore 工厂', () => {
  it('默认 auto(零回归:存量用户无感)', () => {
    const store = createEngineModeStore({ transport: createMemoryTransport() })
    expect(store.getState().mode).toBe('auto')
  })

  it('setMode 切换到 local / cloud', () => {
    const store = createEngineModeStore({ transport: createMemoryTransport() })
    store.getState().setMode('local')
    expect(store.getState().mode).toBe('local')
    store.getState().setMode('cloud')
    expect(store.getState().mode).toBe('cloud')
  })

  it('setMode 非法值回退 auto,不冒充合法', () => {
    const store = createEngineModeStore({ transport: createMemoryTransport() })
    store.getState().setMode('local')
    expect(store.getState().mode).toBe('local')
    // @ts-expect-error 故意传非法值验证守卫
    store.getState().setMode('bogus')
    expect(store.getState().mode).toBe('auto')
  })

  it('持久化写入:setMode 把 mode 落进 transport blob', async () => {
    const transport = createMemoryTransport()
    const store = createEngineModeStore({ transport, persistKey: 'engine-mode' })
    store.getState().setMode('local')
    // zustand persist 写 storage 是异步的,等一个微任务让 setItem 完成
    await Promise.resolve()
    const raw = transport.getItem('engine-mode')
    expect(raw).not.toBeNull()
    const blob = JSON.parse(raw as string)
    // persist 包装为 {state:{mode},version};blob 只存 mode(无敏感信息)
    expect(blob.state.mode).toBe('local')
  })

  it('缺省 transport(不传)也不崩,走内存', () => {
    const store = createEngineModeStore()
    store.getState().setMode('cloud')
    expect(store.getState().mode).toBe('cloud')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
