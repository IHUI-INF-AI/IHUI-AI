/**
 * Vite 插件 - 百度语音识别 API 代理
 * 
 * 功能：
 * 1. 处理 Token 获取（隐藏 Secret Key）
 * 2. 代理语音识别请求
 * 3. 缓存 Token 避免频繁请求
 * 
 * 配置环境变量：
 * - VITE_BAIDU_SPEECH_APP_ID
 * - VITE_BAIDU_SPEECH_API_KEY  
 * - VITE_BAIDU_SPEECH_SECRET_KEY
 */

/// <reference types="node" />

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { loadEnv } from 'vite'

// Token 缓存
interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

/**
 * 加载环境变量
 */
function loadBaiduEnv(): { appId: string; apiKey: string; secretKey: string } | null {
  // 尝试从多个来源加载环境变量
  const mode = process.env.NODE_ENV || 'development'
  const root = process.cwd()
  
  // 使用 Vite 的 loadEnv 加载 .env 文件
  const env = loadEnv(mode, root, 'VITE_')
  
  const appId = env.VITE_BAIDU_SPEECH_APP_ID || process.env.VITE_BAIDU_SPEECH_APP_ID
  const apiKey = env.VITE_BAIDU_SPEECH_API_KEY || process.env.VITE_BAIDU_SPEECH_API_KEY
  const secretKey = env.VITE_BAIDU_SPEECH_SECRET_KEY || process.env.VITE_BAIDU_SPEECH_SECRET_KEY
  
  if (!appId || !apiKey || !secretKey) {
    return null
  }
  
  return { appId, apiKey, secretKey }
}

/**
 * 获取百度 Access Token
 * 参考官方文档：https://ai.baidu.com/ai-doc/REFERENCE/Ck3dwjhhu
 */
async function getBaiduAccessToken(apiKey: string, secretKey: string): Promise<string> {
  // 检查缓存
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    console.warn('[BaiduSpeech] 使用缓存的 Token')
    return tokenCache.accessToken
  }

  // 官方示例的 URL 格式
  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?client_id=${apiKey}&client_secret=${secretKey}&grant_type=client_credentials`

  console.warn('[BaiduSpeech] 正在获取 Token...')
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: '', // 官方示例使用空字符串作为 body
  })

  if (!response.ok) {
    throw new Error(`获取百度 Token 失败: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`百度 API 错误: ${data.error_description || data.error}`)
  }

  // 缓存 Token（提前1天过期）
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 86400) * 1000,
  }

  return data.access_token
}

/**
 * 读取请求体
 */
function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/**
 * 发送 JSON 响应
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

/**
 * 百度语音识别 Vite 插件
 */
export function baiduSpeechPlugin(): Plugin {
  return {
    name: 'baidu-speech-plugin',
    
    configureServer(server: ViteDevServer) {
      // 加载环境变量
      const baiduEnv = loadBaiduEnv()
      const isConfigured = !!baiduEnv

      // 始终注册健康检查端点（即使未配置环境变量）
      // 这样前端可以知道服务是否配置，而不是收到超时错误
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/speech/baidu/health' || req.method !== 'GET') {
          return next()
        }

        sendJson(res, 200, {
          status: isConfigured ? 'ok' : 'not_configured',
          provider: 'baidu',
          configured: isConfigured,
        })
      })

      if (!baiduEnv) {
        console.warn('[BaiduSpeech] 未配置百度语音环境变量，仅注册健康检查端点')
        console.warn('[BaiduSpeech] 请在 .env.local 中配置 VITE_BAIDU_SPEECH_APP_ID, VITE_BAIDU_SPEECH_API_KEY, VITE_BAIDU_SPEECH_SECRET_KEY')
        return
      }

      const { appId, apiKey, secretKey } = baiduEnv
      console.warn('[BaiduSpeech] 百度语音 API 代理已启用 (AppID:', appId, ')')

      // 处理 CORS 预检请求
      server.middlewares.use((req, res, next) => {
        if (req.method === 'OPTIONS' && req.url?.startsWith('/api/speech/baidu')) {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          })
          res.end()
          return
        }
        next()
      })

      // Token 端点 - GET /api/speech/baidu/token
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/speech/baidu/token' || req.method !== 'GET') {
          return next()
        }

        try {
          const accessToken = await getBaiduAccessToken(apiKey, secretKey)
          sendJson(res, 200, {
            access_token: accessToken,
            expires_in: 2592000, // 30 天
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : '获取 Token 失败'
          console.error('[BaiduSpeech] Token 错误:', message)
          sendJson(res, 500, { error: message })
        }
      })

      // 语音识别端点 - POST /api/speech/baidu/asr
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/speech/baidu/asr' || req.method !== 'POST') {
          return next()
        }

        try {
          // 获取 Token
          const accessToken = await getBaiduAccessToken(apiKey, secretKey)

          // 读取请求体
          const body = await readRequestBody(req)
          const requestData = JSON.parse(body)

          // 构建百度 API 请求
          const baiduUrl = `https://vop.baidu.com/server_api?dev_pid=${requestData.dev_pid || 1537}&cuid=${requestData.cuid || appId}&token=${accessToken}`

          // 准备音频数据
          const audioBase64 = requestData.audio
          const audioBuffer = Buffer.from(audioBase64, 'base64')

          // 调用百度语音识别 API
          const baiduResponse = await fetch(baiduUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'audio/pcm;rate=16000',
            },
            body: audioBuffer,
          })

          if (!baiduResponse.ok) {
            throw new Error(`百度 API 请求失败: ${baiduResponse.status}`)
          }

          const result = await baiduResponse.json()
          sendJson(res, 200, result)
        } catch (error) {
          const message = error instanceof Error ? error.message : '语音识别失败'
          console.error('[BaiduSpeech] ASR 错误:', message)
          sendJson(res, 500, { 
            err_no: -1, 
            err_msg: message 
          })
        }
      })

      // JSON 格式请求端点 - POST /api/speech/baidu/asr/json
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/speech/baidu/asr/json' || req.method !== 'POST') {
          return next()
        }

        try {
          // 获取 Token
          const accessToken = await getBaiduAccessToken(apiKey, secretKey)

          // 读取请求体
          const body = await readRequestBody(req)
          const requestData = JSON.parse(body)

          // 计算原始音频数据长度
          const audioBuffer = Buffer.from(requestData.audio, 'base64')
          const audioLen = audioBuffer.length

          console.warn('[BaiduSpeech] ASR 请求参数:', {
            format: requestData.format || 'pcm',
            rate: requestData.rate || 16000,
            audioBase64Length: requestData.audio?.length,
            audioRawLength: audioLen,
          })

          // 构建百度 API 请求（JSON 格式）
          // 参考文档: https://ai.baidu.com/ai-doc/SPEECH/ek39uxgre
          const baiduUrl = 'https://vop.baidu.com/server_api'

          const baiduRequestBody = {
            format: requestData.format || 'pcm',
            rate: requestData.rate || 16000,
            channel: requestData.channel || 1,
            cuid: requestData.cuid || appId,
            token: accessToken,
            dev_pid: requestData.dev_pid || 1537, // 1537 = 普通话(支持简单的英文识别)
            speech: requestData.audio, // Base64 编码的音频
            len: audioLen, // 原始语音数据长度
          }

          console.warn('[BaiduSpeech] 调用百度 ASR API...')

          const baiduResponse = await fetch(baiduUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(baiduRequestBody),
          })

          if (!baiduResponse.ok) {
            throw new Error(`百度 API 请求失败: ${baiduResponse.status}`)
          }

          const result = await baiduResponse.json()
          sendJson(res, 200, result)
        } catch (error) {
          const message = error instanceof Error ? error.message : '语音识别失败'
          console.error('[BaiduSpeech] ASR JSON 错误:', message)
          sendJson(res, 500, { 
            err_no: -1, 
            err_msg: message 
          })
        }
      })

    },
  }
}

export default baiduSpeechPlugin
