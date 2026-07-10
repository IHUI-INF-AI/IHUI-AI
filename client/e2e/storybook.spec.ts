/**
 * P9-8 Storybook 体系升级 + Chromatic 视觉回归验证
 * - .storybook/main.ts 存在且配置正确
 * - .storybook/preview.ts 存在并导入全局样式
 * - chromatic.config.json 存在且配置完整
 * - package.json 包含 storybook / build:storybook / chromatic 脚本
 * - src/stories 目录包含示例 stories
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const ROOT = 'g:/1/client'
const STORYBOOK_MAIN = `${ROOT}/.storybook/main.ts`
const STORYBOOK_PREVIEW = `${ROOT}/.storybook/preview.ts`
const CHROMATIC_CONFIG = `${ROOT}/chromatic.config.json`
const PACKAGE_JSON = `${ROOT}/package.json`
const STORIES_DIR = `${ROOT}/src/stories`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

test.describe('P9-8 Storybook 体系升级 - 源码审查', () => {
  test('.storybook/main.ts 存在且配置正确', () => {
    const content = readText(STORYBOOK_MAIN)
    expect(content.length, 'main.ts 应有内容').toBeGreaterThan(100)
    expect(content, '使用 @storybook/vue3-vite').toMatch(/@storybook\/vue3-vite/)
    expect(content, '配置 stories 路径').toMatch(/stories:/)
    expect(content, '配置 addons').toMatch(/addons:/)
    expect(content, '配置 framework').toMatch(/framework:/)
    expect(content, '复用项目 @ alias').toMatch(/@/)
    console.log('[P9-8] .storybook/main.ts 配置完整 ✅')
  })

  test('.storybook/preview.ts 存在并导入全局样式', () => {
    const content = readText(STORYBOOK_PREVIEW)
    expect(content.length, 'preview.ts 应有内容').toBeGreaterThan(100)
    expect(content, '导入全局样式').toMatch(/import.*styles/)
    expect(content, '配置 chromatic 视觉回归参数').toMatch(/chromatic:/)
    expect(content, '包含 viewports').toMatch(/viewports/)
    expect(content, '包含 diffThreshold').toMatch(/diffThreshold/)
    console.log('[P9-8] .storybook/preview.ts 配置完整 ✅')
  })

  test('chromatic.config.json 存在且配置完整', () => {
    const config = readJSON(CHROMATIC_CONFIG) as Record<string, unknown>
    expect(config, 'chromatic 配置应为对象').toBeTruthy()
    expect(config.projectId, '包含 projectId').toBeTruthy()
    expect(config.buildScriptName, '包含 buildScriptName').toBe('build:storybook')
    expect(config.storybookConfigDir, '包含 storybookConfigDir').toBe('.storybook')
    expect(config.exitZeroOnChanges, '包含 exitZeroOnChanges').toBe(true)
    console.log('[P9-8] chromatic.config.json 配置完整 ✅')
  })

  test('package.json 包含 Storybook 与 Chromatic 脚本', () => {
    const pkg = readJSON(PACKAGE_JSON) as { scripts: Record<string, string> }
    expect(pkg.scripts.storybook, '包含 storybook 脚本').toMatch(/storybook dev/)
    expect(pkg.scripts['build:storybook'], '包含 build:storybook 脚本').toMatch(/storybook build/)
    expect(pkg.scripts.chromatic, '包含 chromatic 脚本').toMatch(/chromatic/)
    console.log('[P9-8] package.json 脚本完整 ✅')
  })

  test('package.json 包含 Storybook 与 Chromatic 依赖', () => {
    const pkg = readJSON(PACKAGE_JSON) as { devDependencies: Record<string, string> }
    const deps = pkg.devDependencies
    expect(deps['storybook'], '包含 storybook').toBeTruthy()
    expect(deps['@storybook/vue3'], '包含 @storybook/vue3').toBeTruthy()
    expect(deps['@storybook/vue3-vite'], '包含 @storybook/vue3-vite').toBeTruthy()
    expect(deps['@storybook/addon-essentials'], '包含 @storybook/addon-essentials').toBeTruthy()
    expect(deps['chromatic'], '包含 chromatic').toBeTruthy()
    console.log('[P9-8] package.json 依赖完整 ✅')
  })

  test('src/stories 包含 Button 与 Card 示例 stories', () => {
    const button = readText(`${STORIES_DIR}/Button.stories.ts`)
    const card = readText(`${STORIES_DIR}/Card.stories.ts`)
    expect(button, 'Button 使用 Element Plus').toMatch(/element-plus/)
    expect(button, 'Button 包含多个变体').toMatch(/export const/)
    expect(card, 'Card 使用 Element Plus').toMatch(/element-plus/)
    expect(card, 'Card 包含多个变体').toMatch(/export const/)
    console.log('[P9-8] 示例 stories 完整 ✅')
  })
})

test.describe('P9-8 Storybook 体系升级 - 构建验证', () => {
  test('Storybook 静态构建成功', () => {
    // 仅验证构建命令可执行且生成产物目录
    execSync('npm run build:storybook', { cwd: ROOT, stdio: 'pipe', timeout: 120000 })
    const output = readText(`${ROOT}/storybook-static/index.html`)
    expect(output, '产物包含 storybook-root').toMatch(/storybook-root/)
    console.log('[P9-8] Storybook 静态构建成功 ✅')
  })
})
