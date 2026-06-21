import { ref, type Ref, type ComputedRef, computed } from 'vue'

export function useToggle(initialValue = false): [Ref<boolean>, (value?: boolean) => void] {
  const value = ref(initialValue)

  const toggle = (newValue?: boolean) => {
    if (newValue !== undefined) {
      value.value = newValue
    } else {
      value.value = !value.value
    }
  }

  return [value, toggle]
}

export function useBoolean(initialValue = false): {
  value: Ref<boolean>
  setTrue: () => void
  setFalse: () => void
  toggle: () => void
  set: (value: boolean) => void
} {
  const value = ref(initialValue)

  const setTrue = () => {
    value.value = true
  }

  const setFalse = () => {
    value.value = false
  }

  const toggle = () => {
    value.value = !value.value
  }

  const set = (newValue: boolean) => {
    value.value = newValue
  }

  return {
    value,
    setTrue,
    setFalse,
    toggle,
    set,
  }
}

export function useCounter(initialValue = 0, options: { min?: number; max?: number } = {}): {
  count: Ref<number>
  inc: (delta?: number) => void
  dec: (delta?: number) => void
  set: (value: number) => void
  reset: () => void
} {
  const { min, max } = options
  const count = ref(initialValue)

  const clamp = (value: number): number => {
    if (min !== undefined && value < min) return min
    if (max !== undefined && value > max) return max
    return value
  }

  const inc = (delta = 1) => {
    count.value = clamp(count.value + delta)
  }

  const dec = (delta = 1) => {
    count.value = clamp(count.value - delta)
  }

  const set = (value: number) => {
    count.value = clamp(value)
  }

  const reset = () => {
    count.value = initialValue
  }

  return {
    count,
    inc,
    dec,
    set,
    reset,
  }
}

export function useClamp(value: number, min: number, max: number): ComputedRef<number> {
  const _value = ref(value)

  return computed({
    get: () => Math.min(Math.max(_value.value, min), max),
    set: (newValue) => {
      _value.value = Math.min(Math.max(newValue, min), max)
    },
  })
}

export function useCycleList<T>(list: T[], initialValue?: T): {
  state: Ref<T>
  index: Ref<number>
  next: () => void
  prev: () => void
  go: (index: number) => void
} {
  const index = ref(
    initialValue !== undefined ? list.indexOf(initialValue) : 0
  )

  const state = computed({
    get: () => list[index.value] ?? list[0],
    set: (value) => {
      const newIndex = list.indexOf(value)
      if (newIndex !== -1) {
        index.value = newIndex
      }
    },
  }) as unknown as Ref<T>

  const next = () => {
    index.value = (index.value + 1) % list.length
  }

  const prev = () => {
    index.value = (index.value - 1 + list.length) % list.length
  }

  const go = (i: number) => {
    index.value = ((i % list.length) + list.length) % list.length
  }

  return {
    state,
    index,
    next,
    prev,
    go,
  }
}

export function useStep(steps: number, initialValue = 0): {
  current: Ref<number>
  next: () => void
  prev: () => void
  go: (step: number) => void
  isFirst: Ref<boolean>
  isLast: Ref<boolean>
  hasNext: Ref<boolean>
  hasPrev: Ref<boolean>
} {
  const current = ref(initialValue)

  const isFirst = computed(() => current.value === 0)
  const isLast = computed(() => current.value === steps - 1)
  const hasNext = computed(() => current.value < steps - 1)
  const hasPrev = computed(() => current.value > 0)

  const next = () => {
    if (current.value < steps - 1) {
      current.value++
    }
  }

  const prev = () => {
    if (current.value > 0) {
      current.value--
    }
  }

  const go = (step: number) => {
    if (step >= 0 && step < steps) {
      current.value = step
    }
  }

  return {
    current,
    next,
    prev,
    go,
    isFirst: isFirst as unknown as Ref<boolean>,
    isLast: isLast as unknown as Ref<boolean>,
    hasNext: hasNext as unknown as Ref<boolean>,
    hasPrev: hasPrev as unknown as Ref<boolean>,
  }
}
