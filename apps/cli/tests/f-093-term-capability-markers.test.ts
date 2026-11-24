// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-093 回归:全屏 TUI 的 TERM 能力判据必须排除无 alt-screen 的终端标记。
 *
 * 病灶:旧判据只排除 dumb/unknown/cons25,于是 `TERM=emacs`(`M-x term` 的 eterm-color)、
 * VSCode 集成终端等被误判 supported —— `\e[?1049h` / 鼠标上报在错终端上刷出乱码或空屏,
 * 退出后仍留转义残留。这里把标记表与三态判定各自钉住,防有人把标记"顺手"删回去。
 */
import { describe, expect, it } from 'vitest'

import {
  decideFullscreenCapability,
  probeTerminal,
  termLooksCapable,
  type TerminalEnvSlice,
  type TerminalTtySlice,
} from '../src/tui/fullscreen/capability.js'

const TTY: TerminalTtySlice = { stdinTty: true, stdoutTty: true, columns: 100, rows: 30 }
const ENV: TerminalEnvSlice = { term: 'xterm-256color', noColor: undefined, forced: undefined }

describe('F-093 termLooksCapable —— 无 alt-screen 终端一律判不可用', () => {
  it.each(['dumb', 'unknown', 'cons25', 'emacs', 'eterm-color', 'vscode'])(
    '不支持的标记 %s ⇒ false',
    (term) => {
      expect(termLooksCapable(term)).toBe(false)
    },
  )

  it('匹配大小写不敏感:VSCode / EMACS ⇒ false', () => {
    expect(termLooksCapable('VSCode')).toBe(false)
    expect(termLooksCapable('EMACS')).toBe(false)
  })

  it.each(['xterm-256color', 'screen-256color', 'tmux-256color'])(
    '常规全屏终端 %s ⇒ true',
    (term) => {
      expect(termLooksCapable(term)).toBe(true)
    },
  )

  it('undefined / 空串 / 纯空白 ⇒ false(不猜)', () => {
    expect(termLooksCapable(undefined)).toBe(false)
    expect(termLooksCapable('')).toBe(false)
    expect(termLooksCapable('   ')).toBe(false)
  })
})

describe('F-093 decideFullscreenCapability —— TERM 不可用时的三态结论', () => {
  it('TERM=emacs + forced=unset ⇒ unsupported(明确不可用),理由点名 TERM', () => {
    const v = decideFullscreenCapability({ ...ENV, term: 'emacs', forced: 'unset' }, TTY)
    expect(v.kind).toBe('unsupported')
    expect(v.kind === 'unsupported' ? v.reason : '').toContain('TERM=emacs')
    expect(v.kind === 'unsupported' ? v.reason : '').toContain('alt-screen')
  })

  it('同一份 TTY 下 eterm-color / vscode 也判 unsupported(对照:xterm 判 supported)', () => {
    expect(decideFullscreenCapability({ ...ENV, term: 'eterm-color' }, TTY).kind).toBe('unsupported')
    expect(decideFullscreenCapability({ ...ENV, term: 'vscode' }, TTY).kind).toBe('unsupported')
    expect(decideFullscreenCapability({ ...ENV, term: 'xterm-256color' }, TTY).kind).toBe('supported')
  })
})

describe('F-093 probeTerminal —— 现读探针', () => {
  it('无 mock 也跑得通:只返回 {env,tty} 两片,不抛', () => {
    const probe = probeTerminal()
    expect(Object.keys(probe).sort()).toEqual(['env', 'tty'])
    expect(Object.keys(probe.tty).sort()).toEqual(['columns', 'rows', 'stdinTty', 'stdoutTty'])
    expect(Object.keys(probe.env).sort()).toEqual(['forced', 'noColor', 'term'])
    expect(typeof probe.tty.stdinTty).toBe('boolean')
    expect(typeof probe.tty.stdoutTty).toBe('boolean')
    expect(probe.tty.columns === undefined || typeof probe.tty.columns === 'number').toBe(true)
    expect(probe.tty.rows === undefined || typeof probe.tty.rows === 'number').toBe(true)
    expect(probe.env.term === undefined || typeof probe.env.term === 'string').toBe(true)
    expect(probe.env.noColor === undefined || typeof probe.env.noColor === 'string').toBe(true)
    expect(probe.env.forced === undefined || typeof probe.env.forced === 'string').toBe(true)
  })
})
