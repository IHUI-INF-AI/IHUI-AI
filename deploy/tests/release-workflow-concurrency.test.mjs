#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发布类 workflow 的并发互斥夹具。
 *
 * 钉:凡名字带 release / publish 的 workflow 都必须在 **top-level** 声明 `concurrency`,
 * 且 `cancel-in-progress: false`(发布动作自带 `gh release upload --clobber` /
 * `npm publish` / `action-gh-release`,并发跑会互相覆盖同名资产与 release notes)。
 *
 * 修前(HEAD 基线)实测:assistant-release-upload / release-cli / release-on-tag 三个文件缺
 * top-level concurrency ⇒ 本夹具红 3 条;补后转绿。判据只读文本(不启动 Actions)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// RELEASE_WF_DIR 仅用于"对修前基线跑红"的证据采集,正常跑不设该变量。
const WF_DIR = process.env.RELEASE_WF_DIR || join(HERE, '..', '..', '.github', 'workflows')

/** 发布类 workflow 的判定口径:文件名含 release 或 publish(大小写不敏感)。 */
function isPublishWorkflow(name) {
  return /(release|publish)/i.test(name)
}

/** 剥掉 YAML 注释行(行首可带空白),避免把注释里的 `concurrency:` 误判成声明。 */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

/**
 * 取 top-level concurrency 块(列 0 的 `concurrency:` 起,到下一个列 0 的键为止)。
 * 返回块文本;不存在则返回 null。
 */
function topLevelConcurrencyBlock(text) {
  const lines = stripCommentLines(text).split('\n')
  const start = lines.findIndex((l) => /^concurrency:/.test(l))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z0-9_.-]+:/.test(lines[i])) {
      end = i
      break
    }
  }
  return { block: lines.slice(start, end).join('\n'), startLine: start + 1 }
}

const files = readdirSync(WF_DIR).filter((n) => n.endsWith('.yml') && isPublishWorkflow(n))

test('T1 发布类 workflow 清单非空(防止选择器写空导致永远绿)', () => {
  assert.ok(files.length >= 4, `命中发布类 workflow 仅 ${files.length} 个,选择器可能失配`)
})

test('T2 每个发布类 workflow 都有 top-level concurrency 且 cancel-in-progress: false', () => {
  const bad = []
  for (const name of files) {
    const text = readFileSync(join(WF_DIR, name), 'utf8')
    const hit = topLevelConcurrencyBlock(text)
    if (!hit) {
      bad.push(`${name}: 缺 top-level concurrency`)
      continue
    }
    if (!/^\s{2}cancel-in-progress:\s*false\s*$/m.test(hit.block)) {
      bad.push(`${name}: concurrency 块未显式 cancel-in-progress: false (第 ${hit.startLine} 行)`)
    }
  }
  assert.equal(bad.length, 0, `发布类 workflow 并发互斥不合格:\n  ${bad.join('\n  ')}`)
})

test('T3 concurrency 必须位于 jobs 之前(top-level,而非 job 内)', () => {
  const bad = []
  for (const name of files) {
    const text = stripCommentLines(readFileSync(join(WF_DIR, name), 'utf8'))
    const concurrencyAt = text.split('\n').findIndex((l) => /^concurrency:/.test(l))
    const jobsAt = text.split('\n').findIndex((l) => /^jobs:/.test(l))
    if (concurrencyAt < 0) {
      bad.push(`${name}: 缺 top-level concurrency`)
    } else if (jobsAt >= 0 && concurrencyAt > jobsAt) {
      bad.push(`${name}: concurrency(第 ${concurrencyAt + 1} 行)落在 jobs 之后`)
    }
  }
  assert.equal(bad.length, 0, `concurrency 位置不合格:\n  ${bad.join('\n  ')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
