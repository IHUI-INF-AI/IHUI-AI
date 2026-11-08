// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * chrome.storage.local 访问级收紧(2026-11-08,同型根因 E 类第 2 条)。
 *
 * 长期 refreshToken 只能落 `storage.local`(会话级存储会被浏览器重启清空,失去续期能力)。
 * 但该 area 默认对内容脚本可读,等于把长期凭据放在宿主页面边界内。这里把访问级显式
 * 降到 TRUSTED_CONTEXTS:内容脚本物理读不到 token area,扩展页面/background 不受影响。
 *
 * 取舍说明(为什么不做"自造密钥加密"):
 * 扩展没有可长期安全存放密钥的位置 —— 密钥若也写 storage,与密文同处一个可信边界,
 * 只是把明文换成"明文 + 同库密钥",属安全剧场;若放 storage.session,浏览器重启即丢,
 * 等同于取消"跨重启续期"这一 refreshToken 的本来用途。故选择作用域收紧,而不是伪加密。
 */
export async function restrictLocalStorageToTrustedContexts(): Promise<void> {
  try {
    const area = chrome.storage?.local as
      | { setAccessLevel?: (options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void> | void }
      | undefined
    if (!area?.setAccessLevel) {
      // 旧版运行时没有该 API:保持现状可用性,只记日志,不阻断启动
      console.warn('[IHUI AI] storage.local.setAccessLevel 不可用,跳过访问级收紧')
      return
    }
    await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  } catch (err) {
    console.warn('[IHUI AI] storage.local setAccessLevel failed:', err)
  }
}
