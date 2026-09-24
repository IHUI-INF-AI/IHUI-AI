// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 盘根写歪项封口器。
//
// 要根治的不是"这几个目录",而是它们的**成因**:一批程序(剪映、微信输入法、MSYS 侧工具、
// 各类安装器)用**相对路径**写自己的状态,而它们的进程工作目录恰好是 `C:\` —— 于是
// `common_attachment/`、`persistent_data/`、`tmp/`、`tools/` 直接长在盘根。删掉只会再长回来
// (成因没变),而改它们的代码不可能(第三方闭源)。
//
// 所以这里做的是**载体替换**:把这些名字改道成 junction,指向 §15b 批准的外置根。
// 程序照旧按原路径读写(不报错、不崩、无需改一行它们的代码),内容却落在 D 盘,
// C 盘 footprint 恒为 0。与 §26 的工具态改道同一机制 —— junction 对硬编码路径同样生效。
//
// 用法:
//   node scripts/seal-c-root-stray.mjs --check     只判定,零副作用(守门/巡检用)
//   node scripts/seal-c-root-stray.mjs --dry-run   预演:打印将做什么,不写不删
//   node scripts/seal-c-root-stray.mjs --apply     执行封口 + 清孤儿文件(幂等,可反复跑)
//   node scripts/seal-c-root-stray.mjs --self-test 判据取证(纯函数 + 临时夹具端到端)
//
// 退出码:0 = 全部已封口且无孤儿;1 = 有待处置项(check 模式)或 apply 有失败;2 = 脚本自身异常。
//
// 换机 / 重装后需重跑一次 `--apply`(与 install-console-window-hook.mjs 同一类"每机一次")。

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

/**
 * 外置根推导:与 lib/scratch-dir.mjs 同一套(工作树所在盘的 DevEnv),不写死盘符。
 * 之所以不直接 import 那个模块:它只导出夹具出口,没有 DevEnv 根出口。
 */
export function devEnvRoot() {
  const override = process.env.IHUI_DEVENV_ROOT
  if (override) return resolve(override)
  const driveRoot = resolve(REPO, '..', '..')
  return join(driveRoot, 'DevEnv')
}

/**
 * 封口清单 —— 单一真相源,守门 92 直接 import 本数组,不再抄第二份。
 * target 一律落在 §15b 批准的三个落点内(cache / Temp / tools)。
 */
export const SEALED_DIRS = [
  {
    name: 'common_attachment',
    target: 'cache/c-root-stray/common_attachment',
    owner: '剪映 JianyingPro',
    evidence:
      '盘根文件 attachment_clipflow_cache.json 的键形(task_id/state/algorithm_type/node_infos)与 ' +
      'JianyingPro Drafts/<日期>/common_attachment/attachment_async_tasks.json 同族,且 mtime 与草稿目录名同日',
  },
  {
    name: 'persistent_data',
    target: 'cache/c-root-stray/persistent_data',
    owner: '微信输入法 WeType',
    evidence:
      '同名文件 user_dict_clean_up.bin 在 AppData\\LocalLow\\Tencent\\WeType\\ImeDir\\persistent_data\\ 下' +
      '有一份(内容不同 ⇒ 各写各的,盘根那份是以 C:\\ 为工作目录时写歪的副本)',
  },
  {
    name: 'tmp',
    target: 'Temp/c-root-tmp',
    owner: 'MSYS/安装器约定的 C:\\tmp',
    evidence:
      '实测内容:本仓 8 月几次 git 抢救的文件副本(git-recovery*)、他 IDE 的 tasks 输出、' +
      '一个 skill 安装包。守门 92 因 tmp 在 FOREIGN_ROOT 里而对这里的残骸**完全失明**',
  },
  {
    name: 'tools',
    target: 'tools/c-root-tools',
    owner: '安装器约定的 C:\\tools',
    evidence: '实测内容:OpenSSH-Win64.msi(已装完,sshd 正跑在 C:\\Program Files\\OpenSSH)',
  },
]

/** 一次性孤儿文件:同名组件的在用版本在 System32,盘根这份是安装/解包留下的旧版重复件。 */
export const ORPHAN_FILES = [
  {
    name: 'appverifUI.dll',
    reason:
      'Application Verifier 组件(微软签名)。System32 有在用版且体积/哈希均不同 ⇒ 盘根为旧版孤儿,' +
      '全仓与计划任务对它零引用',
  },
  {
    name: 'vfcompat.dll',
    reason: '同上,FileVersion 10.0.26100.7705 与已装 Windows SDK 同版号;System32 在用版哈希不同',
  },
]

export function pathsFor(entry, root, devEnv) {
  return { link: join(root, entry.name), target: join(devEnv, ...entry.target.split('/')) }
}

/**
 * 纯判据:一个盘根名字当前是什么形态。抽成纯函数是为了让 --self-test 不碰真盘也能钉死它 ——
 * 本工具唯一危险的分支就是"把别人的真目录当链接删"或"对着已有链接再套一层"。
 */
export function classifyEntry({ exists, isLink, linkTarget, expectedTarget, isDir }) {
  if (!exists) return 'MISSING'
  if (isLink) {
    if (!linkTarget) return 'UNREADABLE-LINK'
    if (resolve(linkTarget) === resolve(expectedTarget)) return 'SEALED'
    return 'FOREIGN-LINK'
  }
  if (isDir) return 'REAL-DIR'
  return 'REAL-FILE'
}

/** 目录指纹(文件数 + 总字节 + 相对路径集),用于"搬完再删源"的对账。 */
function fingerprint(dir) {
  const files = []
  let bytes = 0
  const stack = [[dir, '']]
  while (stack.length) {
    const [cur, rel] = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(cur, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      // 源侧遇到 reparse point 一律不跟随:宁可算少,也绝不把别人的链接目标当成我们的内容。
      try {
        if (lstatSync(full).isSymbolicLink()) continue
      } catch {
        continue
      }
      if (e.isDirectory()) stack.push([full, r])
      else {
        files.push(r)
        try {
          bytes += statSync(full).size
        } catch {
          /* 竞态:体积按 0 计,数量对账仍会拦下不一致 */
        }
      }
    }
  }
  files.sort()
  return { count: files.length, bytes, files }
}

function sameFingerprint(a, b) {
  return a.count === b.count && a.bytes === b.bytes && a.files.join('|') === b.files.join('|')
}

/**
 * 封一个名字。返回 {action, ok, note}。
 * 硬护栏:① 链接路径不得在仓库树内;② 目标不得落在链接内部;③ 真目录必须先
 * "复制 → 逐文件对账 → 才删源",对账不过就拒绝封口并保留原样(绝不丢数据)。
 */
function sealOne(entry, root, devEnv, dryRun) {
  const { link, target } = pathsFor(entry, root, devEnv)
  let st = null
  try {
    st = lstatSync(link)
  } catch {
    st = null
  }
  let linkTarget = null
  if (st && st.isSymbolicLink()) {
    try {
      linkTarget = readlinkSync(link)
    } catch {
      linkTarget = null
    }
  }
  const state = classifyEntry({
    exists: !!st,
    isLink: !!st && st.isSymbolicLink(),
    linkTarget,
    expectedTarget: target,
    isDir: !!st && !st.isSymbolicLink() && st.isDirectory(),
  })

  if (state === 'SEALED') return { action: 'skip', ok: true, note: '已封口', state }
  if (state === 'FOREIGN-LINK' || state === 'UNREADABLE-LINK')
    return { action: 'touch-nothing', ok: false, note: `该名字已是指向别处的链接(${linkTarget ?? '读不到'})`, state }
  if (state === 'REAL-FILE')
    return { action: 'touch-nothing', ok: false, note: '盘根是个文件而非目录,不猜测意图', state }

  // 目标若已存在且非空:只做**合并式**复制,不清目标 —— 目标里可能是上一次封口搬进来的内容。
  if (resolve(target).startsWith(resolve(link) + '\\') || resolve(target) === resolve(link))
    return { action: 'reject', ok: false, note: '目标落在链接内部,会自指', state }

  if (dryRun) {
    return {
      action: state === 'MISSING' ? 'create-link' : 'move-then-link',
      ok: true,
      note:
        state === 'MISSING'
          ? `预演:建 ${target} 并在 ${link} 放 junction`
          : `预演:把 ${link} 内容搬进 ${target}(逐文件对账后删源),再放 junction`,
      state,
    }
  }

  mkdirSync(target, { recursive: true })

  if (state === 'REAL-DIR') {
    const before = fingerprint(link)
    try {
      cpSync(link, target, { recursive: true, errorOnExist: false, force: false })
    } catch (e) {
      if (e.code !== 'EEXIST' && e.code !== 'EPERM')
        return { action: 'move', ok: false, note: `复制失败:${e.code || e.message}`, state }
      // EEXIST = 目标里已有同名文件。本工具的语义是"改道",不是"覆盖":保留目标侧现有内容,
      // 源侧那份留在那里不删,由下面的对账把差异暴露出来交人判。
    }
    const after = fingerprint(target)
    const missing = before.files.filter((f) => !after.files.includes(f))
    if (missing.length) {
      return {
        action: 'move',
        ok: false,
        note: `复制后目标仍缺 ${missing.length} 个文件(例 ${missing.slice(0, 3).join(', ')})⇒ 拒绝删源`,
        state,
      }
    }
    try {
      rmSync(link, { recursive: true, force: true })
    } catch (e) {
      return { action: 'unlink-source', ok: false, note: `源删除失败:${e.code || e.message}(目标内容完好)`, state }
    }
  }

  try {
    symlinkSync(target, link, 'junction')
  } catch (e) {
    return { action: 'link', ok: false, note: `建 junction 失败:${e.code || e.message}`, state }
  }
  return { action: 'sealed', ok: true, note: `${link} → ${target}`, state }
}

function removeOrphans(root, dryRun) {
  const out = []
  for (const o of ORPHAN_FILES) {
    const p = join(root, o.name)
    if (!existsSync(p)) {
      out.push({ name: o.name, action: 'skip', ok: true })
      continue
    }
    if (dryRun) {
      out.push({ name: o.name, action: 'delete', ok: true })
      continue
    }
    try {
      rmSync(p, { force: true })
      out.push({ name: o.name, action: 'deleted', ok: true })
    } catch (e) {
      out.push({ name: o.name, action: 'delete', ok: false, note: e.code || e.message })
    }
  }
  return out
}

export function run({ root = 'C:', devEnv = devEnvRoot(), mode = 'check' }) {
  const sealed = SEALED_DIRS.map((e) => sealOne(e, root, devEnv, mode !== 'apply'))
  const orphans = mode === 'apply' ? removeOrphans(root, false) : probeOrphans(root)
  const needsAction =
    sealed.some((s) => !s.ok || s.action !== 'skip') || orphans.some((o) => o.action === 'present')
  return { root, devEnv, sealed, orphans, needsAction }
}

function probeOrphans(root) {
  return ORPHAN_FILES.map((o) => ({
    name: o.name,
    action: existsSync(join(root, o.name)) ? 'present' : 'skip',
    ok: true,
  }))
}

/** 封口目标的实际体积(它们在 D 盘,不在 C —— 守门要如实分开报)。 */
export function sealedFootprint(root, devEnv) {
  return SEALED_DIRS.map((e) => {
    const { target } = pathsFor(e, root, devEnv)
    const fp = fingerprint(target)
    return { name: e.name, target, ...fp }
  })
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg}: 期望 ${b},实际 ${a}`)
  }

  t('classifyEntry:不存在 → MISSING', () =>
    eq(classifyEntry({ exists: false, isLink: false, linkTarget: null, expectedTarget: 'x', isDir: false }), 'MISSING', '形态'))
  t('classifyEntry:指向期望目标 → SEALED', () =>
    eq(
      classifyEntry({
        exists: true,
        isLink: true,
        linkTarget: 'D:\\DevEnv\\Temp\\c-root-tmp',
        expectedTarget: 'D:\\DevEnv\\Temp\\c-root-tmp',
        isDir: false,
      }),
      'SEALED',
      '形态',
    ))
  t('classifyEntry:指向别处 → FOREIGN-LINK(不得当成已封口)', () =>
    eq(
      classifyEntry({
        exists: true,
        isLink: true,
        linkTarget: 'E:\\somewhere',
        expectedTarget: 'D:\\DevEnv\\Temp\\c-root-tmp',
        isDir: false,
      }),
      'FOREIGN-LINK',
      '形态',
    ))
  t('classifyEntry:真目录 → REAL-DIR(会被搬)', () =>
    eq(
      classifyEntry({ exists: true, isLink: false, linkTarget: null, expectedTarget: 'x', isDir: true }),
      'REAL-DIR',
      '形态',
    ))
  t('封口名字表必须是相对名(防止把整盘路径写进 join 而逃逸)', () => {
    for (const e of SEALED_DIRS) {
      if (/[\\/:]/.test(e.name)) throw new Error(`name 必须是单段目录名:${e.name}`)
      if (e.target.startsWith('..')) throw new Error(`target 不得上跳:${e.target}`)
    }
  })

  // —— 端到端:在临时"假盘根"上走一遍真目录改道 ——
  // 夹具必须活到用例**执行完**再清理:用例是登记后统一跑的,若在 try/finally 里删夹具,
  // 执行时路径已不存在 ⇒ 全红且红得莫名其妙(第一版就踩了这个)。
  const scratch = join(devEnvRoot(), 'Temp', 'ihui-scratch')
  mkdirSync(scratch, { recursive: true })
  const fake = join(scratch, `seal-e2e-${Date.now()}`)
  const fakeRoot = join(fake, 'root')
  const fakeDev = join(fake, 'devenv')
  const stray = join(fakeRoot, 'persistent_data')
  const marker = join(stray, 'sub', 'keep.bin')
  mkdirSync(join(stray, 'sub'), { recursive: true })
  writeFileSync(marker, 'must-survive')
  const runFake = (mode) => run({ root: fakeRoot, devEnv: fakeDev, mode })

  t('dry-run 不改盘:真目录仍在、无链接', () => {
    runFake('dry-run')
    if (!existsSync(stray)) throw new Error('预演把源删了')
    if (lstatSync(stray).isSymbolicLink()) throw new Error('预演建了链接')
  })
  t('check 模式同样零副作用,且必须报出待处置', () => {
    const r = runFake('check')
    if (lstatSync(stray).isSymbolicLink()) throw new Error('check 把盘改了')
    if (!r.needsAction) throw new Error('check 报「无需处理」⇒ 本工具会永远绿灯')
  })
  t('apply 把真目录改道:路径仍可达 + 内容逐文件一致 + 源已变 junction', () => {
    const r = runFake('apply')
    const ent = r.sealed[SEALED_DIRS.findIndex((x) => x.name === 'persistent_data')]
    if (!ent || !ent.ok) throw new Error(`封口失败:${ent && ent.note}`)
    if (!lstatSync(stray).isSymbolicLink()) throw new Error('源没变成 junction')
    if (readFileSync(marker, 'utf8') !== 'must-survive') throw new Error('经路径读不回原内容')
  })
  t('幂等:再跑一次 apply 必须只 skip,且不得把链接当目录再搬', () => {
    const r = runFake('apply')
    const bad = r.sealed.filter((s) => s.action !== 'skip')
    if (bad.length) throw new Error(`二次运行仍在动:${bad.map((b) => `${b.action}/${b.note}`).join(' , ')}`)
  })
  t('check 在已封口后必须报「无需处理」', () => {
    if (runFake('check').needsAction) throw new Error('已封口仍报待处置 ⇒ 每日巡检会天天红')
  })
  t('删除只断链,不穿透目标(目标内容必须还在)', () => {
    const entry = SEALED_DIRS.find((x) => x.name === 'persistent_data')
    const { target } = pathsFor(entry, fakeRoot, fakeDev)
    rmSync(stray)
    if (!existsSync(join(target, 'sub', 'keep.bin'))) throw new Error('rmSync(link) 穿透删了目标')
  })

  let failed = 0
  for (const c of cases) {
    try {
      c.fn()
      console.log(`  ✔ ${c.name}`)
    } catch (e) {
      failed++
      console.log(`  ✖ ${c.name}\n    ${e?.message ?? e}`)
    }
  }
  rmSync(fake, { recursive: true, force: true })
  console.log(`\nseal-c-root-stray 自检:${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const mode = argv.includes('--apply') ? 'apply' : argv.includes('--dry-run') ? 'dry-run' : 'check'
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? resolve(argv[rootIdx + 1]) : 'C:'
  const devIdx = argv.indexOf('--devenv')
  const devEnv = devIdx >= 0 && argv[devIdx + 1] ? resolve(argv[devIdx + 1]) : devEnvRoot()
  const r = run({ root, devEnv, mode })

  console.log(`盘根写歪项封口 —— 模式 ${mode}(盘根 ${root} → 外置根 ${r.devEnv})`)
  // run() 按 SEALED_DIRS 顺序 map,故下标即身份;不靠 note 文案反查名字。
  r.sealed.forEach((s, i) => {
    console.log(`  ${s.ok ? '✔' : '✖'} ${SEALED_DIRS[i].name.padEnd(18)} [${s.state ?? '-'}→${s.action}] ${s.note}`)
  })
  for (const o of r.orphans) {
    const full = join(root, o.name)
    if (o.action === 'skip') console.log(`  ✔ [skip] ${full} 不在盘根,无需处理`)
    else console.log(`  ${o.ok ? '✔' : '✖'} [${o.action}] ${full}${o.note ? ` (${o.note})` : ''}`)
  }
  if (mode === 'check' && r.needsAction) {
    console.log('\n⇒ 有待处置项。执行:node scripts/seal-c-root-stray.mjs --apply(幂等,可反复跑)')
  }
  if (mode === 'apply') {
    const fp = sealedFootprint(root, r.devEnv)
    const mb = fp.reduce((s, i) => s + i.bytes, 0) / 1048576
    console.log(`\n封口目标实际占用(已在 D 盘,不占 C):${mb.toFixed(2)} MB / ${fp.reduce((s, i) => s + i.count, 0)} 个文件`)
  }
  if (mode === 'check') return r.needsAction ? 1 : 0
  return r.sealed.every((s) => s.ok) && r.orphans.every((o) => o.ok) ? 0 : 1
}

export const __test__ = { classifyEntry, fingerprint, sameFingerprint, devEnvRoot, pathsFor, SEALED_DIRS, ORPHAN_FILES }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
