declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.svg' {
  import type * as React from 'react'
  import type * as ReactNativeSvg from 'react-native-svg'
  export const ReactComponent: React.FC<ReactNativeSvg.SvgProps>
  const src: string
  export default src
}
