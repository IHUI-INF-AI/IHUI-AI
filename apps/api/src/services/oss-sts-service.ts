// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OSS STS Provider 抽象(strategy pattern)。
 * 支持阿里云 OSS / 腾讯云 COS / AWS S3 三种 provider,通过 OSS_PROVIDER env 切换。
 * 迁移自 D3 OssServiceApplication(Java) → TS + 纯 HTTP 调用 + 手工签名。
 * - aliyun:复用 storage-service.ts 的 issueStsCredentials(@alicloud/openapi-client)
 * - tencent:纯 HTTP 调用 sts.tencentcloudapi.com,TC3-HMAC-SHA256 签名
 * - aws:纯 HTTP 调用 sts.<region>.amazonaws.com,AWS Signature V4 签名
 *
 * 设计目标:零新增依赖、最小化代码、provider 切换对外透明。
 */

import { createHmac, createHash, randomBytes } from 'node:crypto'
import { env } from 'node:process'
import { getOssConfig } from './storage-service.js'

export type OssProviderType = 'aliyun' | 'tencent' | 'aws'

/** 统一的 STS 凭证返回结构(客户端直传用)。 */
export interface StsCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  bucket: string
  region: string
  /** 服务端生成的 objectKey,格式 `uploads/${userId}/${Date.now()}-${random}.${ext}` */
  objectKey: string
}

export interface OssStsProvider {
  readonly type: OssProviderType
  /** 签发 STS 临时凭证。 */
  assumeRole(sessionName: string, durationSeconds: number, ctx: StsContext): Promise<StsCredentials>
}

export interface StsContext {
  userId: string
  ext: string
  /**
   * 服务端拼好的 objectKey(routes/oss.ts 生成)。
   * provider 只负责回传,绝不接受客户端传入的 key —— 否则策略收敛到本人目录也白搭。
   */
  objectKey: string
}

// =============================================================================
// objectKey / 策略构造(F-70:纯函数,供回归测试直接断言,不触网)
// =============================================================================

/** 直传落点前缀,与 storage-service 分片上传的 `uploads/<userId>/...` 对齐。 */
export const OSS_UPLOAD_PREFIX = 'uploads'

/** 直传单对象大小上限 50MB(与 routes/oss.ts 的 createUploadPreHandler maxSize 同口径)。 */
export const OSS_MAX_OBJECT_BYTES = 50 * 1024 * 1024

/** 清洗用户目录段:只留字母数字/_/-,防止 `../`、`/` 撑开策略作用域。 */
export function safeUserSegment(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anonymous'
}

/** 策略收敛后的用户目录:`uploads/<userId>`(不含通配符)。 */
export function ossUserPrefix(userId: string): string {
  return `${OSS_UPLOAD_PREFIX}/${safeUserSegment(userId)}`
}

/** 生成 objectKey:`uploads/${userId}/${Date.now()}-${random8}.${ext}` */
export function generateObjectKey(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
  // 2026-08-02 P2 安全加固：用 CSPRNG 替换 Math.random，防止攻击者枚举他人文件路径
  const random = randomBytes(8).toString('hex')
  return `${ossUserPrefix(userId)}/${Date.now()}-${random}.${safeExt}`
}

/** 服务端固定的 RoleSessionName:忽略客户端传值,避免拿他人目录名去申请凭证。 */
export function buildSessionName(userId: string): string {
  return `ihui-${safeUserSegment(userId).slice(-8)}`
}

/** 腾讯云 CAM 策略(version 2.0)。 */
export interface TencentStsPolicy {
  version: string
  statement: Array<{
    effect: 'allow'
    action: string[]
    resource: string[]
    condition?: Record<string, Record<string, number>>
  }>
}

/**
 * 腾讯策略:仅本人目录,且 content-length ≤ 50MB。
 * CAM 的数值条件键按 `numeric_less_than_equal` 书写(等价 S3 的 content-length-range)。
 */
export function buildTencentStsPolicy(
  region: string,
  bucket: string,
  userId: string,
): TencentStsPolicy {
  return {
    version: '2.0',
    statement: [
      {
        effect: 'allow',
        action: ['name/cos:PutObject'],
        resource: [`qcs::cos:${region}:::${bucket}/${ossUserPrefix(userId)}/*`],
        condition: { numeric_less_than_equal: { 'cos:content-length': OSS_MAX_OBJECT_BYTES } },
      },
    ],
  }
}

/** 阿里云 RAM 策略(V1)。 */
export interface AliyunStsPolicy {
  Version: string
  Statement: Array<{
    Effect: 'Allow'
    Action: string[]
    Resource: string[]
    Condition: { NumericLessThanEquals: Record<string, number> }
  }>
}

/** 阿里策略:仅本人目录,且 ContentLength ≤ 50MB。 */
export function buildAliyunStsPolicy(bucket: string, userId: string): AliyunStsPolicy {
  return {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['oss:PutObject'],
        Resource: [`acs:oss:*:*:${bucket}/${ossUserPrefix(userId)}/*`],
        Condition: { NumericLessThanEquals: { 'oss:ContentLength': OSS_MAX_OBJECT_BYTES } },
      },
    ],
  }
}

/** AWS 会话策略(IAM Policy,交给 STS AssumeRole 的 Policy 参数)。 */
export interface AwsStsPolicy {
  Version: string
  Statement: Array<{ Effect: 'Allow'; Action: string[]; Resource: string[] }>
}

/** AWS 策略:只允许本人目录 PutObject / AbortMultipartUpload,不继承角色默认权限。 */
export function buildAwsStsPolicy(bucket: string, userId: string): AwsStsPolicy {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:PutObject', 's3:AbortMultipartUpload'],
        Resource: [`arn:aws:s3:::${bucket}/${ossUserPrefix(userId)}/*`],
      },
    ],
  }
}

// =============================================================================
// 工具:SHA256 / HMAC-SHA256(返回 hex)
// =============================================================================

function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

function hmacHex(key: string | Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex')
}

// =============================================================================
// Aliyun OSS Provider — @alicloud/openapi-client 直调 AssumeRole(策略见 buildAliyunStsPolicy)
// =============================================================================

class AliyunOssProvider implements OssStsProvider {
  readonly type = 'aliyun' as const

  async assumeRole(
    sessionName: string,
    durationSeconds: number,
    ctx: StsContext,
  ): Promise<StsCredentials> {
    const config = getOssConfig()
    if (!config) {
      throw new Error(
        'OSS 配置缺失(OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET/OSS_ROLE_ARN/OSS_BUCKET)',
      )
    }

    // F-70:storage-service.issueStsCredentials 的策略是整桶 `bucket/*` 且无大小条件,
    // 直传凭证必须收敛到本人目录 —— 故在此用同一 SDK 自建策略,不动 storage-service 的签名面。
    // 动态 import @alicloud/openapi-client(类型声明见 src/types/optional-deps.d.ts)
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
        Policy: JSON.stringify(buildAliyunStsPolicy(config.bucket, ctx.userId)),
      },
    })

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
      // 失败体不是凭据,但也别整体透传:只回传 Code / RequestId(与 storage-service 同口径)
      const err = response.body as { Code?: unknown; RequestId?: unknown } | undefined
      const code = typeof err?.Code === 'string' ? err.Code : 'no_code'
      const reqId = typeof err?.RequestId === 'string' ? ` req=${err.RequestId}` : ''
      throw new Error(`STS AssumeRole 失败: ${code}${reqId}`)
    }

    return {
      accessKeyId: creds.AccessKeyId,
      accessKeySecret: creds.AccessKeySecret,
      securityToken: creds.SecurityToken,
      expiration: creds.Expiration,
      bucket: config.bucket,
      region: config.region,
      objectKey: ctx.objectKey,
    }
  }
}

// =============================================================================
// Tencent COS STS Provider — 纯 HTTP + TC3-HMAC-SHA256 签名
// 文档:https://cloud.tencent.com/document/api/1312/48195
// =============================================================================

interface TencentStsResponse {
  Response?: {
    Credentials?: {
      TmpSecretId: string
      TmpSecretKey: string
      Token: string
    }
    ExpiredTime?: number
    Expiration?: string
    RequestId?: string
    Error?: { Code: string; Message: string }
  }
}

class TencentCosProvider implements OssStsProvider {
  readonly type = 'tencent' as const

  async assumeRole(
    sessionName: string,
    durationSeconds: number,
    ctx: StsContext,
  ): Promise<StsCredentials> {
    const secretId = env.TENCENT_SECRET_ID ?? env.OSS_ACCESS_KEY_ID
    const secretKey = env.TENCENT_SECRET_KEY ?? env.OSS_ACCESS_KEY_SECRET
    const region = env.TENCENT_REGION ?? env.OSS_REGION ?? 'ap-guangzhou'
    const bucket = env.TENCENT_BUCKET ?? env.OSS_BUCKET
    const roleArn = env.TENCENT_ROLE_ARN ?? env.OSS_STS_ROLE_ARN
    if (!secretId || !secretKey || !bucket || !roleArn) {
      throw new Error(
        '腾讯云 COS 配置缺失(TENCENT_SECRET_ID/TENCENT_SECRET_KEY/TENCENT_BUCKET/TENCENT_ROLE_ARN)',
      )
    }

    // F-70:最小权限策略落点收敛到本人目录 + 单对象 ≤50MB(见 buildTencentStsPolicy)
    const policy = buildTencentStsPolicy(region, bucket, ctx.userId)

    const body = JSON.stringify({
      RoleArn: roleArn,
      RoleSessionName: sessionName.slice(0, 32) || 'ihui-upload',
      DurationSeconds: durationSeconds,
      Policy: JSON.stringify(policy),
    })

    const host = 'sts.tencentcloudapi.com'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const service = 'sts'

    // TC3-HMAC-SHA256 签名流程
    const payloadHash = sha256Hex(body)
    const canonicalHeaders = `content-type:application/json\nhost:${host}\n`
    const signedHeaders = 'content-type;host'
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    const credentialScope = `${date}/${service}/tc3_request`
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`
    const secretDate = hmacHex(`TC3${secretKey}`, date)
    const secretService = hmacHex(secretDate, service)
    const secretSigning = hmacHex(secretService, 'tc3_request')
    const signature = hmacHex(secretSigning, stringToSign)
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const resp = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: host,
        'X-TC-Action': 'AssumeRole',
        'X-TC-Version': '2018-08-13',
        'X-TC-Region': region,
        'X-TC-Timestamp': String(timestamp),
        Authorization: authorization,
      },
      body,
      // F-547:STS 端点抖动不得让 /api/oss/sts 无限挂起。
      signal: AbortSignal.timeout(10_000),
    })

    // F-547:先判 HTTP 状态再解析,边缘错误页(HTML)不再被归一成「未知失败」。
    if (!resp.ok) {
      const errText = (await resp.text()).slice(0, 1024)
      throw new Error(`腾讯云 STS AssumeRole 失败: HTTP ${resp.status} ${errText}`)
    }

    const result = (await resp.json()) as TencentStsResponse
    const creds = result.Response?.Credentials
    if (!creds) {
      // 成功体含 TmpSecretKey / Token,兜底整体透传等于把临时凭据送进错误消息(非 2xx 不经打码)。
      // 只回传 Error.Code 与 RequestId —— 与同文件 AWS STS 分支同口径。
      const code = result.Response?.Error?.Code ?? 'no_error_code'
      const reqId = result.Response?.RequestId
      throw new Error(`腾讯云 STS AssumeRole 失败: ${code}${reqId ? ` req=${reqId}` : ''}`)
    }

    const expiration =
      result.Response?.Expiration ??
      (result.Response?.ExpiredTime
        ? new Date(result.Response.ExpiredTime * 1000).toISOString()
        : new Date(Date.now() + durationSeconds * 1000).toISOString())

    return {
      accessKeyId: creds.TmpSecretId,
      accessKeySecret: creds.TmpSecretKey,
      securityToken: creds.Token,
      expiration,
      bucket,
      region,
      objectKey: ctx.objectKey,
    }
  }
}

// =============================================================================
// AWS S3 STS Provider — 纯 HTTP + AWS Signature V4 签名
// 文档:https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
// =============================================================================

interface AwsStsXmlResult {
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  expiration?: string
  error?: string
}

function parseAwsStsXml(xml: string): AwsStsXmlResult {
  const accessKeyId = xml.match(/<AccessKeyId>([^<]+)<\/AccessKeyId>/)?.[1]
  const secretAccessKey = xml.match(/<SecretAccessKey>([^<]+)<\/SecretAccessKey>/)?.[1]
  const sessionToken = xml.match(/<SessionToken>([^<]+)<\/SessionToken>/)?.[1]
  const expiration = xml.match(/<Expiration>([^<]+)<\/Expiration>/)?.[1]
  const errorCode = xml.match(/<Code>([^<]+)<\/Code>/)?.[1]
  const errorMessage = xml.match(/<Message>([^<]+)<\/Message>/)?.[1]
  if (!accessKeyId) {
    return { error: `${errorCode ?? 'Unknown'}: ${errorMessage ?? xml.slice(0, 200)}` }
  }
  return { accessKeyId, secretAccessKey, sessionToken, expiration }
}

class AwsS3Provider implements OssStsProvider {
  readonly type = 'aws' as const

  async assumeRole(
    sessionName: string,
    durationSeconds: number,
    ctx: StsContext,
  ): Promise<StsCredentials> {
    const accessKeyId = env.AWS_ACCESS_KEY_ID ?? env.OSS_ACCESS_KEY_ID
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY ?? env.OSS_ACCESS_KEY_SECRET
    const region = env.AWS_REGION ?? env.OSS_REGION ?? 'us-east-1'
    const bucket = env.AWS_BUCKET ?? env.OSS_BUCKET
    const roleArn = env.AWS_ROLE_ARN ?? env.OSS_STS_ROLE_ARN
    if (!accessKeyId || !secretAccessKey || !bucket || !roleArn) {
      throw new Error(
        'AWS S3 配置缺失(AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_BUCKET/AWS_ROLE_ARN)',
      )
    }

    const body = new URLSearchParams({
      Action: 'AssumeRole',
      Version: '2011-06-15',
      RoleArn: roleArn,
      RoleSessionName: sessionName.slice(0, 32) || 'ihui-upload',
      DurationSeconds: String(durationSeconds),
      // F-70:补最小会话策略,避免继承角色默认权限(整桶可写)
      Policy: JSON.stringify(buildAwsStsPolicy(bucket, ctx.userId)),
    }).toString()

    const host = `sts.${region}.amazonaws.com`
    // AWS ISO 8601 时间戳:YYYYMMDDTHHMMSSZ
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
    const date = timestamp.slice(0, 8)
    const service = 'sts'

    // AWS Signature V4 签名流程
    const payloadHash = sha256Hex(body)
    const canonicalHeaders = `host:${host}\nx-amz-date:${timestamp}\n`
    const signedHeaders = 'host;x-amz-date'
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    const credentialScope = `${date}/${region}/${service}/aws4_request`
    const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`
    const kDate = hmacHex(`AWS4${secretAccessKey}`, date)
    const kRegion = hmacHex(kDate, region)
    const kService = hmacHex(kRegion, service)
    const kSigning = hmacHex(kService, 'aws4_request')
    const signature = hmacHex(kSigning, stringToSign)
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const resp = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: host,
        'X-Amz-Date': timestamp,
        Authorization: authorization,
      },
      body,
      // F-547:同腾讯分支,10s 硬超时。
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      const errText = (await resp.text()).slice(0, 1024)
      throw new Error(`AWS STS AssumeRole 失败: HTTP ${resp.status} ${errText}`)
    }

    const text = (await resp.text()).slice(0, 64 * 1024)
    const parsed = parseAwsStsXml(text)
    if (parsed.error || !parsed.accessKeyId || !parsed.secretAccessKey) {
      throw new Error(`AWS STS AssumeRole 失败: ${parsed.error ?? '响应缺少凭证'}`)
    }

    return {
      accessKeyId: parsed.accessKeyId,
      accessKeySecret: parsed.secretAccessKey,
      securityToken: parsed.sessionToken ?? '',
      expiration: parsed.expiration ?? new Date(Date.now() + durationSeconds * 1000).toISOString(),
      bucket,
      region,
      objectKey: ctx.objectKey,
    }
  }
}

// =============================================================================
// Provider 工厂
// =============================================================================

let cachedProvider: OssStsProvider | null = null

/** 根据 OSS_PROVIDER env 返回 STS provider 实例(单例,默认 aliyun)。 */
export function getOssStsProvider(): OssStsProvider {
  if (cachedProvider) return cachedProvider
  const raw = (env.OSS_PROVIDER ?? 'aliyun').toLowerCase().trim()
  switch (raw) {
    case 'tencent':
    case 'tencent-cos':
    case 'cos':
      cachedProvider = new TencentCosProvider()
      break
    case 'aws':
    case 's3':
      cachedProvider = new AwsS3Provider()
      break
    case 'aliyun':
    case 'aliyun-oss':
    case '':
    default:
      cachedProvider = new AliyunOssProvider()
      break
  }
  return cachedProvider
}

/** 暴露当前 provider 类型(供路由 / health 检查使用)。 */
export function getOssProviderType(): OssProviderType {
  return getOssStsProvider().type
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
