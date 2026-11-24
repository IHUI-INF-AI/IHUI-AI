// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-extras 的单元锁。
 *
 * 这三件是 279 个 RN 壳的公共前置(就绪尺:三处引入点锁死全量);语义降级必须**显式**:
 *   - File 走本地 Storage,小文本(主题偏好)读写等价;
 *   - 二进制写入无等价能力 ⇒ 显式抛 NotSupportedError(code=ERR_NOT_SUPPORTED),
 *     不再"告警一次后静默成功"(XUI-054:让调用方按 code 判,而不是以为已经写进去了);
 *   - restart 在小程序不可能真重启 ⇒ 空实现但不能抛(调用方包在 try 里,抛了会走错分支)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// Taro 运行时在 node 环境加载会因平台全局量缺失直接抛(ENABLE_INNER_HTML)。
// 被测模块只用到三条 storage API,替身即可;替身的 getStorage 抛错 ⇒ 正好覆盖"存储不可用"降级分支。
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: () => {
      throw new Error('no storage in vitest')
    },
    setStorageSync: () => {
      throw new Error('no storage in vitest')
    },
    removeStorageSync: () => {
      throw new Error('no storage in vitest')
    },
    getSystemInfoSync: () => ({ model: 'TestPhone', system: 'Android 15' }),
    getLaunchOptionsSync: () => ({ path: 'pages/x', query: { a: '1', b: '中文' } }),
    navigateTo: async () => ({ errMsg: 'ok' }),
  },
}))

import Restart, {
  colorScheme,
  createURL,
  Directory,
  File,
  getInitialURL,
  modelId,
  NOT_SUPPORTED_CODE,
  NotSupportedError,
  openAuthSessionAsync,
  parse,
  Paths,
} from '@/rn-compat/native-extras'

afterEach(() => vi.restoreAllMocks())

describe('File:同步读写(Storage 承载)', () => {
  it('写入后能读回,exists/size 同步变化', () => {
    const f = new File(Paths.document, 'ihui-theme-mode')
    f.delete()
    expect(f.exists).toBe(false)
    expect(f.textSync()).toBe('')
    f.write('v2:dark')
    expect(f.exists).toBe(true)
    expect(f.textSync()).toBe('v2:dark')
    expect(f.size).toBe(7)
  })

  it('uri 由目录与文件名拼成', () => {
    const f = new File(Paths.cache, 'voice-turn-1.mp3')
    expect(f.uri).toBe('wxfile://usr/cache/voice-turn-1.mp3')
  })

  it('二进制写入显式 not-supported:抛固定错误码,不落文本也不假装成功', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = new File(Paths.cache, 'tts-1.mp3')
    expect(() => f.write(new Uint8Array([1, 2, 3]))).toThrowError(NotSupportedError)
    // 调用方按 code 判,不要匹配 message
    try {
      f.write(new Uint8Array([1]))
      throw new Error('二进制写入应当抛 NotSupportedError')
    } catch (e) {
      expect((e as NotSupportedError).code).toBe(NOT_SUPPORTED_CODE)
    }
    // 失败不得留下"写成功了"的痕迹
    expect(f.exists).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('delete 之后 exists=false', () => {
    const f = new File(Paths.document, 'gone')
    f.write('x')
    f.delete()
    expect(f.exists).toBe(false)
  })

  it('Directory 可构造且 exists 恒真', () => {
    const d = new Directory(Paths.cache, 'sub')
    expect(d.exists).toBe(true)
    expect(() => d.create()).not.toThrow()
  })
})

describe('nativewind colorScheme', () => {
  it('set 后 get 读回;system 不覆盖已有解析值', () => {
    colorScheme.set('dark')
    expect(colorScheme.get()).toBe('dark')
    colorScheme.set('system')
    // system = 交还控制权,不应清空已解析档
    expect(colorScheme.get()).toBe('dark')
    colorScheme.set('light')
    expect(colorScheme.get()).toBe('light')
  })
})

describe('react-native-restart', () => {
  it('空实现不抛(调用方的 catch 分支不得被误触发)', () => {
    expect(() => Restart.restart('theme')).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

describe('expo-device / linking / web-browser 的降级语义', () => {
  it('modelId 从系统信息现读', () => {
    expect(modelId).toBe('TestPhone')
  })

  it('getInitialURL 由启动参数合成(路径 + query 编码)', async () => {
    const url = await getInitialURL()
    expect(url).toBe('ihui-miniapp://pages/x?a=1&b=%E4%B8%AD%E6%96%87')
  })

  it('createURL / parse 互逆(路径与 query)', () => {
    expect(createURL('/sso/callback')).toBe('ihui-miniapp://sso/callback')
    const p = parse('ihui-miniapp://sso/callback?code=abc')
    expect(p.scheme).toBe('ihui-miniapp')
    expect(p.path).toBe('sso/callback')
    expect(p.queryParams).toEqual({ code: 'abc' })
  })

  it('openAuthSessionAsync 显式按取消返回,绝不假装 success', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await openAuthSessionAsync('https://x', 'ihui-miniapp://cb')
    // 假装成功会让调用方等一个永不到的回跳
    expect(r).toEqual({ type: 'cancel' })
    expect(warn.mock.calls.some((c) => String(c[0]).includes('认证会话'))).toBe(true)
  })
})
