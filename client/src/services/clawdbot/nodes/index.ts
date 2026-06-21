/**
 * OpenClaw Nodes System
 * 
 * 设备节点管理系统:
 * - 相机捕获 (Camera Snap/Clip)
 * - 屏幕录制 (Screen Recording)
 * - 位置服务 (Location Services)
 * - 系统通知 (System Notifications)
 * - 剪贴板 (Clipboard)
 * - 系统命令 (System Commands)
 * 
 * 参考: https://docs.clawd.bot/nodes
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 节点类型
 */
export type NodeType = 
  | 'camera'
  | 'screen'
  | 'location'
  | 'notification'
  | 'clipboard'
  | 'system'
  | 'audio'
  | 'bluetooth'
  | 'nfc'
  | 'sensor'

/**
 * 节点信息
 */
export interface NodeInfo {
  id: string
  type: NodeType
  name: string
  platform: 'web' | 'macos' | 'windows' | 'linux' | 'ios' | 'android'
  deviceFamily: string
  modelIdentifier: string
  capabilities: NodeCapability[]
  paired: boolean
  connected: boolean
  lastSeen: number
  metadata?: Record<string, unknown>
}

/**
 * 节点能力
 */
export interface NodeCapability {
  name: string
  available: boolean
  permissions: PermissionState
  constraints?: Record<string, unknown>
}

/**
 * 相机选项
 */
export interface CameraOptions {
  deviceId?: string
  facingMode?: 'user' | 'environment'
  width?: number
  height?: number
  frameRate?: number
  format?: 'jpeg' | 'png' | 'webp'
  quality?: number
}

/**
 * 相机捕获结果
 */
export interface CameraCapture {
  type: 'image' | 'video'
  data: Blob | string
  width: number
  height: number
  timestamp: number
  metadata?: {
    deviceId?: string
    facingMode?: string
    duration?: number
  }
}

/**
 * 屏幕录制选项
 */
export interface ScreenRecordOptions {
  audio?: boolean
  video?: boolean | MediaTrackConstraints
  displaySurface?: 'monitor' | 'window' | 'browser'
  selfBrowserSurface?: 'include' | 'exclude'
  maxDuration?: number
  format?: 'webm' | 'mp4'
}

/**
 * 屏幕捕获结果
 */
export interface ScreenCapture {
  type: 'image' | 'video'
  data: Blob | string
  width: number
  height: number
  timestamp: number
  duration?: number
  source?: string
}

/**
 * 位置信息
 */
export interface LocationInfo {
  latitude: number
  longitude: number
  altitude?: number
  accuracy: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
  timestamp: number
  address?: string
  source?: 'gps' | 'network' | 'ip'
}

/**
 * 位置选项
 */
export interface LocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watch?: boolean
}

/**
 * 通知选项
 */
export interface NotificationOptions {
  title: string
  body?: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
  silent?: boolean
  actions?: NotificationAction[]
  vibrate?: number[]
}

/**
 * 通知动作
 */
export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

/**
 * 剪贴板内容
 */
export interface ClipboardContent {
  text?: string
  html?: string
  image?: Blob
  files?: File[]
}

/**
 * 系统信息
 */
export interface SystemInfo {
  platform: string
  userAgent: string
  language: string
  languages: string[]
  online: boolean
  cookieEnabled: boolean
  doNotTrack: string | null
  hardwareConcurrency: number
  maxTouchPoints: number
  deviceMemory?: number
  connection?: {
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
  }
  battery?: {
    charging: boolean
    chargingTime: number
    dischargingTime: number
    level: number
  }
}

/**
 * 节点管理器
 */
export class NodeManager extends EventEmitter {
  private nodes = reactive<Map<string, NodeInfo>>(new Map())
  private initialized = ref(false)
  
  // 媒体相关
  private cameraStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  
  // 位置监听
  private locationWatchId: number | null = null

  constructor() {
    super()
  }

  /**
   * 初始化节点系统
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Nodes] Initializing nodes system...')

    // 检测可用节点
    await this.detectNodes()

    // 监听设备变化
    this.setupDeviceListeners()

    this.initialized.value = true
    logger.info('[Nodes] Nodes system initialized')
    this.emit('initialized')
  }

  /**
   * 检测可用节点
   */
  private async detectNodes(): Promise<void> {
    const platform = this.detectPlatform()

    // 相机节点
    if (navigator.mediaDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter(d => d.kind === 'videoinput')
      
      for (const camera of cameras) {
        this.nodes.set(`camera_${camera.deviceId}`, {
          id: `camera_${camera.deviceId}`,
          type: 'camera',
          name: camera.label || '摄像头',
          platform,
          deviceFamily: 'camera',
          modelIdentifier: camera.deviceId,
          capabilities: [
            { name: 'capture', available: true, permissions: 'prompt' },
            { name: 'video', available: true, permissions: 'prompt' },
          ],
          paired: true,
          connected: true,
          lastSeen: Date.now(),
        })
      }
    }

    // 屏幕节点
    if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
      this.nodes.set('screen_main', {
        id: 'screen_main',
        type: 'screen',
        name: '屏幕',
        platform,
        deviceFamily: 'display',
        modelIdentifier: 'main',
        capabilities: [
          { name: 'capture', available: true, permissions: 'prompt' },
          { name: 'record', available: true, permissions: 'prompt' },
        ],
        paired: true,
        connected: true,
        lastSeen: Date.now(),
      })
    }

    // 位置节点
    if ('geolocation' in navigator) {
      this.nodes.set('location_main', {
        id: 'location_main',
        type: 'location',
        name: '位置服务',
        platform,
        deviceFamily: 'gps',
        modelIdentifier: 'main',
        capabilities: [
          { name: 'getCurrentPosition', available: true, permissions: 'prompt' },
          { name: 'watchPosition', available: true, permissions: 'prompt' },
        ],
        paired: true,
        connected: true,
        lastSeen: Date.now(),
      })
    }

    // 通知节点
    if ('Notification' in window) {
      this.nodes.set('notification_main', {
        id: 'notification_main',
        type: 'notification',
        name: '系统通知',
        platform,
        deviceFamily: 'notification',
        modelIdentifier: 'main',
        capabilities: [
          { 
            name: 'show', 
            available: Notification.permission !== 'denied', 
            permissions: Notification.permission as PermissionState 
          },
        ],
        paired: true,
        connected: true,
        lastSeen: Date.now(),
      })
    }

    // 剪贴板节点
    if (navigator.clipboard) {
      this.nodes.set('clipboard_main', {
        id: 'clipboard_main',
        type: 'clipboard',
        name: '剪贴板',
        platform,
        deviceFamily: 'clipboard',
        modelIdentifier: 'main',
        capabilities: [
          { name: 'read', available: true, permissions: 'prompt' },
          { name: 'write', available: true, permissions: 'prompt' },
        ],
        paired: true,
        connected: true,
        lastSeen: Date.now(),
      })
    }

    // 系统节点
    this.nodes.set('system_main', {
      id: 'system_main',
      type: 'system',
      name: '系统信息',
      platform,
      deviceFamily: 'system',
      modelIdentifier: navigator.userAgent,
      capabilities: [
        { name: 'info', available: true, permissions: 'granted' },
        { name: 'battery', available: 'getBattery' in navigator, permissions: 'granted' },
        { name: 'connection', available: 'connection' in navigator, permissions: 'granted' },
      ],
      paired: true,
      connected: true,
      lastSeen: Date.now(),
    })
  }

  /**
   * 检测平台
   */
  private detectPlatform(): NodeInfo['platform'] {
    const ua = navigator.userAgent.toLowerCase()
    
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    if (/mac/.test(ua)) return 'macos'
    if (/win/.test(ua)) return 'windows'
    if (/linux/.test(ua)) return 'linux'
    
    return 'web'
  }

  /**
   * 设置设备监听
   */
  private setupDeviceListeners(): void {
    // 监听设备变化
    navigator.mediaDevices?.addEventListener('devicechange', async () => {
      await this.detectNodes()
      this.emit('devicesChanged')
    })

    // 监听在线状态
    window.addEventListener('online', () => this.emit('online'))
    window.addEventListener('offline', () => this.emit('offline'))
  }

  /**
   * 获取所有节点
   */
  getNodes(): NodeInfo[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 获取节点
   */
  getNode(id: string): NodeInfo | undefined {
    return this.nodes.get(id)
  }

  /**
   * 获取指定类型的节点
   */
  getNodesByType(type: NodeType): NodeInfo[] {
    return this.getNodes().filter(n => n.type === type)
  }

  // ==================== 相机功能 ====================

  /**
   * 打开相机
   */
  async openCamera(options: CameraOptions = {}): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
        facingMode: options.facingMode,
        width: options.width ? { ideal: options.width } : undefined,
        height: options.height ? { ideal: options.height } : undefined,
        frameRate: options.frameRate ? { ideal: options.frameRate } : undefined,
      },
    }

    this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints)
    this.emit('cameraOpened', this.cameraStream)
    
    return this.cameraStream
  }

  /**
   * 关闭相机
   */
  closeCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop())
      this.cameraStream = null
      this.emit('cameraClosed')
    }
  }

  /**
   * 拍照
   */
  async capturePhoto(options: CameraOptions = {}): Promise<CameraCapture> {
    const stream = this.cameraStream || await this.openCamera(options)
    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()

    const canvas = document.createElement('canvas')
    canvas.width = options.width || video.videoWidth
    canvas.height = options.height || video.videoHeight
    
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const format = options.format || 'jpeg'
    const quality = options.quality || 0.9
    const dataUrl = canvas.toDataURL(`image/${format}`, quality)

    const result: CameraCapture = {
      type: 'image',
      data: dataUrl,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now(),
      metadata: {
        deviceId: options.deviceId,
        facingMode: options.facingMode,
      },
    }

    this.emit('photoCaptured', result)
    
    return result
  }

  /**
   * 录制视频
   */
  async startVideoRecording(options: CameraOptions & { duration?: number } = {}): Promise<void> {
    const stream = this.cameraStream || await this.openCamera(options)
    
    this.recordedChunks = []
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' })
      const result: CameraCapture = {
        type: 'video',
        data: blob,
        width: options.width || 1280,
        height: options.height || 720,
        timestamp: Date.now(),
      }
      this.emit('videoRecorded', result)
    }

    this.mediaRecorder.start()
    this.emit('videoRecordingStarted')

    // 自动停止
    if (options.duration) {
      setTimeout(() => this.stopVideoRecording(), options.duration)
    }
  }

  /**
   * 停止视频录制
   */
  stopVideoRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.emit('videoRecordingStopped')
    }
  }

  // ==================== 屏幕功能 ====================

  /**
   * 截屏
   */
  async captureScreen(options: ScreenRecordOptions = {}): Promise<ScreenCapture> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: options.video || {
        displaySurface: options.displaySurface || 'monitor',
      },
      audio: options.audio,
    })

    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    // 停止流
    stream.getTracks().forEach(track => track.stop())

    const dataUrl = canvas.toDataURL('image/png')

    const result: ScreenCapture = {
      type: 'image',
      data: dataUrl,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now(),
    }

    this.emit('screenCaptured', result)
    
    return result
  }

  /**
   * 开始屏幕录制
   */
  async startScreenRecording(options: ScreenRecordOptions = {}): Promise<void> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: options.video || {
        displaySurface: options.displaySurface || 'monitor',
      },
      audio: options.audio,
    })

    this.recordedChunks = []
    this.mediaRecorder = new MediaRecorder(this.screenStream, {
      mimeType: options.format === 'mp4' ? 'video/mp4' : 'video/webm;codecs=vp9',
    })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' })
      const result: ScreenCapture = {
        type: 'video',
        data: blob,
        width: this.screenStream?.getVideoTracks()[0]?.getSettings().width || 1920,
        height: this.screenStream?.getVideoTracks()[0]?.getSettings().height || 1080,
        timestamp: Date.now(),
      }
      this.emit('screenRecorded', result)
    }

    this.mediaRecorder.start()
    this.emit('screenRecordingStarted')

    // 自动停止
    if (options.maxDuration) {
      setTimeout(() => this.stopScreenRecording(), options.maxDuration)
    }
  }

  /**
   * 停止屏幕录制
   */
  stopScreenRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop())
      this.screenStream = null
    }
    this.emit('screenRecordingStopped')
  }

  // ==================== 位置功能 ====================

  /**
   * 获取当前位置
   */
  async getCurrentLocation(options: LocationOptions = {}): Promise<LocationInfo> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationInfo = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            timestamp: position.timestamp,
            source: 'gps',
          }
          this.emit('locationObtained', location)
          resolve(location)
        },
        (error) => {
          this.emit('locationError', error)
          reject(error)
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 10000,
          maximumAge: options.maximumAge ?? 0,
        }
      )
    })
  }

  /**
   * 监听位置变化
   */
  watchLocation(
    callback: (location: LocationInfo) => void,
    options: LocationOptions = {}
  ): number {
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationInfo = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          timestamp: position.timestamp,
          source: 'gps',
        }
        callback(location)
        this.emit('locationUpdated', location)
      },
      (error) => {
        this.emit('locationError', error)
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 0,
      }
    )

    return this.locationWatchId
  }

  /**
   * 停止位置监听
   */
  stopWatchingLocation(): void {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId)
      this.locationWatchId = null
      this.emit('locationWatchStopped')
    }
  }

  // ==================== 通知功能 ====================

  /**
   * 请求通知权限
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    const permission = await Notification.requestPermission()
    this.emit('notificationPermissionChanged', permission)
    return permission
  }

  /**
   * 显示通知
   */
  async showNotification(options: NotificationOptions): Promise<Notification | null> {
    if (Notification.permission !== 'granted') {
      const permission = await this.requestNotificationPermission()
      if (permission !== 'granted') {
        logger.warn('[Nodes] Notification permission denied')
        return null
      }
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction,
      silent: options.silent,
      vibrate: options.vibrate,
    } as globalThis.NotificationOptions)

    notification.onclick = (event) => {
      this.emit('notificationClicked', { notification, event })
    }

    notification.onclose = () => {
      this.emit('notificationClosed', notification)
    }

    this.emit('notificationShown', notification)
    
    return notification
  }

  // ==================== 剪贴板功能 ====================

  /**
   * 读取剪贴板
   */
  async readClipboard(): Promise<ClipboardContent> {
    const content: ClipboardContent = {}

    try {
      content.text = await navigator.clipboard.readText()
    } catch {
      // 忽略
    }

    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type === 'text/html') {
            const blob = await item.getType(type)
            content.html = await blob.text()
          } else if (type.startsWith('image/')) {
            content.image = await item.getType(type)
          }
        }
      }
    } catch {
      // 忽略
    }

    this.emit('clipboardRead', content)
    
    return content
  }

  /**
   * 写入剪贴板
   */
  async writeClipboard(content: ClipboardContent): Promise<void> {
    if (content.text) {
      await navigator.clipboard.writeText(content.text)
    }

    if (content.image || content.html) {
      const items: ClipboardItem[] = []
      const blobs: Record<string, Blob> = {}

      if (content.html) {
        blobs['text/html'] = new Blob([content.html], { type: 'text/html' })
      }
      if (content.image) {
        blobs[content.image.type] = content.image
      }
      if (content.text) {
        blobs['text/plain'] = new Blob([content.text], { type: 'text/plain' })
      }

      items.push(new ClipboardItem(blobs))
      await navigator.clipboard.write(items)
    }

    this.emit('clipboardWritten', content)
  }

  // ==================== 系统信息 ====================

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const info: SystemInfo = {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: [...navigator.languages],
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    }

    // 网络信息
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
    if (connection) {
      info.connection = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
      }
    }

    // 电池信息
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as Navigator & { getBattery: () => Promise<BatteryManager> }).getBattery()
        info.battery = {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level,
        }
      } catch {
        // 忽略
      }
    }

    this.emit('systemInfoObtained', info)
    
    return info
  }

  /**
   * 关闭节点系统
   */
  shutdown(): void {
    this.closeCamera()
    this.stopScreenRecording()
    this.stopWatchingLocation()

    this.initialized.value = false
    logger.info('[Nodes] Nodes system shut down')
    this.emit('shutdown')
  }
}

// 类型定义
interface NetworkInformation {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface BatteryManager {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
}

// 单例实例
let nodeManagerInstance: NodeManager | null = null

/**
 * 获取节点管理器实例
 */
export function getNodeManager(): NodeManager {
  if (!nodeManagerInstance) {
    nodeManagerInstance = new NodeManager()
  }
  return nodeManagerInstance
}

export default NodeManager
