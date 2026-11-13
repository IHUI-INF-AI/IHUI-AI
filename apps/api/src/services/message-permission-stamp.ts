// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 助手消息的"权限档"盖章(G-165)。
 *
 * 背景:AI 回答由异步回调落库(ai-callback → aiCallback worker),那条链路只有
 * conversationId/userId,不知道这次对话绑的是哪个工作区,于是"这条回答在哪一档
 * 权限下生成"服务端无法自证 —— web 的档位徽章只活在内存(刷新即丢),小程序/RN
 * 更是完全看不到(D111 的根因之一)。
 *
 * 现在(F-300 起):流式入口在**绑定时**就把 {messageId, mode, workspacePath} 落成
 * 服务端事实(路径过登记根 realpath 归一,档位取 workspace_permissions 行),回调按
 * messageId 读 —— 不接受客户端自报档位/路径(自报=可以伪造"我在只读档"来给审计记录贴金)。
 *
 * 拼写一律过唯一真源归一(跨界只走 wire);认不出/未配置就**不写 key**,
 * 而不是写个 'default' —— 写默认值等于把"不知道"伪装成"知道且是默认档"。
 *
 * G-165③ 定论(2026-09-23,已最终裁定,勿再翻案):workspace_permissions 无记录时
 * **不回退**到"用户全局默认档"(GET /permission-default 那份)盖第二优先级。理由:
 * ① 盖章的语义是"这条回答生成时实际生效的档"——历史事实;用户全局默认档只是
 *   "以后新建绑定时的偏好",两者是不同性质的事实,后者盖上来就是伪造历史;
 * ② 失败方向必须朝更保守:无 key = 消费方知道"未绑定/未知",会安静降级;
 *   伪造一个值会让审计/回放信任一条从未被验证过的声明(与 G-163 fail-open 同构);
 * ③ 展示层已有分层(消息盖章值 > 工作区默认档上下文行),用户侧并不缺信息,
 *   数据层不需要为了"好看"撒谎。
 * 若未来要在流式入口捕获请求真实生效的档位,那是**新的盖章来源**(服务端可验证的
 * 请求时事实),须另立机制,而不是在本函数加第二个参数做兜底。
 * 结构性防回潮:permissionStamp 只接受一个参数(见测试的 arity 断言)——
 * 有人想加 userDefault 兜底参数,测试先红,逼他先读这段定论。
 *
 * F-300(2026-11-13 立,上面说的"新的盖章来源"):来源前移到**绑定时**。流式入口在
 * 请求处理时就把 {messageId, mode, workspacePath} 落成服务端记录 —— 路径过登记根
 * realpath 归一,档位取服务端 workspace_permissions 行;回调只按 messageId 读这份
 * 不可变事实,不再读会话级 workspacePath、也不在回调时刻查当前档位。客户端伪造
 * 请求体里的 workspacePath 因此不再能影响任何一条消息的徽章。
 */
import { permissionModeWire } from '@ihui/types/permission-mode'
import { assertWithinRegisteredRoots } from '../utils/workspace-roots.js'

/** 消息 metadata 里承载档位的键名(前端读它渲染徽章;跨端同源) */
export const MESSAGE_PERMISSION_META_KEY = 'permissionMode'

/**
 * 会话 metadata 里承载"按 messageId 索引的绑定时刻事实"的键名。
 *
 * 落点用会话既有的 metadata(jsonb)子对象,**不新增表/列**:回调落库时助手消息行
 * 还不存在(worker 侧才 createMessage),消息表没有可挂的既有记录;而会话 metadata
 * 本来就是这条链路的写入面。
 */
export const MESSAGE_PERMISSION_STAMPS_META_KEY = 'permissionStamps'

/** 单个 messageId 的不可变盖章事实 */
export interface MessagePermissionStamp {
  /** 已归一的 wire 档位(与前端词表同源) */
  mode: string
  /** 服务端登记根校验 + realpath 归一后的路径(不是客户端原样字符串) */
  workspacePath: string
}

/**
 * 会话 metadata 会随每条流整行重写,印章不设上限会线性膨胀 ⇒ 只留最近 N 条。
 * 旧于 N 条的消息早已落库完毕,丢了也只会回到"未盖章"(安静降级),不会盖错。
 */
const MESSAGE_PERMISSION_STAMP_MAX_ENTRIES = 200

/** 权限行里的档位 → 要并入消息 metadata 的键;不可识别则返回空对象(不写 key)。 */
export function permissionStamp(modeRow: unknown): Record<string, string> {
  const wire = permissionModeWire(modeRow)
  return wire ? { [MESSAGE_PERMISSION_META_KEY]: wire } : {}
}

/** 按 messageId 读绑定时刻的盖章;缺失/形状不对 → null(不写 permissionMode key)。 */
export function readMessagePermissionStamp(
  meta: unknown,
  messageId: string | undefined,
): MessagePermissionStamp | null {
  if (!meta || typeof meta !== 'object' || !messageId) return null
  const stamps = (meta as Record<string, unknown>)[MESSAGE_PERMISSION_STAMPS_META_KEY]
  if (!stamps || typeof stamps !== 'object') return null
  const entry = (stamps as Record<string, unknown>)[messageId]
  if (!entry || typeof entry !== 'object') return null
  const { mode, workspacePath } = entry as Record<string, unknown>
  if (typeof mode !== 'string' || !mode) return null
  if (typeof workspacePath !== 'string' || !workspacePath.trim()) return null
  return { mode, workspacePath: workspacePath.trim() }
}

/** 往会话 metadata 里并入一条盖章(同 messageId 已存在则保留首发,不覆盖)。 */
export function withMessagePermissionStamp(
  meta: unknown,
  messageId: string,
  stamp: MessagePermissionStamp,
): Record<string, unknown> {
  const base = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
  const previous = base[MESSAGE_PERMISSION_STAMPS_META_KEY]
  const stamps: Record<string, MessagePermissionStamp> = {
    ...(previous && typeof previous === 'object'
      ? (previous as Record<string, MessagePermissionStamp>)
      : {}),
    [messageId]: stamp,
  }
  while (Object.keys(stamps).length > MESSAGE_PERMISSION_STAMP_MAX_ENTRIES) {
    const oldest = Object.keys(stamps)[0]
    if (!oldest) break
    delete stamps[oldest]
  }
  return { ...base, [MESSAGE_PERMISSION_STAMPS_META_KEY]: stamps }
}

/**
 * 服务端解析"这条流绑在哪个工作区、哪一档"。
 *
 * - 路径:必须落在 `IHUI_WORKSPACE_ROOTS` 登记根内(复用唯一判据),返回 realpath 归一值;
 * - 档位:只认本人 `workspace_permissions` 行(先按归一值查,兼容历史行再按原串查一次);
 * - 任一不可得 → null(fail-closed,不盖章而不是盖一个猜的值)。
 */
export async function resolveMessagePermissionStamp(
  userId: string,
  workspacePath: string,
): Promise<MessagePermissionStamp | null> {
  const raw = workspacePath.trim()
  if (!raw) return null
  let real: string
  try {
    real = assertWithinRegisteredRoots(raw, '工作区')
  } catch {
    return null
  }
  // 动态 import:保持本模块的纯函数面(单测/纯函数测试不需要拉起 DB 客户端)。
  const { getPermission } = await import('../db/workspace-permission-queries.js')
  const row = (await getPermission(userId, real)) ?? (await getPermission(userId, raw))
  const mode = permissionModeWire(row?.mode)
  return mode ? { mode, workspacePath: real } : null
}

/**
 * 绑定时落章(流式入口唯一调用面)。
 * 返回 false:路径不在登记根内 / 无档位记录 / 会话非本人 / 该 messageId 已有章。
 */
export async function bindMessagePermissionStamp(
  conversationId: string,
  userId: string,
  messageId: string,
  workspacePath: string,
): Promise<boolean> {
  const stamp = await resolveMessagePermissionStamp(userId, workspacePath)
  if (!stamp) return false
  const { bindMessagePermissionStamp: write } = await import('../db/chat-queries.js')
  return write(conversationId, userId, messageId, stamp)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
