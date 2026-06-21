/**
 * P9-9 小程序 + Electron e2e 拓展验证
 * - 小程序：manifest.json / project.config.json 合法、分包与合规页面、构建产物
 * - Electron：平台构建配置、build:electron 产物、入口与脚本
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const MINIAPP_ROOT = path.join(ROOT, 'miniapp')
const MINIAPP_SRC = path.join(MINIAPP_ROOT, 'src')
const ELECTRON_DIR = path.join(ROOT, 'electron')
const VITE_CONFIG = path.join(ROOT, 'vite.config.ts')
const PACKAGE_JSON = path.join(ROOT, 'package.json')

function readJSON(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function exists(p: string): boolean {
  return fs.existsSync(p)
}

test.describe('P9-9 小程序 - 静态与配置验证', () => {
  test('manifest.json 合法并包含小程序基础信息', () => {
    const manifest = readJSON(path.join(MINIAPP_SRC, 'manifest.json')) as Record<string, unknown>
    expect(manifest.name, '包含 name').toBeTruthy()
    expect(manifest.appid, '包含 appid').toBeTruthy()
    expect(manifest.versionName, '包含 versionName').toBeTruthy()
    expect(manifest['mp-weixin'], '包含 mp-weixin 配置').toBeTruthy()
    console.log(`[P9-9] 小程序 manifest.json 合法 ✅`)
  })

  test('project.config.json 合法', () => {
    const config = readJSON(path.join(MINIAPP_ROOT, 'project.config.json')) as Record<string, unknown>
    expect(config.projectname, '包含 projectname').toBeTruthy()
    expect(config.appid, '包含 appid').toBeTruthy()
    console.log(`[P9-9] 小程序 project.config.json 合法 ✅`)
  })

  test('pages.json 包含分包配置', () => {
    const pages = readJSON(path.join(MINIAPP_SRC, 'pages.json')) as {
      pages: unknown[]
      subPackages?: Array<{ root: string; pages: unknown[] }>
    }
    expect(pages.pages.length, '主包 pages > 0').toBeGreaterThan(0)
    expect(pages.subPackages, '包含 subPackages').toBeTruthy()
    expect(pages.subPackages?.length, '至少 1 个分包').toBeGreaterThanOrEqual(1)
    const subPages = pages.subPackages?.reduce((s, p) => s + (p.pages?.length || 0), 0) || 0
    expect(subPages, '分包页面 > 0').toBeGreaterThan(0)
    console.log(`[P9-9] 小程序分包配置完整，主包 ${pages.pages.length}，分包页面 ${subPages} ✅`)
  })

  test('合规页面存在', () => {
    const required = ['pagesA/agreement/privacy-policy.vue', 'pagesA/agreement/user-agreement.vue']
    for (const p of required) {
      expect(exists(path.join(MINIAPP_SRC, p)), `${p} 存在`).toBe(true)
    }
    console.log(`[P9-9] 小程序合规页面存在 ✅`)
  })

  test('miniapp package.json 依赖完整', () => {
    const pkg = readJSON(path.join(MINIAPP_ROOT, 'package.json')) as { dependencies?: Record<string, string> }
    expect(pkg.dependencies?.vue, '依赖 vue').toBeTruthy()
    console.log(`[P9-9] 小程序依赖完整 ✅`)
  })
})

test.describe('P9-9 Electron - 配置与构建验证', () => {
  test('vite.config.ts 包含 electron 平台配置', () => {
    const content = fs.readFileSync(VITE_CONFIG, 'utf-8')
    expect(content, '声明 electron 平台').toMatch(/electron/)
    expect(content, '配置 electron outDir').toMatch(/dist\/electron/)
    expect(content, '注入 BUILD_PLATFORM').toMatch(/VITE_BUILD_PLATFORM/)
    console.log(`[P9-9] vite.config.ts Electron 平台配置完整 ✅`)
  })

  test('package.json 包含 electron 构建脚本', () => {
    const pkg = readJSON(PACKAGE_JSON) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:electron'], '包含 dev:electron').toMatch(/electron/)
    expect(pkg.scripts['build:electron'], '包含 build:electron').toMatch(/electron/)
    console.log(`[P9-9] package.json Electron 脚本完整 ✅`)
  })

  test('build:electron 能生成产物', () => {
    const dist = path.join(ROOT, 'dist', 'electron')
    // 清理旧产物，重新构建
    if (exists(dist)) {
      fs.rmSync(dist, { recursive: true, force: true })
    }
    execSync('npm run build:electron', { cwd: ROOT, stdio: 'pipe', timeout: 180000 })
    expect(exists(dist), 'dist/electron 存在').toBe(true)
    expect(exists(path.join(dist, 'index.html')), '产物包含 index.html').toBe(true)
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
    expect(html, 'index.html 有效').toMatch(/<html/)
    console.log(`[P9-9] Electron 构建产物生成成功 ✅`)
  })

  test('electron 入口目录与文件存在', () => {
    expect(exists(ELECTRON_DIR), 'electron 目录存在').toBe(true)
    expect(exists(path.join(ELECTRON_DIR, 'main.js')), 'electron/main.js 存在').toBe(true)
    const main = fs.readFileSync(path.join(ELECTRON_DIR, 'main.js'), 'utf-8')
    expect(main, '引入 electron').toMatch(/electron/)
    expect(main, '加载 index.html').toMatch(/index\.html/)
    console.log(`[P9-9] Electron 入口文件完整 ✅`)
  })
})
