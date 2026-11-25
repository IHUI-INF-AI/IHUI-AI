// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回源密钥的读取(2026-11-25 立)。
//
// 只为一件事服务:让红队在线探针能带着**正确的** `x-ihui-edge-secret` 穿过回源鉴权,
// 真正打到 WAF 那一层 —— 否则 403 可能是回源鉴权给的,不是 WAF 给的,那就是假通过。
//
// 纪律(写在代码里,防止后来者顺手打印):
//   · 返回值只许留在进程内存,**任何调用方都不得把 value 写进日志、留痕、告警正文**;
//   · 本模块自己不打印任何东西 —— 连长度都不打印,长度也是信息;
//   · 三个来源按序尝试:进程 env → 显式 .env 文件 → nssm 的 AppEnvironmentExtra。
//     实测(2026-11-25):`IHUI_EDGE_SECRET` 不在任何 .env 里,只在服务 env 中。
//   · 取不到一律返回 `{value:null, source:null}`,由调用方落「未判定」,绝不生成假密钥去试。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const NSSM = 'C:/Windows/System32/nssm.exe'
const DEFAULT_SERVICE = 'IHUI-WEB-ROUTER'
const DEFAULT_FILES = ['D:/DevEnv/ihui-prod/apps/api/.env']

export function unquote(raw) {
  const s = String(raw ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
}

/**
 * 解析一块 `KEY=VALUE` 文本。nssm 的 AppEnvironmentExtra 就是这个形状。
 * 值里允许含 `=`、`<`、空格(实测有 `IHUI_BG_HEALTH_MATCH=<!DOCTYPE html`),所以只切第一个 `=`。
 *
 * 分隔符三种都认:实测 nssm 给的是 **`\r` 单独分隔**(不是 `\r\n`)——
 * 只写 `\r?\n` 会把 11 个变量当成一整行,于是"只解析出 1 个键",静默漏掉密钥。
 */
export function parseEnvBlock(text) {
  const out = {}
  for (const line of String(text ?? '').split(/\r\n|\r|\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

/**
 * 解析回源密钥。返回 `{value, source}`;取不到 value 为 null。
 * source 只说明"从哪儿来的",不含值本身。
 */
export function resolveEdgeSecret({
  env = process.env,
  files = DEFAULT_FILES,
  service = DEFAULT_SERVICE,
  readService = true,
  nssmPath = NSSM,
} = {}) {
  const direct = String(env.IHUI_EDGE_SECRET ?? '').trim()
  if (direct) return { value: direct, source: 'env:IHUI_EDGE_SECRET' }

  for (const f of files) {
    try {
      if (!existsSync(f)) continue
      const text = readFileSync(f, 'utf8')
      const m = text.match(/^IHUI_EDGE_SECRET=(.*)$/m)
      if (m) {
        const v = unquote(m[1])
        if (v) return { value: v, source: `file:${f}` }
      }
    } catch {
      /* 读不到就试下一个源,不在这里落结论 */
    }
  }

  if (readService && existsSync(nssmPath)) {
    try {
      const raw = execFileSync(nssmPath, ['get', service, 'AppEnvironmentExtra'], {
        encoding: 'utf8',
        timeout: 15_000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const v = unquote(parseEnvBlock(raw).IHUI_EDGE_SECRET ?? '')
      if (v) return { value: v, source: `nssm:${service}` }
    } catch {
      /* 服务名不对或权限不够 —— 由调用方落未判定 */
    }
  }

  return { value: null, source: null }
}

export const __test__ = { parseEnvBlock, resolveEdgeSecret, unquote }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
