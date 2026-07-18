import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { X509Certificate, createPrivateKey, randomBytes, createSign, createVerify } from 'node:crypto'

/**
 * 真实微信支付证书 fixtures 测试(2026-07-18 证书激活)
 *
 * 验证 cert/ 目录下商户证书 + 私钥的可用性:
 * - 4 个文件(apiclient_key.pem / apiclient_cert.pem / apiclient_cert.p12 / README_CN.txt)均存在
 * - 私钥是有效 PKCS#8 RSA 私钥,可用于签名
 * - 证书是有效 X.509 证书,Subject 包含 CN=<商户号>
 * - 商户号从证书 Subject 提取,与 .env.production WX_SHOP_ID 一致
 * - 私钥 + 证书匹配(签名 → 验签 通过)
 * - 证书有效期内(NotBefore < today < NotAfter)
 *
 * 用途:防止生产环境因 cert/ 目录缺失/损坏/私钥不匹配导致支付链路全断。
 * 该测试不依赖任何 WeChat API,可离线运行。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
// apps/api/tests → g:/IHUI-AI
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..')
const CERT_DIR = join(PROJECT_ROOT, 'cert')

describe('wechat-pay cert fixtures — cert/ 目录完整性', () => {
  const files = {
    key: join(CERT_DIR, 'apiclient_key.pem'),
    cert: join(CERT_DIR, 'apiclient_cert.pem'),
    p12: join(CERT_DIR, 'apiclient_cert.p12'),
    readme: join(CERT_DIR, 'README_CN.txt'),
  }

  beforeAll(() => {
    // 友好提示:cert/ 目录是 .gitignore 排除的,首次克隆后需手动放置
    if (!existsSync(CERT_DIR)) {
      console.warn(
        `[WARN] cert/ 目录不存在 (${CERT_DIR}),请从微信商户平台下载证书并放置:`,
        'https://pay.weixin.qq.com → API 安全 → API 证书',
      )
    }
  })

  it('cert/ 目录存在', () => {
    expect(existsSync(CERT_DIR), `cert/ 目录缺失: ${CERT_DIR}`).toBe(true)
  })

  it('cert/apiclient_key.pem 存在', () => {
    expect(existsSync(files.key), `商户私钥缺失: ${files.key}`).toBe(true)
  })

  it('cert/apiclient_cert.pem 存在', () => {
    expect(existsSync(files.cert), `商户证书缺失: ${files.cert}`).toBe(true)
  })

  it('cert/apiclient_cert.p12 存在(PKCS12 备份)', () => {
    expect(existsSync(files.p12), `PKCS12 备份缺失: ${files.p12}`).toBe(true)
  })

  it('cert/README_CN.txt 存在(微信官方说明)', () => {
    expect(existsSync(files.readme), `README 缺失: ${files.readme}`).toBe(true)
  })

  describe('apiclient_key.pem 格式 + 可用性', () => {
    it('内容是 PKCS#8 PEM 私钥', () => {
      const pem = readFileSync(files.key, 'utf-8')
      expect(pem.trim().startsWith('-----BEGIN '), '不是 PEM 格式').toBe(true)
      expect(pem.trim()).toMatch(/-----BEGIN (RSA |EC )?PRIVATE KEY-----/)
    })

    it('Node.js crypto 可加载私钥', () => {
      const pem = readFileSync(files.key, 'utf-8')
      expect(() => createPrivateKey(pem), '私钥格式错误,无法加载').not.toThrow()
    })

    it('私钥可用于 RSA-SHA256 签名(模拟 WeChat V3 签名)', () => {
      const pem = readFileSync(files.key, 'utf-8')
      const key = createPrivateKey(pem)
      const sign = createSign('RSA-SHA256')
      sign.update('test message', 'utf-8')
      const signature = sign.sign(key, 'base64')
      expect(signature.length, '签名长度异常').toBeGreaterThan(100)
    })
  })

  describe('apiclient_cert.pem 格式 + 元数据', () => {
    let certObj: X509Certificate

    beforeAll(() => {
      const pem = readFileSync(files.cert, 'utf-8')
      certObj = new X509Certificate(pem)
    })

    it('内容是 X.509 PEM 证书', () => {
      const pem = readFileSync(files.cert, 'utf-8')
      expect(pem.trim().startsWith('-----BEGIN CERTIFICATE-----'), '不是证书 PEM').toBe(true)
    })

    it('颁发者是微信支付(Tenpay.com CA Center)', () => {
      expect(certObj.issuer, '证书不是微信支付颁发').toContain('Tenpay.com')
    })

    it('Subject CN 字段是商户号(纯数字)', () => {
      const cnMatch = certObj.subject.match(/CN=(\d+)/)
      expect(cnMatch, 'Subject CN 不是数字').not.toBeNull()
      const mchId = cnMatch![1]
      // 商户号应为 8-12 位数字
      expect(mchId, `商户号长度异常: ${mchId}`).toMatch(/^\d{8,12}$/)
    })

    it('当前时间在证书有效期内', () => {
      const now = new Date()
      const notBefore = new Date(certObj.validFrom)
      const notAfter = new Date(certObj.validTo)
      expect(now >= notBefore, `证书尚未生效: ${certObj.validFrom}`).toBe(true)
      expect(now <= notAfter, `证书已过期: ${certObj.validTo}`).toBe(true)
    })

    it('Subject OU 字段是商户公司名(便于人工核对)', () => {
      // OU 字段对中文有兼容问题,仅检查字段存在
      expect(certObj.subject, 'Subject 缺少 OU 字段').toMatch(/OU=/)
    })
  })

  describe('私钥 ↔ 证书 匹配性', () => {
    it('用私钥签名,证书验签通过(确认是同一对密钥)', () => {
      const key = createPrivateKey(readFileSync(files.key, 'utf-8'))
      const cert = new X509Certificate(readFileSync(files.cert, 'utf-8'))

      const payload = randomBytes(32).toString('hex')
      const sign = createSign('RSA-SHA256')
      sign.update(payload, 'utf-8')
      const signature = sign.sign(key, 'base64')

      const verify = createVerify('RSA-SHA256')
      verify.update(payload, 'utf-8')
      const valid = verify.verify(cert.publicKey, Buffer.from(signature, 'base64'))
      expect(valid, '私钥与证书不匹配 — cert/ 下文件可能被覆盖或错配').toBe(true)
    })
  })

  describe('PKCS12 备份文件格式', () => {
    it('apiclient_cert.p12 是 PKCS#12 ASN.1 DER 格式', () => {
      const buf = readFileSync(files.p12)
      // PKCS#12 文件以 0x30 (SEQUENCE) 开头
      expect(buf[0], '不是 ASN.1 SEQUENCE 开头').toBe(0x30)
      // 长度字段(2 字节长格式标识位为 0x82)
      expect(buf.length, 'PKCS#12 文件过小').toBeGreaterThan(100)
    })
  })

  describe('与 .env.production 配置一致性', () => {
    it('.env.production WX_SHOP_ID 与证书 CN 一致', () => {
      const envPath = join(PROJECT_ROOT, '.env.production')
      if (!existsSync(envPath)) {
        // 没填 .env.production 也 OK(交付阶段才会创建)
        return
      }
      const envContent = readFileSync(envPath, 'utf-8')
      const m = envContent.match(/^WX_SHOP_ID=(.+)$/m)
      if (!m) return
      const envShopId = m[1].trim()
      const certObj = new X509Certificate(readFileSync(files.cert, 'utf-8'))
      const cnMatch = certObj.subject.match(/CN=(\d+)/)
      expect(cnMatch).not.toBeNull()
      expect(envShopId, '.env.production WX_SHOP_ID 与证书 CN 不一致').toBe(cnMatch![1])
    })

    it('.env.production WX_PAY_CERT_SERIAL 与证书 serialNumber 一致', () => {
      const envPath = join(PROJECT_ROOT, '.env.production')
      if (!existsSync(envPath)) return
      const envContent = readFileSync(envPath, 'utf-8')
      const m = envContent.match(/^WX_PAY_CERT_SERIAL=(.+)$/m)
      if (!m) return
      const envSerial = m[1].trim().toUpperCase()
      const certObj = new X509Certificate(readFileSync(files.cert, 'utf-8'))
      // Node.js 返回的 serialNumber 可能是大写或小写,统一大写比较
      const certSerial = certObj.serialNumber.toUpperCase()
      expect(envSerial, '.env.production WX_PAY_CERT_SERIAL 与证书 serialNumber 不一致').toBe(
        certSerial,
      )
    })
  })
})
