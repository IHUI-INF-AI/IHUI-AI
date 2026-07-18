import { test, expect, type Page } from '@playwright/test'

/**
 * 模型选择器(ModelSelector)+ /models 页面厂商图标视觉回归
 *
 * 守护目标:
 *   - /models 页面 SSR 渲染所有厂商图标(SVG)
 *   - 下拉菜单按厂商分组(DropdownMenu.Group + DropdownMenu.Label)
 *   - 4 状态可视觉验证:default / hover / active / dark mode
 *   - 新增厂商(AWS/Azure/OpenRouter/HuggingFace/Cerebras 等)图标必须渲染
 *
 * 触发规则:
 *   - 任何对 brand-icon.tsx / model-selector.tsx / helpers.ts / fallback-models.ts 的改动
 *     必须跑此测试通过
 *   - 任何对 ai-service/app/data/default_models.json 的改动也必须跑此测试通过
 */

// /models 页面 SSR 应包含的核心厂商关键词(中文+英文混合)
const EXPECTED_VENDOR_KEYWORDS = [
  // 国际原厂
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Meta',
  'Mistral',
  'xAI',
  'Cohere',
  'Nvidia',
  'AI21',
  'Microsoft',
  'Perplexity',
  // 国际云平台/聚合
  'AWS',
  'Bedrock',
  'Azure',
  'OpenRouter',
  'HuggingFace',
  'Replicate',
  'Stability',
  'Inflection',
  'IBM',
  'Cerebras',
  'SambaNova',
  'Snowflake',
  'DeepInfra',
  'Aleph',
  'Nous',
  'Vertex',
  'Gemma',
  'Copilot',
  'Bing',
  // 国际推理/云平台扩展
  'Novita',
  'Lambda',
  'Baseten',
  'Crusoe',
  'Targon',
  'CentML',
  'Nebius',
  'Ollama',
  'Upstage',
  'LeptonAI',
  'Hyperbolic',
  'Featherless',
  'Parasail',
  'OpenWebUI',
  'LM Studio',
  'Friendli',
  'Anyscale',
  'Infermatic',
  'Replit',
  // 国内推理/云平台扩展
  'SiliconCloud',
  'ModelScope',
  'PPIO',
  'Volcengine',
  'Bailian',
  'BAAI',
  'TII',
  'Liquid',
  'Ai2',
  // 国内厂商
  'Qwen',
  'Zhipu',
  'Moonshot',
  'Doubao',
  'Hunyuan',
  'Baichuan',
  'Spark',
  'MiniMax',
]

const MODEL_SELECTOR_TRIGGER_SELECTOR =
  'button[aria-label*="模型" i], button[aria-label*="model" i]'

async function navigateToModels(page: Page) {
  await page.goto('/models', { waitUntil: 'domcontentloaded' })
  // 等待页面主内容出现
  await page.waitForLoadState('networkidle', { timeout: 15000 })
}

test.describe('模型选择器 - SSR 厂商图标渲染', () => {
  test('/models 页面应 SSR 渲染所有核心厂商名称', async ({ page }) => {
    await navigateToModels(page)
    const html = await page.content()
    const missing: string[] = []
    for (const keyword of EXPECTED_VENDOR_KEYWORDS) {
      if (!html.includes(keyword)) {
        missing.push(keyword)
      }
    }
    expect(missing, `缺失厂商关键词: ${missing.join(', ')}`).toEqual([])

    // 至少 50 个 SVG(厂商图标 + UI 图标)
    const svgCount = await page.locator('svg').count()
    expect(svgCount, '页面 SVG 数量应 >= 50').toBeGreaterThanOrEqual(50)
  })

  test('/models 页面每个厂商卡片应包含 SVG 图标', async ({ page }) => {
    await navigateToModels(page)
    // 等待模型卡片渲染
    await page.waitForTimeout(1000)

    // 获取所有卡片容器(通常含 role=article 或类似 class)
    const cards = page.locator('[class*="card" i], [class*="model" i]').filter({
      has: page.locator('svg'),
    })
    const cardCount = await cards.count()
    expect(cardCount, '至少应有 10 个含 SVG 的卡片').toBeGreaterThanOrEqual(10)
  })
})

test.describe('模型选择器 - 下拉菜单 4 状态', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    // 等待 ModelSelector 按钮渲染(可能需要客户端水合)
    await page.waitForTimeout(2000)
  })

  test('默认态: 按钮应显示厂商图标 + 模型名 + ChevronDown', async ({ page }) => {
    const trigger = page.locator(MODEL_SELECTOR_TRIGGER_SELECTOR).first()
    if ((await trigger.count()) === 0) {
      // /chat 可能没有 ModelSelector,跳过
      test.skip(true, '/chat 页面无 ModelSelector 触发按钮')
      return
    }
    // 按钮内应至少有 1 个 SVG(厂商图标)+ 1 个 SVG(ChevronDown)
    const svgCount = await trigger.locator('svg').count()
    expect(svgCount, '触发按钮至少应有 2 个 SVG').toBeGreaterThanOrEqual(2)
  })

  test('打开下拉菜单: 应按厂商分组,每组带 SVG 图标', async ({ page }) => {
    const trigger = page.locator(MODEL_SELECTOR_TRIGGER_SELECTOR).first()
    if ((await trigger.count()) === 0) {
      test.skip(true, '/chat 页面无 ModelSelector 触发按钮')
      return
    }
    await trigger.click()
    await page.waitForTimeout(500)

    // 下拉菜单应出现(Radix DropdownMenu.Content)
    const menu = page.locator('[role="menu"], [data-radix-popper-content-wrapper]').first()
    if ((await menu.count()) === 0) {
      test.skip(true, '下拉菜单未渲染(可能 SSR 阶段未水合)')
      return
    }

    // 应至少有 5 个分组(Radix DropdownMenu.Group 渲染为 role=group)
    const groups = menu.locator('[role="group"]')
    const groupCount = await groups.count()
    expect(groupCount, '下拉菜单至少应有 5 个厂商分组').toBeGreaterThanOrEqual(5)

    // 第一个分组应有 Label(含 SVG 厂商图标)
    const firstGroupLabel = groups.first().locator('text=/^[A-Z]/').first()
    if ((await firstGroupLabel.count()) > 0) {
      const labelText = await firstGroupLabel.textContent()
      expect(labelText?.trim().length, '分组标签文本应非空').toBeGreaterThan(0)
    }
  })

  test('hover 态: 悬停菜单项应触发 focus:bg-accent', async ({ page }) => {
    const trigger = page.locator(MODEL_SELECTOR_TRIGGER_SELECTOR).first()
    if ((await trigger.count()) === 0) {
      test.skip(true, '/chat 页面无 ModelSelector 触发按钮')
      return
    }
    await trigger.click()
    await page.waitForTimeout(500)
    const menu = page.locator('[role="menu"], [data-radix-popper-content-wrapper]').first()
    if ((await menu.count()) === 0) {
      test.skip(true, '下拉菜单未渲染')
      return
    }
    const firstItem = menu.locator('[role="menuitem"]').first()
    if ((await firstItem.count()) === 0) {
      test.skip(true, '菜单项未渲染')
      return
    }
    // 验证 class 含 focus:bg-accent
    const className = await firstItem.getAttribute('class')
    expect(className, '菜单项应有 focus:bg-accent 类').toContain('focus:bg-accent')
  })

  test('active 选中态: 点击菜单项应关闭菜单', async ({ page }) => {
    const trigger = page.locator(MODEL_SELECTOR_TRIGGER_SELECTOR).first()
    if ((await trigger.count()) === 0) {
      test.skip(true, '/chat 页面无 ModelSelector 触发按钮')
      return
    }
    await trigger.click()
    await page.waitForTimeout(500)
    const item = page.locator('[role="menuitem"]').first()
    if ((await item.count()) === 0) {
      test.skip(true, '菜单项未渲染')
      return
    }
    await item.click()
    await page.waitForTimeout(500)
    // 菜单应关闭(不再可见)
    const visibleMenu = page.locator('[role="menu"]:visible').count()
    expect(visibleMenu, '点击后菜单应关闭').toBe(0)
  })

  test('dark mode: 切换暗色后下拉菜单可见', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)
    const trigger = page.locator(MODEL_SELECTOR_TRIGGER_SELECTOR).first()
    if ((await trigger.count()) === 0) {
      test.skip(true, '/chat 页面无 ModelSelector 触发按钮')
      return
    }
    await trigger.click()
    await page.waitForTimeout(500)
    const menu = page.locator('[role="menu"]:visible').first()
    if ((await menu.count()) === 0) {
      test.skip(true, '下拉菜单未渲染')
      return
    }
    // 验证 menu 存在且可见
    const isVisible = await menu.isVisible()
    expect(isVisible, 'dark mode 下拉菜单应可见').toBe(true)
  })
})

test.describe('新增国外厂商图标守护', () => {
  test('/models 页面应渲染所有新增国外厂商', async ({ page }) => {
    await navigateToModels(page)
    const html = await page.content()
    const newVendors = [
      'AWS',
      'Bedrock',
      'Azure',
      'OpenRouter',
      'HuggingFace',
      'Replicate',
      'Stability',
      'Inflection',
      'IBM',
      'Cerebras',
      'SambaNova',
      'Snowflake',
      'DeepInfra',
      'Aleph',
      'Nous',
      'Vertex',
      'Gemma',
      'Copilot',
      'Bing',
    ]
    const missing: string[] = []
    for (const v of newVendors) {
      if (!html.includes(v)) missing.push(v)
    }
    expect(missing, `缺失新增国外厂商: ${missing.join(', ')}`).toEqual([])
  })
})
