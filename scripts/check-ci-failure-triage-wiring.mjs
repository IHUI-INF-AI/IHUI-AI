#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(本文件自述):CI 失败自述步骤的**覆盖面 + 自洽性**对账。
//
// 立因(台账 G-591 第③④⑤件 + 本轮现读更正):G-591 原文写"这三条工作流没有自述步骤",
// 现读已过期(`openapi-check.yml` 2 个 / `knip.yml` 2 个 / `ci.yml` 3 个 / `ci-monorepo.yml` 16 个),
// 但"装了"从来不等于"报得出东西":`scripts/ci-failure-triage.sh` 只认 `TRIAGE_IDS` 里点名的 id,
// 于是三条路径都会让自述**静默失明**而没有任何一道门喊 ——
//   ① 步骤加了 `id:` 却没进 `TRIAGE_IDS` ⇒ 它失败时脚本走"没有已知 id 报 failure"分支,只 dump 不点名;
//   ② 步骤 id 被改名 ⇒ `O_<旧大写名>` 取不到值,该步从此在自述里不存在;
//   ③ `TRIAGE_IDS` 里留着已删除的 id ⇒ 同上,且顺序错位会点错步骤。
// 这三型正是"红了但说不出为什么"的成因,而本仓对它的历史处置是"再手抄一份参数" —— 治不了。
//
// 判据(全部只判"能不能报出来",不判绿灯):
//   W1 覆盖面:每个 job 必须有一个调用 `scripts/ci-failure-triage.sh` 的步骤;
//     例外走具名台账 `scripts/data/ci-triage-exempt-jobs.json`(必须带 reason,且被审面不再命中 ⇒ 清单腐烂判红,§0.7)。
//   W2 自洽:job 内**每一个**带 id 的步骤都必须在 `TRIAGE_IDS` 里;`TRIAGE_IDS` 每条都必须真在该 job 的
//     id 集合里;每个入选 id 必须有对应的 `O_<大写、连字符转下划线>` env 键;不得有指向不存在 id 的孤儿 `O_` 键。
//   W3 取材:`TRIAGE_WORKFLOW_FILE` 必须逐字等于本工作流文件自身的仓库相对路径(重跑映射 = 该文件本身)。
//   W4 只报数(本轮没有判据、既不判红也不记通过):无 `id:` 的步骤条数 —— 自述结构上看不见它们。
//
// 取材面纪律(AGENTS §0.4 / 守门 118):全量档判 HEAD blob,`--staged` 判索引 blob,两面同给 ⇒ exit 2;
//   `--worktree` 仅人工逃生舱。取不到被审面 ⇒ exit 2 写「未判定」,不记绿也不冒红(§0.3)。
//
// 用法:
//   node scripts/check-ci-failure-triage-wiring.mjs            # 判 HEAD 面
//   node scripts/check-ci-failure-triage-wiring.mjs --staged   # 判索引面
//   node scripts/check-ci-failure-triage-wiring.mjs --worktree # 人工:判磁盘
//   node scripts/check-ci-failure-triage-wiring.mjs --self-test
//   node scripts/check-ci-failure-triage-wiring.mjs --json
//
// 定级与分档(§12e/§0.5,数字一律现读、本文不钉例数):W2/W3/豁免腐烂 = blocking(落地当刻 HEAD 面现读零缺口);
//   W1 覆盖面(存量分布在多份发布/部署工作流,归各工作流持有人)⇒ 全量档**只报数并逐条点名**,
//   `--staged` 走**差值棘轮**(锚点 = 该工作流 HEAD 面自身的 W1 数)只拦新增。把存量直接判红就是造恒红门。
//   跳过变量以 runner 注册条目现值为准。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

// §15:根由脚本自身位置推导,不用 process.cwd()(共享工作区的 cwd 不可靠)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const WORKFLOW_DIR = '.github/workflows'
const TRIAGE_SCRIPT = 'scripts/ci-failure-triage.sh'
const EXEMPT_LEDGER_REL = 'scripts/data/ci-triage-exempt-jobs.json'

/** id → 脚本实际读的 env 键名(与 ci-failure-triage.sh 的 `${ID^^}` + `//-/_` 逐字同形) */
export function outcomeEnvKeyFor(id) {
  return `O_${id.toUpperCase().replace(/-/g, '_')}`
}

/**
 * 行级解析:jobs → steps(顺序、id、uses/run 形态)+ triage 步骤注入的参数。
 * 不做通用 YAML(仓里没有 yaml 依赖,而本判据只需要这四件事)。
 */
export function parseWorkflow(rel, text) {
  const lines = String(text).split(/\r?\n/)
  const jobs = []
  let inJobs = false
  let job = null
  let step = null
  let triage = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (/^jobs:\s*$/.test(raw)) {
      inJobs = true
      continue
    }
    if (!inJobs) continue
    if (/^[a-zA-Z]/.test(raw)) {
      // 顶格新键 = jobs 段结束
      break
    }

    let m
    if ((m = raw.match(/^  ([A-Za-z0-9_-]+):\s*$/))) {
      job = { name: m[1], steps: [], triages: [] }
      jobs.push(job)
      step = null
      triage = null
      continue
    }
    if (!job) continue
    if ((m = raw.match(/^      -\s*(.*)$/))) {
      step = null
      triage = null
      const rest = m[1].trim()
      const named = rest.match(/^name:\s*(.*)$/)
      const used = rest.match(/^uses:\s*(.*)$/)
      step = { name: named ? named[1].replace(/^['"]|['"]$/g, '') : null, uses: used ? used[1] : null, id: null, run: null, env: {}, line: i + 1 }
      job.steps.push(step)
      continue
    }
    if (!step) continue
    if ((m = raw.match(/^ +id:\s*(\S+)\s*$/))) {
      step.id = m[1].replace(/^['"]|['"]$/g, '')
      continue
    }
    if ((m = raw.match(/^ +run:\s*(.*)$/))) {
      step.run = m[1].trim() || '|'
      continue
    }
    if ((m = raw.match(/^ +uses:\s*(\S+)\s*$/))) {
      step.uses = m[1].replace(/^['"]|['"]$/g, '')
      continue
    }
    if ((m = raw.match(/^ +env:\s*$/))) {
      // 收集紧随其后的 KEY: value 行(只在当前步骤块内)
      for (let j = i + 1; j < lines.length; j++) {
        const e = lines[j].match(/^ +([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)
        if (!e) break
        step.env[e[1]] = e[2].trim().replace(/^['"]|['"]$/g, '')
      }
      continue
    }
  }

  for (const j of jobs) {
    for (const s of j.steps) {
      // triage 步骤的判据:run 提到共享脚本(单行形态),或该步骤 name 里点名 triage 且 run 为块标量
      if (s.run && s.run.includes(TRIAGE_SCRIPT)) j.triages.push(s)
    }
  }
  return { rel, jobs }
}

/** 单 job 裁定:返回违规字符串数组(空 = 该 job 自洽且已装自述) */
export function judgeJob(wfRel, job, exemptMap) {
  const out = []
  const exempt = exemptMap.get(`${wfRel}#${job.name}`)
  if (exempt) return out

  const triageSet = new Set(job.triages)
  // 自述步骤自己不要求进 TRIAGE_SCRIPT 的点名清单:它恒 exit 0(见 ci-failure-triage.sh 头注"本脚本恒 exit 0"),
  // 要求它被"分诊"是循环要求;但它仍是有 id 的步骤,列在这里只为了让 W2 跳过它。
  const idSteps = job.steps.filter((s) => s.id)
  const reportableIds = idSteps.filter((s) => !triageSet.has(s))
  if (job.triages.length === 0) {
    if (reportableIds.length === 0) {
      // 整个作业一个带 id 的步骤都没有 ⇒ 自述脚本无从点名(它只认 TRIAGE_IDS),在这一格判红 = 恒红门(§12e)。
      // 这一格由 W4 只报数,并逐条写清"缺的是 id 而不是自述步骤",免得下一位照单补一个空转的 triage。
      return out
    }
    out.push(`W1 覆盖面:作业 ${wfRel}#${job.name} 有 ${reportableIds.length} 个带 id 的步骤(${reportableIds.map((s) => s.id).join(' / ')})却没装调用 ${TRIAGE_SCRIPT} 的失败自述步骤 ⇒ 红了报不出是哪一条命令`)
    return out
  }

  const t = job.triages[job.triages.length - 1]
  const ids = (t.env.TRIAGE_IDS || '').split(/\s+/).filter(Boolean)
  const stepIds = new Set(idSteps.map((s) => s.id))

  if (!t.env.TRIAGE_WORKFLOW_FILE) {
    out.push(`W3 取材:作业 ${wfRel}#${job.name} 的自述步骤没注入 TRIAGE_WORKFLOW_FILE`)
  } else if (t.env.TRIAGE_WORKFLOW_FILE !== wfRel) {
    out.push(`W3 取材:作业 ${wfRel}#${job.name} 的 TRIAGE_WORKFLOW_FILE=${t.env.TRIAGE_WORKFLOW_FILE} 不是本文件自身(重跑映射会去读另一份工作流)`)
  }

  for (const s of reportableIds) {
    if (!ids.includes(s.id)) {
      out.push(`W2 失明:作业 ${wfRel}#${job.name} 的步骤 id \`${s.id}\`(第 ${s.line} 行)不在 TRIAGE_IDS 里 ⇒ 它失败时自述只 dump 不点名`)
    }
  }
  for (const id of ids) {
    if (!stepIds.has(id)) {
      out.push(`W2 错位:TRIAGE_IDS 点名了 \`${id}\`,但作业 ${wfRel}#${job.name} 里没有这个步骤 id(已改名或已删除)`)
      continue
    }
    const key = outcomeEnvKeyFor(id)
    if (!(key in t.env)) {
      out.push(`W2 失明:作业 ${wfRel}#${job.name} 缺 ${key}(TRIAGE_IDS 含 ${id} 却没注入 outcome ⇒ 该步在自述里恒不存在)`)
    }
  }
  for (const k of Object.keys(t.env)) {
    if (!k.startsWith('O_') || k === 'TRIAGE_IDS') continue
    const id = ids.find((x) => outcomeEnvKeyFor(x) === k)
    if (!id) out.push(`W2 孤儿:作业 ${wfRel}#${job.name} 注入了 ${k} 但没有任何 TRIAGE_IDS 成员映射到它`)
    else if (!stepIds.has(id)) out.push(`W2 错位:作业 ${wfRel}#${job.name} 的 ${k} 指向不存在的步骤 id \`${id}\``)
  }

  const multiLine = job.triages.filter((x) => x.run === '|')
  if (multiLine.length > 0) {
    out.push(`W1 形态:作业 ${wfRel}#${job.name} 的自述步骤用块标量 run: ⇒ 共享脚本无法被单行识别(请把命令写成 bash ${TRIAGE_SCRIPT} 单行)`)
  }
  return out
}

/** 无 id 步骤数(W4 只报数,不判红也不记通过) */
export function countIdlessSteps(parsed) {
  let n = 0
  for (const j of parsed.jobs) n += j.steps.filter((s) => !s.id && (s.run || s.uses)).length
  return n
}

/** 只报数量:装不了自述的作业数(整作业无带 id 步骤 ⇒ 缺的是 id 而不是 triage 步骤) */
export function countUnnameableJobs(parsed) {
  let n = 0
  for (const j of parsed.jobs) {
    const triageSet = new Set(j.triages)
    const reportable = j.steps.filter((s) => s.id && !triageSet.has(s))
    if (j.triages.length === 0 && reportable.length === 0) n++
  }
  return n
}

export function readExemptLedger(faceRead) {
  const raw = faceRead(EXEMPT_LEDGER_REL)
  if (raw === null) return { map: new Map(), hit: new Set(), missing: false }
  let list
  try {
    list = JSON.parse(raw)
  } catch (e) {
    return { map: new Map(), hit: new Set(), missing: false, bad: `台账 JSON 解析失败:${e.message}` }
  }
  const map = new Map()
  for (const it of Array.isArray(list.items) ? list.items : []) {
    if (!it || !it.job || !it.reason) continue
    map.set(it.job, it.reason)
  }
  return { map, hit: new Set() }
}

async function collectFace(root, mode) {
  const listCmd =
    mode === 'staged'
      ? ['ls-files', '--cached', `${WORKFLOW_DIR}/`]
      : mode === 'worktree'
        ? null
        : ['ls-tree', '-r', '--name-only', 'HEAD', '--', WORKFLOW_DIR]
  let names
  try {
    if (listCmd) {
      names = gitRaw(listCmd, root).split('\n').filter((l) => /\.ya?ml$/.test(l)).sort()
    } else {
      const { readdirSync, existsSync: ex } = await import('node:fs')
      const dir = `${root}/${WORKFLOW_DIR}`
      names = ex(dir) ? readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => `${WORKFLOW_DIR}/${f}`) : []
    }
  } catch (e) {
    return { ok: false, reason: `${WORKFLOW_DIR} 清单取不到(${mode} 面):${e?.message ?? e}` }
  }
  if (names.length === 0) {
    return { ok: false, reason: `${WORKFLOW_DIR} 在 ${mode} 面枚举到 0 个工作流(判不出"没有缺口",只判"没量到")` }
  }
  const files = []
  for (const p of names) {
    let text
    try {
      text = mode === 'worktree' ? readWorktreeFile(root, p) : gitRaw(['show', `${mode === 'staged' ? ':' : 'HEAD:'}${p}`], root)
    } catch (e) {
      return { ok: false, reason: `取不到被审面内容:${p}(${mode} 面)—— ${e?.message ?? e}` }
    }
    if (text === null || text === undefined) return { ok: false, reason: `取不到被审面内容:${p}(${mode} 面)` }
    files.push({ rel: p, text })
  }
  let ledgerRaw = null
  try {
    ledgerRaw = mode === 'worktree' ? readWorktreeFile(root, EXEMPT_LEDGER_REL) : gitRaw(['show', `${mode === 'staged' ? ':' : 'HEAD:'}${EXEMPT_LEDGER_REL}`], root)
  } catch {
    ledgerRaw = null
  }
  return { ok: true, kind: mode, files, ledgerRaw }
}

/** 单面裁定:分档返回 { hard:[W2/W3/腐烂…], w1ByFile:Map(rel→条数), counts:{...} } */
function judgeFace(files, exemptMap) {
  const hard = []
  const w1ByFile = new Map()
  let idless = 0
  let unnameable = 0
  let triageSteps = 0
  let jobs = 0
  for (const f of files) {
    const parsed = parseWorkflow(f.rel, f.text)
    idless += countIdlessSteps(parsed)
    unnameable += countUnnameableJobs(parsed)
    jobs += parsed.jobs.length
    let w1 = 0
    for (const j of parsed.jobs) {
      triageSteps += j.triages.length
      for (const v of judgeJob(f.rel, j, exemptMap)) {
        if (v.startsWith('W1')) w1++
        else hard.push(v)
      }
    }
    if (w1 > 0) w1ByFile.set(f.rel, w1)
    // 豁免腐烂(§0.7):登记过的作业在这一面不再命中 ⇒ 判红
    for (const k of exemptMap.keys()) {
      const [wf, jobName] = k.split('#')
      if (wf !== f.rel) continue
      if (!parsed.jobs.some((j) => j.name === jobName)) hard.push(`W1 腐烂:豁免台账登记的 ${k} 在这一面已不命中(§0.7 豁免会到期)`)
    }
  }
  return { hard, w1ByFile, counts: { files: files.length, jobs, idless, unnameable, triageSteps, exempts: exemptMap.size } }
}

/** HEAD 面的 W1 计数 = 差值棘轮锚点(§0.5:锚点是该文件 HEAD 自身的违规数) */
function headW1Counts(root, rels, exemptMap) {
  const out = new Map()
  for (const rel of rels) {
    let text
    try {
      text = gitRaw(['show', `HEAD:${rel}`], root)
    } catch {
      out.set(rel, null) // 取不到锚点 ⇒ 由调用方判"未判定",不得当成 0
      continue
    }
    const r = judgeFace([{ rel, text }], exemptMap)
    out.set(rel, r.w1ByFile.get(rel) ?? 0)
  }
  return out
}

/** W1 差值棘轮的决策单元(纯函数,便于自证):锚点取不到 ⇒ 未判定,绝不当成 0 判绿 */
export function ratchetVerdict(nowByFile, anchors) {
  const out = []
  for (const [rel, now] of nowByFile) {
    const base = anchors.get(rel)
    if (base === null || base === undefined) {
      out.push(`W1 棘轮未判定:${rel} 的 HEAD 面锚点取不到(不得当成 0 判绿)`)
    } else if (now > base) {
      out.push(`W1 新增:作业面 ${rel} 的覆盖面缺口由 HEAD 面 ${base} 涨到 ${now} —— 本次改动带进了没装自述的带 id 作业`)
    }
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const root = REPO_ROOT
  const mode = argv.includes('--worktree') ? 'worktree' : argv.includes('--staged') ? 'staged' : 'head'
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.log('❌ 未判定:--staged 与 --worktree 不得同用(两个判定面互斥)')
    return 2
  }
  if (argv.includes('--self-test')) return selfTestMain()

  let face
  try {
    face = await collectFace(root, mode)
  } catch (e) {
    console.log(`❌ 未判定:被审面取不到 —— ${e?.message ?? e}`)
    return 2
  }
  if (!face.ok) {
    console.log(`❌ 未判定:${face.reason}`)
    return 2
  }

  const exempt = readExemptLedger(() => face.ledgerRaw)
  if (exempt.bad) {
    console.log(`❌ ${exempt.bad}`)
    return 1
  }

  const r = judgeFace(face.files, exempt.map)
  const w1Total = [...r.w1ByFile.values()].reduce((a, b) => a + b, 0)

  // W1 分档:全量档 = 存量只报数(§12e:把 23 处覆盖面债变成每台提交的红灯,唯一结局是逼人跳门);
  // --staged = 差值棘轮,只拦"这一枚提交给某份工作流新添的覆盖面缺口"。
  const ratchet = mode === 'staged' ? ratchetVerdict(r.w1ByFile, headW1Counts(root, [...r.w1ByFile.keys()], exempt.map)) : []

  const hard = [...r.hard, ...ratchet]
  console.log(`📊 CI 失败自述对账 · 面=${face.kind} · 工作流 ${r.counts.files} 份 / 作业 ${r.counts.jobs} 个 · 自述步骤 ${r.counts.triageSteps} 个 · 具名豁免 ${r.counts.exempts} 条`)
  console.log(`   W1 覆盖面存量(全量档只报数;--staged 走差值棘轮只拦新增):${w1Total} 处,分布在 ${r.w1ByFile.size} 份工作流`)
  console.log(`   W4 只报数(既不判红也不记通过,§0.3):无 id 的步骤 ${r.counts.idless} 个(自述结构上看不见它们);整作业无带 id 步骤因而装不了自述的作业 ${r.counts.unnameable} 个(缺的是 id,不是 triage 步骤)`)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ face: face.kind, counts: { ...r.counts, w1Total, w1ByFile: Object.fromEntries(r.w1ByFile) }, hard }, null, 2))
  }
  if (hard.length === 0) {
    console.log('✅ 已装的自述步骤全部自洽(TRIAGE_IDS / O_ 与步骤 id 逐条对得上,取材指自己),无新增覆盖面缺口')
    return 0
  }
  console.log(`❌ 发现 ${hard.length} 处硬缺口:`)
  for (const v of hard.slice(0, 30)) console.log(`   ${v}`)
  if (hard.length > 30) console.log(`   …另 ${hard.length - 30} 处(逐条见 --json)`)
  console.log(`  修复出口:在该作业补/改 "Failure triage (public annotations)" 步骤(env.TRIAGE_IDS 与 O_* 逐条对齐、TRIAGE_WORKFLOW_FILE 写本文件;实现只有 ${TRIAGE_SCRIPT} 一份);确属例外再往 ${EXEMPT_LEDGER_REL} 具名登记并写 reason`)
  return 1
}

function selfTestMain() {
  const cases = []
  const eq = (name, got, want) => cases.push([name, JSON.stringify(got) === JSON.stringify(want), got, want])

  eq('envKey 普通', outcomeEnvKeyFor('lint'), 'O_LINT')
  eq('envKey 连字符转下划线', outcomeEnvKeyFor('build-types-deps'), 'O_BUILD_TYPES_DEPS')

  const good = [
    'jobs:', '  unit:', '    steps:', '      - name: Checkout', '        id: checkout', '        uses: actions/checkout@v4',
    '      - name: Test', '        id: test', '        run: pnpm test',
    '      - name: Failure triage (public annotations)', '        id: failure-triage', '        if: failure()', '        env:',
    '          TRIAGE_WORKFLOW_FILE: .github/workflows/x.yml', '          TRIAGE_IDS: checkout test',
    '          O_CHECKOUT: ${{ steps.checkout.outcome }}', '          O_TEST: ${{ steps.test.outcome }}',
    `        run: bash ${TRIAGE_SCRIPT}`, '',
  ].join('\n')
  const p = parseWorkflow('.github/workflows/x.yml', good)
  eq('解析:2 job?', p.jobs.length, 1)
  eq('解析:triage 命中', p.jobs[0].triages.length, 1)
  eq('正控:自洽 job 零违规', judgeJob('.github/workflows/x.yml', p.jobs[0], new Map()), [])

  // 反例一:步骤加了 id 却没进 TRIAGE_IDS(失明 ①)
  const blind = good.replace('TRIAGE_IDS: checkout test', 'TRIAGE_IDS: checkout').replace('          O_TEST: ${{ steps.test.outcome }}\n', '')
  eq('反例:漏点名新增步骤 ⇒ 报失明', judgeJob('.github/workflows/x.yml', parseWorkflow('.github/workflows/x.yml', blind).jobs[0], new Map()).length >= 1, true)

  // 反例二:id 改名后 O_ 成孤儿
  const renamed = good.replace('id: test', 'id: tests-2').replace('TRIAGE_IDS: checkout test', 'TRIAGE_IDS: checkout tests-2')
  const r2 = judgeJob('wf.yml', parseWorkflow('wf.yml', renamed).jobs[0], new Map())
  eq('反例:改名后缺 O_TESTS_2 ⇒ 报失明', r2.some((v) => v.includes('O_TESTS_2')), true)

  // 反例三:TRIAGE_IDS 留着已删除的 id
  const stale = good.replace('TRIAGE_IDS: checkout test', 'TRIAGE_IDS: checkout test ghost').replace('          TRIAGE_IDS', '          TRIAGE_IDS')
  const r3 = judgeJob('wf.yml', parseWorkflow('wf.yml', stale).jobs[0], new Map())
  eq('反例:幽灵 id ⇒ 报错位', r3.some((v) => v.includes('ghost') && v.includes('错位')), true)

  // 反例四:TRIAGE_WORKFLOW_FILE 指向别的工作流
  const wrongFile = good.replace('TRIAGE_WORKFLOW_FILE: .github/workflows/x.yml', 'TRIAGE_WORKFLOW_FILE: .github/workflows/y.yml')
  eq('反例:取材指错文件 ⇒ 报 W3', judgeJob('.github/workflows/x.yml', parseWorkflow('.github/workflows/x.yml', wrongFile).jobs[0], new Map()).some((v) => v.startsWith('W3')), true)

  // 反例五:整 job 没装自述
  const none = good.split('      - name: Failure triage')[0]
  eq('反例:无自述步骤 ⇒ 报 W1', judgeJob('wf.yml', parseWorkflow('wf.yml', none).jobs[0], new Map()).some((v) => v.startsWith('W1')), true)

  // 豁免必须真生效
  eq('具名豁免生效 ⇒ 不再报 W1', judgeJob('wf.yml', parseWorkflow('wf.yml', none).jobs[0], new Map([['wf.yml#unit', '只读侦察作业']])).length, 0)

  // W1 差值棘轮:存量不红、新增红、锚点取不到 ⇒ 未判定(不得当成 0)
  eq('棘轮:新增才红', ratchetVerdict(new Map([['wf.yml', 2]]), new Map([['wf.yml', 1]])).length, 1)
  eq('棘轮:存量只报数不判红', ratchetVerdict(new Map([['wf.yml', 2]]), new Map([['wf.yml', 2]])).length, 0)
  eq('棘轮:收掉的缺口也不红', ratchetVerdict(new Map([['wf.yml', 1]]), new Map([['wf.yml', 3]])).length, 0)
  eq('棘轮:锚点取不到 ⇒ 未判定而非当成 0', ratchetVerdict(new Map([['wf.yml', 1]]), new Map([['wf.yml', null]]))[0].includes('未判定'), true)
  eq('judgeFace:W1 按文件计数且 W2 归硬缺口', judgeFace([{ rel: 'wf.yml', text: good }], new Map()).w1ByFile.size, 0)

  let fail = 0
  for (const [name, ok, got, want] of cases) {
    if (ok) console.log(`  ✔ ${name}`)
    else { fail++; console.log(`  ✗ ${name}\n     got :${JSON.stringify(got)}\n     want:${JSON.stringify(want)}`) }
  }
  console.log(`自检:${cases.length - fail} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((rc) => process.exit(rc)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  outcomeEnvKeyFor,
  parseWorkflow,
  judgeJob,
  judgeFace,
  ratchetVerdict,
  countIdlessSteps,
  countUnnameableJobs,
  readExemptLedger,
  TRIAGE_SCRIPT,
  EXEMPT_LEDGER_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
