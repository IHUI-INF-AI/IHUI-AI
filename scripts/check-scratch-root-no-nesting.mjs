#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 只读告警(G-286 票面点名的「判据缺位」):
 *   全仓没有一道门判「scratch 根内不得再出现 scratch 根」—— 于是任何一处「向上 N 级」
 *   推导跟着夹具走,就会在 §15b 批准的临时落点里长出一棵二阶树;除本门外账面一片绿,
 *   而 §26 那类递归清理会顺着它往下吞。
 *
 * 三态(不可并桶):
 *   ok           scratch 根在、量得完、没发现二阶落点
 *   drift        发现二阶落点 ⇒ **逐条点名**(路径 + 深度 + 体积 + 文件/目录数 + mtime)
 *   undetermined 根不在盘上 / 读不了 / 枚举被深度或预算闸断 ⇒ 既不是 ok 也不是 drift
 *
 * 为什么「量不完」必须落 undetermined 而不是 ok:本仓最高频的失效型是「把没判写成判过了」
 * (守门 70/76/81/103 各记过一次同族)。只报数不喊,拿到数字的人就会读成「这一族干净」。
 *
 * 定级:**只告警,不判红,退出码恒 0**(票面硬要求)。理由与 §12e / 守门 77·83·126 同型 ——
 * 它判的是**本机盘上有没有残留**,属机器态:残留可能是别的会话、别台机器、或上一次取证跑
 * 出来的,提交者结构上满足不了。挂进提交链 blocking 就是每台每次被逼 `--no-verify`,一次绕过
 * 约等于全部守门对该提交作废。所以本门的意义是**把债现形**,不是拦提交。
 *
 * 判定路径**零写盘**(票面「清理由人决定,本工具绝不删」):`scanScratchRoot` / `decide` /
 * `formatLines` / `measure` 只调 readdir / lstat(快照与元数据)。唯一的写与删在
 * `--self-test` 的夹具构造与回收里,由镜像测试按**大括号配对取出那几个函数体**逐条锁住
 * (只判「整份源码里有没有 rmSync」会把自己锁死,只判「有没有」又等于没判 —— 两头都要精确)。
 *
 * 递归纪律(票一要求先答的那一句:「任何递归枚举会不会顺着自己造出的嵌套无限深入」):
 *   ① `dirent.isSymbolicLink()` 一律跳过并计数 —— Windows junction 在 Node 侧同样报 true,
 *      顺着它枚举会把改道目标(真实数据)算进本树的账,顺着它删更是清空(§26 实测事故);
 *   ② 深度上限 + **目录**条目预算(文件不计,2026-10-09 由 G-1105304 修正:旧口径让文件也吃预算,
 *      于是正常使用量级的夹具就能把预算耗光 ⇒ 门恒 undetermined ⇒ 这一维实际零覆盖),
 *      耗尽即置 `truncated` ⇒ 结论降为 undetermined。因此即便二阶树
 *      在被扫的树里继续长,本枚举也在预算处硬停,不可能不收敛;
 *   ③ 判定过程自己不产出任何目录 ⇒ 不存在「枚举 → 产出 → 再枚举」的正反馈。
 *
 * 已知两条二阶落点生产者(现读证据见 G-286 交付报告):
 *   P1 `scripts/lib/scratch-dir.mjs` 旧推导「脚本自身位置向上两级」⇒ 形态
 *      `<scratch 根>/DevEnv/Temp/ihui-scratch`;已由 `05ba0cb06` 改盘根锚定 + 建侧守卫;
 *   P2 `scripts/lib/gitdir.mjs` 的 `gitArchiveDir()` 曾按同款 `resolve(wt,'..','..')` 两级推导:
 *      工作树落在 `<scratch 根>/<前缀>/wt*` 这种**两层深**夹具时(如
 *      `scripts/tests/git-backup-refresh.test.mjs` 的 makeFixture 形态),归档根正好 = scratch
 *      根本身 ⇒ 长出 `<scratch 根>/DevEnv/backups/git/…`。**该生产者已于 2026-09-28 收口**:
 *      解析改盘根锚定(`parse(wt).root`,与 P1 同形)+ 夹具闸(路径里含 §26 的 `ihui-scratch` 段
 *      ⇒ 返回 null 由调用方兜底),并把"建目录"从解析面移走到唯一写出口 `gitdirArchivePath()`
 *      ⇒ **解析一个路径不再在盘上造东西**(旧版每问一次就 mkdir 一次)。**本门仍只点名不代删**:
 *      盘上那份残留属 §5b 的恢复现场,清不清、何时清由人决定。
 *
 * 用法:
 *   node scripts/check-scratch-root-no-nesting.mjs [--json] [--root <dir>]
 *                                                 [--max-depth N] [--budget N] [--self-test]
 *   · --root 只决定"扫哪棵树"(取证/人工通道),不改变判据语义;默认取 scratchRoot()。
 *   · 环境闸 IHUI_SCRATCH_NEST_BUDGET 覆盖条目预算(取证时给极小值可构造"量不完")。
 * 镜像测试:node --test scripts/tests/check-scratch-root-no-nesting.test.mjs
 * 紧急跳过:无需 —— 它不判红,退出码恒 0 是设计而不是疏忽。
 */
import { lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  SCRATCH_DIR_NAME,
  countScratchSegments,
  mkScratch,
  rmScratch,
  scratchRoot,
} from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// §15/§118:ROOT 由脚本自身位置推导。本门**不**用它定被扫的树(那由 scratchRoot()/--root 决定),
// 它只是"判据住在哪个仓"的锚点;镜像测试锁的是"不得用 process.cwd() 定根"。
const ROOT = resolve(HERE, '..')

/**
 * §15b 盘级落点的根名(``<盘>/DevEnv/{Temp,backups,cache,tools,runtimes}``)。
 * 它出现在 scratch 根的**直接子项**,就等价于「某处按夹具算出了盘根」—— P1/P2 共同的指纹。
 * 只判深度 1 是刻意的:夹具里自带一个 DevEnv 目录属正常测试内容,判进去就是满天假阳。
 */
const SECOND_ORDER_ROOT_NAME = 'DevEnv'

// 默认射程按真仓现读定:2026-09-27 实测 scratch 根(29 个残留夹具)在深度 ≤6 内共 5,749 条目。
// 预算若只有 1,500,真实运行**每一次**都会撞上截断闸 ⇒ 报告永远带"下界"、而 ok 永远退化成
// 未判定 —— 那等于没有尺子。所以默认给到 2 万条目 / 深度 6;截断路径保留(自检与镜像测试
// 用极小预算构造它),它是"没看完"的诚实出口,不是日常形态。
const DEFAULT_MAX_DEPTH = 6
const DEFAULT_BUDGET = 20000
const WRITE_CALL_RE =
  /\b(mkdirSync|writeFileSync|appendFileSync|rmSync|unlinkSync|rmdirSync|renameSync|symlinkSync)\s*\(/g

/** 目录体积(有界、不穿重解析点)⇒ {bytes,files,dirs,truncated}。 */
function measure(dir, { maxDepth = 8, budget = 2000 } = {}) {
  const acc = { bytes: 0, files: 0, dirs: 0, scanned: 0, truncated: false }
  const walk = (p, depth) => {
    if (acc.truncated) return
    let entries
    try {
      entries = readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of entries) {
      if (acc.scanned++ >= budget) {
        acc.truncated = true
        return
      }
      const q = join(p, d.name)
      if (d.isSymbolicLink()) continue
      let st = null
      try {
        st = lstatSync(q)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        acc.dirs += 1
        if (depth < maxDepth) walk(q, depth + 1)
      } else if (st.isFile()) {
        acc.files += 1
        acc.bytes += st.size
      }
    }
  }
  walk(dir, 1)
  return acc
}

/**
 * 有界枚举 scratch 根,产出三态判据的输入。判据只看两型:
 *   N1 scratch 根之内出现名为 SCRATCH_DIR_NAME 的目录(嵌套的"是不是二阶"由
 *      `countScratchSegments` 这**一份**实现说了算,不在本门另写一遍名字比较)
 *   N2 scratch 根的直接子项出现 SECOND_ORDER_ROOT_NAME(§15b 盘级落点形状跟着夹具走)
 */
export function scanScratchRoot(root, opts = {}) {
  const maxDepth = Number(opts.maxDepth ?? DEFAULT_MAX_DEPTH)
  const envBudget = process.env.IHUI_SCRATCH_NEST_BUDGET
  const budgetFromEnv =
    envBudget && Number.isFinite(Number(envBudget)) && Number(envBudget) > 0
      ? Number(envBudget)
      : null
  const budget = Number(opts.entryBudget ?? budgetFromEnv ?? DEFAULT_BUDGET)
  const res = {
    root,
    rootExists: false,
    rootIsDir: false,
    findings: [],
    scannedEntries: 0,
    scannedFiles: 0,
    truncated: false,
    unreadable: [],
    skippedReparse: 0,
    maxDepth,
    budget,
  }
  let st = null
  try {
    st = lstatSync(root)
  } catch (e) {
    res.unreadable.push(`${root} :: ${e && e.code ? e.code : String(e)}`)
    return res
  }
  if (st.isSymbolicLink()) {
    // 根自己是链接 ⇒ 不穿过它枚举(§26):落点判据必须问实体目录,否则会把别人的目标算成本账。
    res.skippedReparse += 1
    res.unreadable.push(`${root} 是符号链接/junction ⇒ 不穿过重解析点判定(§26)`)
    return res
  }
  if (!st.isDirectory()) {
    res.unreadable.push(`${root} 存在但不是目录`)
    return res
  }
  res.rootExists = true
  res.rootIsDir = true

  const walk = (parent, depth) => {
    if (res.truncated) return
    let entries
    try {
      entries = readdirSync(parent, { withFileTypes: true })
    } catch (e) {
      res.unreadable.push(`${parent} :: ${e && e.code ? e.code : String(e)}`)
      return
    }
    for (const d of entries) {
      const q = join(parent, d.name)
      if (d.isSymbolicLink()) {
        res.skippedReparse += 1
        continue
      }
      let ds = null
      try {
        ds = lstatSync(q)
      } catch (e) {
        res.unreadable.push(`${q} :: ${e && e.code ? e.code : String(e)}`)
        continue
      }
      if (!ds.isDirectory()) {
        // 文件不携带"二阶根"这一信号(信号在**目录名**上),所以它们不得吃条目预算。
        // 旧写法在 `scannedEntries += 1` 之后才 `continue`,于是正常使用量级的夹具(一级 3795 条、
        // 每个夹具自己还在往下派生文件)会把 20000 的预算耗光 ⇒ 门恒 `undetermined` ⇒
        // "二阶 scratch 根"这一维实际零覆盖,而账面看起来"这把尺子在跑"(G-1105304)。
        res.scannedFiles += 1
        continue
      }
      if (res.scannedEntries >= budget) {
        res.truncated = true
        return
      }
      res.scannedEntries += 1
      const lower = d.name.toLowerCase()
      if (lower === SCRATCH_DIR_NAME.toLowerCase() && countScratchSegments(q) > 1) {
        const m = measure(q)
        res.findings.push({
          kind: 'N1',
          path: q,
          depth,
          bytes: m.bytes,
          files: m.files,
          dirs: m.dirs,
          measureTruncated: m.truncated,
          mtime: ds.mtime.toISOString(),
        })
      } else if (depth === 1 && lower === SECOND_ORDER_ROOT_NAME.toLowerCase()) {
        const m = measure(q)
        res.findings.push({
          kind: 'N2',
          path: q,
          depth,
          bytes: m.bytes,
          files: m.files,
          dirs: m.dirs,
          measureTruncated: m.truncated,
          mtime: ds.mtime.toISOString(),
        })
      }
      if (depth < maxDepth) walk(q, depth + 1)
    }
  }
  walk(root, 1)
  return res
}

/**
 * 三态判定(纯函数;输入是 scanScratchRoot 的观测结果,构造面即可验,不赌本机目录形态)。
 * 次序是刻意的:先问"能不能问"(根不在 / 不是目录 / 穿链接)⇒ undetermined;
 * 再看"问完了吗"(预算或深度耗尽、子目录读不了)⇒ undetermined;
 * 最后才在"看完了"的前提上分 ok / drift。
 * 已看到 drift 时不因 truncated 降级 —— 发现就是发现,但"没看完"仍要另行报出。
 */
export function decide(res) {
  if (!res || !res.rootExists || !res.rootIsDir) return 'undetermined'
  if (res.findings.length > 0) return 'drift'
  if (res.truncated || res.unreadable.length > 0) return 'undetermined'
  return 'ok'
}

/**
 * 退出码(纯函数)—— **恒 0**,不存在第二种取值。
 * 单独做成函数,是为了让镜像测试把三种状态各喂一遍并断言 `code === 0`:
 * 「不判红、不改退出码」若只是散文,下一次有人想"顺手升档"时就没有东西挡它。
 */
export function exitCodeFor(state) {
  void state
  return 0
}

export function formatLines(res, state) {
  const out = []
  const limits = () => {
    out.push(
      `  射程:N1 只看深度 ≤ ${res.maxDepth} 的目录段(超出即看不见,不是"没有");` +
        `N2 只看 scratch 根的直接子项;条目预算 ${res.budget}${res.truncated ? '(本轮在预算处停止 ⇒ 上面是下界,未扫到的部分不等于已判)' : ''}。`,
    )
  }
  out.push(`[scratch-root] 被扫的根:${res.root}(盘上${res.rootExists ? '存在' : '不存在'})`)
  if (state === 'undetermined') {
    if (!res.rootExists) {
      out.push(
        `ℹ 未判定:scratch 根问不到实体目录 —— ${res.unreadable.join('; ') || '原因未记录'}。` +
          ' 本机没跑过用 mkScratch 的取证时正是这一型:它**不是"通过"**,是"没问出话"。',
      )
    } else {
      out.push(
        `ℹ 未判定:枚举不完备 —— 条目预算 ${res.budget} / 深度上限 ${res.maxDepth}` +
          `${res.truncated ? ' 已耗尽' : ''}${res.unreadable.length ? `;不可读子目录 ${res.unreadable.length} 处` : ''}`,
      )
      for (const u of res.unreadable.slice(0, 10)) out.push(`     · ${u}`)
    }
    out.push('   本门不判红、不改退出码(机器态残留不该拦每一次提交);但也不得记为通过。')
    return out
  }
  if (state === 'ok') {
    out.push(
      `✅ ok:扫过 ${res.scannedEntries} 个目录 / ${res.scannedFiles} 个文件` +
        `(深度 ≤ ${res.maxDepth},跳过重解析点 ${res.skippedReparse})` +
        ',未发现二阶 scratch 根 / 二阶盘级落点。',
    )
    limits()
    return out
  }
  out.push(
    `⚠ drift:${res.findings.length} 处二阶落点(scratch 根之内又长出了一个落点根)—— 只点名,不删除。`,
  )
  for (const f of res.findings) {
    out.push(
      `  · ${f.kind} ${f.path} [depth ${f.depth} · ${f.bytes} B · ${f.files} 文件 · ${f.dirs} 目录 · mtime ${f.mtime}]`,
    )
    if (f.measureTruncated)
      out.push('      ↑ 体积/计数是**下界**(该子树自身超出计量预算),路径与存在性是确定的')
  }
  limits()
  out.push('  含义:某处「向上 N 级」的落点推导把夹具当成了仓根。')
  out.push('  · P1 = 被闭包拷进夹具的 scratch-dir(已由 05ba0cb06 改盘根锚定 + 建侧守卫)')
  out.push('  · P2 = gitdir.mjs 的 gitArchiveDir()(2026-09-28 已收口:盘根锚定 + 夹具闸,建目录移到写出口)')
  out.push('         ⇒ 现在清完**不会再长**;盘上那份残留属 §5b 恢复现场,仍交人决定,本工具不代删。')
  out.push('  出路:① 先修生产者;② 再由**人**决定清理这份残留。本工具两步都不做。')
  if (res.truncated || res.unreadable.length > 0) {
    out.push(
      `  ⚠ 另有未判完的部分(枚举条目 ${res.scannedEntries}/${res.budget},不可读 ${res.unreadable.length} 处)` +
        ' ⇒ 上面的数字是**下界**,不是「全找齐了」。',
    )
  }
  return out
}

/** 判定路径零写盘的**行为**证明:同一棵树扫两次,条目清单必须一字不差。 */
function snapshotTree(dir, maxDepth = 4) {
  const acc = []
  const walk = (p, depth) => {
    if (depth > maxDepth) return
    let es
    try {
      es = readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of es) {
      const q = join(p, d.name)
      acc.push(q)
      if (d.isDirectory() && !d.isSymbolicLink()) walk(q, depth + 1)
    }
  }
  walk(dir, 1)
  return acc.sort().join('\n')
}

function selfTest() {
  // 夹具一律走 mkScratch(§26 唯一落点):本门判的就是"绕过落点",自己更不能抄那条。
  const base = mkScratch('g286-self-')
  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  const nested = join(base, SECOND_ORDER_ROOT_NAME, 'Temp', SCRATCH_DIR_NAME, 'victim')
  try {
    // ① 空根 ⇒ ok,退出码 0
    const s0 = decide(scanScratchRoot(base, { entryBudget: 500 }))
    check('空 scratch 根 ⇒ ok', s0 === 'ok')
    check('ok 的退出码恒 0(不判红)', exitCodeFor(s0) === 0)

    // ② 注入 P1 形态 ⇒ drift,且两型都点名
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'keep.txt'), '二阶落点里的一份现场:只读门不得动它\n')
    const snapBefore = snapshotTree(base)
    const a1 = scanScratchRoot(base, { entryBudget: 500 })
    const s1 = decide(a1)
    check('注入 DevEnv/Temp/ihui-scratch ⇒ drift', s1 === 'drift')
    check(
      'drift 同时点名 N1(二阶 scratch 根)与 N2(二阶盘级落点)',
      a1.findings.some((f) => f.kind === 'N1' && f.path.toLowerCase().includes(SCRATCH_DIR_NAME)) &&
        a1.findings.some((f) => f.kind === 'N2'),
    )
    check(
      'drift 报到具体路径并量出体积',
      a1.findings.some(
        (f) =>
          f.kind === 'N1' &&
          f.path === join(base, SECOND_ORDER_ROOT_NAME, 'Temp', SCRATCH_DIR_NAME) &&
          f.bytes > 0 &&
          f.files === 1,
      ),
    )
    check('drift 的退出码仍是 0(只告警)', exitCodeFor(s1) === 0)
    // ③ 判定路径零写盘(行为证明,不是正则):扫完之后树本身一字未动
    check('scan 前后目录清单逐字相同 ⇒ 判定路径零写盘', snapshotTree(base) === snapBefore)
    check('被点名的现场仍在(本工具绝不删)', existsHere(join(nested, 'keep.txt')))

    // ④ 反向锁:把注入抹掉 ⇒ 立刻回到 ok
    rmSync(join(base, SECOND_ORDER_ROOT_NAME), { recursive: true, force: true })
    const a2 = scanScratchRoot(base, { entryBudget: 500 })
    check('抹掉二阶形态 ⇒ 回到 ok(判据认形态,不认"见过")', decide(a2) === 'ok')

    // ⑤ 根不在盘上 ⇒ undetermined,退出码 0,且必须打印原因
    const a3 = scanScratchRoot(join(base, 'no-such-root-at-all'))
    const s3 = decide(a3)
    check('scratch 根不在盘上 ⇒ undetermined', s3 === 'undetermined')
    check('undetermined 的退出码是 0(机器态不拦提交)', exitCodeFor(s3) === 0)
    check(
      'undetermined 必须喊出原因,不得静默成"看起来全绿"',
      formatLines(a3, s3).join('\n').includes('未判定'),
    )

    // ⑥ 预算闸:极小预算把同一棵树判成"没看完" ⇒ undetermined(而不是 ok)
    mkdirSync(join(base, 'deep', 'a', 'b', 'c'), { recursive: true })
    const a4 = scanScratchRoot(base, { entryBudget: 1 })
    check('预算耗尽 ⇒ undetermined(量不完不得记为通过)', decide(a4) === 'undetermined')
    check('预算耗尽的退出码也是 0', exitCodeFor(decide(a4)) === 0)

    // ⑦ 深度闸是一对**成对**用例:同一棵树,maxDepth=1 看不见二阶 scratch 根、=默认看得见。
    //    这不是"把限制藏起来",而是把限制量出来 —— 报告必须始终写明射程(见下一条),
    //    否则读 `ok` 的人会以为"任何深度都干净"。
    const deepNested = join(base, 'd1', 'd2', SCRATCH_DIR_NAME)
    mkdirSync(deepNested, { recursive: true })
    const shallow = scanScratchRoot(base, { maxDepth: 1, entryBudget: 500 })
    check(
      'maxDepth=1 时 depth 3 的二阶 scratch 根看不见(射程如实是有界的)',
      !shallow.findings.some((f) => f.kind === 'N1'),
    )
    const deep = scanScratchRoot(base, { entryBudget: 500 })
    check(
      '同一棵树在默认射程内必须命中(浅扫的"没看到"不是"没有")',
      deep.findings.some((f) => f.kind === 'N1' && f.path === deepNested),
    )
    check(
      '报告始终写明射程(深度上限/N2 只看直接子项),不许把 ok 读成"任意深度都干净"',
      /射程/.test(formatLines(deep, decide(deep)).join('\n')) &&
        formatLines(deep, decide(deep)).join('\n').includes(String(deep.maxDepth)),
    )
    rmSync(join(base, 'd1'), { recursive: true, force: true })
    check('有界枚举必然终止(能走到这里就是终止本身的证据)', true)

    // ⑧ 三态各自 code 恒 0(把"不判红"钉成函数行为而不是措辞)
    check(
      'decide 的三种取值都映射到退出码 0',
      ['ok', 'drift', 'undetermined'].every((s) => exitCodeFor(s) === 0),
    )
    rmSync(join(base, SECOND_ORDER_ROOT_NAME), { recursive: true, force: true })
    rmSync(join(base, 'deep'), { recursive: true, force: true })
  } finally {
    try {
      rmScratch(base)
    } catch (e) {
      // 若注入没清干净,删除侧守卫会**拒绝**递归删(泄漏一个目录,而不是吞掉别人的现场)——
      // 这是刻意的失效方向,出现即说明上面的清理没跑成,必须当场红而不是静默通过。
      check('夹具能被回收(否则二阶守卫把自检自己的现场也拦住了)', false)
      console.log(`ℹ 夹具未自动回收:${e && e.message ? e.message : e}`)
    }
  }
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  process.exit(fails === 0 ? 0 : 1)
}

function existsHere(p) {
  try {
    lstatSync(p)
    return true
  } catch {
    return false
  }
}

function flagVal(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

function main(argv) {
  if (argv.includes('--self-test')) {
    selfTest()
    return
  }
  const rootArg = flagVal(argv, '--root')
  const root = rootArg ? resolve(rootArg) : scratchRoot()
  const maxDepth = flagVal(argv, '--max-depth')
  const budget = flagVal(argv, '--budget')
  const res = scanScratchRoot(root, {
    maxDepth: maxDepth ? Number(maxDepth) : undefined,
    entryBudget: budget ? Number(budget) : undefined,
  })
  const state = decide(res)
  const code = exitCodeFor(state)
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ root, state, code, ...res }, null, 2)}\n`)
  } else {
    for (const l of formatLines(res, state)) console.log(l)
    console.log(`结论:${state}(退出码 ${code};本门只告警,清理与修复归人)`)
  }
  process.exit(code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
// §22d 的"脚本异常 ⇒ exit 2"在本门刻意不适用:判的是机器态,异常同样只该喊出来、不该拦提交。
if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(`⚠ 本门自身异常(不是判据结论,按未判定处理且不判红):${e?.message ?? e}`)
    process.exit(0)
  }
}

export const __test__ = {
  SCRATCH_DIR_NAME,
  SECOND_ORDER_ROOT_NAME,
  DEFAULT_MAX_DEPTH,
  DEFAULT_BUDGET,
  WRITE_CALL_RE,
  scanScratchRoot,
  decide,
  exitCodeFor,
  formatLines,
  measure,
  snapshotTree,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
