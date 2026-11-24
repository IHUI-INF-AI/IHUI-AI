#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-index-reverse-staged.mjs — 共享索引「反向 staged」拦截门(2026-11-24 根治)
 *
 * 事故成因(两次实测,同一根因):
 *   对象空间提交手敲配方(私有 GIT_INDEX_FILE + commit-tree + CAS update-ref)推进 HEAD 后,
 *   **共享主索引没有同步**:我改过的那些文件在共享索引里仍躺着父提交的旧 blob。相对新 HEAD,
 *   `git diff --cached` 就显示成"把这些文件 staged 成旧版"(反向 staged)。此后任何一次不带
 *   pathspec 的普通 `git commit`(他席极可能这么干)就把本轮交付整批写回旧态 —— 提交成功后
 *   从 git 历史看不出异常,只是改动凭空消失,事后极难察觉。
 *
 * 判据(只认 git 的事实,不读工作树):
 *   对 `git diff --cached HEAD --` 中每个路径 f:
 *     S = 共享索引 stage0 blob;H = HEAD:f
 *     S == H ⇒ 正常(跳过);HEAD 里不存在 f ⇒ 新增文件 staged(跳过,不是回退)
 *     沿 `git log --max-count=N -- f` 的祖先链(跳过 HEAD 自身)找是否存在 blob == S 的提交
 *     ⇒ 命中即"索引停在 HEAD 的某个祖先版本",判红并点名 [path / staged / head / ancestor]。
 *
 * 为什么不用「staged != 工作树」当判据:多会话下索引与工作树不一致是常态(他席 staged 后又改),
 * 那样会是一把恒红尺子,逼人绕回裸提交,连带全部守门作废(§12e)。本门只量"索引 blob 是真祖先"
 * 这一结构性事实,当前仓库面为空,不制造恒红。
 *
 * 退出码:0=无反向 staged;1=判红(有反向 staged);2=判据面取不到(git 失败/超时)。
 * 用法:node scripts/check-index-reverse-staged.mjs [--json] [--root <path>] [--depth 30] [--self-test]
 * 调用方:guardian-runner.mjs 第 327 项(blocking,stagedTriggers 通配所有路径 ⇒ 每次提交都跑)。
 * 修复:优先重走 `scripts/object-space-land.mjs`(自带 alignSharedIndex);已手搓时逐文件
 *       git update-index --cacheinfo 100644,$(git rev-parse HEAD:<path>),<path>
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const selfTestFlag = '--self-test'
const jsonFlag = '--json'

function flagValue(argv, flag) {
  const i = argv.indexOf(flag)
  return i === -1 ? null : argv[i + 1] ?? null
}

function gitAt(root, args, { quiet = false } = {}) {
  // core.quotePath=false:非 ASCII / 空格路径必须逐字取回,不能拿 git 的八进制转写当路径身份(G-801 同型)
  const r = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0 || r.error) {
    if (quiet) return null
    const detail = (r.stderr || r.error?.message || '').trim().slice(0, 300)
    throw new Error(`git ${args.slice(0, 4).join(' ')} 失败: ${detail}`)
  }
  return r.stdout
}

/** 共享索引 stage0 的 {path: blob} 全量映射(-z 抗空格/中文/括号路径) */
function indexBlobs(root) {
  const out = gitAt(root, ['ls-files', '--stage', '-z'])
  const map = new Map()
  for (const rec of out.split('\0')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    const path = rec.slice(tab + 1)
    if (meta[2] === '0' && meta[1]) map.set(path, meta[1])
  }
  return map
}

/** 某 ref 整树的 {path: blob} 映射 */
function treeBlobs(root, ref) {
  const out = gitAt(root, ['ls-tree', '-r', '-z', ref], { quiet: true })
  const map = new Map()
  if (!out) return map
  for (const rec of out.split('\0')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    if (meta[1] === 'blob') map.set(rec.slice(tab + 1), meta[2])
  }
  return map
}

/** 单路径在某 commit 树里的 blob(带 pathspec,避免 commit:path 对特殊字符的解析歧义) */
function blobAtCommit(root, commit, path) {
  const out = gitAt(root, ['ls-tree', '-r', '-z', commit, '--', path], { quiet: true })
  if (!out) return null
  const rec = out.split('\0').find(Boolean)
  if (!rec) return null
  const tab = rec.indexOf('\t')
  if (tab < 0 || rec.slice(tab + 1) !== path) return null
  const meta = rec.slice(0, tab).trim().split(/\s+/)
  return meta[1] === 'blob' ? meta[2] : null
}

/**
 * 找出共享索引中停在 HEAD 祖先版本的路径。
 * @returns {{path:string, stagedBlob:string, headBlob:string, ancestor:string, distance:number}[]}
 */
function findReverseStaged({ root = process.cwd(), depth = 30 } = {}) {
  const idx = indexBlobs(root)
  const headMap = treeBlobs(root, 'HEAD')
  const headSha = (gitAt(root, ['rev-parse', 'HEAD']) || '').trim()
  const found = []
  for (const [path, staged] of idx) {
    const head = headMap.get(path)
    if (!head || head === staged) continue // 新增文件 staged / 无差异:都不是回退
    const log = gitAt(root, ['log', `--max-count=${depth}`, '--format=%H', '--', path], { quiet: true })
    if (!log) continue
    const commits = log.trim().split('\n').filter(Boolean)
    // 若 HEAD 自己改过这个文件,第一条就是 HEAD —— 从祖先开始;否则整条链都是祖先。
    const from = commits[0] === headSha ? 1 : 0
    for (let i = from; i < commits.length; i += 1) {
      const blob = blobAtCommit(root, commits[i], path)
      if (blob && blob === staged) {
        found.push({
          path,
          stagedBlob: staged.slice(0, 10),
          headBlob: head.slice(0, 10),
          ancestor: commits[i].slice(0, 10),
          distance: i - from + 1,
        })
        break
      }
    }
  }
  return found
}

function repairHint(found) {
  return found.map((e) => `  git update-index --cacheinfo 100644,$(git rev-parse HEAD:${JSON.stringify(e.path)}),${JSON.stringify(e.path)}`).join('\n')
}

function selfTest() {
  const cases = [
    ['判据存在', typeof findReverseStaged === 'function'],
    ['修复提示只含 HEAD 取 blob', repairHint([{ path: 'a b.ts', stagedBlob: 'x', headBlob: 'y' }]).includes('rev-parse HEAD:')],
    ['修复提示带引号抗空格', repairHint([{ path: 'a b.ts' }]).includes('"a b.ts"')],
  ]
  for (const [name, ok] of cases) {
    if (!ok) {
      console.error(`FAIL ${name}`)
      return 1
    }
  }
  console.log(`✅ self-test ${cases.length}/${cases.length}`)
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes(selfTestFlag)) return selfTest()
  const rootOpt = flagValue(argv, '--root')
  const root = rootOpt ? resolve(rootOpt) : process.cwd()
  const depthOpt = Number(flagValue(argv, '--depth') || 30)
  const depth = Number.isInteger(depthOpt) && depthOpt > 0 ? depthOpt : 30
  let found
  try {
    found = findReverseStaged({ root, depth })
  } catch (e) {
    console.error(`⚠️ 反向 staged 判据面取不到(exit 2,不折成绿): ${e.message}`)
    return 2
  }
  if (argv.includes(jsonFlag)) {
    console.log(JSON.stringify({ ok: found.length === 0, reverseStaged: found }, null, 2))
    return found.length ? 1 : 0
  }
  if (found.length === 0) {
    console.log('✅ 共享索引无反向 staged(索引 blob 均非 HEAD 的祖先版本)')
    return 0
  }
  console.error(`🚫 共享索引有 ${found.length} 个路径停在 HEAD 的祖先版本 —— 他席裸 git commit 会把本轮交付写回旧版:`)
  for (const e of found) {
    console.error(`   ${e.path}  staged=${e.stagedBlob} head=${e.headBlob} ancestor=${e.ancestor} (距 HEAD ${e.distance} 代)`)
  }
  console.error('   根因:手敲 GIT_INDEX_FILE + commit-tree + update-ref 漏了共享索引回同步。')
  console.error('   根治:以后对象空间提交只走 scripts/object-space-land.mjs(自带 alignSharedIndex)。')
  console.error('   本次修复(在共享索引上执行):')
  console.error(repairHint(found))
  console.error('   修完复跑:node scripts/check-index-reverse-staged.mjs')
  return 1
}

export const __test__ = { findReverseStaged, indexBlobs, treeBlobs, blobAtCommit, repairHint, gitAt }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())
