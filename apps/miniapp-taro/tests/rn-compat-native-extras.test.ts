// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-extras 的单元锁。
 *
 * 这三件是 279 个 RN 壳的公共前置(就绪尺:三处引入点锁死全量);语义降级必须**显式**:
 *   - File 走本地 Storage,小文本(主题偏好)读写等价;
 *   - 二进制写入不落盘,且只告警一次(否则每个音频帧刷屏);
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
  },
}))

import Restart, {
  colorScheme,
  Directory,
  File,
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

  it('二进制写入不抛、不落文本,并告警一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = new File(Paths.cache, 'tts-1.mp3')
    expect(() => f.write(new Uint8Array([1, 2, 3]))).not.toThrow()
    expect(f.exists).toBe(true)
    const hits = warn.mock.calls.filter((c) => String(c[0]).includes('二进制'))
    expect(hits.length).toBeLessThanOrEqual(1, '同一告警只应出现一次,避免逐帧刷屏')
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
    expect(colorScheme.get()).toBe('dark', 'system = 交还控制权,不应清空已解析档')
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
