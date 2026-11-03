#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * ci-test-shards.mjs — CI 测试分片的**唯一**分区真相 + 覆盖面断言。
 *
 * 立因(2026-11-03,CI 墙钟压缩):`pnpm turbo run test` 在单 job 里跑 19 个包实测 15m23s
 * (run 41539163237)。分片必须做到"每个声明了 `scripts.test` 的包在所有分片里恰好被跑一次",
 * 否则新增一个包就会**静默不被测试**,而 CI 仍然全绿 —— 那等于删门(§12e)。
 * 因此分区不手抄在 workflow 里:workflow 只传 `--shard i/N`,分区由本脚本从
 * `apps/* / packages/*` 的 package.json 现读并确定性计算,`--assert` 在同一套算法上复核。
 *
 * 口径:
 *   - 包集合真值 = 每个 package.json 里存在非空 `scripts.test` 的 workspace 包(不手抄清单)。
 *   - 权重 = 包内测试文件数(`*.test.*` / `*.spec.*`,排除 node_modules、dist、.next 家族、
 *     .output、.wxt、.turbo、.ihui-agent),与实测文件量同源(api 1121 / web 793 / cli 398 …)。
 *   - `@ihui/api` 与 `@ihui/web` 是唯一两个"单包跑满一个分片"仍超预算的包,固定各摊 2 个分片
 *     (vitest `--shard=i/2` 按**文件**切分,用例集合不变,只是被执行者分开)。
 *   - 其余包按权重降序贪心装箱到 4 个分片,分片内用 `turbo run test` 保留 `dependsOn: ["^build"]`
 *     的拓扑前置(不得绕过)。
 *
 * 用法:
 *   node scripts/ci-test-shards.mjs --plan            # 打印分区(含权重)
 *   node scripts/ci-test-shards.mjs --assert          # 断言覆盖恰好一次;不满足 exit 1
 *   node scripts/ci-test-shards.mjs --shard 1/4       # 执行第 1 片(workflow 用)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARD_COUNT = 4
// 固定摊片:每个包占 2 个分片,分片号从 SPLIT_LAYOUT 取(确定性,不参与装箱)
const SPLIT_LAYOUT = {
  '@ihui/api': [1, 2],
  '@ihui/web': [3, 4],
}
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.next-static',
  '.output',
  '.wxt',
  '.turbo',
  '.ihui-agent',
  '.git',
  'coverage',
])
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

function listWorkspacePackages() {
  const out = []
  for (const group of ['apps', 'packages']) {
    const base = join(ROOT, group)
    if (!existsSync(base)) continue
    for (const name of readdirSync(base, { withFileTypes: true })) {
      if (!name.isDirectory()) continue
      const pj = join(base, name.name, 'package.json')
      if (!existsSync(pj)) continue
      let parsed
      try {
        parsed = JSON.parse(readFileSync(pj, 'utf8'))
      } catch {
        continue
      }
      const test = parsed?.scripts?.test
      if (typeof parsed?.name !== 'string' || !test || !test.trim()) continue
      out.push({ name: parsed.name, dir: join(group, name.name), script: test })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function countTestFiles(dir) {
  let n = 0
  const stack = [dir]
  while (stack.length > 0) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(join(cur, e.name))
        continue
      }
      if (e.isFile() && TEST_FILE.test(e.name)) n++
    }
  }
  return n
}

/** 确定性分区:返回 [{index, split: bool, entries: [{name, weight, fraction|null}]}] */
export function buildPlan() {
  const packages = listWorkspacePackages()
  const weights = new Map(packages.map((p) => [p.name, countTestFiles(join(ROOT, p.dir))]))
  const shards = Array.from({ length: SHARD_COUNT }, (_, i) => ({
    index: i + 1,
    split: false,
    entries: [],
    weight: 0,
  }))
  const assigned = new Set()
  for (const [name, layout] of Object.entries(SPLIT_LAYOUT)) {
    const weight = weights.get(name)
    if (weight === undefined) continue // 包已不存在:留给 --assert 的"清单腐烂"判据
    layout.forEach((shardIndex, i) => {
      const shard = shards[shardIndex - 1]
      shard.split = true
      shard.entries.push({ name, weight, fraction: `${i + 1}/${layout.length}` })
      // 摊片后单片负载 ≈ 总权重 / 摊片数
      shard.weight += Math.ceil(weight / layout.length)
    })
    assigned.add(name)
  }
  const rest = packages
    .filter((p) => !assigned.has(p.name))
    .map((p) => ({ name: p.name, weight: weights.get(p.name) ?? 0 }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
  for (const item of rest) {
    let target = 0
    for (let i = 1; i < shards.length; i++) {
      if (shards[i].weight < shards[target].weight) target = i
    }
    shards[target].entries.push({ ...item, fraction: null })
    shards[target].weight += item.weight
  }
  for (const s of shards) {
    // 摊片包先跑(最重),其余按权重降序
    s.entries.sort((a, b) => (b.fraction ? 1 : 0) - (a.fraction ? 1 : 0) || b.weight - a.weight)
  }
  return { packages, shards }
}

function printPlan(plan) {
  console.log(`📋 CI 测试分片计划(共 ${SHARD_COUNT} 片,包集合真值 = 声明 scripts.test 的 workspace 包)`)
  for (const s of plan.shards) {
    console.log(`\n  shard ${s.index}/${SHARD_COUNT}  负载≈${s.weight} 文件`)
    for (const e of s.entries) {
      console.log(`    - ${e.name}${e.fraction ? ` (vitest --shard=${e.fraction})` : ''}  ${e.weight} 文件`)
    }
    if (s.entries.length === 0) console.log('    (空)')
  }
}

function assertCoverage(plan) {
  const problems = []
  const expected = new Set(plan.packages.map((p) => p.name))
  const seen = new Map()
  for (const s of plan.shards) {
    for (const e of s.entries) {
      const key = e.name
      const list = seen.get(key) ?? []
      list.push({ shard: s.index, fraction: e.fraction })
      seen.set(key, list)
    }
  }
  for (const name of expected) {
    const hits = seen.get(name) ?? []
    const layout = SPLIT_LAYOUT[name]
    if (layout) {
      const want = layout.map((idx, i) => ({ shard: idx, fraction: `${i + 1}/${layout.length}` }))
      const ok =
        hits.length === want.length &&
        want.every((w) => hits.some((h) => h.shard === w.shard && h.fraction === w.fraction))
      if (!ok) problems.push(`${name} 的摊片与 SPLIT_LAYOUT 不一致: 现读 ${JSON.stringify(hits)}`)
    } else if (hits.length !== 1) {
      problems.push(`${name} 在分片计划里出现 ${hits.length} 次(必须恰好 1 次): ${JSON.stringify(hits)}`)
    }
  }
  for (const name of seen.keys()) {
    if (!expected.has(name)) problems.push(`分片计划包含不存在的测试包 ${name} —— 分区清单已腐烂`)
  }
  if (expected.size === 0) problems.push('workspace 里解析到 0 个声明 scripts.test 的包 —— 判据失明,不得记通过')
  const total = plan.packages.length
  console.log(
    `📊 分片覆盖断言: 测试包 ${total} 个 · 计划内条目 ${plan.shards.reduce((a, s) => a + s.entries.length, 0)} 条`,
  )
  if (problems.length === 0) {
    console.log('✅ 每个声明 scripts.test 的包在所有分片里恰好被跑一次(摊片包按 vitest --shard 切分,用例集合不变)')
    return 0
  }
  console.error(`❌ 分片覆盖不成立(${problems.length} 处):`)
  for (const p of problems.slice(0, 20)) console.error(`   - ${p}`)
  return 1
}

function runShard(plan, index) {
  const shard = plan.shards[index - 1]
  if (!shard) {
    console.error(`❌ 未知分片 ${index}/${SHARD_COUNT}`)
    return 2
  }
  // 必须直调 turbo 的 bin:经 `pnpm turbo ... -- --shard=i/N` 时 pnpm 会吞掉第一个 `--`,
  // turbo 收到裸 `--shard` 会报 "unexpected argument"(2026-11-03 本机实测),
  // 于是分片参数根本到不了 vitest,分片退化成"每片跑全量"(更慢且看不出错)。
  const turboBin = join(ROOT, 'node_modules', 'turbo', 'bin', 'turbo')
  for (const entry of shard.entries) {
    const args = [turboBin, 'run', 'test', `--filter=${entry.name}`, `--concurrency=${entry.fraction ? 1 : 2}`]
    if (entry.fraction) args.push('--', `--shard=${entry.fraction}`)
    console.log(`\n▶ shard ${index}/${SHARD_COUNT}: ${entry.name}${entry.fraction ? ` (--shard=${entry.fraction})` : ''}`)
    const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
    if (r.status !== 0) {
      console.error(`❌ ${entry.name} 在 shard ${index} 失败(exit ${r.status ?? 'null'})`)
      return r.status ?? 1
    }
  }
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  const plan = buildPlan()
  if (argv.includes('--plan')) {
    printPlan(plan)
    return 0
  }
  if (argv.includes('--assert')) {
    if (argv.includes('--plan')) printPlan(plan)
    return assertCoverage(plan)
  }
  const idx = argv.indexOf('--shard')
  if (idx === -1) {
    console.error('用法: node scripts/ci-test-shards.mjs --plan | --assert | --shard i/N')
    return 2
  }
  const raw = argv[idx + 1] ?? ''
  const m = /^(\d+)\/(\d+)$/.exec(raw)
  if (!m) {
    console.error(`❌ --shard 取值必须是 i/N,现读 "${raw}"`)
    return 2
  }
  const i = Number(m[1])
  const n = Number(m[2])
  if (n !== SHARD_COUNT) {
    console.error(`❌ 本脚本固定 ${SHARD_COUNT} 片,收到 ${n} —— workflow 与分区算法必须同源`)
    return 2
  }
  const coverage = assertCoverage(plan)
  if (coverage !== 0) return coverage
  return runShard(plan, i)
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const rc = main()
  process.exit(rc)
}
