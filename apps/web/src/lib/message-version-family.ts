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
 * 版本族投影:输入按时间线排列的消息,输出同序但族内只保留激活版本。
 *
 * 排序判据:同族内 siblingIndex 大者激活;siblingIndex 相同(不应出现,防御)
 * 取数组中靠后者(= 时间线更晚)。非族消息与整族无坐标的消息原样保留。
 */
export function projectActiveMessages<M extends VersionFamilyMessage>(
  messages: readonly M[],
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
    const rootInSet = root === members[0]!.member.id
      ? true
      : messages.some((m) => m.id === root)
    if (!rootInSet) continue
    // 激活 = siblingIndex 最大(平局取时间线靠后)
    let active = members[0]!
    for (const m of members) {
      const a = (active.member.siblingIndex ?? 0)
      const b = (m.member.siblingIndex ?? 0)
      if (b > a || (b === a && m.index > active.index)) active = m
    }
    for (const m of members) {
      if (m.index !== active.index) suppressed.add(m.index)
    }
  }

  if (suppressed.size === 0) return messages.slice()
  return messages.filter((_, i) => !suppressed.has(i))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
