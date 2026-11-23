// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-02 子进程 env 白名单通道 —— 判定面单测。
 *
 * 钉的是「未登记默认不进」这条与 `env-guard` 相反的腿，以及三件不允许回退的事：
 * 会话键隔离、凭据名拦截、**丢弃记录不回传值**（值进日志等于换个地方泄漏）。
 */

import { describe, expect, it } from 'vitest'

import {
  buildChildEnv,
  hostWhitelistFor,
  wouldDrop,
  HOST_PASSTHROUGH_POSIX,
  HOST_PASSTHROUGH_WINDOWS,
} from '../src/sandbox/env-channel'

describe('B4-02 子进程 env 白名单', () => {
  it('白名单内的宿主键原样透传', () => {
    const out = buildChildEnv({ Path: 'C:\\Windows', SYSTEMROOT: 'C:\\Windows' }, {}, 'win32')
    expect(out.env).toEqual({ Path: 'C:\\Windows', SYSTEMROOT: 'C:\\Windows' })
    expect(out.dropped).toEqual([])
  })

  it('未登记的宿主键默认不进（与 env-guard 的黑名单语义相反）', () => {
    const out = buildChildEnv({ PATH: '/usr/bin', CUSTOM_FOO: 'bar' }, {}, 'linux')
    expect(out.env).toEqual({ PATH: '/usr/bin' })
    expect(out.dropped).toEqual([
      { key: 'CUSTOM_FOO', reason: 'not_in_whitelist', why: '宿主键未列入白名单（默认不进）' },
    ])
  })

  it('宿主侧的会话键一律隔离（拦的是意外继承）', () => {
    const out = buildChildEnv(
      { PATH: '/usr/bin', IHUI_SESSION_ID: 's-1', HARNESS_OWNER_KEY: 'k' },
      {},
      'linux',
    )
    expect(out.env.PATH).toBe('/usr/bin')
    expect(Object.keys(out.env)).toEqual(['PATH'])
    expect(out.dropped.map((d) => d.reason)).toEqual([
      'session_key_isolation',
      'session_key_isolation',
    ])
  })

  it('extras 是显式授权：调用方点名的会话键可以进（hook 上下文靠这条）', () => {
    const out = buildChildEnv(
      { PATH: '/usr/bin' },
      { IHUI_SESSION_ID: 'sess-abc', PLAN_SESSION_TOKEN: 't' },
      'linux',
    )
    expect(out.env.IHUI_SESSION_ID).toBe('sess-abc')
    // 凭据形态仍拦：显式授权不等于可以把 token 塞进 env
    expect(out.env.PLAN_SESSION_TOKEN).toBeUndefined()
    expect(out.dropped.map((d) => d.key)).toEqual(['PLAN_SESSION_TOKEN'])
    expect(out.dropped[0]?.reason).toBe('secret_like_name')
  })

  it('疑似凭据名拦下，且记录里不带值', () => {
    // 刻意不用 `sk-` 之类真实凭据形态：那会触发仓库的凭据扫描器误报
    const sampleValue = 'test-value-not-a-real-credential'
    const out = buildChildEnv({ PATH: '/usr/bin', MY_API_KEY: sampleValue }, {}, 'linux')
    expect(out.env).toEqual({ PATH: '/usr/bin' })
    expect(out.dropped[0]?.reason).toBe('secret_like_name')
    // 关键：整份回执序列化后不得出现那个值
    expect(JSON.stringify(out)).not.toContain(sampleValue)
  })

  it('extras 里被 env-guard 判 forbidden 的键拒收并给出指引', () => {
    const out = buildChildEnv(
      { PATH: '/usr/bin' },
      { IHUI_API_TOKEN: 'tok', IHUI_TOOL_PROFILE: 'default' },
      'linux',
    )
    expect(out.env.IHUI_TOOL_PROFILE).toBe('default')
    expect(out.env.IHUI_API_TOKEN).toBeUndefined()
    const drop = out.dropped.find((d) => d.key === 'IHUI_API_TOKEN')
    expect(drop?.reason).toBe('guarded_forbidden')
    expect(drop?.why).toContain('不允许经 env 传递')
  })

  it('extras 是显式通道：非白名单的自定义键可以进，但敏感名仍拦', () => {
    const out = buildChildEnv({ PATH: '/usr/bin' }, { IHUI_TOOL_PROFILE: 'x', MY_SECRET: 's' }, 'linux')
    expect(out.env.IHUI_TOOL_PROFILE).toBe('x')
    expect(out.env.MY_SECRET).toBeUndefined()
    expect(out.dropped.map((d) => d.key)).toEqual(['MY_SECRET'])
  })

  it('大小写不敏感匹配（Windows Path 与 PATH 同一个）', () => {
    const out = buildChildEnv({ Path: '/a', path: '/b' }, {}, 'win32')
    expect(out.env).toEqual({ Path: '/a', path: '/b' })
    expect(out.dropped).toEqual([])
    expect(wouldDrop('pAtH', 'win32')).toBeUndefined()
  })

  it('平台决定白名单：POSIX 上 SYSTEMROOT 不在表内', () => {
    const winOnly = buildChildEnv({ PATH: '/usr/bin', SYSTEMROOT: 'x' }, {}, 'linux')
    expect(winOnly.env.SYSTEMROOT).toBeUndefined()
    expect(winOnly.dropped[0]?.reason).toBe('not_in_whitelist')
    const onWin = buildChildEnv({ PATH: 'C:\\', SYSTEMROOT: 'x' }, {}, 'win32')
    expect(onWin.env.SYSTEMROOT).toBe('x')
  })

  it('白名单本身不含任何会话键或凭据名（结构自证）', () => {
    for (const key of [...HOST_PASSTHROUGH_WINDOWS, ...HOST_PASSTHROUGH_POSIX]) {
      expect(key).not.toMatch(/_SESSION_ID$|_OWNER_KEY$|_TOKEN$|_KEY$|SECRET|PASSWORD/)
    }
  })

  it('kept 排序且与 env 键一致；undefined 值被跳过', () => {
    const out = buildChildEnv({ TEMP: 't', PATH: '/p', WINDIR: undefined }, {}, 'win32')
    expect(out.kept).toEqual(['PATH', 'TEMP'])
    expect(Object.keys(out.env).sort()).toEqual(out.kept)
    expect('WINDIR' in out.env).toBe(false)
  })

  it('wouldDrop 给出与 buildChildEnv 同口径的原因码', () => {
    expect(wouldDrop('')).toBe('malformed')
    expect(wouldDrop('A=B')).toBe('malformed')
    expect(wouldDrop('X_SESSION_ID')).toBe('session_key_isolation')
    expect(wouldDrop('MY_PASSWORD')).toBe('secret_like_name')
    expect(wouldDrop('UNKNOWN_HOST_KEY', 'linux')).toBe('not_in_whitelist')
    expect(wouldDrop('PATH', 'linux')).toBeUndefined()
  })

  it('hostWhitelistFor 只认 win32 为 Windows 集', () => {
    expect(hostWhitelistFor('win32')).toBe(HOST_PASSTHROUGH_WINDOWS)
    expect(hostWhitelistFor('linux')).toBe(HOST_PASSTHROUGH_POSIX)
    expect(hostWhitelistFor('darwin')).toBe(HOST_PASSTHROUGH_POSIX)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
