// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 77 的镜像测试:整跑 --self-test 并钉住「判据必须在真实仓生效」两条端到端断言
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-radius-single-source.mjs')

test('守门 77 自检全通过(含真实档位表端到端对账 + TS 内嵌 CSS 与同行多声明)', () => {
  const out = execFileSync(process.execPath, [GUARD, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.match(out, /全部 (\d+) 例通过/)
  assert.doesNotMatch(out, /❌/)
})

test('档位表四处同源:tokens.css 与 radius.js 逐档同值', async () => {
  const mod = await import(`file://${join(ROOT, 'packages/design-tokens/src/radius.js').replaceAll('\\', '/')}`)
  const css = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  const expect = {
    '--radius': mod.RADIUS_STEPS.DEFAULT,
    '--radius-xs': mod.RADIUS_STEPS.xs,
    '--radius-sm': mod.RADIUS_STEPS.sm,
    '--radius-md': mod.RADIUS_STEPS.md,
    '--radius-lg': mod.RADIUS_STEPS.lg,
    '--radius-xl': mod.RADIUS_STEPS.xl,
    '--radius-2xl': mod.RADIUS_STEPS['2xl'],
  }
  for (const [name, px] of Object.entries(expect)) {
    const m = new RegExp(`^\\s*${name}:\\s*([0-9.]+)rem`, 'm').exec(css)
    assert.ok(m, `tokens.css 缺少 ${name} 定义`)
    assert.equal(Number(m[1]) * 16, px, `tokens.css ${name} 与 radius.js 漂移`)
  }
})

test('tailwind preset 不得重新内联档位字面量(必须引用 RADIUS_REM)', () => {
  const preset = readFileSync(join(ROOT, 'packages/design-tokens/src/tailwind-preset.js'), 'utf8')
  assert.match(preset, /borderRadius:\s*RADIUS_REM\s*,/)
  assert.doesNotMatch(preset, /borderRadius:\s*\{[\s\S]{0,200}?0\.375rem/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
