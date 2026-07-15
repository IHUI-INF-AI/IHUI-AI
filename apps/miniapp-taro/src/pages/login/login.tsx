import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useUserStore } from '@/stores/user'
import { sendSmsCode, loginBySms, loginByPassword, loginByWechat } from '@/api'

export default function Login() {
  const { setAuth } = useUserStore()
  const [loginType, setLoginType] = useState<'phone' | 'password'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [isLogging, setIsLogging] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const codeBtnText = useMemo(() => (countdown > 0 ? `${countdown}s` : '获取验证码'), [countdown])
  const codeBtnDisabled = useMemo(() => countdown > 0 || phone.length !== 11, [countdown, phone])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function sendCode() {
    if (codeBtnDisabled) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: '验证码已发送', icon: 'success' })
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1 && timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已由 request 统一提示
    }
  }

  async function handleLogin() {
    if (isLogging) return
    if (phone.length !== 11) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    setIsLogging(true)
    try {
      const res =
        loginType === 'phone'
          ? await loginBySms(phone, code)
          : await loginByPassword(phone, password)
      setAuth(res.token, res.user)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
    } catch {
      // 错误已统一提示
    } finally {
      setIsLogging(false)
    }
  }

  function handleWechatLogin() {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.login({
        success: async (res) => {
          try {
            const data = await loginByWechat(res.code)
            setAuth(data.token, data.user)
            Taro.reLaunch({ url: '/pages/index/index' })
          } catch {
            Taro.showToast({ title: '微信登录失败', icon: 'none' })
          }
        },
      })
    } else {
      Taro.showToast({ title: '请在微信小程序中使用', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen px-[24px] bg-white">
      {/* 顶部 Logo */}
      <View className="pt-[80px] pb-[40px] text-center">
        <Text className="text-[28px] font-bold text-[#07c160]">智汇AI</Text>
        <Text className="block mt-[8px] text-[13px] text-[#999]">AI 赋能学习与成长</Text>
      </View>

      {/* 登录方式切换 */}
      <View className="flex mb-[24px]">
        <View
          className={`flex-1 text-center py-[10px] text-[15px] border-b-[2px] border-solid ${
            loginType === 'phone'
              ? 'text-[#07c160] font-semibold border-[#07c160]'
              : 'text-[#999] border-transparent'
          }`}
          onClick={() => setLoginType('phone')}
        >
          <Text>验证码登录</Text>
        </View>
        <View
          className={`flex-1 text-center py-[10px] text-[15px] border-b-[2px] border-solid ${
            loginType === 'password'
              ? 'text-[#07c160] font-semibold border-[#07c160]'
              : 'text-[#999] border-transparent'
          }`}
          onClick={() => setLoginType('password')}
        >
          <Text>密码登录</Text>
        </View>
      </View>

      {/* 手机号 */}
      <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
        <Input
          className="flex-1 h-[48px] text-[15px]"
          type="number"
          maxlength={11}
          placeholder="请输入手机号"
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />
      </View>

      {/* 验证码 */}
      {loginType === 'phone' ? (
        <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            type="number"
            maxlength={6}
            placeholder="请输入验证码"
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            className={`px-[10px] text-[13px] ${codeBtnDisabled ? 'text-[#ccc]' : 'text-[#07c160]'}`}
            onClick={sendCode}
          >
            <Text>{codeBtnText}</Text>
          </View>
        </View>
      ) : null}

      {/* 密码 */}
      {loginType === 'password' ? (
        <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            password
            placeholder="请输入密码"
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>
      ) : null}

      {/* 登录按钮 */}
      <View
        className={`h-[48px] mt-[12px] rounded-[24px] flex items-center justify-center text-white text-[16px] bg-[#07c160] ${
          isLogging ? 'opacity-60' : ''
        }`}
        onClick={handleLogin}
      >
        <Text>{isLogging ? '登录中...' : '登录'}</Text>
      </View>

      {/* 微信登录 */}
      <View
        className="mt-[24px] text-center text-[14px] text-[#07c160]"
        onClick={handleWechatLogin}
      >
        <Text>微信一键登录</Text>
      </View>

      <View className="mt-[30px] text-center text-[11px] text-[#999]">
        <Text>登录即代表同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  )
}
