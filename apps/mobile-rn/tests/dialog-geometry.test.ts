// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 弹层高度单一真相源 + 全量弹层接线回归。
 *
 * 四条腿:① 纯函数行为(六档比例 / 两种产物);② 每个弹层消费点都带上统一 style;
 * ③ 消费清单与源码面一致(新增弹层若没登记进清单必须红);④ 全 RN src 百分比高度
 * 零容忍扫描(把百分比上限抄回样式表、或另起一屏写新比例,都必须红)。
 *
 * 第一版只锁 ChatScreen 单文件 ⇒ 抽出的 4 个弹层与另起一屏全漏带;第二版补到 6 个
 * 消费者,但把 14 处不同比例 / 不同形态面板代裁结案;这一版按「全源码扫描 + 清单」双证
 * 把整个 RN src 的百分比限高面收干净。
 *
 * 接线扫描刻意不用复杂正则:逐个切出 style={...} 块再按字面量比对,避免转义写法漂移。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIALOG_HEIGHT_RATIOS,
  DIALOG_MAX_HEIGHT_RATIO,
  dialogContentHeight,
  dialogContentHeightStyle,
  dialogMaxHeightStyle,
  isValidWindowHeight,
} from '../src/lib/dialog-geometry'

// 不用 import.meta.url:jsdom 环境下它可能不是 file: 方案(fileURLToPath 直接抛);
// vitest 的 cwd 恒为包根(pnpm --filter 与直接 vitest run 都是),用 cwd 更稳。
const SRC_DIR = join(process.cwd(), 'src')
const HOOK_RE =
  /dialogContentHeightStyle|useDialogHeightStyle|useDialogMaxHeightStyle|dialogMaxHeightStyle/

/** 既有 6 个消费者(第二轮的 0.7 弹层族,形态保持不变) */
const CONSUMERS = [
  {
    rel: 'screens/ChatScreen.tsx',
    keys: ['styles.listDialogContent', 'styles.materialPopup'],
    min: 5,
  },
  { rel: 'screens/AiAssistantN8nScreen.tsx', keys: ['pickerStyles.sheet'], min: 1 },
  { rel: 'components/chat/AgentSelector.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/NotesPanel.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/SlashCommandPalette.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/VoicePanel.tsx', keys: ['styles.listDialogContent'], min: 1 },
] as const

/**
 * 第三轮纳入的限高面板:12 文件 / 15 处百分比高度。
 * kind=fixed 用 {height,maxHeight} 配对(内部有滚动列表),kind=max 只用数值 maxHeight
 * (短内容 sheet / 页内限高区,内容少时仍自适应)。vars 列出该屏允许叠加的运行时变量。
 */
const PANELS = [
  {
    rel: 'components/AgentList.tsx',
    keys: ['styles.container', 'styles.content'],
    vars: ['dialogHeightStyle'],
    min: 2,
    hook: 'useDialogHeightStyle()',
  },
  {
    rel: 'components/ai/BusinessFormSheet.tsx',
    keys: ['s.sheet'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.businessForm)',
  },
  {
    rel: 'components/chat/VoiceNote.tsx',
    keys: ['styles.panel'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle()',
  },
  {
    rel: 'screens/AgentCategoriesScreen.tsx',
    keys: ['styles.sheet'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.extraTall)',
  },
  {
    rel: 'screens/ArticleDetailScreen.tsx',
    keys: ['styles.commentSheet'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.articleComment)',
  },
  {
    rel: 'screens/ChatTemplatesScreen.tsx',
    keys: ['styles.sheet'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.tall)',
  },
  {
    rel: 'screens/EduAttendanceScreen.tsx',
    keys: ['styles.statsArea'],
    vars: ['dialogMaxHeightStyle'],
    min: 1,
    hook: 'useDialogMaxHeightStyle(DIALOG_HEIGHT_RATIOS.stats)',
  },
  {
    rel: 'screens/GroupsScreen.tsx',
    keys: ['styles.sheet'],
    vars: ['dialogMaxHeightStyle'],
    min: 1,
    hook: 'useDialogMaxHeightStyle(DIALOG_HEIGHT_RATIOS.tall)',
  },
  {
    rel: 'screens/HomeScreen.tsx',
    keys: [
      'shellStyles.modelModalSheet',
      'shellStyles.materialSheet',
      'shellStyles.detailDialogContent',
    ],
    vars: ['dialogHeightStyle', 'materialHeightStyle'],
    min: 3,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.tall)',
  },
  {
    rel: 'screens/ProfileScreen.tsx',
    keys: ['styles.levelIntroCard'],
    vars: ['dialogHeightStyle'],
    min: 1,
    hook: 'useDialogHeightStyle(DIALOG_HEIGHT_RATIOS.tall)',
  },
  {
    rel: 'screens/PublishAccountsScreen.tsx',
    keys: ['styles.sheet'],
    vars: ['dialogMaxHeightStyle'],
    min: 1,
    hook: 'useDialogMaxHeightStyle(DIALOG_HEIGHT_RATIOS.extraTall)',
  },
  {
    rel: 'screens/PublishCalendarScreen.tsx',
    keys: ['styles.sheet'],
    vars: ['dialogMaxHeightStyle'],
    min: 1,
    hook: 'useDialogMaxHeightStyle(DIALOG_HEIGHT_RATIOS.extraTall)',
  },
] as const

const readSrc = (rel: string) => readFileSync(join(SRC_DIR, rel), 'utf8')

function walk(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = base ? base + '/' + name : name
    if (statSync(full).isDirectory()) out.push(...walk(full, rel))
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

/** 切出所有 style={...} 块(目标块内部不含嵌套花括号,按首个右括号收尾即可) */
function styleBlocks(src: string): string[] {
  const out: string[] = []
  let rest = src
  let start = rest.indexOf('style={')
  while (start !== -1) {
    const end = rest.indexOf('}', start)
    if (end === -1) break
    out.push(rest.slice(start, end + 1))
    rest = rest.slice(end + 1)
    start = rest.indexOf('style={')
  }
  return out
}

function countOf(src: string, needle: string): number {
  return src.split(needle).length - 1
}

const ALL_CONSUMERS = [...CONSUMERS.map((c) => c.rel), ...PANELS.map((p) => p.rel)].sort()

describe('dialogContentHeight(纯函数)', () => {
  it('六档比例是唯一真相源且互不相同', () => {
    const vals = Object.values(DIALOG_HEIGHT_RATIOS)
    expect(vals).toEqual([0.45, 0.7, 0.72, 0.78, 0.8, 0.85])
    expect(new Set(vals).size).toBe(vals.length)
  })
  it('默认档向后兼容既有 6 个无参消费者', () => {
    expect(DIALOG_MAX_HEIGHT_RATIO).toBe(0.7)
    expect(DIALOG_MAX_HEIGHT_RATIO).toBe(DIALOG_HEIGHT_RATIOS.standard)
    expect(dialogContentHeight(800)).toBe(560)
    expect(dialogContentHeight(733)).toBe(513)
  })
  it('各档按屏高四舍五入到整像素', () => {
    expect(dialogContentHeight(800, DIALOG_HEIGHT_RATIOS.stats)).toBe(360)
    expect(dialogContentHeight(800, DIALOG_HEIGHT_RATIOS.articleComment)).toBe(576)
    expect(dialogContentHeight(800, DIALOG_HEIGHT_RATIOS.businessForm)).toBe(624)
    expect(dialogContentHeight(800, DIALOG_HEIGHT_RATIOS.tall)).toBe(640)
    expect(dialogContentHeight(800, DIALOG_HEIGHT_RATIOS.extraTall)).toBe(680)
  })
  it('height 与 maxHeight 恒等且同源', () => {
    const style = dialogContentHeightStyle(800)
    expect(style).not.toBeNull()
    expect(style?.height).toBe(style?.maxHeight)
    expect(style?.height).toBe(dialogContentHeight(800))
    expect(dialogContentHeightStyle(800, DIALOG_HEIGHT_RATIOS.extraTall)).toEqual({
      height: 680,
      maxHeight: 680,
    })
  })
  it('仅上限产物不带 height(短内容 sheet 不强行拉高)', () => {
    expect(dialogMaxHeightStyle(800)).toEqual({ maxHeight: 560 })
    expect(dialogMaxHeightStyle(800, DIALOG_HEIGHT_RATIOS.tall)).toEqual({ maxHeight: 640 })
    expect(dialogMaxHeightStyle(800, DIALOG_HEIGHT_RATIOS.stats)).toEqual({ maxHeight: 360 })
  })
  it('屏高异常不产出确定尺寸(避免弹层塌成 0 高)', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidWindowHeight(bad)).toBe(false)
      expect(dialogContentHeightStyle(bad)).toBeNull()
      expect(dialogMaxHeightStyle(bad)).toBeNull()
    }
    expect(isValidWindowHeight(800)).toBe(true)
  })
})

describe('全 RN src 百分比高度零容忍(防再漏)', () => {
  it('任何文件都不再写百分比 maxHeight / minHeight', () => {
    const hits: string[] = []
    for (const rel of walk(SRC_DIR)) {
      const src = readSrc(rel)
      for (const m of src.matchAll(/\b(?:maxHeight|minHeight)\s*:\s*'(\d+)%'/g)) {
        hits.push(`${rel} ${m[0]}`)
      }
    }
    expect(hits).toEqual([])
  })
  it('非 100% 的 height 百分比只剩两处图片内容比例豁免', () => {
    // 豁免依据:两处父容器均有确定高度(imagePreviewOverlay flex:1 / previewItem 取 screenHeight),
    // 内部无滚动列表,是图片本身的显示比例,不是弹层限高,不属于 Fabric 测量缺陷。
    const hits: string[] = []
    for (const rel of walk(SRC_DIR)) {
      const src = readSrc(rel)
      for (const m of src.matchAll(/\bheight\s*:\s*'(\d+)%'/g)) {
        if (m[1] === '100') continue
        hits.push(`${rel}:${m[1]}`)
      }
    }
    expect(hits.sort()).toEqual(['screens/ChatScreen.tsx:80', 'screens/ProfileScreen.tsx:80'])
  })
})

describe('全量弹层接线(防回归)', () => {
  it('所有消费单一真相源的源码文件都登记在清单里(新增弹层必须登记)', () => {
    const actual = walk(SRC_DIR)
      .filter((rel) => HOOK_RE.test(readSrc(rel)))
      .filter((rel) => rel !== 'lib/dialog-geometry.ts' && rel !== 'lib/use-dialog-height.ts')
      .sort()
    expect(actual).toEqual(ALL_CONSUMERS)
  })

  for (const c of CONSUMERS) {
    describe(c.rel, () => {
      const src = readSrc(c.rel)
      it('样式表里不再出现百分比上限 / 手写比例', () => {
        expect(src).not.toContain("'70%'")
        expect(src).not.toContain("'40%'")
        expect(src).not.toContain('modelPickerHeight')
        expect(src).not.toContain('Math.round(windowHeight')
      })
      it('从单一真相源接线并产出统一 style', () => {
        expect(HOOK_RE.test(src)).toBe(true)
        expect(src).toContain('dialogHeightStyle')
      })
      it('所有弹层容器消费点都接上确定高度', () => {
        const refs = c.keys.reduce((n: number, k: string) => n + countOf(src, k), 0)
        const consumers = styleBlocks(src).filter(
          (b) => c.keys.some((k) => b.includes(k)) || b.includes('listDialogStyle'),
        )
        expect(refs).toBeGreaterThanOrEqual(c.min)
        expect(consumers.length).toBeGreaterThanOrEqual(c.min)
        for (const block of consumers)
          expect(block.includes('dialogHeightStyle') || block.includes('listDialogStyle')).toBe(
            true,
          )
        for (const k of c.keys) expect(src).toContain('[' + k + ', dialogHeightStyle]')
      })
    })
  }

  for (const p of PANELS) {
    describe(p.rel, () => {
      const src = readSrc(p.rel)
      it('样式表保留 maxHeight / height 键供门 217 识别 bounded,但值不再写百分比', () => {
        expect(src).not.toMatch(/\b(?:maxHeight|minHeight)\s*:\s*'\d+%'/)
        expect(src).toMatch(/\b(?:maxHeight|height)\s*:\s*undefined\b/)
      })
      it('从统一接线口按登记的那一档比例取高', () => {
        expect(src).toContain('/lib/use-dialog-height')
        expect(src).toContain(p.hook)
      })
      it('所有限高容器消费点都叠加运行时数值高度', () => {
        // 键后必须紧跟 , 或 } —— 否则 styles.sheet 会被 styles.sheetHead /
        // shellStyles.materialSheetBar 这类同前缀键误命中,夹具与实现同错。
        const mentionsKey = (b: string, k: string) => b.includes(k + ',') || b.includes(k + '}')
        const blocks = styleBlocks(src).filter((b) => p.keys.some((k) => mentionsKey(b, k)))
        expect(blocks.length).toBeGreaterThanOrEqual(p.min)
        for (const block of blocks) expect(p.vars.some((v) => block.includes(v))).toBe(true)
      })
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
