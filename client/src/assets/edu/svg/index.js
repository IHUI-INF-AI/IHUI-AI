import SvgIcon from "@/components/SvgIcon"
// 全局注册 SvgIcon 组件（组件用 component 注册，插件才用 use）
export default (app) => {
  const requireAll = requireContext => requireContext.keys().map(requireContext)
  const req = require.context("@/assets/svg", false, /\.svg$/);
  requireAll(req);
  app.component("SvgIcon", SvgIcon);
};

