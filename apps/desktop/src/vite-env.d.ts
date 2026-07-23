/// <reference types="vite/client" />

declare module '*.css?url' {
  const src: string
  export default src
}
