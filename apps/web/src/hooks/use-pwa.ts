'use client'

import * as React from 'react'

export interface PwaInstallState {
  installable: boolean
  installed: boolean
  updateAvailable: boolean
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface UsePwaReturn extends PwaInstallState {
  install: () => Promise<boolean>
  applyUpdate: () => void
}

/** PWA 支持 Hook，监听 beforeinstallprompt 与 service worker 更新事件 */
export function usePwa(): UsePwaReturn {
  const [installable, setInstallable] = React.useState(false)
  const [installed, setInstalled] = React.useState(false)
  const [updateAvailable, setUpdateAvailable] = React.useState(false)
  const deferredPromptRef = React.useRef<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setInstallable(true)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallable(false)
      deferredPromptRef.current = null
    }
    const handleControllerUpdate = () => setUpdateAvailable(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerUpdate)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerUpdate)
      }
    }
  }, [])

  const install = React.useCallback(async (): Promise<boolean> => {
    const prompt = deferredPromptRef.current
    if (!prompt) return false
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setInstallable(false)
      deferredPromptRef.current = null
      return true
    }
    return false
  }, [])

  const applyUpdate = React.useCallback(() => {
    if (updateAvailable) {
      window.location.reload()
    }
  }, [updateAvailable])

  return { installable, installed, updateAvailable, install, applyUpdate }
}
