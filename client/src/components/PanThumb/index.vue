<template>
  <div
    :style="{ zIndex: zIndex, height: height, width: width }"
    class="pan-item"
  >
    <div class="pan-info">
      <div class="pan-info-roles-container">
        <slot />
      </div>
    </div>
    <div :style="{ backgroundImage: `url(${image})` }" class="pan-thumb"></div>
  </div>
</template>

<script>
export default {
  name: "PanThumb",
  props: {
    image: {
      type: String,
      required: true,
    },
    zIndex: {
      type: Number,
      default: 1,
    },
    width: {
      type: String,
      default: "150px",
    },
    height: {
      type: String,
      default: "150px",
    },
  },
};
</script>

<style scoped>
.pan-item {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  display: inline-block;
  position: relative;
  cursor: default;
  box-shadow: var(--global-box-shadow);
}

.pan-info-roles-container {
  padding: 20px;
  text-align: center;
}

.pan-thumb {
  width: 100%;
  height: 100%;
  background-position: center center;
  background-size: cover;
  border-radius: 50%;
  overflow: hidden;
  position: absolute;
  transform-origin: 95% 40%;
  transition: all 0.3s ease-in-out;
}

/* .pan-thumb:after {
  content: '';
  width: 8px;
  height: 8px;
  position: absolute;
  border-radius: 50%;
  top: 40%;
  left: 95%;
  margin: -4px 0 0 -4px;
  background: radial-gradient(ellipse at center, rgba(14, 14, 14, 1) 0%, rgba(125, 126, 125, 1) 100%);
  outline: 1px solid var(--color-white-90);
  outline-offset: 0;
  box-shadow: none;
} */

.pan-info {
  position: absolute;
  width: inherit;
  height: inherit;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 0 0 5px var(--color-black-5);
}

.pan-info h3 {
  /* 颜色由主题类控制 */
  text-transform: uppercase;
  position: relative;
  letter-spacing: 2px;
  font-size: 18px;
  margin: 0 60px;
  padding: 22px 0 0;
  height: 85px;
  font-family: inherit;
}

.pan-info p {
  /* 颜色由主题类控制 */
  padding: 10px 5px;
  font-style: italic;
  margin: 0 30px;
  font-size: 12px;
  border-top: var(--unified-border);
}

.pan-info p a {
  display: block;

  /* 颜色由主题类控制 */
  width: 80px;
  height: 80px;
  background: var(--color-white-30);
  border-radius: 50%;
  font-style: normal;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 1px;
  padding-top: 24px;
  margin: 7px auto 0;
  font-family: inherit;
  opacity: 0;
  transition:
    transform 0.3s ease-in-out 0.2s,
    opacity 0.3s ease-in-out 0.2s,
    background 0.2s linear 0s;
  transform: translateX(60px) rotate(90deg);
}

.pan-info p a:hover {
  background: var(--color-white-50);
}

.pan-item:hover .pan-thumb {
  transform: rotate(-110deg);
}

.pan-item:hover .pan-info p a {
  opacity: 1;
  transform: translateX(0) rotate(0deg);
}
</style>
