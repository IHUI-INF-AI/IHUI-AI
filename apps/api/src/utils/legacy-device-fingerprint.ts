// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1 退化设备指纹识别(异常检测的设备维度专用出口)。
 *
 * 立因:mobile-rn 的采集器长期只喂 `platform` 一个字段,而指纹摘要吃的就是那段输入 ⇒
 * 全网 iOS 得到同一个 32 字符值、全网 Android 得到另一个。该值随后被 `user_devices` 的
 * (userId, fingerprintHash) 唯一键与审计 / 支付 / 异常检测当"设备标识"消费,于是它既不能
 * 区分设备,又会把"同机型所有人"绑成同一台机器。
 *
 * 为什么这里**重算**而不是抄一份 hash 常量清单:常量清单是登记表,登记表必然腐烂(本仓为
 * 同类清单记过多次);而"v1 采集器的输入形状"才是这笔债的定义 —— 用同一份生产摘要实现
 * (`createDeviceFingerprintCollector` 内部的 `generateFingerprint`)把它算出来,采集口径一旦
 * 变了,这份集合自动跟着变,不会留下第二份真相。
 */
import { createDeviceFingerprintCollector } from '@ihui/types'

/** v1 采集器唯一提供过的字段值(RN 的 `Platform.OS` 只有这两档)。 */
const V1_DEGENERATE_PLATFORMS: readonly string[] = ['ios', 'android']

let cached: Promise<ReadonlySet<string>> | null = null

async function computeDegenerateLegacyFingerprints(): Promise<ReadonlySet<string>> {
  const out = new Set<string>()
  for (const platform of V1_DEGENERATE_PLATFORMS) {
    const collector = createDeviceFingerprintCollector({ collect: () => ({ platform }) })
    const { fingerprint } = await collector.get()
    out.add(fingerprint)
  }
  return out
}

/** 退化指纹集合(进程内算一次并缓存 —— 它是纯函数结果,不随请求变化)。 */
export function degenerateLegacyFingerprints(): Promise<ReadonlySet<string>> {
  cached ??= computeDegenerateLegacyFingerprints()
  return cached
}

/**
 * 这个指纹是不是"根本不标识任何设备"的 v1 退化值?
 * 命中即意味着:拿它做新设备计数、跨账号关联、支付设备风控都不成立。
 */
export async function isDegenerateLegacyFingerprint(
  fingerprint: string | undefined | null,
): Promise<boolean> {
  if (!fingerprint) return false
  return (await degenerateLegacyFingerprints()).has(fingerprint)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
