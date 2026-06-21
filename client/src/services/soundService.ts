/**
 * 音效服务
 * @description 管理应用中的音效播放
 */

import { ref } from 'vue'
import { StorageManager } from '@/utils/storage'

type SoundType = 'step' | 'complete' | 'skip' | 'click' | 'success'

interface SoundConfig {
  src: string
  volume: number
}

const sounds: Record<SoundType, SoundConfig> = {
  step: { src: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsFYLTo8J1sGQlPptjz0I9xHg5Hk9Lr4pB5KxZLndDr5pZ+MBdQoNXs6KN/NA5Yq9jt6qR9Ow1cuNnu7Kd/Pwpgutrw77CBQA1jvNzx8LKGQg9kv9Xz8rOJRRBmwtT19bSLSxNpwdb29bSLTxRswtf49bSLTxRtwNn59bSLTxRuwNr69bSLTxRtwNv79bSLTxRswNz89bSLTxRrwN379bSLTxRqwOD89LWKThJpwOL79LKKUBVrxOT69bOKUBZrxOb59bOKUBZrwOf49bOKUBZrwOj39LKKUBZqwOn29LKKUBVqwOv19LKKUBVpwOz09K+JTxJowO309K+IThFmvPH09K+HTg9lvfL09K6GSg1jvfP09K2FSA1gvvT09KyERQtgvvX09KyDQgdgvgD29KyCQQVgvwH29K2BPAVgvwL29a2APARgvwP39K1/OQNgvwT39K1+NgJgvwX39K19NQJhvgb39Kx8NAJhvgf39Kx7MwJhvgh49Kx6MgJhvgk49Kt5MQJivgo49Kt4MAJivgs49Kt3LwJivgw49Kt2LgJivg049Kt1LQJivg449Kt0LAJkvg5A9KtzKwJkvhBA9KtyKgJlvhFB9KtxKQJlvhJB9KtwKAJlvhNB9KtvJwJmvhRB9KpuJgJmvhVB9KptJQJmvhZB9KpsJAJmvhdB9KprIwJmvhhB9KpqIgJnvhkB9KppIQJnvhkB9KpoIAJnvhkB9KpnHwJnvhkB9KpmHgJnvhkB9KplHQJnvhkB9KpkHAJnvhkB9KpjGwJnvhkB9KpiGgJnvhkB9KphGQJnvhkB9KpgGAJnvhkB9KpfFwJnvhkB9KpeFgJnvhkB9KpdFQJnvhkB9KpcFAJnvhkB9KpbEwJnvhkB9KpaEgJnvhkB9KpZEQJnvhkB9KpYEAJnvhkB9KpXAwJnvhkB9KpWAgJnvhkB9KpVAQJnvhkB9KpUAA==', volume: 0.3 },
  complete: { src: 'data:audio/wav;base64,UklGRl9vT19teleQsFYLTo8J1sGQlPptjz0I9xHg5Hk9Lr4pB5KxZLndDr5pZ+MBdQoNXs6KN/NA5Yq9jt6qR9Ow1cuNnu7Kd/Pwpgutrw77CBQA1jvNzx8LKGQg9kv9Xz8rOJRRBmwtT19bSLSxNpwdb29bSLTxRswtf49bSLTxRtwNn59bSLTxRuwNr69bSLTxRtwNv79bSLTxRswNz89bSLTxRrwN379bSLTxRqwOD89LWKThJpwOL79LKKUBVrxOT69bOKUBZrxOb59bOKUBZrwOf49bOKUBZrwOj39LKKUBZqwOn29LKKUBVqwOv19LKKUBVpwOz09K+JTxJowO309K+IThFmvPH09K+HTg9lvfL09K6GSg1jvfP09K2FSA1gvvT09KyERQtgvvX09KyDQgdgvgD29KyCQQVgvwH29K2BPAVgvwL29a2APARgvwP39K1/OQNgvwT39K1+NgJgvwX39K19NQJhvgb39Kx8NAJhvgf39Kx7MwJhvgh49Kx6MgJhvgk49Kt5MQJivgo49Kt4MAJivgs49Kt3LwJivgw49Kt2LgJivg049Kt1LQJivg449Kt0LA==', volume: 0.5 },
  skip: { src: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAD//wAAAAAAAP//AAAA', volume: 0.2 },
  click: { src: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAD//wAAAAAAAP//AAAA', volume: 0.1 },
  success: { src: 'data:audio/wav;base64,UklGRl9vT19teleQsFYLTo8J1sGQlPptjz0I9xHg5Hk9Lr4pB5KxZLndDr5pZ+MBdQoNXs6KN/NA5Yq9jt6qR9Ow1cuNnu7Kd/Pwpgutrw77CBQA1jvNzx8LKGQg9kv9Xz8rOJRRBmwtT19bSLSxNpwdb29bSLTxRswtf49bSLTxRtwNn59bSLTxRuwNr69bSLTxRtwNv79bSLTxRswNz89bSLTxRrwN379bSLTxRqwOD89LWKThJpwOL79LKKUBVrxOT69bOKUBZrxOb59bOKUBZrwOf49bOKUBZrwOj39LKKUBZqwOn29LKKUBVqwOv19LKKUBVpwOz09K+JTxJowO309K+IThFmvPH09K+HTg9lvfL09K6GSg1jvfP09K2FSA1gvvT09KyERQtgvvX09KyDQgdgvgD29KyCQQVgvwH29K2BPAVgvwL29a2APARgvwP39K1/OQNgvwT39K1+NgJgvwX39K19NQJhvgb39Kx8NAJhvgf39Kx7MwJhvgh49Kx6MgJhvgk49Kt5MQJivgo49Kt4MAJivgs49Kt3LwJivgw49Kt2LgJivg049Kt1LQJivg449Kt0LA==', volume: 0.4 },
}

const soundEnabledKey = 'sound_enabled'
const soundEnabled = ref(StorageManager.getItem<boolean>(soundEnabledKey) ?? true)

const audioCache: Map<SoundType, HTMLAudioElement> = new Map()

const getAudio = (type: SoundType): HTMLAudioElement | null => {
  if (audioCache.has(type)) {
    return audioCache.get(type)!
  }

  const config = sounds[type]
  if (!config) return null

  const audio = new Audio(config.src)
  audio.volume = config.volume
  audioCache.set(type, audio)
  return audio
}

const playSound = async (type: SoundType): Promise<void> => {
  if (!soundEnabled.value) return

  try {
    const audio = getAudio(type)
    if (audio) {
      audio.currentTime = 0
      await audio.play()
    }
  } catch (_error) {
    // 音效播放失败，静默处理
  }
}

const setSoundEnabled = (enabled: boolean) => {
  soundEnabled.value = enabled
  StorageManager.setItem(soundEnabledKey, enabled)
}

const isSoundEnabled = () => soundEnabled.value

export function useSoundService() {
  return {
    playSound,
    setSoundEnabled,
    isSoundEnabled,
    soundEnabled,
  }
}

export const soundService = {
  play: playSound,
  enable: () => setSoundEnabled(true),
  disable: () => setSoundEnabled(false),
  isEnabled: isSoundEnabled,
}
