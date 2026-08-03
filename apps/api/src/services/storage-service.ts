/**
 * 存储服务（文件上传/下载/签名 URL）。
 * 迁移自旧架构 storage_service.py（FileStorageService，本地文件系统）。
 *
 * 设计：
 * - 本地存储为默认实现（零依赖）
 * - OSS 驱动配置通过 oss-queries 读取，预留扩展点
 * - 上传文件以 file_id 为名存储，支持元数据(sidecar .meta)与缩略图
 */

import { createHash, createHmac, createPublicKey, createVerify, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { env } from 'node:process'

const BASE_DIR = env.STORAGE_DIR ?? 'storage'
const UPLOADS_DIR = join(BASE_DIR, 'uploads')
const THUMBNAILS_DIR = join(BASE_DIR, 'thumbnails')
const CACHE_DIR = join(BASE_DIR, 'cache')

/** 确保目录存在（幂等）。 */
function ensureDirs(): void {
  for (const dir of [UPLOADS_DIR, THUMBNAILS_DIR, CACHE_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export interface SavedFile {
  id: string
  size: number
  hash: string
  path: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface FileInfo {
  id: string
  size: number
  createdAt: string
  modifiedAt: string
  metadata?: Record<string, unknown>
}

export interface StorageStats {
  totalFiles: number
  totalSize: number
  uploadsDir: string
  thumbnailsDir: string
  cacheDir: string
}

function filePath(fileId: string): string {
  return join(UPLOADS_DIR, fileId)
}

function thumbnailPath(fileId: string): string {
  return join(THUMBNAILS_DIR, `${fileId}.jpg`)
}

function metaPath(fileId: string): string {
  return `${filePath(fileId)}.meta`
}

/** 生成新 file_id。 */
export function generateFileId(): string {
  return randomUUID()
}

/** 保存文件内容（含可选元数据 sidecar）。 */
export function saveFile(
  content: Buffer,
  fileId: string = generateFileId(),
  metadata?: Record<string, unknown>,
): SavedFile {
  ensureDirs()
  const path = filePath(fileId)
  writeFileSync(path, content)
  const hash = createHash('sha256').update(content).digest('hex')

  if (metadata) {
    writeFileSync(metaPath(fileId), JSON.stringify(metadata))
  }

  return {
    id: fileId,
    size: content.length,
    hash,
    path,
    createdAt: new Date().toISOString(),
    metadata,
  }
}

/** 读取文件内容。不存在返回 null。 */
export function readFile(fileId: string): Buffer | null {
  const path = filePath(fileId)
  if (!existsSync(path)) return null
  return readFileSync(path)
}

/** 删除文件（含元数据与缩略图）。返回是否删除了主文件。 */
export function deleteFile(fileId: string): boolean {
  const path = filePath(fileId)
  let deleted = false
  if (existsSync(path)) {
    unlinkSync(path)
    deleted = true
  }
  const meta = metaPath(fileId)
  if (existsSync(meta)) unlinkSync(meta)
  const thumb = thumbnailPath(fileId)
  if (existsSync(thumb)) unlinkSync(thumb)
  return deleted
}

/** 获取文件信息（大小、时间、元数据）。不存在返回 null。 */
export function getFileInfo(fileId: string): FileInfo | null {
  const path = filePath(fileId)
  if (!existsSync(path)) return null
  const stat = statSync(path)
  const info: FileInfo = {
    id: fileId,
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
  }
  const meta = metaPath(fileId)
  if (existsSync(meta)) {
    try {
      info.metadata = JSON.parse(readFileSync(meta, 'utf-8'))
    } catch {
      /* 元数据损坏时忽略 */
    }
  }
  return info
}

/** 列出上传目录下的文件（分页）。 */
export function listFiles(
  limit = 100,
  offset = 0,
): Array<{
  id: string
  size: number
  modifiedAt: string
}> {
  ensureDirs()
  const entries = readdirSync(UPLOADS_DIR)
    .filter((name) => !name.endsWith('.meta'))
    .map((name) => {
      const stat = statSync(join(UPLOADS_DIR, name))
      return { id: name, size: stat.size, modifiedAt: stat.mtime.toISOString() }
    })
    .slice(offset, offset + limit)
  return entries
}

/** 保存缩略图，返回存储路径。 */
export function saveThumbnail(fileId: string, thumbnail: Buffer): string {
  ensureDirs()
  const path = thumbnailPath(fileId)
  writeFileSync(path, thumbnail)
  return path
}

/** 读取缩略图。不存在返回 null。 */
export function getThumbnail(fileId: string): Buffer | null {
  const path = thumbnailPath(fileId)
  if (!existsSync(path)) return null
  return readFileSync(path)
}

/** 存储统计：文件数、总大小。 */
export function getStorageStats(): StorageStats {
  ensureDirs()
  let totalSize = 0
  let totalFiles = 0
  for (const name of readdirSync(UPLOADS_DIR)) {
    if (name.endsWith('.meta')) continue
    const stat = statSync(join(UPLOADS_DIR, name))
    totalSize += stat.size
    totalFiles++
  }
  return {
    totalFiles,
    totalSize,
    uploadsDir: resolve(UPLOADS_DIR),
    thumbnailsDir: resolve(THUMBNAILS_DIR),
    cacheDir: resolve(CACHE_DIR),
  }
}

/**
 * 获取签名 URL 所用密钥(复用 JWT_SECRET,无独立配置)。
 *
 * 2026-08-02 安全审计加固:
 * - 移除硬编码 'storage-secret' fallback(可预测 → 签名可伪造)
 * - JWT_SECRET 缺失时 fail-closed 抛错,禁止用弱默认值继续签发
 */
function getSigningSecret(): string {
  const secret = env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 未配置,无法签发/校验签名 URL(fail-closed)')
  }
  return secret
}

/**
 * 生成签名下载 URL。
 * 本地存储模式下生成带 HMAC-SHA256 签名的临时 URL（由路由层解析校验）。
 * OSS 模式下应调用对应驱动的 presigned URL 接口（预留）。
 *
 * 2026-08-02 安全审计加固:
 * - 用 HMAC-SHA256 替代 SHA256(payload+secret)(防长度扩展攻击)
 * - 密钥从环境变量读取,移除硬编码 fallback
 *
 * @param key 文件 ID 或对象 key
 * @param expiresIn 有效期（秒），默认 3600
 */
export function getSignedUrl(key: string, expiresIn = 3600): string {
  const secret = getSigningSecret()
  const expires = Math.floor(Date.now() / 1000) + expiresIn
  const payload = `${key}:${expires}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32)
  const params = new URLSearchParams({ key, expires: String(expires), sig: signature })
  return `/api/files/signed?${params.toString()}`
}

/**
 * 校验签名 URL（路由层调用）。
 *
 * 2026-08-02 安全审计加固:
 * - 用 timingSafeEqual 替代 ===(防 timing attack 逐字节猜测签名)
 * - 用 HMAC-SHA256 重算期望签名(与 getSignedUrl 对齐)
 */
export function verifySignedUrl(key: string, expires: number, sig: string): boolean {
  if (expires * 1000 < Date.now()) return false
  const secret = getSigningSecret()
  const payload = `${key}:${expires}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32)
  // 长度不一致直接返回 false(timingSafeEqual 要求同长度)
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(sig, 'utf8')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

// =============================================================================
// 缓存（文件级，带 TTL sidecar）
// =============================================================================

export function getCache(key: string): Buffer | null {
  const path = join(CACHE_DIR, key)
  if (!existsSync(path)) return null
  const ttlPath = `${path}.ttl`
  if (existsSync(ttlPath)) {
    const expiresAt = parseFloat(readFileSync(ttlPath, 'utf-8'))
    if (Date.now() / 1000 > expiresAt) return null
  }
  return readFileSync(path)
}

export function setCache(key: string, value: Buffer, ttlSeconds = 3600): void {
  ensureDirs()
  const path = join(CACHE_DIR, key)
  writeFileSync(path, value)
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
  writeFileSync(`${path}.ttl`, String(expiresAt))
}

/** 清理过期缓存，返回清理数量。 */
export function cleanupCache(): number {
  ensureDirs()
  let cleaned = 0
  const now = Date.now() / 1000
  for (const name of readdirSync(CACHE_DIR)) {
    if (!name.endsWith('.ttl')) continue
    const ttlPath = join(CACHE_DIR, name)
    const expiresAt = parseFloat(readFileSync(ttlPath, 'utf-8'))
    if (now > expiresAt) {
      const dataPath = join(CACHE_DIR, name.replace(/\.ttl$/, ''))
      if (existsSync(dataPath)) unlinkSync(dataPath)
      unlinkSync(ttlPath)
      cleaned++
    }
  }
  return cleaned
}

// =============================================================================
// OSS 直传能力(STS 签发 + 直传回调验签 + 分片上传协议)
// 迁移自 D3 OssServiceApplication,适配 TS + Fastify,零新增依赖
// - STS:使用 @alicloud/openapi-client(已安装)调 AssumeRole
// - 回调验签:Node crypto RSA-SHA1
// - 分片上传:Node fetch + OSS v1 HMAC-SHA1 签名直调 REST API
// =============================================================================

export interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  roleArn: string
  bucket: string
  region: string
  endpoint: string
  callbackUrl?: string
}

/** 读取 OSS 配置(环境变量)。缺失返回 null。 */
export function getOssConfig(): OssConfig | null {
  const accessKeyId = env.OSS_ACCESS_KEY_ID
  const accessKeySecret = env.OSS_ACCESS_KEY_SECRET
  const roleArn = env.OSS_ROLE_ARN
  const bucket = env.OSS_BUCKET
  const region = env.OSS_REGION ?? 'oss-cn-hangzhou'
  if (!accessKeyId || !accessKeySecret || !roleArn || !bucket) return null
  return {
    accessKeyId,
    accessKeySecret,
    roleArn,
    bucket,
    region,
    endpoint: env.OSS_ENDPOINT ?? `${region}.aliyuncs.com`,
    callbackUrl: env.OSS_CALLBACK_URL,
  }
}

export interface StsCredentialsResult {
  AccessKeyId: string
  AccessKeySecret: string
  SecurityToken: string
  Expiration: string
  bucket: string
  region: string
  endpoint: string
}

/**
 * 签发 STS 临时凭证(默认 15 分钟,仅 oss:PutObject 权限)。
 * 使用 @alicloud/openapi-client(已安装依赖)调用 STS AssumeRole。
 */
export async function issueStsCredentials(
  sessionName: string,
  durationSeconds = 900,
): Promise<StsCredentialsResult> {
  const config = getOssConfig()
  if (!config) {
    throw new Error('OSS 配置缺失(OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET/OSS_ROLE_ARN/OSS_BUCKET)')
  }

  // 动态 import @alicloud/openapi-client(类型声明见 src/types/optional-deps.d.ts)
  // 使用 as unknown as 强转绕过 optional-deps.d.ts 仅声明 Config 的限制
  const OpenApi = (await import('@alicloud/openapi-client')) as unknown as {
    default: new (config: unknown) => {
      callApi(
        params: unknown,
        request: unknown,
        runtime: unknown,
      ): Promise<{ body: Record<string, unknown> }>
    }
    Config: new (input: Record<string, unknown>) => unknown
    Params: new (input: Record<string, unknown>) => unknown
    OpenApiRequest: new (input: Record<string, unknown>) => unknown
  }

  // 最小权限策略:仅允许 oss:PutObject 到当前 bucket
  const policy = {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['oss:PutObject'],
        Resource: [`acs:oss:*:*:${config.bucket}/*`],
      },
    ],
  }

  const client = new OpenApi.default(
    new OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: 'sts.aliyuncs.com',
      protocol: 'HTTPS',
    }),
  )

  const params = new OpenApi.Params({
    action: 'AssumeRole',
    version: '2015-04-01',
    protocol: 'HTTPS',
    pathname: '/',
    method: 'POST',
    authType: 'AK',
    bodyType: 'json',
    reqBodyType: 'formData',
    style: 'RPC',
  })

  const request = new OpenApi.OpenApiRequest({
    query: {
      RoleArn: config.roleArn,
      RoleSessionName: sessionName.slice(0, 32) || 'ihui-upload',
      DurationSeconds: String(durationSeconds),
      Policy: JSON.stringify(policy),
    },
  })

  // runtime 传空对象,SDK 内部用 Util.defaultNumber/String 兜底默认值
  const response = await client.callApi(params, request, {})
  const creds = response.body?.Credentials as
    | {
        AccessKeyId: string
        AccessKeySecret: string
        SecurityToken: string
        Expiration: string
      }
    | undefined

  if (!creds) {
    throw new Error(`STS AssumeRole 失败: ${JSON.stringify(response.body)}`)
  }

  return {
    ...creds,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
  }
}

// =============================================================================
// 直传回调验签(RSA-SHA1)
// 阿里云 OSS 回调签名算法:RSA-SHA1,公钥 URL 在 x-oss-pub-key-url header(base64)
// =============================================================================

const pubKeyCache = new Map<
  string,
  { key: ReturnType<typeof createPublicKey>; fetchedAt: number }
>()
const PUB_KEY_TTL_MS = 60 * 60 * 1000 // 1 小时

/** 验证 OSS 直传回调签名(RSA-SHA1)。验证通过返回 true。 */
export async function verifyOssCallback(params: {
  method: string
  path: string
  query: string
  body: string
  authorization: string
  pubKeyUrlB64: string
}): Promise<boolean> {
  const { method, path, query, body, authorization, pubKeyUrlB64 } = params

  // 1. 解码公钥 URL(base64)
  let pubKeyUrl: string
  try {
    pubKeyUrl = Buffer.from(pubKeyUrlB64, 'base64').toString('utf-8')
  } catch {
    return false
  }

  // 2. 域名白名单校验(防止 SSRF)
  //    阿里云公钥分发域:gosspublic.alicdn.com / *.aliyuncs.com
  const allowedDomains = ['https://gosspublic.alicdn.com/', 'https://oss-document.aliyuncs.com/']
  const isAllowed =
    allowedDomains.some((d) => pubKeyUrl.startsWith(d)) ||
    /\.alicdn\.com\//.test(pubKeyUrl) ||
    /\.aliyuncs\.com\//.test(pubKeyUrl)
  if (!isAllowed) return false

  // 3. 获取公钥(带 1 小时缓存)
  let cached = pubKeyCache.get(pubKeyUrl)
  if (!cached || Date.now() - cached.fetchedAt > PUB_KEY_TTL_MS) {
    try {
      const resp = await fetch(pubKeyUrl)
      if (!resp.ok) return false
      const pem = await resp.text()
      cached = {
        key: createPublicKey(pem),
        fetchedAt: Date.now(),
      }
      pubKeyCache.set(pubKeyUrl, cached)
    } catch {
      return false
    }
  }

  // 4. 构造签名串:method + "\n" + pathAndQuery + "\n" + body
  //    OSS 回调签名标准:path(含 query) + "\n" + body
  const pathAndQuery = query ? `${path}?${query}` : path
  const signedString = `${method}\n${pathAndQuery}\n${body}`

  // 5. 解码签名(base64)
  let signature: Buffer
  try {
    signature = Buffer.from(authorization, 'base64')
  } catch {
    return false
  }

  // 6. RSA-SHA1 验签
  const verifier = createVerify('RSA-SHA1')
  verifier.update(signedString)
  return verifier.verify(cached.key, signature)
}

// =============================================================================
// OSS v1 签名 + REST API 调用(用于分片上传)
// OSS v1 签名:HMAC-SHA1,与 STS 的 RPC 签名不同
// =============================================================================

interface OssCallOptions {
  queryParams?: Record<string, string>
  headers?: Record<string, string>
  body?: Buffer
  contentType?: string
}

interface OssCallResult {
  status: number
  headers: Record<string, string>
  body: string
}

/** OSS v1 HMAC-SHA1 签名并发起 HTTP 请求。 */
async function callOss(
  method: string,
  key: string,
  options: OssCallOptions = {},
): Promise<OssCallResult> {
  const config = getOssConfig()
  if (!config) throw new Error('OSS 配置缺失')

  const queryParams = options.queryParams ?? {}
  const resource = `/${config.bucket}/${key}`

  // 构造 URL
  const url = `https://${config.bucket}.${config.endpoint}/${key}`
  const queryString = new URLSearchParams(queryParams).toString()
  const fullUrl = queryString ? `${url}?${queryString}` : url

  // CanonicalizedResource(含子资源)
  const SUB_RESOURCES = new Set([
    'acl',
    'uploads',
    'location',
    'cors',
    'logging',
    'website',
    'referer',
    'lifecycle',
    'delete',
    'uploadId',
    'partNumber',
    'security-token',
  ])
  const subResEntries = Object.entries(queryParams)
    .filter(([k]) => SUB_RESOURCES.has(k) || k.startsWith('x-oss-'))
    .sort(([a], [b]) => a.localeCompare(b))
  const canonicalizedResource =
    subResEntries.length > 0
      ? `${resource}?${subResEntries.map(([k, v]) => `${k}=${v}`).join('&')}`
      : resource

  // 构造 headers
  const date = new Date().toUTCString()
  const headers: Record<string, string> = {
    Date: date,
    ...options.headers,
  }

  // Content-MD5
  let contentMd5 = ''
  if (options.body) {
    contentMd5 = createHash('md5').update(options.body).digest('base64')
    headers['Content-MD5'] = contentMd5
  }
  if (options.contentType) {
    headers['Content-Type'] = options.contentType
  }

  // CanonicalizedOSSHeaders(x-oss-* 排序)
  const ossHeaderLines = Object.entries(headers)
    .filter(([k]) => k.toLowerCase().startsWith('x-oss-'))
    .map(([k, v]) => `${k.toLowerCase()}:${v}`)
    .sort()
  const canonicalizedOSSHeaders = ossHeaderLines.length > 0 ? ossHeaderLines.join('\n') + '\n' : ''

  // StringToSign
  const stringToSign = `${method.toUpperCase()}\n${contentMd5}\n${options.contentType ?? ''}\n${date}\n${canonicalizedOSSHeaders}${canonicalizedResource}`

  // 签名
  const signature = createHmac('sha1', config.accessKeySecret).update(stringToSign).digest('base64')
  headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`

  // 发起请求
  const resp = await fetch(fullUrl, {
    method,
    headers,
    body: options.body,
  })

  const respHeaders: Record<string, string> = {}
  resp.headers.forEach((v, k) => {
    respHeaders[k] = v
  })
  const respBody = await resp.text()

  if (resp.status >= 400) {
    throw new Error(`OSS ${method} ${key} 失败: ${resp.status} ${respBody}`)
  }

  return { status: resp.status, headers: respHeaders, body: respBody }
}

// =============================================================================
// 分片上传会话管理(内存 Map + TTL 清理)
// UploadId(UUID v4) 为客户端可见的会话 ID,内部映射到 OSS 的 UploadId
// =============================================================================

interface MultipartSession {
  sessionId: string // UUID v4,返回给客户端作为 uploadId
  ossUploadId: string // OSS 的 UploadId
  key: string // 对象 key
  bucket: string
  userId: string // 所有者(用于鉴权)
  createdAt: number
}

const multipartSessions = new Map<string, MultipartSession>()
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 小时

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of multipartSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      multipartSessions.delete(id)
    }
  }
}

// =============================================================================
// 分片上传操作
// =============================================================================

export interface MultipartInitResult {
  uploadId: string // 我们的 sessionId(UUID v4)
  key: string
  ossUploadId: string
  bucket: string
}

/** 初始化分片上传:调 OSS InitiateMultipartUpload,返回 sessionId。 */
export async function initiateMultipartUpload(
  userId: string,
  opts: { filename: string; contentType?: string },
): Promise<MultipartInitResult> {
  cleanupExpiredSessions()

  const config = getOssConfig()
  if (!config) throw new Error('OSS 配置缺失')

  // 生成对象 key:uploads/<userId>/<date>/<uuid>/<filename>
  const dateStr = new Date().toISOString().slice(0, 10)
  const uuid = randomUUID()
  const safeFilename = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `uploads/${userId}/${dateStr}/${uuid}/${safeFilename}`

  const headers: Record<string, string> = {}
  if (opts.contentType) {
    headers['Content-Type'] = opts.contentType
  }

  const result = await callOss('POST', key, {
    queryParams: { uploads: '' },
    headers,
    contentType: opts.contentType,
  })

  // 解析 XML 响应获取 UploadId
  const uploadIdMatch = result.body.match(/<UploadId>([^<]+)<\/UploadId>/)
  const ossUploadId = uploadIdMatch?.[1]
  if (!ossUploadId) {
    throw new Error(`OSS InitiateMultipartUpload 响应无 UploadId: ${result.body}`)
  }

  // 生成 sessionId(UUID v4)并存储映射
  const sessionId = randomUUID()
  multipartSessions.set(sessionId, {
    sessionId,
    ossUploadId,
    key,
    bucket: config.bucket,
    userId,
    createdAt: Date.now(),
  })

  return { uploadId: sessionId, key, ossUploadId, bucket: config.bucket }
}

export interface MultipartUploadResult {
  etag: string
  partNumber: number
}

/** 上传分片:调 OSS UploadPart,返回 ETag。 */
export async function uploadMultipartPart(
  sessionId: string,
  partNumber: number,
  data: Buffer,
  userId: string,
): Promise<MultipartUploadResult> {
  const session = multipartSessions.get(sessionId)
  if (!session) throw new Error('分片上传会话不存在或已过期')
  if (session.userId !== userId) throw new Error('无权操作此分片上传会话')

  if (partNumber < 1 || partNumber > 10000) {
    throw new Error('partNumber 必须在 1-10000 之间')
  }

  const result = await callOss('PUT', session.key, {
    queryParams: {
      partNumber: String(partNumber),
      uploadId: session.ossUploadId,
    },
    body: data,
    contentType: 'application/octet-stream',
  })

  const etag = result.headers['etag'] ?? result.headers['ETag']
  if (!etag) {
    throw new Error(`OSS UploadPart 响应无 ETag: ${result.status}`)
  }

  return { etag: etag.replace(/"/g, ''), partNumber }
}

export interface MultipartCompleteResult {
  url: string
  key: string
  bucket: string
  location: string
}

/** 完成分片上传:调 OSS CompleteMultipartUpload,返回最终 URL。 */
export async function completeMultipartUpload(
  sessionId: string,
  parts: Array<{ partNumber: number; etag: string }>,
  userId: string,
): Promise<MultipartCompleteResult> {
  const session = multipartSessions.get(sessionId)
  if (!session) throw new Error('分片上传会话不存在或已过期')
  if (session.userId !== userId) throw new Error('无权操作此分片上传会话')

  // 构造 CompleteMultipartUpload XML body
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber)
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>${sortedParts
    .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag></Part>`)
    .join('')}</CompleteMultipartUpload>`

  const result = await callOss('POST', session.key, {
    queryParams: { uploadId: session.ossUploadId },
    body: Buffer.from(xmlBody),
    contentType: 'application/xml',
  })

  // 解析 XML 获取 Location
  const locationMatch = result.body.match(/<Location>([^<]+)<\/Location>/)
  const location = locationMatch?.[1] ?? ''

  const config = getOssConfig()
  const url = `https://${session.bucket}.${config?.endpoint ?? ''}/${session.key}`

  // 清理会话
  multipartSessions.delete(sessionId)

  return {
    url,
    key: session.key,
    bucket: session.bucket,
    location,
  }
}

/** 取消分片上传:调 OSS AbortMultipartUpload,清理会话。 */
export async function abortMultipartUpload(sessionId: string, userId: string): Promise<void> {
  const session = multipartSessions.get(sessionId)
  if (!session) throw new Error('分片上传会话不存在或已过期')
  if (session.userId !== userId) throw new Error('无权操作此分片上传会话')

  await callOss('DELETE', session.key, {
    queryParams: { uploadId: session.ossUploadId },
  })

  multipartSessions.delete(sessionId)
}
