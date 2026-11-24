// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 保存网络图到相册：**下载失败必须有提示**（行为级锁，不再是源码 grep）。
 *
 * 旧病灶（2026-11-14 现读 `src/utils/save-album.ts` + 唯一调用方
 * `src/pkg-content/recruitment/index/index.tsx:43`）：
 *   - `saveNetworkImageToAlbum` 只在「相册写入失败」时 toast（由 `saveImageToPhotosAlbum` 负责），
 *     下载失败（`Taro.downloadFile` reject / 非 200 / 无 tempFilePath）是直接 throw；
 *   - 唯一调用方写的是 `void saveNetworkImageToAlbum(url).catch(() => {})`，
 *     于是弱网或图片 404 时用户长按二维码只看到 loading 消失，**成功与失败都无提示**。
 *
 * 这里锁四件事（都是用户能看见/能感知的，不是实现细节）：
 *   1. 下载 reject ⇒ 响一次 `album.saveFailed`，并把错误继续抛给调用方（不吞掉）；
 *   2. 下载非 200 / 无临时文件 ⇒ 同上；
 *   3. 任何分支 loading 都要关（XUI-037 的行为版，不依赖源码里是否写了 finally 字样）；
 *   4. 成功分支：先关 loading 再交给相册写入 —— weapp 的 showLoading/showToast 共用同一层浮层，
 *      反过来会让「保存成功」的 toast 被 hideLoading 一并关掉。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const toast = vi.fn()
const hideLoading = vi.fn()
const showLoading = vi.fn()
const downloadFile = vi.fn()
const saveImageToPhotosAlbum = vi.fn()
const showModal = vi.fn()

vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/host/on-toast', () => ({ onToast: (...args: unknown[]) => toast(...args) }))
vi.mock('@tarojs/taro', () => {
  const Taro = {
    showLoading: (...a: unknown[]) => showLoading(...a),
    hideLoading: () => hideLoading(),
    downloadFile: (...a: unknown[]) => downloadFile(...a),
    saveImageToPhotosAlbum: (...a: unknown[]) => saveImageToPhotosAlbum(...a),
    showModal: (...a: unknown[]) => showModal(...a),
    openSetting: vi.fn(),
  }
  return { default: Taro, ...Taro }
})

const { saveNetworkImageToAlbum } = await import('@/utils/save-album')

beforeEach(() => {
  toast.mockReset()
  hideLoading.mockReset()
  showLoading.mockReset()
  downloadFile.mockReset()
  saveImageToPhotosAlbum.mockReset()
  showModal.mockReset()
})

describe('saveNetworkImageToAlbum:下载失败不再静默', () => {
  it('downloadFile reject ⇒ 响 album.saveFailed 且错误继续抛出', async () => {
    downloadFile.mockRejectedValue(new Error('network down'))

    await expect(saveNetworkImageToAlbum('https://cdn.example.com/a.png')).rejects.toThrow(
      'network down',
    )
    expect(toast).toHaveBeenCalledWith('album.saveFailed', { kind: 'error' })
    expect(saveImageToPhotosAlbum).not.toHaveBeenCalled()
  })

  it('downloadFile 非 200 ⇒ 响 album.saveFailed', async () => {
    downloadFile.mockResolvedValue({ statusCode: 404, tempFilePath: '' })

    await expect(saveNetworkImageToAlbum('https://cdn.example.com/a.png')).rejects.toThrow()
    expect(toast).toHaveBeenCalledWith('album.saveFailed', { kind: 'error' })
    expect(saveImageToPhotosAlbum).not.toHaveBeenCalled()
  })

  it('200 但没有临时文件 ⇒ 视为失败并提示', async () => {
    downloadFile.mockResolvedValue({ statusCode: 200, tempFilePath: '' })

    await expect(saveNetworkImageToAlbum('https://cdn.example.com/a.png')).rejects.toThrow()
    expect(toast).toHaveBeenCalledWith('album.saveFailed', { kind: 'error' })
  })

  it('URL 为空 ⇒ album.urlEmpty,不进入下载', async () => {
    await expect(saveNetworkImageToAlbum('   ')).rejects.toThrow('album.urlEmpty')
    expect(toast).toHaveBeenCalledWith('album.urlEmpty', { kind: 'error' })
    expect(downloadFile).not.toHaveBeenCalled()
  })
})

describe('saveNetworkImageToAlbum:loading 生命周期', () => {
  it('下载失败也关 loading(不只成功分支关)', async () => {
    downloadFile.mockRejectedValue(new Error('x'))
    await expect(saveNetworkImageToAlbum('https://cdn.example.com/a.png')).rejects.toThrow()
    expect(showLoading).toHaveBeenCalledTimes(1)
    expect(hideLoading).toHaveBeenCalledTimes(1)
  })

  it('成功时先关 loading 再写相册(toast 不被 hideLoading 关掉)', async () => {
    downloadFile.mockResolvedValue({ statusCode: 200, tempFilePath: 'tmp://x.png' })
    saveImageToPhotosAlbum.mockImplementation(({ success }: { success: () => void }) => {
      // 模拟相册写入成功:helper 内部会 onToast(album.saveSuccess)
      toast('album.saveSuccess', { kind: 'success' })
      success()
    })

    await saveNetworkImageToAlbum('https://cdn.example.com/a.png')

    expect(hideLoading).toHaveBeenCalledTimes(1)
    expect(saveImageToPhotosAlbum).toHaveBeenCalledTimes(1)
    // 顺序证据:hideLoading 的调用序号早于 saveImageToPhotosAlbum
    expect(hideLoading.mock.invocationCallOrder[0]).toBeLessThan(
      saveImageToPhotosAlbum.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    )
    expect(toast).toHaveBeenCalledWith('album.saveSuccess', { kind: 'success' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
