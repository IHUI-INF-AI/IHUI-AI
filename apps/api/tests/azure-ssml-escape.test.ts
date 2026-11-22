// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Azure TTS 的 SSML 组装必须对**每个来自请求体的值**做 XML 转义。
 * 判据吃路由模块自己导出的 buildAzureSsml(§22c:不在测试里重抄一份拼装逻辑)。
 */
import { describe, expect, it } from 'vitest'

import { buildAzureSsml } from '../src/routes/ai-vendors/proxy-extended-media3.js'
import { escapeXml } from '../src/utils/xml-escape.js'

describe('escapeXml(共享唯一出口)', () => {
  it('五个 XML 保留字符各自成实体,顺序不会二次转义', () => {
    expect(escapeXml(`<>&'"`)).toBe('&lt;&gt;&amp;&apos;&quot;')
  })
  it('正向对照:普通文本与中文逐字不变', () => {
    expect(escapeXml('你好, world 42!')).toBe('你好, world 42!')
  })
})

describe('buildAzureSsml:用户文本不得逃出自己的节点', () => {
  it('关掉外层 <voice>/<speak> 并注入 <mstts:express-as> 的形态被转义成文字', () => {
    const payload = '</voice></speak><mstts:express-as style="cheerful">劫持'
    const ssml = buildAzureSsml({ text: payload })
    // 结构性断言:整份 SSML 里 speak/voice 各只有一对开合 —— 注入没能闭合外层
    expect(ssml.match(/<\/speak>/g) ?? []).toHaveLength(1)
    expect(ssml.match(/<voice/g) ?? []).toHaveLength(1)
    expect(ssml).not.toContain('<mstts:express-as')
    expect(ssml).toContain('&lt;/speak&gt;')
    expect(ssml).toContain('劫持')
  })

  it('prosody 的三个属性值同样转义(引号逃出属性 = 注入新属性)', () => {
    const ssml = buildAzureSsml({
      text: 'hi',
      rate: "100' speed='900",
      pitch: '<x>',
      volume: '"y"',
    })
    expect(ssml).not.toContain("speed='900")
    expect(ssml).toContain('&apos;')
    expect(ssml).toContain('&lt;x&gt;')
    expect(ssml).toContain('&quot;y&quot;')
  })

  it('voice / lang 也走转义(它们同样是请求体字段)', () => {
    const ssml = buildAzureSsml({
      text: 'hi',
      voice: "v' x='y",
      lang: 'zh-CN"><script',
    })
    expect(ssml).toContain('&apos;')
    expect(ssml).not.toContain('<script')
  })

  it('正向对照:正常文本 + 缺省档位照旧出可合成的 SSML', () => {
    const ssml = buildAzureSsml({ text: '今天天气不错' })
    expect(ssml).toBe(
      "<speak version='1.0' xml:lang='zh-CN'><voice name='zh-CN-XiaoxiaoNeural'>今天天气不错</voice></speak>",
    )
    const withRate = buildAzureSsml({ text: 'a', rate: '+10%' })
    expect(withRate).toContain("<prosody rate='+10%'>a</prosody>")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
