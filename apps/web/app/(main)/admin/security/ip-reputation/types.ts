// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface IpReputation {
  score: number
  reasons: string[]
  source: 'cache' | 'live'
}

export interface BlockIpRequest {
  ip: string
  duration: number // 秒
  reason?: string
}

export interface BlockIpResponse {
  ip: string
  duration: number
  blocked: boolean
}

export interface UnblockIpResponse {
  ip: string
  blocked: false
}
