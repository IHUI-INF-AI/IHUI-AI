import { test, expect, devices } from '@playwright/test'

test.setTimeout(60000)

const BASE_URL = 'http://127.0.0.1:8888'

interface TestResult {
  device: string
  viewport: { width: number; height: number }
  page: string
  consoleErrors: string[]
  consoleWarnings: string[]
  loadTime: number
  hasHorizontalScroll: boolean
  screenshot: string
}

const results: TestResult[] = []

const testDevices = [
  { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
  { name: 'Desktop 1440x900', width: 1440, height: 900 },
  { name: 'Desktop 1366x768', width: 1366, height: 768 },
]

const mobileDevices = [
  { name: 'iPhone 14 Pro', ...devices['iPhone 14 Pro'] },
  { name: 'iPhone SE', ...devices['iPhone SE'] },
  { name: 'Pixel 5', ...devices['Pixel 5'] },
  { name: 'Galaxy S21', ...devices['Galaxy S21'] },
]

const tabletDevices = [
  { name: 'iPad Pro', ...devices['iPad Pro'] },
  { name: 'iPad Mini', ...devices['iPad Mini'] },
  { name: 'iPad Air', ...devices['iPad Air'] },
]

const pages = [
  { name: '首页', path: '/' },
  { name: '登录页', path: '/login' },
  { name: '注册页', path: '/register' },
  { name: 'VIP页', path: '/vip' },
  { name: '智能体列表', path: '/agents' },
  { name: '社区', path: '/community' },
  { name: '开放平台', path: '/open' },
]

test.describe('桌面端响应式测试', () => {
  for (const device of testDevices) {
    for (const page of pages) {
      test(`${device.name} - ${page.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
        })
        const pageInstance = await context.newPage()
        
        const consoleErrors: string[] = []
        const consoleWarnings: string[] = []
        
        pageInstance.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text())
          } else if (msg.type() === 'warning') {
            consoleWarnings.push(msg.text())
          }
        })
        
        const startTime = Date.now()
        await pageInstance.goto(`${BASE_URL}${page.path}`, { waitUntil: 'load', timeout: 30000 })
        await pageInstance.waitForLoadState('domcontentloaded', { timeout: 10000 })
        const loadTime = Date.now() - startTime
        
        const hasHorizontalScroll = await pageInstance.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth
        })
        
        const screenshot = `screenshots/${device.name.replace(/[^a-zA-Z0-9]/g, '-')}-${page.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`
        await pageInstance.screenshot({ path: screenshot, fullPage: false })
        
        results.push({
          device: device.name,
          viewport: { width: device.width, height: device.height },
          page: page.name,
          consoleErrors,
          consoleWarnings,
          loadTime,
          hasHorizontalScroll,
          screenshot,
        })
        
        console.log(`\n=== ${device.name} - ${page.name} ===`)
        console.log(`加载时间: ${loadTime}ms`)
        console.log(`水平滚动: ${hasHorizontalScroll ? '是' : '否'}`)
        console.log(`控制台错误: ${consoleErrors.length}`)
        console.log(`控制台警告: ${consoleWarnings.length}`)
        
        if (consoleErrors.length > 0) {
          console.log('错误详情:', consoleErrors.slice(0, 3))
        }
        
        await context.close()
      })
    }
  }
})

test.describe('移动端响应式测试', () => {
  for (const device of mobileDevices) {
    for (const page of pages) {
      test(`${device.name} - ${page.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
        })
        const pageInstance = await context.newPage()
        
        const consoleErrors: string[] = []
        const consoleWarnings: string[] = []
        
        pageInstance.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text())
          } else if (msg.type() === 'warning') {
            consoleWarnings.push(msg.text())
          }
        })
        
        const startTime = Date.now()
        await pageInstance.goto(`${BASE_URL}${page.path}`, { waitUntil: 'load', timeout: 30000 })
        await pageInstance.waitForLoadState('domcontentloaded', { timeout: 10000 })
        const loadTime = Date.now() - startTime
        
        const hasHorizontalScroll = await pageInstance.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth
        })
        
        const screenshot = `screenshots/${device.name.replace(/[^a-zA-Z0-9]/g, '-')}-${page.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`
        await pageInstance.screenshot({ path: screenshot, fullPage: false })
        
        results.push({
          device: device.name,
          viewport: device.viewport,
          page: page.name,
          consoleErrors,
          consoleWarnings,
          loadTime,
          hasHorizontalScroll,
          screenshot,
        })
        
        console.log(`\n=== ${device.name} - ${page.name} ===`)
        console.log(`加载时间: ${loadTime}ms`)
        console.log(`水平滚动: ${hasHorizontalScroll ? '是' : '否'}`)
        console.log(`控制台错误: ${consoleErrors.length}`)
        
        await context.close()
      })
    }
  }
})

test.describe('平板端响应式测试', () => {
  for (const device of tabletDevices) {
    for (const page of pages) {
      test(`${device.name} - ${page.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
        })
        const pageInstance = await context.newPage()
        
        const consoleErrors: string[] = []
        const consoleWarnings: string[] = []
        
        pageInstance.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text())
          } else if (msg.type() === 'warning') {
            consoleWarnings.push(msg.text())
          }
        })
        
        const startTime = Date.now()
        await pageInstance.goto(`${BASE_URL}${page.path}`, { waitUntil: 'load', timeout: 30000 })
        await pageInstance.waitForLoadState('domcontentloaded', { timeout: 10000 })
        const loadTime = Date.now() - startTime
        
        const hasHorizontalScroll = await pageInstance.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth
        })
        
        const screenshot = `screenshots/${device.name.replace(/[^a-zA-Z0-9]/g, '-')}-${page.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`
        await pageInstance.screenshot({ path: screenshot, fullPage: false })
        
        results.push({
          device: device.name,
          viewport: device.viewport,
          page: page.name,
          consoleErrors,
          consoleWarnings,
          loadTime,
          hasHorizontalScroll,
          screenshot,
        })
        
        console.log(`\n=== ${device.name} - ${page.name} ===`)
        console.log(`加载时间: ${loadTime}ms`)
        console.log(`水平滚动: ${hasHorizontalScroll ? '是' : '否'}`)
        console.log(`控制台错误: ${consoleErrors.length}`)
        
        await context.close()
      })
    }
  }
})

test.describe('断点边界测试', () => {
  const breakpoints = [640, 768, 1024, 1280]
  
  for (const width of breakpoints) {
    test(`断点 ${width}px 测试`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
      })
      const pageInstance = await context.newPage()
      
      const consoleErrors: string[] = []
      
      pageInstance.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })
      
      await pageInstance.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 })
      await pageInstance.waitForLoadState('domcontentloaded', { timeout: 10000 })
      
      const hasHorizontalScroll = await pageInstance.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      
      const screenshot = `screenshots/breakpoint-${width}px.png`
      await pageInstance.screenshot({ path: screenshot, fullPage: false })
      
      console.log(`\n=== 断点 ${width}px ===`)
      console.log(`水平滚动: ${hasHorizontalScroll ? '是' : '否'}`)
      console.log(`控制台错误: ${consoleErrors.length}`)
      
      await context.close()
    })
  }
})
