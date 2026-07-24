/**
 * 证书加载与校验工具(国安级 mTLS 配套)。
 *
 * 基于 Node.js crypto.X509Certificate 实现 PEM 证书加载、链校验、
 * 指纹提取、CN/SAN 解析,零第三方依赖。
 *
 * 核心能力:
 * - loadCertFromFile / loadCABundle:PEM → X509Certificate
 * - validateCert:有效期 / 签名算法 / 密钥用途 / 即将过期提醒
 * - getCertFingerprint:SHA-256 指纹(hex,无冒号)
 * - extractSubjectAltNames / extractCommonName:CN/SAN 提取
 */
import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { logger } from './logger.js'

export interface CertValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 从 PEM 文件加载单个 X509 证书。
 */
export function loadCertFromFile(path: string): X509Certificate {
  const pem = readFileSync(path, 'utf8')
  return new X509Certificate(pem)
}

/**
 * 加载 CA 证书链(支持单文件多证书或多个文件路径)。
 * 文件读取失败时 logger.warning 并跳过,不抛异常(降级运行)。
 */
export function loadCABundle(path: string | string[]): X509Certificate[] {
  const paths = Array.isArray(path) ? path : [path]
  const certs: X509Certificate[] = []
  for (const p of paths) {
    try {
      const pem = readFileSync(p, 'utf8')
      // 一个 CA bundle 文件可能包含多个 PEM 证书块
      const matches = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
      if (matches) {
        for (const certPem of matches) {
          certs.push(new X509Certificate(certPem))
        }
      }
    } catch (e) {
      logger.warn('Failed to load CA certificate', { path: p, error: (e as Error).message })
    }
  }
  return certs
}

/**
 * 校验证书有效性(有效期 / 签名算法 / 密钥用途 / 即将过期提醒)。
 * 返回 { valid, errors, warnings },不抛异常。
 */
export function validateCert(cert: X509Certificate): CertValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const now = new Date()
  const notBefore = cert.validFromDate
  const notAfter = cert.validToDate

  if (isNaN(notBefore.getTime())) errors.push('Invalid notBefore date')
  if (isNaN(notAfter.getTime())) errors.push('Invalid notAfter date')

  if (now < notBefore) errors.push('Certificate not yet valid')
  if (now > notAfter) errors.push('Certificate expired')

  // 即将过期提醒(<= 30 天)
  const msUntilExpiry = notAfter.getTime() - now.getTime()
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)
  if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
    warnings.push(`Certificate expires in ${Math.ceil(daysUntilExpiry)} days`)
  }

  // 签名算法检查(拒绝弱算法 md5/sha1)
  // signatureAlgorithm 存在于运行时(Node 19+)但缺失于 @types/node,用类型断言访问
  const sigAlg = (cert as X509Certificate & { signatureAlgorithm: string }).signatureAlgorithm
  if (sigAlg.includes('md5') || sigAlg.includes('sha1')) {
    warnings.push(`Weak signature algorithm: ${sigAlg}`)
  }

  // 密钥用途扩展检查
  const keyUsage = cert.keyUsage
  if (!keyUsage || keyUsage.length === 0) {
    warnings.push('No keyUsage extension present')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * 获取证书 SHA-256 指纹(hex 格式,无冒号分隔)。
 * X509Certificate.fingerprint256 返回 "AA:BB:CC:..." 格式,此处规范化为纯 hex。
 */
export function getCertFingerprint(cert: X509Certificate): string {
  return (cert.fingerprint256 ?? '').replace(/:/g, '').toLowerCase()
}

/**
 * 提取证书 Subject Alternative Names (SAN) 列表。
 * 返回形如 ["DNS:foo.com", "IP:1.2.3.4"] 的原始 SAN 条目列表。
 */
export function extractSubjectAltNames(cert: X509Certificate): string[] {
  const san = cert.subjectAltName
  if (!san) return []
  return san
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 从证书 subject 字段提取 Common Name (CN)。
 * subject 格式如 "CN=foo\nO=bar" 或 "CN=foo,O=bar"。
 * 返回 undefined 表示未找到 CN。
 */
export function extractCommonName(cert: X509Certificate): string | undefined {
  const subject = cert.subject
  if (!subject) return undefined
  const match = /CN=([^,\n]+)/.exec(subject)
  return match?.[1]?.trim()
}
