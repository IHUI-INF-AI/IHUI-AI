const Module = require('module')
const { getDefaultConfig } = require('expo/metro-config')

// NativeWind 4.2.6 不兼容 Tailwind CSS v4(运行时抛 "NativeWind only supports Tailwind CSS v3")。
// monorepo hoisting 把 tailwindcss@4 提升到顶层,NativeWind 的 import "tailwindcss/package.json"
// 解析到 v4。apps/mobile-rn 本地装了 tailwindcss@3.4.19,这里拦截模块解析,
// 让 NativeWind 内部 require tailwindcss 时解析到本地 v3,不影响 web 端的 v4。
const tailwindV3PkgPath = require.resolve('tailwindcss/package.json', {
  paths: [__dirname],
})
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...args) {
  if (
    request === 'tailwindcss/package.json' &&
    parent &&
    parent.filename &&
    parent.filename.includes('nativewind')
  ) {
    return tailwindV3PkgPath
  }
  return originalResolveFilename.call(this, request, parent, ...args)
}

const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
