// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 小程序侧「提示留痕」存储适配器 —— Taro 同步存储 → 共享 `NoticeLogStorage` 契约。
 *
 * 立因:留痕要满足「关掉小程序再打开仍在」,而 shared 不能依赖 `Taro.*`(RN/web/Node 会
 * import 即炸),故契约留在 shared、载体由各端注入。本文件就是小程序那份载体。
 *
 * 为什么把同步 API 包成 Promise:Taro 的 `getStorageSync/setStorageSync` 是同步的,
 * 而三端共用的 `loadNoticeLog/saveNoticeLog` 是异步签名。这里只做「形状适配」,
 * 不引入任何缓存/重试 —— 那会让「写失败」被悄悄吞掉,用户重启后看到的仍是旧记录。
 *
 * 为什么要把 `''` 归一化成 `null`:Taro 读不到键时返回 `''`(不是 null)。若不归一,
 * 「键不存在」与「键里存了空串」在调用方看来是同一件事,`parseNoticeLog` 虽能兜住,
 * 但语义上会掩盖真实状态(以后若要区分「从未写过」与「写过但被清空」就无从判断)。
 *
 * 失败口径:同步 API 抛错一律让 Promise reject(不 catch、不降级成空),
 * 由页层决定告警策略 —— 留痕是辅助能力,但「写失败」不能假装成功。
 */
import Taro from '@tarojs/taro'
import type { NoticeLogStorage } from '@ihui/shared/chat/notice-log'

export const noticeLogStorage: NoticeLogStorage = {
  async getItem(key: string): Promise<string | null> {
    const raw: unknown = Taro.getStorageSync(key)
    // 非字符串(旧版本可能存过对象/数组)同样按「无有效记录」处理,交给 parseNoticeLog 之前的
    // 这一层就把脏类型挡掉,避免把任意值当 JSON 文本往下传。
    return typeof raw === 'string' && raw !== '' ? raw : null
  },

  async setItem(key: string, value: string): Promise<void> {
    Taro.setStorageSync(key, value)
  },

  async removeItem(key: string): Promise<void> {
    Taro.removeStorageSync(key)
  },
}

/**
 * 记录 id 工厂:一次挂载一个前缀 + 自增序号。
 *
 * 为什么前缀要带随机段:留痕会跨重启持久化,而计数器每次冷启都从 1 开始。若 id 只用
 * `notice-1`,重启后的新记录会和盘上旧记录撞 id,`mergeNotices` 按 id 去重时把旧记录
 * 覆盖掉 —— 用户重开后看不到「上次那条」,恰好毁掉本功能的意义。
 *
 * 为什么放在本文件而不是 chat.tsx:聊天页有一条源锁(thinking-progress-honesty)禁止出现
 * `Math.random()`,用来防「随机进度冒充真实进度」回潮。那是正当约束,不该为了这里去放宽,
 * 故把这枚随机收进留痕自己的支撑模块。
 */
export function createNoticeIdFactory(): () => string {
  const prefix = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let seq = 0
  return () => `${prefix}-${++seq}`
}
