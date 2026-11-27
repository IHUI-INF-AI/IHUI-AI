// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ELEVATION_STEPS } from '@ihui/design-tokens'
import { TAB_BAR_GAP_TOP_PX, TAB_BAR_MARGIN_H_PX } from '@ihui/shared/ui/tab-bar-spec'

/**
 * 2026-11-27 顶栏投影回归锁:
 * 阴影被裁/被正文盖住是结构问题,不是再补一层 filter 能修的。本组用例把四条结构判据钉住:
 * 1) 玻璃面自身不裁内容(overflow 不能回到 GLASS_BAR_SURFACE);
 * 2) 圆角裁剪在独立 GLASS_BAR_CLIP 子层;
 * 3) 顶栏投影面抬 zIndex,才能越过后续不透明正文画下投影;
 * 4) 阴影半径锚定停靠留边,且上翼不超过顶部呼吸位,保证上下左右都在屏内淡出。
 */
const ROOT = join(import.meta.dirname, '..')
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')

function exportedBlock(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`)
  if (start < 0) return ''
  const end = source.indexOf('\n}', start)
  return end < 0 ? source.slice(start) : source.slice(start, end)
}

describe('glass bar 四向投影结构', () => {
  it('玻璃面不裁内容,圆角裁剪单独成层', () => {
    const src = read('src/theme/glass-bar-surface.ts')
    const surface = exportedBlock(src, 'GLASS_BAR_SURFACE')
    const clip = exportedBlock(src, 'GLASS_BAR_CLIP')

    expect(surface, 'GLASS_BAR_SURFACE 又写回 overflow:hidden,投影会被裁回盒内').not.toMatch(
      /overflow:\s*'hidden'/,
    )
    expect(surface, '玻璃面没有四向投影').toMatch(/ELEVATION_STEPS\.lg/)
    expect(surface, '玻璃面没有接阴影半径收口').toMatch(
      /shadowRadius:\s*GLASS_BAR_ELEVATION_RADIUS_PX/,
    )
    expect(clip, 'GLASS_BAR_CLIP 丢失圆角裁剪').toMatch(/overflow:\s*'hidden'/)
    expect(clip, 'GLASS_BAR_CLIP 丢失圆角').toMatch(/borderRadius:\s*rnRadius\.xl/)
  })

  it('阴影半径锚定停靠留边,四边都在屏内淡出', () => {
    const src = read('src/theme/glass-bar-surface.ts')
    expect(src, '阴影半径必须取横向停靠留边,否则左右两翼会被屏幕裁掉').toMatch(
      /const GLASS_BAR_ELEVATION_RADIUS_PX = TAB_BAR_MARGIN_H_PX/,
    )

    // 顶翼 = 半径 - offsetY = 10 - 4 = 6,恰好等于顶部呼吸位;左右 = 10 = 左右留边。
    const radius = TAB_BAR_MARGIN_H_PX
    const topBleed = radius - ELEVATION_STEPS.lg.shadowOffset.height
    expect(radius, '阴影半径超过左右留边 ⇒ 左右投影必被屏边裁').toBeLessThanOrEqual(
      TAB_BAR_MARGIN_H_PX,
    )
    expect(topBleed, '阴影上翼超过顶部呼吸位 ⇒ 顶部投影必被屏边裁').toBeLessThanOrEqual(
      TAB_BAR_GAP_TOP_PX,
    )
  })

  it('NavChrome 用投影面 + 裁剪层,并抬起下投影层级', () => {
    const src = read('src/components/NavChrome.tsx')
    expect(src, 'NavChrome 没接共享玻璃面').toMatch(/\.\.\.GLASS_BAR_SURFACE/)
    expect(src, 'NavChrome 没接独立裁剪层').toMatch(/\.\.\.GLASS_BAR_CLIP/)
    expect(src, 'NavChrome 没有把 children 收进裁剪层').toMatch(
      /<View style=\{styles\.clip\}>\{children\}<\/View>/,
    )
    expect(src, 'NavChrome 没抬 zIndex,下投影会被后续不透明正文盖住').toMatch(/zIndex:\s*2/)
    expect(src, 'NavChrome 没写 position:relative,zIndex 在 Web 不生效').toMatch(
      /position:\s*'relative'/,
    )
    // 投影面自身不能再出现裁剪,否则前两层白拆
    expect(src, 'NavChrome 的投影面又被加回 overflow:hidden').not.toMatch(/overflow:\s*'hidden'/)
  })

  it('TabBar 同样拆层,底栏圆角仍收住 BlurView/rimLight', () => {
    const styles = read('src/components/TabBar.styles.ts')
    const view = read('src/components/TabBar.tsx')
    expect(styles, 'TabBar.container 没接共享玻璃面').toMatch(/\.\.\.GLASS_BAR_SURFACE/)
    expect(styles, 'TabBar 没接独立裁剪层').toMatch(/\.\.\.GLASS_BAR_CLIP/)
    expect(styles, 'TabBar.container 又把 overflow 写回外框').not.toMatch(
      /container:\s*\{[\s\S]*?overflow:\s*'hidden'[\s\S]*?\}/,
    )
    expect(view, 'TabBar 没把 BlurView/图标行收进 clip 子层').toMatch(
      /style=\{tabBarStyleSheet\.clip\}/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
