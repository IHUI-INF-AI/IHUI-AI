/**
 * 国安级 mTLS(双向证书认证)Fastify 插件。
 *
 * 核心能力:
 * - preHandler 阶段验证客户端证书(证书链授权 / 有效期 / CN 白名单 / 吊销检查)
 * - 路由级配置:routeOptions.config.mtls = { required, cnAllowList }
 * - 降级模式:MTLS_CLIENT_CERT_REQUIRED=false 时有证书则验证,无则 warning 跳过
 * - 强制模式:MTLS_CLIENT_CERT_REQUIRED=true(或路由 required=true)时无证书 → 401
 * - 客户端身份注入:request.mtlsClient = { cn, fingerprint, issuer, validFrom, validTo }
 * - CRL 吊销检查:提供 setRevocationChecker hook,未注册时跳过(简化实现)
 *
 * 证书路径从环境变量读取(与 config/index.ts 解耦,缺失时降级运行,仅 warning):
 * - MTLS_CA_CERT_PATH:信任的 CA 证书路径
 * - MTLS_SERVER_CERT_PATH:服务端证书路径
 * - MTLS_SERVER_KEY_PATH:服务端私钥路径
 * - MTLS_CLIENT_CERT_REQUIRED:'true'/'false'(是否强制要求客户端证书)
 * - MTLS_CRL_PATH:证书吊销列表路径(可选,简化实现仅提供 hook)
 */
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify'
import type { PeerCertificate } from 'node:tls'
import { TLSSocket } from 'node:tls'
import fp from 'fastify-plugin'
import { logger } from '../utils/logger.js'
import { error } from '../utils/response.js'

export interface MtlsClientIdentity {
  /** 证书 Common Name(客户端身份标识) */
  cn: string
  /** SHA-256 指纹(hex,无冒号) */
  fingerprint: string
  /** 颁发者 CN 或 O */
  issuer: string
  /** 有效期起始(原始字符串) */
  validFrom: string
  /** 有效期截止(原始字符串) */
  validTo: string
}

export interface MtlsRouteConfig {
  /** 是否强制要求客户端证书(默认从 MTLS_CLIENT_CERT_REQUIRED 读取) */
  required?: boolean
  /** 允许的 CN 白名单(为空/未指定则不检查 CN) */
  cnAllowList?: string[]
}

/** 证书吊销检查器类型(CRL / OCSP),返回 false 表示证书已吊销 */
type RevocationChecker = (cert: PeerCertificate) => Promise<boolean>

interface MtlsEnvConfig {
  caCertPath: string
  serverCertPath: string
  serverKeyPath: string
  clientCertRequired: boolean
  crlPath: string
}

function readMtlsEnvConfig(): MtlsEnvConfig {
  return {
    caCertPath: process.env.MTLS_CA_CERT_PATH ?? '',
    serverCertPath: process.env.MTLS_SERVER_CERT_PATH ?? '',
    serverKeyPath: process.env.MTLS_SERVER_KEY_PATH ?? '',
    clientCertRequired: process.env.MTLS_CLIENT_CERT_REQUIRED === 'true',
    crlPath: process.env.MTLS_CRL_PATH ?? '',
  }
}

declare module 'fastify' {
  interface FastifyContextConfig {
    mtls?: MtlsRouteConfig
  }
  interface FastifyRequest {
    /** mTLS 客户端身份(由 preHandler 注入,下游路由可直接读取) */
    mtlsClient?: MtlsClientIdentity
  }
  interface FastifyInstance {
    mtls: {
      /** 注册证书吊销检查器(CRL / OCSP)。未注册时跳过吊销检查。 */
      setRevocationChecker(checker: RevocationChecker): void
      /** 获取当前已注册的吊销检查器 */
      getRevocationChecker(): RevocationChecker | null
    }
  }
}

/**
 * 从 TLS socket 提取客户端证书。
 * getPeerCertificate() 在无证书提交时返回空对象 {},检查 subject 字段判断有效性。
 */
function extractPeerCertificate(request: FastifyRequest): PeerCertificate | undefined {
  const socket = request.raw.socket
  if (!(socket instanceof TLSSocket)) return undefined
  const cert = socket.getPeerCertificate()
  // getPeerCertificate() 返回空对象 {} 当无证书提交(非 rejectUnauthorized 模式)
  if (!cert || !cert.subject) return undefined
  return cert
}

/**
 * 将 Certificate 字段值(string | string[])安全转换为 string。
 * tls.Certificate 继承 NodeJS.Dict<string | string[]>,CN/O 等字段可能是数组。
 */
function asString(val: string | string[] | undefined): string {
  if (val === undefined) return ''
  if (Array.isArray(val)) return val[0] ?? ''
  return val
}

/**
 * 从 PeerCertificate 构建客户端身份信息。
 */
function buildClientIdentity(cert: PeerCertificate): MtlsClientIdentity {
  const cn = asString(cert.subject.CN)
  const fingerprint = (cert.fingerprint256 ?? '').replace(/:/g, '').toLowerCase()
  const issuerCn = asString(cert.issuer.CN) || asString(cert.issuer.O)
  return {
    cn,
    fingerprint,
    issuer: issuerCn,
    validFrom: cert.valid_from,
    validTo: cert.valid_to,
  }
}

/**
 * 校验证书有效期(notBefore / notAfter)。
 */
function isCertWithinValidity(cert: PeerCertificate): boolean {
  const now = Date.now()
  const notBefore = Date.parse(cert.valid_from)
  const notAfter = Date.parse(cert.valid_to)
  if (isNaN(notBefore) || isNaN(notAfter)) return false
  return now >= notBefore && now <= notAfter
}

const mtlsPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const envConfig = readMtlsEnvConfig()

  // 启动时检查证书路径配置(降级模式:缺失不阻塞启动,仅 warning)
  if (!envConfig.caCertPath) {
    logger.warn('MTLS_CA_CERT_PATH not configured, mTLS plugin runs in degraded mode')
  }
  if (!envConfig.serverCertPath || !envConfig.serverKeyPath) {
    logger.warn(
      'MTLS_SERVER_CERT_PATH/MTLS_SERVER_KEY_PATH not configured, mTLS plugin runs in degraded mode',
    )
  }

  // CRL 吊销检查 hook(简化实现:运行期默认跳过,提供 setRevocationChecker 扩展点)
  let revocationChecker: RevocationChecker | null = null

  server.decorate('mtls', {
    setRevocationChecker(checker: RevocationChecker): void {
      revocationChecker = checker
      logger.info('mTLS revocation checker registered')
    },
    getRevocationChecker(): RevocationChecker | null {
      return revocationChecker
    },
  })

  // preHandler:客户端证书验证(仅对配置了 mtls 的路由生效)
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const routeConfig = request.routeOptions.config
    const mtlsConfig = routeConfig?.mtls
    if (!mtlsConfig) return // 未配置 mtls 的路由不验证(向后兼容)

    // required 优先级:路由级 config > 环境变量全局配置
    const required = mtlsConfig.required ?? envConfig.clientCertRequired
    const cert = extractPeerCertificate(request)

    // --- 无客户端证书 ---
    if (!cert) {
      if (required) {
        reply.status(401).send(error(401, 'Client certificate required'))
        return
      }
      // 降级模式:有证书则验证,无则跳过(记录 warning)
      logger.warn('mTLS: no client certificate presented (degraded mode)', {
        route: request.url,
      })
      return
    }

    // --- 1. 校验证书链(socket.authorized) ---
    const socket = request.raw.socket
    if (socket instanceof TLSSocket && !socket.authorized) {
      const authErr = socket.authorizationError
      const errMsg = authErr instanceof Error ? authErr.message : 'unknown'
      if (required) {
        reply
          .status(401)
          .send(error(401, `Client certificate verification failed: ${errMsg}`))
        return
      }
      logger.warn('mTLS: client certificate not authorized (degraded mode)', {
        route: request.url,
        error: errMsg,
      })
    }

    // --- 2. 校验有效期 ---
    if (!isCertWithinValidity(cert)) {
      if (required) {
        reply.status(401).send(error(401, 'Client certificate expired or not yet valid'))
        return
      }
      logger.warn('mTLS: client certificate outside validity period (degraded mode)', {
        route: request.url,
      })
    }

    // --- 3. CN 白名单检查 ---
    const cnAllowList = mtlsConfig.cnAllowList
    if (cnAllowList && cnAllowList.length > 0) {
      const cn = asString(cert.subject.CN)
      if (!cnAllowList.includes(cn)) {
        reply
          .status(403)
          .send(error(403, `Client certificate CN "${cn}" not in allow list`))
        return
      }
    }

    // --- 4. CRL 吊销检查(如果注册了检查器) ---
    if (revocationChecker) {
      try {
        const notRevoked = await revocationChecker(cert)
        if (!notRevoked) {
          reply.status(401).send(error(401, 'Client certificate has been revoked'))
          return
        }
      } catch (e) {
        logger.error('mTLS: revocation check failed', { error: (e as Error).message })
        if (required) {
          reply.status(401).send(error(401, 'Certificate revocation check failed'))
          return
        }
      }
    }

    // --- 5. 注入客户端身份到 request ---
    request.mtlsClient = buildClientIdentity(cert)
  })
}

export default fp(mtlsPlugin, {
  name: 'mtls',
  fastify: '5.x',
})
