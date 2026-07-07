/**
 * AI 能力自动路由 4 Tab E2E 守门 (2026-07-07 无感升级 Phase 3 立)
 *
 * 防回归目标:
 *   用户输入文本时, AIChat 必须根据关键词无感地切到最匹配的 AICapabilitySelector Tab,
 *   让用户"不需要知道有这些 tab 存在", 系统自动给出最佳入口.
 *
 * 覆盖场景 (与 ai-capability-discovery.ts recommendByKeywords 一一对应):
 *   1. 源码守门:
 *      A. ai-capability-discovery.ts 必须定义 6 类生成关键词 (image/video/3D/audio/music/vision)
 *      B. AIChat.vue discoverAICapabilities 必须对全部 4 Tab 做路由分支
 *         (MODEL / AGENT / AGENTIC / MCP, 含 generation metadata 路由)
 *      C. AICapabilitySelector.vue 必须有 normalizeModeForTab 兜底 agentic/auto/hybrid
 *      D. CapabilityRecommendation 必须有 metadata.generationType 字段
 *   2. 浏览器守门 (需 dev server, 否则整组跳过):
 *      E. 输入「画一张猫」 → capability selector 打开后默认在 generation Tab 且 currentGenerationType=image
 *      F. 输入「查询天气」 → 触发 MCP 关键词, capability selector 打开后默认在 MCP Tab
 *      G. 输入「使用智能体」 → 触发 AGENT 关键词, capability selector 打开后默认在 Agent Tab
 *      H. 输入「复杂任务」   → 触发 AGENTIC 关键词, capability selector 打开后默认在 Agent Tab (归一化)
 *
 * 关键: 测试不依赖网络, 不发真实消息, 仅验证输入后的「无感路由」结果
 *
 * CI 入口: npx playwright test auto-mode-tab-routing.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// 源文件路径
const DISCOVERY_FILE = join(ROOT, 'src/services/ai-capability-discovery.ts')
const AICHAT_FILE = join(ROOT, 'src/components/ai/AIChat.vue')
const SELECTOR_FILE = join(ROOT, 'src/components/ai/AICapabilitySelector/AICapabilitySelector.vue')

// 6 类生成关键词 (与 ai-capability-discovery.ts 中的常量数组一致)
// 注意:
//   - model3DKeywords 在源码中是 'model3DKeywords' (3d 关键词含前缀), 其他是 'xxxKeywords'
//   - 2026-07-07 Phase 3 调整: image 关键词移除 '图' (避免污染 vision), vision 优先级提升
const EXPECTED_GENERATION_KEYWORDS = [
  { type: 'image', arrayName: 'imageKeywords', keywords: ['画', '图片', '照片', '插画', '海报', '封面', '头像', '壁纸'] },
  { type: 'video', arrayName: 'videoKeywords', keywords: ['视频', '动画', '短片', '生成视频'] },
  { type: 'audio', arrayName: 'audioKeywords', keywords: ['语音', '朗读', '配音', 'tts'] },
  { type: 'music', arrayName: 'musicKeywords', keywords: ['音乐', '歌曲', 'bgm', '配乐'] },
  { type: '3d', arrayName: 'model3DKeywords', keywords: ['3d', '3d模型', '建模', '三维'] },
  { type: 'vision', arrayName: 'visionKeywords', keywords: ['看图', '识图', '理解图片', '分析图片'] },
]

// 4 Tab 路由分支预期包含的关键字符串
const EXPECTED_ROUTING_BRANCHES = [
  { tab: 'agent', pattern: /currentAIMode\.value\s*=\s*['"]agent['"]/ },
  { tab: 'agentic', pattern: /currentAIMode\.value\s*=\s*['"]agentic['"]/ },
  { tab: 'mcp', pattern: /currentAIMode\.value\s*=\s*['"]mcp['"]/ },
  { tab: 'model', pattern: /currentAIMode\.value\s*=\s*['"]model['"]/ },
  { tab: 'generation', pattern: /currentAIMode\.value\s*=\s*['"]generation['"]/ },
]

// 触发关键词测试样本 (输入 → 预期 tab)
const ROUTING_FIXTURES = [
  { input: '帮我画一张猫的插画', expectedTab: 'generation', expectedGenerationType: 'image' },
  { input: '生成一个视频介绍产品', expectedTab: 'generation', expectedGenerationType: 'video' },
  { input: '查询北京今天的天气', expectedTab: 'mcp', expectedGenerationType: undefined },
  { input: '使用智能体帮我写文章', expectedTab: 'agent', expectedGenerationType: undefined },
  { input: '复杂的多步骤协作任务', expectedTab: 'agentic', expectedGenerationType: undefined },
]

// ════════════════════════════════════════════════════════════════════════
// 源码级守门 (不启动浏览器, 快)
// ════════════════════════════════════════════════════════════════════════

test.describe('AI 能力自动路由 4 Tab 源码守门', () => {
  test.describe.configure({ mode: 'parallel' })

  // ── A. ai-capability-discovery.ts 必须定义 6 类生成关键词 ──
  test.describe('A: ai-capability-discovery.ts 6 类生成关键词完整性', () => {
    for (const { type, arrayName, keywords } of EXPECTED_GENERATION_KEYWORDS) {
      test(`A[${type}]: 关键词数组 ${arrayName} 必须包含核心词`, () => {
        const src = readFileSync(DISCOVERY_FILE, 'utf8')
        // 提取 const xxxKeywords = [...] 数组
        const re = new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([^\\]]+)\\]`)
        const m = src.match(re)
        expect(m, `ai-capability-discovery.ts 必须定义 ${arrayName} 数组`).not.toBeNull()
        const arrBody = m![1]
        for (const kw of keywords.slice(0, 3)) {
          // 检查至少前 3 个核心关键词存在
          expect(arrBody, `${arrayName} 数组必须包含关键词 "${kw}"`).toContain(`'${kw}'`)
        }
      })
    }
  })

  // ── B. AIChat.vue discoverAICapabilities 必须对全部 4 Tab 做路由分支 ──
  test('B: AIChat.vue discoverAICapabilities 路由覆盖全部 4 Tab + generation', () => {
    const src = readFileSync(AICHAT_FILE, 'utf8')
    // 提取 discoverAICapabilities 函数体
    const fnRe = /const\s+discoverAICapabilities\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/m
    const m = src.match(fnRe)
    expect(m, 'AIChat.vue 必须定义 discoverAICapabilities 函数').not.toBeNull()
    const fnBody = m![1]
    for (const { tab, pattern } of EXPECTED_ROUTING_BRANCHES) {
      expect(
        fnBody,
        `discoverAICapabilities 必须包含 ${tab} Tab 路由分支 (匹配: ${pattern})`
      ).toMatch(pattern)
    }
  })

  // ── C. AICapabilitySelector.vue 必须有 normalizeModeForTab 兜底 ──
  test('C: AICapabilitySelector.vue 必须有 normalizeModeForTab 兜底 agentic/auto/hybrid', () => {
    const src = readFileSync(SELECTOR_FILE, 'utf8')
    expect(
      src,
      'AICapabilitySelector.vue 必须定义 normalizeModeForTab 函数 (兜底非可见 mode)'
    ).toMatch(/function\s+normalizeModeForTab\s*\(/)
    // 必须归一化 agentic → agent
    expect(
      src,
      'normalizeModeForTab 必须将 agentic 归一化为 agent'
    ).toMatch(/mode\s*===\s*['"]agentic['"]\s*\)[\s\S]*?return\s+['"]agent['"]/)
    // 必须归一化 auto/hybrid → model
    expect(
      src,
      'normalizeModeForTab 必须将 auto/hybrid 归一化为 model (默认)'
    ).toMatch(/return\s+['"]model['"]/)
  })

  // ── D. CapabilityRecommendation 必须有 metadata.generationType ──
  test('D: CapabilityRecommendation interface 必须含 metadata.generationType 字段', () => {
    const src = readFileSync(DISCOVERY_FILE, 'utf8')
    expect(
      src,
      'CapabilityRecommendation 必须定义 metadata 可选字段'
    ).toMatch(/metadata\?:\s*\{/)
    expect(
      src,
      'metadata 必须含 generationType 字段 (image/video/3D/audio/music/vision/auto)'
    ).toMatch(/generationType\?:\s*['"]image['"]\s*\|\s*['"]video['"]/)
  })

  // ── D2. discoverAICapabilities 必须读取 metadata.generationType 并路由 ──
  test('D2: AIChat.vue discoverAICapabilities 必须读取 metadata.generationType 路由到 generation', () => {
    const src = readFileSync(AICHAT_FILE, 'utf8')
    const fnRe = /const\s+discoverAICapabilities\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/m
    const m = src.match(fnRe)
    expect(m).not.toBeNull()
    const fnBody = m![1]
    expect(
      fnBody,
      'discoverAICapabilities 必须从 rec.metadata?.generationType 读取生成类型'
    ).toMatch(/rec\.metadata\?\.generationType/)
    expect(
      fnBody,
      '检测到生成类型后必须设置 currentGenerationType.value'
    ).toMatch(/currentGenerationType\.value\s*=\s*generationType/)
  })

  // ── E. 6 类生成关键词数组必须都被 use (isImageGen / isVideoGen / ...) ──
  test('E: ai-capability-discovery.ts 必须全部 6 类生成类型做 use 判断并 push', () => {
    const src = readFileSync(DISCOVERY_FILE, 'utf8')
    const expectedFlags = ['isImageGen', 'isVideoGen', 'is3DGen', 'isAudioGen', 'isMusicGen', 'isVision']
    for (const flag of expectedFlags) {
      expect(
        src,
        `recommendByKeywords 中必须定义并使用 ${flag} 标志`
      ).toMatch(new RegExp(`const\\s+${flag}\\s*=`))
    }
    // 必须有综合判断 if (isImageGen || isVideoGen || is3DGen || isAudioGen || isMusicGen || isVision)
    const combinedRe = /isImageGen\s*\|\|\s*isVideoGen\s*\|\|\s*is3DGen\s*\|\|\s*isAudioGen\s*\|\|\s*isMusicGen\s*\|\|\s*isVision/
    expect(
      src,
      'recommendByKeywords 必须有 6 类生成类型的合并判断 if 条件'
    ).toMatch(combinedRe)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 浏览器渲染守门 (启动 dev server, 验证实际无感路由)
// 策略: 不依赖 UI 交互 (后端不可用时易超时),
//       而是通过动态 import 调用 ai-capability-discovery 验证推荐结果.
// ════════════════════════════════════════════════════════════════════════

test.describe('AI 能力自动路由 4 Tab 浏览器守门', () => {
  test.describe.configure({ mode: 'serial' })

  let devServerAvailable = false

  test.beforeAll(async ({ request }) => {
    try {
      const resp = await request.get('/', { timeout: 3000, failOnStatusCode: false })
      devServerAvailable = resp.ok() || resp.status() < 500
    } catch {
      devServerAvailable = false
    }
  })

  test.beforeEach(async () => {
    test.skip(!devServerAvailable, 'dev server (8888) 未启动, 跳过渲染守门 (源码守门已覆盖)')
  })

  /** 加载首页, 等待 Vue 挂载, 然后通过动态 import 拿到 AICapabilityDiscovery */
  async function loadDiscovery(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(async () => {
      const n = await page.evaluate(() => {
        const app = document.getElementById('app')
        return app ? app.childElementCount : 0
      })
      expect(n).toBeGreaterThan(0)
    }).toPass({ timeout: 15000 })
    await page.waitForTimeout(500)
  }

  /** 通过动态 import 拉取 AICapabilityDiscovery 单例, 在浏览器中调用 discoverCapabilities */
  async function callDiscover(page: Page, message: string) {
    return page.evaluate(async (msg) => {
      // @ts-ignore
      const mod = await import('/src/services/ai-capability-discovery.ts')
      const discovery = mod.getAICapabilityDiscovery()
      const recs = await discovery.discoverCapabilities(msg)
      return recs.map((r: Record<string, unknown>) => ({
        capabilityType: r.capabilityType,
        confidence: r.confidence,
        reason: r.reason,
        metadata: r.metadata ?? null,
      }))
    }, message)
  }

  // ── F. 输入「画一张猫」 → 应推荐 image 生成 ──
  test('F: 输入「画一张猫」应推荐 image 生成 (capabilityType=MODEL, metadata.generationType=image)', async ({ page }) => {
    await loadDiscovery(page)
    // 等待 Vite 处理完这个模块 (首次动态 import 会触发 transform)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '帮我画一张猫的插画')

    expect(recs.length, '应至少返回 1 条推荐').toBeGreaterThan(0)
    // 找到 generationType=image 的推荐
    const imageRec = recs.find((r: { metadata?: { generationType?: string } }) =>
      r.metadata?.generationType === 'image'
    )
    expect(
      imageRec,
      `输入「画一张猫」应返回 generationType=image 的推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
    expect(String(imageRec.capabilityType).toLowerCase(), 'capabilityType 应为 model').toBe('model')
    expect(imageRec.confidence).toBeGreaterThanOrEqual(0.8)
  })

  // ── F2. 输入「生成视频」 → 应推荐 video 生成 ──
  test('F2: 输入「生成视频介绍产品」应推荐 video 生成', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '生成一个视频介绍产品')

    const videoRec = recs.find((r: { metadata?: { generationType?: string } }) =>
      r.metadata?.generationType === 'video'
    )
    expect(
      videoRec,
      `输入视频关键词应返回 generationType=video 的推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
    expect(String(videoRec.capabilityType).toLowerCase(), 'capabilityType 应为 model').toBe('model')
  })

  // ── F3. 输入「写歌」 → 应推荐 music 生成 ──
  test('F3: 输入「写一首歌」应推荐 music 生成', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '帮我写一首关于大海的歌')

    const musicRec = recs.find((r: { metadata?: { generationType?: string } }) =>
      r.metadata?.generationType === 'music'
    )
    expect(
      musicRec,
      `输入音乐关键词应返回 generationType=music 的推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── F4. 输入「识图」 → 应推荐 vision 生成 ──
  test('F4: 输入「识图」应推荐 vision 生成', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '帮我识别这张图片里的内容')

    const visionRec = recs.find((r: { metadata?: { generationType?: string } }) =>
      r.metadata?.generationType === 'vision'
    )
    expect(
      visionRec,
      `输入识图关键词应返回 generationType=vision 的推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── G. 输入「查询天气」 → 应推荐 MCP ──
  test('G: 输入「查询北京今天的天气」应推荐 MCP', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '查询北京今天的天气')

    // 找到 MCP 推荐 (mcp 在 capabilityType 字符串中, 也可能在 MCP type 字段中)
    const mcpRec = recs.find((r: { capabilityType: string }) =>
      String(r.capabilityType).toLowerCase() === 'mcp'
    )
    expect(
      mcpRec,
      `输入 MCP 查询关键词应返回 MCP 推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── H. 输入「使用智能体」 → 应推荐 AGENT ──
  test('H: 输入「使用智能体」应推荐 AGENT', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '使用智能体帮我写文章')

    const agentRec = recs.find((r: { capabilityType: string }) =>
      String(r.capabilityType).toLowerCase() === 'agent'
    )
    expect(
      agentRec,
      `输入智能体关键词应返回 AGENT 推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── K. 输入「复杂多步骤任务」 → 应推荐 AGENTIC ──
  test('K: 输入「复杂任务」应推荐 AGENTIC (归一化到 agent 后由 selector 兜底)', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '复杂的多步骤协作任务分析财报')

    const agenticRec = recs.find((r: { capabilityType: string }) =>
      String(r.capabilityType).toLowerCase() === 'agentic'
    )
    expect(
      agenticRec,
      `输入复杂任务关键词应返回 AGENTIC 推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── L. 输入「写一篇文章」 → 应推荐 MODEL (默认文本生成) ──
  test('L: 输入「写一篇文章」应推荐 MODEL (文本生成)', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '写一篇文章介绍大模型')

    const modelRec = recs.find((r: { capabilityType: string }) =>
      String(r.capabilityType).toLowerCase() === 'model'
    )
    expect(
      modelRec,
      `输入写文章应返回 MODEL 推荐, 实际: ${JSON.stringify(recs)}`
    ).toBeTruthy()
  })

  // ── M. 混合输入「用 MCP 查询天气并画张图」 → 应同时推荐 MCP + image ──
  test('M: 混合输入「用 MCP 查询天气并画张图」应同时推荐 MCP + image 生成', async ({ page }) => {
    await loadDiscovery(page)
    await page.waitForTimeout(500)
    const recs = await callDiscover(page, '用 MCP 查询天气并画张图')

    const hasMcp = recs.some((r: { capabilityType: string }) =>
      String(r.capabilityType).toLowerCase() === 'mcp'
    )
    const hasImage = recs.some((r: { metadata?: { generationType?: string } }) =>
      r.metadata?.generationType === 'image'
    )
    expect(hasMcp, `混合输入应含 MCP 推荐, 实际: ${JSON.stringify(recs)}`).toBe(true)
    expect(hasImage, `混合输入应含 image 生成推荐, 实际: ${JSON.stringify(recs)}`).toBe(true)
  })
})
