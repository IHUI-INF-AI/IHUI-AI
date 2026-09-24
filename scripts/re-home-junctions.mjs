#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §26 家目录改道**修复器**(守门 96 的幂等出口)
 *
 * 为什么需要它:门 96 只判定、不修复,而它给的"修法"是五步人肉流程。2026-09-24 实测
 * `D:\DevEnv\cache\userhome` 整棵消失(13:15 前后),16 项登记里**已改道 0 / 违规 9**,
 * 4770MB 工具态回到 C 盘 —— 于是每一次提交都被这道 blocking 门逼成绕过钩子,
 * 而一次绕过等于约 110 道守门对该提交全部作废(§12e 同型)。恒红门的唯一结局就是没人再守门。
 *
 * 判据与登记表**一律复用门 96 自己的 `registryOf()`** 与 `seal-c-root-stray` 的 `devEnvRoot()`
 * —— 另抄一张表必然漂移,正是这一类改动被打回的成因。
 *
 * 安全性(§26 实测教训逐条内建):
 *  1. 先镜像复制(源不动)→ **逐文件相对路径 + 字节**全量校验 → 源改名 → mklink /J
 *     → 经 junction 回读数量/字节一致 → 才删源。任一步不符即改名回退。
 *  2. robocopy 返回码 0-7 为成功,**≥8 一律当失败**(非零码会出现"内容已搬走但不建 junction",
 *     路径直接消失 —— §26 记过一次凭据零丢失就是靠这条回读)。
 *  3. 全程不跟随重解析点统计体积(PowerShell 的 -Recurse 会穿透 junction,把 D 盘算成 C 盘的债)。
 *  4. 被占用的目录改名会失败 ⇒ 该项跳过并如实报原因(安全失败,不强删)。
 *  5. 不改任何环境变量、不碰 Path、不碰第三方 IDE 自管态(登记表本就不含 .workbuddy/.qoder-cn)。
 *
 * 用法:
 *   node scripts/re-home-junctions.mjs              # 只报告(零副作用)
 *   node scripts/re-home-junctions.mjs --apply      # 执行改道(幂等,可反复跑)
 *   node scripts/re-home-junctions.mjs --self-test  # 逻辑自检(临时夹具,不碰真家目录)
 * 退出码:0 = 无 REAL-DIR 违规;1 = 仍有违规;2 = 脚本自身异常。
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registryOf, findStashes } from './check-home-junctions.mjs'
import { devEnvRoot } from './seal-c-root-stray.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const GIT_BASH = 'C:\\Windows\\System32\\cmd.exe'
const STEP_TIMEOUT_MS = 15 * 60 * 1000

/** 目标名:家目录项用原名;APPDATA/LOCALAPPDATA 下的加前缀(与 §26 已落地的命名一致)。
 *  `.ollama` 是 §26 表里的显式特例 → `<devEnv>/cache/ollama`(不带点)。 */
export function targetFor(srcPath, home, devEnv) {
  const base = srcPath.slice(srcPath.lastIndexOf(sep) + 1)
  if (srcPath === join(home, '.ollama')) return join(devEnv, 'cache', 'ollama')
  const appdata = process.env.APPDATA || join(home, 'AppData', 'Roaming')
  const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
  if (srcPath.startsWith(appdata + sep))
    return join(devEnv, 'cache', 'userhome', `appdata-roaming-${base}`)
  if (srcPath.startsWith(local + sep))
    return join(devEnv, 'cache', 'userhome', `appdata-local-${base}`)
  return join(devEnv, 'cache', 'userhome', base)
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

/** 全量走一遍,**不跟随重解析点**;返回 { files: Map<相对路径, 字节> } */
export function fingerprintTree(root) {
  const files = new Map()
  if (!existsSync(root)) return files
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()
    let entries = []
    try {
      entries = readdirSyncSafe(cur)
    } catch {
      continue // 权限/占用:该子树读不到,由校验步骤按"数量不一致"抓住
    }
    for (const e of entries) {
      const full = join(cur, e.name)
      let st = null
      try {
        st = lstatSync(full)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) continue // 不穿透
      if (st.isDirectory()) stack.push(full)
      else if (st.isFile()) files.set(relative(root, full).replace(/\\/g, '/'), st.size)
    }
  }
  return files
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir).map((n) => ({ name: n }))
  } catch {
    return []
  }
}

/** 两份指纹全等?(相对路径集合 + 每个字节数) */
export function sameFingerprint(a, b) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (!b.has(k) || b.get(k) !== v) return false
  }
  return true
}

function run(cmd, args, timeout = STEP_TIMEOUT_MS) {
  return spawnSync(cmd, args, { windowsHide: true, timeout, encoding: 'utf8' })
}

/** 两份指纹的差异分类:src 独有 / dst 独有 / 字节不同 */
export function diffFingerprint(a, b) {
  const onlyA = []
  const onlyB = []
  const differ = []
  for (const [k, v] of a) {
    if (!b.has(k)) onlyA.push(k)
    else if (b.get(k) !== v) differ.push(k)
  }
  for (const k of b.keys()) if (!a.has(k)) onlyB.push(k)
  return { onlyA, onlyB, differ }
}

/** 单项改道。dry=true 时只报告要做什么,不动任何文件。
 *  resetDst=true 时先清空目标再复制 —— 只用于清掉**本工具自己**上一次失败留下的残留:
 *  校验只增不删会让"目标里有源里没有的文件"永远对不上(实测 .cargo 四轮都是源 21760/副本 21773,
 *  差 13 个稳定不变,证明是残留而非活目录在写)。删目标不影响源,源在通过校验前一个字都不动。 */
export function repairOne(srcPath, dstPath, { dry = false, resetDst = false } = {}) {
  if (!existsSync(srcPath))
    return { src: srcPath, action: 'absent', ok: true, note: '源不存在,无需改道' }
  if (isLink(srcPath)) {
    const ok = existsSync(dstPath)
    return {
      src: srcPath,
      action: 'link',
      ok,
      note: ok ? '已是指针且目标在位' : `指针目标缺失(DANGLING):${dstPath}`,
    }
  }
  if (!statSync(srcPath).isDirectory())
    return { src: srcPath, action: 'file', ok: true, note: '同名文件,非目录' }

  const before = fingerprintTree(srcPath)
  if (dry)
    return {
      src: srcPath,
      action: 'would-move',
      ok: true,
      note: `${before.size} 个文件 / ${Math.round([...before.values()].reduce((s, n) => s + n, 0) / 1048576)}MB`,
    }

  // 1) 复制 + 逐文件校验(源不动)。目标是**活目录**时(缓存正被写)一次复制必然对不上,
  //    所以按"复制 → 以复制完成之后的源为准重新指纹 → 不一致就增量再同步"有界重试。
  //    刻意不用 robocopy /MIR:/MIR 会删目标里"源没有"的文件,而目标若因路径算错指向了一个
  //    已有数据的目录,那就是拿 /MIR 去删用户的数据 —— 宁可不收敛,也不给这条路径。
  let snap = before
  for (let round = 1; round <= 4; round++) {
    if (resetDst && existsSync(dstPath)) rmSync(dstPath, { recursive: true, force: true })
    // /XJ:不把 junction 当目录跟随展开;/SL:符号链接按链接复制。
    //   必须与 fingerprintTree 的规则(两侧都跳过重解析点)一致 —— 否则源里每个 junction
    //   都会被 robocopy 展开成一批真实文件,副本永远比源"多出"若干条目,校验永不收敛
    //   (实测 .cargo 四轮稳定差 13 个,正是它内部的 13 个重解析点)。
    const rc = run('robocopy', [
      srcPath,
      dstPath,
      '/E',
      '/XJ',
      '/SL',
      '/COPY:DAT',
      '/R:1',
      '/W:1',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
    ])
    if (rc.status >= 8 || rc.error)
      return {
        src: srcPath,
        action: 'copy-failed',
        ok: false,
        note: `robocopy 返回 ${rc.status}(≥8 视为失败,源未动)`,
      }
    snap = fingerprintTree(srcPath) // 以"复制完成之后"的源为准,才不会被边写边搬骗过
    const dst = fingerprintTree(dstPath)
    if (sameFingerprint(snap, dst)) break
    const d = diffFingerprint(snap, dst)
    // 只有"目标多了东西"才是可清的残留;源里有而目标没有 = 真没复制上,清目标重跑才对。
    const residueOnly = d.onlyA.length === 0 && d.differ.length === 0 && d.onlyB.length > 0
    if (round === 4)
      return {
        src: srcPath,
        action: 'verify-failed',
        ok: false,
        note:
          `4 轮仍不一致(源 ${snap.size} / 副本 ${dst.size};源缺 ${d.onlyB.length} 目标缺 ${d.onlyA.length} 字节不同 ${d.differ.length})` +
          (residueOnly
            ? ' ⇒ 目标是本工具上次失败留下的残留,用 --reset-dst 清掉再跑'
            : ' ⇒ 源在被持续写入或复制未成功,不建 junction、不删源'),
      }
    if (residueOnly) resetDst = true // 下一轮先清掉自己造的残留
  }

  // 3) 源改名(占用中的目录改名会失败 = 安全失败)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const stash = `${srcPath}.pre-junction-${stamp}`
  try {
    renameSync(srcPath, stash)
  } catch (e) {
    return {
      src: srcPath,
      action: 'rename-failed',
      ok: false,
      note: `改名失败(多半被进程占用):${e.code || e.message}`,
    }
  }

  // 4) 建 junction
  const mk = run(GIT_BASH, ['/c', 'mklink', '/J', srcPath, dstPath])
  if (!isLink(srcPath)) {
    try {
      renameSync(stash, srcPath)
    } catch {
      /* 回退也失败:源仍在 stash,下面如实报 */
    }
    return {
      src: srcPath,
      action: 'mklink-failed',
      ok: false,
      note: `mklink 未生效(rc=${mk.status}),已回退改名`,
    }
  }

  // 5) 经 junction 回读必须与"复制后的源快照"一致,才允许删 stash。
  //    rmSync 对 junction 只断链不穿透(§26 实测:lstatSync().isSymbolicLink() 为 true)。
  const through = fingerprintTree(srcPath)
  if (!sameFingerprint(snap, through)) {
    rmSync(srcPath, { force: true }) // 只断链,不穿透
    try {
      renameSync(stash, srcPath)
      return {
        src: srcPath,
        action: 'rolled-back',
        ok: false,
        note: '经 junction 回读不一致 ⇒ 断链并还原源,未删任何数据',
      }
    } catch {
      return {
        src: srcPath,
        action: 'STUCK',
        ok: false,
        note: `回读不一致且回退失败!源数据在 ${stash},请人工处理`,
      }
    }
  }
  rmSync(stash, { recursive: true, force: true })
  return { src: srcPath, action: 'moved', ok: true, note: `${snap.size} 个文件已改道并校验一致` }
}

export function plan(registry = registryOf(), home = homedir(), devEnv = devEnvRoot()) {
  return registry.map((r) => ({ src: r.p, dst: targetFor(r.p, home, devEnv), why: r.why }))
}

/**
 * 清理 stash(枚举面在门 96 的 `findStashes`,此处不抄第二份)。两型分开处理,因为**能不能自动收敛**完全不同:
 *  - link 型:改名后下一轮又把内容搬进目标、再建一次链接 ⇒ 留下第二个指同一目标的名字。
 *    它按定义没有独有数据,断链即可(`rmSync` 对重解析点只断链不穿透,§26 已实测)。
 *  - 实体目录型:里面**可能就是还没搬走的原始数据**。只有"当前 junction 回读到的内容逐文件
 *    覆盖了 stash"(允许目标更新、不许 stash 独有)才删;有任何独有/差异条目一律保留并如实报,
 *    交人判断 —— 猜不得。
 * @returns {{path:string,kind:string,action:string,ok:boolean,note:string}[]}
 */
export function pruneStashes(srcPath, dstPath, { apply = false } = {}) {
  return findStashes(srcPath).map((stash) => {
    let link = false
    try {
      link = lstatSync(stash).isSymbolicLink()
    } catch (e) {
      return {
        path: stash,
        kind: 'gone',
        action: 'skipped',
        ok: true,
        note: `读不到(${e.code || e.message})`,
      }
    }
    if (link) {
      if (!apply)
        return {
          path: stash,
          kind: 'link',
          action: 'would-prune',
          ok: true,
          note: '第二个指向同一目标的名字,无独有数据',
        }
      try {
        rmSync(stash, { force: true }) // 不加 recursive:对重解析点只需断链,加了反而像在暗示可以穿透
      } catch (e) {
        return {
          path: stash,
          kind: 'link',
          action: 'prune-failed',
          ok: false,
          note: `断链失败:${e.code || e.message}`,
        }
      }
      return {
        path: stash,
        kind: 'link',
        action: 'pruned',
        ok: true,
        note: '已断链(未触碰目标内容)',
      }
    }
    // 实体目录型:先证明"这里没有独有数据",才有资格删
    let st = null
    try {
      st = lstatSync(stash)
    } catch (e) {
      return {
        path: stash,
        kind: 'gone',
        action: 'skipped',
        ok: true,
        note: `读不到(${e.code || e.message})`,
      }
    }
    if (!st.isDirectory())
      // 指纹对非目录只会读出"空",那看起来像"被完整覆盖"⇒ 必须先看它到底是不是目录
      return {
        path: stash,
        kind: 'file',
        action: 'kept',
        ok: true,
        note: '既不是指针也不是目录 ⇒ 无法判断有无独有数据,不删',
      }
    if (!isLink(srcPath))
      return {
        path: stash,
        kind: 'dir',
        action: 'kept',
        ok: true,
        note: `${srcPath} 还不是指针 ⇒ stash 可能就是原始数据,不删`,
      }
    let inUse = null
    let held = null
    try {
      inUse = fingerprintTree(srcPath) // 经 junction 读在用内容
      held = fingerprintTree(stash)
    } catch {
      return { path: stash, kind: 'dir', action: 'kept', ok: true, note: '指纹读取失败,不删' }
    }
    const d = diffFingerprint(held, inUse)
    if (d.onlyA.length || d.differ.length)
      return {
        path: stash,
        kind: 'dir',
        action: 'kept',
        ok: true,
        note: `stash 有 ${d.onlyA.length} 个独有 / ${d.differ.length} 个字节不同条目 ⇒ 未删,需人工判断`,
      }
    if (!apply)
      return {
        path: stash,
        kind: 'dir',
        action: 'would-prune',
        ok: true,
        note: `${held.size} 个文件已被在用内容完整覆盖`,
      }
    try {
      rmSync(stash, { recursive: true, force: true })
    } catch (e) {
      return {
        path: stash,
        kind: 'dir',
        action: 'prune-failed',
        ok: false,
        note: `删除失败:${e.code || e.message}`,
      }
    }
    return {
      path: stash,
      kind: 'dir',
      action: 'pruned',
      ok: true,
      note: `${held.size} 个文件已确认无独有内容后删除`,
    }
  })
}

function selfTest() {
  const cases = []
  const push = (name, ok, note = '') => cases.push({ name, ok, note })

  // 目标命名:与 §26 已落地形态逐字一致
  const home = 'C:\\Users\\x'
  const dev = 'D:\\DevEnv'
  process.env.APPDATA = join(home, 'AppData', 'Roaming')
  process.env.LOCALAPPDATA = join(home, 'AppData', 'Local')
  push(
    '家目录项 → userhome/<原名>',
    targetFor(join(home, '.cargo'), home, dev) === join(dev, 'cache', 'userhome', '.cargo'),
  )
  push(
    '.ollama 特例 → cache/ollama',
    targetFor(join(home, '.ollama'), home, dev) === join(dev, 'cache', 'ollama'),
  )
  push(
    'APPDATA 项加 roaming 前缀',
    targetFor(join(process.env.APPDATA, 'npm'), home, dev) ===
      join(dev, 'cache', 'userhome', 'appdata-roaming-npm'),
  )
  push(
    'LOCALAPPDATA 项加 local 前缀',
    targetFor(join(process.env.LOCALAPPDATA, 'pnpm-cache'), home, dev) ===
      join(dev, 'cache', 'userhome', 'appdata-local-pnpm-cache'),
  )

  // 指纹:必须不穿透 junction(§26 头号危险)
  const root = mkdtempSync(join(tmpdir(), 'ihui-rehome-'))
  try {
    mkdirSync(join(root, 'a', 'b'), { recursive: true })
    writeFileSync(join(root, 'a', 'b', 'f.txt'), '12345', 'utf8')
    const fp = fingerprintTree(join(root, 'a'))
    push(
      '指纹按相对路径 + 字节记录',
      fp.size === 1 && fp.get('b/f.txt') === 5,
      [...fp.entries()].join(','),
    )
    push('同内容指纹相等', sameFingerprint(fp, fingerprintTree(join(root, 'a'))))
    writeFileSync(join(root, 'a', 'b', 'f.txt'), '12', 'utf8')
    push('字节数变了必须不等', !sameFingerprint(fp, fingerprintTree(join(root, 'a'))))
    push(
      'absent 项判 ok 且不动盘',
      repairOne(join(root, 'nope'), join(root, 'dst')).action === 'absent',
    )
    push(
      '--dry 不建目标目录',
      (() => {
        repairOne(join(root, 'a'), join(root, 'dst'), { dry: true })
        return !existsSync(join(root, 'dst'))
      })(),
    )

    // ── stash(改名现场)识别与清理:三型结论各不相同,否则"能自动收的"和"猜不得的"会混成一类 ──
    const sHome = join(root, 'home')
    const sDst = join(root, 'dstside')
    mkdirSync(sHome, { recursive: true })
    mkdirSync(sDst, { recursive: true })
    writeFileSync(join(sDst, 'k.txt'), '12345', 'utf8')
    const sSrc = join(sHome, '.demo')
    const mkj = run('cmd.exe', ['/c', 'mklink', '/J', sSrc, sDst])
    if (!isLink(sSrc)) {
      push(
        'stash 取证需要 junction(本机建不出来 ⇒ 这组判据未被覆盖)',
        false,
        `mklink rc=${mkj.status} ${mkj.stderr || ''}`,
      )
    } else {
      mkdirSync(join(sHome, '.demo.not-a-stash'), { recursive: true }) // 名字不匹配前缀 ⇒ 不得进清单
      writeFileSync(join(sHome, '.demo.pre-junction-aaa.txt'), 'keep me', 'utf8') // 前缀匹配,但是裸文件
      const linkStash = join(sHome, '.demo.pre-junction-bbb')
      run('cmd.exe', ['/c', 'mklink', '/J', linkStash, sDst]) // 前缀匹配,且是指针
      push(
        'findStashes 按名字前缀收,与类型无关(类型在清理那一步才分流)',
        JSON.stringify(findStashes(sSrc).map((p) => p.slice(sHome.length + 1))) ===
          JSON.stringify(['.demo.pre-junction-aaa.txt', '.demo.pre-junction-bbb']),
        findStashes(sSrc).join(','),
      )
      const dryPrune = pruneStashes(sSrc, sDst, { apply: false })
      push(
        '不带 --apply 一律只判、不落删',
        dryPrune.every((r) => r.action === 'would-prune' || r.action === 'kept') &&
          existsSync(linkStash),
        JSON.stringify(dryPrune),
      )
      const livePrune = pruneStashes(sSrc, sDst, { apply: true })
      push(
        'link 型 stash 断链后,目标内容必须一个字都没少(删链接不得穿透)',
        livePrune.some((r) => r.path === linkStash && r.action === 'pruned') &&
          !existsSync(linkStash) &&
          fingerprintTree(sDst).size === 1,
        JSON.stringify(livePrune),
      )
      push(
        '裸文件型 stash ⇒ 空指纹不等于"已被覆盖",一律保留',
        livePrune.some((r) => r.kind === 'file' && r.action === 'kept') &&
          existsSync(join(sHome, '.demo.pre-junction-aaa.txt')),
        JSON.stringify(livePrune),
      )
      // 实体目录型:含独有内容 ⇒ 保留;被在用内容逐文件覆盖 ⇒ 才可删
      const realStash = join(sHome, '.demo.pre-junction-ccc')
      mkdirSync(join(realStash, 'sub'), { recursive: true })
      writeFileSync(join(realStash, 'k.txt'), '12345', 'utf8')
      writeFileSync(join(realStash, 'sub', 'unique.bin'), 'only-here', 'utf8')
      push(
        '实体目录型 stash 有独有文件 ⇒ 一律保留,不删',
        (() => {
          const r = pruneStashes(sSrc, sDst, { apply: true })
          return r.some((x) => x.path === realStash && x.action === 'kept') && existsSync(realStash)
        })(),
      )
      rmSync(join(realStash, 'sub', 'unique.bin'), { force: true })
      rmdirSync(join(realStash, 'sub'))
      push(
        '实体目录型 stash 被在用内容逐文件覆盖(路径+字节全等)⇒ 才允许删',
        (() => {
          const r = pruneStashes(sSrc, sDst, { apply: true })
          return (
            r.some((x) => x.path === realStash && x.action === 'pruned') && !existsSync(realStash)
          )
        })(),
      )
      push(
        '源还不是指针时,目录型 stash 一律判保留(它可能就是原始数据)',
        (() => {
          mkdirSync(join(sHome, '.demo2'), { recursive: true })
          mkdirSync(join(sHome, '.demo2.pre-junction-ddd'), { recursive: true })
          const r = pruneStashes(join(sHome, '.demo2'), sDst, { apply: true })
          return (
            r.some((x) => x.action === 'kept' && x.note.includes('还不是指针')) &&
            existsSync(join(sHome, '.demo2.pre-junction-ddd'))
          )
        })(),
      )
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  // 登记表复用:修复器不得自带第二份清单
  const src = readFileSync(new URL(import.meta.url), 'utf8')
  push('清单复用门 96 的 registryOf()', /registryOf\(\)/.test(src) && !/\.cargo',\s*why/.test(src))
  push('盘符经 devEnvRoot() 推导,不写死', /devEnvRoot\(\)/.test(src))

  let fail = 0
  for (const c of cases) {
    if (!c.ok) fail++
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ` —— ${c.note}`}`)
  }
  console.log(`\n${fail ? `❌ ${fail} 例失败` : `全部 ${cases.length} 例通过`}`)
  process.exit(fail ? 1 : 0)
}

/** 冷却表:被进程占用(EBUSY)或仍在被写的项,30 分钟内不再重抄一遍几百 MB 去撞同一个失败。
 *  表由**修复器自己**读写 —— 只有它知道"哪项为什么失败";守护只负责触发。 */
const COOLDOWN_MS = 30 * 60 * 1000
export function cooldownPath(root) {
  return join(root, '.workbuddy', 'home-junctions-cooldown.json')
}
export function readCooldown(p) {
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const resetDst = argv.includes('--reset-dst')
  const items = plan()
  const coolFile = cooldownPath(ROOT)
  const cool = readCooldown(coolFile)
  const now = Date.now()
  const rows = []
  for (const it of items) {
    if (apply && cool[it.src] > now) {
      rows.push({
        ...it,
        src: it.src,
        action: 'cooldown',
        ok: true,
        note: `冷却中(剩 ${Math.ceil((cool[it.src] - now) / 60000)} 分钟)`,
      })
      continue
    }
    rows.push({ ...it, ...repairOne(it.src, it.dst, { dry: !apply, resetDst }) })
    if (apply && (rows.at(-1).action === 'rename-failed' || rows.at(-1).action === 'verify-failed'))
      cool[it.src] = now + COOLDOWN_MS
  }
  if (apply) {
    for (const k of Object.keys(cool)) if (cool[k] <= now) delete cool[k]
    try {
      mkdirSync(dirname(coolFile), { recursive: true })
      writeFileSync(coolFile, JSON.stringify(cool, null, 1), 'utf8')
    } catch {
      /* 冷却表写不进去不影响本轮修复 */
    }
  }
  const bad = rows.filter((r) => !r.ok)
  // stash 清理与"本轮有没有项要搬"无关:哪怕零搬运,也该把历史上留下的改名现场收掉 ——
  // 否则那个"指向在用目标的第二个名字"会永久留在家目录,而 §26 说清这类点的穿透危险。
  const stashRows = items.flatMap((it) => pruneStashes(it.src, it.dst, { apply }))
  const badStash = stashRows.filter((r) => !r.ok)
  const kept = stashRows.filter((r) => r.action === 'kept')
  const pruned = stashRows.filter((r) => r.action === 'pruned' || r.action === 'would-prune')
  const moved = rows.filter((r) => r.action === 'moved')
  const would = rows.filter((r) => r.action === 'would-move')
  console.log(
    `[re-home-junctions] ${apply ? 'APPLY' : 'CHECK ONLY'}:登记 ${rows.length} / 已改道 ${rows.filter((r) => r.action === 'link' && r.ok).length} / 待改道 ${would.length + moved.length} / 已改道成功 ${moved.length} / 冷却中 ${rows.filter((r) => r.action === 'cooldown').length} / stash ${pruned.length} 可清 ${kept.length} 保留 ${badStash.length} 失败 / 异常 ${bad.length}`,
  )
  for (const r of rows) {
    if (r.action === 'absent') continue
    console.log(`  ${r.ok ? '·' : '❌'} [${r.action}] ${r.src}  ${r.note}`)
  }
  for (const r of stashRows) {
    if (r.action === 'skipped') continue
    console.log(`  ${r.ok ? '·' : '❌'} [stash-${r.kind}-${r.action}] ${r.path}  ${r.note}`)
  }
  if (!apply && would.length)
    console.log(
      `\n  执行改道:node scripts/re-home-junctions.mjs --apply(逐文件校验通过才删源,失败一律回退)`,
    )
  process.exit(bad.length + badStash.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  plan,
  targetFor,
  fingerprintTree,
  sameFingerprint,
  diffFingerprint,
  repairOne,
  readCooldown,
  cooldownPath,
  findStashes,
  pruneStashes,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
