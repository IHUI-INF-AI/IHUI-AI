import { t } from '@/utils/i18n'

/**
 * OpenClaw Pairing System
 * 
 * 设备配对和同步系统:
 * - 设备发现和配对
 * - 跨平台同步 (iOS/macOS/Android/Windows/Linux)
 * - 远程控制
 * - 状态同步
 * - 安全通信
 * 
 * 参考: https://docs.clawd.bot/pairing
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 设备类型
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'server' | 'iot' | 'other'

/**
 * 平台类型
 */
export type PlatformType = 'macos' | 'ios' | 'android' | 'windows' | 'linux' | 'web' | 'other'

/**
 * 配对状态
 */
export type PairingStatus = 'unpaired' | 'pending' | 'pairing' | 'paired' | 'failed' | 'expired'

/**
 * 连接状态
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/**
 * 设备信息
 */
export interface DeviceInfo {
  id: string
  name: string
  type: DeviceType
  platform: PlatformType
  model?: string
  osVersion?: string
  appVersion?: string
  capabilities: DeviceCapability[]
  lastSeen?: number
  ipAddress?: string
  publicKey?: string
}

/**
 * 设备能力
 */
export interface DeviceCapability {
  name: string
  version?: string
  enabled: boolean
  config?: Record<string, unknown>
}

/**
 * 配对设备
 */
export interface PairedDevice extends DeviceInfo {
  pairingStatus: PairingStatus
  connectionStatus: ConnectionStatus
  pairedAt?: number
  lastConnected?: number
  syncEnabled: boolean
  syncSettings: SyncSettings
  permissions: DevicePermission[]
}

/**
 * 同步设置
 */
export interface SyncSettings {
  /** 同步记忆 */
  memory: boolean
  /** 同步技能 */
  skills: boolean
  /** 同步设置 */
  settings: boolean
  /** 同步对话历史 */
  conversations: boolean
  /** 同步文件 */
  files: boolean
  /** 同步间隔 (秒) */
  interval: number
  /** 仅在 WiFi 下同步 */
  wifiOnly: boolean
}

/**
 * 设备权限
 */
export interface DevicePermission {
  name: string
  granted: boolean
  grantedAt?: number
  expiresAt?: number
}

/**
 * 配对请求
 */
export interface PairingRequest {
  id: string
  fromDevice: DeviceInfo
  toDeviceId: string
  code: string
  createdAt: number
  expiresAt: number
  status: PairingStatus
}

/**
 * 配对码
 */
export interface PairingCode {
  code: string
  deviceId: string
  createdAt: number
  expiresAt: number
  used: boolean
}

/**
 * 同步数据
 */
export interface SyncData {
  type: SyncDataType
  data: unknown
  timestamp: number
  checksum: string
}

/**
 * 同步数据类型
 */
export type SyncDataType = 
  | 'memory'
  | 'skill'
  | 'setting'
  | 'conversation'
  | 'file'
  | 'state'

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean
  syncedItems: number
  errors: SyncError[]
  timestamp: number
  duration: number
}

/**
 * 同步错误
 */
export interface SyncError {
  type: SyncDataType
  itemId: string
  error: string
}

/**
 * 远程命令
 */
export interface RemoteCommand {
  id: string
  type: RemoteCommandType
  payload: unknown
  fromDeviceId: string
  toDeviceId: string
  timestamp: number
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: unknown
  error?: string
}

/**
 * 远程命令类型
 */
export type RemoteCommandType =
  | 'message'       // 发送消息
  | 'task'          // 执行任务
  | 'screenshot'    // 截屏
  | 'notification'  // 发送通知
  | 'clipboard'     // 剪贴板操作
  | 'file'          // 文件操作
  | 'setting'       // 设置更改
  | 'lock'          // 锁定设备
  | 'locate'        // 定位设备
  | 'ring'          // 响铃
  | 'custom'        // 自定义

/**
 * 配对管理器配置
 */
export interface PairingConfig {
  /** 设备名称 */
  deviceName?: string
  /** 配对码有效期 (秒) */
  codeExpiry?: number
  /** 自动重连 */
  autoReconnect?: boolean
  /** 重连间隔 (秒) */
  reconnectInterval?: number
  /** 最大重连次数 */
  maxReconnectAttempts?: number
  /** 心跳间隔 (秒) */
  heartbeatInterval?: number
  /** 加密启用 */
  encryptionEnabled?: boolean
}

/**
 * 配对管理器
 */
export class PairingManager extends EventEmitter {
  private config: Required<PairingConfig>
  private currentDevice = ref<DeviceInfo | null>(null)
  private pairedDevices = reactive<Map<string, PairedDevice>>(new Map())
  private pairingRequests = reactive<Map<string, PairingRequest>>(new Map())
  private pairingCodes = reactive<Map<string, PairingCode>>(new Map())
  private pendingCommands = reactive<Map<string, RemoteCommand>>(new Map())
  
  private initialized = ref(false)
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: PairingConfig = {}) {
    super()
    this.config = {
      deviceName: config.deviceName || this.generateDeviceName(),
      codeExpiry: config.codeExpiry || 300, // 5分钟
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval || 5,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30,
      encryptionEnabled: config.encryptionEnabled ?? true,
    }
  }

  /**
   * 生成设备名称
   */
  private generateDeviceName(): string {
    const platform = this.detectPlatform()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `iHuiAI-${platform}-${random}`
  }

  /**
   * 检测平台
   */
  private detectPlatform(): PlatformType {
    const ua = navigator.userAgent.toLowerCase()
    
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    if (/mac/.test(ua)) return 'macos'
    if (/win/.test(ua)) return 'windows'
    if (/linux/.test(ua)) return 'linux'
    
    return 'web'
  }

  /**
   * 检测设备类型
   */
  private detectDeviceType(): DeviceType {
    const ua = navigator.userAgent.toLowerCase()
    
    if (/mobile/.test(ua)) return 'mobile'
    if (/tablet|ipad/.test(ua)) return 'tablet'
    
    return 'desktop'
  }

  /**
   * 初始化配对系统
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Pairing] Initializing pairing system...')

    // 创建当前设备信息
    this.currentDevice.value = {
      id: this.generateDeviceId(),
      name: this.config.deviceName,
      type: this.detectDeviceType(),
      platform: this.detectPlatform(),
      model: navigator.userAgent,
      osVersion: navigator.platform,
      appVersion: '1.0.0',
      capabilities: this.detectCapabilities(),
      lastSeen: Date.now(),
    }

    // 加载已配对设备
    await this.loadPairedDevices()

    // 启动心跳
    this.startHeartbeat()

    this.initialized.value = true
    logger.info('[Pairing] Pairing system initialized')
    this.emit('initialized', this.currentDevice.value)
  }

  /**
   * 生成设备 ID
   */
  private generateDeviceId(): string {
    // 尝试从存储获取
    let deviceId = localStorage.getItem('openclaw_device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('openclaw_device_id', deviceId)
    }
    return deviceId
  }

  /**
   * 检测设备能力
   */
  private detectCapabilities(): DeviceCapability[] {
    const capabilities: DeviceCapability[] = []

    // 相机
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      capabilities.push({ name: 'camera', enabled: true })
    }

    // 麦克风
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      capabilities.push({ name: 'microphone', enabled: true })
    }

    // 位置
    if ('geolocation' in navigator) {
      capabilities.push({ name: 'location', enabled: true })
    }

    // 通知
    if ('Notification' in window) {
      capabilities.push({ name: 'notification', enabled: Notification.permission === 'granted' })
    }

    // 剪贴板
    if (navigator.clipboard) {
      capabilities.push({ name: 'clipboard', enabled: true })
    }

    // 语音
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      capabilities.push({ name: 'speech', enabled: true })
    }

    // 蓝牙
    if ('bluetooth' in navigator) {
      capabilities.push({ name: 'bluetooth', enabled: true })
    }

    return capabilities
  }

  /**
   * 加载已配对设备
   */
  private async loadPairedDevices(): Promise<void> {
    try {
      const saved = localStorage.getItem('openclaw_paired_devices')
      if (saved) {
        const devices = JSON.parse(saved) as PairedDevice[]
        for (const device of devices) {
          device.connectionStatus = 'disconnected'
          this.pairedDevices.set(device.id, device)
        }
        logger.info(`[Pairing] Loaded paired devices`)
      }
    } catch (error) {
      logger.error('[Pairing] Failed to load paired devices:', error)
    }
  }

  /**
   * 保存已配对设备
   */
  private savePairedDevices(): void {
    const devices = Array.from(this.pairedDevices.values())
    localStorage.setItem('openclaw_paired_devices', JSON.stringify(devices))
  }

  /**
   * 生成配对码
   */
  generatePairingCode(): PairingCode {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const pairingCode: PairingCode = {
      code,
      deviceId: this.currentDevice.value!.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.codeExpiry * 1000,
      used: false,
    }

    this.pairingCodes.set(code, pairingCode)

    // 设置过期清理
    setTimeout(() => {
      if (!pairingCode.used) {
        this.pairingCodes.delete(code)
      }
    }, this.config.codeExpiry * 1000)

    logger.info(`[Pairing] Generated pairing code: ${code}`)
    this.emit('codeGenerated', pairingCode)

    return pairingCode
  }

  /**
   * 使用配对码配对
   */
  async pairWithCode(code: string, deviceInfo: DeviceInfo): Promise<PairedDevice> {
    const pairingCode = this.pairingCodes.get(code)
    
    if (!pairingCode) {
      throw new Error(t('error.index.配对码无效'))
    }

    if (pairingCode.used) {
      throw new Error(t('error.index.配对码已使用1'))
    }

    if (Date.now() > pairingCode.expiresAt) {
      throw new Error(t('error.index.配对码已过期2'))
    }

    logger.info(`[Pairing] Pairing device: ${deviceInfo.name}`)

    // 标记配对码已使用
    pairingCode.used = true

    // 创建已配对设备
    const pairedDevice: PairedDevice = {
      ...deviceInfo,
      pairingStatus: 'paired',
      connectionStatus: 'connected',
      pairedAt: Date.now(),
      lastConnected: Date.now(),
      syncEnabled: true,
      syncSettings: {
        memory: true,
        skills: true,
        settings: true,
        conversations: true,
        files: false,
        interval: 300,
        wifiOnly: false,
      },
      permissions: [
        { name: 'message', granted: true, grantedAt: Date.now() },
        { name: 'notification', granted: true, grantedAt: Date.now() },
      ],
    }

    this.pairedDevices.set(deviceInfo.id, pairedDevice)
    this.savePairedDevices()

    this.emit('devicePaired', pairedDevice)

    return pairedDevice
  }

  /**
   * 发送配对请求
   */
  async sendPairingRequest(targetDeviceId: string): Promise<PairingRequest> {
    const request: PairingRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      fromDevice: this.currentDevice.value!,
      toDeviceId: targetDeviceId,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.codeExpiry * 1000,
      status: 'pending',
    }

    this.pairingRequests.set(request.id, request)

    logger.info(`[Pairing] Sending pairing request to: ${targetDeviceId}`)
    this.emit('pairingRequestSent', request)

    return request
  }

  /**
   * 接受配对请求
   */
  async acceptPairingRequest(requestId: string): Promise<PairedDevice> {
    const request = this.pairingRequests.get(requestId)
    if (!request) {
      throw new Error(t('error.index.配对请求不存在3'))
    }

    if (Date.now() > request.expiresAt) {
      throw new Error(t('error.index.配对请求已过期4'))
    }

    request.status = 'paired'

    const pairedDevice: PairedDevice = {
      ...request.fromDevice,
      pairingStatus: 'paired',
      connectionStatus: 'connected',
      pairedAt: Date.now(),
      lastConnected: Date.now(),
      syncEnabled: true,
      syncSettings: {
        memory: true,
        skills: true,
        settings: true,
        conversations: true,
        files: false,
        interval: 300,
        wifiOnly: false,
      },
      permissions: [],
    }

    this.pairedDevices.set(pairedDevice.id, pairedDevice)
    this.savePairedDevices()
    this.pairingRequests.delete(requestId)

    this.emit('pairingRequestAccepted', pairedDevice)

    return pairedDevice
  }

  /**
   * 拒绝配对请求
   */
  rejectPairingRequest(requestId: string): void {
    const request = this.pairingRequests.get(requestId)
    if (request) {
      request.status = 'failed'
      this.pairingRequests.delete(requestId)
      this.emit('pairingRequestRejected', requestId)
    }
  }

  /**
   * 取消配对
   */
  async unpairDevice(deviceId: string): Promise<void> {
    const device = this.pairedDevices.get(deviceId)
    if (!device) return

    this.pairedDevices.delete(deviceId)
    this.savePairedDevices()

    logger.info(`[Pairing] Unpairing: ${device.name}`)
    this.emit('deviceUnpaired', deviceId)
  }

  /**
   * 获取已配对设备
   */
  getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values())
  }

  /**
   * 获取设备
   */
  getDevice(deviceId: string): PairedDevice | undefined {
    return this.pairedDevices.get(deviceId)
  }

  /**
   * 获取当前设备
   */
  getCurrentDevice(): DeviceInfo | null {
    return this.currentDevice.value
  }

  /**
   * 更新设备同步设置
   */
  updateSyncSettings(deviceId: string, settings: Partial<SyncSettings>): void {
    const device = this.pairedDevices.get(deviceId)
    if (device) {
      device.syncSettings = { ...device.syncSettings, ...settings }
      this.savePairedDevices()
      this.emit('syncSettingsUpdated', { deviceId, settings: device.syncSettings })
    }
  }

  /**
   * 同步数据到设备
   */
  async syncToDevice(deviceId: string, data: SyncData): Promise<SyncResult> {
    const device = this.pairedDevices.get(deviceId)
    if (!device) {
      throw new Error(t('error.index.设备未配对5'))
    }

    if (device.connectionStatus !== 'connected') {
      throw new Error(t('error.index.设备未连接6'))
    }

    const startTime = Date.now()
    const errors: SyncError[] = []

    // 实际同步逻辑（这里是模拟）
    logger.info(`[Pairing] Syncing data to ${device.name}: ${data.type}`)

    const result: SyncResult = {
      success: errors.length === 0,
      syncedItems: 1,
      errors,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    }

    this.emit('syncCompleted', { deviceId, result })

    return result
  }

  /**
   * 发送远程命令
   */
  async sendRemoteCommand(
    deviceId: string,
    type: RemoteCommandType,
    payload: unknown
  ): Promise<RemoteCommand> {
    const device = this.pairedDevices.get(deviceId)
    if (!device) {
      throw new Error(t('error.index.设备未配对7'))
    }

    const command: RemoteCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      fromDeviceId: this.currentDevice.value!.id,
      toDeviceId: deviceId,
      timestamp: Date.now(),
      status: 'pending',
    }

    this.pendingCommands.set(command.id, command)

    logger.info(`[Pairing] Sending remote command to ${device.name}: ${type}`)
    this.emit('commandSent', command)

    return command
  }

  /**
   * 执行远程命令
   */
  async executeRemoteCommand(command: RemoteCommand): Promise<unknown> {
    command.status = 'executing'
    
    try {
      let result: unknown

      switch (command.type) {
        case 'message': {
          // 处理消息
          result = { received: true }
          break
        }
        case 'notification': {
          // 显示通知
          if (Notification.permission === 'granted') {
            new Notification(command.payload as string)
          }
          result = { shown: true }
          break
        }
        case 'ring': {
          // 播放铃声
          const audio = new Audio('data:audio/wav;base64,...')
          void audio.play()
          result = { played: true }
          break
        }
        default: {
          result = { executed: true }
        }
      }

      command.status = 'completed'
      command.result = result
      
      this.emit('commandExecuted', command)
      
      return result
    } catch (error) {
      command.status = 'failed'
      command.error = (error as Error).message
      throw error
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval * 1000)
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    if (this.currentDevice.value) {
      this.currentDevice.value.lastSeen = Date.now()
    }

    // 检查设备连接状态
    for (const device of this.pairedDevices.values()) {
      if (device.lastSeen && Date.now() - device.lastSeen > this.config.heartbeatInterval * 3 * 1000) {
        device.connectionStatus = 'disconnected'
      }
    }

    this.emit('heartbeat', { timestamp: Date.now() })
  }

  /**
   * 发现附近设备
   */
  async discoverDevices(): Promise<DeviceInfo[]> {
    // 在实际实现中，这会使用 mDNS、蓝牙或其他发现机制
    logger.info('[Pairing] Discovering nearby devices...')
    
    this.emit('discoveryStarted')

    // 模拟发现
    await new Promise(resolve => setTimeout(resolve, 2000))

    const devices: DeviceInfo[] = []

    this.emit('discoveryCompleted', devices)

    return devices
  }

  /**
   * 获取配对请求
   */
  getPendingRequests(): PairingRequest[] {
    return Array.from(this.pairingRequests.values())
      .filter(r => r.status === 'pending' && Date.now() < r.expiresAt)
  }

  /**
   * 授予设备权限
   */
  grantPermission(deviceId: string, permission: string): void {
    const device = this.pairedDevices.get(deviceId)
    if (device) {
      const existing = device.permissions.find(p => p.name === permission)
      if (existing) {
        existing.granted = true
        existing.grantedAt = Date.now()
      } else {
        device.permissions.push({
          name: permission,
          granted: true,
          grantedAt: Date.now(),
        })
      }
      this.savePairedDevices()
      this.emit('permissionGranted', { deviceId, permission })
    }
  }

  /**
   * 撤销设备权限
   */
  revokePermission(deviceId: string, permission: string): void {
    const device = this.pairedDevices.get(deviceId)
    if (device) {
      const existing = device.permissions.find(p => p.name === permission)
      if (existing) {
        existing.granted = false
      }
      this.savePairedDevices()
      this.emit('permissionRevoked', { deviceId, permission })
    }
  }

  /**
   * 关闭配对系统
   */
  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.savePairedDevices()
    this.initialized.value = false

    logger.info('[Pairing] Pairing system shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let pairingManagerInstance: PairingManager | null = null

/**
 * 获取配对管理器实例
 */
export function getPairingManager(config?: PairingConfig): PairingManager {
  if (!pairingManagerInstance) {
    pairingManagerInstance = new PairingManager(config)
  }
  return pairingManagerInstance
}

export default PairingManager
