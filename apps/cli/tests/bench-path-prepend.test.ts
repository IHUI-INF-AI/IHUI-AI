// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { prependPathEntry } from '../benchmarks/runner.js'

const DIR = 'G:\\ihui-fakebin'
const OTHER = 'C:\\Windows\\system32'

/** 对象里 PATH 族出现了几种拼写(>1 就是会让子进程丢一份的那种形态)。 */
function spellings(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((k) => k.toUpperCase() === 'PATH')
}

/** 真派生一个 node 子进程,回读它**实际**看到的 PATH(不是我方对象里写了什么)。 */
function childPath(env: Record<string, string | undefined>): { keys: string[]; path: string | undefined } {
  const probe =
    "process.stdout.write(JSON.stringify({keys:Object.keys(process.env).filter(k=>k.toUpperCase()==='PATH'),path:process.env.PATH}))"
  const r = spawnSync(process.execPath, ['-e', probe], {
    env,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  expect(r.status, `探针子进程应正常退出(实得 rc=${r.status},stderr=${String(r.stderr).slice(0, 160)})`).toBe(0)
  return JSON.parse(String(r.stdout)) as { keys: string[]; path: string | undefined }
}

describe('bench runner 的 PATH 前置站点(G-1105300 站点接线)', () => {
  it('P1 宿主拼写成 PATH 时:只有一种拼写,且前置目录就在值首', () => {
    const env = prependPathEntry({ PATH: OTHER, SYSTEMROOT: 'C:\\Windows' }, DIR)
    expect(spellings(env)).toEqual(['PATH'])
    expect(String(env.PATH).startsWith(DIR + ';')).toBe(true)
    expect(String(env.PATH).endsWith(OTHER)).toBe(true)
  })

  it('P2 宿主拼写成 Path(注册表组合的登录环境块)时:写回那一种,不新增第二种', () => {
    const env = prependPathEntry({ Path: OTHER }, DIR)
    expect(spellings(env)).toEqual(['Path'])
    expect(String(env.Path).startsWith(DIR + ';')).toBe(true)
  })

  it('P3 对象里根本没有 PATH 族时:建 `PATH` 单键,值就是该目录(不得凭空拼出分隔符)', () => {
    const env = prependPathEntry({ SYSTEMROOT: 'C:\\Windows' }, DIR)
    expect(spellings(env)).toEqual(['PATH'])
    expect(env.PATH).toBe(DIR)
  })

  it('P4 空串值不当"没有":保留宿主原意(空 PATH 与未判定必须不同形)', () => {
    const env = prependPathEntry({ PATH: '' }, DIR)
    expect(spellings(env)).toEqual(['PATH'])
    expect(env.PATH).toBe(DIR)
  })

  it('P5 到端证明:子进程实际看到的那一份 PATH 就带前置目录', () => {
    const env = prependPathEntry({ PATH: OTHER }, DIR)
    const seen = childPath(env)
    expect(seen.keys).toEqual(['PATH'])
    expect(String(seen.path).startsWith(DIR + ';')).toBe(true)
  })

  it('P6 阳性对照:站点旧写法(固定写 `Path`)确实产出两份拼写,且子进程读到的那份**不含**前置目录', () => {
    // 这一条是"测试有牙"的证明:它复现的是修复前的原句,而不是我方的新实现。
    // 修复前在这台机(Git Bash / 已登录会话宿主,PATH 拼写为大写)上,子进程拿到的是继承值 ⇒
    // "前置 Git\\bin 屏蔽 WSL bash 桩"整句静默失效。判据:keys 只有一份而值不含 DIR。
    const legacy: Record<string, string | undefined> = { PATH: OTHER }
    legacy.Path = [DIR, legacy.Path ?? ''].join(';')
    expect(spellings(legacy)).toEqual(['PATH', 'Path'])
    const seen = childPath(legacy)
    expect(seen.keys).toHaveLength(1)
    expect(String(seen.path).toLowerCase().includes('ihui-fakebin')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
