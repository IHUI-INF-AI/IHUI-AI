/**
 * 支付宝支付服务(证书模式 + 公钥模式兼容)。
 * 密钥配置留空时降级为 mock 模式(DEV 环境)。
 *
 * 密钥配置(.env):
 * - ALIPAY_APP_ID: 应用 appid
 * - ALIPAY_GATEWAY: 网关(默认 https://openapi.alipay.com/gateway.do)
 * - ALIPAY_PRIVATE_KEY: 应用私钥 PEM(或 ALIPAY_PRIVATE_KEY_PATH)
 * - ALIPAY_NOTIFY_URL: 异步回调
 * - ALIPAY_RETURN_URL: 同步返回
 *
 * 证书模式(推荐,支付宝 2024+ 新应用默认):
 * - ALIPAY_CERT_MODE=true: 启用证书模式
 * - ALIPAY_APP_CERT_PATH: 应用证书路径(默认 certs/appCertPublicKey_<appid>.crt)
 * - ALIPAY_ALIPAY_CERT_PATH: 支付宝公钥证书路径(默认 certs/alipayCertPublicKey_RSA2.crt)
 * - ALIPAY_ROOT_CERT_PATH: 支付宝根证书路径(默认 certs/alipayRootCert.crt)
 *
 * 公钥模式(旧应用):
 * - ALIPAY_PUBLIC_KEY: 支付宝公钥 PEM(或 ALIPAY_PUBLIC_KEY_PATH)
 */

import { createSign, createVerify, createHash, X509Certificate, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { env } from 'node:process';
import { join } from 'node:path';

const GATEWAY = env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do';
// 自适应:pnpm filter 运行时 cwd=apps/api(用 certs/),项目根运行时用 apps/api/certs/
const CERTS_DIR = env.ALIPAY_CERTS_DIR ?? (
  existsSync(join(process.cwd(), 'certs'))
    ? join(process.cwd(), 'certs')
    : join(process.cwd(), 'apps', 'api', 'certs')
);

export function isAlipayConfigured(): boolean {
  return Boolean(env.ALIPAY_APP_ID && (env.ALIPAY_PRIVATE_KEY || env.ALIPAY_PRIVATE_KEY_PATH));
}

/** 证书模式判断 */
function isCertMode(): boolean {
  return env.ALIPAY_CERT_MODE === 'true' || Boolean(env.ALIPAY_APP_CERT_PATH);
}

/** 把支付宝密钥工具生成的裸 base64(PKCS8)自动包装成 PEM 格式(Node crypto 需要) */
function wrapPem(raw: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const trimmed = raw.trim();
  if (trimmed.includes('-----BEGIN')) return trimmed;
  const body = trimmed.replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') ?? trimmed;
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`;
}

function getPrivateKey(): string {
  if (env.ALIPAY_PRIVATE_KEY) return wrapPem(env.ALIPAY_PRIVATE_KEY, 'PRIVATE KEY');
  if (env.ALIPAY_PRIVATE_KEY_PATH) return readFileSync(env.ALIPAY_PRIVATE_KEY_PATH, 'utf-8');
  return '';
}

/**
 * 证书 issuer 格式化:按换行/逗号分割,trim,反转顺序,用逗号连接。
 *
 * 算法对齐支付宝官方 Java SDK(AlipaySignature.getCertSN / AlipaySignature.getRootCertSN):
 * - Java X509Certificate.getIssuerX500Principal().getName() 返回 RFC2253 倒序(CN→C),如
 *   "CN=Ant Financial Certification Authority R1,OU=Certification Authority,O=Ant Financial,C=CN"。
 * - Node X509Certificate.issuer 返回正序(C→CN,用 \n 分隔),如
 *   "C=CN\nO=Ant Financial\nOU=Certification Authority\nCN=Ant Financial Certification Authority R1"。
 * - 反转后得到倒序(CN→C),与 Java getName() 输出一致,MD5 才能匹配。
 *
 * 修复记录(2026-07-23):
 * - 第一版:reverse() + 十六进制 serial → 失败(serial 进制错误)
 * - 第二版:去 reverse() + 十六进制 serial → 失败(issuer 顺序错误)
 * - 第三版:去 reverse() + 十进制 serial → 失败(issuer 顺序错误)
 * - 第四版(当前):reverse() + 十进制 serial → 对齐 Java SDK,验证通过
 */
function formatIssuer(issuer: string): string {
  const parts = issuer.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return parts.reverse().join(',');
}

/**
 * 十六进制 serial 转十进制。
 *
 * 对齐支付宝官方 Java SDK(AntCertFormatUtil):Java X509Certificate.getSerialNumber()
 * 返回 BigInteger,toString() 默认十进制。Node X509Certificate.serialNumber 返回十六进制,
 * 需转十进制后才能与 Java SDK 的 MD5 输入一致。
 */
function toDecimalSerial(hexSerial: string): string {
  return BigInt('0x' + hexSerial).toString();
}

/** 计算单个证书序列号:MD5(issuer_formatted + decimalSerial),小写 hex(对齐官方 SDK) */
function getCertSN(certPem: string): string {
  const x509 = new X509Certificate(certPem);
  const content = formatIssuer(x509.issuer) + toDecimalSerial(x509.serialNumber);
  // 官方 alipay-sdk (antcertutil.js) 用 .digest('hex') 返回小写,支付宝侧大小写敏感
  return createHash('md5').update(content).digest('hex');
}

/** 计算根证书序列号:只取 RSA 类型证书,多个用 _ 连接,小写 hex */
function getRootCertSNFromPem(rootCertPem: string): string {
  const blocks = rootCertPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
  const sns: string[] = [];
  for (const block of blocks) {
    const cert = new X509Certificate(block);
    if (cert.publicKey.asymmetricKeyType === 'rsa') {
      const content = formatIssuer(cert.issuer) + toDecimalSerial(cert.serialNumber);
      sns.push(createHash('md5').update(content).digest('hex'));
    }
  }
  return sns.join('_');
}

// 缓存证书序列号(避免每次请求重新读文件)
let _appCertSN: string | null = null;
let _rootCertSN: string | null = null;
let _alipayPubKeyPem: string | null = null;

function appCertSN(): string {
  if (_appCertSN) return _appCertSN;
  const certPath = env.ALIPAY_APP_CERT_PATH ?? join(CERTS_DIR, `appCertPublicKey_${env.ALIPAY_APP_ID}.crt`);
  _appCertSN = getCertSN(readFileSync(certPath, 'utf-8'));
  return _appCertSN;
}

function rootCertSN(): string {
  if (_rootCertSN) return _rootCertSN;
  const certPath = env.ALIPAY_ROOT_CERT_PATH ?? join(CERTS_DIR, 'alipayRootCert.crt');
  _rootCertSN = getRootCertSNFromPem(readFileSync(certPath, 'utf-8'));
  return _rootCertSN;
}

/** 证书模式下获取支付宝公钥(从支付宝公钥证书提取) */
function getAlipayPublicKey(): string {
  if (!isCertMode()) {
    // 公钥模式:直接用 ALIPAY_PUBLIC_KEY
    if (env.ALIPAY_PUBLIC_KEY) return wrapPem(env.ALIPAY_PUBLIC_KEY, 'PUBLIC KEY');
    if (env.ALIPAY_PUBLIC_KEY_PATH) return readFileSync(env.ALIPAY_PUBLIC_KEY_PATH, 'utf-8');
    return '';
  }
  // 证书模式:从支付宝公钥证书提取公钥
  if (_alipayPubKeyPem) return _alipayPubKeyPem;
  const certPath = env.ALIPAY_ALIPAY_CERT_PATH ?? join(CERTS_DIR, 'alipayCertPublicKey_RSA2.crt');
  const cert = new X509Certificate(readFileSync(certPath, 'utf-8'));
  const pem = String(cert.publicKey.export({ type: 'spki', format: 'pem' }));
  _alipayPubKeyPem = pem;
  return pem;
}

/** 证书模式下添加 app_cert_sn + alipay_root_cert_sn 到请求参数 */
function addCertParams(params: Record<string, string>): void {
  if (isCertMode()) {
    params.app_cert_sn = appCertSN();
    params.alipay_root_cert_sn = rootCertSN();
  }
}

/** 参数排序拼接(签名串) */
function buildSignContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

/** RSA2 签名 */
function signParams(params: Record<string, string>): string {
  const signContent = buildSignContent(params);
  const sign = createSign('RSA-SHA256');
  sign.update(signContent, 'utf-8');
  return sign.sign(getPrivateKey(), 'base64');
}

/** 验证支付宝回调签名(证书模式从证书提取公钥,公钥模式用 ALIPAY_PUBLIC_KEY) */
export function verifyNotify(params: Record<string, string>): boolean {
  const pub = getAlipayPublicKey();
  if (!pub) {
    return env.NODE_ENV !== 'production';
  }
  const sign = params.sign;
  const signType = params.sign_type;
  if (!sign || signType !== 'RSA2') return false;
  const { sign: _s, sign_type: _st, ...rest } = params;
  const signContent = buildSignContent(rest);
  const verify = createVerify('RSA-SHA256');
  verify.update(signContent, 'utf-8');
  return verify.verify(pub, Buffer.from(sign, 'base64'));
}

/** 构造已签名 URL(PC/H5 网页支付) */
export function buildSignedUrl(bizContent: Record<string, unknown>, method = 'alipay.trade.page.pay'): string {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  addCertParams(params);
  params.sign = signParams(params);
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${GATEWAY}?${query}`;
}

/** APP 支付(返回 orderStr) */
export function appPayOrder(params: {
  outTradeNo: string;
  amount: number;
  subject: string;
}): string {
  const bizContent = {
    out_trade_no: params.outTradeNo,
    total_amount: params.amount.toFixed(2),
    subject: params.subject,
    product_code: 'QUICK_MSECURITY_PAY',
  };
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.app.pay',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  addCertParams(paramsObj);
  paramsObj.sign = signParams(paramsObj);
  return Object.entries(paramsObj)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * 小程序授权码兑换买家 user_id(alipay.system.oauth.token)。
 * 小程序前端 my.getAuthCode({ scopes: 'auth_user' }) 拿到 authCode,
 * 后端用 authCode 调 alipay.system.oauth.token 兑换 user_id(2088开头)或 openid。
 *
 * 参考:https://opendocs.alipay.com/mini/introduce/authcode
 */
export async function exchangeAuthCode(authCode: string): Promise<{ userId?: string; openId?: string; accessToken?: string }> {
  if (!authCode) throw new Error('authCode is required')
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.system.oauth.token',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    grant_type: 'authorization_code',
    code: authCode,
  }
  addCertParams(paramsObj)
  paramsObj.sign = signParams(paramsObj)
  const body = new URLSearchParams(paramsObj).toString()
  const resp = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await resp.json()) as {
    alipay_system_oauth_token_response: {
      access_token?: string
      user_id?: string
      open_id?: string
      code: string
      msg: string
    }
  }
  const tok = data.alipay_system_oauth_token_response
  if (tok.code !== '10000') {
    throw new Error(`alipay.system.oauth.token failed: ${tok.code} ${tok.msg}`)
  }
  return { userId: tok.user_id, openId: tok.open_id, accessToken: tok.access_token }
}

/**
 * 小程序支付下单(alipay.trade.create + JSAPI_PAY,返回 tradeNO 给前端 my.tradePay 调起支付)。
 *
 * 支付宝小程序支付的官方必传参数(2024+ 文档):
 * - product_code: 必须为 'JSAPI_PAY'(小程序场景唯一产品码)
 * - op_app_id: 必选,商户实际经营主体的小程序应用的 appid(需在产品管理中心绑定)
 * - buyer_id / buyer_open_id / op_buyer_open_id: 必传其一(2088 开头的 user_id 或 openid)
 *
 * 错误码 40006 / ACQ.ACCESS_FORBIDDEN: 多为 product_code 错误或未签约 JSAPI 支付
 * 错误码 ACQ.PRODUCT_NOT_SUPPORT_IN_TINY_APP: product_code 没用 JSAPI_PAY
 * 错误码 ACQ.OPEN_ID_NOT_TINY_APP: op_app_id 缺失或非小程序应用类型
 */
export async function tradeCreate(params: {
  outTradeNo: string;
  amount: number;
  subject: string;
  /** 买家支付宝 user_id(2088开头)或 buyer_open_id(op_app_id 关联的 openid),必传 */
  buyerId: string;
  /** 小程序 appid,用于 op_app_id(默认从 ALIPAY_MINIAPP_APP_ID 环境变量读) */
  opAppId?: string;
}): Promise<{ tradeNo: string; outTradeNo: string }> {
  const opAppId = params.opAppId ?? env.ALIPAY_MINIAPP_APP_ID;
  if (!params.buyerId) {
    throw new Error('alipay.trade.create: buyerId is required (支付宝小程序支付必传 2088 开头 user_id)')
  }
  if (!opAppId) {
    throw new Error('alipay.trade.create: op_app_id is required (需在 .env 配置 ALIPAY_MINIAPP_APP_ID)')
  }
  const bizContent: Record<string, unknown> = {
    out_trade_no: params.outTradeNo,
    total_amount: params.amount.toFixed(2),
    subject: params.subject,
    product_code: 'JSAPI_PAY',
    op_app_id: opAppId,
    buyer_id: params.buyerId,
  };
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.create',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    notify_url: env.ALIPAY_NOTIFY_URL ?? '',
    biz_content: JSON.stringify(bizContent),
  };
  addCertParams(paramsObj);
  paramsObj.sign = signParams(paramsObj);
  const body = new URLSearchParams(paramsObj).toString();
  const resp = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await resp.json()) as {
    alipay_trade_create_response: { trade_no: string; out_trade_no: string; code: string; msg: string; sub_code?: string; sub_msg?: string };
  };
  const createResp = data.alipay_trade_create_response;
  if (createResp.code !== '10000') {
    throw new Error(
      `alipay.trade.create failed: ${createResp.code} ${createResp.msg}` +
        (createResp.sub_code ? ` (sub_code=${createResp.sub_code} sub_msg=${createResp.sub_msg})` : ''),
    );
  }
  return { tradeNo: createResp.trade_no, outTradeNo: createResp.out_trade_no };
}

/** 查询订单 */
export async function queryOrder(outTradeNo: string): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify({ out_trade_no: outTradeNo }),
  };
  addCertParams(params);
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  return (await resp.json()) as Record<string, unknown>;
}

/** 退款 */
export async function refundOrder(params: {
  outTradeNo: string;
  refundAmount: number;
  reason: string;
}): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const outRequestNo = `r${Date.now()}${randomBytes(3).toString('hex')}`;
  const bizContent = {
    out_trade_no: params.outTradeNo,
    refund_amount: params.refundAmount.toFixed(2),
    refund_reason: params.reason,
    out_request_no: outRequestNo,
  };
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.refund',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  addCertParams(paramsObj);
  paramsObj.sign = signParams(paramsObj);
  const body = new URLSearchParams(paramsObj).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = (await resp.json()) as { alipay_trade_refund_response: Record<string, unknown> };
  const refundResp = data.alipay_trade_refund_response ?? {};
  return { success: refundResp.code === '10000', response: refundResp };
}

/** 关闭订单 */
export async function closeOrder(outTradeNo: string): Promise<void> {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.close',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify({ out_trade_no: outTradeNo }),
  };
  addCertParams(params);
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

/** 下载账单 URL(对账用) */
export async function downloadBillUrl(billDate: string, billType: 'trade' | 'signcustomer' = 'trade'): Promise<string> {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.data.dataservice.bill.downloadurl.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify({ bill_date: billDate, bill_type: billType }),
  };
  addCertParams(params);
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = (await resp.json()) as { alipay_data_dataservice_bill_downloadurl_query_response: { bill_download_url: string } };
  return data.alipay_data_dataservice_bill_downloadurl_query_response.bill_download_url;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
