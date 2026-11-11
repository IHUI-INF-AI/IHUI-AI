// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: F-70 regression

/**
 * F-70 回归:OSS STS 直传凭证策略必须收敛到本人目录且限制单对象大小。
 * 只测纯函数(策略/objectKey 构造),不调三家云厂商 —— 断言的是"下发到 STS 的策略文本"。
 */

import { describe, it, expect } from 'vitest'
import {
  OSS_MAX_OBJECT_BYTES,
  buildAliyunStsPolicy,
  buildAwsStsPolicy,
  buildSessionName,
  buildTencentStsPolicy,
  generateObjectKey,
  ossUserPrefix,
  safeUserSegment,
} from '../src/services/oss-sts-service.js'

const REGION = 'ap-guangzhou'
const BUCKET = 'ihui-upload'
const USER_ID = '3f1c2b7a-9d4e-4a51-8c2f-0b6d5e7a1c33'

describe('F-70 腾讯 COS 策略', () => {
  it('resource 收敛到 uploads/{userId}/*,不再整桶通配', () => {
    const policy = buildTencentStsPolicy(REGION, BUCKET, USER_ID)
    const stmt = policy.statement[0]!

    expect(stmt.effect).toBe('allow')
    expect(stmt.resource).toEqual([`qcs::cos:${REGION}:::${BUCKET}/uploads/${USER_ID}/*`])
    // 整桶通配(`bucket/*`)必须已经不存在
    expect(stmt.resource).not.toContain(`qcs::cos:${REGION}:::${BUCKET}/*`)
    expect(stmt.action).toEqual(['name/cos:PutObject'])
  })

  it('带 content-length 上限条件(50MB)', () => {
    const stmt = buildTencentStsPolicy(REGION, BUCKET, USER_ID).statement[0]!
    expect(stmt.condition).toEqual({ numeric_less_than_equal: { 'cos:content-length': 52428800 } })
    expect(OSS_MAX_OBJECT_BYTES).toBe(50 * 1024 * 1024)
  })
})

describe('F-70 阿里 OSS 策略', () => {
  it('Resource 收敛到 uploads/{userId}/*,并限制 oss:ContentLength', () => {
    const stmt = buildAliyunStsPolicy(BUCKET, USER_ID).Statement[0]!

    expect(stmt.Effect).toBe('Allow')
    expect(stmt.Action).toEqual(['oss:PutObject'])
    expect(stmt.Resource).toEqual([`acs:oss:*:*:${BUCKET}/uploads/${USER_ID}/*`])
    expect(stmt.Resource).not.toContain(`acs:oss:*:*:${BUCKET}/*`)
    expect(stmt.Condition).toEqual({ NumericLessThanEquals: { 'oss:ContentLength': 52428800 } })
  })
})

describe('F-70 AWS 会话策略', () => {
  it('显式最小 Policy:只允许本人目录 PutObject / AbortMultipartUpload', () => {
    const policy = buildAwsStsPolicy(BUCKET, USER_ID)
    const stmt = policy.Statement[0]!

    expect(policy.Version).toBe('2012-10-17')
    expect(stmt.Effect).toBe('Allow')
    expect(stmt.Action).toEqual(['s3:PutObject', 's3:AbortMultipartUpload'])
    expect(stmt.Resource).toEqual([`arn:aws:s3:::${BUCKET}/uploads/${USER_ID}/*`])
  })
})

describe('F-70 objectKey / sessionName 服务端生成', () => {
  it('objectKey 落在 uploads/{userId}/ 下,与策略前缀一致', () => {
    const key = generateObjectKey(USER_ID, 'PNG')
    expect(key.startsWith(`${ossUserPrefix(USER_ID)}/`)).toBe(true)
    expect(key).toMatch(new RegExp(`^uploads/${USER_ID}/\\d+-[0-9a-f]{16}\\.PNG$`))
  })

  it('userId 中的目录穿越/分隔符被清洗,不会撑开策略作用域', () => {
    const evil = '../../etc/other-user'
    expect(safeUserSegment(evil)).toBe('______etc_other-user')
    expect(ossUserPrefix(evil)).toBe('uploads/______etc_other-user')

    const stmt = buildTencentStsPolicy(REGION, BUCKET, evil).statement[0]!
    expect(stmt.resource[0]).not.toContain('..')
    expect(stmt.resource[0]).toBe(`qcs::cos:${REGION}:::${BUCKET}/uploads/______etc_other-user/*`)
  })

  it('sessionName 由服务端按 userId 固定生成(不含客户端可传入的任意段)', () => {
    const name = buildSessionName(USER_ID)
    expect(name).toBe(`ihui-${USER_ID.slice(-8)}`)
    expect(name.length).toBeLessThanOrEqual(32)
    expect(buildSessionName('anonymous')).toBe('ihui-nonymous')
  })
})
