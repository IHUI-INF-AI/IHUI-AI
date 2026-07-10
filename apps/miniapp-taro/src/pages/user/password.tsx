import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { updatePassword } from '@/api'

export default function Password() {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  async function onSubmit() {
    if (newPwd !== confirmPwd) {
      return Taro.showToast({ title: '两次密码不一致', icon: 'none' })
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/.test(newPwd)) {
      return Taro.showToast({ title: '密码格式错误', icon: 'none' })
    }
    try {
      await updatePassword(oldPwd, newPwd)
      Taro.showToast({ title: '修改成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {}
  }

  const inputRows = [
    { label: '原密码', value: oldPwd, setter: setOldPwd, placeholder: '请输入原密码' },
    { label: '新密码', value: newPwd, setter: setNewPwd, placeholder: '请输入新密码' },
    { label: '确认密码', value: confirmPwd, setter: setConfirmPwd, placeholder: '请再次输入新密码' },
  ]

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] px-[16px] bg-white rounded-[8px]">
        {inputRows.map((row, idx) => (
          <View
            key={row.label}
            className={`flex items-center py-[16px] ${
              idx < inputRows.length - 1 ? 'border-b-[1px] border-solid border-[#f5f5f5]' : ''
            }`}
          >
            <Text className="w-[80px] text-[14px] text-[#333]">{row.label}</Text>
            <Input
              className="flex-1 text-[14px]"
              password
              placeholder={row.placeholder}
              value={row.value}
              onInput={e => row.setter(e.detail.value)}
            />
          </View>
        ))}
      </View>
      <View className="px-[16px] mt-[8px]">
        <Text className="text-[11px] text-[#999]">密码长度8-20位，需包含字母和数字</Text>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          oldPwd && newPwd ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!oldPwd || !newPwd}
        onClick={onSubmit}
      >
        确认修改
      </Button>
    </View>
  )
}
