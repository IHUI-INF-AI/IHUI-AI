#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-sync-converge.mjs — 主动推送收敛器(2026-09-18 晚立,根治"推不动→手工循环"卡点)。
 *
 * 背景:多会话并发推送,远端在 push 门 typecheck 的 4-5 分钟窗口内持续前移,
 * 单次 push 极易 non-FF。此前 agent 手工循环(fetch→merge→push)每轮 5-13 分钟,
 * 2026-09-18 实战收敛 3 轮耗时 25 分钟,且手工循环易漏步骤/误操作。
 *
 * 机制(worktree-preserving,零触碰他人未提交文件):
 *   1. fetch origin main
 *   2. origin/main 已是 HEAD 祖先 → 已收敛,结束
 *   3. HEAD 已被远端包含 → 无需推送,结束
 *   4. 分叉 → `git merge-tree --write-tree HEAD origin/main` 索引层建合并树
 *      (不触碰工作区,不影响其他会话的未提交文件;冲突则报错退出)
 *   5. `git commit-tree` 造合并提交 → `git update-ref refs/heads/main` 推进本地
 *   6. `node scripts/git-push-guard.mjs` 官方通道推送(含 push 门+降级重试)
 *   7. 重复至多 --rounds 轮(默认 3)
 *
 * 用法:
 *   node scripts/git-sync-converge.mjs [--branch main] [--rounds 3] [--dry-run]
 *   node scripts/git-sync-converge.mjs --self-test   # 回归自检(含 db6c455d6 静默回退复现,见下)
 *
 * 只读核验(不写任何东西)仍用 git-push-converge.mjs。
 *
 * 2026-09-23 静默回退根治(db6c455d6 把已入库的 mobile-rn 0.0.1 翻回 0.0.0,且无任何
 * commit 记录该路径变更 —— 索引层合并用了陈旧输入,merge-tree 之后直接 update-ref):
 *   ① 输入新鲜度 — merge-tree/commit-tree 只用刚解析的 SHA,不用 ref 名;update-ref
 *      带 expected-old 做 CAS,HEAD 被并发推进则本轮作废重来(不覆盖他人本地提交);
 *   ② 单边变更保持守门(assertNoSilentRevert, fail-closed) — 无冲突合并必须原样保留
 *      每一处单边变更(blob 逐字节,含 mode;删除亦比对),丢一处即 exit 1,绝不落提交;
 *      注:基线取 `git merge-base` 最优基(与 merge-tree 默认一致);极端纵横交错历史下
 *      基线分歧只会导致误拦(宁可 exit 1 转人工),永不漏放,方向永远 fail-closed;
 *   ③ 回归网: --self-test(真仓库演练,正反用例) + scripts/tests/ 下镜像测试(§22c)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}
const log = (color, msg) => console.log(`${color}${msg}${C.reset}`)

/** 轮询 push-state.json 至 done/failed(guard 异步推送是后台跑的,须等落定再决策) */
function waitForPushState(headSha, timeoutMs = 8 * 60 * 1000) {
  const stateFile = resolve(process.cwd(), '.workbuddy/push-state.json')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const s = JSON.parse(readFileSync(stateFile, 'utf8'))
      if (s.headSha === headSha && (s.status === 'done' || s.status === 'failed')) return s.status
      // state 已被更新 HEAD 的其他推送覆盖 → 视为本 HEAD 推送已无意义
      if (s.headSha !== headSha) return 'superseded'
    } catch {
      /* 无状态文件 */
    }
    if (Date.now() > deadline) return 'timeout'
    // 同步休眠改用 Atomics.wait(仓内既有正例:desktop-installer-assets.mjs),不再派生 node 子进程。
    // 诱因是实测事实:2026-09-24 该 `node -e` 派生在一轮收敛中失败过一次(隔离复现 3/3 成功 ⇒
    // 瞬时派生失败,根因未定位),而 execFileSync 抛出会把**整轮收敛**连带中止 —— 此时合并提交已推进、
    // 后续轮次与推送检查全部没跑。休眠不该是收敛器的失败模式。
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  }
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** a 是否为 b 的祖先(merge-base --is-ancestor 靠 exit code 判定) */
function isAncestor(a, b) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 60_000,
    })
    return true
  } catch {
    return false
  }
}

// ─── 静默回退守门(纯函数,可单测;见文件头 2026-09-23 节) ──

/** 解析 `git ls-tree -r -z` 输出为 path → "mode blob" */
function parseLsTreeZ(output) {
  const map = new Map()
  for (const entry of output.split('\0')) {
    if (!entry) continue
    const m = entry.match(/^(\d+) \w+ ([0-9a-f]{40})\t([\s\S]*)$/)
    if (!m) throw new Error(`无法解析 ls-tree 条目:${entry.slice(0, 80)}`)
    map.set(m[3], `${m[1]} ${m[2]}`)
  }
  return map
}

/** 列出某 tree 的全部条目(cwd 注入, self-test 指向临时仓库) */
function collectTreeEntries(treeish, cwd) {
  // 真仓整树 ls-tree 输出 >1MB,必须放大 maxBuffer(默认 1MB 会 ENOBUFS 崩溃)
  const out = execFileSync('git', ['ls-tree', '-r', '-z', treeish], {
    encoding: 'buffer',
    cwd,
    windowsHide: true,
    // 只读枚举,可封顶(真仓整树 ls-tree 正常在秒级;无 timeout 时一旦撞上
    // 病态挂起就是把整条收敛/守门链拖死)
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return parseLsTreeZ(out.toString('utf8'))
}

/**
 * 纯函数:揪出被合并吞掉的单边变更(无冲突合并的完备判据)。
 * base→local 与 base→remote 有且仅有一边动过的路径,合并树必须与动的那边逐字节一致。
 * @returns Array<{path, side: 'local'|'remote', expected: string|null, actual: string|null}>
 *   expected/action 为 null 表示"应删除/已删除"。
 */
function verifySingleSided(base, local, remote, merged) {
  const violations = []
  const paths = new Set([...base.keys(), ...local.keys(), ...remote.keys(), ...merged.keys()])
  for (const p of paths) {
    const b = base.has(p) ? base.get(p) : null
    const l = local.has(p) ? local.get(p) : null
    const r = remote.has(p) ? remote.get(p) : null
    const m = merged.has(p) ? merged.get(p) : null
    const changedLocal = l !== b
    const changedRemote = r !== b
    if (changedLocal && !changedRemote) {
      if (m !== l) violations.push({ path: p, side: 'local', expected: l, actual: m })
    } else if (changedRemote && !changedLocal) {
      if (m !== r) violations.push({ path: p, side: 'remote', expected: r, actual: m })
    }
    // 双边都改 → merge-tree 负责(冲突即失败),本守门跳过;双边未改 → 跳过。
  }
  return violations
}

/** 编排:取 base/local/remote/mergedTree 四树条目并比对(cwd 缺省当前仓库) */
function assertNoSilentRevert({ base, local, remote, mergedTree, cwd }) {
  const dir = cwd ?? process.cwd()
  return verifySingleSided(
    collectTreeEntries(base, dir),
    collectTreeEntries(local, dir),
    collectTreeEntries(remote, dir),
    collectTreeEntries(mergedTree, dir),
  )
}

// ─── --self-test(真仓库演练,临时仓库全在 gitignore 的 .ihui-agent/tmp 下) ──

/** 临时仓库 git 调用(身份/签名经 -c 注入,不依赖全局配置) */
function tgit(cwd, args, opts = {}) {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=ihui-test',
      '-c',
      'user.email=t@t.local',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { encoding: 'utf8', cwd, windowsHide: true, ...opts },
  ).trim()
}

/** 文本式 ls-tree 行(供 mktree 拼篡改树) */
function lsTreeLines(treeish, cwd) {
  return execFileSync('git', ['ls-tree', treeish], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 300_000,
  })
    .trim()
    .split('\n')
}

/** 用 mktree 按行拼树(行格式与 ls-tree 输出一致) */
function mktree(cwd, lines) {
  return execFileSync('git', ['mktree'], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    input: lines.join('\n') + '\n',
  }).trim()
}

/** 把行数组中 path 那行的 blob 换掉(拼"被回退"的树) */
function swapBlob(lines, path, newBlob) {
  return lines.map((ln) => (ln.endsWith(`\t${path}`) ? ln.replace(/[0-9a-f]{40}/, newBlob) : ln))
}

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') => {
    results.push(cond)
    console.log(`${cond ? '✅' : '❌'} ${name}${cond || !extra ? '' : ` (${extra})`}`)
  }
  let tmp = null
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    }).trim()
    tmp = resolve(root, '.ihui-agent/tmp/converge-selftest')
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp, { recursive: true })
    const repo = resolve(tmp, 'repo')
    mkdirSync(repo, { recursive: true })
    tgit(repo, ['init', '-q', '-b', 'main'])
    // base: app.json=0.0.0(复刻事故现场) + keep.txt
    writeFileSync(resolve(repo, 'app.json'), '{"version":"0.0.0"}\n')
    writeFileSync(resolve(repo, 'keep.txt'), 'base\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'base'])
    // 本地侧:0.0.0→0.0.1(单边);远端侧:加新文件(单边);keep.txt 双边未改
    tgit(repo, ['checkout', '-qb', 'side-local'])
    writeFileSync(resolve(repo, 'app.json'), '{"version":"0.0.1"}\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'local bump'])
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'side-remote'])
    writeFileSync(resolve(repo, 'new.txt'), 'remote\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'remote add'])
    const base = tgit(repo, ['merge-base', 'side-local', 'side-remote'])
    const goodTree = execFileSync(
      'git',
      ['merge-tree', '--write-tree', 'side-local', 'side-remote'],
      {
        encoding: 'utf8',
        cwd: repo,
        windowsHide: true,
      },
    )
      .trim()
      .split('\n')[0]
      .trim()
    ok('干净合并无冲突(40 位 tree)', /^[0-9a-f]{40}$/.test(goodTree), goodTree.slice(0, 20))
    // 用例 1:干净合并必须通过守门(含双边新增与未改文件)
    const v1 = assertNoSilentRevert({
      base,
      local: 'side-local',
      remote: 'side-remote',
      mergedTree: goodTree,
      cwd: repo,
    })
    ok('用例 1:干净合并零违反', v1.length === 0, JSON.stringify(v1).slice(0, 160))
    // 用例 2:事故复现 —— 把合并树里 app.json 换回 base 版,守门必须揪出
    const localBlob = tgit(repo, ['rev-parse', 'side-local:app.json'])
    const baseBlob = tgit(repo, ['rev-parse', `${base}:app.json`])
    const doctored = mktree(repo, swapBlob(lsTreeLines(goodTree, repo), 'app.json', baseBlob))
    const v2 = assertNoSilentRevert({
      base,
      local: 'side-local',
      remote: 'side-remote',
      mergedTree: doctored,
      cwd: repo,
    })
    ok(
      '用例 2:陈旧回退被拦截(路径/侧/期望/实得全对)',
      v2.length === 1 &&
        v2[0].path === 'app.json' &&
        v2[0].side === 'local' &&
        v2[0].expected === `100644 ${localBlob}` &&
        v2[0].actual === `100644 ${baseBlob}`,
      JSON.stringify(v2).slice(0, 200),
    )
    // 用例 3:单边删除被"复活"同样拦截(期望缺失)
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'del-local', base])
    tgit(repo, ['rm', '-q', 'keep.txt'])
    tgit(repo, ['commit', '-qm', 'local del'])
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'del-remote', base])
    writeFileSync(resolve(repo, 'other.txt'), 'r\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'remote add'])
    const base2 = tgit(repo, ['merge-base', 'del-local', 'del-remote'])
    const goodTree2 = execFileSync(
      'git',
      ['merge-tree', '--write-tree', 'del-local', 'del-remote'],
      {
        encoding: 'utf8',
        cwd: repo,
        windowsHide: true,
      },
    )
      .trim()
      .split('\n')[0]
      .trim()
    const resurrected = mktree(
      repo,
      lsTreeLines(goodTree2, repo).concat(
        lsTreeLines(base2, repo).filter((ln) => ln.endsWith('\tkeep.txt')),
      ),
    )
    const v3 = assertNoSilentRevert({
      base: base2,
      local: 'del-local',
      remote: 'del-remote',
      mergedTree: resurrected,
      cwd: repo,
    })
    ok(
      '用例 3:单边删除被复活时拦截(期望缺失)',
      v3.length === 1 && v3[0].path === 'keep.txt' && v3[0].expected === null,
      JSON.stringify(v3).slice(0, 160),
    )
    // 用例 4:双边同改互异 → 守门跳过(冲突归 merge-tree 管)
    const bothMaps = {
      base: new Map([['f', '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]),
      local: new Map([['f', '100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']]),
      remote: new Map([['f', '100644 cccccccccccccccccccccccccccccccccccccccc']]),
      merged: new Map([['f', '100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']]),
    }
    ok(
      '用例 4:双边互异跳过(零违反)',
      verifySingleSided(bothMaps.base, bothMaps.local, bothMaps.remote, bothMaps.merged).length ===
        0,
    )
    // 用例 5:纯 mode 变更(mode 相同 blob 不同 entry)被拦截
    const modeMaps = {
      base: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
      local: new Map([['run', '100755 dddddddddddddddddddddddddddddddddddddddd']]),
      remote: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
      merged: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
    }
    const v5 = verifySingleSided(modeMaps.base, modeMaps.local, modeMaps.remote, modeMaps.merged)
    ok('用例 5:纯 mode 回退被拦截', v5.length === 1 && v5[0].side === 'local')
  } catch (e) {
    console.log(`❌ 自检异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    console.log(`   临时仓库保留在 ${tmp}(供排查,下次自检会清掉)`)
    return false
  }
  const pass = results.every(Boolean)
  console.log(pass ? `\nself-test 全通过(${results.length} 例)` : `\nself-test 失败`)
  if (pass && tmp) rmSync(tmp, { recursive: true, force: true })
  return pass
}

// ─── 主流程(§22d:仅 direct-run 执行,被 import 时零副作用) ──
function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const getOpt = (name, dflt) => {
    const i = argv.indexOf(name)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
  }
  const branch = getOpt('--branch', 'main')
  const maxRounds = Number(getOpt('--rounds', 3))
  const dryRun = argv.includes('--dry-run')

  const repoRoot = git(['rev-parse', '--show-toplevel'], { allowFail: true })
  if (!repoRoot) {
    log(C.red, '❌ 不在 git 仓库中')
    process.exit(2)
  }

  // 2026-09-19:收敛前清理 stale 锁(根治 index.lock 卡死)。
  // 收敛器做 fetch/merge-tree/commit-tree/update-ref 等写操作,stale index.lock 会全挂。
  try {
    execFileSync('node', ['scripts/git-lock.mjs', 'clean'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: repoRoot,
    })
  } catch {
    /* 清理失败不阻塞收敛 */
  }

  /**
   * 收敛成功后顺手对齐工作区幻影漂移(2026-09-23 立)。
   * 本器走 merge-tree/commit-tree/update-ref,只推进 HEAD 与 index、**从不 checkout**(§12d
   * "零触碰他人未提交文件"),于是每收敛一次,工作区就多一批落后文件 —— 实测本仓曾累计
   * 503 个文件落后 486 个提交,任何会话 `git add <file>` 都会把别人的改动静默回滚。
   * 对齐判据在 scripts/heal-worktree-tracked.mjs:索引==HEAD 且 工作区内容==该路径某祖先版本
   * 才动,任一不成立即放过 ⇒ 会话的真实未提交改动与有暂存的路径都不被覆盖。
   * 失败只记日志,绝不影响收敛结论(推送已成功)。
   */
  function alignWorktreeAfterHeadMove() {
    try {
      const out = execFileSync(
        process.execPath,
        ['scripts/heal-worktree-tracked.mjs', '--align-drift', '--json'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, cwd: repoRoot },
      )
        .trim()
        .split('\n')
        .pop()
      const r = JSON.parse(out || '{}')
      if (r.aligned) {
        log(C.dim, `  🧹 工作区幻影漂移已对齐 ${r.aligned} 个文件(HEAD 前进未 checkout 的后遗症)`)
      }
    } catch (e) {
      log(
        C.yellow,
        '  工作区漂移对齐未完成(不影响收敛结论): ' + String((e && e.message) || e).slice(0, 140),
      )
    }
  }

  for (let round = 1; round <= maxRounds; round++) {
    log(C.dim, `── 第 ${round}/${maxRounds} 轮 ──`)
    git(['fetch', 'origin', branch])
    const remoteHead = git(['rev-parse', `origin/${branch}`])
    const localHead = git(['rev-parse', 'HEAD'])

    if (remoteHead === localHead) {
      log(C.green, `✅ 已收敛:本地 === 远端(${remoteHead.slice(0, 11)})`)
      process.exit(0)
    }
    if (isAncestor(localHead, remoteHead)) {
      // 远端已包含本地 → 并发期"被远端包含即为完成"
      log(C.green, `✅ 本地提交已被远端包含(${localHead.slice(0, 11)}),按并发纪律视为完成,不推送`)
      process.exit(0)
    }
    if (isAncestor(remoteHead, localHead)) {
      // 本地纯领先(可 fast-forward):直接 guard 推送,禁止 merge-tree——
      // 否则会造出冗余合并提交(历史噪音 + 新 headSha 使 push-gate 内容缓存失效)。
      log(C.yellow, `本地领先远端(FF 可达),跳过合并直接推送(${localHead.slice(0, 11)})`)
      if (dryRun) {
        log(C.dim, '  --dry-run:到此为止,不推送')
        process.exit(0)
      }
    } else {
      log(
        C.yellow,
        `分叉:本地 ${localHead.slice(0, 11)} / 远端 ${remoteHead.slice(0, 11)} → 索引层合并(不触碰工作区)`,
      )
      if (dryRun) {
        log(C.dim, '  --dry-run:到此为止,不合并不推送')
        process.exit(0)
      }
      // 输入新鲜度:合并且只用刚解析的 SHA,不用 ref 名 —— fetch→merge 窗口内若有并发
      // 推进了本地/远端引用,用旧 ref 名会合出"过期输入"的正确合并(静默丢变更)。
      const freshLocal = git(['rev-parse', 'HEAD'])
      const freshRemote = git(['rev-parse', `origin/${branch}`])
      if (freshLocal !== localHead || freshRemote !== remoteHead) {
        log(C.yellow, '  本轮内引用已前移,重读输入后转下一轮(不合并不推送)')
        continue
      }
      const mergeBase = git(['merge-base', freshLocal, freshRemote])
      // 索引层合并树(worktree-preserving):冲突时 merge-tree 输出含冲突信息,tree 为 null 段
      let tree
      try {
        const out = execFileSync('git', ['merge-tree', '--write-tree', freshLocal, freshRemote], {
          encoding: 'utf8',
          windowsHide: true,
        })
        tree = out.trim().split('\n')[0].trim()
        if (!/^[0-9a-f]{40}$/.test(tree)) throw new Error(out)
      } catch (e) {
        log(C.red, `❌ 合并冲突或 merge-tree 失败,需人工介入:\n${e.stdout ?? e.message}`)
        process.exit(1)
      }
      log(C.dim, `  合并树 ${tree.slice(0, 11)}(无冲突)`)
      // 单边变更保持守门(fail-closed):任一单边变更丢失即拒绝推进,绝不 update-ref/推送。
      const violations = assertNoSilentRevert({
        base: mergeBase,
        local: freshLocal,
        remote: freshRemote,
        mergedTree: tree,
        cwd: repoRoot,
      })
      if (violations.length > 0) {
        log(C.red, `❌ 合并树静默回退 ${violations.length} 处,拒绝推进(fail-closed):`)
        for (const v of violations.slice(0, 20)) {
          log(
            C.red,
            `   ${v.side === 'local' ? '本地' : '远端'}独改 ${v.path} 期望 ${v.expected ?? '(删除)'} 实得 ${v.actual ?? '(删除)'}`,
          )
        }
        process.exit(1)
      }

      const mergeMsg = `Merge origin/${branch} (worktree-preserving sync via git-sync-converge) round${round}`
      const mergeSha = git([
        'commit-tree',
        tree,
        '-p',
        freshLocal,
        '-p',
        freshRemote,
        '-m',
        mergeMsg,
      ])
      // CAS 更新引用:only-if-HEAD 未动。被并发推进则本轮作废转下一轮,
      // 绝不覆盖他人刚落地的本地提交(覆盖=丢 commit,见 AGENTS.md §22)。
      const cas = git(['update-ref', `refs/heads/${branch}`, mergeSha, freshLocal], {
        allowFail: true,
      })
      if (cas === null) {
        log(C.yellow, '  本地 HEAD 被并发推进,本轮作废,转下一轮重来')
        continue
      }
      log(C.dim, `  合并提交 ${mergeSha.slice(0, 11)} 已推进本地 ${branch}`)
      // commit-tree 旁路**不跑钩子**,守门 71 的 post-commit 自愈因此永不触发。实测一枚收敛合并
      // 把并发会话已入库的登记行合掉且无人知晓(2026-09-22/23 两次),故在落合并提交后就地补跑一次
      // 自愈(只加不减;失败不阻断收敛,下一枚走钩子的提交仍会再兜一次)。
      try {
        const healOut = execFileSync(
          'node',
          ['scripts/check-plan-line-loss.mjs', '--heal', '--commit'],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            cwd: repoRoot,
          },
        )
        for (const l of healOut.split(/\r?\n/).filter((x) => x.includes('登记行'))) {
          log(C.yellow, `  ${l.trim()}`)
        }
      } catch (e) {
        log(
          C.yellow,
          `  ⚠️ 计划登记行自愈未完成(不阻断收敛):${String(e?.stderr ?? e?.message ?? e).slice(0, 160)}`,
        )
      }
    }

    // 官方通道推送(guard 异步化:命令秒回,推送在后台 worker 执行)
    execFileSync('node', ['scripts/git-push-guard.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: repoRoot,
    })

    // 等待后台推送落定再决策(2026-09-18 晚修复:此前立即查远端,推送还在 270s 门里
    // 未完成即误判"远端又前移",3 轮全空转)
    const myHead = git(['rev-parse', 'HEAD'])
    const result = waitForPushState(myHead)
    log(C.dim, `  后台推送结果: ${result}`)
    if (result === 'done') {
      log(C.green, `✅ 推送收敛成功:${myHead.slice(0, 11)}`)
      alignWorktreeAfterHeadMove()
      process.exit(0)
    }
    if (result === 'superseded') {
      log(C.yellow, '  推送状态已被更新的 HEAD 覆盖(并发会话推进了本地),继续下一轮')
    }

    const nowRemote = git(['rev-parse', `origin/${branch}`])
    if (nowRemote === git(['rev-parse', 'HEAD'])) {
      log(C.green, `✅ 推送收敛成功:${nowRemote.slice(0, 11)}`)
      alignWorktreeAfterHeadMove()
      process.exit(0)
    }
    log(C.yellow, `  第 ${round} 轮未落地(远端 ${nowRemote.slice(0, 11)}),继续下一轮`)
  }

  log(C.red, `❌ ${maxRounds} 轮未收敛,稍后重跑: node scripts/git-sync-converge.mjs`)
  const lastState = (() => {
    try {
      return JSON.parse(readFileSync(resolve(process.cwd(), '.workbuddy/push-state.json'), 'utf8'))
    } catch {
      return null
    }
  })()
  if (lastState?.status === 'failed') {
    // 2026-09-24 实测:这句话原来无论何因都写"并发推力过大",而真实原因是**远端拒收推送**
    // (push protection 拦凭据形状)—— 于是每个人都去查并发/网络,没人去看拒绝原文。
    log(
      C.red,
      '   上一轮推送结论是 failed ⇒ 多半不是并发,而是**推送被远端拒收**。看归类与卡门 commit:',
    )
    log(C.red, '     GUARD_ASYNC=0 node scripts/git-push-guard.mjs')
  } else {
    log(C.yellow, '   (并发推力过大:远端在每次推送前又被推进;重跑即可)')
  }
  process.exit(1)
} // ← function main() 结束(§22d:以下 export/守卫在 import 时执行,main 体不执行)

export const __test__ = {
  parseLsTreeZ,
  verifySingleSided,
  collectTreeEntries,
  assertNoSilentRevert,
  selfTest,
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠