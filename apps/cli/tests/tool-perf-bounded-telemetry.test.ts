// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-need
/**
 * G-937979 回归:Bash 遥测有界化 + 隐私白名单。
 *
 * 三条边界各配正反对照(只留正例的话,边界可能被改穿而不红,AGENTS §5 同一条):
 *  ① hash 只吃首尾 4096:同长且首尾 4096 相同、中段不同的两条命令 ⇒ **同指纹**;
 *    尾部/长度不同 ⇒ 不同指纹(正向是"中段不进 hash"的钉子,不是恒真断言)。
 *  ② 分类只看前 2048:真命令落在 2048 窗口之外 ⇒ 分类为 other(不被正文关键词带偏)。
 *  ③ 身份白名单:注册表内静态名 ⇒ 上传;自定义脚本/动态构造/超长 ⇒ 一律 "other",
 *    原始 token 绝不出现在 name 字段。
 * 另钉票面验收:8MB heredoc ⇒ 三个原语耗时均有界且 name="other"。
 */
import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'

import {
  buildBashCommandTelemetry,
  classifyCommand,
  classifySafeCommandIdentity,
  commandHash,
} from '../src/tools/tool-perf.js'

const MB = 1024 * 1024

function elapsedMs(fn: () => unknown): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

describe('commandHash 有界窗口(只吃首尾 4096)', () => {
  it('同长且首尾 4096 相同、中段不同 ⇒ 同指纹(中段永不进 hash)', () => {
    const head = 'H'.repeat(4096)
    const tail = 'T'.repeat(4096)
    const a = head + 'A'.repeat(5000) + tail
    const b = head + 'B'.repeat(5000) + tail
    expect(a.length).toBe(b.length)
    expect(commandHash(a)).toBe(commandHash(b))
  })

  it('尾部 4096 窗口内不同 ⇒ 不同指纹;长度不同(首尾同形)⇒ 不同指纹', () => {
    const head = 'H'.repeat(4096)
    const a = head + 'A'.repeat(5000) + 'T'.repeat(4096)
    const c = head + 'A'.repeat(5000) + 'U'.repeat(4096)
    const short = head + 'T'.repeat(4096)
    expect(commandHash(a)).not.toBe(commandHash(c))
    expect(commandHash(a)).not.toBe(commandHash(short))
  })

  it('短命令:指纹稳定、16 hex、不同命令不同指纹', () => {
    expect(commandHash('git status')).toMatch(/^[0-9a-f]{16}$/)
    expect(commandHash('git status')).toBe(commandHash('git status'))
    expect(commandHash('git status')).not.toBe(commandHash('git log'))
  })

  it('8MB heredoc 的 hash 耗时有界(<200ms)', () => {
    const huge = 'cat <<EOF\n' + 'x'.repeat(8 * MB) + '\nEOF'
    const ms = elapsedMs(() => commandHash(huge))
    expect(ms).toBeLessThan(200)
  })
})

describe('classifyCommand 有界前缀(只看前 2048)', () => {
  it('窗口内的命令按表分类', () => {
    expect(classifyCommand('git status')).toBe('git')
    expect(classifyCommand('pnpm install --frozen-lockfile')).toBe('package')
    expect(classifyCommand('npm test')).toBe('test')
    expect(classifyCommand('rg pattern src/')).toBe('search')
    expect(classifyCommand('curl https://example.com')).toBe('network')
    expect(classifyCommand('echo hello')).toBe('other')
    expect(classifyCommand('')).toBe('empty')
  })

  it('真命令落在 2048 窗口之外 ⇒ other(分类不读窗口后的正文)', () => {
    const beyond = `${'a'.repeat(2048)}; git status`
    expect(classifyCommand(beyond)).toBe('other')
    // 同一条真命令,窗口放得下 ⇒ 正常分类(证明上面不是"git 永远判不出")
    expect(classifyCommand(`${' '.repeat(2000)}git status`)).toBe('git')
  })

  it('8MB heredoc 的分类耗时有界(<200ms)', () => {
    const huge = 'cat <<EOF\n' + 'x'.repeat(8 * MB) + '\nEOF'
    const ms = elapsedMs(() => classifyCommand(huge))
    expect(ms).toBeLessThan(200)
  })
})

describe('classifySafeCommandIdentity 隐私白名单', () => {
  it('注册表内静态名 ⇒ 上传(git status ⇒ "git");pnpm ⇒ "pnpm"', () => {
    expect(classifySafeCommandIdentity('git status')).toEqual({ count: 1, name: 'git' })
    expect(classifySafeCommandIdentity('pnpm install')).toEqual({ count: 1, name: 'pnpm' })
  })

  it('路径与 Windows 后缀归一后仍命中:/usr/bin/git ⇒ "git";git.exe ⇒ "git"', () => {
    expect(classifySafeCommandIdentity('/usr/bin/git status')).toEqual({ count: 1, name: 'git' })
    expect(classifySafeCommandIdentity('git.exe status')).toEqual({ count: 1, name: 'git' })
  })

  it('票面验收:自定义脚本 ⇒ "other"(原始 token 不进遥测)', () => {
    expect(classifySafeCommandIdentity('./my-script.sh --flag')).toEqual({ count: 1, name: 'other' })
    expect(classifySafeCommandIdentity('./deploy/build.sh')).toEqual({ count: 1, name: 'other' })
  })

  it('动态构造 ⇒ "other":$VAR / $(...) / 反引号 / 双引号内 $', () => {
    expect(classifySafeCommandIdentity('echo $HOME').name).toBe('other')
    expect(classifySafeCommandIdentity('echo $(whoami)').name).toBe('other')
    expect(classifySafeCommandIdentity('ls `date +%F`').name).toBe('other')
    expect(classifySafeCommandIdentity('git commit -m "$(date)"').name).toBe('other')
  })

  it('heredoc ⇒ "other"(不支持档);引号未闭合 ⇒ "other"(判不准档)', () => {
    expect(classifySafeCommandIdentity('cat <<EOF\nhi\nEOF').name).toBe('other')
    expect(classifySafeCommandIdentity('git commit -m "oops').name).toBe('other')
  })

  it('多段 ⇒ compound;引号内分隔符不拆段;fd 复制不算段;注释跳过', () => {
    expect(classifySafeCommandIdentity('git add . && git commit -m done')).toEqual({ count: 2, name: 'compound' })
    expect(classifySafeCommandIdentity('ls | wc -l')).toEqual({ count: 2, name: 'compound' })
    expect(classifySafeCommandIdentity('git commit -m "a; b"')).toEqual({ count: 1, name: 'git' })
    expect(classifySafeCommandIdentity('ls 2>&1')).toEqual({ count: 1, name: 'ls' })
    expect(classifySafeCommandIdentity('git status # && rm -rf /')).toEqual({ count: 1, name: 'git' })
  })

  it('env 前缀不算命令名:FOO=bar git status ⇒ "git"', () => {
    expect(classifySafeCommandIdentity('FOO=bar git status')).toEqual({ count: 1, name: 'git' })
  })

  it('空命令 ⇒ {count:0, name:"empty"}', () => {
    expect(classifySafeCommandIdentity('')).toEqual({ count: 0, name: 'empty' })
    expect(classifySafeCommandIdentity('   ')).toEqual({ count: 0, name: 'empty' })
  })

  it('超 8k ⇒ {name:"other"} 不解析(宁可少一个 count);8k 内照常解析', () => {
    const over = `git status ${'x'.repeat(8200)}`
    expect(over.length).toBeGreaterThan(8 * 1024)
    expect(classifySafeCommandIdentity(over)).toEqual({ name: 'other' })
    const under = `git status ${'x'.repeat(8170)}`
    expect(under.length).toBeLessThanOrEqual(8 * 1024)
    expect(classifySafeCommandIdentity(under)).toEqual({ count: 1, name: 'git' })
  })

  it('票面验收:8MB heredoc ⇒ name="other" 且耗时有界(<200ms)', () => {
    const huge = 'cat <<EOF\n' + 'x'.repeat(8 * MB) + '\nEOF'
    let identity: ReturnType<typeof classifySafeCommandIdentity> | undefined
    const ms = elapsedMs(() => {
      identity = classifySafeCommandIdentity(huge)
    })
    expect(identity).toEqual({ name: 'other' })
    expect(ms).toBeLessThan(200)
  })
})

describe('buildBashCommandTelemetry 字段口径(与上游 command telemetry 对齐)', () => {
  it('category/count/name/hash 四字段一次给齐,hash 与 commandHash 一致', () => {
    const telemetry = buildBashCommandTelemetry('git status')
    expect(telemetry).toEqual({
      count: 1,
      name: 'git',
      category: 'git',
      hash: commandHash('git status'),
    })
  })

  it('判不出的命令四字段全走降级档,不携带任何原始 token', () => {
    const telemetry = buildBashCommandTelemetry('./my-secret-tool.sh upload $CREDS')
    expect(telemetry).toEqual({ name: 'other', category: 'other', hash: commandHash('./my-secret-tool.sh upload $CREDS') })
    expect(JSON.stringify(telemetry)).not.toContain('my-secret-tool')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
