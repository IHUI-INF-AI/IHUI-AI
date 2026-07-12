import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { updatePassword } from '@/api'

export default function Password() {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  async function onSubmit() {
    if (!oldPwd) {
      return Taro.showToast({ title: '请输入旧密码', icon: 'none' })
    }
    if (newPwd.length < 6) {
      return Taro.showToast({ title: '新密码至少6位', icon: 'none' })
    }
    if (newPwd !== confirmPwd) {
      return Taro.showToast({ title: '两次密码不一致', icon: 'none' })
    }
    try {
      await updatePassword(oldPwd, newPwd)
      Taro.showToast({ title: '修改成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      console.error('[user/password] 修改密码 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">旧密码</Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder="请输入旧密码"
            value={oldPwd}
            onInput={(e) => setOldPwd(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">新密码</Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder="请输入新密码"
            value={newPwd}
            onInput={(e) => setNewPwd(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">确认密码</Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder="请再次输入新密码"
            value={confirmPwd}
            onInput={(e) => setConfirmPwd(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          oldPwd && newPwd && confirmPwd ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!oldPwd || !newPwd || !confirmPwd}
        onClick={onSubmit}
      >
        确认修改
      </Button>
    </View>
  )
}
