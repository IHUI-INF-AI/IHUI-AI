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
 *  1. 先镜像复制(源不动)→ **逐文件相对路径 + 字节 + sha256 内容**全量校验 → 源改名 → mklink /J
 *     → 经 junction 回读**再比一次内容** → 才删源。任一步不符即改名回退。
 *     "内容级"必须站在**每一道删除闸**上,不只站在复制校验上(G-411):改名后的回读与
 *     stash 清理的下一步都是 `rmSync` 不可逆删除,而尺寸全等、内容不同的树在两把
 *     只比 path+size 的尺子下与真镜像**同形**(c239421c9 只修了删源前的第一道闸,
 *     后两道仍钝 —— 本次收口)。校验只比**字节内容**:mtime/inode 属性不同不计内容差
 *     (robocopy 复制后两侧属性本就可能不同,拿它判不一致就是把门钝成另一型)。
 *  2. robocopy 返回码 0-7 为成功,**≥8 一律当失败**(非零码会出现"内容已搬走但不建 junction",
 *     路径直接消失 —— §26 记过一次凭据零丢失就是靠这条回读)。
 *  3. 全程不跟随重解析点统计体积(PowerShell 的 -Recurse 会穿透 junction,把 D 盘算成 C 盘的债)。
 *  4. 被占用的目录改名会失败 ⇒ 该项跳过并如实报原因(安全失败,不强删)。
 *  5. 不改任何环境变量、不碰 Path、不碰第三方 IDE 自管态(登记表本就不含 .workbuddy/.qoder-cn)。
 *
 * 用法:
 *   node scripts/re-home-junctions.mjs              # 只报告(零副作用)
 *   node scripts/re-home-junctions.mjs --apply      # 执行改道(幂等,可反复跑)
 *   node scripts/re-home-junctions.mjs --apply --no-cooldown
 *       # 人工已把占用者停下来时用它:上一轮的 EBUSY 冷却不得吞掉这个唯一窗口,
 *       #   且本轮仍失败时**不再续冷却**(否则下一次人工窗口照样被拦)。
 *   node scripts/re-home-junctions.mjs --self-test  # 逻辑自检(临时夹具,不碰真家目录)
 * 退出码:0 = 无 REAL-DIR 违规;1 = 仍有违规;2 = 脚本自身异常。
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { registryOf, findStashes, isInteractiveUserHome } from './check-home-junctions.mjs'
import { devEnvRoot } from './seal-c-root-stray.mjs'
import {
  fingerprintTree,
  sameFingerprint,
  digestFile,
  contentDiff,
  firstContentMismatch,
  diffFingerprint,
} from './lib/mirror-verify.mjs'
// 再导出:外部消费者(check-home-junctions / git-guardian / 镜像测试)按本模块名取用多年,
// 摘掉再导出等于替它们卸闸;实现只有一份 = ./lib/mirror-verify.mjs。
// 刻意不再导出 readdirSyncSafe / eachSameSizeFile —— 它们是链内的取材细节,原来也不是本模块的出口。
export {
  fingerprintTree,
  sameFingerprint,
  digestFile,
  contentDiff,
  firstContentMismatch,
  diffFingerprint,
}

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

function run(cmd, args, timeout = STEP_TIMEOUT_MS) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout, encoding: 'utf8' })
}

/** 单项改道。dry=true 时只报告要做什么,不动任何文件。
 *  resetDst=true 时先清空目标再复制 —— 只用于清掉**本工具自己**上一次失败留下的残留:
 *  校验只增不删会让"目标里有源里没有的文件"永远对不上(实测 .cargo 四轮都是源 21760/副本 21773,
 *  差 13 个稳定不变,证明是残留而非活目录在写)。删目标不影响源,源在通过校验前一个字都不动。 */
export function repairOne(srcPath, dstPath, { dry = false, resetDst = false } = {}) {
  // **判序即判据**:必须先 isLink(lstat)再 existsSync。悬空 junction 的 existsSync 为 **false**
  //   (它跟随重解析点,而目标已被外部删掉),按"源不存在"早退就把这一型判成无需修 ——
  //   2026-09-24 演练实测:门 96 判的是 `!existsSync(p) && !isLink(p)`(两半都有),
  //   修复器第一版只抄了前半,于是"门按 lstat 判红、修复器按 exists 判 absent",
  //   两边各自都不算错,合起来却是"恒红 + 永不自愈"。同一判据在两处必须同形。
  //   第一版我把成因说成 isLink 分支早退,那是个假根因:补完那个分支后自检仍红,才暴露拦在前面的是这一行。
  if (isLink(srcPath)) {
    // **判序补一条(2026-10-03,102 封同因告警根治)**:比"指向"必须排在 `existsSync(dstPath)`
    //   早退**之前**。G:\DevEnv → G:\IHUI-AI\.DevEnv 搬迁漏了 3 个 APPDATA 项,它们的 junction
    //   仍指旧根(旧根只剩空壳 Temp)⇒ 门 96 判 `DANGLING`(statSync 跟随重解析点,目标不存在)
    //   判红零误判,而新根下 3 个目标**确实都在且有数据** ⇒ 旧序第 122 行直接早退成
    //   「已是指针且目标在位 / ok:true」,下面那条 `link-moved` 分支变成**死代码**。
    //   后果是三重的:① ok:true 不进冷却表(邮件详情恒为「冷却项 0 个」);② 不打 `[failed]`
    //   标签 ⇒ git-guardian 的 why 拼装拿到空串,恒为「修复器未给出失败标签」;
    //   ③ 收信人按正文给的 `手动:re-home-junctions.mjs --check` 跑,得到 exit 0 假绿
    //   ⇒ **102 封信换不来一次整改**,不是收信人懒,是出口把它引到"没问题"的结论上。
    //   与本函数 114-120 行记的 2026-09-24 同型事故同源(门与修复器口径分叉 ⇒ 恒红 + 永不自愈),
    //   只是上次是"源判 absent"、这次是"dst 判在位"。**教训没有被机制化成断言,所以换了形状复发。**
    let pointedEarly = null
    try {
      pointedEarly = resolve(readlinkSync(srcPath))
    } catch {
      pointedEarly = null
    }
    if (pointedEarly && resolve(pointedEarly) !== resolve(dstPath))
      return {
        src: srcPath,
        action: 'link-moved',
        ok: false,
        note: `指针指向别处(${pointedEarly})而非登记表算出的 ${dstPath} ⇒ 不擅自改指向,交人工判断`,
      }
    if (existsSync(dstPath))
      return { src: srcPath, action: 'link', ok: true, note: '已是指针且目标在位' }
    // **悬空指针必须能修** —— 这是 §26 最可能的失败形态:改道树被外部清掉,链接留在原地。
    //   只重建**空目录**并如实说明内容已失(数据在删除那一刻就没了,重建不掩盖、只是让
    //   路径重新可用 —— 多数工具遇到自己的 home 目录不存在会直接崩)。
    let pointed = null
    try {
      pointed = resolve(readlinkSync(srcPath))
    } catch {
      pointed = null
    }
    if (pointed && pointed !== resolve(dstPath))
      return {
        src: srcPath,
        action: 'link-moved',
        ok: false,
        note: `指针指向别处(${pointed})而非登记表算出的 ${dstPath} ⇒ 不擅自改指向,交人工判断`,
      }
    if (dry)
      return {
        src: srcPath,
        action: 'would-recreate-target',
        ok: true,
        note: `目标缺失,将重建空目录 ${dstPath}`,
      }
    try {
      mkdirSync(dstPath, { recursive: true })
    } catch (e) {
      return {
        src: srcPath,
        action: 'recreate-failed',
        ok: false,
        note: `重建目标失败:${e.code || e.message}`,
      }
    }
    return {
      src: srcPath,
      action: 'target-recreated',
      ok: true,
      note: `⚠️ 目标曾被外部删除,已重建空目录 ${dstPath}(**内容已失**,工具会自行回填缓存;非缓存态需人工确认)`,
    }
  }
  if (!existsSync(srcPath))
    return { src: srcPath, action: 'absent', ok: true, note: '源不存在,无需改道' }
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

  // 2b) **删源之前**的内容级对账。上面那层只比"路径 + 字节数",同尺寸不同内容会一路通过,
  //     而这一层的下一步就是把源删掉 —— 校验只到"大小一致"不等于 §26 承诺的逐字节校验。
  //     不一致 ⇒ 不建 junction、不改名、不删任何东西(失败即退避由 shouldCool 统一判)。
  const contentMismatch = contentDiff(srcPath, dstPath, snap, fingerprintTree(dstPath))
  if (contentMismatch.length > 0)
    return {
      src: srcPath,
      action: 'verify-content-failed',
      ok: false,
      note:
        `尺寸全等但内容不同(${contentMismatch.length} 个起,例:${contentMismatch.slice(0, 3).join(', ')})` +
        ' ⇒ 不建 junction、不删源;多半是复制期被写入或目标指向了另一个已有数据的目录,交人工判',
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
  // 5b) 删 stash(= 改名前的**原始源**)之前的最后一道内容闸(G-411)。
  //     上面 2b 那次 contentDiff 与这里之间隔着"复制收尾→改名→建链"一整段时间窗:
  //     源在被持续写入时,完全可能"窗口前同尺寸同内容、窗口后同尺寸不同内容"
  //     (截断/覆盖写都会先保住旧字节数再变)。这一步的下一步是 rmSync(stash) ——
  //     仓库里最不可逆的一删,所以判据必须站在这里,而不是只站在删源前的第一道闸上。
  //     对照面用 stash(改名只是换名,字节原地不动),根因写进 note 交人工判。
  const readbackMismatch = firstContentMismatch(stash, srcPath, snap, through)
  if (readbackMismatch !== null) {
    rmSync(srcPath, { force: true }) // 只断链,不穿透
    try {
      renameSync(stash, srcPath)
      return {
        src: srcPath,
        action: 'rolled-back',
        ok: false,
        note: `经 junction 回读尺寸全等而内容不同(首个不一致:${readbackMismatch})⇒ 断链并还原源,未删任何数据;多半是校验之后源又被写入`,
      }
    } catch {
      return {
        src: srcPath,
        action: 'STUCK',
        ok: false,
        note: `内容回读不一致且回退失败!源数据在 ${stash}(不一致样本:${readbackMismatch}),请人工处理`,
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
 *    覆盖了 stash"(**路径 + 字节数 + sha256 内容**三层全等;允许目标更新、不许 stash 独有)
 *    才删;有任何独有/尺寸差/内容差条目一律保留并如实报,交人判断 —— 猜不得。
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
    // G-411:path+size 全等**不构成**"stash 无独有数据"的证明 —— 同尺寸不同内容的文件
    //   在这一层与真镜像同形,而下一步是 rmSync(stash, recursive)。删之前逐文件比 sha256,
    //   任一处不同(或读不到)一律保留并点名;可中断(第一条不一致即返回,不读完几百 GB)。
    //   dry 档也照此判:报告不得承诺一个 apply 时不敢做的删除("看起来能清"也是一种误导)。
    const badRel = firstContentMismatch(stash, srcPath, held, inUse)
    if (badRel !== null)
      return {
        path: stash,
        kind: 'dir',
        action: 'kept',
        ok: true,
        note: `尺寸清单全等而内容不同(首个不一致:${badRel})⇒ 未删,需人工判断(stash 可能就是原始数据)`,
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

  // 指纹:必须不穿透 junction(§26 头号危险)。夹具落点 = §26 唯一出口,不得用 os.tmpdir()。
  const root = mkScratch('ihui-rehome-')
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

    // 内容级对账(2026-09-28 A1):指纹只到"字节数",同尺寸不同内容必须被这一层拦下。
    mkdirSync(join(root, 'c1'), { recursive: true })
    mkdirSync(join(root, 'c2'), { recursive: true })
    writeFileSync(join(root, 'c1', 'same-size.txt'), 'AAAA', 'utf8')
    writeFileSync(join(root, 'c2', 'same-size.txt'), 'BBBB', 'utf8') // 同尺寸、不同字节
    writeFileSync(join(root, 'c1', 'other.txt'), 'xxxxxxxx', 'utf8')
    writeFileSync(join(root, 'c2', 'other.txt'), 'yyyyyyyy', 'utf8')
    const f1 = fingerprintTree(join(root, 'c1'))
    const f2 = fingerprintTree(join(root, 'c2'))
    push(
      '阳性对照:尺寸全等而内容不同必须被点名',
      f1.size === 2 &&
        sameFingerprint(f1, f2) === true && // 老那一层看不出问题 —— 这正是缺陷存在的原因
        contentDiff(join(root, 'c1'), join(root, 'c2'), f1, f2).length === 2,
      JSON.stringify(contentDiff(join(root, 'c1'), join(root, 'c2'), f1, f2)),
    )
    const f3 = fingerprintTree(join(root, 'c1'))
    push(
      '反向对照:尺寸已不同时本层不重复报(交给 sameFingerprint,否则两处各喊一次)',
      contentDiff(join(root, 'c1'), join(root, 'c1'), f3, new Map([['other.txt', 1]])).length === 0,
    )
    push(
      '读不到 = 不能证明相同 ⇒ 计入不同(不猜"应该一样")',
      contentDiff(
        join(root, 'c1'),
        join(root, 'c1'),
        new Map([['ghost.txt', 4]]),
        new Map([['ghost.txt', 4]]),
      ).length === 1,
    )
    push(
      '摘要稳定且能区分内容',
      digestFile(join(root, 'c1', 'same-size.txt')) ===
        digestFile(join(root, 'c1', 'same-size.txt')) &&
        digestFile(join(root, 'c1', 'same-size.txt')) !==
          digestFile(join(root, 'c2', 'same-size.txt')),
    )
    // G-411:删源/删 stash 前的最终内容闸专用判据(可中断 ⇒ 首条不一致即返回)。
    push(
      'firstContentMismatch:同尺寸不同内容⇒点名第一条 / 全等⇒null / 读不到⇒点名(不能证明相同)',
      (() => {
        const bad = firstContentMismatch(join(root, 'c1'), join(root, 'c2'), f1, f2)
        const allSame = firstContentMismatch(join(root, 'c1'), join(root, 'c1'), f1, f1)
        const ghost = firstContentMismatch(
          join(root, 'c1'),
          join(root, 'c1'),
          new Map([['ghost.txt', 4]]),
          new Map([['ghost.txt', 4]]),
        )
        return bad !== null && allSame === null && ghost === 'ghost.txt'
      })(),
    )
    push(
      '装车锁:两道"删之前"的内容闸必须真的排在 rmSync(stash 之前(只测函数等于测自己)',
      (() => {
        const s2 = readFileSync(fileURLToPath(import.meta.url), 'utf8')
        const repairBody = s2.slice(
          s2.indexOf('export function repairOne'),
          s2.indexOf('export function plan'),
        )
        const atGate = repairBody.indexOf('firstContentMismatch(')
        const atRm = repairBody.indexOf('rmSync(stash, { recursive')
        const pruneBody = s2.slice(
          s2.indexOf('export function pruneStashes'),
          s2.indexOf('function selfTest'),
        )
        const pGate = pruneBody.indexOf('firstContentMismatch(')
        const pRm = pruneBody.indexOf('rmSync(stash, { recursive')
        return atGate > 0 && atRm > atGate && pGate > 0 && pRm > pGate
      })(),
    )
    // 装车锁:闸门必须真的排在"改名/删源"之前 —— 只测函数等于测自己,所以这里锁调用顺序。
    push(
      'repairOne 体内 contentDiff 必须排在源改名之前(否则内容校验对删除不起作用)',
      (() => {
        const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
        const body = src.slice(src.indexOf('export function repairOne'))
        const atGate = body.indexOf('contentDiff(')
        const atRename = body.indexOf('renameSync(srcPath, stash)')
        return atGate > 0 && atRename > atGate
      })(),
    )
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

    // 悬空指针必须能修 —— 2026-09-24 故障演练抓出的空洞:第一版见到 isLink 就早退,
    // 于是"改道树被外部删掉"这一**最可能**的失败形态下,守护跑完什么都不补、门 96 恒红。
    const dkSrc = join(root, 'dangling-home')
    const dkDst = join(root, 'dangling-target')
    mkdirSync(dkDst, { recursive: true })
    writeFileSync(join(dkDst, 'k.txt'), 'abc', 'utf8')
    const mk = spawnSync(GIT_BASH, ['/c', 'mklink', '/J', dkSrc, dkDst], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
    push('夹具 junction 建成', isLink(dkSrc), `rc=${mk.status} ${mk.stderr || mk.stdout || ''}`)
    if (isLink(dkSrc)) {
      rmSync(dkDst, { recursive: true, force: true }) // 只删目标(断的是链),源链接保留
      const dryRow = repairOne(dkSrc, dkDst, { dry: true })
      push(
        '悬空 + dry ⇒ 只报告,不擅自建目录',
        dryRow.action === 'would-recreate-target' && dryRow.ok && !existsSync(dkDst),
        JSON.stringify(dryRow),
      )
      const row = repairOne(dkSrc, dkDst)
      push(
        '悬空 ⇒ 重建目标空目录并判 ok(绝不静默早退)',
        row.action === 'target-recreated' && row.ok && existsSync(dkDst),
        JSON.stringify(row),
      )
      push('重建必须是断链不穿透(源链接仍在)', isLink(dkSrc) && !existsSync(join(dkSrc, 'k.txt')))
      push('重建后指纹为空目录而非"读不到"', fingerprintTree(dkSrc).size === 0)

      // 指向别处的指针不得被"顺手改指向" —— 那等于替人工决定数据落点
      const other = join(root, 'somewhere-else')
      const rowMoved = repairOne(dkSrc, other)
      push(
        '指针指向与登记表算出的目标不一致 ⇒ 判红交人工,不改指向',
        rowMoved.action === 'link-moved' && !rowMoved.ok && !existsSync(other),
        JSON.stringify(rowMoved),
      )
    }

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
        '实体目录型 stash 被在用内容逐文件覆盖(路径+字节+内容全等)⇒ 才允许删',
        (() => {
          const r = pruneStashes(sSrc, sDst, { apply: true })
          return (
            r.some((x) => x.path === realStash && x.action === 'pruned') && !existsSync(realStash)
          )
        })(),
      )
      push(
        'G-411 阳性对照:目录型 stash 与在用内容同尺寸而不同内容 ⇒ apply 也必须保留,不许删',
        (() => {
          const sizeEqDiff = join(sHome, '.demo.pre-junction-eee')
          mkdirSync(sizeEqDiff, { recursive: true })
          writeFileSync(join(sizeEqDiff, 'k.txt'), 'abcde', 'utf8') // 与在用 k.txt 同为 5 字节、内容不同
          const r = pruneStashes(sSrc, sDst, { apply: true })
          const row = r.find((x) => x.path === sizeEqDiff)
          const keptIt = Boolean(row && row.action === 'kept' && existsSync(sizeEqDiff))
          rmSync(sizeEqDiff, { recursive: true, force: true }) // 夹具自清,不留残留
          return keptIt
        })(),
      )
      push(
        'dry 档同样受内容闸约束:报告不得承诺一个 apply 时不敢做的删除',
        (() => {
          const dryDiff = join(sHome, '.demo.pre-junction-fff')
          mkdirSync(dryDiff, { recursive: true })
          writeFileSync(join(dryDiff, 'k.txt'), 'zzzzz', 'utf8') // 同尺寸不同内容
          const r = pruneStashes(sSrc, sDst, { apply: false })
          const row = r.find((x) => x.path === dryDiff)
          const keptIt = Boolean(row && row.action === 'kept' && existsSync(dryDiff))
          rmSync(dryDiff, { recursive: true, force: true })
          return keptIt
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
    rmScratch(root)
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
/** 哪些结果要进冷却。**一条规则:失败即退避** —— 判据写成"哪几种 action 算失败"的名单,
 *  就一定会漏掉名单之外的那一种,而漏掉的那一种正好是 10 秒一趟重抄几百 MB 的那一种
 *  (2026-09-27 实测:旧名单只有 rename-failed / verify-failed,copy-failed 不在表内,
 *  于是守护两小时刷了 1.3 万行同一句话)。抽成纯函数是为了能被直接测到:
 *  只锁源码形状等于证明"那行字还在",不证明"这一类结果真的会退避"。 */
export function shouldCool(row) {
  return Boolean(row) && row.ok === false
}
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
  // 冷却表是为**守护的自动重试**设计的(每 2 分钟撞同一个 EBUSY 没有意义),但它不得拦住
  // 人工创造的窗口。2026-09-24 实测:`.codex` 被 Codex 的 LocalSystem 服务终身占用,
  // 人工把服务停下来跑 `--apply`,却被上一轮的冷却判成"跳过"—— 冷却把唯一可行的时机吞掉了。
  const noCooldown = argv.includes('--no-cooldown')
  if (!isInteractiveUserHome(homedir())) {
    // 搬运工具比判定门更要有这道闸:门判错只是报告错,这里判错会**动文件**。
    // 在 LocalSystem 这类身份下 plan() 算出的是 `C:\Windows\System32\config\systemprofile\...`
    // 那一批路径,而 targetFor() 算出的落点仍是同一棵改道树 —— 于是"把系统账户的目录搬进
    // 真人正在用的缓存树"这一动作,在旧实现里是**会被真真切切发起的**(2026-09-27 实测由
    // 守护每 10 秒发起一次,那次 robocopy 恰好失败才没落地)。
    // 出口取 0 而非 2:这不是仓库故障也不是判定失败,是"这个执行体不在射程内";
    // 但绝不打印 CHECK/APPLY 那行汇总,免得读报告的人把它当成"16 项都好"。
    console.log(
      `未判定:执行身份的家目录 ${homedir()} 不是交互用户配置目录(<盘>:\\Users\\<名>)⇒ 登记表算出的是另一批路径,本工具拒绝搬运(不写冷却表、不动任何文件)。要修真人账户的改道,请以该账户登录或以其身份调度。`,
    )
    return 0
  }
  const items = plan()
  const coolFile = cooldownPath(ROOT)
  const cool = readCooldown(coolFile)
  const now = Date.now()
  const rows = []
  for (const it of items) {
    if (apply && !noCooldown && cool[it.src] > now) {
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
    // **任何**失败项都要进冷却。旧判据只认 rename-failed / verify-failed 两种标签,于是
    // copy-failed(robocopy 自己失败)不进表 —— 而常驻守护是 10 秒一趟,结果就是 2026-09-27
    // 实测到的那个循环:同一项每 10 秒重抄一遍几百 MB 去撞同一个失败,日志 12 秒一条、
    // 两小时刷了 1.3 万行,并为人邮件已发过一封。"哪几种失败算需要退避"是名单,
    // 名单会漏掉自己立项那一型(本仓记过最多次的失效型)—— 所以判据改成一条规则:失败即退避。
    // --no-cooldown 时**不再新添**冷却条目(人工窗口失败要能立刻再试),但**保留既有条目**:
    //   守护每 10 秒一次的自动重试仍会被它拦住。
    if (apply && !noCooldown && shouldCool(rows.at(-1))) cool[it.src] = now + COOLDOWN_MS
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
  shouldCool,
  fingerprintTree,
  sameFingerprint,
  diffFingerprint,
  digestFile,
  contentDiff,
  firstContentMismatch,
  repairOne,
  readCooldown,
  cooldownPath,
  findStashes,
  pruneStashes,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
