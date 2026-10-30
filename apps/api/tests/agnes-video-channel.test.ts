// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agnes 视频通道(键 + 端点)钉子(2026-10-30 立)。
 *
 * 立据的上游实测(2026-10-30 直连四组合 × GET /v1/models):
 *   api.agnes-ai.cn     只认新 key(旧 key 401)
 *   apihub.agnes-ai.cn  只认旧 key(新 key 401)
 *   apihub.agnes-ai.com 只认旧 key(新 key 401)
 * ⇒ 域名与 key 按账号成对绑定,拆开必然 401;本票把视频通道拆成可独立于文本/图片的一对键,
 *   正是为了让付费视频流能挂到另一条队列上,而不是为了让它"换个 key 绕过限流"。
 */
import { describe, it, expect } from 'vitest'
import {
  VENDORS,
  resolveAgnesVideoChannel,
  agnesVideoPollUrl,
  pickAgnesVideoUrl,
} from '../src/routes/ai-vendors/_shared.js'

const AGNES_ENV_KEYS = [
  'AGNES_API_KEY',
  'AGNES_API_BASE',
  'AGNES_VIDEO_API_KEY',
  'AGNES_VIDEO_API_BASE',
] as const

/** 只在本批四个键的作用域内改 env,跑完原样还原(共享进程 env,不清他人)。 */
function withEnv<T>(
  overrides: Partial<Record<(typeof AGNES_ENV_KEYS)[number], string>>,
  fn: () => T,
): T {
  const saved: Record<string, string | undefined> = {}
  for (const k of AGNES_ENV_KEYS) saved[k] = process.env[k]
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    return fn()
  } finally {
    for (const k of AGNES_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

describe('resolveAgnesVideoChannel', () => {
  it('只配视频 key ⇒ 用视频 key,端点回退到 VENDORS.agnes.baseUrl(不自立第二张表)', () => {
    withEnv({ AGNES_VIDEO_API_KEY: 'sk-video', AGNES_API_KEY: 'sk-text' }, () => {
      const ch = resolveAgnesVideoChannel()
      expect(ch?.key).toBe('sk-video')
      expect(ch?.baseUrl).toBe(VENDORS.agnes!.baseUrl)
    })
  })

  it('未配视频 key ⇒ 回退文本 key(视频通道不配东西也能跑)', () => {
    withEnv({ AGNES_VIDEO_API_KEY: undefined, AGNES_API_KEY: 'sk-text' }, () => {
      expect(resolveAgnesVideoChannel()?.key).toBe('sk-text')
    })
  })

  it('空串等同未配(两侧都空 ⇒ null,由调用侧落 503 而不是带空 Bearer 打上游)', () => {
    withEnv({ AGNES_VIDEO_API_KEY: '   ', AGNES_API_KEY: '' }, () => {
      expect(resolveAgnesVideoChannel()).toBeNull()
    })
  })

  it('视频 base 显式配置时优先,且尾斜杠被归一 ⇒ 拼出来的提交 URL 不出现 //', () => {
    withEnv(
      { AGNES_API_KEY: 'sk-text', AGNES_VIDEO_API_BASE: 'https://q.example.test/v1///' },
      () => {
        const ch = resolveAgnesVideoChannel()
        expect(ch?.baseUrl).toBe('https://q.example.test/v1')
        expect(`${ch!.baseUrl}/videos`).toBe('https://q.example.test/v1/videos')
      },
    )
  })

  it('未配视频 base ⇒ 端点等于 VENDORS.agnes.baseUrl(回退到那张表,不再硬钉第二份字面量)', () => {
    withEnv(
      { AGNES_API_KEY: 'sk-text', AGNES_VIDEO_API_BASE: undefined, AGNES_API_BASE: undefined },
      () => {
        expect(resolveAgnesVideoChannel()?.baseUrl).toBe(VENDORS.agnes!.baseUrl)
      },
    )
  })

  it('AGNES_API_BASE 在调用时改 ⇒ 端点跟着改(判据必须是调用时读,不是模块加载期快照)', () => {
    // 阳性对照:这张表里的 baseUrl 是导入期快照,本用例用「运行期值 ≠ 导入期值」把两者劈开。
    // 若实现退回「直接拿 VENDORS.agnes.baseUrl 兜底」,本例即红。
    withEnv(
      {
        AGNES_API_KEY: 'sk-text',
        AGNES_VIDEO_API_BASE: undefined,
        AGNES_API_BASE: 'https://runtime.example.test/v1',
      },
      () => {
        expect(resolveAgnesVideoChannel()?.baseUrl).toBe('https://runtime.example.test/v1')
      },
    )
  })
})

describe('agnesVideoPollUrl(上游两形态查询的单源判据)', () => {
  const base = 'https://api.example.test/v1'
  it('task_ 前缀 ⇒ GET {base}/videos/{id}', () => {
    expect(agnesVideoPollUrl(base, 'task_abc123')).toBe(`${base}/videos/task_abc123`)
  })
  it('非 task_ 前缀 ⇒ GET {origin}/agnesapi?video_id={id},origin 必须去掉 /v1', () => {
    expect(agnesVideoPollUrl(base, 'video_abc123')).toBe(
      'https://api.example.test/agnesapi?video_id=video_abc123',
    )
  })
  it('id 里的特殊字符必须被编码(不得拼出可越路径的 URL)', () => {
    expect(agnesVideoPollUrl(base, 'task_a/b?c')).toBe(`${base}/videos/task_a%2Fb%3Fc`)
  })
})

describe('pickAgnesVideoUrl(上游把成片地址散在五处)', () => {
  it('五个位置各命中一次', () => {
    expect(pickAgnesVideoUrl({ metadata: { url: 'https://a/x.mp4' } })).toBe('https://a/x.mp4')
    expect(pickAgnesVideoUrl({ video_url: 'https://b/x.mp4' })).toBe('https://b/x.mp4')
    expect(pickAgnesVideoUrl({ url: 'https://c/x.mp4' })).toBe('https://c/x.mp4')
    expect(pickAgnesVideoUrl({ output_url: 'https://d/x.mp4' })).toBe('https://d/x.mp4')
    expect(pickAgnesVideoUrl({ result: { video_url: 'https://e/x.mp4' } })).toBe('https://e/x.mp4')
  })
  it('顺序:metadata.url 先于顶层 url(v1 网关只认顶层 video_url,取错序会回退错地址)', () => {
    expect(
      pickAgnesVideoUrl({ metadata: { url: 'https://first.mp4' }, url: 'https://later.mp4' }),
    ).toBe('https://first.mp4')
  })
  it('非 http(s) 值与错类型一律不取;全缺 ⇒ 空串', () => {
    expect(pickAgnesVideoUrl({ url: 'file:///local.mp4', metadata: { url: 42 } })).toBe('')
    expect(pickAgnesVideoUrl({})).toBe('')
    expect(pickAgnesVideoUrl(null)).toBe('')
    expect(pickAgnesVideoUrl({ metadata: null, result: 'not-an-object' })).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
