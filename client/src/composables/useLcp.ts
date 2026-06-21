/** LCP (Largest Contentful Paint) 优化 composable.

提供:
- 图片懒加载 (IntersectionObserver)
- 链接预连接 (preconnect)
- 关键资源预加载 (preload)
- 字体显示优化
- 长任务切片 (scheduler.yield)

用法:
  const { lazyImage, preconnect, preload, scheduleLongTask } = useLcp()
  await lazyImage('https://...')
*/
import { ref, onUnmounted } from 'vue'

interface LcpOptions {
  rootMargin?: string
  threshold?: number
  preconnectHosts?: string[]
}

export function useLcp(options: LcpOptions = {}) {
  const observer = ref<IntersectionObserver | null>(null)
  const preloaded = ref<Set<string>>(new Set())

  function setupObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement
            const src = target.dataset.lazySrc
            if (src) {
              if (target.tagName === 'IMG') {
                ;(target as HTMLImageElement).src = src
              } else {
                target.style.backgroundImage = `url(${src})`
              }
              target.removeAttribute('data-lazy-src')
              observer.value?.unobserve(target)
            }
          }
        })
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.01,
      }
    )
  }

  function observeLazy(el: HTMLElement) {
    if (!observer.value) setupObserver()
    observer.value?.observe(el)
  }

  async function lazyImage(src: string): Promise<string> {
    if (preloaded.value.has(src)) return src
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        preloaded.value.add(src)
        resolve(src)
      }
      img.onerror = reject
      img.src = src
    })
  }

  function preconnect(host: string, crossorigin = false) {
    if (typeof document === 'undefined' || preloaded.value.has(`preconnect:${host}`)) return
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = host
    if (crossorigin) link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
    preloaded.value.add(`preconnect:${host}`)
  }

  function preload(url: string, as: string = 'image') {
    if (typeof document === 'undefined' || preloaded.value.has(`preload:${url}`)) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    document.head.appendChild(link)
    preloaded.value.add(`preload:${url}`)
  }

  async function scheduleLongTask(task: () => Promise<void> | void) {
    if (typeof (window as any).scheduler !== 'undefined' && (window as any).scheduler.yield) {
      await (window as any).scheduler.yield()
      await task()
      return
    }
    // 后备: setTimeout 切片
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        await task()
        resolve()
      }, 0)
    })
  }

  // 初始化 preconnect
  if (Array.isArray(options.preconnectHosts)) {
    options.preconnectHosts.forEach((h) => preconnect(h))
  }

  onUnmounted(() => {
    observer.value?.disconnect()
  })

  return {
    observeLazy,
    lazyImage,
    preconnect,
    preload,
    scheduleLongTask,
  }
}
