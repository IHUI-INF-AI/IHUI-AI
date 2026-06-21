<template>
    <view class="loader-container">
      <view class="loader-view">
        <!-- 72个点元素 -->
        <view 
          class="loader-dot" 
          :style="{
            '--rz': (i * 5) + 'deg',
            '--delay': (4 / 72 * i - 4) + 's',
            '--tx': txList[i],
            '--ty': tyList[i],
            '--hue': i * 5
          }" 
          v-for="i in 72" 
          :key="i"
        ></view>
      </view>
    </view>
  </template>
  
  <script setup>
  const txList = [
    '1.896em', '1.212em', '3.868em', '3.112em', '2.056em', '3.784em', '3.992em', '2.052em',
    '0.212em', '2.656em', '0.248em', '1.54em', '3.28em', '0.904em', '3.428em', '1.012em',
    '2.74em', '3.828em', '0.588em', '3.18em', '0.508em', '3.444em', '3.396em', '2.544em',
    '2.352em', '2.564em', '1.1em', '3.156em', '1.824em', '3.812em', '1.548em', '0.036em',
    '3.032em', '2.664em', '2.644em', '2.716em', '0.364em', '1.356em', '3.256em', '1.908em',
    '2.824em', '1.044em', '0.548em', '1.688em', '0.5em', '0.964em', '1.364em', '2.276em',
    '3.676em', '2.904em', '3.292em', '0.708em', '3.164em', '3.124em', '2.876em', '0.48em',
    '3.768em', '1.872em', '1.988em', '2.484em', '1.332em', '0.628em', '2.08em', '3.164em',
    '3.668em', '1.448em', '0.884em', '2.492em', '1.1em', '0.56em', '1.168em', '1.452em'
  ]
  
  const tyList = [
    '5.26em', '3.828em', '-1.82em', '0.348em', '-0.028em', '-1.452em', '4.74em', '0.628em',
    '-2.252em', '1.652em', '-0.708em', '-0.9em', '-2.468em', '4.092em', '0.556em', '-0.732em',
    '0.084em', '2.052em', '1.868em', '-0.3em', '-0.14em', '4.276em', '-1.82em', '0.692em',
    '1.22em', '1.572em', '3.1em', '2.172em', '4.532em', '3.004em', '0.276em', '4.116em',
    '1.012em', '0.66em', '1.164em', '4.044em', '3.164em', '1.732em', '-1.652em', '2.172em',
    '3.332em', '-0.284em', '1.028em', '0.14em', '-2.092em', '3.74em', '5.428em', '4.572em',
    '1.908em', '-1.828em', '1.62em', '4.788em', '5.356em', '-1.532em', '4.932em', '0.82em',
    '-1.716em', '4.428em', '3.244em', '1.204em', '0.444em', '0.836em', '2.396em', '1.332em',
    '4.86em', '3.796em', '0.972em', '5.012em', '4.932em', '0.156em', '2.068em', '-1.964em'
  ]
  </script>
  
  <style scoped>
  .loader-container {
    /* 可以在这里调整加载器的容器样式 */
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    z-index: 1010;
  }
  
  /* 引入外部样式 */
/* static/loader.css */
.loader-view {
    position: relative;
    width: 21em;
    height: 21em;
    background-color: rgba(0, 0, 0, 0);
    filter: blur(0.2em) contrast(2);
    animation: loaderSpin 3s infinite linear;
  }
  
  @keyframes loaderSpin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .loader-dot {
    position: absolute;
    left: 10em;
    top: 10em;
    width: 1em;
    height: 1em;
    background-color: hsl(var(--hue, 0), 75%, 75%);
    border-radius: 50%;
    transform: rotateZ(var(--rz, 0)) translateY(5em);
    animation: iMove 4s var(--delay, 0s) infinite ease-in-out;
  }
  
  @keyframes iMove {
    0% {
      transform: rotateZ(var(--rz, 0)) translateY(4em) translate(0, 0) scale(0);
    }
    2% {
      transform: rotateZ(var(--rz, 0)) translateY(4em) translate(0, 0) scale(1.25);
    }
    20% {
      transform: rotateZ(var(--rz, 0)) translateY(4em) translate(0, 0) scale(1.25);
    }
    90%, 100% {
      transform: rotateZ(var(--rz, 0)) translateY(4em) translate(var(--tx, 0), var(--ty, 0)) scale(0);
    }
  }
  </style>
  
