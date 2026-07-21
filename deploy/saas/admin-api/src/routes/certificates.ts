/**
 * 证书管理路由
 * 端点:
 *   GET /admin/api/certificates
 *
 * 实现:扫描 Traefik acme.json,解析每个证书的:
 *   - domain / sans / issuer / subject
 *   - notBefore / notAfter / daysUntilExpiry
 *   - status: healthy (>30d) / warning (<30d) / critical (<7d) / expired
 *   - source: letsencrypt / self-signed / custom
 *
 * 解析方式: node:crypto.X509Certificate(无外部依赖)
 */
import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { requireAdminAuth } from './auth.js';
import { config } from '../config.js';

/** acme.json 在宿主机的路径(Traefik 数据卷挂载点) */
const ACME_JSON_PATH = pathResolve(config.SAAS_ROOT, '../volumes/saas_letsencrypt/_data/acme.json');

/** 证书状态判定阈值(天数) */
const CRITICAL_DAYS = 7;
const WARNING_DAYS = 30;

type CertStatus = 'healthy' | 'warning' | 'critical' | 'expired';
type CertSource = 'letsencrypt' | 'self-signed' | 'custom';

interface AcmeCertificateEntry {
  certificate?: string;     // Base64-encoded PEM
  issuerCertificate?: string;
  /** Traefik 可能还携带其他字段(domain / etc.) */
  [key: string]: unknown;
}

interface AcmeFile {
  [domain: string]: AcmeCertificateEntry;
}

interface Certificate {
  domain: string;
  sans: string[];
  issuer: string;
  subject: string;
  notBefore: string;
  notAfter: string;
  daysUntilExpiry: number;
  status: CertStatus;
  source: CertSource;
  serialNumber?: string;
  fingerprint?: string;
}

interface CertificateListResult {
  certificates: Certificate[];
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  expired: number;
  acmePath: string;
  acmeExists: boolean;
  generatedAt: string;
}

/** 解码 Base64 + PEM,提取 SAN 列表 */
function parseCertificate(pem: string): {
  notBefore: string;
  notAfter: string;
  subject: string;
  issuer: string;
  sans: string[];
  serialNumber: string;
  fingerprint: string;
  source: CertSource;
} {
  const x509 = new X509Certificate(pem);

  // 提取 SAN(x509.subjectAltName 是逗号分隔的 "DNS:xxx" 字符串)
  const sans: string[] = [];
  const subjectAltName = x509.subjectAltName ?? '';
  if (subjectAltName) {
    // 格式: "DNS:example.com, DNS:*.example.com"
    const parts = subjectAltName.split(',').map((s) => s.trim());
    for (const part of parts) {
      if (part.startsWith('DNS:')) {
        sans.push(part.slice(4));
      }
    }
  }
  // 若无 SAN 扩展,使用 subject CN
  if (sans.length === 0) {
    const cnMatch = x509.subject.match(/CN=([^,]+)/);
    if (cnMatch) sans.push(cnMatch[1]);
  }

  // 颁发者识别(Let's Encrypt / 自签)
  let source: CertSource = 'custom';
  const issuer = x509.issuer;
  if (/Let's Encrypt|staging\.letsencrypt\.org/i.test(issuer)) {
    source = 'letsencrypt';
  } else if (x509.verify(x509.publicKey) || x509.subject === x509.issuer) {
    // 自签证书:Subject == Issuer
    source = 'self-signed';
  }

  return {
    notBefore: x509.validFrom,
    notAfter: x509.validTo,
    subject: x509.subject,
    issuer: x509.issuer,
    sans,
    serialNumber: x509.serialNumber,
    fingerprint: x509.fingerprint256,
    source,
  };
}

/** 扫描 acme.json 解析所有证书 */
function scanCertificates(): CertificateListResult {
  const generatedAt = new Date().toISOString();
  const acmeExists = existsSync(ACME_JSON_PATH);

  if (!acmeExists) {
    return {
      certificates: [],
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      expired: 0,
      acmePath: ACME_JSON_PATH,
      acmeExists: false,
      generatedAt,
    };
  }

  const acme: { Certificates?: AcmeFile } = JSON.parse(
    readFileSync(ACME_JSON_PATH, 'utf8'),
  );
  const certEntries = acme.Certificates ?? {};

  const certificates: Certificate[] = [];
  const now = Date.now();

  for (const [domain, entry] of Object.entries(certEntries)) {
    if (!entry.certificate) continue;

    try {
      // Traefik acme.json 的 certificate 字段是 Base64 编码的 PEM
      // PEM 格式: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
      let pem: string;
      try {
        // 先尝试 Base64 解码
        const decoded = Buffer.from(entry.certificate, 'base64').toString('utf8');
        if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
          pem = decoded;
        } else {
          // 不是 PEM,跳过
          continue;
        }
      } catch {
        continue;
      }

      const parsed = parseCertificate(pem);
      const notAfterMs = new Date(parsed.notAfter).getTime();
      const daysUntilExpiry = Math.floor((notAfterMs - now) / (1000 * 60 * 60 * 24));

      let status: CertStatus;
      if (daysUntilExpiry < 0) status = 'expired';
      else if (daysUntilExpiry < CRITICAL_DAYS) status = 'critical';
      else if (daysUntilExpiry < WARNING_DAYS) status = 'warning';
      else status = 'healthy';

      certificates.push({
        domain,
        sans: parsed.sans,
        issuer: parsed.issuer,
        subject: parsed.subject,
        notBefore: parsed.notBefore,
        notAfter: parsed.notAfter,
        daysUntilExpiry,
        status,
        source: parsed.source,
        serialNumber: parsed.serialNumber,
        fingerprint: parsed.fingerprint,
      });
    } catch (err) {
      // 跳过解析失败的证书
      continue;
    }
  }

  // 按剩余天数升序排序(即将过期的在前)
  certificates.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const healthy = certificates.filter((c) => c.status === 'healthy').length;
  const warning = certificates.filter((c) => c.status === 'warning').length;
  const critical = certificates.filter((c) => c.status === 'critical').length;
  const expired = certificates.filter((c) => c.status === 'expired').length;

  return {
    certificates,
    total: certificates.length,
    healthy,
    warning,
    critical,
    expired,
    acmePath: ACME_JSON_PATH,
    acmeExists: true,
    generatedAt,
  };
}

export async function certificateRoutes(app: FastifyInstance): Promise<void> {
  // 所有路由需要双重鉴权(X-Admin-API-Key + X-Admin-User)
  app.addHook('preHandler', requireAdminAuth);

  // ==================== 列表 ====================
  app.get('/admin/api/certificates', async (request, reply) => {
    try {
      const result = scanCertificates();
      return result;
    } catch (err) {
      request.log.error({ err }, 'Failed to scan certificates');
      return reply.status(500).send({
        error: 'CertScanFailed',
        message: err instanceof Error ? err.message : String(err),
        acmePath: ACME_JSON_PATH,
      });
    }
  });
}
