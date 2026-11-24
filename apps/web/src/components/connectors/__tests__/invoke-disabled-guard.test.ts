// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../connector-invoke-dialog.tsx')
const src = () => readFileSync(SRC, 'utf8')

describe('调用对话框的操作级 disabled 门(2026-11-24)', () => {
  it('run() 在发请求前拦截 disabled 操作,复用既有 disabled 文案', () => {
    const code = src()
    expect(code).toContain('if (operation.disabled) {')
    expect(code).toContain("toast.error(t('disabled'))")
    // 拦截必须发生在 invokeConnectorOperation 之前(源码顺序),否则只是事后报错
    expect(code.indexOf('if (operation.disabled)')).toBeLessThan(
      code.indexOf('await invokeConnectorOperation('),
    )
  })

  it('禁用操作在下拉 badge 与执行按钮两处都有可见反馈', () => {
    const code = src()
    expect(code).toContain("<Badge variant=\"destructive\">{t('disabled')}</Badge>")
    expect(code).toContain('disabled={running || operations.length === 0 || !!operation?.disabled}')
  })

  it('变异锁:抹掉前置拦截或按钮禁用任一即红', () => {
    const code = src()
    const noGuard = code.replace('if (operation.disabled) {', 'if (false) {')
    expect(noGuard).not.toBe(code)
    expect(noGuard).not.toContain('if (operation.disabled) {')
    const noBtn = code.replace('|| !!operation?.disabled', '')
    expect(noBtn).not.toBe(code)
    expect(noBtn).not.toContain('|| !!operation?.disabled')
  })
})
