#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * main 引用棘轮 —— 钩子背后的编排器。
 *
 * ═══ 设计一页（改之前先读完；所有取舍都写在这里，别只在 commit message 里说）═══
 *
 * 【挂载点】`.husky/reference-transaction` 的 `prepared` 阶段：此时拿到 old/new OID，
 * 事务还没落盘，`exit 1` 就能让 git 放弃整笔 ref 更新。
 *
 * 【为什么不能判 `--staged`/工作树】prepared 阶段 HEAD 仍是**旧提交**、工作树仍是**旧树**
 * （converge 是 merge-tree → commit-tree → update-ref，工作树对齐在落地之后）。
 * 读盘面/索引 = 判旧字节。唯一正确的面是 **new OID 的对象面**（见 ref-ratchet-adapters.mjs）。
 *
 * 【棘轮而不是全量】main 存量红（47p 118 个水印、193 offender、90/217/298 …）如果全量判，
 * 一次 update-ref 就把 main 锁死。所以：只跑"触发面命中本次 changedPaths"的门，
 * 只拦"台账里没有的新红"，存量红只记账。键 = (gate, path)；
 * `status=red` 才抑制阻断，`status=undetermined` **不抑制**（超时一次不得变成永久豁免）。
 *
 * 【失败模式】阻断只有一种：blocking 门在 changedPaths 判出台账里没有的红。
 * 超时 / 读不到 blob / 门不支持对象面 / 钩子自身异常 ⇒ **放行 + undetermined 留痕**。
 * 理由：main 是唯一集成总线，误拦一次会让所有并行会话的落地停摆；代价是一枚潜在红
 * 晚一轮被发现，而它必然在台账里留痕（--verify 与统计器都能点名）。**装死不行**：
 * 每次执行写 heartbeat，异常另写 hook-error，由 `check-ref-ratchet-liveness.mjs` 判红。
 *
 * 【已知限制】台账在 `<git-common-dir>/ihui-ref-ratchet/`，不入库；**删台账 = 棘轮归零**。
 * seed 会同时写 anchor.json，`--verify` 一旦发现"有锚点、台账没了"就报错，不允许安静归零。
 *
 * 【同一份账】47p 的 HEAD 面档（pre-commit/CI 那条）与这里的引用棘轮**共用同一个台账文件、
 * 同一个 gateId `47p`**；193 同理。`--seed` 全量补齐也只往这一份写 —— 不建第二套账，
 * 否则"同一个红在两本账里两副状态"就是下一次自相矛盾的源头。
 *
 * 【old=0 的坑】git 2.56 实测：不显式给 old 的 `update-ref <ref> <new>` / `branch -f`，
 * 在 prepared 钩子里报 old=0000（哪怕 ref 已存在），而生产通道正是 commit-tree + update-ref。
 * 所以 old=0 时先用 `rev-parse --verify <ref>` 取事务前真实值（prepared 阶段尚未落盘）；
 * 只有确实新建引用才按 new-ref 放行。
 *
 * 【预算】每门 8s、整笔 20s；超预算的门记 undetermined，不阻断。
 *
 * 【性能门槛】典型 main 落定 median ≤5s、p95 ≤15s；任何一次 >30s 视为设计不成立，
 * 退化为"只跑 47p/193"（本批默认就是这两道；90/217/298 仍由各自既有通道负责）。
 */

import { performance } from 'node:perf_hooks'

import {
  DEFAULT_REF,
  RECURSION_ENV,
  REF_OVERRIDE_ENV,
  classifyFindings,
  ensureAnchor,
  ensureStateDir,
  git,
  putLedger,
  readLedger,
  stateDir,
  writeHeartbeat,
  writeHookError,
} from './lib/ref-ratchet-state.mjs'
import { adaptStdioDiscipline, adaptWatermark } from './lib/ref-ratchet-adapters.mjs'

// 预算默认按设计口径（单门 8s / 整笔 20s）。环境变量只给**测试与压测隔离**用：
// 负载机器上整套测试会互相争 CPU，门可能"跑完了但慢"，预算会把判据结果折成 undetermined
// 而测不到判据本身；生产不设置这两个变量，口径不变。
const PER_GATE_BUDGET_MS = Number(process.env.IHUI_REF_RATCHET_GATE_BUDGET_MS) || 8_000
const TOTAL_BUDGET_MS = Number(process.env.IHUI_REF_RATCHET_TOTAL_BUDGET_MS) || 20_000

const argv = process.argv.slice(2)
const arg = (name, def = null) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def
}
const flag = (name) => argv.includes(name)

const OID_RE = /^[0-9a-f]{40}$/
const ZERO = '0'.repeat(40)

function out(line) {
  process.stdout.write(`${line}\n`)
}

function resolveRoot() {
  const explicit = arg('--root')
  if (explicit) return explicit
  const top = git(process.cwd(), ['rev-parse', '--show-toplevel'], { allowFail: true })
  return String(top ?? process.cwd()).trim()
}

function main() {
  // 防递归第一道：钩子内可能跑门，门里可能再写 ref。第二道在钩子 sh 里。
  if (process.env[RECURSION_ENV] === '1') return 0

  const oldOid = arg('--old')
  const newOid = arg('--new')
  const ref = arg('--ref') || process.env[REF_OVERRIDE_ENV] || DEFAULT_REF
  const root = resolveRoot()
  const noWrite = flag('--no-write')
  const started = performance.now()

  // 只判 main；删除分支（new=0）与非 40 位 OID 一律放行。
  if (ref !== DEFAULT_REF && ref !== process.env[REF_OVERRIDE_ENV]) return 0
  if (!OID_RE.test(String(oldOid ?? '')) || !OID_RE.test(String(newOid ?? ''))) return 0
  if (newOid === ZERO) return 0

  // git 2.56 实测：**不显式给 old 值**的更新（`git update-ref <ref> <new>`、`git branch -f`）
  // 在 prepared 钩子里报 old=0000，哪怕该 ref 早已存在。生产通道恰是 commit-tree + update-ref，
  // 不补这一步就会把 main 的每次更新误判成"新建引用"而整笔放行 —— 棘轮空转。
  // prepared 阶段 ref 尚未落盘，此时 `rev-parse` 读到的就是事务前的真实值。
  let baseOid = oldOid
  let oldSource = 'stdin'
  if (baseOid === ZERO) {
    const cur = String(git(root, ['rev-parse', '--verify', '--quiet', ref], { allowFail: true }) ?? '').trim()
    if (OID_RE.test(cur) && cur !== ZERO) {
      baseOid = cur
      oldSource = 'ref'
    }
  }

  // --no-write 是体检/压测模式：连状态目录都不该创建（否则"只读演练"会在真实仓 .git 里留痕）。
  const dir = noWrite ? stateDir(root) : ensureStateDir(stateDir(root))
  const gateRuns = []
  let changedPaths = []
  const blockedAll = []

  try {
    if (baseOid === ZERO) {
      // 新引用（old=0）：没有"本次增量"可言。main 的存量全量由 `--seed --at <sha>` 离线登记，
      // 钩子只判增量；这里放行并留心跳，避免把"创建引用"误读成一整树新增红。
      if (!noWrite) {
        writeHeartbeat(dir, {
          old: oldOid,
          new: newOid,
          ref,
          changed: 0,
          gates: [],
          result: 'pass',
          note: 'new-ref',
          durationMs: Math.round(performance.now() - started),
        })
      }
      out('[ref-ratchet] 新建引用（old=0）⇒ 放行（存量由 --seed 负责）')
      return 0
    }
    const diff = git(root, ['diff', '--name-only', '--diff-filter=ACMRTUXB', baseOid, newOid])
    changedPaths = String(diff)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!changedPaths.length) {
      if (!noWrite) writeHeartbeat(dir, { old: baseOid, oldSource, new: newOid, ref, changed: 0, gates: [], result: 'pass', durationMs: Math.round(performance.now() - started) })
      out('[ref-ratchet] 本次事务无变更路径 ⇒ 放行')
      return 0
    }

    const ledger = readLedger(dir)
    if (ledger.errors.length) {
      // 台账坏了不等于"本次是新增红"：放行但必须留痕，否则坏账会静默把棘轮变成空转。
      if (!noWrite) {
        writeHookError(dir, {
          kind: 'ledger-corrupt',
          message: ledger.errors[0],
          input: { old: oldOid, new: newOid, ref },
        })
        writeHeartbeat(dir, {
          old: oldOid,
          new: newOid,
          ref,
          changed: changedPaths.length,
          gates: [],
          result: 'hook-error',
          durationMs: Math.round(performance.now() - started),
          error: `ledger-corrupt: ${ledger.errors[0]}`,
        })
      }
      out('[ref-ratchet] 台账损坏 ⇒ 本次放行并留 hook-error（先跑 ref-ratchet-ledger --verify）')
      return 0
    }

    // ── 门适配：命中触发面的门才跑。对象面可复用的目前只有 47p / 193；
    //    90/217/298 等仍归各自既有通道，本钩子不为它们新增门号、也不冒充通过。
    const tasks = []
    tasks.push({
      id: '47p',
      run: () => adaptWatermark({ root, newOid, paths: changedPaths }),
    })
    const scriptPaths = changedPaths.filter(
      (p) => p.startsWith('scripts/') && (p.endsWith('.mjs') || p.endsWith('.js') || p.endsWith('.sh')),
    )
    if (scriptPaths.length) {
      tasks.push({
        id: '193',
        run: () => adaptStdioDiscipline({ root, newOid, paths: scriptPaths }),
      })
    }

    for (const task of tasks) {
      if (performance.now() - started > TOTAL_BUDGET_MS) {
        gateRuns.push({
          id: task.id,
          ran: false,
          blocked: 0,
          recorded: 0,
          undetermined: 1,
          ms: 0,
          note: `超出整笔预算 ${TOTAL_BUDGET_MS}ms`,
        })
        if (!noWrite) {
          putLedger(dir, [
            { gate: task.id, path: '*', blob: null, status: 'undetermined', missing: 'total-budget-exceeded' },
          ])
          ensureAnchor(dir, baseOid)
        }
        continue
      }
      const t0 = performance.now()
      let res
      try {
        res = task.run()
      } catch (e) {
        res = {
          findings: [],
          undetermined: [{ reason: '适配器抛错', missing: String(e?.message ?? e).split('\n')[0] }],
        }
      }
      const ms = Math.round(performance.now() - t0)
      if (ms > PER_GATE_BUDGET_MS) {
        // 门实际跑完了（结果可能有效），但超预算 ⇒ 按口径记 undetermined，不阻断。
        res = { findings: [], undetermined: [{ reason: '超出单门预算', missing: `${ms}ms > ${PER_GATE_BUDGET_MS}ms` }] }
      }
      const { blocked, recorded } = classifyFindings({
        ledger: readLedger(dir).entries,
        gate: task.id,
        findings: res.findings,
        changedPaths,
      })
      blockedAll.push(...blocked.map((b) => ({ ...b, gate: task.id })))

      if (!noWrite) {
        const rows = []
        for (const f of [...blocked, ...recorded]) {
          const prior = readLedger(dir).entries.get(`${task.id}\u0000${f.path}`)
          rows.push({
            gate: task.id,
            path: f.path,
            blob: f.blob ?? null,
            status: 'red',
            firstSeen: prior?.firstSeen,
            lastSeen: new Date().toISOString(),
          })
        }
        for (const u of res.undetermined) {
          rows.push({
            gate: task.id,
            path: u.path ?? '*',
            blob: null,
            status: 'undetermined',
            missing: `${u.reason}: ${u.missing}`,
            lastSeen: new Date().toISOString(),
          })
        }
        putLedger(dir, rows)
        ensureAnchor(dir, baseOid)
      }
      gateRuns.push({
        id: task.id,
        ran: true,
        blocked: blocked.length,
        recorded: recorded.length,
        undetermined: res.undetermined.length,
        ms,
      })
    }

    if (!noWrite) {
      writeHeartbeat(dir, {
        old: baseOid,
        oldSource,
        new: newOid,
        ref,
        changed: changedPaths.length,
        gates: gateRuns,
        result: blockedAll.length ? 'blocked' : 'pass',
        durationMs: Math.round(performance.now() - started),
      })
    }

    if (blockedAll.length) {
      const lines = blockedAll.map((b) => `  · [${b.gate}] ${b.path} (${b.cause})`)
      out(
        `\n🚫 ref-ratchet: 本次 main 落定引入 ${blockedAll.length} 处**新增红**，拒绝 ref 更新：\n` +
          lines.join('\n') +
          '\n  修法：修掉这些路径后重新落定；存量红已记台账，不会二次拦截。\n' +
          '  台账：<git-common-dir>/ihui-ref-ratchet/ledger.jsonl（--verify 可体检）',
      )
      return 1
    }
    out(
      `[ref-ratchet] 通过：changed=${changedPaths.length} ` +
        `gates=${gateRuns.map((g) => `${g.id}(${g.ms}ms)`).join(',')} ` +
        `undetermined=${gateRuns.reduce((n, g) => n + g.undetermined, 0)}`,
    )
    return 0
  } catch (e) {
    // 钩子自身异常：放行可以，装死不行 —— 单独落 hook-error，由 liveness 检查报红。
    try {
      if (!noWrite) {
        writeHookError(dir, {
          kind: 'hook-exception',
          message: String(e?.message ?? e),
          stack: String(e?.stack ?? ''),
          input: { old: oldOid, new: newOid, ref, changed: changedPaths.length },
        })
        writeHeartbeat(dir, {
          old: oldOid,
          new: newOid,
          ref,
          changed: changedPaths.length,
          gates: gateRuns,
          result: 'hook-error',
          durationMs: Math.round(performance.now() - started),
          error: String(e?.message ?? e).split('\n')[0],
        })
      }
    } catch {
      /* 连留痕都失败时只能放行：绝不把 main 锁死 */
    }
    out(`[ref-ratchet] 钩子异常 ⇒ 放行并留 hook-error：${String(e?.message ?? e).split('\n')[0]}`)
    return 0
  }
}

process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
