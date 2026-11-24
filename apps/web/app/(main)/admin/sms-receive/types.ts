// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 短信接码页面类型定义(对接 /api/admin/sms-receive/*) */

export type CardType = '实卡' | '虚卡' | '全部'

export type MessageData =
  | {
      status: 'received'
      code?: string
      raw: string
      /** 从短信原文【】提取的平台名(后端 extractPlatform),如 trae */
      platform?: string
      /** 短信用途:register=新号注册 / login=该号已注册过(登录码) / other */
      usageKind?: 'register' | 'login' | 'other'
    }
  | { status: 'pending'; raw: string }

/** 号码接码台账项(GET /phone-history,本地 sms_receive_history 表流水) */
export interface PhoneHistoryItem {
  id: string
  phone: string
  keyword?: string | null
  platform?: string | null
  usageKind: 'register' | 'login' | 'other'
  smsCode?: string | null
  smsRaw: string
  receivedAt: string
}

/** 本机台账「平台 × 用途」计数(GET /phone-history platformStats,SQL 全量 group-by) */
export interface PhonePlatformStat {
  platform: string | null
  usageKind: 'register' | 'login' | 'other'
  count: number
}

/** 平台历史记录单条(GET /used,本账号 24h 流水;后端已解析「号码\t扣费\t短信原文」) */
export interface UsedRecord {
  phone: string
  fee: string
  platform?: string
  usageKind: 'register' | 'login' | 'other'
  text: string
}

export interface UsedData {
  items: UsedRecord[]
  /** 本地快照累积总数(2026-10-09 攻破 24h+100 条;快照失败=null 降级) */
  totalUnion?: number | null
}

/** 快照累积流水项(GET /used-union,firstSeenAt=入库时间口径,非短信到达时刻) */
interface UsedSnapItem {
  id: string
  phone: string
  fee: string
  platform?: string | null
  usageKind: 'register' | 'login' | 'other'
  text: string
  firstSeenAt: string
}

export interface UsedUnionData {
  items: UsedSnapItem[]
  total: number
}

/** 平台「号码相关短信」全局时间线记录项(GET /related-msgs,内容打码只透出时间+标记) */
export interface RelatedMsgItem {
  /** 记录时间(HH:MM,平台时间线原样,无日期) */
  time: string
  /** 平台可见性标记(Y/N,语义未公开,原样透传) */
  flag: string
}

/** related-msgs 响应:items=平台单次窗口(≤12条);totalUnion=本地快照累积并集(可>12,快照失败=null 降级) */
export interface RelatedMsgsData {
  items: RelatedMsgItem[]
  totalUnion?: number | null
}

/** 取号表单状态 */
export interface GetPhoneForm {
  keyWord: string
  phone: string
  province: string
  cardType: CardType
}

/** 发送短信表单状态 */
export interface SendSmsForm {
  toPhone: string
  content: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
