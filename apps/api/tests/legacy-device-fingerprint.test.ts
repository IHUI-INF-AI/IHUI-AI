// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1 退化设备指纹识别的回归。
 *
 * 三条各自钉一件事:
 *  1. **重算必须等于历史实测**—— 钉的是台账量到的那两个 v1 值(它们是过去的事实,不会因为
 *     今天把账还清而失效,所以可以放心钉);若哪天有人改了摘要实现或采集口径,这条会红,
 *     而那时"退化集"与"真实退化值"就已经不是同一批值了。
 *  2. **补采后的富指纹不得被判退化**—— 反向对照:豁免若写得过宽(比如退化成"长度 32 就算"),
 *     这条必红。
 *  3. **空值/缺字段一律 false 且不抛**—— 这一维没有结论时不得让调用方拿到一次异常。
 */
import { randomBytes } from 'node:crypto'
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createDeviceFingerprintCollector } from '@ihui/types'
import {
  degenerateLegacyFingerprints,
  isDegenerateLegacyFingerprint,
} from '../src/utils/legacy-device-fingerprint.js'

/** 台账实测值:采集器只喂 `platform:'ios'` / `'android'` 时得到的 32 字符指纹。 */
const V1_IOS = '8be82194543a6f57cd52c70e03fc9151'
const V1_ANDROID = 'ef773d266bcd872d505f7af4657e73c3'

describe('isDegenerateLegacyFingerprint', () => {
  it('重算出的退化集与台账历史实测逐字相同(阳性对照)', async () => {
    const set = await degenerateLegacyFingerprints()
    expect([...set].sort()).toEqual([V1_IOS, V1_ANDROID].sort())
    expect(await isDegenerateLegacyFingerprint(V1_IOS)).toBe(true)
    expect(await isDegenerateLegacyFingerprint(V1_ANDROID)).toBe(true)
  })

  it('补采后的富指纹(RN v2 形状)不得被判退化(反向对照)', async () => {
    const rich = await createDeviceFingerprintCollector({
      collect: () => ({
        platform: 'Google-Pixel 7-android-34',
        screen: { width: 1080, height: 2400, colorDepth: 56 },
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
      }),
    }).get()
    expect(await isDegenerateLegacyFingerprint(rich.fingerprint)).toBe(false)
  })

  it('同机型两台设备的 v2 指纹不得相等(补采要买回的就是这个区分度)', async () => {
    const mk = (model: string, api: number) =>
      createDeviceFingerprintCollector({
        collect: () => ({ platform: `Google-${model}-android-${api}` }),
      }).get()
    const [a, b] = await Promise.all([mk('Pixel 7', 34), mk('Pixel 8', 35)])
    expect(a.fingerprint).not.toBe(b.fingerprint)
    // 同一台"只喂 platform"的设备上,这两台会塌成同一个值 —— 区分度是补采买回来的,不是本来就有的。
    const v1 = await createDeviceFingerprintCollector({
      collect: () => ({ platform: 'android' }),
    }).get()
    expect(v1.fingerprint).toBe(V1_ANDROID)
  })

  it('空值 / undefined / null 一律判非退化且不抛', async () => {
    expect(await isDegenerateLegacyFingerprint(undefined)).toBe(false)
    expect(await isDegenerateLegacyFingerprint(null)).toBe(false)
    expect(await isDegenerateLegacyFingerprint('')).toBe(false)
  })

  it('退化集是进程内单算(同一 Promise 实例,不每次重算)', async () => {
    expect(await degenerateLegacyFingerprints()).toBe(await degenerateLegacyFingerprints())
  })

  /**
   * 接线断言 —— 导出了一个判定函数不等于它被调用。
   *
   * 构造是双向的:同一份输入序列里先送一个 v1 退化值、再送两个真指纹。
   *  - 豁免生效:退化值不占"新设备"名额 ⇒ 第三维 score 仍是 0(两个真指纹 < 阈值 3);
   *  - 把 anomaly-detector 里那次 early-return 摘掉:退化值占 1 席 + 2 真 = 3 席 ≥ 阈值 ⇒ 同一
   *    条断言立刻变 80。所以它既不是恒绿,也不是靠"凑不到阈值"蒙过去的。
   */
  it('退化指纹不进"新设备"计数(豁免真接在检测链上,双向对照)', async () => {
    const { AnomalyDetector } = await import('../src/services/anomaly-detector.js')
    const mk = (platform: string) =>
      createDeviceFingerprintCollector({ collect: () => ({ platform }) }).get()
    const [richA, richB] = await Promise.all([
      mk('Apple-iPhone15,4-ios-17.5'),
      mk('Google-Pixel 8-android-35'),
    ])
    const detector = new AnomalyDetector(null)
    // 内存降级模式下设备集合挂在类的静态 Map 上,按 userId 计键 ⇒ 每次跑都要一个新身份,
    // 否则第二条用例的残留集合会让第三条的 size 直接过阈值,断言测的就不是豁免而是运气。
    const userId = `u-fp-wiring-${randomBytes(8).toString('hex')}`
    const dim = async (fp: string): Promise<number> => {
      const r = await detector.detectAnomaly({
        ip: '203.0.113.9',
        userId,
        url: '/api/profile',
        method: 'GET',
        deviceFingerprint: fp,
        timestamp: Date.now(),
      })
      return r.dimensions.find((d) => d.name === 'device-fingerprint')?.score ?? -1
    }
    expect(await dim(V1_ANDROID)).toBe(0)
    expect(await dim(richA.fingerprint)).toBe(0)
    // 这一条才是牙:摘掉 anomaly-detector 里的 early-return,退化值会占 1 席 ⇒ 此处 3 席 ≥ 阈值 ⇒ 80。
    expect(await dim(richB.fingerprint)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
