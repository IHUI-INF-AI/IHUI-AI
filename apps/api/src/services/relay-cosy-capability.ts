// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Cosy 能力自述层(2026-11-18 立)。
 *
 * 立因:对照程序把「一套设备头族 + 一枚请求签名」当成一个黑盒,写死在客户端里;
 * 本仓此前也只在 qoder-adapter 内部零散使用,运营与排障**看不到**这一格到底有什么、
 * 哪一条是实证过的、哪一条不可复现且为什么。于是"我们有没有 Cosy 能力"每次都要翻代码。
 *
 * 本层把这件事变成**可对账的数据**(纯常量 + 纯函数,零 IO):
 *   · 设备头族(5 条):键位、请求头名、来源,均已实证可用;
 *   · 请求签名(Signature 头):**服务端不可复现** —— 它由客户端内嵌的 HMAC/wasm 计算,
 *     直连实测 403「Signature invalid」;本仓不伪造,改走「本机客户端桥接」让持有私钥的一方
 *     自己签(该通路已实证);
 *   · 结论只有三种:`verified` / `bridged` / `unreproducible`,不留"大概能用"。
 *
 * 纪律:本层**不实现任何签名算法**,也不内置任何私有密钥 —— 它的职责是如实陈述边界,
 * 让上层据此选择通路,而不是让人猜。
 */
import { COSY_HEADERS } from './upstream-adapters/qoder-adapter.js'

export type CosySurfaceState = 'verified' | 'bridged' | 'unreproducible'

export interface CosySurface {
  /** 能力名 */
  id: string
  /** 人读名 */
  label: string
  state: CosySurfaceState
  /** 证据 / 出路(必须非空:说不清就等于没判) */
  evidence: string
}

/** 设备头族的固定档(与 adapter 同序,单一真相源在 COSY_HEADERS) */
const COSY_FIXED_HEADS: readonly CosySurface[] = [
  { id: 'client-type', label: 'Cosy-ClientType', state: 'verified', evidence: 'qoder-adapter 固定 10,配额与刷新实测通过' },
  { id: 'machine-os', label: 'Cosy-MachineOS', state: 'verified', evidence: 'qoder-adapter 默认 x86_64_windows,非 ASCII 主机名已做过清洗' },
]

/**
 * 描述 Cosy 能力面。纯函数:同输入恒等,可在 admin 面与 CLI 复用。
 */
export function describeCosyCapability(): {
  providerCode: 'qoder'
  headerCount: number
  surfaces: CosySurface[]
  headerMapping: Array<{ sourceKey: string; header: string }>
  /** 一句话结论:这一格"有没有" */
  verdict: string
} {
  const headerMapping = COSY_HEADERS.map(([k, h]) => ({ sourceKey: k, header: h }))

  const surfaces: CosySurface[] = [
    ...COSY_FIXED_HEADS,
    {
      id: 'machine-token-family',
      label: 'Cosy-MachineToken / MachineCode / MachineType / Version',
      state: 'verified',
      evidence: `键位取自导入时 extraMetadata.cosy(客户端 runtime-info 产出),缺失则不发力求并如实报失败;映射 ${headerMapping.length} 条见 headerMapping`,
    },
    {
      id: 'request-signature',
      label: 'Cosy Signature(请求签名头)',
      state: 'unreproducible',
      evidence: '算法在客户端内嵌 HMAC/wasm 中,服务端无可复现实现;直连实测 403「Signature invalid」—— 本仓不伪造签名',
    },
    {
      id: 'signature-via-client-bridge',
      label: '签名由客户端桥接承担',
      state: 'bridged',
      evidence: 'qoder-adapter 常驻桥把 SDK 包成 127.0.0.1 的 OpenAI 兼容端点,由持有私钥的客户端自身签名;该通路已实证可用',
    },
  ]

  return {
    providerCode: 'qoder',
    headerCount: headerMapping.length,
    surfaces,
    headerMapping,
    verdict:
      '设备头族全部可用(4 条映射头 + 2 条固定档,共 6 个头);请求签名本体不可复现且不伪造,由本机客户端桥接承担 —— 功能目的已覆盖,算法未复刻',
  }
}

/** 只要"能用哪些头"这一段(给排障与前端下拉用) */
export function cosyHeaderNames(): string[] {
  return COSY_HEADERS.map(([, h]) => h)
}

export const __test__ = { COSY_FIXED_HEADS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
