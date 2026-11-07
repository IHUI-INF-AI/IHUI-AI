#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mobile-download-leg-cn.mjs — Gitee 国内腿运行态门(2026-11-04 立)
 *
 * 为什么要有这道门:客户端 apk-download-legs.ts 只在「国内腿真的能吐出字节、且
 * Content-Range 总长与站点主腿相等」时才选国内腿。Gitee 固定 tag 上的 APK 附件
 * 一旦过期、被删、或是同名旧包,探针会静默淘汰国内腿,用户又回到
 * `www.aizhs.top` → Cloudflare LAX 的几十 KB/s。而原有
 * check-mobile-download-leg.mjs 只探站点主腿,资产为空时它照样全绿 ——
 * 这正是「门恒绿」的第二种成因:夹具与实现同错。
 *
 * 本门只回答一件事:两条腿现在是不是同一枚够大的包。
 *   - 两条腿都用 `Range: bytes=0-0` 真探(不是 HEAD 猜),跟随 302 到最终实物;
 *   - Content-Range 的 `/<total>` 是权威总长,量不到就落 undetermined;
 *   - 任一腿量不到 / 非 200-206 / 网络异常 ⇒ exit 2(未判定),绝不折算成绿;
 *   - 任一腿 < minApkBytes ⇒ exit 1;
 *   - 两腿总长不等 ⇒ exit 1(与 desktop-feed-live.ts 的「冒名旧包」防线同源);
 *   - 全等 ⇒ exit 0。
 *
 * 用法:
 *   node scripts/check-mobile-download-leg-cn.mjs --self-test   # 纯函数夹具,不触网
 *   node scripts/check-mobile-download-leg-cn.mjs               # 探两条腿
 *   node scripts/check-mobile-download-leg-cn.mjs --json         # 机器可读
 *
 * 发布侧:publish-mobile-apk-gitee.py 负责把官网签名 APK 传到固定 tag,
 * 由 .github/workflows/mobile-download-leg.yml 的 workflow_dispatch 手动触发。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(HERE, '..', 'data', 'mobile-download-leg.json')
export const EXIT = Object.freeze({ ok: 0, fail: 1, undetermined: 2 })
export const PROBE_TIMEOUT_MS = 15_000

/** `bytes 0-0/87559925` → 87559925;认不出一律 null(未判定,不是 0)。 */
export function parseTotalFromContentRange(value) {
  const m = /\/\s*(\d+)\s*$/.exec(String(value ?? ''))
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 纯判据。三态刻意分开:量不到 ≠ 相等,体积不等 ≠ 可降级放行。
 * 把任何一条改松,都会让「国内腿其实是空的」重新变成全绿。
 */
export function judgeCnLegParity(cnBytes, siteBytes, minBytes) {
  if (cnBytes === null || siteBytes === null) {
    return {
      state: 'undetermined',
      reason: `至少一条腿量不到总长(cn=${cnBytes} / site=${siteBytes})⇒ 未判定`,
    }
  }
  if (cnBytes < minBytes || siteBytes < minBytes) {
    return {
      state: 'fail',
      reason: `低于体积下限 ${minBytes}B(cn=${cnBytes} / site=${siteBytes})`,
    }
  }
  if (cnBytes !== siteBytes) {
    return {
      state: 'fail',
      reason: `两条腿不是同一枚包(cn=${cnBytes}B / site=${siteBytes}B)⇒ 拒绝国内腿`,
    }
  }
  return { state: 'ok', reason: `两条腿同为 ${cnBytes}B` }
}

/** 真探一条腿;读完响应头立刻 cancel body,绝不把 85MB 拉进内存。 */
export async function probeTotal(url, fetchImpl = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS) {
  if (typeof fetchImpl !== 'function') return null
  try {
    const res = await fetchImpl(url, {
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status !== 200 && res.status !== 206) {
      console.log(`[probe] ${url} -> HTTP ${res.status}`)
      await res.body?.cancel().catch(() => {})
      return null
    }
    const total = parseTotalFromContentRange(res.headers.get('content-range'))
    await res.body?.cancel().catch(() => {})
    if (total !== null) return total
    // 退回 200 全文时 Content-Length 就是总长;仍然量不到就保持未判定。
    const len = Number(res.headers.get('content-length'))
    return Number.isFinite(len) && len > 0 ? len : null
  } catch (e) {
    console.log(`[probe] ${url} -> 网络异常: ${e?.message ?? e}`)
    return null
  }
}

export function selfTest() {
  assert.equal(parseTotalFromContentRange('bytes 0-0/87559925'), 87559925)
  assert.equal(parseTotalFromContentRange('bytes 0-0/*'), null)
  assert.equal(parseTotalFromContentRange(null), null)
  assert.equal(judgeCnLegParity(null, 87559925, 52428800).state, 'undetermined', '量不到不许绿')
  assert.equal(judgeCnLegParity(87559925, null, 52428800).state, 'undetermined', '量不到不许绿')
  assert.equal(judgeCnLegParity(10, 10, 52428800).state, 'fail', '低于下限必须硬失败')
  assert.equal(judgeCnLegParity(87559925, 87559924, 52428800).state, 'fail', '体积不等必须硬失败')
  assert.equal(judgeCnLegParity(87559925, 87559925, 52428800).state, 'ok', '全等才绿')
  console.log('[self-test] Content-Range 解析 / 三态判据 / 体积对账 —— 全过')
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) {
    selfTest()
    return EXIT.ok
  }
  const json = argv.includes('--json')
  let cfg
  try {
    cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch (e) {
    console.log(`单源读取失败: ${e?.message ?? e}`)
    return EXIT.undetermined
  }
  const { cnLegUrl, downloadUrl, minApkBytes } = cfg
  if (!cnLegUrl || !downloadUrl || !minApkBytes) {
    console.log('单源缺 cnLegUrl / downloadUrl / minApkBytes ⇒ 未判定')
    return EXIT.undetermined
  }
  const [cnBytes, siteBytes] = await Promise.all([probeTotal(cnLegUrl), probeTotal(downloadUrl)])
  const verdict = judgeCnLegParity(cnBytes, siteBytes, Number(minApkBytes))
  const out = { cnLegUrl, downloadUrl, cnBytes, siteBytes, minApkBytes, ...verdict }
  if (json) console.log(JSON.stringify(out, null, 2))
  else console.log(`[cn-leg] ${verdict.state}: ${verdict.reason}`)
  return EXIT[verdict.state]
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
