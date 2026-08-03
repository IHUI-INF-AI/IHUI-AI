/**
 * Passkey (WebAuthn/FIDO2) Provider。
 *
 * 基于 @simplewebauthn/server 实现 4 个核心函数:
 * - generateRegistrationOptions: 生成注册选项(给前端 navigator.credentials.create)
 * - verifyRegistrationResponse:  验证注册响应(解析 attestation,提取公钥)
 * - generateAuthenticationOptions: 生成认证选项(给前端 navigator.credentials.get)
 * - verifyAuthenticationResponse:  验证认证响应(校验签名,返回新 counter)
 *
 * 配置(env):
 * - PASSKEY_RP_ID:    RP ID(默认 localhost,生产应改为实际域名,如 ihui.ai)
 * - PASSKEY_RP_NAME:  RP 显示名(默认 IHUI-AI)
 * - PASSKEY_ORIGINS:  允许的 Origin 列表(逗号分隔,默认 http://localhost:3000)
 *
 * ⚠️ @simplewebauthn/server ^13.3.2 已在 package.json 声明(待主 agent 执行 pnpm install)。
 *   本 provider 用 createRequire 动态加载,使包未安装时 typecheck 仍可通过。
 *   安装后可改为静态 import,并收紧 SimpleWebAuthnServer 类型签名(用真实类型替换 unknown)。
 *   v13 breaking changes(相对 v10):registrationInfo.credential 嵌套化、
 *   AuthenticatorDevice→WebAuthnCredential(credentialID→id, credentialPublicKey→publicKey)、
 *   verifyAuthenticationResponse 的 authenticator 参数→credential、@simplewebauthn/types 弃用。
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ============================================================
// 类型定义(provider 公共契约)
// ============================================================

/** 已存在的凭证描述(用于 excludeCredentials / allowCredentials)。 */
export interface PasskeyCredentialDescriptor {
  id: string
  type: 'public-key'
  transports?: string[]
}

/** 注册选项生成时传入的"已有凭证"输入(从 DB 查询后传入)。 */
export interface ExistingCredential {
  credentialId: string
  transports?: string[]
}

/** 验证认证响应时传入的"已存储凭证"(从 DB 查询 credentialId 命中的记录)。 */
export interface StoredPasskeyCredential {
  credentialId: string
  publicKey: Buffer
  counter: number
  transports?: string[]
}

/** verifyRegistrationResponse 返回结果。 */
export interface VerifiedRegistrationResult {
  verified: boolean
  credentialId?: string
  credentialPublicKey?: Buffer
  counter?: number
  deviceType?: string
  backedUp?: boolean
  aaguid?: string
}

/** verifyAuthenticationResponse 返回结果。 */
export interface VerifiedAuthenticationResult {
  verified: boolean
  newCounter?: number
  credentialId?: string
}

/** Passkey RP 配置(从 env 读取)。 */
export interface PasskeyConfig {
  rpID: string
  rpName: string
  origins: string[]
}

// ============================================================
// @simplewebauthn/server 最小化类型声明
// ------------------------------------------------------------
// 包未安装时用此声明让 typecheck 通过;包安装后此声明可删除(真实类型优先)。
// 函数签名宽松用 unknown,由 provider 层封装为强类型返回值。
// ============================================================

interface SimpleWebAuthnServer {
  generateRegistrationOptions: (opts: unknown) => Promise<unknown>
  verifyRegistrationResponse: (opts: unknown) => Promise<unknown>
  generateAuthenticationOptions: (opts: unknown) => Promise<unknown>
  verifyAuthenticationResponse: (opts: unknown) => Promise<unknown>
}

// ============================================================
// 配置读取
// ============================================================

export function getPasskeyConfig(): PasskeyConfig {
  return {
    rpID: process.env.PASSKEY_RP_ID ?? 'localhost',
    rpName: process.env.PASSKEY_RP_NAME ?? 'IHUI-AI',
    origins: (process.env.PASSKEY_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

// ============================================================
// @simplewebauthn/server 懒加载
// ============================================================

let _server: SimpleWebAuthnServer | null = null

function getServer(): SimpleWebAuthnServer {
  if (_server) return _server
  try {
    _server = require('@simplewebauthn/server') as SimpleWebAuthnServer
    return _server
  } catch (e) {
    throw new Error(
      `@simplewebauthn/server 未安装,无法使用 Passkey 功能。请执行:pnpm --filter @ihui/auth add @simplewebauthn/server。原始错误: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

// ============================================================
// 类型守卫(解析 @simplewebauthn/server 的 unknown 返回值)
// ============================================================

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

function toBuffer(v: unknown): Buffer | undefined {
  if (v instanceof Uint8Array) return Buffer.from(v)
  if (Array.isArray(v)) return Buffer.from(v as number[])
  return undefined
}

function toString(v: unknown): string | undefined {
  if (isString(v)) return v
  if (v instanceof Uint8Array) return Buffer.from(v).toString('utf8')
  return undefined
}

// ============================================================
// 4 个核心函数
// ============================================================

/**
 * 生成注册选项(给前端 navigator.credentials.create)。
 *
 * @param userId             当前登录用户 ID
 * @param email              用户邮箱(作为 userName 显示在浏览器 UI)
 * @param existingCredentials 用户已有 Passkey 列表(排除重复注册)
 * @returns Registration options JSON(直接返回给前端)
 */
export async function generateRegistrationOptions(
  userId: string,
  email: string,
  existingCredentials: ExistingCredential[],
): Promise<unknown> {
  const cfg = getPasskeyConfig()
  return getServer().generateRegistrationOptions({
    rpName: cfg.rpName,
    rpID: cfg.rpID,
    userID: userId,
    userName: email,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
}

/**
 * 验证注册响应(解析 attestation,提取公钥 + counter)。
 *
 * @param response          前端 navigator.credentials.create 返回的 response 对象
 * @param expectedChallenge register/options 阶段生成的 challenge(base64url)
 * @param expectedOrigin    预期 Origin(从配置读取,与前端实际 Origin 比对)
 * @param expectedRPID      预期 RP ID
 * @returns 验证结果(verified + credentialId + publicKey + counter + deviceType + aaguid)
 */
export async function verifyRegistrationResponse(
  response: unknown,
  expectedChallenge: string,
  expectedOrigin: string | string[],
  expectedRPID: string | string[],
): Promise<VerifiedRegistrationResult> {
  const raw = await getServer().verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
  })

  if (!isObject(raw)) {
    return { verified: false }
  }

  const verified = isBoolean(raw.verified) ? raw.verified : false
  if (!verified) {
    return { verified: false }
  }

  const info = isObject(raw.registrationInfo) ? raw.registrationInfo : undefined
  if (!info) {
    return { verified: true }
  }

  // v11+: credential(id/publicKey/counter/transports) 嵌套在 registrationInfo.credential 中
  //   v10 扁平字段 credentialID/credentialPublicKey/counter 已迁入 credential 对象
  const credential = isObject(info.credential) ? info.credential : undefined
  const credentialPublicKey = credential ? toBuffer(credential.publicKey) : undefined
  const credentialIdRaw = credential?.id
  const credentialId = credentialPublicKey
    ? credentialIdRaw instanceof Uint8Array
      ? Buffer.from(credentialIdRaw).toString('base64url')
      : isString(credentialIdRaw)
        ? credentialIdRaw
        : undefined
    : undefined

  return {
    verified: true,
    credentialId,
    credentialPublicKey,
    counter: credential && isNumber(credential.counter) ? credential.counter : undefined,
    deviceType: isString(info.credentialDeviceType) ? info.credentialDeviceType : undefined,
    backedUp: isBoolean(info.credentialBackedUp) ? info.credentialBackedUp : undefined,
    aaguid: toString(info.aaguid),
  }
}

/**
 * 生成认证选项(给前端 navigator.credentials.get)。
 *
 * @param allowedCredentials 允许的凭证列表(未登录场景传空数组,启用 discoverable credentials)
 * @returns Authentication options JSON(直接返回给前端)
 */
export async function generateAuthenticationOptions(
  allowedCredentials: StoredPasskeyCredential[],
): Promise<unknown> {
  const cfg = getPasskeyConfig()
  return getServer().generateAuthenticationOptions({
    rpID: cfg.rpID,
    allowCredentials: allowedCredentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
      transports: c.transports,
    })),
    userVerification: 'preferred',
  })
}

/**
 * 验证认证响应(校验签名,返回新 counter)。
 *
 * @param response          前端 navigator.credentials.get 返回的 response 对象
 * @param expectedChallenge auth/options 阶段生成的 challenge(base64url)
 * @param credential        DB 中匹配 credentialId 的已存储凭证(公钥 + 上次 counter)
 * @param expectedOrigin    预期 Origin
 * @param expectedRPID      预期 RP ID
 * @returns 验证结果(verified + newCounter + credentialId)
 */
export async function verifyAuthenticationResponse(
  response: unknown,
  expectedChallenge: string,
  credential: StoredPasskeyCredential,
  expectedOrigin: string | string[],
  expectedRPID: string | string[],
): Promise<VerifiedAuthenticationResult> {
  const raw = await getServer().verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    },
  })

  if (!isObject(raw)) {
    return { verified: false }
  }

  const verified = isBoolean(raw.verified) ? raw.verified : false
  if (!verified) {
    return { verified: false }
  }

  const info = isObject(raw.authenticationInfo) ? raw.authenticationInfo : undefined
  return {
    verified: true,
    newCounter: info && isNumber(info.newCounter) ? info.newCounter : undefined,
    credentialId: info && isString(info.credentialID) ? info.credentialID : undefined,
  }
}
