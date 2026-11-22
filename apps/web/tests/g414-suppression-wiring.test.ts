// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-414 ② 的"装车证明":判据住在唯一出口里,而调用点必须真的用它。
//
// 本仓最高频的失效型是"门/出口写好了、没人调用"(守门 64/70/81/115 同族)。
// 这两处都用源码级对账钉住:组件与 hook 不得再回到"自己读 localStorage"的写法。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

function codeFace(relPath: string): string {
  // 遮噪:注释里再出现一次出口名不算装车(与本仓其余"注释不算调用方"的判据同一条口径)
  return readFileSync(join(webSrc, relPath), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

describe('full-access-confirm-dialog 必须委托唯一出口(不再自带一套静默判据)', () => {
  const face = codeFace('components/ai/full-access-confirm-dialog.tsx')

  it('从唯一出口 import 四个动作,且逐个真的被调用', () => {
    expect(face).toContain('@/lib/full-access-suppression')
    for (const fn of [
      'evaluateFullAccessSuppression',
      'grantFullAccessSuppression',
      'recordFullAccessAcknowledgement',
      'clearFullAccessSuppression',
    ]) {
      expect(face, `${fn} 未被调用(判据存在而无人调 = 没有)`).toContain(`${fn}(`)
    }
  })

  it('裸 "===" 永久压制形态不得回来', () => {
    expect(face).not.toMatch(/getItem\([^)]*\)\s*===\s*'1'/)
    expect(face).not.toContain("'ihui:full-access-suppressed'") // 键名只允许住在出口里
  })
})

describe('preferred-permission-mode 的读写必须同住一处且两侧都在产线上', () => {
  const hookFace = codeFace('hooks/use-permission-mode-cycle.ts')

  it('hook 既写记忆也读记忆(修前:只有 setItem,全仓零 getItem)', () => {
    expect(hookFace).toContain('@/lib/permission-mode-memory')
    expect(hookFace).toContain('rememberPreferredPermissionMode(')
    expect(hookFace).toContain('resolveCycleStartMode(')
  })

  it('hook 不得再自己碰这把键(第二份真相的入口)', () => {
    expect(hookFace).not.toContain('preferred-permission-mode')
    expect(hookFace).not.toMatch(/localStorage\.(setItem|getItem|removeItem)\(/)
  })

  it('未接线的读侧不得在任何生产文件里被引用(待拍板那一格保持无人替它拍)', () => {
    // workspace-bind-apply 只允许住在封闭集登记表与本文件的注释里
    const producers = ['hooks/use-permission-mode-cycle.ts', 'components/ai/permission-mode-popover.tsx', 'components/ai/workspace-selector.tsx']
    for (const rel of producers) {
      expect(codeFace(rel), `${rel} 私自据记忆改档`).not.toContain('workspace-bind-apply')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
