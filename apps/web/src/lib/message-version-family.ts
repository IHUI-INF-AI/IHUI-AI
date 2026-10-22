// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票64(2026-10-18 立):版本族读投影 —— 消息列表按族只渲染激活版本。
 *
 * 背景:票59(regenerate)与票64(edit)的写链都把新回复/新内容作为
 * `parent_message_id = 族根` + `sibling_index = 递增序号` 的 sibling 落库,
 * 服务端读面(wire)已透出 `parentMessageId` / `siblingIndex`(serializeMessage)。
 * 但消息列表此前零过滤 ⇒ 族内所有 sibling 同时渲染("点一次编辑出两个气泡")。
 *
 * **判族判据(与 W16 live 本地链的同名不同义问题)**:
 *  - 只有 `siblingIndex` 非 null 且非 undefined 的行才参与族投影 —— 该字段只有
 *    服务端历史水合(history-message.ts)会带;live `addMessage` 写的
 *    `parentMessageId`(=前一条,W16 消息树地基)没有 siblingIndex 伴随,不受影响。
 *  - 族根 = `parentMessageId ?? id`(族根自身被 regenerate 首次开族时服务端补
 *    siblingIndex=0)。
 *  - 激活版本 = 族内 siblingIndex 最大者(= 最新一次 regenerate/edit 的结果,
 *    与"生成完看到新回复"的直觉一致);版本切换交互(票59 2/3、3/3)落位后由
 *    切换态覆盖本默认,本函数保持纯函数、不持状态。
 *  - 防御:族根不在当前集合(分页切割/局部回放)时,该族**整族保留**不投影 ——
 *    宁可多渲染两个气泡,不可整族消失(丢内容比重复严重)。
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
 * 族成员枚举(票59 2/3 切片,2026-10-22):族根 + 全部带坐标的 sibling,
 * 按 siblingIndex 升序(平局取输入序)。版本切换器、`n/N` 位置读数与投影
 * 的"激活"判定共用这一份枚举 —— 第二份枚举必然漂移。
 *
 * 判族口径与 projectActiveMessages 完全同源(hasVersionFamilyCoords +
 * versionFamilyRootId),不在这里另立规则。
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
 * 版本切换位置的读投影(票59 2/3):某条消息在它自己版本族里的序号与总数。
 *
 * 返回 null 的三种情形都意味着"不渲染切换器":消息不在集合 / 不带族坐标 /
 * 族内只有一条(= 没有可切的东西,画一个 1/1 只会骗用户去点)。
 * `members` 随结果一起给出,让调用方按同一份枚举算相邻版本,不必二次判族。
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
 *
 * 排序判据:同族内 siblingIndex 大者激活;siblingIndex 相同(不应出现,防御)
 * 取数组中靠后者(= 时间线更晚)。非族消息与整族无坐标的消息原样保留。
 *
 * `activeVersionByRoot`(票59 2/3):用户手动切换的激活版本(rootId → 消息 id)。
 * 只有它真的指向本族成员时才覆盖默认判据 —— 指向已不存在的消息(切会话/服务端
 * 删除/持久化残影)一律回落默认。失效方向必须是"回到最新版本",绝不能因为一个
 * 坏指针把整族渲染成空。
 */
export function projectActiveMessages<M extends VersionFamilyMessage>(
  messages: readonly M[],
  activeVersionByRoot?: Readonly<Record<string, string>>,
): M[] {
  // 先收集各族成员(带输入序,保序输出用)
  const familyOf = new Map<string, { member: M; index: number }[]>()
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!
    if (!hasVersionFamilyCoords(m)) continue
    const root = versionFamilyRootId(m)
    const bucket = familyOf.get(root)
    if (bucket) bucket.push({ member: m, index: i })
    else familyOf.set(root, [{ member: m, index: i }])
  }

  // 求每族被剔除成员的输入序集合(激活者保留)
  const suppressed = new Set<number>()
  for (const [root, members] of familyOf) {
    // 防御:族根不在集合 ⇒ 无法判定族完整性,整族保留(见头注)
    const rootInSet = root === members[0]!.member.id ? true : messages.some((m) => m.id === root)
    if (!rootInSet) continue
    // 激活 = siblingIndex 最大(平局取时间线靠后)
    let active = members[0]!
    for (const m of members) {
      const a = active.member.siblingIndex ?? 0
      const b = m.member.siblingIndex ?? 0
      if (b > a || (b === a && m.index > active.index)) active = m
    }
    // 手动切换态覆盖默认:指针必须命中本族成员,否则回落上面的默认(见头注)
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
