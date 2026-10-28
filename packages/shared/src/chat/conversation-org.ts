// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话文件夹/标签(G-11)纯逻辑层 —— chat 侧增量 API:withTagAdded / withTagRemoved /
// listTagNames / groupByFolder。
//
// 2026-09-26 语义归一:本文件曾是第二真相源(v1 自带 40/32/8 常量与一套独立 normalize),
// 与唯一正主 utils/conversation-org(根 barrel 经 utils/index.ts 唯一出口)的同名符号行为分叉:
//   · normalizeOrgName:这里删控制字符且漏 \x7f/\u2028/\u2029、maxLength 必传;utils 折成单空格、
//     全量控制字符、默认 max=ORG_FOLDER_MAX_LENGTH(64)并容错非字符串;
//   · normalizeTagList:这里大小写敏感去重;utils 按小写去重并容错 null/非数组/非字符串项;
//   · getOrgMeta:未命中这里每次新建 {};utils 返回模块级冻结空对象(引用稳定,防渲染层 effect 每帧重跑);
//   · withFolderMeta/withTagsMeta:这里值没变也换 map 引用;utils 等值时返回入参本体(store 靠它短路 set());
//   · listFolderNames / filterByFolder:这里吃原始脏值 + localeCompare(随 ICU 漂移);utils 先归一化 + 码位确定性排序;
//   · sortPinnedFirst:这里比较器 pinned===true;utils truthy 判定 + 分区稳定重排(语义一致,实现归一)。
// 现常量(64/24/8)、类型与上述同名原语全部 re-export utils 版,本文件零复制;变异守卫见
// chat/__tests__/conversation-org.test.ts —— 把 re-export 改回本地字面量(哪怕数值抄成一样)测试必红。
// 纯函数、零平台依赖、immutable —— 元数据由调用方持久化(web 端 store 走根 barrel 的 utils 版)。

// chat 侧增量 API 内部实现所用的 utils 原语(别名导入,避免与下方 re-export 同名混淆)
import {
  ORG_TAG_MAX_LENGTH,
  getOrgMeta as readOrgMeta,
  normalizeOrgName as sanitizeOrgName,
  withTagsMeta as writeTagsMeta,
  type ConversationOrgMap,
} from '../utils/conversation-org'

// 类型、常量与同名原语同源 re-export:唯一实现都在 utils/conversation-org,本文件零复制。
export type { ConversationOrgMeta, ConversationOrgMap } from '../utils/conversation-org'
export {
  ORG_FOLDER_MAX_LENGTH,
  ORG_TAG_MAX_LENGTH,
  ORG_TAG_MAX_COUNT,
  filterByFolder,
  getOrgMeta,
  listFolderNames,
  normalizeOrgName,
  normalizeTagList,
  sortPinnedFirst,
  withFolderMeta,
  withTagsMeta,
} from '../utils/conversation-org'

/** 追加一个标签;重复(大小写变体由 utils 归一化按小写去重兜底)或归一化后为空时返回原 map(引用相等,便于调用方判"没变化") */
export function withTagAdded(map: ConversationOrgMap, id: string, tag: string): ConversationOrgMap {
  const current = readOrgMeta(map, id).tags ?? []
  const normalized = sanitizeOrgName(tag, ORG_TAG_MAX_LENGTH)
  if (!normalized || current.includes(normalized)) return map
  return writeTagsMeta(map, id, [...current, normalized])
}

/** 移除一个标签;不存在时返回原 map */
export function withTagRemoved(
  map: ConversationOrgMap,
  id: string,
  tag: string,
): ConversationOrgMap {
  const current = readOrgMeta(map, id).tags ?? []
  if (!current.includes(tag)) return map
  return writeTagsMeta(
    map,
    id,
    current.filter((t) => t !== tag),
  )
}

/** 全部标签名(去重 + 字典序) */
export function listTagNames(map: ConversationOrgMap): string[] {
  const set = new Set<string>()
  for (const meta of Object.values(map)) {
    for (const tag of meta.tags ?? []) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** 会话最小结构(调用方传 Conversation / ConversationItem 均可) */
interface OrgItem {
  id: string
}

/** 按文件夹分组:命名文件夹按字典序在前,未分组(null)恒在最后;组内保持输入顺序 */
export function groupByFolder<T extends OrgItem>(
  items: readonly T[],
  map: ConversationOrgMap,
): Array<{ folder: string | null; items: T[] }> {
  const named = new Map<string, T[]>()
  const ungrouped: T[] = []
  for (const item of items) {
    const folder = readOrgMeta(map, item.id).folder ?? null
    if (folder) {
      const bucket = named.get(folder)
      if (bucket) bucket.push(item)
      else named.set(folder, [item])
    } else {
      ungrouped.push(item)
    }
  }
  return [
    ...[...named.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((folder) => ({
        folder,
        items: named.get(folder) ?? [],
      })),
    ...(ungrouped.length > 0 ? [{ folder: null, items: ungrouped }] : []),
  ]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
