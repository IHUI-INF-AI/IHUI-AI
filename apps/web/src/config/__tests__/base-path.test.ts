/**
 * basePath 死链回归测试(2026-11-05 立)。
 *
 * 为什么必须钉住:GitHub Pages 是项目站点(`/<repo>/` 前缀),而 Next 的 basePath
 * 不会改写 config/data 里手写的站内绝对路径。2026-11-05 公网实测扩展包
 * `/downloads/extension/*.zip`、`manifest.json`、`update-files.json` 全 404 ——
 * 生成式就是裸根路径。这里用「有/无前缀」两种模式钉住真实落形,
 * 任何一处漏包 withBasePath 都会在这里翻红。
 *
 * 注意:base-path.ts 的 BASE_PATH 在模块加载时读取 NEXT_PUBLIC_BASE_PATH(构建期内联),
 * 故每个用例前改 env 后必须 vi.resetModules(),让被测模块重新求值。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveBasePath } from '../base-path'

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH
  else process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH
  vi.resetModules()
})

describe('resolveBasePath(与 next.config.ts 同口径)', () => {
  it('GITHUB_PAGES=true ⇒ 仓库名前缀,不硬编码仓名', () => {
    expect(
      resolveBasePath({ GITHUB_PAGES: 'true', GITHUB_REPOSITORY: 'IHUI-INF-AI/IHUI-AI' }),
    ).toBe('/IHUI-AI')
  })

  it('GITHUB_REPOSITORY 缺失 ⇒ 回落仓名字面量(历史 Pages 产物口径)', () => {
    expect(resolveBasePath({ GITHUB_PAGES: 'true' })).toBe('/IHUI-AI')
  })

  it('非 Pages ⇒ 空串,本机/生产根路径不变', () => {
    expect(resolveBasePath({})).toBe('')
    expect(
      resolveBasePath({ GITHUB_PAGES: 'false', GITHUB_REPOSITORY: 'IHUI-INF-AI/IHUI-AI' }),
    ).toBe('')
  })
})

describe('withBasePath', () => {
  it('注入 /IHUI-AI ⇒ 站内路径加前缀;外链/相对路径不动;已带前缀不重复', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/IHUI-AI'
    vi.resetModules()
    const { withBasePath } = await import('../base-path')
    expect(withBasePath('/downloads/extension/a.zip')).toBe('/IHUI-AI/downloads/extension/a.zip')
    expect(withBasePath('https://github.com/IHUI-INF-AI/IHUI-AI/releases')).toBe(
      'https://github.com/IHUI-INF-AI/IHUI-AI/releases',
    )
    expect(withBasePath('downloads/a.zip')).toBe('downloads/a.zip')
    expect(withBasePath('/IHUI-AI/downloads/a.zip')).toBe('/IHUI-AI/downloads/a.zip')
  })

  it('未注入 ⇒ 原样返回(本机根路径仍正确)', async () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH
    vi.resetModules()
    const { withBasePath } = await import('../base-path')
    expect(withBasePath('/downloads/extension/a.zip')).toBe('/downloads/extension/a.zip')
  })
})

describe('真实下载入口的落形', () => {
  it('Pages 前缀下扩展包 href 带 /IHUI-AI,且不再是公网 404 的裸根形态', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/IHUI-AI'
    vi.resetModules()
    const { PLATFORM_META } = await import('../downloads.config')
    const [asset] = PLATFORM_META.extension.assets
    const href = asset?.href ?? ''
    expect(href.startsWith('/IHUI-AI/downloads/extension/')).toBe(true)
    expect(href.endsWith('.zip')).toBe(true)
    // 反向判据:裸 `/downloads/` 正是 2026-11-05 公网 404 的生成式
    expect(href.startsWith('/downloads/')).toBe(false)
  })

  it('静态产出器 downloads-live-meta 的扩展 href 同样遵守 basePath', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/IHUI-AI'
    vi.resetModules()
    const { __test__ } = await import('../downloads-live-meta')
    expect(__test__.extensionAssetHref('IHUI-AI-Extension-chrome-v1.0.1.zip')).toBe(
      '/IHUI-AI/downloads/extension/IHUI-AI-Extension-chrome-v1.0.1.zip',
    )
  })
})
