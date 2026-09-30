// 临时对照配置(用完即删)
const _p = require("@ihui/design-tokens/tailwind-preset")
const sharedPreset = _p.default || _p
module.exports = {
  presets: [require("nativewind/preset"), sharedPreset],
  darkMode: "class",
  content: [process.env.TW_CONTENT],
}
