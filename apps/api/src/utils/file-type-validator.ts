// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件类型校验工具(CWE-434 防护)。
 * 校验扩展名白名单 + MIME 类型一致性 + magic number 文件头签名 + 大小限制。
 * 仅依赖 Node.js 内置 Buffer,不引入第三方依赖。
 */

import { extname } from 'node:path'

/** 默认上传大小上限 10MB(无既有限制时使用)。 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
/** multipart 上传大小上限 100MB(对齐 server.ts @fastify/multipart 配置)。 */
export const MAX_MULTIPART_UPLOAD_SIZE = 100 * 1024 * 1024

/**
 * 扩展名 -> 允许的 MIME 集合。集合首项为该扩展名的 canonical MIME。
 * svg / html / htm 等危险类型故意不在白名单中(XSS / RCE 风险)。
 *
 * 2026-11-03(票 S1 ③桶复核,html/rar 维持不收):
 *   · html/htm:apps/api/services/document-parser.ts:127/163/270 的 htmlToText 分支
 *     是内部/连接器喂入路径的解析(不属于用户上传可达),前端 accept 也已在 c52250f555
 *     摘掉 html/htm 承诺;后端按 XSS 故意拒收 ⇒ 白名单不收。
 *   · rar:仅 apps/miniapp-taro/src/rn-compat/native-document.ts:47 MIME_BY_EXT 声明,
 *     全仓 grep 无 `unrar / rarfile / RarFile` 解码路径;apps/cli/src/tools/builtins.ts:688
 *     只把 .rar 当"用 /bash unrar l 列出内容"的**外部命令提示**,不是服务端解包 ⇒
 *     收了等于让用户上传一份无法解析、且压缩炸弹面未验证的容器,不收。
 */
const EXT_MIME_MAP: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  // 2026-10-28 收敛上传白名单(AGENTS.md §0.6):以下 5 个扩展名原先只在
  // `plugins/upload-scanner.ts` 的 DEFAULT_ALLOWED_EXTS 里,本表缺席,
  // 导致同一份"允许上传什么"存在两套判据。此处补齐为并集,scanner 反向派生。
  bmp: ['image/bmp', 'image/x-bmp', 'image/x-ms-bmp'],
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain'],
  // 2026-11-03(票 S1 ③桶):web 富预览的 `richPreviewKindOf` 已把 tsv 当第二型分隔符表格
  // (apps/web/src/lib/file-preview-attachment.ts:94,与 csv 同一状态机 parseDelimitedGeneric),
  // 唯独本白名单不收 ⇒ 用户上传 .tsv 必吃 400,那条预览分支永远走不到(死代码)。
  // text/tab-separated-values 是 IANA 规范值(Find-Media-Type csv 同族),text/plain 是常见退回值。
  tsv: ['text/tab-separated-values', 'text/plain'],
  // 2026-11-03(票 S1 ③桶):两处实现都真在跑 ——
  //   · apps/ai-service/app/tools/document_tools.py:84 SUPPORTED_EXTENSIONS[".json"]="JSON",
  //     :341-347 有 `elif ext == ".json"` 的 json.loads 校验分支(白名单不收 ⇒ 该分支永不被喂);
  //   · apps/miniapp-taro/src/rn-compat/native-document.ts:45 MIME_BY_EXT json: 'application/json'
  //     ⇒ 用户在微信"从聊天记录选文件"能选中 .json,上传即被本表 400。
  // application/json 是 RFC 8259 规范值;text/json 与 text/plain 是常见退回(纯文本档本就不验魔数)。
  json: ['application/json', 'text/json', 'text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  // 2026-11-03(票 D53):RAG 解析面、ai-service 工具、小程序直开、前端 accept 四处都实现了
  // Markdown,唯独这张白名单不收 ⇒ 用户在知识库上传框选中 .md 必吃 400。text/markdown 是
  // Chromium 的声明值,text/plain 是其余客户端常见值(未声明时本函数跳过一致性、只验魔数)。
  md: ['text/markdown', 'text/plain'],
  // 2026-10-16:语音消息上线(mobile-rn 长按录音 → 上传 → 聊天语音气泡回听)。
  // expo-audio HIGH_QUALITY 预设产出 m4a(AAC in MP4 容器);其余三档覆盖导入/转发音频。
  // audio/m4a 是非标准但客户端常见的声明值(RN FormData type),收进白名单省一次 400。
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/vnd.wave'],
  aac: ['audio/aac', 'audio/aacp'],
  ogg: ['audio/ogg', 'application/ogg', 'audio/x-ogg'],
  // 2026-11-04(格式对账尺 ③ 桶收口):flac 的消费面真在跑,唯独这张白名单不收 ——
  //   apps/ai-service/app/services/mcp_server.py:6788 _AUDIO_EXTENSIONS 含 .flac(下载落地),
  //   apps/ai-service/app/routers/media_tasks.py:521 音频直链映射含 "flac": "flac",
  //   apps/api/src/routes/ai-audio.ts:731 AUDIO_ALLOWED_EXTS 含 '.flac'(/api/ai/audio/upload 自成一闸)。
  // audio/flac 是 RFC 8258 登记值,audio/x-flac 是客户端常见退回值。
  flac: ['audio/flac', 'audio/x-flac'],
  // 2026-10-28:视频/音频容器,原仅 scanner 白名单收;MIME 只收真实存在的声明值,
  // 宁可 400 也不放行无对应解码路径的类型(如 video/quicktime 之外的 mov 变体)。
  mp4: ['video/mp4', 'audio/mp4', 'application/mp4'],
  webm: ['video/webm', 'audio/webm'],
  // 2026-11-04(格式对账尺 ③ 桶收口):m4v = MP4 容器(brand 'M4V '),五处消费面早已认它 ——
  //   apps/api/src/plugins/upload-scanner.ts:44 ftyp 嗅探已列 ['mp4','m4v'](嗅探声称能产 m4v,
  //   而白名单不收 ⇒ 嗅出的类型反而过不了校验,是自相矛盾),
  //   apps/ai-service/app/routers/media_tasks.py:520 下载映射 "m4v": "mp4",
  //   apps/miniapp-taro/src/rn-compat/platform.tsx:69/82/151(MIME 双表 + saveVideoToPhotosAlbum),
  //   apps/miniapp-taro/src/pkg-ai/agent-dialogue/index.tsx:59 与 packages/app/src/features/chat-room/ChatRoomScreen.tsx:90(视频扩展名正则)。
  // 本表不收 ⇒ 用户选中 .m4v 上传必吃 400,上述分支全走不到(死代码)。
  // video/x-m4v 是 Apple/客户端常见声明值,video/mp4 与 application/mp4 是容器真值。
  m4v: ['video/mp4', 'video/x-m4v', 'application/mp4'],
  mov: ['video/quicktime', 'video/mov'],
  // 2026-09-08:anydoc 解析引擎接入后开放的文档格式
  odt: ['application/vnd.oasis.opendocument.text'],
  // 2026-11-03(票 S1 ③桶):OpenDocument 家族另两型。判据同 odt:
  //   · 同为 ZIP 容器(mimetype 首条 + 前四字节 PK\x03\x04),魔数归 odt 那一组,
  //     不新增解压路径 ⇒ 无压缩炸弹新面;
  //   · apps/ai-service/app/tools/document_tools.py:60-64 _ANYDOC_EXTS 与
  //     :80-97 SUPPORTED_EXTENSIONS 两处都登记 ods/odp,并交给 anydoc 主路径,
  //     上传白名单不收 ⇒ 那条分支永远走不到(死代码)。
  //   · odt 已在白名单(同 anydoc 路径、同 ZIP 头),odp/ods 与 odt 属同族,
  //     按证据同批补齐;apps/api/services/document-parser.ts 侧的 ANYDOC_MIMES
  //     暂未含 odp/ods MIME,由后续票补(不在本票文件射程)。
  odp: ['application/vnd.oasis.opendocument.presentation'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  rtf: ['application/rtf', 'text/rtf'],
  epub: ['application/epub+zip'],
}

export const ALLOWED_EXTENSIONS = Object.keys(EXT_MIME_MAP)

/**
 * 提取小写无点扩展名。
 *
 * 2026-11-01 改为全函数(nullish ⇒ 空串):此前签名写 `string` 却真会收到 `null/undefined`
 * —— `uploadSessions.fileName` 在库里可为空,而分片合并链把会话行原样交进来
 * (`chunked-upload.ts` 的 `validateUploadHead(head, session.fileName, …)`)。Node 的
 * `path.extname(undefined)` 抛 `ERR_INVALID_ARG_TYPE`,那个 throw 被合并段的
 * `catch` 折成 500 ⇒ **内容类型闸本该 fail-closed(415 + 删产物),却折成了 fail-open
 * 的半成品留盘**。判"没有扩展名"是业务结论,不该是崩溃。
 */
export function extractExt(filename: string | null | undefined): string {
  if (!filename) return ''
  return extname(filename).toLowerCase().replace(/^\./, '')
}

/** 去掉 MIME 的 charset 等参数后缀(如 text/plain; charset=utf-8)。 */
function normalizeMime(mime: string): string {
  return (mime.split(';')[0] ?? '').trim().toLowerCase()
}

/** 获取扩展名对应的 canonical MIME(未命中返回 undefined)。 */
export function getCanonicalMime(ext: string): string | undefined {
  return EXT_MIME_MAP[ext]?.[0]
}

/** 校验 buffer 是否匹配任一签名(从指定偏移开始)。 */
function matchesAny(buf: Buffer, signatures: number[][], offset = 0): boolean {
  return signatures.some((sig) => {
    if (buf.length < sig.length + offset) return false
    for (let i = 0; i < sig.length; i++) {
      if (buf[offset + i] !== sig[i]) return false
    }
    return true
  })
}

/**
 * 校验文件头 magic number。返回 true 表示签名匹配(或该类型无需 magic 校验)。
 * 读取前 8-16 字节,覆盖任务要求的全部签名:
 *   JPEG  FF D8 FF
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   GIF   47 49 46 38 (37 61 / 39 61)
 *   WebP  52 49 46 46 ... 57 45 42 50  (RIFF....WEBP)
 *   BMP   42 4D  (BM)
 *   PDF   25 50 44 46
 *   ZIP   50 4B 03 04  (docx/xlsx/pptx/odt/epub 共用)
 *   OLE2  D0 CF 11 E0 A1 B1 1A E1  (doc/xls/ppt 共用)
 *   RTF   7B 5C 72 74 66  ({\rtf)
 *   OGG   4F 67 67 53  (OggS)
 *   EBML  1A 45 DF A3  (webm/mkv 容器)
 *   ftyp  @偏移 4  (m4a/mp4/mov 共用 MP4 系容器头)
 */
/**
 * 校验文件头魔数(按扩展名选判据)。
 *
 * 2026-10-28 导出:会员批量导入(`routes/member.ts`)需要"只验容器头、不验 MIME 一致性"
 * —— 它的 CSV 会被浏览器/RN 声明成 `application/vnd.ms-excel`、`text/plain` 甚至空,
 * 走 `validateUploadFile` 的 MIME 一致性会误伤真实用户;但 xlsx/xls 的容器头仍必须验,
 * 否则任意二进制改名后就能喂给 `XLSX.read()`(zip bomb 放大)。
 * 判据仍只有这一份,调用方不得自己写魔数表(AGENTS.md §0.6)。
 */
export function checkMagicNumber(ext: string, buf: Buffer): boolean {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return matchesAny(buf, [[0xff, 0xd8, 0xff]])
    case 'png':
      return matchesAny(buf, [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]])
    case 'gif':
      return matchesAny(buf, [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      ])
    case 'webp': {
      if (buf.length < 12) return false
      const riff = buf.subarray(0, 4).toString('latin1') === 'RIFF'
      const webp = buf.subarray(8, 12).toString('latin1') === 'WEBP'
      return riff && webp
    }
    case 'bmp':
      // BMP:文件头固定 'BM'
      return matchesAny(buf, [[0x42, 0x4d]])
    case 'pdf':
      return matchesAny(buf, [[0x25, 0x50, 0x44, 0x46]])
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'odt':
    case 'odp':
    case 'ods':
    case 'epub':
      // docx/xlsx/pptx(OOXML)与 odt/odp/ods/epub(开放文档)物理结构均为 ZIP;
      // 空归档与跨卷归档亦放行
      return matchesAny(buf, [
        [0x50, 0x4b, 0x03, 0x04],
        [0x50, 0x4b, 0x05, 0x06],
        [0x50, 0x4b, 0x07, 0x08],
      ])
    case 'doc':
    case 'xls':
    case 'ppt':
      // OLE2 Compound Document(legacy Office 二进制格式)
      return matchesAny(buf, [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]])
    case 'rtf':
      // RTF 文件头 '{\rtf'
      return matchesAny(buf, [
        [0x7b, 0x5c, 0x72, 0x74, 0x66], // {\rtf
      ])
    case 'txt':
    case 'csv':
    case 'md':
    case 'tsv':
    case 'json':
      // 纯文本无固定 magic number,跳过文件头校验
      return true
    // ── 音频(2026-10-16 语音消息上线)──
    case 'm4a':
    case 'mp4':
    case 'm4v':
      // MP4 容器:偏移 4 起为 'ftyp'(expo-audio 录音 = ftypM4A;视频 = ftypisom/mp42;m4v = ftypM4V )
      return buf.length >= 8 && buf.subarray(4, 8).toString('latin1') === 'ftyp'
    case 'mov':
      // QuickTime 与 MP4 同源:绝大多数 .mov 也是 'ftyp' 容器(brand 多为 'qt  '),
      // 但老式 QuickTime 无 ftyp,首个 atom 直接是 moov/mdat/wide/free 等。
      // 两者都放行 —— 此处只做"不是随便一个二进制"的判据,不做 brand 精确识别,
      // 否则会误杀 ffmpeg 导出的 ftypisom 版 .mov(功能回退)。
      if (buf.length >= 8 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return true
      return (
        buf.length >= 8 &&
        ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(
          buf.subarray(4, 8).toString('latin1'),
        )
      )
    case 'ogg':
      // Ogg 容器页头 'OggS'
      return matchesAny(buf, [[0x4f, 0x67, 0x67, 0x53]])
    case 'flac':
      // 原生 FLAC 流:首四字节即 'fLaC' 流标记(RFC 8258 §10.1)。
      // FLAC-in-Ogg 封装不改 .flac 扩展名的话首字节是 OggS —— 那是容器与扩展名不一致,
      // 按本函数既有口径拒(宁可 400 也不放行无对应解码路径的字节流),用户应改投 .oga。
      return matchesAny(buf, [[0x66, 0x4c, 0x61, 0x43]])
    case 'webm':
      // EBML 头(webm/mkv 共用)
      return matchesAny(buf, [[0x1a, 0x45, 0xdf, 0xa3]])
    case 'mp3':
      // ID3v2 标签头 或 MPEG 帧同步(0xFFE0 掩码)
      if (buf.length >= 3 && buf.subarray(0, 3).toString('latin1') === 'ID3') return true
      return buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0
    case 'aac':
      // ADTS 帧同步(0xFFF0 掩码)
      return buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xf0) === 0xf0
    case 'wav':
      // RIFF 容器 + 偏移 8 'WAVE'
      return (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buf.subarray(8, 12).toString('latin1') === 'WAVE'
      )
    default:
      return false
  }
}

export interface ValidationResultOk {
  ok: true
  extension: string
  mimeType: string
}

export interface ValidationResultErr {
  ok: false
  reason: string
}

export type ValidationResult = ValidationResultOk | ValidationResultErr

/**
 * 只按「文件头」校验类型：扩展名白名单 + MIME 一致性 + magic number，**不含大小判定**。
 *
 * 2026-10-31 安全强化第 10 批 R10 抽出（供分片上传合并后校验用）：
 * 分片上传是为大文件设计的（`MAX_UPLOAD_SIZE` 10MB 对它是硬回退），但此前合并完
 * 只比对客户端声明的 md5（且 `fileMd5` 可选 ⇒ 不声明就完全不校验内容），
 * 任意二进制都能落进 `uploads/public` 在可信域托管。合并后无法把整包读进内存，
 * 只能读头部 —— 该函数就是"头部能判的那部分"，判据与 `validateUploadFile` 同一份
 * （后者内部复用它，AGENTS.md §0.6 单一真相源）。
 *
 * @param head         文件前若干字节（建议 ≥ 4096，覆盖全部已定义魔数的最长前缀）
 * @param filename     原始文件名（用于提取扩展名）；nullish 按"无扩展名"拒绝，不抛
 * @param declaredMime 客户端声明的 MIME；空串表示"未声明"（跳过一致性判，只验魔数）
 */
export function validateUploadHead(
  head: Buffer,
  filename: string | null | undefined,
  declaredMime: string,
): ValidationResult {
  if (head.length === 0) {
    return { ok: false, reason: '文件内容为空' }
  }

  const ext = extractExt(filename)
  if (!ext) {
    return { ok: false, reason: '文件名缺少扩展名' }
  }
  const allowedMimes = EXT_MIME_MAP[ext]
  if (!allowedMimes) {
    return { ok: false, reason: `不支持的文件类型: .${ext}` }
  }

  // 未声明 MIME 时不判一致性（很多客户端对大文件分片上传根本不发 Content-Type，
  // 硬要它匹配会把正常用户挡在门外）；魔数判据仍在下一关生效。
  if (declaredMime) {
    const normalizedMime = normalizeMime(declaredMime)
    if (!allowedMimes.includes(normalizedMime)) {
      return { ok: false, reason: `MIME 类型 ${declaredMime} 与扩展名 .${ext} 不匹配` }
    }
  }

  if (!checkMagicNumber(ext, head)) {
    return { ok: false, reason: '文件内容与声明的类型不一致(magic number 校验失败)' }
  }

  const canonicalMime = allowedMimes[0]
  if (!canonicalMime) {
    return { ok: false, reason: '内部错误:文件类型映射异常' }
  }
  return { ok: true, extension: ext, mimeType: canonicalMime }
}

/**
 * 校验上传文件:扩展名白名单 + MIME 一致性 + magic number + 大小限制。
 * @param buffer       文件二进制内容
 * @param filename     原始文件名(用于提取扩展名)
 * @param declaredMime 客户端声明的 MIME 类型
 * @param maxSize      最大字节数(默认 10MB)
 * @returns 校验通过返回 canonical extension + mimeType,失败返回 reason
 */
export function validateUploadFile(
  buffer: Buffer,
  filename: string,
  declaredMime: string,
  maxSize: number = MAX_UPLOAD_SIZE,
): ValidationResult {
  if (buffer.length === 0) {
    return { ok: false, reason: '文件内容为空' }
  }
  if (buffer.length > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0)
    return { ok: false, reason: `文件大小超过 ${mb}MB 限制` }
  }
  return validateUploadHead(buffer, filename, declaredMime)
}

/**
 * 净化存储文件名:取 basename、去控制字符与空字节、去前导点。
 * 丢弃路径分隔符,防止路径穿越;保留原始名用于展示。
 *
 * 2026-08-25 上传链路审计加固:
 * - 追加替换 Windows 保留字符(`< > : " | ? *`),避免含非法字符的文件名写入 DB/回显
 * - 折叠连续点号(`..` → `.`),防展示层把文件名误读为上级目录
 * - 保留中文等 Unicode 字符,仅替换 ASCII 危险字符
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\/\\]/).pop() ?? filename
  const cleaned = base
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.\.+/g, '.')
  return cleaned || 'unnamed'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
