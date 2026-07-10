/**
 * 守门脚本: AI 能力自动发现结构完整性 (2026-07-07 Phase 3 立)
 *
 * 检测规则:
 *   1. ai-capability-discovery.ts 必须定义 6 类生成关键词数组 (image/video/3D/audio/music/vision)
 *   2. 6 类生成关键词数组必须各含至少 3 个核心词
 *   3. recommendByKeywords 必须 6 类全用 + 合并 if 条件
 *   4. CapabilityRecommendation interface 必须含 metadata 字段
 *   5. metadata 必须含 generationType 字段 (image/video/3d/audio/music/vision/auto)
 *   6. deduplicateRecommendations 的 key 必须含 generationType
 *   7. AICapabilitySelector.vue 必须有 normalizeModeForTab 兜底
 *   8. normalizeModeForTab 必须将 agentic → agent, auto/hybrid → model
 *   9. AIChat.vue discoverAICapabilities 必须对全部 4 Tab 做路由分支
 *  10. AIChat.vue discoverAICapabilities 必须从 rec.metadata?.generationType 路由
 *
 * 防回归目标:
 *   - 防止未来误删 6 类生成关键词中任意一类
 *   - 防止未来误改 normalizeModeForTab 兜底逻辑导致 modal 显示空白
 *   - 防止未来误改 metadata.generationType 路由导致 AI 生成 Tab 不再自动切换
 *
 * 用法:
 *   - 默认:            node scripts/check-capability-discovery-phase3.mjs
 *   - --staged 模式:   node scripts/check-capability-discovery-phase3.mjs --staged
 *   - 自定义文件:      node scripts/check-capability-discovery-phase3.mjs path/to/file.ts
 *
 * 退出码: 0 通过, 1 结构违规
 *
 * 性能: <50ms (单文件正则扫描, pre-commit 友好)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// 目标文件
const TARGETS = {
  discovery: path.join(rootDir, 'src/services/ai-capability-discovery.ts'),
  aiChat: path.join(rootDir, 'src/components/ai/AIChat.vue'),
  selector: path.join(rootDir, 'src/components/ai/AICapabilitySelector/AICapabilitySelector.vue'),
}

/**
 * 6 类生成关键词 (与 ai-capability-discovery.ts 一致)
 * 注: model3DKeywords 在源码中是 'model3DKeywords' (含前缀)
 * 2026-07-07 Phase 3 优化: imageKeywords 移除 '图' (避免污染 vision), visionKeywords 扩展
 */
const GENERATION_KEYWORDS = [
  { type: 'image', arrayName: 'imageKeywords', requiredSamples: ['画', '图片', '照片'] },
  { type: 'video', arrayName: 'videoKeywords', requiredSamples: ['视频', '动画', '短片'] },
  { type: 'audio', arrayName: 'audioKeywords', requiredSamples: ['语音', '朗读', '配音'] },
  { type: 'music', arrayName: 'musicKeywords', requiredSamples: ['音乐', '歌曲', 'bgm'] },
  { type: '3d', arrayName: 'model3DKeywords', requiredSamples: ['3d', '建模', '三维'] },
  { type: 'vision', arrayName: 'visionKeywords', requiredSamples: ['看图', '识图', '理解图片'] },
]

/**
 * 从代码中提取 const arrayName = [...] 数组的内容
 */
function extractArrayBody(src, arrayName) {
  const re = new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([^\\]]+)\\]`)
  const m = src.match(re)
  return m ? m[1] : null
}

/**
 * 检查 ai-capability-discovery.ts 完整性
 */
function checkDiscovery() {
  const errors = []
  if (!fs.existsSync(TARGETS.discovery)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.discovery),
      message: '文件不存在',
    })
    return errors
  }

  const src = fs.readFileSync(TARGETS.discovery, 'utf-8')

  // 1-2. 6 类生成关键词数组必须存在且含核心词
  for (const { type, arrayName, requiredSamples } of GENERATION_KEYWORDS) {
    const body = extractArrayBody(src, arrayName)
    if (!body) {
      errors.push({
        file: path.relative(rootDir, TARGETS.discovery),
        type: 'missing-keywords-array',
        message: `${type} (${arrayName}) 数组缺失 (Phase 3 必需, 否则对应生成类型无法识别)`,
      })
      continue
    }
    for (const sample of requiredSamples) {
      // 检查关键词以单引号或双引号包裹
      const sampleRe = new RegExp(`['"]${sample.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
      if (!sampleRe.test(body)) {
        errors.push({
          file: path.relative(rootDir, TARGETS.discovery),
          type: 'missing-required-keyword',
          message: `${arrayName} 数组必须包含核心关键词 "${sample}"`,
        })
      }
    }
  }

  // 3. 6 类生成类型必须全用 + 合并 if 条件
  const expectedFlags = ['isImageGen', 'isVideoGen', 'is3DGen', 'isAudioGen', 'isMusicGen', 'isVision']
  for (const flag of expectedFlags) {
    if (!new RegExp(`const\\s+${flag}\\s*=`).test(src)) {
      errors.push({
        file: path.relative(rootDir, TARGETS.discovery),
        type: 'missing-flag',
        message: `recommendByKeywords 中必须定义 ${flag} 标志`,
      })
    }
  }
  const combinedRe = /isImageGen\s*\|\|\s*isVideoGen\s*\|\|\s*is3DGen\s*\|\|\s*isAudioGen\s*\|\|\s*isMusicGen\s*\|\|\s*isVision/
  if (!combinedRe.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.discovery),
      type: 'missing-combined-condition',
      message: 'recommendByKeywords 必须有 6 类生成类型的合并 if 条件 (isImageGen || isVideoGen || is3DGen || isAudioGen || isMusicGen || isVision)',
    })
  }

  // 4-5. CapabilityRecommendation 必须含 metadata + generationType
  if (!/metadata\?:\s*\{/.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.discovery),
      type: 'missing-metadata',
      message: 'CapabilityRecommendation interface 必须定义 metadata 可选字段',
    })
  }
  if (!/generationType\?:\s*['"]image['"]\s*\|\s*['"]video['"]/.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.discovery),
      type: 'missing-generationType',
      message: 'metadata 必须含 generationType 字段 (image/video/3d/audio/music/vision/auto)',
    })
  }

  // 6. deduplicateRecommendations key 必须含 generationType
  // 找函数体中的 key 拼接
  const dedupFnRe = /private\s+deduplicateRecommendations\([\s\S]*?\}\s*\}/
  const dedupFn = src.match(dedupFnRe)
  if (dedupFn && !/generationType/.test(dedupFn[0])) {
    errors.push({
      file: path.relative(rootDir, TARGETS.discovery),
      type: 'dedup-missing-generationType',
      message: 'deduplicateRecommendations 的 key 必须包含 generationType (否则同 generationType 重复推荐)',
    })
  }

  return errors
}

/**
 * 检查 AIChat.vue 的 discoverAICapabilities
 */
function checkAIChat() {
  const errors = []
  if (!fs.existsSync(TARGETS.aiChat)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.aiChat),
      message: '文件不存在',
    })
    return errors
  }

  const src = fs.readFileSync(TARGETS.aiChat, 'utf-8')

  // 提取 discoverAICapabilities 函数体
  const fnRe = /const\s+discoverAICapabilities\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/m
  const fnMatch = src.match(fnRe)
  if (!fnMatch) {
    errors.push({
      file: path.relative(rootDir, TARGETS.aiChat),
      type: 'missing-function',
      message: 'AIChat.vue 必须定义 discoverAICapabilities 函数 (Phase 3 核心路由函数)',
    })
    return errors
  }
  const fnBody = fnMatch[1]

  // 9. 全部 4 Tab 路由分支 + generation
  const expectedBranches = [
    { tab: 'agent', pattern: /currentAIMode\.value\s*=\s*['"]agent['"]/ },
    { tab: 'agentic', pattern: /currentAIMode\.value\s*=\s*['"]agentic['"]/ },
    { tab: 'mcp', pattern: /currentAIMode\.value\s*=\s*['"]mcp['"]/ },
    { tab: 'model', pattern: /currentAIMode\.value\s*=\s*['"]model['"]/ },
    { tab: 'generation', pattern: /currentAIMode\.value\s*=\s*['"]generation['"]/ },
  ]
  for (const { tab, pattern } of expectedBranches) {
    if (!pattern.test(fnBody)) {
      errors.push({
        file: path.relative(rootDir, TARGETS.aiChat),
        type: 'missing-routing-branch',
        message: `discoverAICapabilities 必须包含 ${tab} Tab 路由分支 (匹配: ${pattern})`,
      })
    }
  }

  // 10. 必须从 rec.metadata?.generationType 路由
  if (!/rec\.metadata\?\.generationType/.test(fnBody)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.aiChat),
      type: 'missing-generationType-route',
      message: 'discoverAICapabilities 必须从 rec.metadata?.generationType 读取生成类型 (Phase 3 核心)',
    })
  }
  if (!/currentGenerationType\.value\s*=\s*generationType/.test(fnBody)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.aiChat),
      type: 'missing-generationType-assign',
      message: 'discoverAICapabilities 必须设置 currentGenerationType.value = generationType',
    })
  }

  return errors
}

/**
 * 检查 AICapabilitySelector.vue 的 normalizeModeForTab
 */
function checkSelector() {
  const errors = []
  if (!fs.existsSync(TARGETS.selector)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.selector),
      message: '文件不存在',
    })
    return errors
  }

  const src = fs.readFileSync(TARGETS.selector, 'utf-8')

  // 7. 必须有 normalizeModeForTab 函数
  if (!/function\s+normalizeModeForTab\s*\(/.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.selector),
      type: 'missing-normalize',
      message: 'AICapabilitySelector.vue 必须定义 normalizeModeForTab 函数 (兜底 agentic/auto/hybrid, 否则 modal 显示空白)',
    })
    return errors
  }

  // 8. 必须将 agentic → agent
  if (!/mode\s*===\s*['"]agentic['"]\s*\)[\s\S]*?return\s+['"]agent['"]/.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.selector),
      type: 'missing-agentic-normalize',
      message: 'normalizeModeForTab 必须将 agentic 归一化为 agent (最近的可见 Tab)',
    })
  }
  // 必须归一化 auto/hybrid → model
  if (!/return\s+['"]model['"]/.test(src)) {
    errors.push({
      file: path.relative(rootDir, TARGETS.selector),
      type: 'missing-default-normalize',
      message: 'normalizeModeForTab 必须将 auto/hybrid/其它 归一化为 model (默认 Tab)',
    })
  }

  return errors
}

function isStaged(file) {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: rootDir,
      encoding: 'utf-8',
    })
    const staged = output.split(/\r?\n/).filter(Boolean).map((f) => path.resolve(rootDir, f))
    return staged.includes(file)
  } catch {
    return false
  }
}

function main() {
  const args = process.argv.slice(2)
  const stagedOnly = args.includes('--staged')

  // --staged 模式: 仅当任一目标文件在 staged 时才检查
  if (stagedOnly) {
    const anyStaged = Object.values(TARGETS).some(isStaged)
    if (!anyStaged) {
      console.log('✓ Phase 3 目标文件未暂存, 跳过能力发现结构检查')
      process.exit(0)
    }
  }

  const errors = [
    ...checkDiscovery(),
    ...checkAIChat(),
    ...checkSelector(),
  ]

  if (errors.length === 0) {
    console.log('✓ AI 能力自动发现 Phase 3 结构完整:')
    console.log('  - 6 类生成关键词数组 (image/video/3d/audio/music/vision) ✓')
    console.log('  - CapabilityRecommendation 含 metadata.generationType ✓')
    console.log('  - deduplicateRecommendations key 含 generationType ✓')
    console.log('  - AIChat discoverAICapabilities 路由全 4 Tab + generation ✓')
    console.log('  - AICapabilitySelector normalizeModeForTab 兜底 ✓')
    process.exit(0)
  }

  console.log(`✗ AI 能力自动发现 Phase 3 结构违规 (${errors.length} 处)\n`)
  for (const e of errors) {
    console.log(`  [${e.type}] ${e.file}: ${e.message}`)
  }
  console.log('\n  修复建议:')
  console.log('    - 6 类生成关键词数组必须齐全, 每类含至少 3 个核心词')
  console.log('    - 6 类标志 (isImageGen/isVideoGen/is3DGen/isAudioGen/isMusicGen/isVision) 必须全用 + 合并 if')
  console.log('    - CapabilityRecommendation 必须有 metadata?.generationType 字段')
  console.log('    - AIChat discoverAICapabilities 必须设 currentAIMode = 4 Tab + currentGenerationType')
  console.log('    - AICapabilitySelector normalizeModeForTab 必须归一化 agentic→agent, 其它→model')
  console.log('    - 参考 E2E: e2e/auto-mode-tab-routing.spec.ts (22 源码 + 9 浏览器守门)')
  console.log('    - 参考单测: src/services/__tests__/ai-capability-discovery.test.ts (49 用例)')
  process.exit(1)
}

main()
