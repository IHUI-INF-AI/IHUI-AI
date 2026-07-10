import { ref, onMounted, nextTick, type Ref } from 'vue'

interface ValidatableFormElement extends HTMLFormElement {
  validate?: (callback?: (valid: boolean) => void) => Promise<boolean>
  resetFields?: () => void
  clearValidate?: () => void
}

export function useFormRef(): Ref<ValidatableFormElement | null> {
  const formRef = ref<ValidatableFormElement | null>(null)

  const patchValidate = () => {
    const el = formRef.value
    if (!el || el.validate) return
    el.validate = (callback?: (valid: boolean) => void) => {
      const valid = el.checkValidity()
      if (!valid) {
        const invalid = el.querySelector<HTMLInputElement>(':invalid')
        invalid?.focus()
        invalid?.reportValidity()
      }
      if (callback) callback(valid)
      return Promise.resolve(valid)
    }
    el.resetFields = () => {
      el.reset()
    }
    el.clearValidate = () => {
      el.querySelectorAll<HTMLElement>(':invalid').forEach(field => {
        if (field.tagName === 'INPUT' || field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') {
          field.removeAttribute('required')
          ;(field as HTMLInputElement).setCustomValidity('')
        }
      })
    }
  }

  onMounted(() => nextTick(patchValidate))

  return formRef
}
