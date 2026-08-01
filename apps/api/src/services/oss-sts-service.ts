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
import { issueStsCredentials } from './storage-service.js'

export type OssProviderType = 'aliyun' | 'tencent' | 'aws'

/** 统一的 STS 凭证返回结构(客户端直传用)。 */
export interface StsCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  bucket: string
  region: string
  /** 推荐的 objectKey,格式 `${userId}/${Date.now()}-${random}.${ext}` */
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
}

// =============================================================================
// objectKey 生成
// =============================================================================

/** 生成 objectKey:${userId}/${Date.now()}-${random8}.${ext} */
export function generateObjectKey(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anonymous'
  // 2026-08-02 P2 安全加固：用 CSPRNG 替换 Math.random，防止攻击者枚举他人文件路径
  const random = randomBytes(8).toString('hex')
  return `${safeUser}/${Date.now()}-${random}.${safeExt}`
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
// Aliyun OSS Provider — 委托给 storage-service.ts(已用 @alicloud/openapi-client)
// =============================================================================

class AliyunOssProvider implements OssStsProvider {
  readonly type = 'aliyun' as const

  async assumeRole(
    sessionName: string,
    durationSeconds: number,
    ctx: StsContext,
  ): Promise<StsCredentials> {
    const result = await issueStsCredentials(sessionName, durationSeconds)
    return {
      accessKeyId: result.AccessKeyId,
      accessKeySecret: result.AccessKeySecret,
      securityToken: result.SecurityToken,
      expiration: result.Expiration,
      bucket: result.bucket,
      region: result.region,
      objectKey: generateObjectKey(ctx.userId, ctx.ext),
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

    // 最小权限策略:仅允许 cos:PutObject
    const policy = {
      version: '2.0',
      statement: [
        {
          effect: 'allow',
          action: ['name/cos:PutObject'],
          resource: [`qcs::cos:${region}:::${bucket}/*`],
        },
      ],
    }

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
    })

    const result = (await resp.json()) as TencentStsResponse
    const creds = result.Response?.Credentials
    if (!creds) {
      const errMsg = result.Response?.Error?.Message ?? JSON.stringify(result)
      throw new Error(`腾讯云 STS AssumeRole 失败: ${errMsg}`)
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
      objectKey: generateObjectKey(ctx.userId, ctx.ext),
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
    })

    const text = await resp.text()
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
      objectKey: generateObjectKey(ctx.userId, ctx.ext),
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
