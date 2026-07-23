module.exports = function (api) {
  api.cache(true)
  return {
    // nativewind/babel 返回 { plugins: [...] } (preset 格式),必须放 presets 而非 plugins。
    // Babel 7.29+ 严格检查 plugin 返回值,放 plugins 会报 ".plugins is not a valid Plugin property"。
    presets: ['babel-preset-expo', 'nativewind/babel'],
  }
}
