// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 稳定设备身份派生层(2026-11-18 立)。
 *
 * 立因:qoder2api 系网关把「同一账号长期固定在同一台虚拟物理设备」做成一格能力
 * —— 以 uid + 业务盐单向派生 `cosy-machineid` / `cosy-machinetoken` / 会话标识,
 * 使机器码不随重装/换机漂移,不同账号的机器码彼此独立。本仓此前只有**读写/提取**
 * 机器码(`relay-account-format` 的别名表、checkin 页面的 `machine_id`、提取器落库),
 * 没有「凭空派生一枚稳定标识」的实现 ⇒ 每次入池只能沿用上游给的值,取不到就没有。
 *
 * 本模块补的是**派生**这一格,并把它写成纯判据(零 IO):
 *   · 输入 uid + 盐 + 区 ⇒ 输出三枚标识;同输入恒等,不同 uid 必不同;
 *   · 域分离:三枚标识用不同 purpose 前缀,任一枚都推不出另一枚;
 *   · 不可反推:只做 SHA-256 单向派生,不落明文、不提供反查出口;
 *   · 判不了就不生成:盐缺失/过短 ⇒ ok:false + 原因,绝不降级成弱身份(§0.3)。
 *
 * 边界(写死,别改口径):
 *   ① 这是**稳定的软件标识**,不是物理设备;不冒充真实硬件指纹。
 *   ② **双通道**:上游自己给了 machine_id 就优先用上游的(本模块不覆盖既有值);
 *      只有上游没给、且本仓需要一个稳定值时才派生 —— 派生不替代官方体系。
 *   ③ 本模块不实现任何上游签名算法,也不构造上游鉴权头;它只产出一个字符串标识。
 */

import { createHash } from 'node:crypto'

/** 三枚标识的 purpose 前缀(域分离的唯一真相源,新增标识必须同笔加进这里) */
export const DEVICE_IDENTITY_PURPOSES = ['machineid', 'machinetoken', 'sessionid'] as const
export type DeviceIdentityPurpose = (typeof DEVICE_IDENTITY_PURPOSES)[number]

/** 盐最短长度:低于此值一律拒绝派生(短盐可被字典穷举 ⇒ 等于没隔离) */
export const MIN_DEVICE_SALT_CHARS = 16

/** uid 最短长度(空串/过短 uid 会让多个账号派生出同一标识,是事故不是优化) */
export const MIN_DEVICE_UID_CHARS = 1

/**
 * 每枚标识的输出长度(hex 字符数)。
 * 32 = 128 bit,48 = 192 bit;都远高于碰撞安全线,同时不至于撑爆上游 varchar(128)。
 */
const PURPOSE_HEX_LEN: Readonly<Record<DeviceIdentityPurpose, number>> = {
  machineid: 32,
  machinetoken: 48,
  sessionid: 32,
}

export interface DeviceIdentityInput {
  /** 账号唯一标识(上游 uid / 号池 uid 均可,只要求同一账号恒等) */
  uid: string
  /** 业务盐(来自 env 或调用方注入;不落库、不进日志) */
  salt: string
  /** 区域(cn/global);缺省视为全区共用一套派生 */
  realm?: string | null
}

export type DeviceIdentityResult =
  | {
      ok: true
      machineId: string
      machineToken: string
      sessionId: string
    }
  | {
      ok: false
      /** 机器可判的原因码(调用方据此给出路,不得当成"派生失败可忽略") */
      code: 'missing-uid' | 'missing-salt' | 'weak-salt'
      reason: string
    }

/**
 * 单枚标识的派生。纯函数:
 *   sha256(`${purpose}\u0000${realm}\u0000${salt}\u0000${uid}`) 的前 N 个 hex。
 *
 * 为什么用 `\u0000` 作分隔:uid / salt / realm 都是外部输入,若用普通分隔符(如 `:`)
 * 拼串,`uid='a:b'` 与 `uid='a', salt='b:...'` 可能撞出同一串 —— 那是可构造的碰撞,
 * 不是理论风险。NUL 不在任何正常 uid/salt 里出现,拼串因此无歧义。
 */
function deriveOne(purpose: DeviceIdentityPurpose, input: DeviceIdentityInput): string {
  const realm = (input.realm ?? '').trim().toLowerCase()
  const material = [purpose, realm, input.salt, input.uid].join('\u0000')
  const hex = createHash('sha256').update(material, 'utf8').digest('hex')
  return hex.slice(0, PURPOSE_HEX_LEN[purpose])
}

/**
 * 派生一组稳定设备身份。三枚标识一次算齐(它们必须同源,分开算是三处口径漂移的起点)。
 */
export function deriveDeviceIdentity(input: DeviceIdentityInput): DeviceIdentityResult {
  const uid = typeof input?.uid === 'string' ? input.uid.trim() : ''
  const salt = typeof input?.salt === 'string' ? input.salt : ''

  if (uid.length < MIN_DEVICE_UID_CHARS) {
    return {
      ok: false,
      code: 'missing-uid',
      reason: 'uid 为空或过短:多个账号会派生出同一标识 ⇒ 隔离失效,拒绝派生(先补齐账号 uid 再来)',
    }
  }
  if (!salt) {
    return {
      ok: false,
      code: 'missing-salt',
      reason: `业务盐缺失:派生需要 env RELAY_DEVICE_SALT(≥${MIN_DEVICE_SALT_CHARS} 字符),缺失时拒绝生成而不是退化成可被穷举的弱标识`,
    }
  }
  if (salt.length < MIN_DEVICE_SALT_CHARS) {
    return {
      ok: false,
      code: 'weak-salt',
      reason: `业务盐仅 ${salt.length} 字符(<${MIN_DEVICE_SALT_CHARS}):短盐可被字典穷举,派生出的标识等于没隔离;换更长的盐`,
    }
  }

  return {
    ok: true,
    machineId: deriveOne('machineid', input),
    machineToken: deriveOne('machinetoken', input),
    sessionId: deriveOne('sessionid', input),
  }
}

/**
 * 是否可派生(给路由/前端做按钮态用)。与 `deriveDeviceIdentity` 同一判据,不另抄一份。
 */
export function isDeviceIdentityDerivable(input: DeviceIdentityInput): boolean {
  return deriveDeviceIdentity(input).ok
}

export const __test__ = {
  PURPOSE_HEX_LEN,
  deriveOne,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
