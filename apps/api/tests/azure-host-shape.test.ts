// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Azure 系列端点的**主机名/路径段形状**锁(票:凭据外发 + 认证型 SSRF)。
 *
 * 病灶(现读,不是推断):`resource`/`deployment`/`apiVersion`/`region` 原先只 `min(1)`,
 * 而它们被**拼进 URL 结构**:resource 与 region 落在主机名的那个标签上、deployment 落在路径段。
 * 于是 `resource = 'evil.test/#'` 拼出 `https://evil.test/#.openai.azure.com/openai/models`,
 * `new URL()` 解析出的主机名就是 evil.test —— 而 callVendorWithKey 会把**服务端存的 Azure
 * 密钥**塞进出站头 ⇒ 平台密钥随请求外发到攻击者主机,内网/元数据地址同样打得到。
 *
 * 本文件直接吃路由模块的 `__test__` 出口(§22c:判据只住生产实现,测试不重抄一份)。
 * 反向对照那一条钉的是"没有形状收窄时,注入是真成立的" —— 把正则放宽回 min(1),
 * 下面四条 accept/reject 即翻红。
 */
import { describe, expect, it } from 'vitest'

import { __test__ as azure } from '../src/routes/ai-vendors/proxy-extended-media3.js'

describe('resource 形状:只能是一个 DNS 标签', () => {
  it.each(['my-res-1', 'ihuiEastUs2', 'a1'])('合法资源名 %s 通过', (v) => {
    expect(azure.azureResourceShape(v)).toBe(true)
  })

  it.each([
    'evil.test/#',
    'a.openai.azure.com.evil.cn',
    '169.254.169.254/?x=',
    'res/path',
    'res@internal',
    'res:8080',
    'res user',
    '',
  ])('越狱形态 %s 当场拒', (v) => {
    expect(azure.azureResourceShape(v)).toBe(false)
  })
})

describe('deployment / apiVersion / region 形状', () => {
  it('deployment 不得带 ? # / 空白(路径段注入)', () => {
    expect(azure.azureDeploymentShape('gpt-4o-deploy_1.2')).toBe(true)
    expect(azure.azureDeploymentShape('d?x=1')).toBe(false)
    expect(azure.azureDeploymentShape('d#/evil')).toBe(false)
    expect(azure.azureDeploymentShape('a/b')).toBe(false)
  })

  it('apiVersion 只收版本号形态,不得改 query 结构', () => {
    expect(azure.azureApiVersionShape('2024-10-21')).toBe(true)
    expect(azure.azureApiVersionShape('preview')).toBe(true)
    expect(azure.azureApiVersionShape('1&api-version=x&y=')).toBe(false)
  })

  it('TTS region 落在主机名上 ⇒ 只收小写字母数字段', () => {
    expect(azure.azureSpeechRegionShape('eastus')).toBe(true)
    expect(azure.azureSpeechRegionShape('WestEurope')).toBe(true)
    expect(azure.azureSpeechRegionShape('169.254.169.254/?x=')).toBe(false)
    expect(azure.azureSpeechRegionShape('a.b.c')).toBe(false)
  })
})

describe('反向对照:证明"没有形状收窄"时注入是真成立的(而不是吓唬人)', () => {
  it('合法 resource 拼出的主机名仍是 *.openai.azure.com', () => {
    const u = new URL(azure.azureUrl('my-res-1', '/openai/models', '2024-10-21'))
    expect(u.hostname).toBe('my-res-1.openai.azure.com')
  })

  it('未收窄的形态喂进 azureUrl ⇒ 主机名被整段换掉(本票要防的就是这一格)', () => {
    const u = new URL(azure.azureUrl('evil.test/#', '/openai/models', '2024-10-21'))
    expect(u.hostname).toBe('evil.test')
    // 这条断言是"判据必须拦的东西",不是 azureUrl 自己的职责:azureUrl 只负责拼,
    // 拦住它的是上面 resource 的形状;两者同时钉住才构成完整防线。
    expect(azure.azureResourceShape('evil.test/#')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
