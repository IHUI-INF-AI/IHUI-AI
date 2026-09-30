// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execGit, formatGitResult } from '../src/tools/git-shared.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * 票 07-A 回归:git 工具出口 execGit 单档超时 + 帽 + bare 'git' 的修复。
 *
 * 四条验收:
 *  1. 落点唯一化:git-shared.ts 内不得再出现 bare `spawnSync('git'` 与第二张预算表;
 *  2. 可跑:execGit 真跑成功(绝对路径解析 + env 白名单投影不破坏基本派生);
 *  3. 封顶诊断:超时 ⇒ killed 带 elapsed/killAt/forceKill/orphaned 四字段;
 *  4. 凭据外泄(守门 67):stderr 内嵌口令的远端 URL 必须被脱敏,不得进 output/error。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const SHARED_SRC = readFileSync(path.resolve(here, '../src/tools/git-shared.ts'), 'utf8')

/** 剔除注释与字符串字面量:守门只盯代码体(文档里引用旧形态不算违例) */
function stripCommentsAndStrings(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code'
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    const nx = i + 1 < src.length ? (src[i + 1] as string) : ''
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out += '\n' }
      continue
    }
    if (mode === 'block') {
      if (ch === '*' && nx === '/') { mode = 'code'; out += ' '; i++ }
      continue
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'tpl') {
      if (ch === '\\') { i++; continue }
      if ((mode === 'sq' && ch === "'") || (mode === 'dq' && ch === '"') || (mode === 'tpl' && ch === '`')) mode = 'code'
      continue
    }
    if (ch === '/' && nx === '/') { mode = 'line'; i++; continue }
    if (ch === '/' && nx === '*') { mode = 'block'; i++; continue }
    if (ch === "'") { mode = 'sq'; continue }
    if (ch === '"') { mode = 'dq'; continue }
    if (ch === '`') { mode = 'tpl'; continue }
    out += ch
  }
  return out
}

const SHARED_CODE = stripCommentsAndStrings(SHARED_SRC)

const tmpRoots: string[] = []
function makeTmpRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-git-shared-'))
  tmpRoots.push(dir)
  const git = (args: string[]): void => {
    // 病会话 EBUSY 修复:不喂 stdin 的派生一律 ignore 两态(见 .workbuddy/skills/ihui-spawn-ebusy-fix)
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr}`)
  }
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  git(['add', 'seed.txt'])
  git(['commit', '-q', '-m', 'seed'])
  return dir
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 临时目录清理失败不干扰断言 */
    }
  }
})

describe('票 07-A:execGit 出口统一', () => {
  it('落点唯一化:本文件不得再出现 bare spawnSync(\'git\' 与第二张预算表(注释剔除后)', () => {
    expect(SHARED_CODE).not.toMatch(/spawnSync\(\s*['"`]git['"`]/)
    // 旧预算表字面量:单档 30s / 1MiB,不得再以裸字面量形态出现
    expect(SHARED_CODE).not.toMatch(/=\s*30_000\b/)
    expect(SHARED_CODE).not.toMatch(/=\s*30000\b/)
    expect(SHARED_CODE).not.toMatch(/1024\s*\*\s*1024/)
    // 预算必须经 git-runner 唯一出口
    expect(SHARED_CODE).toMatch(/resolveGitSpawnOptions/)
  })

  it('真跑成功:绝对路径解析 + env 投影不破坏基本派生', () => {
    const repo = makeTmpRepo()
    const r = execGit(['status', '--porcelain'], repo)
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBeDefined()
    const fmt = formatGitResult(r)
    expect(fmt.success).toBe(true)
    expect(fmt.error).toBeUndefined()
  })

  it('封顶诊断:timeoutMs=1 ⇒ killed 带 elapsed/killAt/forceKill/orphaned 四字段', () => {
    const repo = makeTmpRepo()
    const r = execGit(['status', '--porcelain'], repo, { timeoutMs: 1 })
    expect(r.exitCode).toBeNull()
    expect(r.killed).toBeDefined()
    expect(r.killed?.reason).toBe('timeout')
    expect(Object.keys(r.killed ?? {}).sort()).toEqual(
      ['elapsed', 'forceKill', 'killAt', 'orphaned', 'reason'].sort(),
    )
    expect(r.killed?.elapsed).toBeGreaterThanOrEqual(0)
    expect(r.killed?.killAt).toBe(1)
    expect(r.killed?.forceKill).toBe(false)
    expect(r.killed?.orphaned).toBe(false)
    // 诊断进结果面(formatGitResult 拼四字段名)
    const fmt = formatGitResult(r)
    expect(fmt.success).toBe(false)
    for (const word of ['elapsed', 'killAt', 'forceKill', 'orphaned']) {
      expect(fmt.output).toContain(word)
    }
  })

  it('凭据外泄回归:远端 URL 内嵌口令不得进 output/error(守门 67)', () => {
    const repo = makeTmpRepo()
    // 127.0.0.1:1 端口 1(tcpmux)保证 push 快速失败,stderr 会带完整远端 URL
    const setup = spawnSync(
      'git',
      ['remote', 'add', 'origin', 'https://u:IHUI-SECRET-PROBE@127.0.0.1:1/x.git'],
      { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    expect(setup.status).toBe(0)
    const r = execGit(['push', '-u', 'origin', 'HEAD'], repo, { timeoutMs: 15_000 })
    const fmt = formatGitResult(r)
    for (const face of [r.stdout, r.stderr, fmt.output ?? '', fmt.error ?? '']) {
      expect(face).not.toContain('IHUI-SECRET-PROBE')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
