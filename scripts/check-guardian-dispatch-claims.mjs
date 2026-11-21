// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-guardian-dispatch-claims.mjs —— 「自述被守护周期派发」的第六处接线面对账
 *
 * 病理(本仓 2026-11-21 连续三次实证,第 53/54/55 项):
 *   `check-temp-worktree-lifetime.mjs` / `check-miniapp-mirror-fidelity.mjs` / 钩子审计这把尺子,
 *   头注都写着「走 git-guardian 周期派发」或「git-guardian 巡检轮派发」,而 `git-guardian.mjs`
 *   对它们的文件名**零引用** —— 登记进了 `guardian-runner.mjs` 不等于会跑,判据齐全却无人调度,
 *   失效形态是安静(§0.9「造好没装车」= 没有)。
 *
 * 为什么别的门看不见它: `check-gate-wiring.mjs` 的五处权威接线点里,`guardian-runner.mjs` 的
 * `script:` 值算一处 —— 这三把尺子**确实登记在那里**,所以 R1 一路报绿;真正缺的第六处
 * (git-guardian 内部的调度点)它压根不在候选面上。本门只量这一处,不重复 R1 的任何判断。
 *
 * 判据(两面对账,宁漏不误报):
 *   声称面:被测脚本**头部注释区**出现肯定式的「git-guardian / guardian / 守护进程 + 周期派发/
 *           巡检轮/daemon/tick/每 N 分钟」;
 *          同一行含「未接 / 待接 / 尚未 / 不派发 / 无人派发 / 已废弃 / 计划 / 预留」等否定或未来时
 *          措辞 ⇒ 归"诚实说明",不判红(与 check-gate-wiring R1 的 2026-09-24 收紧同口径)。
 *   兑现面:`git-guardian.mjs` **剥掉注释后**的代码面出现该脚本的 basename(字符串实参算数 ——
 *          `runReadoutGate({ script: 'check-x.mjs' })` 就是调用点;注释里提到不算装车)。
 *
 * 三态(§0.3):ok / warn / undetermined。枚举到 0 个声称 ⇒ undetermined(exit 2),不记绿。
 * 取不到 git-guardian 或被审面 ⇒ undetermined,不冒红也不冒绿。
 *
 * 刻意不进提交链(§12e:判机器状态的只读尺子不许当提交门),由 git-guardian 的 daemon tick
 * 经 `runReadoutGate` 周期派发;人工问责入口 `node scripts/check-guardian-dispatch-claims.mjs`。
 *
 * 用法:
 *   node scripts/check-guardian-dispatch-claims.mjs            # HEAD 面
 *   node scripts/check-guardian-dispatch-claims.mjs --staged    # 索引面
 *   node scripts/check-guardian-dispatch-claims.mjs --self-test
 * 退出码:0 ok / 0 warn(读数档,不阻断) / 2 未判定
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch, gitRaw, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GUARDIAN_REL = 'scripts/git-guardian.mjs'
const HEADER_LINES = 90
const TAG = '[guardian-dispatch-claims]'

// 声称形态:调度主体 + **强**调度名词(派发/调度面/调度器/巡检轮)。弱词(单写"巡检/一巡")不算 ——
// 本仓大量头注在描述守护自己的节律("git-guardian 每 2 分钟一巡"),那不是对自身的接线声明。
const CLAIM_RE =
  /(?:git-guardian|守护进程|guardian)[^\n]{0,40}?(?:派发|调度面|调度器|巡检轮)|(?:派发|调度面|调度器|巡检轮)[^\n]{0,40}?(?:git-guardian|守护进程|guardian)/
const SELF_TOKEN_RE = /本(?:门|器|尺|件|脚本|闸|款|文件)|self|this\s+(?:gate|script)/i
const OTHER_SCRIPT_RE = /([A-Za-z0-9._-]+\.mjs)/g
// 否定/未来时/条件措辞 —— 如实说明或"若挂进…前提"都不判红(R1 2026-09-24 收紧同口径)。
const NEG_RE = /未接|待接|尚未|不派发|无人派发|无人调度|不会派发|已废弃|不再|计划|TODO|预留|可选|前提|若|如果|愿意|没有\s*guardian\s*派发|零调用点/

/** 头部注释区里的注释文本行(行号从 1 计;`/*`、`//`、`*` 前缀都认) */
export function headerCommentTexts(src, limit = HEADER_LINES) {
  const out = []
  const lines = String(src ?? '').split('\n')
  for (let i = 0; i < Math.min(lines.length, limit); i++) {
    const raw = lines[i]
    const m = /^\s*(?:\/\/+|\*+|\/\*+)\s?(.*)$/.exec(raw)
    if (!m) continue
    out.push({ line: i + 1, text: m[1].trim() })
  }
  return out
}

/** 连续注释行归成一段(段 = 主体可被代词/自称指代的范围) */
export function headerCommentParagraphs(src, limit = HEADER_LINES) {
  const paras = []
  let cur = null
  for (const l of headerCommentTexts(src, limit)) {
    if (cur && l.line === cur.to + 1) {
      cur.items.push(l)
      cur.to = l.line
    } else {
      cur = { from: l.line, to: l.line, items: [l] }
      paras.push(cur)
    }
  }
  return paras
}

function splitSentences(text) {
  return String(text)
    .split(/(?<=[。;；!?])/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 从脚本源码里抽出「主体是本脚本」的守护派发声称。
 * 精度优先(宁漏不误报):描述别人/描述节律/条件式/否定式一律不算。
 * @returns {{rel:string, line:number, text:string, negated:boolean}[]}
 */
export function findDispatchClaims(rel, src) {
  const base = path.posix.basename(rel)
  const out = []
  for (const para of headerCommentParagraphs(src)) {
    const joined = para.items.map((i) => i.text).join(' ')
    // 主体判定:段内必须出现自称,或直接写出本脚本文件名
    if (!SELF_TOKEN_RE.test(joined) && !joined.includes(base)) continue
    // 复数主语(链条各腿/这些腿)= 整段在描述别的组件
    if (/各腿|这些腿|它们|全部腿|多腿/.test(joined)) continue
    for (const it of para.items) {
      for (const sent of splitSentences(it.text)) {
        if (!CLAIM_RE.test(sent)) continue
        // 句子里点名了别的脚本 ⇒ 是对别人的交叉引用,不是对本脚本的声明
        const others = [...sent.matchAll(OTHER_SCRIPT_RE)]
          .map((m) => m[1])
          .filter((n) => n !== base)
        if (others.length) continue
        // 复数主语(链条各腿/这些腿)= 描述别的组件
        if (/各腿|这些腿|它们|全部腿|多腿/.test(sent)) continue
        out.push({ rel, line: it.line, text: sent, negated: NEG_RE.test(sent) })
      }
    }
  }
  return out
}

/**
 * 纯判据:声称集 vs git-guardian 代码面。
 * @param {{rel:string, claims:Array}}[] candidates
 * @param {string} guardianCode 已剥注释的 git-guardian 源码
 */
export function judgeClaims(candidates, guardianCode) {
  const problems = []
  const negated = []
  const wired = []
  for (const cand of candidates) {
    const base = path.posix.basename(cand.rel)
    const ref = guardianCode.includes(base)
    for (const c of cand.claims) {
      if (c.negated) {
        negated.push({ ...c })
        continue
      }
      if (ref) wired.push({ ...c })
      else problems.push({ ...c, base })
    }
  }
  return { problems, negated, wired }
}

export function selfTest(sink = console.log) {
  let pass = 0
  const fails = []
  const ok = (name, cond) => (cond ? pass++ : fails.push(name))
  const src = (body) => `// 头注\n// ${body}\n//\nimport x from 'y'\n`

  // ① 肯定式声称 + 代码面零引用 ⇒ warn
  const c1 = [{ rel: 'scripts/check-a.mjs', claims: findDispatchClaims('scripts/check-a.mjs', src('本门由 git-guardian 周期派发(每 30 分钟)。')) }]
  const j1 = judgeClaims(c1, "import z from 'z'\nconst X = 1\n")
  ok('①零引用判 warn', j1.problems.length === 1)

  // ② 同一句话里带否定措辞 ⇒ 归诚实说明,不判红
  const c2 = [{ rel: 'scripts/check-b.mjs', claims: findDispatchClaims('scripts/check-b.mjs', src('本门尚未接线:先前自述走 git-guardian 周期派发,实测无人调度。')) }]
  const j2 = judgeClaims(c2, '')
  ok('②否定措辞豁免', j2.problems.length === 0 && j2.negated.length === 1)

  // ③ 代码面(字符串实参)出现 basename ⇒ ok;注释里的提及不算(调用方先 maskComments)
  const c3 = [{ rel: 'scripts/check-c.mjs', claims: findDispatchClaims('scripts/check-c.mjs', src('本门走 git-guardian 巡检轮派发。')) }]
  ok('③有调用点判 ok', judgeClaims(c3, "runReadoutGate({ script: 'check-c.mjs' })").problems.length === 0)

  // ④ 头部之外(第 90 行以后)的声称不在射程(避免正文叙述被当成接线声明)
  const long = `// ${'填充'.repeat(1)}\n`.repeat(95) + '// 本门 git-guardian 周期派发\n'
  ok('④射程只到头部注释区', findDispatchClaims('scripts/check-d.mjs', long).length === 0)

  // ⑤ 非注释行不算声称(代码里的字符串不许冒充头注)
  ok('⑤代码行不算', findDispatchClaims('scripts/check-e.mjs', "const s = '本门 git-guardian 周期派发'\n").length === 0)

  // ⑥ 句子里点名别的脚本 ⇒ 交叉引用,不算本脚本的声明
  ok(
    '⑥别人的调度不算',
    findDispatchClaims('scripts/check-f.mjs', src('本门只判 S2;兜底清扫归 check-other.mjs(挂 git-guardian 巡检轮)。')).length === 0,
  )

  // ⑦ 描述守护自身节律(无强调度名词)不算
  ok('⑦节律描述不算', findDispatchClaims('scripts/check-g.mjs', src('本件盯 1s 级轮询;git-guardian 每 2 分钟一巡抓不到瞬态。')).length === 0)

  // ⑧ 没有自称的段落不算(描述守护形体,不是接线声明)
  ok(
    '⑧无自称段落不算',
    findDispatchClaims('scripts/check-h.mjs', src('git-guardian --daemon 是盘根卫生三腿唯一载体,由它巡检轮带起。')).length === 0,
  )

  for (const f of fails) sink(`❌ ${f}`)
  sink(fails.length ? `\n❌ 自检失败 ${fails.length} 例(通过 ${pass})` : `\n✅ 自检通过 ${pass}/${pass}`)
  return fails.length === 0 ? 0 : 1
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()

  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const { face, error } = selectFace({ staged, worktree, def: 'head' })
  if (error) {
    console.error(`${TAG} ${error}`)
    return 2
  }

  const revSpec = face === 'staged' ? null : face === 'worktree' ? 'WORKTREE' : 'HEAD'
  if (revSpec === 'WORKTREE') {
    console.error(`${TAG} --worktree 档本门不提供(人工逃生请用 --staged 或 HEAD 面)`)
    return 2
  }

  let list
  try {
    list = gitRaw(revSpec ? ['ls-tree', '-r', '--name-only', revSpec, 'scripts/'] : ['ls-tree', '-r', '--name-only', 'scripts/'], ROOT)
  } catch (e) {
    console.error(`${TAG} 取不到被审面脚本清单(${face}):${e && e.message}`)
    return 2
  }
  const rels = String(list)
    .split('\n')
    .map((l) => l.trim())
    .filter((p) => p.startsWith('scripts/') && p.endsWith('.mjs'))
    // 测试/夹具不是调度对象(它们描述守护,不派发任何东西)
    .filter((p) => !p.startsWith('scripts/tests/') && !p.startsWith('scripts/lib/'))
  const blobSpecs = rels.map((rel) => (revSpec ? `${revSpec}:${rel}` : `:${rel}`))
  blobSpecs.push(revSpec ? `${revSpec}:${GUARDIAN_REL}` : `:${GUARDIAN_REL}`)

  let blobs
  try {
    blobs = catBatch(ROOT, blobSpecs)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    console.error(`${TAG} 取不到 blob(${face}):${e && e.message}`)
    return 2
  }

  const get = (rel) => {
    const spec = revSpec ? `${revSpec}:${rel}` : `:${rel}`
    const v = blobs.get(spec)
    return typeof v === 'string' ? v : null
  }

  const guardianSrc = get(GUARDIAN_REL)
  if (guardianSrc == null) {
    console.error(`${TAG} 取不到 ${GUARDIAN_REL}(${face} 面)⇒ 未判定,不记绿也不冒红`)
    return 2
  }
  // 兑现面 = 剥注释保留字符串的代码面(唯一实现见 lib/code-mask.mjs)
  const { maskComments } = await import('./lib/code-mask.mjs')
  // 一跳:git-guardian 直接 import 的 lib 模块也算派发面 —— 调度代码住在 lib 里的那一型
  // (例:worktree 回收 = lib/git-guardian-worktree-reap.mjs spawn agent-worktree.mjs),
  // 只看 git-guardian 本体会把真实接线误判成"零引用"。
  const libRels = [...new Set([...guardianSrc.matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => `scripts/${m[1]}`))].filter(
    (r) => r.endsWith('.mjs'),
  )
  const libSpecs = libRels.map((rel) => (revSpec ? `${revSpec}:${rel}` : `:${rel}`))
  let libBlobs = new Map()
  if (libSpecs.length) {
    try {
      libBlobs = catBatch(ROOT, libSpecs)
    } catch (e) {
      if (e instanceof Undetermined) throw e
      console.error(`${TAG} 取不到 git-guardian 的 lib 依赖(${face}):${e && e.message} ⇒ 未判定`)
      return 2
    }
  }
  let dispatchSurface = maskComments(guardianSrc)
  for (const spec of libSpecs) {
    const v = libBlobs.get(spec)
    if (typeof v === 'string') dispatchSurface += `\n${maskComments(v)}`
  }

  const candidates = []
  for (const rel of rels) {
    const src = get(rel)
    if (src == null) {
      console.error(`${TAG} 取不到 ${rel}(${face} 面)⇒ 未判定`)
      return 2
    }
    const claims = findDispatchClaims(rel, src)
    if (claims.length) candidates.push({ rel, claims })
  }

  if (candidates.length === 0) {
    console.error(`${TAG} 结论 undetermined:候选集枚举到 0 枚(该型不存在时不得报绿)`)
    return 2
  }

  const { problems, negated, wired } = judgeClaims(candidates, dispatchSurface)
  console.log(
    `${TAG} 结论 ${problems.length ? 'warn' : 'ok'}:声称 ${candidates.length} 枚 / 已接线 ${wired.length} 处 / 诚实说明 ${negated.length} 处`,
  )
  for (const p of problems) {
    console.log(
      `❌ ${p.rel}:${p.line} 头注声称走 git-guardian 周期派发,但 ${GUARDIAN_REL} 代码面零引用「${p.base}」 ⇒ 登记了没人调度`,
    )
    console.log('   出路:在 git-guardian 里补 runReadoutGate 包装器与两处挂点,或把头注改成如实的否定说明')
  }
  for (const n of negated) {
    console.log(`ℹ️ ${n.rel}:${n.line} 已如实写明尚未/不再派发(不判红):${n.text.slice(0, 90)}`)
  }
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((rc) => process.exit(rc))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
