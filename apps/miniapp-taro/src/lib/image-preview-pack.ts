// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro.previewImage / saveImageToPhotosAlbum / setClipboardData(微信小程序运行时),
// 不适合下沉到 packages/shared —— AGENTS.md §3「如果确认平台特有需要端内实现并注明」。
//
// D64② (小元素包 · 图片预览) 的 **miniapp-taro 侧平台 adapter**:
// 判定层唯一真相源仍是 `@ihui/shared/chat/element-pack`,本文件只做「Taro API ↔ 共享判定」的翻译,
// 不自行推导档位 / 索引 / 文案键(端内重写判定 = 第二份真相,守门 40 拦)。
//
// 与 web 端的刻意差异(不是漏做,是平台形态):
//   · 缩放与左右翻页由微信原生预览器提供(`Taro.previewImage` 自带手势缩放与横滑翻页),
//     因此本端不渲染 `IMAGE_ZOOM_STEPS` 缩放条 —— 那会是原生能力之上的重复 UI。
//     共享层的 `zoomStep()` 在本端无消费点,不得为「凑齐」而伪造一个。
//   · 「复制图片」在微信侧没有写入剪贴板二进制的 API(`setClipboardData` 仅接受文本),
//     故本端把「复制」落到 **复制图片地址** 这一可实现的等价动作上,成败仍走同一判定出口。

import Taro from '@tarojs/taro'
import {
  elementPackKey,
  imageCounterView,
  imageTransferView,
  type ImageTransferKind,
  type ImageTransferResult,
} from '@ihui/shared/chat/element-pack'
import type { TranslateFn } from '@/pkg-ai/ai/cards/tool-line'

/** Taro 异步 API 的返回体只承诺 errMsg 可选,这里显式收窄,不用 any。 */
interface TaroAsyncOutcome {
  errMsg?: string
}

/** 一次传输动作的结论:成败 + 全限定文案键(渲染层交给 t(),本文件不产文案)。 */
export interface TaroImageTransferOutcome {
  readonly kind: ImageTransferKind
  readonly result: ImageTransferResult
  /** `ai.pane.elementPack.imagePreview.<kind><Result>`,由 `elementPackKey` 单点拼出 */
  readonly labelKey: string
}

function transferOutcome(
  kind: ImageTransferKind,
  result: ImageTransferResult,
): TaroImageTransferOutcome {
  return { kind, result, labelKey: elementPackKey(imageTransferView(kind, result)) }
}

/**
 * Taro 的 Promise 型 API 在失败时既可能 reject,也可能 resolve 一个 `errMsg: 'fail …'`
 * (授权被拒 / 用户取消两类)。两种形态都要判,否则「保存失败」会被静默吞成成功。
 */
function isTaroFailure(caught: unknown, resolved?: TaroAsyncOutcome): boolean {
  if (caught !== undefined && caught !== null) return true
  const errMsg = resolved?.errMsg ?? ''
  return errMsg.includes('fail')
}

/**
 * 打开微信原生图片预览器。空列表 / 非法入参一律不唤端(原 ChatMessageItem 的防御口径)。
 * @returns 是否真的发起了预览
 */
export function taroPreviewChatImages(currentUrl: string, urlList: readonly string[]): boolean {
  const urls = urlList.filter((u) => typeof u === 'string' && u.length > 0)
  if (urls.length === 0 || typeof currentUrl !== 'string' || currentUrl.length === 0) return false
  void Taro.previewImage({ current: currentUrl, urls: [...urls] })
  return true
}

/**
 * 「第 N · M 张」计数文案:索引钳制与 total 非法判定全在共享层(`imageCounterView`),
 * 本函数只负责把它交给端内 `t()` 做变量插值 —— 用 `t(key, vars)` 形态,
 * 禁止 `t(...).replace('{{n}}', v)`(守门 miniapp-replace-antipattern)。
 * @returns 无图可翻时 null(渲染层不挂载计数节点)
 */
export function taroChatImageCounterText(
  index: number,
  total: number,
  t: TranslateFn,
): string | null {
  const view = imageCounterView(index, total)
  if (view === null) return null
  return t(elementPackKey(view.labelKey), { index: view.values.index, total: view.values.total })
}

/** 保存到相册(微信唯一的图片落盘出口),成败两态都显式返回。 */
export async function taroSaveChatImageToAlbum(
  filePath: string,
): Promise<TaroImageTransferOutcome> {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return transferOutcome('save', 'failed')
  }
  try {
    const res = await Taro.saveImageToPhotosAlbum({ filePath })
    return transferOutcome('save', isTaroFailure(undefined, res) ? 'failed' : 'success')
  } catch {
    return transferOutcome('save', 'failed')
  }
}

/** 复制图片地址(本端「复制图片」的等价形态),成败两态都显式返回。 */
export async function taroCopyChatImageSource(imageUrl: string): Promise<TaroImageTransferOutcome> {
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
    return transferOutcome('copy', 'failed')
  }
  try {
    const res = await Taro.setClipboardData({ data: imageUrl })
    return transferOutcome('copy', isTaroFailure(undefined, res) ? 'failed' : 'success')
  } catch {
    return transferOutcome('copy', 'failed')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
