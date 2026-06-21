// 使用 Vite 的 import.meta.glob 替代 require.context
const modules = import.meta.glob("../../assets/icons/svg/*.svg", { eager: false });

const re = /([^/]+)\.svg$/;

const icons = Object.keys(modules).map((path) => {
  const match = path.match(re);
  return match ? match[1] : path;
});

export default icons;
