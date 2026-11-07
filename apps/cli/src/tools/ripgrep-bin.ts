// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ripgrep 可执行文件定位器(单一真相源)。
 *
 * 立因(2026-11-05 现读实测):本机 `rg` 不在 PATH,`builtins.ts` 的两处
 * `spawnSync('rg', …)` 双双报 `spawnSync rg ENOENT` ⇒ `grep` 工具整班降级到 js-walk。
 * 自主派发环 68 份会话转录里 158 次「未找到匹配」、187 次 ENOENT,目标文件
 * (`apps/ai-service/app/services/codebase_indexer.py`)其实**存在** —— 检索假阴性把
 * 会话逼成"通篇只读、零写盘"。这台机上 ripgrep 15.1.0 一直都在,只是没人去找它。
 *
 * 纪律:
 * - 失效方向 = 返回裸名 `'rg'`,与定位器存在前逐字节同形(不得因为"找不到候选"就
 *   谎报可用,也不得反过来把可用降成不可用)。
 * - 每个候选都必须**真跑一次 `--version`** 才算数(路径存在 ≠ 可执行;跨机/换版本
 *   时坏文件比没有文件更坏)。
 * - 不写死盘符:候选一律由 `os.homedir()` / `process.env.PATH` / 显式 env 覆盖派生。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'

/** 显式覆盖入口(与 §5d 的密钥目录同一取向:机器事实可被 env 钉死,代码里不写盘符)。 */
export const RG_PATH_ENV = 'IHUI_RG_PATH'

/** Windows 上 rg 带 .exe;其余平台裸名。 */
export function rgBinaryName(p: NodeJS.Platform = platform()): string {
  return p === 'win32' ? 'rg.exe' : 'rg'
}

/**
 * 纯函数:按优先级列出候选命令(绝对路径或裸名)。不碰进程、不碰文件系统。
 * 拆出来的理由就是 §22c:定位判据必须能在 ubuntu runner 上成对测,写死 `\` 的形态
 * 在非 win 上会把整维读成「未判定」。
 */
export function rgCandidates(
  env: NodeJS.ProcessEnv,
  home: string,
  p: NodeJS.Platform = platform(),
): string[] {
  const name = rgBinaryName(p)
  const out: string[] = []
  const push = (v: string | undefined | null) => {
    const s = String(v ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  // ① 显式覆盖是**钉死**,不是"优先试一下":钉错就喊响,绝不静默换通道
  //    (这条同时给了测试一只可靠的"关掉 rg"的手,和给运维一条可靠的应急钉法)。
  const pin = String(env[RG_PATH_ENV] ?? '').trim()
  if (pin) return [pin]
  // ② 已装的缓存位(本机实测存在;取不到自然落到下一档)
  push(join(home, '.cache', 'opencode', 'bin', name))
  if (p === 'win32') push(join(home, 'AppData', 'Local', 'OpenAI', 'Codex', 'bin', name))
  // ③ PATH 逐目录找 —— 以后把 rg 装进 PATH 时这里自动接上,不必改代码
  for (const dir of String(env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (dir.trim()) push(join(dir.trim(), name))
  }
  // ④ 兜底裸名:交给操作系统解析(等价于定位器存在之前的行为)
  push(name)
  return out
}

export interface ResolvedRg {
  /** 实际用于 spawn 的命令(可能是绝对路径,也可能是裸名兜底)。 */
  cmd: string
  /** 命中来源说明;裸名命中时为 null(它确实在 PATH 里,但没有"定位到的文件"可报)。 */
  source: string | null
  /**
   * `cmd` 是否被真跑过 `--version` 且退出码 0。
   * 必须与 `source` 分开:裸名命中时 source 为 null 但 verified 为 true;
   * 全候选失败时兜底裸名 verified 为 false(它没验过 —— 不能自称可用)。
   */
  verified: boolean
  /** 逐候选的失败原因(全失败时才用得上,便于喊人时点名而不是只说一句"没有 rg")。 */
  tried: string[]
}

let memo: ResolvedRg | null = null

function usable(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    })
    return r.status === 0
  } catch {
    return false
  }
}

/**
 * 定位 ripgrep(进程内 memo:一次会话只问一回)。
 * 每个候选先 `existsSync` 再 `--version`,顺序不能反 —— 对裸名兜底来说,存在性由
 * PATH 解析,`existsSync('rg')` 恒 false,所以只有最后一档必须跳过存在性直接试跑。
 */
export function resolveRipgrepBin(refresh = false): ResolvedRg {
  if (memo && !refresh) return memo
  const env = process.env
  const home = homedir()
  const p = platform()
  const tried: string[] = []
  for (const cand of rgCandidates(env, home, p)) {
    const isBare = !cand.includes('/') && !cand.includes('\\')
    if (!isBare && !existsSync(cand)) {
      tried.push(`${cand}: not found`)
      continue
    }
    if (!usable(cand)) {
      tried.push(`${cand}: --version failed`)
      continue
    }
    memo = { cmd: cand, source: cand === rgBinaryName(p) ? null : cand, verified: true, tried }
    return memo
  }
  // 全候选都没验过。兜底形态分两种,不能合并:
  //  - 钉死过(IHUI_RG_PATH 有值):原样交回**被钉的那一枚**。此处若回落裸名,就等于
  //    "你让我钉死,我没钉住还换个通道" —— 钉错必须喊响,不许偷偷换路。
  //  - 没钉过:回落裸名,与定位器存在之前逐字节同形。
  const pin = String(env[RG_PATH_ENV] ?? '').trim()
  memo = { cmd: pin || rgBinaryName(p), source: null, verified: false, tried }
  return memo
}

export const __test__ = { rgCandidates, rgBinaryName, resolveRipgrepBin, RG_PATH_ENV }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
