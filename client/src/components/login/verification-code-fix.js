// 验证码输入框修复脚本
// 修复焦点管理、输入验证和用户体验问题

export const verificationCodeFixes = {
  // 修复验证码输入框焦点管理
  handleVerificationCodeInput(index, event, verificationCodeInputs, verificationCodeInputRefs) {
    const input = event.target
    const value = input.value

    // 只允许数字输入
    const numericValue = value.replace(/[^0-9]/g, '')

    if (numericValue !== value) {
      input.value = numericValue
      verificationCodeInputs[index] = numericValue
      return
    }

    // 更新数组
    verificationCodeInputs[index] = numericValue

    // 自动跳转到下一个输入框
    if (numericValue && index < 5) {
      const nextInput = verificationCodeInputRefs[index + 1]
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    }

    // 更新完整验证码
    this.updateFullVerificationCode(verificationCodeInputs)
  },

  // 修复键盘导航
  handleVerificationCodeKeydown(index, event, verificationCodeInputs, verificationCodeInputRefs) {
    const { key } = event

    // 退格键处理
    if (key === 'Backspace') {
      if (!verificationCodeInputs[index] && index > 0) {
        // 当前输入框为空，跳转到前一个输入框
        const prevInput = verificationCodeInputRefs[index - 1]
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      } else {
        // 清空当前输入框
        verificationCodeInputs[index] = ''
        this.updateFullVerificationCode(verificationCodeInputs)
      }
      return
    }

    // 左右箭头键导航
    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      verificationCodeInputRefs[index - 1]?.focus()
    } else if (key === 'ArrowRight' && index < 5) {
      event.preventDefault()
      verificationCodeInputRefs[index + 1]?.focus()
    }

    // 阻止非数字输入
    if (
      !/[0-9]/.test(key) &&
      !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(key)
    ) {
      event.preventDefault()
    }
  },

  // 修复粘贴处理
  handleVerificationCodePaste(event, verificationCodeInputs, verificationCodeInputRefs) {
    event.preventDefault()

    const pasteData = event.clipboardData?.getData('text') || ''
    const numericData = pasteData.replace(/[^0-9]/g, '').slice(0, 6)

    if (numericData.length > 0) {
      // 分配粘贴的数字到各个输入框
      for (let i = 0; i < 6; i++) {
        verificationCodeInputs[i] = numericData[i] || ''
        const input = verificationCodeInputRefs[i]
        if (input) {
          input.value = verificationCodeInputs[i]
        }
      }

      // 焦点移动到最后一个有值的输入框或下一个空输入框
      const lastFilledIndex = Math.min(numericData.length - 1, 5)
      const nextEmptyIndex = Math.min(numericData.length, 5)
      const targetIndex = numericData.length === 6 ? lastFilledIndex : nextEmptyIndex

      verificationCodeInputRefs[targetIndex]?.focus()
      this.updateFullVerificationCode(verificationCodeInputs)
    }
  },

  // 更新完整验证码
  updateFullVerificationCode(verificationCodeInputs) {
    const fullCode = verificationCodeInputs.join('')
    // 这里应该更新到对应的表单字段
    // phoneForm.verificationCode = fullCode;
    return fullCode
  },

  // 验证码输入框焦点处理
  handleVerificationCodeFocus(index, verificationCodeInputRefs) {
    const input = verificationCodeInputRefs[index]
    if (input) {
      // 选中输入框中的所有内容，方便用户重新输入
      setTimeout(() => {
        input.select()
      }, 0)
    }
  },

  // 清空所有验证码输入框
  clearVerificationCode(verificationCodeInputs, verificationCodeInputRefs) {
    for (let i = 0; i < 6; i++) {
      verificationCodeInputs[i] = ''
      const input = verificationCodeInputRefs[i]
      if (input) {
        input.value = ''
      }
    }
    // 焦点回到第一个输入框
    verificationCodeInputRefs[0]?.focus()
  },
}
