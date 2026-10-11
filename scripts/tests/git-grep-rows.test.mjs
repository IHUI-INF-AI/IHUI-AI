#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/git-grep-rows.mjs` 的镜像测试(§22c:一律经导出口裁定,不在测试里重述行格式)。
 *
 * 为什么这把尺值得单独立文件:共用层收的是**两个消费者**各自写过的那份行拆解
 * (门 check-db-blind-updatedat-set.mjs 与镜像 clamp-percent-single-source.test.mjs)。
 * 光测"函数会给正确答案"不够 —— 它证明不了"没人再抄一份",所以形状锁与它的牙各一条。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as lib } from '../lib/git-grep-rows.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('行格式解析成对:正常行拆出三段 / 拆不出的五种形态一律 null 而不是猜', () => {
  const ok = lib.parseGrepRow('HEAD:apps/api/src/x.ts:12:const a = 1')
  assert.deepEqual(
    { path: ok.path, line: ok.line, text: ok.text },
    { path: 'apps/api/src/x.ts', line: 12, text: 'const a = 1' },
  )
  // 每一形都对应"错拆"最便宜的错法,所以宁可 null 也不猜
  assert.equal(lib.parseGrepRow('main:apps/a.ts:1:x', 'HEAD'), null, 'rev 不匹配不得当成命中')
  assert.equal(lib.parseGrepRow('HEAD:a:b.ts:1:x'), null, '路径含冒号不得错拆成 path="a"')
  assert.equal(lib.parseGrepRow('HEAD:a.ts:x:1'), null, '行号非数字不得拆成 NaN')
  assert.equal(lib.parseGrepRow(''), null, '空行不得抛')
  assert.equal(lib.parseGrepRow(undefined), null, 'undefined 不得抛')
})

test('rev 是入参而不是第二份常量:换 main 只改实参,同一实现照样拆', () => {
  assert.equal(lib.parseGrepRow('main:apps/a.ts:1:x', 'main')?.path, 'apps/a.ts')
  assert.equal(lib.grepRowPrefix('v9'), 'v9:')
})

test('grepRowPath 必须是 parseGrepRow 的投影(两处算同一件事不得各写一遍)', () => {
  const row = 'HEAD:packages/types/src/x.ts:7:foo'
  assert.equal(lib.grepRowPath(row), lib.parseGrepRow(row).path)
  assert.equal(lib.grepRowPath('nope'), null)
})

test('端到端:真 git grep 的输出必须被这一份解析吃下(只测夹具等于没测)', () => {
  const out = execFileSync(
    'git',
    ['-C', ROOT, 'grep', '-n', 'clampPercent', 'HEAD', '--', 'apps', 'packages'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  const rows = out.split(/\r?\n/).filter(Boolean)
  assert.ok(rows.length >= 1, '现读一条真输出都没拿到 ⇒ 这条臂在空转,不是通过')
  for (const r of rows) {
    const p = lib.parseGrepRow(r, 'HEAD')
    assert.ok(p && Number.isInteger(p.line), `真输出拆不出:${r.slice(0, 90)}`)
  }
})

/**
 * 形状锁:行格式拆解只许住在共用层里。
 * 针**拼出来**而不是字面写:本文件一旦原样写出那串,扫描就会命中"解释自己的散文",
 * 而"回潮一处真复制"与"锁在念自己的注释"在读数上完全同形(本仓为这一型立过多次锁)。
 * 扫描器是纯函数(收 [路径, 正文] 对)—— 于是"它有牙"不必造一个临时 git 仓,
 * 拿一份伪造的违例正文喂同一条函数就能证明,而两条臂共用同一份判据。
 */
const NEEDLE = ['^HEAD:', '(', '[^:]+)', ':(\\d+)'].join('')
const scanNeedle = (entries) => entries.filter(([, text]) => String(text).includes(NEEDLE))

test('形状锁:scripts/ 下不得再出现第二处该格式的拆解(共用层自身除外)', () => {
  const listed = execFileSync(
    'git',
    // -c 连未跟踪一起扫:本票新增的门体/镜像在被提交的**那一刻**就是工作树副本,
    // 只看索引会把"新抄了一份"整型放过(守门 191 的取材面教训同型)。
    ['-C', ROOT, 'ls-files', '-co', '--exclude-standard', 'scripts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 60_000 },
  )
    .split(/\r?\n/)
    .filter((p) => p.endsWith('.mjs'))
  assert.ok(
    listed.length > 100,
    `scripts/.mjs 只列出 ${listed.length} 个 ⇒ 覆盖面不成立,这条锁无从判`,
  )
  const entries = listed.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')])
  const hits = scanNeedle(entries)
  // 共用层自己也**不该**含那串字面(它按 prefix 切片 + 窄正则),所以整面应为 0 处;
  // 一旦 >0,清单会点名,读的人不必再猜是哪一处。
  assert.equal(
    hits.length,
    0,
    `行格式拆解回潮成多处:${hits.map(([p]) => p).join(' | ')} —— 只许住 scripts/lib/git-grep-rows.mjs`,
  )
})

test('形状锁有牙:把违例形状喂给同一条扫描函数必须命中(不得是条恒绿尺)', () => {
  const bad = scanNeedle([['scripts/holder.mjs', `const re = /${NEEDLE}/\n`]])
  assert.equal(bad.length, 1, '伪造的违例正文都扫不出来 ⇒ 上面那条锁是空转的')
  assert.equal(bad[0][0], 'scripts/holder.mjs')
})

test('共用层自带的构造面自检必须全绿(判据不能只在被 import 时才对)', () => {
  assert.equal(lib.selfTest(), 0, 'git-grep-rows --self-test 有失败例')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
