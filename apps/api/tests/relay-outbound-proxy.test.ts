// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { hostNeedsProxy } from '../src/services/relay-outbound-proxy.js'

const HOSTS = ['api.openai.com', 'generativelanguage.googleapis.com']

describe('hostNeedsProxy(中继出网代理分流判据)', () => {
  it('精确命中名单 host', () => {
    expect(hostNeedsProxy('api.openai.com', HOSTS)).toBe(true)
    expect(hostNeedsProxy('generativelanguage.googleapis.com', HOSTS)).toBe(true)
  })

  it('子域命中(含 `.` 边界)', () => {
    expect(hostNeedsProxy('us.api.openai.com', HOSTS)).toBe(true)
    expect(hostNeedsProxy('v1beta.generativelanguage.googleapis.com', HOSTS)).toBe(true)
  })

  it('大小写不敏感(host 归一在判据内)', () => {
    expect(hostNeedsProxy('API.OpenAI.COM', HOSTS)).toBe(true)
  })

  it('后缀非边界不命中(防 api.openai.com.evil.net 误入代理)', () => {
    expect(hostNeedsProxy('api.openai.com.evil.net', HOSTS)).toBe(false)
    expect(hostNeedsProxy('notopenai.com', HOSTS)).toBe(false)
  })

  it('国内/已通 host 一律不命中(不过代理,不绑本地代理软件)', () => {
    for (const h of [
      'open.bigmodel.cn',
      'api.siliconflow.cn',
      'dashscope.aliyuncs.com',
      'api.deepseek.com',
      'api.stepfun.com',
      'api.llm7.io',
      'openrouter.ai',
      'localhost',
      '127.0.0.1',
    ]) {
      expect(hostNeedsProxy(h, HOSTS)).toBe(false)
    }
  })

  it('名单为空 ⇒ 全不命中(缺省直连)', () => {
    expect(hostNeedsProxy('api.openai.com', [])).toBe(false)
  })
})
