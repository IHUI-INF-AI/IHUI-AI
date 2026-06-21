import puppeteer, { Browser, Page } from 'puppeteer'

type ThemeMode = 'light' | 'dark' | 'auto' | 'high-contrast-light' | 'high-contrast-dark'

interface ThemeTestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: Record<string, unknown>
}

const THEME_CYCLE_ORDER: ThemeMode[] = [
  'light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark'
]

const THEME_NAMES: Record<ThemeMode, string> = {
  'light': '亮色模式',
  'dark': '暗色模式',
  'auto': '自动模式',
  'high-contrast-light': '高对比度亮色',
  'high-contrast-dark': '高对比度暗色'
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

class ThemeE2ETester {
  private browser: Browser | null = null
  private page: Page | null = null
  private results: ThemeTestResult[] = []
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:8888') {
    this.baseUrl = baseUrl
  }

  async setup(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    this.page = await this.browser.newPage()
    await this.page.setViewport({ width: 1280, height: 720 })
    await this.page.setDefaultTimeout(10000)
  }

  async setupMobile(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')
    await this.page.setViewport({ 
      width: 375, 
      height: 667,
      isMobile: true,
      hasTouch: true
    })
    await this.page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1')
  }

  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
    }
  }

  private addResult(result: ThemeTestResult): void {
    this.results.push(result)
    const status = result.passed ? '✅' : '❌'
    console.log(`${status} ${result.name} (${result.duration}ms)`)
    if (result.error) {
      console.log(`   错误: ${result.error}`)
    }
    if (result.details) {
      console.log(`   详情:`, result.details)
    }
  }

  private async getCurrentTheme(): Promise<{ mode: string; hasDarkClass: boolean; hasHighContrastClass: boolean }> {
    if (!this.page) throw new Error('Page not initialized')
    
    return await this.page.evaluate(() => {
      const root = document.documentElement
      const savedTheme = localStorage.getItem('darkMode')
      
      return {
        mode: savedTheme || 'unknown',
        hasDarkClass: root.classList.contains('dark'),
        hasHighContrastClass: root.classList.contains('high-contrast-light') || 
                              root.classList.contains('high-contrast-dark')
      }
    })
  }

  private async clickThemeToggle(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')
    
    await this.page.evaluate(() => {
      const darkModeStore = (window as unknown as { __PINIA__?: { state?: { value?: { darkMode?: { themeMode: string } } } } }).__PINIA__?.state?.value?.darkMode
      if (darkModeStore) {
        const currentMode = darkModeStore.themeMode
        const modes = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
        const currentIndex = modes.indexOf(currentMode)
        const nextIndex = (currentIndex + 1) % modes.length
        darkModeStore.themeMode = modes[nextIndex]
      }
      const toggleInput = document.querySelector('.theme-toggle input[type="checkbox"]') as HTMLInputElement
      if (toggleInput) {
        toggleInput.click()
      }
    })
    await sleep(500)
  }

  private async useKeyboardShortcut(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')
    
    await this.page.keyboard.down('Control')
    await this.page.keyboard.down('Shift')
    await this.page.keyboard.press('T')
    await this.page.keyboard.up('Shift')
    await this.page.keyboard.up('Control')
    await sleep(500)
  }

  async testPageLoad(): Promise<void> {
    const startTime = Date.now()
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      await sleep(1000)
      
      const theme = await this.getCurrentTheme()
      
      this.addResult({
        name: '页面加载测试',
        passed: true,
        duration: Date.now() - startTime,
        details: { theme }
      })
    } catch (error) {
      this.addResult({
        name: '页面加载测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testThemePreload(): Promise<void> {
    const startTime = Date.now()
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.evaluate(() => {
        localStorage.setItem('darkMode', 'dark')
      })
      
      await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' })
      
      const htmlClassBeforeJs = await this.page.evaluate(() => {
        return document.documentElement.className
      })
      
      const hasDarkClass = htmlClassBeforeJs.includes('dark')
      
      this.addResult({
        name: '主题预加载测试 (无闪烁)',
        passed: hasDarkClass,
        duration: Date.now() - startTime,
        details: { 
          htmlClassBeforeJs,
          hasDarkClass
        }
      })
    } catch (error) {
      this.addResult({
        name: '主题预加载测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testThemeToggle(): Promise<void> {
    const startTime = Date.now()
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      await sleep(500)
      
      const themeBefore = await this.getCurrentTheme()
      
      await this.clickThemeToggle()
      
      const themeAfter = await this.getCurrentTheme()
      
      const themeChanged = themeBefore.mode !== themeAfter.mode || 
                          themeBefore.hasDarkClass !== themeAfter.hasDarkClass
      
      this.addResult({
        name: '主题切换按钮测试',
        passed: themeChanged,
        duration: Date.now() - startTime,
        details: {
          before: themeBefore,
          after: themeAfter
        }
      })
    } catch (error) {
      this.addResult({
        name: '主题切换按钮测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testKeyboardShortcut(): Promise<void> {
    const startTime = Date.now()
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      await sleep(500)
      
      const themeBefore = await this.getCurrentTheme()
      
      await this.useKeyboardShortcut()
      
      const themeAfter = await this.getCurrentTheme()
      
      const themeChanged = themeBefore.mode !== themeAfter.mode
      
      this.addResult({
        name: '键盘快捷键测试 (Ctrl+Shift+T)',
        passed: themeChanged,
        duration: Date.now() - startTime,
        details: {
          before: themeBefore,
          after: themeAfter
        }
      })
    } catch (error) {
      this.addResult({
        name: '键盘快捷键测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testAllThemeModes(): Promise<void> {
    const startTime = Date.now()
    const results: { mode: ThemeMode; applied: boolean }[] = []
    
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      
      for (const mode of THEME_CYCLE_ORDER) {
        await this.page.evaluate((targetMode) => {
          localStorage.setItem('darkMode', targetMode)
        }, mode)
        
        await this.page.reload({ waitUntil: 'networkidle0' })
        await sleep(500)
        
        const theme = await this.getCurrentTheme()
        const applied = theme.mode === mode
        
        results.push({ mode, applied })
        
        console.log(`   测试主题 ${THEME_NAMES[mode]}: ${applied ? '✓' : '✗'}`)
      }
      
      const allPassed = results.every(r => r.applied)
      
      this.addResult({
        name: '所有主题模式测试',
        passed: allPassed,
        duration: Date.now() - startTime,
        details: { results }
      })
    } catch (error) {
      this.addResult({
        name: '所有主题模式测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testThemePersistence(): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      
      await this.page.evaluate(() => {
        localStorage.setItem('darkMode', 'dark')
      })
      
      await this.page.reload({ waitUntil: 'networkidle0' })
      await sleep(500)
      
      const themeAfterReload = await this.getCurrentTheme()
      
      const persisted = themeAfterReload.mode === 'dark'
      
      this.addResult({
        name: '主题持久化测试',
        passed: persisted,
        duration: Date.now() - startTime,
        details: {
          expectedMode: 'dark',
          actualMode: themeAfterReload.mode
        }
      })
    } catch (error) {
      this.addResult({
        name: '主题持久化测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testDarkModeCSSVariables(): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      
      await this.page.evaluate(() => {
        localStorage.setItem('darkMode', 'dark')
      })
      
      await this.page.reload({ waitUntil: 'networkidle0' })
      await sleep(500)
      
      const cssVars = await this.page.evaluate(() => {
        const root = document.documentElement
        const styles = getComputedStyle(root)
        
        return {
          bgColor: styles.getPropertyValue('--el-bg-color').trim(),
          textColor: styles.getPropertyValue('--el-text-color-primary').trim(),
          borderColor: styles.getPropertyValue('--el-border-color').trim()
        }
      })
      
      const hasDarkVars = cssVars.bgColor !== '' && 
                         cssVars.textColor !== '' && 
                         cssVars.borderColor !== ''
      
      this.addResult({
        name: '暗色模式CSS变量测试',
        passed: hasDarkVars,
        duration: Date.now() - startTime,
        details: cssVars
      })
    } catch (error) {
      this.addResult({
        name: '暗色模式CSS变量测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testHighContrastMode(): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      
      await this.page.evaluate(() => {
        localStorage.setItem('darkMode', 'high-contrast-dark')
      })
      
      await this.page.reload({ waitUntil: 'networkidle0' })
      await sleep(500)
      
      const theme = await this.getCurrentTheme()
      
      const hasHighContrastClass = theme.hasHighContrastClass
      
      this.addResult({
        name: '高对比度模式测试',
        passed: hasHighContrastClass,
        duration: Date.now() - startTime,
        details: {
          mode: theme.mode,
          hasHighContrastClass
        }
      })
    } catch (error) {
      this.addResult({
        name: '高对比度模式测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  async testMobileResponsiveness(): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!this.page) throw new Error('Page not initialized')
      
      await this.setupMobile()
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' })
      await sleep(1000)
      
      const toggleInfo = await this.page.evaluate(() => {
        const visibleToggles = Array.from(document.querySelectorAll('.theme-toggle')).filter(t => {
          const rect = t.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        
        if (visibleToggles.length === 0) {
          return { found: false, reason: 'No visible toggle found' }
        }
        
        const toggle = visibleToggles[0]
        const rect = toggle.getBoundingClientRect()
        const styles = getComputedStyle(toggle)
        
        return {
          found: true,
          width: rect.width,
          height: rect.height,
          meetsWCAG: rect.width >= 44 && rect.height >= 44,
          minWidth: styles.minWidth,
          minHeight: styles.minHeight,
          padding: styles.padding
        }
      })
      
      const meetsWCAG = toggleInfo?.found === true && (toggleInfo.meetsWCAG ?? false)
      
      this.addResult({
        name: '移动端响应式测试 (WCAG触摸区域)',
        passed: meetsWCAG,
        duration: Date.now() - startTime,
        details: toggleInfo
      })
      
      await this.page.setViewport({ width: 1280, height: 720 })
    } catch (error) {
      this.addResult({
        name: '移动端响应式测试',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      })
    }
  }

  getResults(): ThemeTestResult[] {
    return this.results
  }

  getSummary(): { total: number; passed: number; failed: number; duration: number } {
    const total = this.results.length
    const passed = this.results.filter(r => r.passed).length
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0)
    
    return {
      total,
      passed,
      failed: total - passed,
      duration
    }
  }

  printSummary(): void {
    const summary = this.getSummary()
    
    console.log('\n' + '='.repeat(50))
    console.log('主题切换E2E测试报告')
    console.log('='.repeat(50))
    console.log(`总测试数: ${summary.total}`)
    console.log(`通过: ${summary.passed}`)
    console.log(`失败: ${summary.failed}`)
    console.log(`总耗时: ${summary.duration}ms`)
    console.log('='.repeat(50))
    
    if (summary.failed > 0) {
      console.log('\n失败的测试:')
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error || '未知错误'}`)
        })
    }
  }
}

async function runE2ETests(): Promise<void> {
  const tester = new ThemeE2ETester()
  
  try {
    console.log('启动E2E测试...\n')
    
    await tester.setup()
    
    await tester.testPageLoad()
    await tester.testThemePreload()
    await tester.testThemeToggle()
    await tester.testKeyboardShortcut()
    await tester.testAllThemeModes()
    await tester.testThemePersistence()
    await tester.testDarkModeCSSVariables()
    await tester.testHighContrastMode()
    await tester.testMobileResponsiveness()
    
    tester.printSummary()
    
  } finally {
    await tester.teardown()
  }
}

export { ThemeE2ETester, runE2ETests, THEME_CYCLE_ORDER, THEME_NAMES }

runE2ETests().catch(console.error)
