// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 采集器出站代理判据的回归(2026-10-04)。
 *
 * 病灶(实测,不是推断):生产每轮 `ai-feed-collect` 固定 4 个源 `fetch failed`
 * (google-deepmind / meta-ai / mistral-ai / venturebeat-ai),
 * 每天 06:06 准时发出一封告警邮件,内容逐字相同。
 * 逐条实测:这 5~6 个源**直连全部失败**(google/mistral/feedburner 连 TCP 都建不起来),
 * 而经 http://127.0.0.1:7897 全部 200 且能取到 items(25/1/10/2/7 条)。
 *
 * 真因不是"源死了",是**采集器漏接了本仓早就有的出站代理**:同一份 SYNC_PROXY_URL
 * 只有 `ai-world-sync.ts:557-601` 用了,`ai-feed-service.ts` 的 fetchWithTimeout 那条腿没接。
 * 于是告警链每天准时报一个修得掉的故障 —— 这才是"一直在发邮件"的机制。
 *
 * 这里只钉**判据**(`shouldUseSyncProxy` / `isLoopbackUrl`):判据只有一行,值得能独立钉死。
 * 不起真网络(要外网+代理+DB,回归窗口跑不起来,也不会每次 CI 都有 7897)。
 * "代理接上之后真能取到内容"那一格由 2026-10-04 的实测取证负责,不在这里假装覆盖。
 */
import { describe, expect, it } from 'vitest'
import { isLoopbackUrl, shouldUseSyncProxy } from '../ai-feed-service.js'

const PROXY = 'http://127.0.0.1:7897'

describe('isLoopbackUrl', () => {
  it('认得三种回环写法(含端口与 IPv6 方括号)', () => {
    for (const u of [
      'http://127.0.0.1:8803/health',
      'http://localhost:8810/',
      'http://[::1]:8802/health',
    ]) {
      expect(isLoopbackUrl(u), u).toBe(true)
    }
  })

  it('不把「以 127.0.0.1 开头但不是主机名」的串误判成回环', () => {
    // 锚定在 "://" 之后,避免 127.0.0.1.evil.com / 127.0.0.10 这类被通配吃掉
    expect(isLoopbackUrl('https://127.0.0.1.evil.com/rss')).toBe(false)
    expect(isLoopbackUrl('https://127.0.0.10/rss')).toBe(false)
  })

  it('境外源一律不回环', () => {
    for (const u of [
      'https://blog.research.google/feeds/posts/default',
      'https://research.facebook.com/feed/',
      'https://mistral.ai/rss.xml',
      'https://feeds.feedburner.com/venturebeat/SZYF',
    ]) {
      expect(isLoopbackUrl(u), u).toBe(false)
    }
  })
})

describe('shouldUseSyncProxy', () => {
  it('本轮病灶:五个境外源在配置了代理时全部走代理(这一条钉住的就是那 4 封/天的邮件)', () => {
    for (const u of [
      'https://blog.research.google/feeds/posts/default',
      'https://research.facebook.com/feed/',
      'https://www.microsoft.com/en-us/research/feed/',
      'https://mistral.ai/rss.xml',
      'https://feeds.feedburner.com/venturebeat/SZYF',
    ]) {
      expect(shouldUseSyncProxy(u, PROXY), u).toBe(true)
    }
  })

  it('ai-service 本地调用永不走代理(走代理会把内网请求绕出去)', () => {
    for (const u of ['http://127.0.0.1:8803/health', 'http://localhost:8810/api/x']) {
      expect(shouldUseSyncProxy(u, PROXY), u).toBe(false)
    }
  })

  it('未配置 SYNC_PROXY_URL 时行为不变(直连),不得凭空造代理', () => {
    expect(shouldUseSyncProxy('https://mistral.ai/rss.xml', undefined)).toBe(false)
    expect(shouldUseSyncProxy('https://mistral.ai/rss.xml', '')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
