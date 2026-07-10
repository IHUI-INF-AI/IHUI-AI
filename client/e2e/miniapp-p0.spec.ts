/**
 * 小程序端 P0 体验静态检查
 * 不依赖运行（miniapp 必须用微信开发者工具跑），只做结构性检查
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'miniapp', 'src')
const APP_JSON = path.join(ROOT, 'app.json')
const PAGES_JSON = path.join(ROOT, 'pages.json')

test.describe('小程序 P0 静态检查', () => {
  test('app.json 合法 + 至少 3 个页面', () => {
    const data = JSON.parse(fs.readFileSync(APP_JSON, 'utf-8'))
    expect(Array.isArray(data.pages), 'pages 是数组').toBe(true)
    expect(data.pages.length, 'pages 至少 3 个').toBeGreaterThanOrEqual(3)
    // app.json pages 是 uniapp 入口声明（uniapp 编译器还会从 pages.json 自动补全）
    // 软校验：尝试找源文件（兼容 pagesA/ 子包路径）
    let hitCount = 0
    for (const p of data.pages) {
      const candidates = [p + '.vue', p + '.ts', p + '.js']
      const found = candidates.some((c) => fs.existsSync(path.join(ROOT, c))) ||
        // 兼容 subpackage 路径（pages/foo/bar → pagesA/foo/bar）
        candidates.some((c) => fs.existsSync(path.join(ROOT, 'pagesA', c.replace(/^pages\//, ''))))
      if (found) hitCount++
    }
    console.log(`[miniapp] app.json pages 命中源文件: ${hitCount}/${data.pages.length}`)
    // 软阈值：至少有一半能在 src/ 找到
    expect(hitCount, `app.json pages 中至少 50% 命中源文件`).toBeGreaterThanOrEqual(Math.ceil(data.pages.length * 0.5))
  })

  test('pages.json 合法 + 至少 30 个页面（含 subPackages）', () => {
    const raw = fs.readFileSync(PAGES_JSON, 'utf-8')
    const data = JSON.parse(raw)
    expect(data.pages, 'pages 节点存在').toBeTruthy()
    expect(Array.isArray(data.pages), 'pages 是数组').toBe(true)
    const mainCount = data.pages.length
    const subCount = (data.subPackages || []).reduce(
      (s: number, p: { pages?: unknown[] }) => s + (p.pages?.length || 0),
      0
    )
    const total = mainCount + subCount
    console.log(`[miniapp] pages.json: main=${mainCount}, sub=${subCount}, total=${total}`)
    expect(mainCount, `main pages >= 3`).toBeGreaterThanOrEqual(3)
    expect(total, `总 pages >= 30`).toBeGreaterThanOrEqual(30)
  })

  test('关键 P0 页面存在', () => {
    const required = [
      'pages/login-app/login.vue',
      'pages/table/aiIndex/ai_index.vue',
      'pages/table/user/index.vue',
      'pages/table/tools/index.vue',
      'pagesA/vip/index.vue',
      'pagesA/plaza/index.vue',
      'pagesA/settings/index.vue',
      'pagesA/message/index.vue',
    ]
    for (const p of required) {
      expect(fs.existsSync(path.join(ROOT, p)), `${p} 存在`).toBe(true)
    }
  })

  test('关键 P0 组件存在', () => {
    const required = [
      'components/nav-bar.vue',
      'components/InputArea.vue',
      'components/MaterialList.vue',
      'components/FloatBox.vue',
      'components/common/NavBar.vue',
      'components/common/Empty.vue',
    ]
    for (const p of required) {
      expect(fs.existsSync(path.join(ROOT, p)), `${p} 存在`).toBe(true)
    }
  })

  test('隐私协议 + 用户协议存在（合规）', () => {
    const required = [
      'pagesA/agreement/privacy-policy',
      'pagesA/agreement/user-agreement',
    ]
    for (const p of required) {
      const file = path.join(ROOT, p + '.vue')
      expect(fs.existsSync(file), `${p}.vue 存在（合规要求）`).toBe(true)
    }
  })

  test('关键 service 文件存在（API / 登录 / 支付）', () => {
    const required = [
      'service/login.js',
      'service/pay.js',
      'service/vip.js',
      'service/index.js',
      'api/payment.js',
      'store/index.ts',
      'store/modules/user.ts',
      'utils/auth.js',
      'utils/request.js',
    ]
    for (const p of required) {
      expect(fs.existsSync(path.join(ROOT, p)), `${p} 存在`).toBe(true)
    }
  })

  test('包大小：static 资源 < 100MB（未压缩 h5 含图片字体）', () => {
    const distH5 = path.join(process.cwd(), 'miniapp', 'dist', 'build', 'h5')
    if (!fs.existsSync(distH5)) {
      test.skip(true, 'dist/build/h5 不存在（未构建）')
      return
    }
    let total = 0
    function walk(dir: string) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name)
        if (f.isDirectory()) walk(p)
        else total += fs.statSync(p).size
      }
    }
    walk(distH5)
    const mb = total / 1024 / 1024
    console.log(`[miniapp] h5 dist = ${mb.toFixed(2)}MB`)
    // h5 端含图片/字体资源约 78MB，警告阈值 100MB
    expect(mb, 'miniapp h5 dist < 100MB').toBeLessThan(100)
  })

  test('app.json 首页是 login-app/login（未登录前置）', () => {
    const data = JSON.parse(fs.readFileSync(APP_JSON, 'utf-8'))
    expect(data.pages[0], '首页是登录页').toBe('pages/login-app/login')
  })

  test('pages.json tabBar 至少 3 项', () => {
    const data = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf-8'))
    if (data.tabBar) {
      expect(Array.isArray(data.tabBar.list), 'tabBar.list 是数组').toBe(true)
      expect(data.tabBar.list.length, `tabBar >= 3（实际 ${data.tabBar.list.length}）`).toBeGreaterThanOrEqual(3)
    } else {
      test.skip(true, '未配置 tabBar（单页应用）')
    }
  })
})
