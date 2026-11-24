// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端配置拼装的行为锁(2026-11-18 立)。
 *
 * 钉的是「接不通工单」的四个成因:
 *   C1 不猜端点   baseUrl 为空/无协议 ⇒ 拒绝拼装,绝不回落硬编码域名。
 *   C2 不静默     未知客户端 ⇒ 报错 + 支持清单,不拼一份看似像样的错配置。
 *   C3 不泄 key   OpenAI SDK 档刻意给 ${API_KEY} 占位(截图外泄是真实事故)。
 *   C4 可复制     7 档都能出正文,且正文里只出现调用方传入的 base/key/model。
 */
import { describe, it, expect } from 'vitest'
import {
  buildClientConfig,
  listClientPresets,
  CLIENT_PRESETS,
  PRESET_LABELS,
  __test__,
} from '../src/services/relay-client-config.js'

const BASE = 'https://gateway.example.test'
const KEY = 'sk-live-abcdef123456'

describe('relay-client-config', () => {
  it('C4 七档全部能出正文,且格式各按其协议', () => {
    const expectFormat: Record<string, string> = {
      'openai-sdk': 'json',
      'codex-cli': 'env',
      'claude-code': 'env',
      chatbox: 'text',
      'cherry-studio': 'text',
      nextchat: 'text',
      curl: 'shell',
    }
    for (const client of CLIENT_PRESETS) {
      const r = buildClientConfig({ client, baseUrl: BASE, apiKey: KEY, model: 'qwen3.8-max' })
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.format).toBe(expectFormat[client])
      expect(r.body.length).toBeGreaterThan(10)
      expect(r.clientLabel).toBe(PRESET_LABELS[client])
    }
  })

  it('C2 未知客户端 ⇒ ok:false + 支持清单(不静默)', () => {
    const r = buildClientConfig({ client: 'vscode-plugin', baseUrl: BASE, apiKey: KEY })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('unknown-client')
    expect(r.supported).toEqual([...CLIENT_PRESETS])
  })

  it('C1 不猜端点:baseUrl 为空 ⇒ 拒绝并给本机/局域网两种填法', () => {
    const r = buildClientConfig({ client: 'curl', baseUrl: '   ', apiKey: KEY })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing-base-url')
    expect(r.reason).toContain('127.0.0.1')
    expect(r.reason).toContain('内网IP')
  })

  it('C1b 不猜协议:baseUrl 缺 http(s) ⇒ 拒绝而不是默认 https', () => {
    const r = buildClientConfig({ client: 'curl', baseUrl: 'gateway.example.test', apiKey: KEY })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing-base-url')
    expect(r.reason).toContain('http://')
  })

  it('C1c 尾部斜杠被归一:https://x/ 与 https://x 产出同一体', () => {
    const a = buildClientConfig({ client: 'curl', baseUrl: 'https://x.test/', apiKey: KEY, model: 'm1' })
    const b = buildClientConfig({ client: 'curl', baseUrl: 'https://x.test', apiKey: KEY, model: 'm1' })
    expect(a).toEqual(b)
  })

  it('C3 不泄 key:openai-sdk 给 ${API_KEY} 占位,正文里不出现真 key', () => {
    const r = buildClientConfig({ client: 'openai-sdk', baseUrl: BASE, apiKey: KEY, model: 'm1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.body).not.toContain(KEY)
    expect(r.body).toContain('${API_KEY}')
    expect(r.warnings.join('\n')).toContain('截图')
  })

  it('C4b curl 档用 /v1/chat/completions,并带 Bearer', () => {
    const r = buildClientConfig({ client: 'curl', baseUrl: BASE, apiKey: KEY, model: 'm1' })
    if (!r.ok) throw new Error('前置失败')
    expect(r.body).toContain(`${BASE}/v1/chat/completions`)
    expect(r.body).toContain(`Authorization: Bearer ${KEY}`)
  })

  it('C4c codex-cli 用两个 env 键(OPENAI_BASE_URL / OPENAI_API_KEY)', () => {
    const r = buildClientConfig({ client: 'codex-cli', baseUrl: BASE, apiKey: KEY })
    if (!r.ok) throw new Error('前置失败')
    expect(r.body).toContain(`OPENAI_BASE_URL=${BASE}`)
    expect(r.body).toContain(`OPENAI_API_KEY=${KEY}`)
    expect(r.format).toBe('env')
  })

  it('C4d 未指定模型 ⇒ warnings 点名(但仍能生成)', () => {
    const r = buildClientConfig({ client: 'chatbox', baseUrl: BASE, apiKey: KEY })
    if (!r.ok) throw new Error('前置失败')
    expect(r.warnings.join('\n')).toContain('未指定模型')
  })

  it('apiKey 缺失 ⇒ ok:false 且点名签发入口', () => {
    const r = buildClientConfig({ client: 'chatbox', baseUrl: BASE, apiKey: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing-api-key')
    expect(r.reason).toContain('Key 池')
  })

  it('不内置域名:输出里的 host 只能来自调用方传入的 baseUrl', () => {
    const r = buildClientConfig({ client: 'nextchat', baseUrl: 'http://10.0.0.5:8790', apiKey: KEY })
    if (!r.ok) throw new Error('前置失败')
    expect(r.body).toContain('10.0.0.5:8790')
    for (const host of ['qoder.com', 'qoder.com.cn', 'api1.qoder.sh', 'gateway.qoder.com.cn']) {
      expect(r.body).not.toContain(host)
    }
  })

  it('纯函数:同输入恒等同输出', () => {
    const input = { client: 'cherry-studio' as const, baseUrl: BASE, apiKey: KEY, model: 'm' }
    expect(buildClientConfig(input)).toEqual(buildClientConfig(input))
  })

  it('预设清单与标签表同源(listClientPresets 不另抄一份)', () => {
    const listed = listClientPresets()
    expect(listed.map((x) => x.value)).toEqual([...CLIENT_PRESETS])
    expect(listed.every((x) => x.label === PRESET_LABELS[x.value])).toBe(true)
  })

  it('工具函数:normalizeBaseUrl 只去尾斜杠,不补协议', () => {
    expect(__test__.normalizeBaseUrl('https://a.b///')).toBe('https://a.b')
    expect(__test__.normalizeBaseUrl('  https://a.b  ')).toBe('https://a.b')
    expect(__test__.normalizeBaseUrl('a.b')).toBe('a.b')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
