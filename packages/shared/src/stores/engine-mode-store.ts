// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * @ihui/shared/stores/engine-mode — agent 执行引擎模式(本地 / 云端 / 自动)
 *
 * 阶段 3 第一片(2026-11-15):「本地/云端切换按钮」的地基。
 *
 * 背景(见 tmp/本地云端引擎切换_核实与方案.md):
 *  - 本地引擎 = ai-service 跑在用户机(本地壳直连 127.0.0.1:8803)+ 本地模型(ollama)
 *    + 34 纯本地工具,编排+工具+推理负载不占线上服务器(真减负)。
 *  - 云端引擎 = 现状:ai-service 跑在服务器,经同源 /api/* 反代。
 *  - 基础设施**已支持**分流(api-base-url.ts 的 resolveAiServiceBaseUrl:本地壳→8803,
 *    远端壳→同源),缺的是「用户可感知的显式开关 + 模式覆盖」——本模块补这一片。
 *
 * 三模式语义:
 *  - 'auto'(默认):沿用 base-url 现有自动判定。桌面本地壳(端口 8801 的 dev 壳 /
 *    tauri.localhost / offline)走本地 ai-service;浏览器 dev / 生产远端壳走云端。
 *    这保证零回归——auto 就是现状。
 *  - 'local':用户显式强制本地引擎。仅在「本机确实跑着 ai-service」时可用;远端浏览器
 *    强制 local 会打到自己机器的 8803(连不上则由调用方报错,本模块不做连通性判定)。
 *  - 'cloud':用户显式强制云端引擎。桌面本地壳也可强制走线上(如想用服务器大模型)。
 *
 * 设计原则(对齐 auth-store):
 * 1. 纯函数核心:模式→基址覆盖的解析判据是纯函数,可单测,不碰 DOM/网络。
 * 2. 依赖注入:持久化 transport 由各端注入(web localStorage / RN AsyncStorage / 内存)。
 * 3. 零回归:auto 默认 = 现状,存量用户无感。
 * 4. 不判定连通性:本 store 只管「用户选了什么」与「该用哪个基址」;本地 ai-service 是否
 *    真在跑,由 health 探针(ai-service local_provider_health)/ 调用方运行时判定,
 *    不在本模块重复一份判据(§0.6 单一真相源)。
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore, type UseBoundStore } from 'zustand/react'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { PersistTransport } from './transport'

/** agent 执行引擎模式。 */
export type EngineMode = 'auto' | 'local' | 'cloud'

export const ENGINE_MODES: readonly EngineMode[] = ['auto', 'local', 'cloud']

export function isEngineMode(v: unknown): v is EngineMode {
  return v === 'auto' || v === 'local' || v === 'cloud'
}

/** 窗口运行环境(供纯函数判定 auto 落到哪条腿)。 */
export interface EngineModeWindowContext {
  /** 是否 Tauri 桌面壳运行时(与 api-base-url.ts isTauriRuntime 同判据,注入避免重复探测) */
  isTauri: boolean
  /** 桌面壳窗口是否由远端站点承载(如 https://aizhs.top)——远端生产薄壳 */
  isRemoteWindow: boolean
}

/**
 * 纯函数:auto 模式落到哪条腿。
 *
 * 判据与 api-base-url.ts resolveAiServiceBaseUrl 同源(§0.6 单一真相源):
 *  - 桌面本地壳(Tauri + 非远端窗口)→ local(直连本机 8803)
 *  - 其余(浏览器 dev / 生产 / 桌面远端薄壳)→ cloud(同源 /api/*)
 *
 * 这里返回的是「腿」而非具体 URL——具体 URL 由 web 层的 resolveAiServiceBaseUrl /
 * resolveStreamApiBaseUrl 按 env + 窗口 origin 解析(本模块不抄第二份真值)。
 */
export function resolveAutoEngineLeg(ctx: EngineModeWindowContext): 'local' | 'cloud' {
  if (ctx.isTauri && !ctx.isRemoteWindow) return 'local'
  return 'cloud'
}

/**
 * 纯函数:把用户选的 EngineMode 解析成最终生效的「腿」。
 *
 * - 'auto' → resolveAutoEngineLeg(按运行环境)
 * - 'local' / 'cloud' → 显式覆盖,原样生效
 */
export function resolveEffectiveEngineLeg(
  mode: EngineMode,
  ctx: EngineModeWindowContext,
): 'local' | 'cloud' {
  if (mode === 'auto') return resolveAutoEngineLeg(ctx)
  return mode
}

export interface EngineModeStoreState {
  /** 用户选择的引擎模式(默认 auto = 现状,零回归) */
  mode: EngineMode
  setMode: (m: EngineMode) => void
}

export interface CreateEngineModeStoreOptions {
  /** 持久化 transport(可选;缺省走内存,SSR/测试安全) */
  transport?: PersistTransport
  /** storage key,默认 'engine-mode' */
  persistKey?: string
  /** persist version */
  version?: number
}

export interface CreatedEngineModeStore {
  useEngineMode: UseBoundStore<StoreApi<EngineModeStoreState>>
  getState: () => EngineModeStoreState
  setState: StoreApi<EngineModeStoreState>['setState']
  subscribe: StoreApi<EngineModeStoreState>['subscribe']
  reset: () => void
}

/**
 * 引擎模式 zustand 工厂。持久化 transport 由各端注入(缺省走内存 persistStorage,
 * SSR/测试安全)。持久化 blob 只存 mode(无 token/敏感信息)。
 * 写法对齐 theme-store(单 createStore + persist + createJSONStorage,避开 Taro 归并 bug)。
 */
export function createEngineModeStore(options: CreateEngineModeStoreOptions = {}): CreatedEngineModeStore {
  const { transport, persistKey = 'engine-mode', version = 1 } = options

  const persistStorage: StateStorage = {
    getItem: async (name) => {
      if (!transport) return null
      return transport.getItem(name)
    },
    setItem: async (name, value) => {
      if (!transport) return
      await transport.setItem(name, value)
    },
    removeItem: async (name) => {
      if (!transport) return
      await transport.removeItem(name)
    },
  }

  const DEFAULT_STATE: EngineModeStoreState = {
    mode: 'auto',
    setMode: (m) => {
      storeApi.setState({ mode: isEngineMode(m) ? m : 'auto' })
    },
  }

  // createStore(zustand/vanilla)避开 Taro Vite 把 `create` 归并到 taro.react_production_min 的问题
  const storeApi = createStore<EngineModeStoreState>()(
    persist(() => DEFAULT_STATE, {
      name: persistKey,
      storage: createJSONStorage(() => persistStorage),
      version,
    }),
  )

  // 手动构造 UseBoundStore:既可作 hook 调用,又保留 .getState/.setState/.subscribe
  const useBoundStore = Object.assign(
    function useEngineModeHook<U>(selector?: (state: EngineModeStoreState) => U): U {
      return useStore(storeApi, selector as (state: EngineModeStoreState) => U)
    } as UseBoundStore<StoreApi<EngineModeStoreState>>,
    {
      getState: storeApi.getState,
      setState: storeApi.setState,
      subscribe: storeApi.subscribe,
    },
  )

  return {
    useEngineMode: useBoundStore,
    getState: storeApi.getState,
    setState: storeApi.setState,
    subscribe: storeApi.subscribe,
    reset: () => {
      storeApi.setState({ mode: 'auto' })
    },
  }
}

/**
 * 全局默认引擎模式 store(供非 React 消费点用,如 api.ts 的 base-url 解析)。
 * 用内存 transport(无持久化)——api.ts 模块加载期 import,localStorage 在此环境
 * 未必可用;持久化版本由 React 侧(web store with localStorage transport)单独建。
 * 单一真相源:全局解析走这里;UI 绑定走各端自建 store。
 */
const globalEngineModeStore = createEngineModeStore()

/** 读当前全局引擎模式(非 React 消费点用)。 */
export function getGlobalEngineMode(): EngineMode {
  return globalEngineModeStore.getState().mode
}

/** 设当前全局引擎模式(供 UI 切换同步到非 React 解析路径)。 */
export function setGlobalEngineMode(m: EngineMode): void {
  globalEngineModeStore.getState().setMode(m)
}

/** 订阅全局引擎模式变化(供需要响应式同步的桥接点)。 */
export function subscribeGlobalEngineMode(
  listener: (mode: EngineMode) => void,
): () => void {
  return globalEngineModeStore.subscribe((s) => listener(s.mode))
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
