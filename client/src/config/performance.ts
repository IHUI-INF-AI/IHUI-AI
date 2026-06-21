import { logger } from '../utils/logger'

// 性能优化配置
export const performanceConfig = {
  // 缓存配置
  cache: {
    // 默认缓存时间（毫秒）
    defaultTTL: 30 * 60 * 1000, // 30分钟
    // 最大缓存大小
    maxSize: 100,
    // 缓存键前缀
    keyPrefix: 'ihui_',
    // 启用本地存储缓存
    enableLocalStorage: true,
    // 启用内存缓存
    enableMemoryCache: true,
  },

  // 图片优化配置
  image: {
    // 启用懒加载
    enableLazyLoad: true,
    // 懒加载阈值（像素）
    lazyLoadThreshold: 100,
    // 启用WebP格式
    enableWebP: true,
    // 图片质量
    quality: 0.8,
    // 最大图片尺寸
    maxWidth: 1920,
    maxHeight: 1080,
  },

  // 网络优化配置
  network: {
    // 启用资源预加载
    enablePreload: true,
    // 预加载资源列表
    preloadResources: [
      '/images/1e9875dc-60a0-461e-8fcd-fee8974e52f8wx_1750138972917_20250617054253.jpg',
      '/css/animations.css',
    ],
    // 启用DNS预解析
    enableDNSPrefetch: true,
    // DNS预解析域名列表
    dnsPrefetchDomains: ['api.ihui.ai', 'cdn.ihui.ai'],
    // 启用预连接
    enablePreconnect: true,
    // 预连接域名列表
    preconnectDomains: ['https://api.ihui.ai', 'https://cdn.ihui.ai'],
  },

  // 虚拟滚动配置
  virtualScroll: {
    // 启用虚拟滚动
    enabled: true,
    // 默认项目高度
    itemHeight: 80,
    // 缓冲区大小
    bufferSize: 5,
    // 最小列表长度（超过此长度才启用虚拟滚动）
    minItemCount: 50,
  },

  // 性能监控配置
  monitoring: {
    // 启用性能监控
    enabled: true,
    // 监控间隔（毫秒）
    interval: 5000,
    // 启用FPS监控
    enableFPS: true,
    // 启用内存监控
    enableMemory: true,
    // 启用网络监控
    enableNetwork: true,
    // 性能阈值
    thresholds: {
      // FPS阈值
      fps: 30,
      // 内存使用阈值（MB）
      memory: 100,
      // 页面加载时间阈值（毫秒）
      loadTime: 3000,
    },
  },

  // 动画优化配置
  animation: {
    // 启用动画
    enabled: true,
    // 减少动画（低性能设备）
    reduceMotion: false,
    // 动画持续时间倍数
    durationMultiplier: 1,
    // 启用硬件加速
    enableHardwareAcceleration: true,
  },

  // 代码分割配置
  codeSplitting: {
    // 启用路由级代码分割
    enableRouteLevel: true,
    // 启用组件级代码分割
    enableComponentLevel: true,
    // 预加载策略
    preloadStrategy: 'hover', // 'hover' | 'visible' | 'none'
  },

  // 压缩配置
  compression: {
    // 启用Gzip压缩
    enableGzip: true,
    // 启用Brotli压缩
    enableBrotli: true,
    // 压缩阈值（字节）
    threshold: 1024,
  },
}

// 性能优化策略
export const performanceStrategies = {
  // 低性能设备优化
  lowPerformance: {
    ...performanceConfig,
    animation: {
      ...performanceConfig.animation,
      enabled: false,
      reduceMotion: true,
    },
    image: {
      ...performanceConfig.image,
      quality: 0.6,
      maxWidth: 1280,
      maxHeight: 720,
    },
    monitoring: {
      ...performanceConfig.monitoring,
      interval: 10000,
    },
  },

  // 慢网络优化
  slowNetwork: {
    ...performanceConfig,
    image: {
      ...performanceConfig.image,
      quality: 0.5,
      maxWidth: 800,
      maxHeight: 600,
    },
    network: {
      ...performanceConfig.network,
      enablePreload: false,
    },
  },

  // 移动端优化
  mobile: {
    ...performanceConfig,
    virtualScroll: {
      ...performanceConfig.virtualScroll,
      itemHeight: 60,
      bufferSize: 3,
      minItemCount: 30,
    },
    animation: {
      ...performanceConfig.animation,
      durationMultiplier: 0.8,
    },
  },
}

// 获取当前设备的性能配置
export function getPerformanceConfig() {
  // 检测设备性能
  const isLowPerformance = navigator.hardwareConcurrency <= 2
  const isSlowNetwork =
    (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
      ?.effectiveType === 'slow-2g' ||
    (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
      ?.effectiveType === '2g'
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )

  if (isLowPerformance) {
    return performanceStrategies.lowPerformance
  }

  if (isSlowNetwork) {
    return performanceStrategies.slowNetwork
  }

  if (isMobile) {
    return performanceStrategies.mobile
  }

  return performanceConfig
}

// 应用性能配置
export function applyPerformanceConfig(config = getPerformanceConfig()) {
  // 应用动画配置
  if (!config.animation.enabled) {
    document.documentElement.style.setProperty('--animation-duration', '0s')
  } else {
    document.documentElement.style.setProperty(
      '--animation-duration',
      `${0.3 * config.animation.durationMultiplier}s`
    )
  }

  // 应用减少动画配置
  if (config.animation.reduceMotion) {
    document.documentElement.style.setProperty('--reduce-motion', 'reduce')
  }

  // 辅助函数：安全地添加link元素到文档
  const safeAppendLink = (link: HTMLLinkElement) => {
    if (document.head) {
      try {
        document.head.appendChild(link)
        return true
      } catch (_error) {
        // 作为备选方案，尝试添加到document.body
        if (document.body) {
          try {
            document.body.appendChild(link)
            return true
          } catch (bodyError) {
            logger.error(
              `Failed to append ${link.rel} link to both document.head and document.body:`,
              bodyError
            )
            return false
          }
        }
      }
    }
    return false
  }

  // 应用DNS预解析
  if (config.network.enableDNSPrefetch) {
    config.network.dnsPrefetchDomains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = domain
      safeAppendLink(link)
    })
  }

  // 应用预连接
  if (config.network.enablePreconnect) {
    config.network.preconnectDomains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = domain
      safeAppendLink(link)
    })
  }

  return config
}
