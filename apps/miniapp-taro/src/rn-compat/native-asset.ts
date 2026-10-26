// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-asset.ts —— `expo-asset` 在小程序端的**等价实现**(端内静态资源已是可用 URL,无需下载)。
 *
 * 为什么必须补(2026-10-26 造页器现读):HomeScreen / RecruitmentScreen 以 `Asset.fromModule(QrCodeImage)`
 * 拿图片本地地址,而 expo-asset 入口发未编译 TS ⇒ 这枚壳的闭包射程缺它,weapp 构建整轮停摆。
 *
 * 消费面(现读穷举):
 *   · `Asset.fromModule(模块).downloadAsync()` → 同一个 asset;再读 `.localUri ?? .uri` 交给保存相册链
 *     (HomeScreen:931-933、RecruitmentScreen:56-58)
 *   · `Asset.create(localUri)`(DistributionScreen:132,返回值未被读取)
 *
 * 语义对照与降级(逐处点名,不静默):
 *   · Taro 侧 `import img from './x.png'` 经构建链得到的是**可直接用的地址**(base64 或 CDN/本地相对路径),
 *     不存在"未下载的远程 asset"这一态 ⇒ `downloadAsync()` 是无副作用的空操作并告警一次,
 *     `localUri` 留 undefined,让调用方那句 `localUri ?? uri` 自然落到 uri(与 RN 侧同一条回退分支)。
 *   · `Asset.getByUri / loadAsync` 等未被消费的 API 不补(补了就是无人验证的死面)。
 */
const warned = new Set<string>()
function warnedOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

export class Asset {
  /** 模块解析结果(Taro 侧 = 可直接渲染的地址) */
  uri: string
  localUri: string | undefined
  name: string
  private static readonly cache = new Map<string, Asset>()

  private constructor(source: unknown) {
    const uri = typeof source === 'string' ? source : String(source ?? '')
    this.uri = uri
    this.localUri = undefined
    const name = uri.split(/[?#]/)[0]?.split('/').pop() ?? ''
    this.name = decodeName(name)
  }

  static fromModule(module: unknown): Asset {
    const uri = typeof module === 'string' ? module : String(module ?? '')
    const hit = Asset.cache.get(uri)
    if (hit) return hit
    const created = new Asset(module)
    Asset.cache.set(uri, created)
    return created
  }

  static create(source: unknown): Asset {
    return Asset.fromModule(source)
  }

  static async loadAsync(modules: unknown[]): Promise<Asset[]> {
    return modules.map((item) => Asset.fromModule(item))
  }

  async downloadAsync(): Promise<Asset> {
    warnedOnce(
      'asset-download',
      'expo-asset:小程序端静态资源已在地址可用 ⇒ downloadAsync 为空操作(localUri 恒 undefined,调用方走 uri 回退分支)',
    )
    return this
  }
}

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    // 含 % 但不是合法百分号编码的文件名(端内真实出现过 `100%.png` 这类命名)⇒ 原样返回
    return raw
  }
}

export default { Asset }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
