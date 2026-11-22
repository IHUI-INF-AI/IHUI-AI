// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出点名与出路 */
/**
 * check-commit-rewrite-safety.mjs —— 「重写提交前必须问清有没有后代」的只读查询出口(2026-11-06 立)。
 *
 * 立因(一手证据,当日已现跑复核):主会话用纯对象空间方式重写一枚**尚未推送**的本地提交的提交信息
 * (`git commit-tree <同树> -p <同父>` + `git update-ref refs/heads/main`),两枚 `git patch-id --stable`
 * 逐字相同、树未变。并发别席当时已基于**旧枚**继续提交 ⇒ update-ref 后 HEAD 走回旧链、带声明的新枚
 * 反而成了孤儿,结果是结构性死锁:未声明的旧枚永远留在 push 区间里挡住 11 枚(含别席成果)。
 * 这条纪律靠人记必然再踩(这次踩它的是执行者本人),所以做成牙。
 *
 * 判据单源 = `scripts/lib/commit-rewrite-safety.mjs`(§0.6/§22c:本文件不重抄任何判据,只做投影)。
 *
 * 用法:
 *   node scripts/check-commit-rewrite-safety.mjs --sha <40位> [--sha <40位> …]
 *   node scripts/check-commit-rewrite-safety.mjs --stdin            # 从管道逐行收 sha 清单
 *   node scripts/check-commit-rewrite-safety.mjs --at-commit        # 提交链档(钩子调用形态)
 *   node scripts/check-commit-rewrite-safety.mjs --explain|--self-test|--help
 *
 * 三态退出码(§0.3:取不到输入 ⇒ 未判定,既不记绿也不冒红):
 *   0 = safe / not-applicable —— 无在飞后代(或本次提交结构上不弃任何现场);
 *   1 = danger               —— 有后代 ⇒ 禁止重写,逐条点名「后代 sha + 距 HEAD 枚数 + 属于哪条 ref」;
 *   2 = undetermined         —— rev-list / for-each-ref 取不到、sha 不存在或形态不合法、候选清单为空。
 *
 * 关于 §9b/§22 的备份引用豁免:`backup/*`、`ihui-backup/*`、`lost-commit/*` 一族承载的现场
 * **永不判红、也永不许删**,所以只挂在它们上面的后代只报数不判阻塞(豁免口径逐字复用守门 41 的
 * `inFlightExempt` 与 orphan-backup 的命名族前缀,本层零复算)。**这条豁免是被验过才生效的**
 * (镜像测试 ③ 造真 backup tag / 真 lost-commit tag 现场钉住),不是台账里写一行放行。
 *
 * 注册档位说明(见交付报告):本门判的是「git 现场」而不是「本次暂存内容」,单个提交结构上
 * 满足不了"别人不基于我继续提交" —— 按 §12e 不能挂成 pre-commit blocking。真正会伤到别人的两个
 * 动手点(对象空间落地器 + CAS 执行器)已直接 import 同一出口做 fail-closed 前置判定,本门作为
 * **人工/agent 动手前的查询出口**与影子自证存在,并在 runner 里按 warn 档登记(不阻断他人提交)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  describeNextSteps,
  detectRewriteShape,
  judgeRewriteSafety,
  resolveToSha,
} from './lib/commit-rewrite-safety.mjs'
import * as lib from './lib/commit-rewrite-safety.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT_DEFAULT = resolve(HERE, '..')

/** 把一枚候选的判定结果渲染成人能照做的点名。 */
function formatItem(item) {
  const lines = []
  if (item.state === 'undetermined') {
    lines.push(`  ❓ ${item.sha} —— 未判定:${item.why ?? '判据输入取不到'}`)
    return lines
  }
  if (item.state === 'safe') {
    lines.push(`  ✅ ${item.sha} —— 无在飞后代 ⇒ 重写只影响它自己(仍建议按 §24 叠新枚而不是重写)`)
    for (const k of item.backupOnly ?? [])
      lines.push(`     ℹ️ 后代 ${k.sha} 只挂在备份引用(${k.refs.join(', ')})⇒ 不判阻塞,只报数`)
    return lines
  }
  lines.push(`  ❌ ${item.sha} —— 有 ${item.active.length} 枚在飞后代 ⇒ 禁止重写`)
  for (const k of item.active) {
    const dist =
      k.ancestorOfHead === true
        ? `距 HEAD ${k.distance === null ? '未判定' : `${k.distance} 枚`}`
        : '不在 HEAD 祖先闭包内'
    lines.push(`     · 后代 ${k.sha} —— ${dist};ref:${k.refs.length ? k.refs.join(', ') : '(无直接指向,躺在某条链中段)'}`)
  }
  for (const k of item.backupOnly ?? [])
    lines.push(`     ℹ️ 另有后代 ${k.sha} 只挂在备份引用(${k.refs.join(', ')})⇒ 不判阻塞但如实报数`)
  return lines
}

function conclude(result, count) {
  const state = result.state
  const head =
    state === 'danger'
      ? 'REWRITE-RESULT state=danger exit=1'
      : state === 'undetermined'
        ? 'REWRITE-RESULT state=undetermined exit=2'
        : 'REWRITE-RESULT state=safe exit=0'
  console.log(
    `${head} 候选 ${count} 枚 / 在飞后代 ${result.items.filter((i) => i.state === 'danger').length} 枚有 / ` +
      `未判定 ${result.items.filter((i) => i.state === 'undetermined').length + (result.reasons?.length ? 1 : 0)} 项 / ` +
      `成图 ${result.inputs ? result.inputs.lines : 0} 行·ref ${result.inputs ? result.inputs.refs : 0} 条`,
  )
  return state === 'danger' ? 1 : state === 'undetermined' ? 2 : 0
}

function parseShas(argv) {
  const shas = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sha') {
      const v = String(argv[i + 1] ?? '').trim()
      if (!v) {
        console.error('❌ --sha 后面缺 sha ⇒ 用法错(不猜「你要查 HEAD」)')
        process.exit(2)
      }
      shas.push(v)
      i++
    }
  }
  if (argv.includes('--stdin')) {
    try {
      const text = readFileSync(0, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const s = line.trim().split(/\s+/)[0]
        if (s) shas.push(s)
      }
    } catch (e) {
      console.error(`❌ --stdin 拿不到管道输入:${String(e?.message ?? e).slice(0, 120)}`)
      process.exit(2)
    }
  }
  return shas
}

function main(argv) {
  const args = argv.slice(2)
  if (args.includes('--help')) {
    console.log(
      [
        '用法:node scripts/check-commit-rewrite-safety.mjs --sha <40位> [--sha <40位> …]',
        '      node scripts/check-commit-rewrite-safety.mjs --stdin',
        '      node scripts/check-commit-rewrite-safety.mjs --at-commit   # 提交链形态探针(只报数)',
        '      node scripts/check-commit-rewrite-safety.mjs --audit-head  # push 门档:HEAD 还能不能被重写',
        '      node scripts/check-commit-rewrite-safety.mjs --self-test|--explain',
        '退出码:0=无在飞后代 / 1=有后代(禁止重写) / 2=未判定',
      ].join('\n'),
    )
    return 0
  }
  if (args.includes('--explain')) {
    console.log(
      readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 46).join('\n'),
    )
    return 0
  }
  const rootIdx = args.indexOf('--root')
  const root = rootIdx === -1 ? ROOT_DEFAULT : String(args[rootIdx + 1] ?? ROOT_DEFAULT)

  // ── push 门档:`HEAD 此刻还有没有在飞后代` ────────────────────────────────────────
  // 这是"重写提交"唯一的动手面 —— 能被顶替掉而不甩下别人的,只有链尾那一枚。
  // 不带 --sha 的默认档刻意留空(见文件头注):提交者结构上满足不了"别人不基于我继续提交"(§12e)。
  if (args.includes('--audit-head')) {
    const headSha = resolveToSha('HEAD', root)
    if (!headSha) {
      console.error('❌ HEAD 解析不到 40 位 sha(空仓 / 坏 .git)⇒ 未判定,不猜它"没有后代"')
      return 2
    }
    const result = judgeRewriteSafety([headSha], { root })
    for (const item of result.items) for (const l of formatItem(item)) console.log(l)
    for (const r of result.reasons) console.log(`  ❓ ${r}`)
    console.log(
      `HEAD=${headSha} —— 本档判的是"这一枚还能不能被顶替重写";它不是对整条链的判决,` +
        `链中间那枚要重写请走 --sha 出口问后代(见文件头注与 §12e)`,
    )
    const code = conclude(result, 1)
    if (code !== 0) console.log(describeNextSteps().join('\n'))
    return code
  }

  // ── 提交链形态探针:只报数,不改判 ───────────────────────────────────────────────
  if (args.includes('--at-commit')) {
    const shape = detectRewriteShape({ root })
    if (shape.shape === 'undetermined') {
      console.log(`ℹ️ 提交形态判不出:${shape.why} ⇒ 本探针报数,不判(未判定不是"它是重写")`)
      return 0
    }
    if (shape.shape === 'normal') {
      console.log(`ℹ️ ${shape.why} ⇒ 本探针无可判对象`)
      return 0
    }
    console.log(
      `ℹ️ ${shape.why} —— 只报数不拦:钩子面拿不到"这是 amend"的直接标记(实测 GIT_REFLOG_ACTION 在钩子里恒空),` +
        `而 HEAD 此刻有无后代是**机器状态**,单个提交满足不了 ⇒ §12e 不升 blocking。要动手前先跑 --sha 出口。`,
    )
    return 0
  }

  const shas = parseShas(args)
  if (shas.length === 0) {
    console.error('❌ 一枚候选都没给(--sha / --stdin)⇒ 枚举到 0 个候选不记绿(§0.3)')
    return 2
  }
  const result = judgeRewriteSafety(shas, { root })
  for (const item of result.items) for (const l of formatItem(item)) console.log(l)
  for (const r of result.reasons) console.log(`  ❓ ${r}`)
  const code = conclude(result, shas.length)
  if (code === 1) console.log(describeNextSteps().join('\n'))
  return code
}

/**
 * 影子自证:纯函数档(不碰真仓),钉「分类 + 三态 + 备份豁免 + 失效方向」。
 * 真仓现场(真建临时仓、真 update-ref、真跑落地器)由 scripts/tests/check-commit-rewrite-safety.test.mjs 钉。
 */
function selfTest() {
  const { judgeFromInputs, classifyChild, parseChildrenMap, parseRefTips, backupExemptKind } = {
    judgeFromInputs: lib.judgeFromInputs,
    classifyChild: lib.classifyChild,
    parseChildrenMap: lib.parseChildrenMap,
    parseRefTips: lib.parseRefTips,
    backupExemptKind: lib.backupExemptKind,
  }
  const cases = []
  const t = (name, fn) => cases.push({ name, ok: (() => { try { return fn() === true } catch { return false } })() })
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const children = parseChildrenMap(`${A} ${B}\n${B}\n坏行不带孩子\n`)
  t('成图解析:父→子入表,无子行与坏行跳过不猜', () => children.get(A)?.[0] === B && !children.has(B))
  const tips = parseRefTips(`${B}\trefs/heads/main\n${B}\trefs/tags/backup/cleanup-x\n\n坏行\n`)
  t('ref 尖端解析:同 oid 多 ref 入同桶,坏行跳过', () => tips.get(B)?.length === 2)
  t('备份引用豁免口径复用守门 41(backup/ihui-backup/lost-commit 三族)', () =>
    backupExemptKind('refs/heads/backup/x') === 'backup' &&
    backupExemptKind('refs/remotes/origin/ihui-backup/x') === 'backup' &&
    backupExemptKind('refs/tags/lost-commit/wip-land-09c565a') === 'lost-commit' &&
    backupExemptKind('refs/heads/main') === null,
  )
  t('后代分类:HEAD 闭包内 = active;只挂备份 ref = backup-only;无直接 ref = active(宁误拦)', () => {
    const c1 = classifyChild(B, { ancestorOfHead: true, refTips: tips })
    const onlyBackup = parseRefTips(`${B}\trefs/tags/backup/x\n`)
    const c2 = classifyChild(B, { ancestorOfHead: false, refTips: onlyBackup })
    const c3 = classifyChild(B, { ancestorOfHead: false, refTips: new Map() })
    return c1.kind === 'active' && c2.kind === 'backup-only' && c3.kind === 'active'
  })
  t('三态:有在飞后代 ⇒ danger;只挂备份 ⇒ safe 且如实报数;无后代 ⇒ safe', () => {
    const d = judgeFromInputs([A], {
      children: new Map([[A, [B]]]),
      refTips: tips,
      exists: () => true,
      ancestorOfHead: () => true,
      distanceFromHead: () => 3,
    })
    const s = judgeFromInputs([A], {
      children: new Map([[A, [B]]]),
      refTips: parseRefTips(`${B}\trefs/tags/lost-commit/wip-conv-1234567\n`),
      exists: () => true,
      ancestorOfHead: () => false,
      distanceFromHead: () => null,
    })
    const n = judgeFromInputs([A], { children: new Map(), refTips: tips, exists: () => true })
    return (
      d.state === 'danger' &&
      s.state === 'safe' &&
      (s.items[0].backupOnly?.length ?? 0) === 1 &&
      n.state === 'safe'
    )
  })
  t('失效方向:sha 不存在 / 非 40 位 / 候选为空 / 存在性问不到 ⇒ 一律 undetermined,绝不记绿', () => {
    const a = judgeFromInputs([A], { children: new Map(), refTips: tips, exists: () => false }).state
    const b = judgeFromInputs(['abc'], { children: new Map(), refTips: tips, exists: () => true }).state
    const c = judgeFromInputs([], { children: new Map(), refTips: tips }).state
    const d = judgeFromInputs([A], { children: new Map(), refTips: tips, exists: () => null }).state
    return a === 'undetermined' && b === 'undetermined' && c === 'undetermined' && d === 'undetermined'
  })
  t('祖先判定问不到 ⇒ 按更严方向算在飞(绝不折成"不是祖先"后放行)', () => {
    const r = judgeFromInputs([A], {
      children: new Map([[A, [B]]]),
      refTips: tips,
      exists: () => true,
      ancestorOfHead: () => null,
    })
    return r.state === 'danger'
  })
  t('danger 与 undetermined 同时存在 ⇒ danger 优先(已有实证不许被未判定洗掉)', () => {
    const r = judgeFromInputs([A, B], {
      children: new Map([[A, [B]]]),
      refTips: tips,
      exists: (sha) => (sha === A ? true : null),
      ancestorOfHead: () => true,
    })
    return r.state === 'danger'
  })
  t('结论行必带下一步(§5e-1 可整改性):点名三条出路 + 为什么伤人', () => {
    const s = describeNextSteps().join('\n')
    return (
      s.includes('--ack') &&
      s.includes('叠一枚新提交') &&
      s.includes('归属会话') &&
      s.includes('为什么重写会伤到别人')
    )
  })
  t('提交形态判据在输入取不到时回 undetermined(不猜)', () => {
    const r = detectRewriteShape({ root: resolve(ROOT_DEFAULT, '__不存在的仓__') })
    return r.shape === 'undetermined'
  })
  const bad = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  console.log(`self-test: ${cases.length - bad.length}/${cases.length} 通过`)
  return bad.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  process.exit(main(process.argv))
}

export const __test__ = {
  main,
  formatItem,
  conclude,
  parseShas,
  ROOT_DEFAULT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
