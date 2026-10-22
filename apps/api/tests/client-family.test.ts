// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import {
  CLIENT_FAMILIES,
  classifyClientFamily,
  type ClientFamily,
} from '../src/utils/bot-detection.js'

/**
 * 客户端族归一的取证面。UA 样本一律取自 2026-10-23 对 api_logs 的现读实测,
 * 不造样本 —— 造出来的样本只会证明判据写得舒服,证明不了它认得出真实世界。
 */

const FIXTURES: Array<[ClientFamily, string]> = [
  ['first-party', 'IHUIAI-App/0.0.5 (android/36)'],
  ['first-party', 'IHUI-CLI/9.9.9 (win32/x64)'],
  ['webhook', 'GitHub-Hookshot/9201e7d'],
  ['monitor', 'UptimeRobot/2.0; https://uptimerobot.com'],
  [
    'agent-tool',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QoderCN/0.4.8 Chrome/150.0.78',
  ],
  [
    'agent-tool',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7',
  ],
  ['agent-tool', 'openclaw-provider-scout'],
  ['agent-tool', 'agentwebmap-bot/0.2 (+https://agentwebmap.com)'],
  [
    'ai-crawler',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://claude.ai/bot)',
  ],
  ['ai-crawler', 'Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai/)'],
  [
    'ai-crawler',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0)',
  ],
  [
    'ai-crawler',
    'Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0; +https://developers.facebook.com)',
  ],
  [
    'headless',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36',
  ],
  ['headless', 'Playwright/1.62.1 (x64; windows 10.0) node/26.6'],
  ['search-crawler', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  [
    'search-crawler',
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  ],
  ['search-crawler', 'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)'],
  ['cli', 'curl/8.21.0'],
  ['cli', 'Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; zh-CN) PowerShell/7.6.2'],
  ['sdk', 'python-requests/2.34.2'],
  ['sdk', 'python-httpx/0.28.1'],
  ['sdk', 'node'],
  ['sdk', 'Go-http-client/2.0'],
  [
    'human-browser',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  ],
  [
    'human-browser',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  ],
  [
    'human-browser',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ],
  [
    'human-browser',
    'Mozilla/5.0 (Linux; U; Android 16; zh-CN; 2604FRK1EC Build/BP2A.250605.031.A3) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.179 Mobile Safari/537.36',
  ],
  ['unknown', 'Mozilla/5.0'],
]

describe('族归一:每族都有可达样本(封闭性)', () => {
  for (const [family, ua] of FIXTURES) {
    it(`${family} ← ${ua.slice(0, 48)}`, () => {
      expect(classifyClientFamily(ua)).toBe(family)
    })
  }

  it('CLIENT_FAMILIES 每个取值都有样本打到(没有够不着的死族)', () => {
    const covered = new Set<ClientFamily>(FIXTURES.map(([f]) => f))
    covered.add(classifyClientFamily(''))
    covered.add(classifyClientFamily(null))
    const unreachable = CLIENT_FAMILIES.filter((f) => !covered.has(f))
    expect(unreachable).toEqual([])
  })
})

describe('缺失 UA 单独成族,不混进 unknown', () => {
  it('空串 / null / undefined 一律 no-ua', () => {
    expect(classifyClientFamily('')).toBe('no-ua')
    expect(classifyClientFamily(null)).toBe('no-ua')
    expect(classifyClientFamily(undefined)).toBe('no-ua')
  })
})

describe('优先级是承重的:摘掉排序即翻红', () => {
  // 这两条钉的是"AI 工具/爬虫都带 Chrome 或 Mozilla 外壳"这一现实:
  // 若把 human-browser 提前,QoderCN 的 1.9 万条会变成"真人",机器流量整族隐身。
  it('带 Chrome 尾巴的 AI 编程工具不算真人', () => {
    expect(
      classifyClientFamily(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QoderCN/0.4.8 Chrome/150.0.78',
      ),
    ).not.toBe('human-browser')
  })

  it('带 Mozilla 外壳的 AI 爬虫既不算真人也不算搜索引擎', () => {
    const ua =
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://claude.ai/bot)'
    expect(classifyClientFamily(ua)).toBe('ai-crawler')
    expect(classifyClientFamily(ua)).not.toBe('human-browser')
    expect(classifyClientFamily(ua)).not.toBe('search-crawler')
  })

  it('无头浏览器带 Safari 尾巴也不算真人', () => {
    expect(
      classifyClientFamily(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36',
      ),
    ).not.toBe('human-browser')
  })

  it('PowerShell 带 Mozilla 前缀也不算真人', () => {
    expect(
      classifyClientFamily(
        'Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; zh-CN) PowerShell/7.6.2',
      ),
    ).toBe('cli')
  })
})

describe('阳性对照:真人才是 human-browser', () => {
  const humans = FIXTURES.filter(([f]) => f === 'human-browser').map(([, ua]) => ua)
  it.each(humans)('%s', (ua) => {
    expect(classifyClientFamily(ua)).toBe('human-browser')
  })
})

describe('首方不得被族归一洗成机器(2026-09-24 事故的观测面复洁)', () => {
  const MACHINE: ClientFamily[] = [
    'ai-crawler',
    'search-crawler',
    'headless',
    'cli',
    'sdk',
    'agent-tool',
    'no-ua',
  ]

  it('IHUIAI-App 走 okhttp 底层也不落机器族', () => {
    expect(classifyClientFamily('IHUIAI-App/0.0.5 (android/36)')).toBe('first-party')
  })

  it('IHUI-CLI 短 UA 不落 no-ua 也不落机器族', () => {
    const ua = 'IHUI-CLI/9.9.9 (win32/x64)'
    expect(classifyClientFamily(ua)).toBe('first-party')
    expect(MACHINE).not.toContain(classifyClientFamily(ua))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
