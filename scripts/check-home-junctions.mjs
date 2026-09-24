// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AGENTS.md §26「家目录工具态一律 junction 改道」的完整性守门(2026-09-24 立)。
//
// 为什么要这道门:§26 长期把校验写成**给人敲的三条命令**(`rustup show home` /
// `reg query HKCU\Environment` / `(Get-Item ~\.cargo).Attributes`)。人肉校验等于没有校验 ——
// 用户质问"C 盘怎么还是被我们占用了"时实测:`AppData\Roaming\npm` 长成 **2.05GB**、
// `AppData\Local\pnpm-cache` **758MB**,两处都是实体目录;而同期 `~\.ihui` 与桌面端两处
// appdata 早已是 junction ⇒ **改道机制本身有效,缺的只是"有没有回潮"的哨兵**。
//
// 判据(任一不满足即红):
//   ① 登记项存在且**不是** reparse point ⇒ REAL-DIR 红(并如实量体积,否则"C 盘占用"读起来像 0)。
//   ② 是指针但目标不可达 ⇒ DANGLING 红。§26 记过 `robocopy rc=9` 会"内容已搬走却不建 junction",
//      反向的"建了指针但目标没了"同样让路径直接消失。
//   ③ 登记表不得被过滤空 —— 空表 = 恒绿的假门(与守门 78 的"扫不到包就 exit 1"同一取向)。
//   ④ 非 Windows 上判不了就**如实报"未判定"**,不记为通过。
//
// 用法:node scripts/check-home-junctions.mjs [--json] [--self-test] [--staged]
//   `--staged` 与全量同口径:这类破损与"本次改了什么"无关(手动装个全局包就回潮)。

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readlinkSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'
import { pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/**
 * §26 登记表:家目录里**必须以指针形式存在**的工具态。
 * 只收本仓工具链产生或本仓产品自己的路径。第三方 IDE 自管态(`.workbuddy` 含被
 * `scripts/lib/gitdir.mjs` 当 git 二进制首选的 PortableGit、`.qoder-cn` 是本会话宿主的
 * 记忆/工作区)按 §26 例外条"只登记、不搬动",**刻意不进判据** —— 否则会把别人的运行态
 * 判成我们的债,并且挪一次丢一次记忆。
 */
export function registryOf(env = process.env, home = homedir()) {
  return [
    { p: join(home, '.cargo'), why: 'Rust cargo home' },
    { p: join(home, '.rustup'), why: 'Rust toolchain' },
    { p: join(home, '.m2'), why: 'Maven' },
    { p: join(home, '.cache'), why: '通用缓存' },
    { p: join(home, '.codex'), why: 'Codex CLI' },
    { p: join(home, '.codex-session-delete'), why: 'Codex 会话清理态' },
    { p: join(home, '.deepseek'), why: 'DeepSeek CLI' },
    { p: join(home, '.ihui'), why: 'IHUI CLI 全局状态(本仓产品)' },
    { p: join(home, '.ollama'), why: 'Ollama 模型(含服务身份)' },
    { p: join(home, '.trae'), why: 'Trae' },
    { p: join(home, '.trae-cn'), why: 'Trae CN' },
    { p: join(home, '.trae-aicc'), why: 'Trae AICC' },
    env.APPDATA ? { p: join(env.APPDATA, 'npm'), why: 'npm 全局安装前缀' } : null,
    env.APPDATA ? { p: join(env.APPDATA, 'com.ihui.desktop'), why: '桌面端 Roaming 态(本仓产品)' } : null,
    env.LOCALAPPDATA
      ? { p: join(env.LOCALAPPDATA, 'pnpm-cache'), why: 'pnpm 元数据缓存' }
      : null,
    env.LOCALAPPDATA
      ? { p: join(env.LOCALAPPDATA, 'com.ihui.desktop'), why: '桌面端 Local 态(本仓产品)' }
      : null,
  ].filter(Boolean)
}

/** 目录体积,访问条目设上限:这是提交链上的门,不得变成性能门。 */
export function sizeOf(path, cap = 8000) {
  let bytes = 0
  let visited = 0
  let capped = false
  const stack = [path]
  while (stack.length) {
    if (visited++ > cap) {
      capped = true
      break
    }
    const cur = stack.pop()
    let ents
    try {
      ents = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of ents) {
      const full = join(cur, e.name)
      if (e.isDirectory()) {
        stack.push(full)
        continue
      }
      try {
        bytes += lstatSync(full).size
      } catch {
        /* 句柄占用/权限不足按 0 计,不影响"是否存在/是否指针"的结论 */
      }
    }
  }
  return { bytes, capped }
}

/**
 * 是不是"改道指针"。libuv 把 NTFS junction 与 symlink 都在 lstat 里报成 symlink,
 * 这条对 junction 也成立;再用 fsutil 兜一层,防未来 Node 行为变化把 junction 读成实体目录
 * (那会让整道门静默失去覆盖面 —— 判据失效必须比判红更贵)。
 */
export function isLink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) return true
  } catch {
    return false
  }
  if (platform() !== 'win32') return false
  try {
    const out = execFileSync('fsutil.exe', ['reparsepoint', 'query', path], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return /Reparse Tag Value/i.test(out)
  } catch {
    return false
  }
}

export function audit(registry = registryOf()) {
  const violations = []
  const ok = []
  const absent = []
  let bytesOnC = 0

  if (!registry.length) {
    return {
      violations: [{ path: '(登记表)', why: '§26 登记项', kind: 'EMPTY-REGISTRY', bytes: 0, target: null }],
      ok,
      absent,
      bytesOnC,
      checked: 0,
      undetermined: false,
    }
  }

  for (const e of registry) {
    if (!existsSync(e.p) && !isLink(e.p)) {
      absent.push(e.p)
      continue
    }
    if (!isLink(e.p)) {
      const { bytes } = sizeOf(e.p)
      bytesOnC += bytes
      violations.push({ path: e.p, why: e.why, kind: 'REAL-DIR', bytes, target: null })
      continue
    }
    let target = null
    try {
      target = readlinkSync(e.p)
    } catch {
      /* junction 的 readlink 偶发拿不到目标,靠下面的可达性判定兜 */
    }
    let reachable = false
    try {
      reachable = statSync(e.p).isDirectory()
    } catch {
      reachable = false
    }
    if (!reachable) {
      violations.push({ path: e.p, why: e.why, kind: 'DANGLING', bytes: 0, target })
      continue
    }
    ok.push({ path: e.p, target })
  }
  return { violations, ok, absent, bytesOnC, checked: registry.length, undetermined: false }
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg}: 期望 ${b},实际 ${a}`)
  }
  let s = null

  t('登记表不得被过滤空(空表 = 恒绿的假门)', () => {
    const n = registryOf({ APPDATA: 'X:\\AppData', LOCALAPPDATA: 'X:\\Local' }, 'X:\\home').length
    eq(n >= 14, true, `登记表只剩 ${n} 项`)
  })
  t('体积量不出来的门会把"C 盘占用"读成 0 —— sizeOf 必须真加字节', () => {
    const r = sizeOf(join(homedir(), '.qoder-cn'))
    eq(r.bytes > 0, true, `量到 ${r.bytes} 字节(未判定或 0 说明遍历失效)`)
  })

  if (platform() === 'win32') {
    // ⚠ 夹具**不得**在注册用例时就清理:cases 是收集后统一跑的,提前 rmScratch 会让
    //   每条断言都对着"已不存在的路径"判定 —— 表现为三条红,或更糟:判成 absent 而假绿。
    //   清理一律放到用例循环之后(scratch 由函数作用域的 s 带出来)。
    try {
      s = mkScratch('junction-probe-')
      const real = join(s, 'real')
      const dest = join(s, 'dest')
      mkdirSync(real, { recursive: true })
      mkdirSync(dest, { recursive: true })
      writeFileSync(join(real, 'a.bin'), 'x'.repeat(1234))
      writeFileSync(join(dest, 'b.bin'), 'y'.repeat(7))

      t('实体目录必须判 REAL-DIR 且量到体积', () => {
        const r = audit([{ p: real, why: 'fixture' }])
        eq(r.violations.length, 1, '实体目录未被判违规')
        eq(r.violations[0].kind, 'REAL-DIR', '判错类型')
        eq(r.violations[0].bytes, 1234, '体积没量出来')
      })

      const good = join(s, 'good')
      execFileSync('cmd.exe', ['/c', 'mklink', '/J', good, dest], {
        windowsHide: true,
        timeout: 20000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      t('真 junction 不得误红', () => {
        const r = audit([{ p: good, why: 'fixture' }])
        eq(r.violations.length, 0, `误判:${JSON.stringify(r.violations)}`)
        eq(r.ok.length, 1, '未记为已改道')
      })

      const bad = join(s, 'bad')
      execFileSync('cmd.exe', ['/c', 'mklink', '/J', bad, join(s, 'nope')], {
        windowsHide: true,
        timeout: 20000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      t('悬空 junction 必须判红(§26 的"路径直接消失"形态)', () => {
        const r = audit([{ p: bad, why: 'fixture' }])
        eq(r.violations.length, 1, '悬空未被判违规')
        eq(r.violations[0].kind, 'DANGLING', '判错类型')
      })

      t('不存在的登记项记 absent,不算违规也不算通过性绿', () => {
        const r = audit([{ p: join(s, 'never'), why: 'fixture' }])
        eq(r.violations.length, 0, '缺失被误判违规')
        eq(r.absent.length, 1, '未记为 absent')
      })
    } catch (e) {
      if (s) rmSync(s, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      t('junction 夹具准备失败(不得当作通过)', () => {
        throw new Error(`夹具不可用: ${e.message}`)
      })
    }
  } else {
    console.log('  ! 非 Windows:改道完整性无法判定,只跑登记表/体积两项(不记为通过)')
  }

  let failed = 0
  for (const c of cases) {
    try {
      c.fn()
      console.log(`  ✔ ${c.name}`)
    } catch (e) {
      failed++
      console.log(`  ✖ ${c.name}\n    ${e.message}`)
    }
  }
  // 清理放在循环之后:夹具若在注册期就被删,上面三条会集体判不到路径(本仓同日踩过)。
  if (s) {
    const livedThroughAssertions = existsSync(s)
    if (livedThroughAssertions) rmScratch(s)
    if (livedThroughAssertions && !existsSync(s)) {
      console.log('  ✔ 夹具活到断言跑完,并已清理(不留残骸)')
    } else if (!livedThroughAssertions) {
      failed++
      console.log('  ✖ 夹具在断言前就消失了 —— 整套 fixture 断言等于对着空气判定')
    } else {
      failed++
      console.log('  ✖ 夹具未被清理')
    }
  }
  console.log(`\ncheck-home-junctions 自检:${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const r = audit()
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...r, bytesOnC_MB: Math.round((r.bytesOnC / 1048576) * 10) / 10 }, null, 2))
    return r.violations.length ? 1 : 0
  }
  const mb = (r.bytesOnC / 1048576).toFixed(0)
  console.log(
    `§26 家目录改道完整性:登记 ${r.checked} 项 / 已改道 ${r.ok.length} / 不存在 ${r.absent.length} / 违规 ${r.violations.length}` +
      (r.bytesOnC ? ` —— **C 盘上仍留 ${mb} MB 实体工具态**` : ''),
  )
  for (const v of r.violations) {
    const size = v.bytes ? ` ${(v.bytes / 1048576).toFixed(1)}MB` : ''
    console.log(`  ❌ ${v.path}${size}  [${v.kind}] ${v.why}${v.target ? ` target=${v.target}` : ''}`)
  }
  if (r.violations.length) {
    console.log('\n  修法(§26:一律 junction,不改 Path 环境变量,否则会造"双根分裂"):')
    console.log('    robocopy <src> <D 盘目标> /E  →  逐文件(相对路径+字节)校验  →  源改名')
    console.log('    →  mklink /J <src> <D 盘目标>  →  经 junction 回读数量/字节一致  →  才删源')
    console.log('    ⚠ robocopy 非零返回码会让"内容已搬走但不建 junction",路径直接消失')
  } else if (platform() !== 'win32') {
    console.log('  ⚠ 非 Windows:本门**未判定**(不计为通过)')
  } else {
    console.log('  ✅ 登记项全部为有效指针,家目录无实体工具态回潮')
  }
  return r.violations.length && platform() === 'win32' ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { audit, registryOf, sizeOf, isLink }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
