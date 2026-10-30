// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// CSP 响应头的回归锁(2026-10-28 安全加固)
//
// 这个文件守的是「生产收紧、开发别挂」这一对约束,两边都必须有牙:
//  - 只断言「生产没有 unsafe-eval」是弱判据 —— 把整条 CSP 删掉也能过。所以每条生产断言
//    都配一条「dev 分支仍保留 unsafe-eval」的对照,证明分叉真的存在而不是被整体抹平。
//  - 只断言字符串包含也是弱判据 —— 断言对象必须是 headers() 真正产出的那条
//    source='/(.*)' 规则的 Content-Security-Policy 头,而不是源码文本。
//  - 白屏风险点('unsafe-inline'、frame-ancestors 不能写 'none'、img-src 的 https: 通配)
//    全部用正向断言钉住,谁想「顺手更安全」先撞红。

import { describe, expect, it, vi } from 'vitest'

const ENV_KEYS = ['NODE_ENV', 'EXPORT_STATIC', 'GITHUB_PAGES'] as const

interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

/**
 * 以指定环境变量加载 next.config,取 source='/(.*)' 规则上的 CSP 头。
 *
 * next.config 的 isDev/isStaticExport 是**模块加载时**求值的常量,所以必须
 * resetModules + 动态 import 才能拿到不同分支;环境变量用完还原,避免污染同进程的其他用例
 * (vitest fileParallelism=false,同文件内共享 process.env)。
 */
async function readCsp(env: Record<string, string>): Promise<string> {
  const snapshot = new Map<string, string | undefined>()
  for (const key of ENV_KEYS) snapshot.set(key, process.env[key])
  try {
    for (const key of ENV_KEYS) delete process.env[key]
    for (const [key, value] of Object.entries(env)) process.env[key] = value
    vi.resetModules()
    const { default: config } = await import('../next.config')
    const rules = (await config.headers?.()) as HeaderRule[] | undefined
    if (!rules) throw new Error('next.config 未导出 headers()')
    const catchAll = rules.find((rule) => rule.source === '/(.*)')
    if (!catchAll) throw new Error("未找到 source='/(.*)' 的安全头规则")
    const csp = catchAll.headers.find((header) => header.key === 'Content-Security-Policy')
    if (!csp) throw new Error('未找到 Content-Security-Policy 头')
    return csp.value
  } finally {
    for (const key of ENV_KEYS) {
      const value = snapshot.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    vi.resetModules()
  }
}

/** 取出单条指令(精确到指令名,避免 'script-src' 误匹配 'script-src-elem') */
function directive(csp: string, name: string): string {
  return (
    csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `)) ?? ''
  )
}

describe('生产 CSP(NODE_ENV=production)', () => {
  it("script-src 不含 'unsafe-eval'", async () => {
    const csp = await readCsp({ NODE_ENV: 'production' })
    const scriptSrc = directive(csp, 'script-src')
    expect(scriptSrc).not.toBe('')
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    // 全串级双保险:任何指令里都不该出现
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it("script-src 保留 'unsafe-inline'(Next inline bootstrap 需要,摘了会白屏)", async () => {
    const csp = await readCsp({ NODE_ENV: 'production' })
    expect(directive(csp, 'script-src')).toContain("'unsafe-inline'")
  })

  it("含 object-src 'none' 与 base-uri 'self'", async () => {
    const csp = await readCsp({ NODE_ENV: 'production' })
    expect(directive(csp, 'object-src')).toBe("object-src 'none'")
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'")
  })

  it("frame-ancestors 'self'(不能是 'none':WorkPanel 用 iframe 嵌同源页面)", async () => {
    const csp = await readCsp({ NODE_ENV: 'production' })
    const frameAncestors = directive(csp, 'frame-ancestors')
    expect(frameAncestors).toBe("frame-ancestors 'self'")
    expect(frameAncestors).not.toContain("'none'")
  })

  it('img-src 保持 https: 通配(AI 返回的图片域名不可枚举,收窄会裂图)', async () => {
    const csp = await readCsp({ NODE_ENV: 'production' })
    const imgSrc = directive(csp, 'img-src')
    expect(imgSrc).toContain("'self'")
    expect(imgSrc).toContain('data:')
    expect(imgSrc).toContain('blob:')
    expect(imgSrc).toContain('https:')
  })
})

describe('开发 CSP(NODE_ENV=development)', () => {
  it("仍含 'unsafe-eval'(否则本地 HMR/React Refresh 起不来)", async () => {
    const csp = await readCsp({ NODE_ENV: 'development' })
    const scriptSrc = directive(csp, 'script-src')
    expect(scriptSrc).toContain("'unsafe-eval'")
    // 对照:证明 dev/prod 是真分叉,不是两条都带/都不带
    expect(scriptSrc).toContain("'unsafe-inline'")
  })

  it('connect-src 仍放行本机(dev 直连 8802/8803)', async () => {
    const csp = await readCsp({ NODE_ENV: 'development' })
    expect(directive(csp, 'connect-src')).toContain('http://127.0.0.1:*')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
