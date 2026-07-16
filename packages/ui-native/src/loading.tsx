import type { ComponentProps } from 'react'
import { ActivityIndicator } from 'react-native'

type LoadingSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<LoadingSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

export interface LoadingProps extends Omit<ComponentProps<typeof ActivityIndicator>, 'size'> {
  size?: LoadingSize
}

export function Loading({ size = 'md', ...props }: LoadingProps) {
  return <ActivityIndicator size={sizeMap[size] ?? 24} {...props} />
}

export const Spinner = Loading
