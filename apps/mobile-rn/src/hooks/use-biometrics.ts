import { useCallback, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'

export interface BiometricResult {
  success: boolean
  error?: string
}

export function useBiometrics() {
  const [supported, setSupported] = useState(false)
  const [enrolled, setEnrolled] = useState(false)

  const probe = useCallback(async () => {
    const has = await LocalAuthentication.hasHardwareAsync()
    const enrolledNow = await LocalAuthentication.isEnrolledAsync()
    setSupported(has)
    setEnrolled(enrolledNow)
  }, [])

  const authenticate = useCallback(async (reason = '请验证身份'): Promise<BiometricResult> => {
    try {
      const ok = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: '取消',
        disableDeviceFallback: false,
      })
      return { success: ok.success, error: ok.success ? undefined : ok.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '验证失败' }
    }
  }, [])

  return { supported, enrolled, probe, authenticate }
}
