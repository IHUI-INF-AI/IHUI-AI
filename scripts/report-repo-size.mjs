#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具需要输出诊断信息 */
/**
 * 远端仓库体积报告。
 *
 * 背景:
 *   GitHub API 直接返回 size(KB);Gitee 个人仓库 OpenAPI 没有 size 字段,
 *   企业版 API 的 repoSize 只对企业命名空间生效,个人命名空间会 404/401。
 *   因此 Gitee 侧只能通过一次 bare clone 实测可达对象的 pack 体积。
 *
 * 用法:
 *   node scripts/report-repo-size.mjs
 *   node scripts/report-repo-size.mjs --json
 *   node scripts/report-repo-size.mjs --gitee-only
 *   node scripts/report-repo-size.mjs --keep        (保留临时 bare 仓库)
 *
 * 环境变量:
 *   REPO_SIZE_GITHUB_REPO  默认 IHUI-INF-AI/IHUI-AI
 *   REPO_SIZE_GITEE_URL    默认 https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git
 *
 * 说明:
 *   Gitee 的实测值只统计 main 可达对象,不包含服务端历史 force-push 留下的
 *   不可达对象;后者没有公开 API 可读。
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { get } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const keepTemp = argv.includes('--keep')
const githubOnly = argv.includes('--github-only')
const giteeOnly = argv.includes('--gitee-only')
const help = argv.includes('--help') || argv.includes('-h')

const GITHUB_REPO = process.env.REPO_SIZE_GITHUB_REPO || 'IHUI-INF-AI/IHUI-AI'
const GITEE_URL = process.env.REPO_SIZE_GITEE_URL || 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git'

function git(args, cwd) {
  // 显式 store 助手,避免 Windows Git 的 credential-manager 路径损坏时无法读取
  // 已有的 .git-credentials;公开仓库不触发认证,不受影响。
  const r = spawnSync('git', ['-c', 'credential.helper=store', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (r.status !== 0) {
    const detail = (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')
    throw new Error(`git ${args.join(' ')} 失败: ${detail}`)
  }
  return r.stdout.trim()
}

function githubSize() {
  return new Promise((resolve, reject) => {
    const req = get(
      `https://api.github.com/repos/${GITHUB_REPO}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'IHUI-AI-repo-size-report',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API ${res.statusCode}: ${body.slice(0, 160)}`))
            return
          }
          try {
            const data = JSON.parse(body)
            resolve({ repo: GITHUB_REPO, size_kb: data.size, size_mib: Number((data.size / 1024).toFixed(2)) })
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
  })
}

function giteeSize() {
  const temp = mkdtempSync(join(tmpdir(), 'ihui-gitee-size-'))
  try {
    git(['clone', '--bare', '--single-branch', '--branch', 'main', '--no-tags', GITEE_URL, temp], process.cwd())
    const head = git(['--git-dir', temp, 'rev-parse', '--short', 'HEAD'], process.cwd())
    const raw = git(['--git-dir', temp, 'count-objects', '-v'], process.cwd())
    const m = raw.match(/^size-pack:\s*(\d+)$/m)
    if (!m) throw new Error('git count-objects 未返回 size-pack')
    const sizeKiB = Number(m[1])
    return {
      repo: GITEE_URL,
      head,
      scope: 'reachable-main',
      pack_kib: sizeKiB,
      pack_mib: Number((sizeKiB / 1024).toFixed(2)),
      note: 'bare clone 只含 main 可达对象;服务端不可达对象不在内',
    }
  } finally {
    if (!keepTemp) {
      try {
        rmSync(temp, { recursive: true, force: true })
      } catch {
        // Windows 上 git 进程刚退出时偶发占用,留给系统临时目录清理
      }
    }
  }
}

function localSize() {
  const head = git(['rev-parse', '--short', 'HEAD'], process.cwd())
  const raw = git(['count-objects', '-v'], process.cwd())
  const packKiB = Number((raw.match(/^size-pack:\s*(\d+)$/m) || [])[1] || 0)
  const looseKiB = Number((raw.match(/^size:\s*(\d+)$/m) || [])[1] || 0)
  const treeRaw = git(['ls-tree', '-r', '-l', 'HEAD'], process.cwd())
  let treeBytes = 0
  let files = 0
  for (const line of treeRaw.split('\n')) {
    const meta = line.split('\t')[0]?.trim().split(/\s+/)
    if (meta?.length >= 4) {
      treeBytes += Number(meta[3])
      files++
    }
  }
  return {
    head,
    scope: 'all-local-refs',
    pack_mib: Number((packKiB / 1024).toFixed(2)),
    loose_mib: Number((looseKiB / 1024).toFixed(2)),
    tree_mib: Number((treeBytes / 1024 / 1024).toFixed(2)),
    tracked_files: files,
  }
}

if (help) {
  console.log(`用法: node scripts/report-repo-size.mjs [--json] [--github-only|--gitee-only] [--keep]`)
  process.exit(0)
}

const result = { generated_at: new Date().toISOString() }
try {
  if (!giteeOnly) result.github = await githubSize()
  if (!githubOnly) result.gitee = giteeSize()
  if (!githubOnly && !giteeOnly) result.local = localSize()
} catch (e) {
  console.error(`[repo-size] ${e.message}`)
  process.exit(1)
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  if (result.github) console.log(`GitHub ${result.github.repo}: ${result.github.size_mib} MiB (API size)`)
  if (result.gitee) {
    console.log(`Gitee ${result.gitee.repo}: ${result.gitee.pack_mib} MiB (可达 main pack)`)
    console.log(`  head=${result.gitee.head}`)
    console.log(`  口径=${result.gitee.scope}; ${result.gitee.note}`)
  }
  if (result.local) {
    console.log(`Local HEAD ${result.local.head}: pack=${result.local.pack_mib} MiB + loose=${result.local.loose_mib} MiB (全部本地 refs)`)
    console.log(`  HEAD 树=${result.local.tree_mib} MiB; ${result.local.tracked_files} 个文件`)
    console.log('  口径=all-local-refs;包含本机额外分支/提交,不等于远端 main-only')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
