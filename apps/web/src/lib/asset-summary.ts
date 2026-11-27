// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资产中心(/assets)的口径聚合(2026-11-28 立,入口收敛第二批)
 *
 * 立因:发布账号、发放队列、素材、知识库、记忆、收益分散在六个页面里,用户
 * 要确认「我到底有什么」得点六次。这里把六处**已有的**服务端计数汇到一处,
 * 不做二次统计、不落本地库 —— 数字口径以各域接口为准,本模块只负责:
 *  1) 把不可用(null/undefined)与真实的 0 分开(前者显示「—」且标 unknown,
 *     后者标 empty 并给出下一步动作),避免"接口挂了"被误读为"你没有资产";
 *  2) 固定卡片顺序与文案,便于测试与后续埋点;
 *  3) 把入口 href 收在一处,页面只渲染不判断。
 *
 * 注意:这里**不做鉴权判断**,可见性仍由 useAuthGate + 各域接口自身负责。
 */

export type AssetTone = 'ok' | 'empty' | 'unknown'

/** 六域快照。字段缺省或 null 一律表示「本次没取到」,不是 0。 */
export interface AssetSnapshot {
  /** 发布账号:total 总数,active 健康/可用数。 */
  accounts?: { total: number; active: number } | null
  /** 发布队列:近 30 天各状态计数。 */
  publish?: { draft: number; scheduled: number; running: number; failed: number } | null
  /** 素材总数。 */
  artifacts?: number | null
  /** 知识库条目总数。 */
  knowledge?: number | null
  /** 记忆条目总数。 */
  memory?: number | null
  /** 钱包:可用余额 / 冻结金额。 */
  earnings?: { balance: number; frozen: number } | null
}

export type AssetCardId = 'accounts' | 'publish' | 'artifacts' | 'knowledge' | 'memory' | 'earnings'

export interface AssetCard {
  id: AssetCardId
  title: string
  href: string
  /** 主数字,一律为字符串:不可用是「—」,0 是「0」。 */
  value: string
  /** 次行说明:下一动作或构成拆解。 */
  hint: string
  tone: AssetTone
}

/** 不可用占位符。用全角破折号,与「0」在视觉上一眼可分。 */
export const ASSET_UNKNOWN = '—'

function countValue(n: number | null | undefined): { value: string; tone: AssetTone } {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return { value: ASSET_UNKNOWN, tone: 'unknown' }
  }
  return { value: n.toLocaleString('en-US'), tone: n > 0 ? 'ok' : 'empty' }
}

function money(n: number): string {
  return `¥${n.toFixed(2)}`
}

/**
 * 生成资产中心六张卡。顺序固定:账号 → 发布 → 素材 → 知识 → 记忆 → 收益。
 * 入参允许整块缺失;函数不抛错,保证页面在任一接口 5xx 时仍能渲染其余五张。
 */
export function buildAssetCards(s: AssetSnapshot): AssetCard[] {
  const accounts = s.accounts
  const accountCount = countValue(accounts?.total)
  const publish = s.publish
  const inFlight = publish ? publish.scheduled + publish.running : undefined
  const publishCount = countValue(inFlight)
  const earnings = s.earnings
  const earningsTone = countValue(earnings?.balance).tone

  return [
    {
      id: 'accounts',
      title: '发布账号',
      href: '/publish/accounts',
      value: accountCount.value,
      hint:
        accounts && accounts.total > 0
          ? `可用 ${accounts.active} 个 · 掉线就续期`
          : accounts
            ? '还没接账号 · 点这里接入'
            : '接口暂不可用 · 点这里查看',
      tone: accountCount.tone,
    },
    {
      id: 'publish',
      title: '发布任务',
      href: '/publish/history',
      value: publishCount.value,
      hint: publish
        ? `在途 ${inFlight} · 草稿 ${publish.draft} · 失败 ${publish.failed}`
        : '接口暂不可用 · 点这里查看',
      tone: publishCount.tone,
    },
    {
      id: 'artifacts',
      title: '素材',
      href: '/image-gen',
      value: countValue(s.artifacts).value,
      hint: '图片/视频/文档 · 生成与复用',
      tone: countValue(s.artifacts).tone,
    },
    {
      id: 'knowledge',
      title: '知识库',
      href: '/knowledge-base',
      value: countValue(s.knowledge).value,
      hint: '条目总数 · 喂给 AI 的资料底稿',
      tone: countValue(s.knowledge).tone,
    },
    {
      id: 'memory',
      title: '记忆',
      href: '/memory',
      value: countValue(s.memory).value,
      hint: 'AI 记住的偏好与事实 · 可逐条删',
      tone: countValue(s.memory).tone,
    },
    {
      id: 'earnings',
      title: '收益',
      href: '/wallet',
      value: earnings ? money(earnings.balance) : ASSET_UNKNOWN,
      hint: earnings ? `冻结 ${money(earnings.frozen)} · 可提现口径` : '接口暂不可用 · 点这里查看',
      tone: earningsTone,
    },
  ]
}
