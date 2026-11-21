// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// 「任务进行中 ⇒ 下翻按钮 / 停止键四周旋转激光光带;结束 ⇒ 自动停」判据(2026-11-21)。
// 用户校订(同日):光带只挂这两处,**不挂**模型下拉 / Agent 下拉。
//
// 三个面各判一次,不做单面冒充全链路:
//  ① 组件面:LaserHaloRing 只在 active=true 时挂一颗光环(active=false 必须不渲染);
//  ② 行为面:ScrollJumpButtons 的 isStreaming 翻转 ⇒ 下翻按钮的光带随开随灭;
//  ③ 接线面:message-input 的停止键(流式态才渲染)真挂了光环且 relative;
//     模型下拉 / Agent 下拉不得再出现光环(防回潮);动画/配色/降动效单源在 animations.css。
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { LaserHaloRing } from '../laser-halo-ring'
import { ScrollJumpButtons } from '../message-list/scroll-jump-buttons'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CHAT_DIR = path.resolve(HERE, '..')
const WEB_SRC = path.resolve(CHAT_DIR, '..', '..')

/** 剥注释后的代码面(静态判据只看真代码,不看注释里的许诺) */
function codeFace(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function readFace(relPath: string): string {
  return codeFace(fs.readFileSync(path.resolve(WEB_SRC, relPath), 'utf8'))
}

afterEach(() => {
  cleanup()
})

describe('激光光带组件面', () => {
  it('active=true 挂一颗光环;active=false 不渲染任何节点', () => {
    const { container, unmount } = render(<LaserHaloRing active />)
    expect(container.querySelectorAll('.agent-laser-ring')).toHaveLength(1)
    expect(container.querySelector('.agent-laser-ring')?.getAttribute('aria-hidden')).toBe('true')
    unmount()

    const idle = render(<LaserHaloRing active={false} />)
    expect(idle.container.querySelector('.agent-laser-ring')).toBeNull()
  })
})

const JUMP_BASE = {
  isFarFromTop: false,
  isFarFromBottom: true,
  userScrolledUp: false,
  hasMessages: true,
  onJumpTop: () => {},
  onJumpLatest: () => {},
}

describe('行为面:下翻按钮随流式亮灭', () => {
  it('isStreaming=true ⇒ 下翻按钮带光带;转 false ⇒ 光带自动消失', () => {
    const view = render(<ScrollJumpButtons {...JUMP_BASE} isStreaming />)
    const bottom = screen.getByTestId('scroll-jump-bottom')
    expect(within(bottom).getByTestId('agent-laser-halo')).toBeTruthy()

    view.rerender(<ScrollJumpButtons {...JUMP_BASE} isStreaming={false} />)
    expect(
      within(screen.getByTestId('scroll-jump-bottom')).queryByTestId('agent-laser-halo'),
    ).toBeNull()
  })

  it('下翻按钮不可见(未离底)时不挂光带', () => {
    render(<ScrollJumpButtons {...JUMP_BASE} isFarFromBottom={false} isStreaming />)
    expect(screen.queryByTestId('agent-laser-halo')).toBeNull()
  })
})

describe('接线面:停止键 + 单源动画', () => {
  it('message-input 的停止键 relative + 真挂 LaserHaloRing', () => {
    const face = readFace('components/chat/message-input.tsx')
    expect(face).toMatch(/'relative bg-sky-500 text-white hover:bg-sky-600'/)
    expect(face).toMatch(/data-testid="stop-button"[\s\S]{0,120}<LaserHaloRing active \/>/)
  })

  it('模型下拉 / Agent 下拉不得挂光带(用户 2026-11-21 校订,防回潮)', () => {
    expect(readFace('components/chat/model-selector.tsx')).not.toMatch(/LaserHaloRing/)
    expect(readFace('components/chat/agent-picker.tsx')).not.toMatch(/LaserHaloRing/)
  })

  it('animations.css 单源:旋转光带 + 降动效停转,且不借 mask-image', () => {
    const css = fs.readFileSync(path.resolve(WEB_SRC, 'styles/animations.css'), 'utf8')
    expect(css).toContain('.agent-laser-ring {')
    expect(css).toContain('@keyframes agent-laser-sweep')
    expect(css).toMatch(/stroke-dashoffset: calc\(var\(--laser-offset, 0\) - 100\)/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.agent-laser-ring rect \{\s*animation: none;/,
    )
    const laserBlock = css.match(/\.agent-laser-ring \{[^}]*\}/)?.[0] ?? ''
    expect(laserBlock).toContain('pointer-events: none')
    expect(laserBlock).not.toMatch(/mask-image/i)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
