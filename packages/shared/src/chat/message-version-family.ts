// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票59 跨端腿(2026-11-01 提 shared):消息版本族判族/投影/位置读数 —— 唯一真相源。
 *
 * 原住 apps/web/src/lib/message-version-family.ts;miniapp-taro 接入 sibling 契约后
 * 两端消费同一份判族(§4 跨端铁律「禁止两端各写一份靠对账追平」、§3 共享层优先)。
 * web 侧原文件已收口为对本报的 re-export,全仓不得再立第二份实现。
 *
 * 背景:票59(regenerate)与票64(edit)的写链都把新回复/新内容作为
 * `parent_message_id = 族根` + `sibling_index = 递增序号` 的 sibling 落库,
 * 服务端读面(wire)已透出 `parentMessageId` / `siblingIndex`(serializeMessage,
 * 基类承载见 packages/shared/src/hooks/use-chat.ts)。
 *
 * **判族判据(与 W16 live 本地链的同名不同义问题)**:
 *  - 只有 `siblingIndex` 非 null 且非 undefined 的行才参与族投影 —— 该字段只有
 *    服务端历史水合会带;live `addMessage` 写的 `parentMessageId`(=前一条)
 *    没有 siblingIndex 伴随,不受影响。
 *  - 族根 = `parentMessageId ?? id`(族根自身被 regenerate 首次开族时服务端补
 *    siblingIndex=0)。
 *  - 激活版本 = 族内 siblingIndex 最大者;手动切换态(activeVersionByRoot)覆盖默认。
 *  - 防御:族根不在当前集合时,该族**整族保留**不投影 —— 宁可多渲染两个气泡,
 *    不可整族消失(丢内容比重复严重)。
 */

/** 参与族判定所需的最小消息形状(store ChatMessage 与测试夹具都满足) */
export interface VersionFamilyMessage {
  readonly id: string
  readonly parentMessageId?: string | null
  readonly siblingIndex?: number | null
}

/** 该消息是否携带服务端盖章的版本族坐标(判族唯一入口,live 消息判 false) */
export function hasVersionFamilyCoords(m: VersionFamilyMessage): boolean {
  return m.siblingIndex !== null && m.siblingIndex !== undefined
}

/** 族根 id:成员取 parentMessageId,族根取自身 */
export function versionFamilyRootId(m: VersionFamilyMessage): string {
  return m.parentMessageId ?? m.id
}

/**
 * 族成员枚举:族根 + 全部带坐标的 sibling,按 siblingIndex 升序(平局取输入序)。
 * 版本切换器、`n/N` 位置读数与投影的"激活"判定共用这一份枚举。
 */
export function versionFamilyMembers<M extends VersionFamilyMessage>(
  messages: readonly M[],
  rootId: string,
): M[] {
  const candidates: { member: M; index: number }[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!
    if (!hasVersionFamilyCoords(m) || versionFamilyRootId(m) !== rootId) continue
    candidates.push({ member: m, index: i })
  }
  candidates.sort((a, b) => {
    const d = (a.member.siblingIndex ?? 0) - (b.member.siblingIndex ?? 0)
    return d !== 0 ? d : a.index - b.index
  })
  return candidates.map((c) => c.member)
}

/**
 * 版本切换位置的读投影:某条消息在它自己版本族里的序号与总数。
 * 返回 null 的三种情形都意味着"不渲染切换器":消息不在集合 / 不带族坐标 /
 * 族内只有一条。`members` 随结果给出,调用方按同一份枚举算相邻版本。
 */
export function versionFamilyPosition<M extends VersionFamilyMessage>(
  messages: readonly M[],
  messageId: string,
): { rootId: string; index: number; total: number; members: M[] } | null {
  const target = messages.find((m) => m.id === messageId)
  if (!target || !hasVersionFamilyCoords(target)) return null
  const rootId = versionFamilyRootId(target)
  const members = versionFamilyMembers(messages, rootId)
  if (members.length < 2) return null
  const index = members.findIndex((m) => m.id === messageId)
  if (index < 0) return null
  return { rootId, index, total: members.length, members }
}

/**
 * 版本族投影:输入按时间线排列的消息,输出同序但族内只保留激活版本。
 * `activeVersionByRoot` 指向已不存在消息时一律回落默认(最新版本)。
 */
export function projectActiveMessages<M extends VersionFamilyMessage>(
  messages: readonly M[],
  activeVersionByRoot?: Readonly<Record<string, string>>,
): M[] {
  const familyOf = new Map<string, { member: M; index: number }[]>()
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!
    if (!hasVersionFamilyCoords(m)) continue
    const root = versionFamilyRootId(m)
    const bucket = familyOf.get(root)
    if (bucket) bucket.push({ member: m, index: i })
    else familyOf.set(root, [{ member: m, index: i }])
  }

  const suppressed = new Set<number>()
  for (const [root, members] of familyOf) {
    const rootInSet = root === members[0]!.member.id ? true : messages.some((m) => m.id === root)
    if (!rootInSet) continue
    let active = members[0]!
    for (const m of members) {
      const a = active.member.siblingIndex ?? 0
      const b = m.member.siblingIndex ?? 0
      if (b > a || (b === a && m.index > active.index)) active = m
    }
    const pinnedId = activeVersionByRoot?.[root]
    if (pinnedId) {
      const pinned = members.find((m) => m.member.id === pinnedId)
      if (pinned) active = pinned
    }
    for (const m of members) {
      if (m.index !== active.index) suppressed.add(m.index)
    }
  }

  if (suppressed.size === 0) return messages.slice()
  return messages.filter((_, i) => !suppressed.has(i))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
