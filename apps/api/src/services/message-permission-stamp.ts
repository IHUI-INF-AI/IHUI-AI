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
 * 现在:流式入口把 workspacePath 记进会话 metadata(chat-queries.bindConversationWorkspace),
 * 回调侧据此查 workspace_permissions 拿**服务端自己的**档位记录来盖章 ——
 * 不接受客户端自报档位(自报=可以伪造"我在只读档"来给审计记录贴金)。
 *
 * 拼写一律过唯一真源归一(跨界只走 wire);认不出/未配置就**不写 key**,
 * 而不是写个 'default' —— 写默认值等于把"不知道"伪装成"知道且是默认档"。
 */
import { permissionModeWire } from '@ihui/types/permission-mode'

/** 消息 metadata 里承载档位的键名(前端读它渲染徽章;跨端同源) */
export const MESSAGE_PERMISSION_META_KEY = 'permissionMode'

/** 会话 metadata 里承载工作区路径的键名(与 ai-chat-stream 写入侧同源) */
export const CONVERSATION_WORKSPACE_META_KEY = 'workspacePath'

/** 权限行里的档位 → 要并入消息 metadata 的键;不可识别则返回空对象(不写 key)。 */
export function permissionStamp(modeRow: unknown): Record<string, string> {
  const wire = permissionModeWire(modeRow)
  return wire ? { [MESSAGE_PERMISSION_META_KEY]: wire } : {}
}

/** 从会话 metadata 取工作区路径(必须是非空字符串,否则视为"未绑定工作区")。 */
export function workspacePathOfConversationMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null
  const raw = (meta as Record<string, unknown>)[CONVERSATION_WORKSPACE_META_KEY]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
