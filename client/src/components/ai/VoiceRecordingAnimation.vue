<template>
  <Teleport to="body">
    <div v-if="shouldShow" ref="containerRef" class="voice-recording-animation" :key="animationKey">
      <div class="grid">
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
        <div class="area"></div>
      </div>
      <label class="wrap" @click.stop="handleLabelClick">
          <input
            ref="checkboxRef"
            type="checkbox"
            :checked="isCheckboxChecked"
            :disabled="isProgrammaticChangeRef"
            @click="handleClick"
            @change="handleChange"
            :style="{ pointerEvents: isProgrammaticChangeRef ? 'none' : 'auto' }"
          />
          <div class="card" :class="{ 'is-cancelled': !isCheckboxChecked }">
            <div class="wave"></div>
            <div class="outline"></div>
            <div class="circle-1">
              <div class="lines">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 463 462"
                  stroke="currentColor"
                  height="462"
                  width="463"
                  mask="url(#lineMask)"
                >
                  <defs>
                    <radialGradient
                      id="lineMaskGradient"
                      cx="231.5"
                      cy="231"
                      r="231"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stop-color="white" stop-opacity="1" />
                      <stop offset="35%" stop-color="white" stop-opacity="1" />
                      <stop offset="50%" stop-color="white" stop-opacity="0.95" />
                      <stop offset="65%" stop-color="white" stop-opacity="0.8" />
                      <stop offset="75%" stop-color="white" stop-opacity="0.6" />
                      <stop offset="85%" stop-color="white" stop-opacity="0.4" />
                      <stop offset="92%" stop-color="white" stop-opacity="0.2" />
                      <stop offset="97%" stop-color="white" stop-opacity="0.1" />
                      <stop offset="100%" stop-color="white" stop-opacity="0" />
                    </radialGradient>
                    <mask id="lineMask">
                      <rect x="0" y="0" width="463" height="462" fill="url(#lineMaskGradient)" />
                    </mask>
                  </defs>
                  <path stroke-linecap="round" d="M231.5 97V5" style="

--i: 1"></path>
                  <path
                    stroke-linecap="round"
                    d="M239.914 97.2644L245.691 5.44598"
                    style="

--i: 2"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M248.295 98.0566L259.825 6.78207"
                    style="

--i: 3"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M256.609 99.3735L273.848 9.00308"
                    style="

--i: 4"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M264.824 101.21L287.704 12.1002"
                    style="

--i: 5"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M272.908 103.558L301.338 16.0612"
                    style="

--i: 6"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M280.829 106.41L314.696 20.8705"
                    style="

--i: 7"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M288.554 109.753L327.726 26.5091"
                    style="

--i: 8"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M296.055 113.575L340.376 32.9547"
                    style="

--i: 9"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M303.301 117.86L352.597 40.1819"
                    style="

--i: 10"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M310.263 122.592L364.339 48.1622"
                    style="

--i: 11"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M316.915 127.751L375.558 56.864"
                    style="

--i: 12"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M323.229 133.318L386.208 66.2531"
                    style="

--i: 13"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M329.182 139.271L396.247 76.2924"
                    style="

--i: 14"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M334.749 145.585L405.636 86.9422"
                    style="

--i: 15"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M339.908 152.237L414.338 98.1605"
                    style="

--i: 16"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M344.64 159.199L422.318 109.903"
                    style="

--i: 17"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M348.925 166.445L429.545 122.124"
                    style="

--i: 18"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M352.747 173.946L435.991 134.774"
                    style="

--i: 19"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M356.09 181.671L441.629 147.804"
                    style="

--i: 20"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M358.942 189.592L446.439 161.162"
                    style="

--i: 21"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M361.29 197.676L450.4 174.796"
                    style="

--i: 22"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M363.126 205.891L453.497 188.652"
                    style="

--i: 23"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M364.443 214.205L455.718 202.675"
                    style="

--i: 24"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M365.236 222.586L457.054 216.809"
                    style="

--i: 25"
                  ></path>
                  <path stroke-linecap="round" d="M365.5 231L457.5 231" style="

--i: 26"></path>
                  <path
                    stroke-linecap="round"
                    d="M365.236 239.414L457.054 245.191"
                    style="

--i: 27"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M364.443 247.795L455.718 259.325"
                    style="

--i: 28"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M363.126 256.109L453.497 273.348"
                    style="

--i: 29"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M361.29 264.324L450.4 287.204"
                    style="

--i: 30"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M358.942 272.408L446.439 300.838"
                    style="

--i: 31"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M356.09 280.329L441.629 314.196"
                    style="

--i: 32"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M352.747 288.054L435.991 327.226"
                    style="

--i: 33"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M348.925 295.555L429.545 339.876"
                    style="

--i: 34"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M344.64 302.801L422.318 352.097"
                    style="

--i: 35"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M339.908 309.763L414.338 363.839"
                    style="

--i: 36"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M334.749 316.415L405.636 375.058"
                    style="

--i: 37"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M329.182 322.729L396.247 385.708"
                    style="

--i: 38"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M323.229 328.682L386.208 395.747"
                    style="

--i: 39"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M316.915 334.249L375.558 405.136"
                    style="

--i: 40"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M310.263 339.408L364.339 413.838"
                    style="

--i: 41"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M303.301 344.14L352.597 421.818"
                    style="

--i: 42"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M296.055 348.425L340.376 429.045"
                    style="

--i: 43"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M288.554 352.247L327.726 435.491"
                    style="

--i: 44"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M280.829 355.59L314.696 441.129"
                    style="

--i: 45"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M272.908 358.442L301.338 445.939"
                    style="

--i: 46"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M264.824 360.79L287.704 449.9"
                    style="

--i: 47"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M256.609 362.626L273.848 452.997"
                    style="

--i: 48"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M248.295 363.943L259.825 455.218"
                    style="

--i: 49"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M239.914 364.736L245.691 456.554"
                    style="

--i: 50"
                  ></path>
                  <path stroke-linecap="round" d="M231.5 365L231.5 457" style="

--i: 51"></path>
                  <path
                    stroke-linecap="round"
                    d="M223.086 364.736L217.309 456.554"
                    style="

--i: 52"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M214.705 363.943L203.175 455.218"
                    style="

--i: 53"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M206.391 362.626L189.152 452.997"
                    style="

--i: 54"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M198.176 360.79L175.296 449.9"
                    style="

--i: 55"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M190.092 358.442L161.662 445.939"
                    style="

--i: 56"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M182.171 355.59L148.304 441.129"
                    style="

--i: 57"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M174.446 352.247L135.274 435.491"
                    style="

--i: 58"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M166.945 348.425L122.624 429.045"
                    style="

--i: 59"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M159.699 344.14L110.403 421.818"
                    style="

--i: 60"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M152.737 339.408L98.6605 413.838"
                    style="

--i: 61"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M146.085 334.249L87.4422 405.136"
                    style="

--i: 62"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M139.771 328.682L76.7924 395.747"
                    style="

--i: 63"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M133.818 322.729L66.7531 385.708"
                    style="

--i: 64"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M128.251 316.415L57.364 375.058"
                    style="

--i: 65"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M123.092 309.763L48.6622 363.839"
                    style="

--i: 66"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M118.36 302.801L40.6819 352.097"
                    style="

--i: 67"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M114.075 295.555L33.4547 339.876"
                    style="

--i: 68"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M110.253 288.054L27.0091 327.226"
                    style="

--i: 69"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M106.91 280.329L21.3705 314.196"
                    style="

--i: 70"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M104.058 272.408L16.5612 300.838"
                    style="

--i: 71"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M101.71 264.324L12.6002 287.204"
                    style="

--i: 72"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M99.8735 256.109L9.50308 273.348"
                    style="

--i: 73"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M98.5566 247.795L7.28207 259.325"
                    style="

--i: 74"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M97.7644 239.414L5.94596 245.191"
                    style="

--i: 75"
                  ></path>
                  <path stroke-linecap="round" d="M97.5 231H5.5" style="

--i: 76"></path>
                  <path
                    stroke-linecap="round"
                    d="M97.7644 222.586L5.94598 216.809"
                    style="

--i: 77"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M98.5566 214.205L7.28207 202.675"
                    style="

--i: 78"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M99.8735 205.891L9.50308 188.652"
                    style="

--i: 79"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M101.71 197.676L12.6002 174.796"
                    style="

--i: 80"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M104.058 189.592L16.5612 161.162"
                    style="

--i: 81"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M106.91 181.671L21.3705 147.804"
                    style="

--i: 82"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M110.253 173.946L27.0091 134.774"
                    style="

--i: 83"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M114.075 166.445L33.4547 122.124"
                    style="

--i: 84"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M118.36 159.199L40.6819 109.903"
                    style="

--i: 85"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M123.092 152.237L48.6622 98.1605"
                    style="

--i: 86"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M128.251 145.585L57.364 86.9422"
                    style="

--i: 87"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M133.818 139.271L66.7531 76.2924"
                    style="

--i: 88"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M139.771 133.318L76.7923 66.2531"
                    style="

--i: 89"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M146.085 127.751L87.4422 56.864"
                    style="

--i: 90"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M152.737 122.592L98.6605 48.1622"
                    style="

--i: 91"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M159.699 117.86L110.403 40.1819"
                    style="

--i: 92"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M166.945 113.575L122.624 32.9547"
                    style="

--i: 93"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M174.446 109.753L135.274 26.5091"
                    style="

--i: 94"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M182.171 106.41L148.304 20.8705"
                    style="

--i: 95"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M190.092 103.558L161.662 16.0612"
                    style="

--i: 96"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M198.176 101.21L175.296 12.1002"
                    style="

--i: 97"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M206.391 99.3735L189.152 9.00308"
                    style="

--i: 98"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M214.705 98.0566L203.175 6.78207"
                    style="

--i: 99"
                  ></path>
                  <path
                    stroke-linecap="round"
                    d="M223.086 97.2644L217.309 5.44595"
                    style="

--i: 100"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="circle-2">
              <div class="bg"></div>
            </div>
            <div class="icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="icon-1"
              >
                <defs>
                  <!-- 亮色模式：使用黑灰色渐变，确保高对比度 -->
                  <linearGradient y2="100%" x2="0%" y1="0%" x1="0%" id="grad-1">
                    <stop stop-color="var(--color-dark-bg-6)" offset="0%"></stop>
                    <stop stop-color="var(--color-dark-bg-3)" offset="50%"></stop>
                    <stop stop-color="var(--color-dark-bg-1)" offset="100%"></stop>
                  </linearGradient>
                  <!-- 暗色模式：使用亮灰色渐变 -->
                  <linearGradient y2="100%" x2="0%" y1="0%" x1="0%" id="grad-1-dark">
                    <stop stop-color="var(--ai-gray-1)" offset="0%"></stop>
                    <stop stop-color="var(--ai-gray-2)" offset="50%"></stop>
                    <stop stop-color="var(--ai-gray-3)" offset="100%"></stop>
                  </linearGradient>
                </defs>
                <path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3zM5 12a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7.001 7.001 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-2.07A7.001 7.001 0 0 1 5 12z"
                  clip-rule="evenodd"
                  fill-rule="evenodd"
                  fill="var(--color-dark-bg-6)"
                ></path>
              </svg>

              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="white"
                viewBox="0 0 800 800"
                class="icon-2"
              >
                <defs>
                  <filter id="cut-stroke-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feMorphology operator="dilate" radius="2" in="SourceAlpha" result="thicken" />
                    <feFlood flood-color="var(--el-color-primary)" result="black" />
                    <feComposite in="black" in2="thicken" operator="in" result="outline" />
                    <feComposite in="SourceGraphic" in2="outline" operator="over" />
                  </filter>
                </defs>
                <path
                  d="M623.961 465.502C630.134 444.383 633.336 422.34 633.333 400C633.333 391.16 629.822 382.681 623.57 376.43C617.319 370.179 608.841 366.667 600 366.667C591.16 366.667 582.681 370.179 576.43 376.43C570.179 382.681 566.667 391.16 566.667 400C566.667 402.679 566.602 405.351 566.474 408.015L623.961 465.502ZM546.326 479.791C538.769 493.651 529.215 506.487 517.851 517.851C486.595 549.107 444.203 566.667 400 566.667C355.797 566.667 313.405 549.107 282.149 517.851C250.893 486.595 233.333 444.203 233.333 400C233.333 391.16 229.822 382.681 223.57 376.43C217.319 370.179 208.841 366.667 200 366.667C191.16 366.667 182.681 370.179 176.43 376.43C170.179 382.681 166.667 391.16 166.667 400C166.659 456.117 186.873 510.358 223.605 552.783C260.337 595.208 311.126 622.977 366.667 631V700C366.667 708.841 370.179 717.319 376.43 723.57C382.681 729.822 391.16 733.333 400 733.333C408.841 733.333 417.319 729.822 423.57 723.57C429.822 717.319 433.333 708.841 433.333 700V631C488.874 622.977 539.663 595.208 576.395 552.783C583.12 545.015 589.292 536.851 594.887 528.352L546.326 479.791ZM500 341.541V166.667C500 140.145 489.464 114.71 470.711 95.9561C451.957 77.2024 426.522 66.6667 400 66.6667C373.478 66.6667 348.043 77.2024 329.289 95.9561C315.947 109.299 306.764 126.024 302.576 144.116L500 341.541ZM300 233.464L495.664 429.128C490.926 444.686 482.421 459.001 470.711 470.711C451.957 489.464 426.522 500 400 500C373.478 500 348.043 489.464 329.289 470.711C310.536 451.957 300 426.522 300 400V233.464Z"
                  clip-rule="evenodd"
                  fill-rule="evenodd"
                ></path>
                <!-- 黑色描边 -->
                <path
                  stroke-linecap="round"
                  stroke-width="66"
                  stroke="var(--el-text-color-primary)"
                  d="M150.368 125.871L667.5 643.002"
                  class="cut"
                  fill="none"
                ></path>
                <!-- 白色主体 -->
                <path
                  stroke-linecap="round"
                  stroke-width="60"
                  stroke="var(--el-bg-color-page)"
                  d="M150.368 125.871L667.5 643.002"
                  class="cut"
                  fill="none"
                ></path>
              </svg>
            </div>
            <footer>
              <p>
                <span class="bold" style="

--i: 1">{{ t('hardcoded.voice.recording.animation.智汇AI') }}</span>
                <span style="

--i: 2">{{ t('hardcoded.voice.recording.animation.提供') }}</span>
                <span style="

--i: 3">{{ t('hardcoded.voice.recording.animation.服务') }}</span>
              </p>
              <p style="margin-top: 4px">
                <span style="

--i: 4">{{ t('hardcoded.voice.recording.animation.点击') }}</span>
                <span style="

--i: 5">{{ t('hardcoded.voice.recording.animation.麦克风') }}</span>
                <span style="

--i: 6">{{ t('hardcoded.voice.recording.animation.图标') }}</span>
                <span style="

--i: 7">{{ t('hardcoded.voice.recording.animation.完成') }}</span>
                <span style="

--i: 8">{{ t('hardcoded.voice.recording.animation.录音') }}</span>
              </p>
            </footer>
          </div>
        </label>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

import { logger } from '../../utils/logger'

/**
 * 录音状态播放组件 - 状态管理说明
 * 
 * 组件状态流程：
 * 1. 初始状态：窗口隐藏，checkbox 未选中
 * 2. 开始录音（isRecording: true）：
 *    - 显示窗口（shouldShow = true）
 *    - checkbox 选中（isCheckboxChecked = true）
 *    - 显示麦克风图标（icon-1），隐藏取消图标（icon-2）
 *    - 运行动画效果（光芒四射、圆圈动画等）
 * 3. 用户点击停止（点击麦克风图标）：
 *    - 设置 userClickedStop = true（防止 watch 干扰）
 *    - 设置 isClosing = true（防止窗口被重新打开）
 *    - checkbox 取消选中（isCheckboxChecked = false）
 *    - 显示取消图标（icon-2），隐藏麦克风图标（icon-1）
 *    - 发送 stop 事件给父组件
 *    - 设置 1 秒定时器，1 秒后关闭窗口
 * 4. 结束状态（1 秒后）：
 *    - 隐藏窗口（shouldShow = false）
 *    - 重置所有标志
 * 
 * 关键状态变量：
 * - shouldShow: 控制窗口显示/隐藏
 * - isCheckboxChecked: 控制 checkbox 选中状态（影响图标显示）
 * - userClickedStop: 标志用户已点击停止，防止 watch 干扰定时器
 * - isClosing: 标志窗口正在关闭，防止被重新打开
 * - hideTimeout: 关闭窗口的定时器（1秒延迟）
 */

const props = defineProps<{
  isRecording: boolean // 父组件传入的录音状态
}>()

const emit = defineEmits<{
  stop: [data?: { audioUrl: string; duration: number }] // 发送停止录音事件，可选传递录音数据
}>()

// ========== 响应式状态变量 ==========
const checkboxRef = ref<HTMLInputElement | null>(null) // checkbox DOM 引用
const containerRef = ref<HTMLElement | null>(null) // 容器 DOM 引用，用于检测外部点击
const animationKey = ref(0) // 用于强制重新渲染的 key
const shouldShow = ref(false) // 控制窗口显示/隐藏
const isCheckboxChecked = ref(false) // 控制 checkbox 选中状态（影响图标显示）
const hideTimeout = ref<ReturnType<typeof setTimeout> | null>(null) // 关闭窗口的定时器
const stopAnimationTimeout = ref<ReturnType<typeof setTimeout> | null>(null) // 停止动画的定时器（未使用）
let checkboxRafId: number | null = null
const userClickedStop = ref(false) // 标志：用户是否点击了停止按钮（防止 watch 干扰定时器）
const isClosing = ref(false) // 标志：窗口是否正在关闭（防止被重新打开）
const recordingStartTime = ref<number>(0) // 录音开始时间戳

// ========== 监听 isRecording 变化 ==========
// 当父组件的 isRecording 状态改变时，同步更新组件状态
watch(
  () => props.isRecording,
  (newVal: boolean) => {
    // ========== 状态 1: 开始录音（isRecording: true）==========
    if (newVal === true) {
      logger.info('[VoiceRecordingAnimation] Watch: isRecording changed to true')
      logger.info(
        '[VoiceRecordingAnimation] Current state - isClosing:',
        isClosing.value,
        'userClickedStop:',
        userClickedStop.value
      )

      // 如果窗口正在关闭，不要重新打开
      if (isClosing.value) {
        logger.info('[VoiceRecordingAnimation] Window is closing, ignoring isRecording=true')
        return
      }

      // 如果用户已经点击了停止，不要清除关闭定时器
      if (userClickedStop.value && hideTimeout.value) {
        logger.info('[VoiceRecordingAnimation] User clicked stop, preserving hideTimeout, ignoring new recording')
        return
      }

      // 清除所有定时器（只有在不是用户停止的情况下）
      if (hideTimeout.value) {
        logger.info('[VoiceRecordingAnimation] Clearing hideTimeout')
        clearTimeout(hideTimeout.value)
        hideTimeout.value = null
      }
      if (stopAnimationTimeout.value) {
        clearTimeout(stopAnimationTimeout.value)
        stopAnimationTimeout.value = null
      }

      // 重置状态
      // 清除所有关闭相关的标志，准备开始新的录音
      userClickedStop.value = false
      isClosing.value = false // 重置关闭标志
      animationKey.value = Date.now() + Math.random()
      shouldShow.value = true
      isCheckboxChecked.value = true
      recordingStartTime.value = Date.now() // 记录录音开始时间

      logger.info('[VoiceRecordingAnimation] Window shown, shouldShow:', shouldShow.value)

      // 同步 checkbox 状态
      nextTick(() => {
        if (checkboxRef.value) {
          isProgrammaticChange = true
          isProgrammaticChangeRef.value = true
          checkboxRef.value.checked = true
          setTimeout(() => {
            isProgrammaticChange = false
            isProgrammaticChangeRef.value = false
          }, 300)
        }
      })
    }

    // ========== 状态 2: 停止录音（isRecording: false）==========
    // 注意：窗口关闭由 stopRecordingDirectly 中的定时器处理（1秒延迟）
    // 这里只处理特殊情况（备用定时器）
    if (newVal === false) {
      // 如果用户已经点击了停止按钮，绝对不要干扰关闭定时器
      if (userClickedStop.value) {
        logger.info(
          '[VoiceRecordingAnimation] isRecording=false, userClickedStop=true, preserving hideTimeout:',
          hideTimeout.value
        )
        // 确保不干扰 hideTimeout，也不清除它
        // 定时器已经在 stopRecordingDirectly 中设置好了，这里只需要保持它运行
        // 但是，如果定时器还没有设置（可能因为时序问题），我们在这里也设置一个备用定时器
        if (!hideTimeout.value) {
          logger.info('[VoiceRecordingAnimation] hideTimeout not set, setting backup timer')
          const closeWindow = () => {
            logger.info('[VoiceRecordingAnimation] Backup timer: Closing window')
            shouldShow.value = false
            animationKey.value = Date.now() + Math.random()
            userClickedStop.value = false
            isClosing.value = false
            hideTimeout.value = null
            logger.info(
              '[VoiceRecordingAnimation] Backup timer closed, shouldShow:',
              shouldShow.value
            )
          }
          hideTimeout.value = setTimeout(closeWindow, 1000) // 1秒后关闭
          logger.info('[VoiceRecordingAnimation] Backup timer set, hideTimeout:', hideTimeout.value)
        } else {
          logger.info('[VoiceRecordingAnimation] hideTimeout already set, preserving it')
          // 确保定时器不会被清除 - 再次验证定时器存在
          const currentTimeout = hideTimeout.value
          if (currentTimeout) {
            logger.info('[VoiceRecordingAnimation] ✓ hideTimeout preserved, will close in 1 second')
          }
        }
        // 绝对不要在这里做任何可能影响定时器的操作（如 clearTimeout）
        return
      }
      // 如果用户没有点击停止按钮，保持窗口打开
      // 这种情况不应该发生，因为停止录音应该总是通过用户点击触发
      logger.info(
        '[VoiceRecordingAnimation] isRecording=false, userClickedStop=false, keeping window open'
      )
    }
  }
)

// ========== 点击外部区域关闭窗口 ==========
const handleClickOutside = (event: MouseEvent) => {
  // 只有在窗口显示时才处理外部点击
  if (!shouldShow.value || isClosing.value) {
    return
  }

  try {
    const target = event.target as Node | null
    if (!target) {
      return
    }

    // 检查点击是否在容器内
    const container = containerRef.value
    if (!container) {
      return
    }

    // 如果点击在容器内部，不关闭
    if (container === target || container.contains(target)) {
      return
    }

    // 如果正在处理点击，忽略外部点击（避免与内部点击冲突）
    if (isHandlingClick) {
      return
    }

    logger.info('[VoiceRecordingAnimation] Clicked outside, canceling recording and closing window')

    // 点击外部区域，取消录音并关闭窗口
    // 创建一个模拟事件，因为 stopRecordingDirectly 需要一个 MouseEvent
    const syntheticEvent = new MouseEvent('click', {
      bubbles: false,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY
    })

    // 如果正在录音，停止录音
    if (props.isRecording) {
      stopRecordingDirectly(syntheticEvent)
    } else {
      // 如果没有在录音，直接关闭窗口
      shouldShow.value = false
      isClosing.value = true
      animationKey.value = Date.now() + Math.random()
    }
  } catch (error) {
    logger.error('[VoiceRecordingAnimation] Error handling outside click:', error)
  }
}

// 组件挂载时同步状态和添加外部点击监听
onMounted(() => {
  if (import.meta.env.DEV) {
    logger.info('[VoiceRecordingAnimation] Mounted, isRecording:', props.isRecording)
  }
  
  // 添加外部点击监听器
  // 使用捕获阶段，确保在事件冒泡前检查
  document.addEventListener('click', handleClickOutside, true)
  
  if (props.isRecording) {
    shouldShow.value = true
    isCheckboxChecked.value = true
    animationKey.value = Date.now() + Math.random()
    // 等待 DOM 渲染后设置 checkbox
    nextTick(() => {
      requestAnimationFrame(() => {
        if (checkboxRef.value) {
          // 设置标志，表示这是程序自动修改，不是用户点击
          isProgrammaticChange = true
          isProgrammaticChangeRef.value = true
          checkboxRef.value.checked = true
          // 延迟重置标志，确保 change 事件被忽略
          setTimeout(() => {
            isProgrammaticChange = false
            isProgrammaticChangeRef.value = false
          }, 300)
        }
      })
    })
  }
})

// 组件卸载时清理定时器和事件监听器
onUnmounted(() => {
  try {
    // 移除外部点击监听器
    document.removeEventListener('click', handleClickOutside, true)
    
    if (hideTimeout.value) {
      clearTimeout(hideTimeout.value)
      hideTimeout.value = null
    }
    if (stopAnimationTimeout.value) {
      clearTimeout(stopAnimationTimeout.value)
      stopAnimationTimeout.value = null
    }
    if (checkboxRafId !== null) {
      cancelAnimationFrame(checkboxRafId)
      checkboxRafId = null
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.error('[VoiceRecordingAnimation] Error cleaning up timers:', error)
    }
  }
})

// ========== 点击处理相关变量 ==========
let isProgrammaticChange = false // 标志：是否是程序自动修改 checkbox（非用户点击）
let lastClickTime = 0 // 上次点击时间（用于防抖）
let isHandlingClick = false // 标志：是否正在处理点击（防止重复处理）
const isProgrammaticChangeRef = ref(false) // 用于模板绑定的响应式标志

// ========== 处理 label 的点击事件 ==========
// 这是主要的点击处理函数，因为用户实际点击的是图标区域（label 包含图标）
// 当用户点击麦克风图标时，如果正在录音，则停止录音
const handleLabelClick = (event: MouseEvent) => {
  logger.info('[VoiceRecordingAnimation] ===== Label clicked =====', {
    target: event.target,
    currentTarget: event.currentTarget,
    isRecording: props.isRecording,
    isHandlingClick,
    isProgrammaticChange,
    isProgrammaticChangeRef: isProgrammaticChangeRef.value,
    timestamp: Date.now(),
  })

  // 如果点击的是 checkbox 本身，让 handleClick 处理（虽然不太可能，因为 checkbox 是隐藏的）
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target === checkboxRef.value) {
    logger.info(
      '[VoiceRecordingAnimation] Clicked on checkbox directly, letting handleClick handle it'
    )
    return // 让 checkbox 的 click 事件处理
  }

  // 如果 checkbox 被禁用，忽略点击
  if (isProgrammaticChangeRef.value || isProgrammaticChange) {
    logger.info('[VoiceRecordingAnimation] Ignoring label click - programmatic change in progress')
    return
  }

  // 如果正在处理点击，忽略
  if (isHandlingClick) {
    logger.info('[VoiceRecordingAnimation] Ignoring label click - already handling click')
    return
  }

  // 如果不在录音状态，忽略点击
  if (!props.isRecording) {
    logger.info('[VoiceRecordingAnimation] Ignoring label click - not recording')
    return
  }

  // 获取 checkbox 状态
  const checkbox = checkboxRef.value
  if (!checkbox) {
    logger.error('[VoiceRecordingAnimation] Checkbox ref is null, cannot handle label click')
    return
  }

  const wasChecked = checkbox.checked || isCheckboxChecked.value
  logger.info(
    '[VoiceRecordingAnimation] Label clicked - checkbox.checked:',
    checkbox.checked,
    'isCheckboxChecked:',
    isCheckboxChecked.value,
    'wasChecked:',
    wasChecked,
    'isRecording:',
    props.isRecording
  )

  // 如果 checkbox 是 checked 状态且正在录音，停止录音
  if (wasChecked && props.isRecording) {
    logger.info('[VoiceRecordingAnimation] ✓ Conditions met, stopping recording')
    // 直接调用停止逻辑，不通过 checkbox 的 click 事件
    stopRecordingDirectly(event)
  } else {
    logger.info('[VoiceRecordingAnimation] ✗ Conditions not met', {
      wasChecked,
      isRecording: props.isRecording,
      checkboxChecked: checkbox.checked,
      isCheckboxChecked: isCheckboxChecked.value,
    })
  }
}

// ========== 核心函数：直接停止录音的逻辑 ==========
// 当用户点击麦克风图标停止录音时调用
// 流程：1. 设置标志 → 2. 更新 UI（显示取消图标）→ 3. 发送 stop 事件 → 4. 设置 1 秒定时器关闭窗口
const stopRecordingDirectly = (event: MouseEvent) => {
  logger.info('[VoiceRecordingAnimation] stopRecordingDirectly called')

  // ========== 步骤 1: 防止重复处理 ==========
  if (isHandlingClick) {
    logger.info('[VoiceRecordingAnimation] Already handling click, ignoring')
    return
  }

  event.preventDefault()
  event.stopPropagation()
  isHandlingClick = true

  // ========== 步骤 2: 清除之前的定时器 ==========
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }

  // ========== 步骤 3: 设置标志，防止 watch 干扰（必须在 emit 之前设置）==========
  userClickedStop.value = true // 标志用户已点击停止，防止 watch 清除定时器
  isClosing.value = true // 标记窗口正在关闭，防止被重新打开

  // ========== 步骤 4: 更新 UI - 显示取消图标（斜线）==========
  // 将 checkbox 设置为未选中状态，这会触发 CSS 显示取消图标（icon-2），隐藏麦克风图标（icon-1）
  isCheckboxChecked.value = false
  
  // 立即更新 checkbox DOM 状态，不等待 nextTick
  if (checkboxRef.value) {
    isProgrammaticChange = true
    isProgrammaticChangeRef.value = true
    // 直接设置 checkbox 的 checked 属性，确保 CSS 选择器能正确匹配
    checkboxRef.value.checked = false
    // 强制移除 checked 属性，确保 :not(:checked) 选择器生效
    checkboxRef.value.removeAttribute('checked')
    
    logger.info('[VoiceRecordingAnimation] Checkbox state updated immediately:', {
      checked: checkboxRef.value.checked,
      hasCheckedAttr: checkboxRef.value.hasAttribute('checked'),
      isCheckboxChecked: isCheckboxChecked.value
    })
  }
  
  // 使用 nextTick 确保 Vue 响应式系统完成更新
  nextTick(() => {
    if (checkboxRef.value) {
      // 再次确认 checkbox 状态，确保 DOM 状态正确
      if (checkboxRef.value.checked !== false) {
        checkboxRef.value.checked = false
        checkboxRef.value.removeAttribute('checked')
        logger.info('[VoiceRecordingAnimation] Force updated checkbox to unchecked in nextTick')
      }
      
      // 验证 CSS 选择器是否能匹配
      const isNotChecked = !checkboxRef.value.checked && !checkboxRef.value.hasAttribute('checked')
      logger.info('[VoiceRecordingAnimation] CSS selector check:', {
        isNotChecked,
        checkboxChecked: checkboxRef.value.checked,
        matchesNotChecked: isNotChecked,
        cardHasCancelledClass: containerRef.value?.querySelector('.card.is-cancelled') !== null
      })
      
      setTimeout(() => {
        isProgrammaticChange = false
        isProgrammaticChangeRef.value = false
        isHandlingClick = false // 重置处理标志
      }, 100)
    } else {
      logger.error('[VoiceRecordingAnimation] Checkbox ref is null when trying to show cancel icon')
      // 如果 checkbox 不存在，延迟重置标志
      setTimeout(() => {
        isHandlingClick = false
      }, 100)
    }
  })

  // ========== 步骤 5: 定义关闭窗口的函数 ==========
  // 这个函数会在 1 秒后执行，关闭窗口
  const closeWindow = () => {
    logger.info('[VoiceRecordingAnimation] ===== CLOSING WINDOW =====')
    logger.info(
      '[VoiceRecordingAnimation] Before close - shouldShow:',
      shouldShow.value,
      'userClickedStop:',
      userClickedStop.value,
      'isClosing:',
      isClosing.value,
      'isRecording:',
      props.isRecording
    )

    // 强制设置所有关闭相关的标志
    isClosing.value = true
    userClickedStop.value = false // 重置标志，防止干扰

    // 强制关闭窗口 - 使用多种方式确保生效
    shouldShow.value = false
    animationKey.value = Date.now() + Math.random()
    hideTimeout.value = null

    logger.info(
      '[VoiceRecordingAnimation] After close - shouldShow:',
      shouldShow.value,
      'isClosing:',
      isClosing.value
    )

    // 使用 nextTick 确保在下一个渲染周期再次检查
    nextTick(() => {
      logger.info('[VoiceRecordingAnimation] NextTick check - shouldShow:', shouldShow.value)
      if (shouldShow.value) {
        logger.warn(
          '[VoiceRecordingAnimation] ⚠⚠⚠ Window still showing after close, FORCING CLOSE AGAIN ⚠⚠⚠'
        )
        shouldShow.value = false
        animationKey.value = Date.now() + Math.random()
        // 再次强制检查
        nextTick(() => {
          if (shouldShow.value) {
            logger.error(
              '[VoiceRecordingAnimation] ❌❌❌ Window STILL showing! This is a critical error!'
            )
            // 最后一次强制关闭
            shouldShow.value = false
            animationKey.value = Date.now() + Math.random()
          }
        })
      } else {
        logger.info('[VoiceRecordingAnimation] ✓ Window successfully closed')
      }

      // 延迟重置 isClosing 标志
      setTimeout(() => {
        isClosing.value = false
        logger.info('[VoiceRecordingAnimation] isClosing flag reset')
      }, 500)
    })
  }

  // ========== 步骤 6: 设置 1 秒定时器关闭窗口 ==========
  // 在发送 stop 事件之前设置定时器，确保定时器不会被 watch 清除
  // 用户点击停止后，等待 1 秒再关闭窗口（给用户看到取消图标的时间）
  const timeoutId = setTimeout(() => {
    logger.info('[VoiceRecordingAnimation] ✓ Timer executed at', new Date().toISOString())
    logger.info(
      '[VoiceRecordingAnimation] Current state - shouldShow:',
      shouldShow.value,
      'userClickedStop:',
      userClickedStop.value,
      'isClosing:',
      isClosing.value,
      'isRecording:',
      props.isRecording
    )
    closeWindow()
  }, 1000) // 1秒后关闭窗口
  
  // 保存定时器 ID，确保不会被清除
  hideTimeout.value = timeoutId

  logger.info(
    '[VoiceRecordingAnimation] ✓ Set timeout to close window, hideTimeout:',
    hideTimeout.value,
    'userClickedStop:',
    userClickedStop.value,
    'timestamp:',
    Date.now()
  )

  // ========== 步骤 7: 停止录音并获取录音数据，然后发送停止事件给父组件 ==========
  // 这会触发父组件设置 isRecording = false
  // 注意：watch 会在 isRecording 变为 false 时执行，但我们已经设置了 userClickedStop = true
  // 所以 watch 应该保留定时器，不会清除它
  logger.info('[VoiceRecordingAnimation] ✓ Stopping recording and emitting stop event')

  // voiceRecorder 不存在，直接触发 stop 事件
  logger.info('[VoiceRecordingAnimation] No voiceRecorder available, emitting stop event')
  emit('stop')

  // ========== 步骤 8: 再次确认定时器还在（防止被 watch 清除）==========
  // 这是一个安全措施，如果定时器被意外清除，设置备用定时器
  setTimeout(() => {
    if (!hideTimeout.value) {
      logger.warn('[VoiceRecordingAnimation] ⚠ hideTimeout was cleared! Setting backup timer')
      hideTimeout.value = setTimeout(() => {
        logger.info('[VoiceRecordingAnimation] Backup timer executed')
        shouldShow.value = false
        animationKey.value = Date.now() + Math.random()
        userClickedStop.value = false
        isClosing.value = false
        hideTimeout.value = null
      }, 1000) // 1秒后关闭
    } else {
      logger.info('[VoiceRecordingAnimation] ✓ hideTimeout still exists after emit, will close in 1 second')
    }
  }, 100) // 增加检查延迟到100ms，确保 watch 已经执行

  setTimeout(() => {
    isHandlingClick = false
  }, 100)
}

// ========== 处理 checkbox 的点击事件 ==========
// 这是备用处理函数，主要用于处理 checkbox 的直接点击（虽然 checkbox 是隐藏的）
// 主要逻辑在 handleLabelClick 中处理
const handleClick = (event: MouseEvent) => {
  // 如果正在处理点击，忽略
  if (isHandlingClick) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const now = Date.now()
  // 防止快速连续点击
  if (now - lastClickTime < 200) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  lastClickTime = now

  // 如果是程序自动修改（通过响应式变量检查），阻止点击事件
  if (isProgrammaticChangeRef.value || isProgrammaticChange) {
    if (import.meta.env.DEV) {
      logger.info(
        '[VoiceRecordingAnimation] Ignoring programmatic click event',
        'isProgrammaticChangeRef:',
        isProgrammaticChangeRef.value,
        'isProgrammaticChange:',
        isProgrammaticChange
      )
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // 验证这是真正的用户点击（通过检查事件类型和来源）
  const isRealUserClick =
    event.isTrusted === true && // 浏览器原生事件
    event.type === 'click' && // 点击事件
    !event.defaultPrevented // 没有被阻止

  if (!isRealUserClick) {
    logger.info('[VoiceRecordingAnimation] Ignoring non-user click event', {
      isTrusted: event.isTrusted,
      type: event.type,
      defaultPrevented: event.defaultPrevented,
    })
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // 获取 checkbox 的当前状态（而不是从 event.target，因为用户可能点击的是 label）
  const checkbox = checkboxRef.value
  if (!checkbox) {
    logger.info('[VoiceRecordingAnimation] Checkbox ref is null, ignoring click')
    return
  }

  // 注意：在 click 事件中，checkbox.checked 可能还没有改变（因为这是 click 事件，不是 change 事件）
  // 所以我们需要检查当前状态，如果 checked 为 true 且正在录音，则停止录音
  const wasChecked = checkbox.checked || isCheckboxChecked.value

  logger.info(
    '[VoiceRecordingAnimation] Click event received',
    'checkbox.checked:',
    checkbox.checked,
    'isCheckboxChecked:',
    isCheckboxChecked.value,
    'wasChecked:',
    wasChecked,
    'isRecording:',
    props.isRecording,
    'target:',
    event.target,
    'timestamp:',
    Date.now()
  )

  // 用户点击停止录音（checkbox 当前是 checked 状态且正在录音）
  if (wasChecked && props.isRecording) {
    logger.info('[VoiceRecordingAnimation] ===== Checkbox clicked to stop =====')
    // 阻止 checkbox 的默认行为（取消选中），因为我们会在 stopRecordingDirectly 中手动处理
    event.preventDefault()
    event.stopPropagation()
    // 直接调用停止逻辑（复用代码）
    stopRecordingDirectly(event)
  } else if (!wasChecked && props.isRecording) {
    // 如果已经是 unchecked 状态且正在录音，这不应该发生
    // 但为了安全起见，阻止选中
    if (import.meta.env.DEV) {
      logger.info('[VoiceRecordingAnimation] Checkbox is unchecked but recording, preventing check')
    }
    event.preventDefault()
    event.stopPropagation()
  }
}

// ========== 处理 checkbox 的 change 事件 ==========
// 注意：change 事件不应该触发停止，只有用户点击才应该停止
// change 事件可能在程序自动修改 checkbox 时被触发，不应该触发停止逻辑
const handleChange = (event: Event) => {
  // 完全忽略 change 事件，只使用 click 事件
  // change 事件可能在程序自动修改时被触发，不应该触发停止
  if (import.meta.env.DEV) {
    const target = event.target as HTMLInputElement
    logger.info(
      '[VoiceRecordingAnimation] Change event triggered but IGNORED (only click events trigger stop):',
      {
        checked: target.checked,
        isRecording: props.isRecording,
        isHandlingClick,
        isProgrammaticChange,
        timestamp: Date.now(),
      }
    )
  }
  // 完全忽略，不做任何操作
  return
}
</script>

<style lang="scss">
/* 使用非 scoped 样式以确保 Teleport 内容的样式生效 */

/* 组件级 CSS 变量定义 */
.voice-recording-animation {
  /* --vra- 前缀的组件变量 */
  --vra-z-index: var(--z-popover);
  --vra-bg-overlay: var(--color-black-5);
  --vra-blur: 4px;
  --vra-icon-size: 72px;
  --vra-circle1-size: 200px;
  --vra-circle2-size: 110px;
  --vra-footer-z-index: var(--z-header);
  --vra-icon-z-index: var(--z-header);
  --vra-text-z-index: var(--z-header);
  --vra-circle1-z-index: calc(var(--z-base) + 4);
  --vra-circle2-z-index: calc(var(--z-base) + 7);
  
  position: fixed;
  inset: 0;
  z-index: var(--vra-z-index); /* 高于 AI 对话框的 z-index (2000-2001)，确保全屏显示 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vra-bg-overlay);
  backdrop-filter: blur(var(--vra-blur));
  -webkit-backdrop-filter: blur(var(--vra-blur));
  pointer-events: none; /* 不拦截点击事件，让点击穿透到下层 */
  visibility: visible;
  opacity: 1;

  /* 但允许子元素交互（如停止按钮） */
  > * {
    pointer-events: auto;
  }

  /* grid动画层不拦截点击 */
  .grid {
    pointer-events: none;
  }
}

.voice-recording-animation .grid {
  --perspective: 800px;

  position: absolute;
  inset: -2.5rem 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  transform-style: preserve-3d;
  pointer-events: none; /* 不拦截点击事件 */
}

.grid .area {
  position: relative;
  z-index: var(--z-base);
}

.grid input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.grid::after,
.grid::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  filter: blur(70px);
  opacity: 0.5;
  pointer-events: none;
}

.grid::after {
  width: 600px;
  height: 380px;
  background: radial-gradient(
    circle at center,
    var(--color-white-15) 0%,
    var(--ai-gray-transparent-1) 50%,
    transparent 100%
  );
  transform: translateZ(-100px) translateX(-40px) translateY(-120px);
}

.grid::before {
  width: 500px;
  height: 500px;
  background: radial-gradient(
    circle at center,
    var(--ai-gray-transparent-2) 0%,
    var(--ai-gray-transparent-3) 50%,
    transparent 100%
  );
  transform: translateZ(-120px) translateX(100px) translateY(100px);
}

:where(html.dark) .grid::after {
  background: radial-gradient(
    circle at center,
    var(--color-white-8) 0%,
    var(--ai-gray-transparent-4) 50%,
    transparent 100%
  );
}

:where(html.dark) .grid::before {
  background: radial-gradient(
    circle at center,
    var(--ai-gray-transparent-3) 0%,
    var(--ai-gray-transparent-5) 50%,
    transparent 100%
  );
}

.voice-recording-animation .wrap {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translateX(-50%) translateY(-50%);
  z-index: var(--z-base); /* 相对于 voice-recording-animation 的层级 */
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto; /* 确保 label 可以接收点击事件 */
  width: 326px;
  height: 360px;
  cursor: pointer;
}

/* 确保 wrap 内的所有元素都能接收点击事件 */
.voice-recording-animation .wrap * {
  pointer-events: auto;
}

/* 图标元素保持 pointer-events: none，让点击穿透到 input */
.voice-recording-animation .wrap .icon,
.voice-recording-animation .wrap .icon * {
  pointer-events: none;
}

/* input 只在中心区域覆盖，让其他区域可以交互 */
.voice-recording-animation .wrap input {
  position: absolute;
  opacity: 0;
  width: 220px; /* 稍微扩大点击区域 */
  height: 220px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: calc(var(--z-base) + 2); /* 降低 z-index，让其他元素可以交互 */
  cursor: pointer;
  pointer-events: auto;

  /* 确保 input 不会阻止其他元素的交互 */
  clip-path: circle(50%);
}

.card {
  position: relative;
  transform-style: preserve-3d;
  padding: 7px;
  will-change: transform;
  transition: transform 0.3s ease;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius); /* 更圆润的边角，更现代 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 90px; /* 增加底部内边距，为文字留出更多空间，避免被圆形容器遮挡 */
  pointer-events: auto; /* 允许 card 接收点击事件 */

  /* 使用稍微带灰调的背景，增强对比度 */
  background: linear-gradient(
    135deg,
    var(--gradient-white-1) 0%,
    var(--gradient-white-2) 50%,
    var(--gradient-white-3) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  /* 增强的 neumorphic 边框 - 更明显的立体感 */
  border: 1.5px solid var(--border-unified-color);
  border-top: 1.5px solid var(--border-unified-color);
  border-left: 1.5px solid var(--border-unified-color);
  border-right: 1.5px solid var(--border-unified-color);
  border-bottom: 1.5px solid var(--border-unified-color);
}

/* 确保 card 内的所有子元素都能接收点击事件，但装饰性元素保持穿透 */
.voice-recording-animation .card * {
  pointer-events: auto;
}

/* 装饰性元素保持 pointer-events: none，让点击穿透 */
.voice-recording-animation .card .icon,
.voice-recording-animation .card .icon *,
.voice-recording-animation .card .wave,
.voice-recording-animation .card .outline,
.voice-recording-animation .card .circle-1,
:where(.voice-recording-animation) .card .circle-2 {
  pointer-events: none;
}

/* footer 区域可以交互和选择 */
.voice-recording-animation .card footer,
.voice-recording-animation .card footer * {
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;
}

/* 确保所有文本内容都可以被选中 */
.voice-recording-animation .card footer p,
.voice-recording-animation .card footer p *,
.voice-recording-animation .card footer span,
.voice-recording-animation .card footer .bold {
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;
}

:where(html.dark) .card {
  /* 更优雅的暗色模式背景 - 使用渐变 */
  background: linear-gradient(
    135deg,
    var(--ai-dark-overlay) 0%,
    var(--color-dark-overlay-2) 50%,
    var(--color-dark-overlay-3) 100%
  );
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);

  /* 更精致的边框 */
  border: var(--unified-border);
  border-top: var(--unified-border);
  border-left: var(--unified-border);
}

.card::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: inherit;
  z-index: -1;
  transition: all 0.5s linear;

  /* 精致的内部光晕效果 - 增强 neumorphic 质感 */
  background: radial-gradient(
    ellipse at center,
    var(--color-white-50) 0%,
    var(--color-white-20) 30%,
    var(--gradient-white-4) 50%,
    var(--gradient-gray-1) 70%,
    var(--color-black-2) 100%
  );
  backdrop-filter: blur(10px) saturate(150%);
  -webkit-backdrop-filter: blur(10px) saturate(150%);
}

:where(html.dark) .card::before {
  /* 暗色模式下的内部光晕效果 */
  background: radial-gradient(
    ellipse at center,
    var(--color-white-8) 0%,
    var(--color-white-4) 30%,
    var(--color-black-10) 70%,
    var(--color-black-20) 100%
  );
}

.outline {
  position: absolute;
  overflow: hidden;
  inset: 0;
  outline: none;
  transition: all 0.4s ease;
  border-radius: var(--global-border-radius);
  transform-style: preserve-3d;
}

.outline::before {
  content: '';
  position: absolute;
  inset: 0;
  width: 400px;
  height: 550px;
  margin: auto;

  /* 精致的渐变 - 使用更柔和的颜色，增强 neumorphic 效果 */
  background: radial-gradient(
    ellipse at center,
    var(--color-white-40) 0%,
    var(--gradient-white-5) 15%,
    var(--gradient-gray-3) 30%,
    var(--gradient-gray-6) 45%,
    var(--gradient-gray-8) 60%,
    var(--gradient-gray-10) 75%,
    transparent 90%
  );
  filter: blur(24px) brightness(1.05);
  animation: rotate 4s linear infinite;
  transform: translateZ(10px);
  animation-play-state: paused;
  opacity: 0.75; /* 提高不透明度，增强可见度 */
}

:where(html.dark) .outline::before {
  /* 更优雅的暗色模式渐变 */
  background: radial-gradient(
    ellipse at center,
    var(--color-white-18) 0%,
    var(--gradient-gray-9) 20%,
    var(--gradient-gray-11) 35%,
    var(--gradient-gray-12) 50%,
    var(--gradient-gray-13) 65%,
    transparent 80%
  );
  opacity: 0.6; /* 提高不透明度，增强可见度 */
}

.wave {
  position: absolute;
  width: 200px;
  height: 200px;
  inset: 0;
  bottom: 60px;
  margin: auto;
  opacity: 0;
  transition: opacity 0.3s linear;
}

.wave::before,
.wave::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);

  /* 更优雅的边框颜色 - 使用黑灰色 */
  border: 2px solid var(--border-unified-color);
  filter: blur(2px);
  inset: 0;
  animation: wave 1.5s linear infinite;
  opacity: 0.7;
}

:where(html.dark) .wave::before,
:where(html.dark) .wave::after {
  /* 暗色模式下使用黑灰色边框 */
  border-color: var(--border-unified-color);
  opacity: 0.8; /* 提高不透明度，增强可见度 */
}

.wave::after {
  animation-delay: 0.4s;
}

.circle-1 {
  width: 200px; /* 减小尺寸，避免遮挡文字 */
  height: 200px; /* 减小尺寸，避免遮挡文字 */
  border-radius: var(--global-border-radius);
  position: absolute;
  top: 50%;
  left: 50%;

  /* transform 由动画控制，但初始状态需要保持定位 */
  transform: translate(-50%, calc(-50% - 20px)); /* 向上移动，避免遮挡底部文字 */
  /* 使用稍微带灰调的背景，增强对比度 */
  background: radial-gradient(
    circle at 30% 30%,
    var(--gradient-white-6) 0%,
    var(--gradient-gray-4) 30%,
    var(--gradient-gray-2) 50%,
    var(--gradient-gray-5) 70%,
    var(--gradient-gray-7) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  animation: circle1 4.2s ease-in-out infinite 0.3s;
  transform-style: preserve-3d;
  z-index: var(--vra-circle1-z-index); /* 降低 z-index，确保不遮挡 footer */

  --z: 0px;

  /* 确保动画时保持居中定位 */
  animation-fill-mode: both;

  /* 增强边框对比度 */
  border: 1.5px solid var(--border-unified-color);
  border-top: 1.5px solid var(--border-unified-color);
  border-left: 1.5px solid var(--border-unified-color);
  border-right: 1.5px solid var(--border-unified-color);
  border-bottom: 1.5px solid var(--border-unified-color);

  /* 确保不遮挡文字区域 */
  overflow: visible;
}

:where(html.dark) .circle-1 {
  /* 更优雅的暗色模式渐变背景 */
  background: radial-gradient(
    circle at 30% 30%,
    var(--gradient-dark-1) 0%,
    var(--color-dark-overlay-1) 40%,
    var(--gradient-dark-2) 100%
  );
  border: var(--unified-border);
  border-top: var(--unified-border);
  border-left: var(--unified-border);
}

.circle-1::after,
.circle-1::before {
  content: '';
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(50px);
  width: 35%;
  height: 35%;
  opacity: 0.4;
}

.circle-1::before {
  background: var(--color-white-60);
  top: 25%;
  right: 25%;
}

:where(html.dark) .circle-1::before {
  background: var(--color-gray-transparent-4);
  opacity: 0.5; /* 提高不透明度 */
}

.circle-1::after {
  background: var(--color-gray-150-50);
  bottom: 15%;
  left: 25%;
}

:where(html.dark) .circle-1::after {
  background: var(--color-gray-transparent-6);
  opacity: 0.4; /* 提高不透明度 */
}

.circle-1 .lines {
  animation: rotate 30s linear infinite;
}

.circle-1 .lines svg {
  stroke: var(--el-text-color-primary);
  animation: lines 3s ease-in-out infinite;
  stroke-width: 2px;
  opacity: 0.7;
}

:where(html.dark) :where(.circle-1) :where(.lines) :where(svg) {
  stroke: var(--el-text-color-primary);
  opacity: 0.6;
}

.circle-1 .lines path {
  animation: line 3s ease-in-out calc(var(--i) * -1s) infinite;
  stroke-dasharray: 100;
  stroke-dashoffset: 10;
  transition: opacity 0.3s linear;
}

.circle-2 {
  width: 110px; /* 减小尺寸，避免遮挡文字 */
  height: 110px; /* 减小尺寸，避免遮挡文字 */
  border-radius: var(--global-border-radius);
  position: absolute;
  top: 50%;
  left: 50%;

  /* transform 由动画控制，但初始状态需要保持定位 */
  transform: translate(-50%, calc(-50% - 20px)); /* 向上移动，与 circle-1 对齐 */
  transform-style: preserve-3d;
  animation: circle2 4.2s ease-in-out infinite;

  /* 使用稍微带灰调的背景，增强对比度 */
  background: radial-gradient(
    circle at 30% 30%,
    var(--color-gradient-fafcfe) 0%,
    var(--color-gradient-f8fcf8-98) 40%,
    var(--color-gradient-f5f7fa-95) 70%,
    var(--color-gradient-f2f5f8-92) 100%
  );
  z-index: var(--vra-circle2-z-index); /* 降低 z-index，确保不遮挡 footer */

  --z: 10px;

  /* 增强边框对比度 */
  border: 1.5px solid var(--border-unified-color);
  border-top: 1.5px solid var(--border-unified-color);
  border-left: 1.5px solid var(--border-unified-color);
  border-right: 1.5px solid var(--border-unified-color);
  border-bottom: 1.5px solid var(--border-unified-color);

  /* 增强的内外阴影 */
  }

.circle-2::before,
.circle-2::after {
  content: '';
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(30px);
  z-index: var(--z-base);
}

.circle-2::before {
  background: var(--color-white-50);
  width: 30%;
  height: 30%;
  top: 20%;
  right: 20%;
  opacity: 0.5;
}

/* 暗色模式下的 circle-2 主容器样式 */
:where(html.dark) .voice-recording-animation .circle-2 {
  /* 更优雅的暗色模式渐变背景 */
  background: radial-gradient(
    circle at 30% 30%,
    var(--gradient-dark-3) 0%,
    var(--gradient-dark-4) 50%,
    var(--color-dark-overlay-1) 100%
  );

  /* 更精致的暗色模式边框和阴影 */
  border: var(--unified-border);
  border-top: var(--unified-border);
  border-left: var(--unified-border);
  }

:where(html.dark) .circle-2::before {
  background: var(--color-gray-transparent-5);
  opacity: 0.6; /* 提高不透明度 */
}

.circle-2::after {
  background: var(--color-gray-180-40);
  width: 20%;
  height: 20%;
  bottom: 10%;
  left: 40%;
  opacity: 0.4;
}

:where(html.dark) .circle-2::after {
  background: var(--color-gray-glow);
  opacity: 0.5; /* 提高不透明度 */
}

.circle-2 .bg {
  position: absolute;
  inset: 0;
  border-radius: var(--global-border-radius);
  background: linear-gradient(
    135deg,
    var(--color-white-90) 0%,
    var(--color-gray-240-80) 50%,
    var(--color-gray-220-70) 100%
  );
  animation: bgRotate 2.5s linear infinite;
  animation-play-state: paused;
  transition: all 0.3s ease;
}

:where(html.dark) :where(.voice-recording-animation) .circle-2 .bg {
  /* 更优雅的暗色模式渐变背景 */
  background: linear-gradient(
    135deg,
    var(--gradient-dark-6) 0%,
    var(--gradient-dark-7) 40%,
    var(--gradient-dark-5) 60%,
    var(--gradient-dark-8) 100%
  );
  }

.circle-2 .bg::before {
  content: '';
  position: absolute;
  inset: 0;
  animation: bg 4s linear infinite;
  border-radius: inherit;
  transition: opacity 0.4s linear;
  opacity: 0;
}

.voice-recording-animation .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 4px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, calc(-50% - 20px)) translateZ(50px); /* 跟随圆形元素向上移动 */
  z-index: var(--vra-icon-z-index);
  width: auto;
  height: auto;
  pointer-events: none;
  background: transparent; /* 确保没有背景色 */
}

.voice-recording-animation .icon svg {
  width: var(--vra-icon-size); /* 增大图标尺寸 */
  height: var(--vra-icon-size); /* 增大图标尺寸 */
  transition: transform 0.4s cubic-bezier(0.7, -1, 0.3, 1.5);
  position: absolute;
}

/* 默认状态：icon-1 隐藏，icon-2 隐藏 */
.voice-recording-animation .icon-1 {
  width: var(--vra-icon-size); /* 增大图标容器 */
  height: var(--vra-icon-size); /* 增大图标容器 */
  position: relative;
  z-index: var(--vra-icon-z-index);
  display: none;
  visibility: hidden;
  opacity: 0;
  background: transparent; /* 确保没有背景色 */
}

.voice-recording-animation .icon-1 svg {
  width: var(--vra-icon-size); /* 增大图标尺寸 */
  height: var(--vra-icon-size); /* 增大图标尺寸 */
  display: block;
  visibility: visible;
  opacity: 1;
}

.voice-recording-animation .icon-1 path {
  /* 亮色模式下使用纯黑色 */
  fill: var(--el-text-color-primary);
  opacity: 1;
  visibility: visible;

  /* 移除描边，使用纯色填充 */
  stroke: none;
  stroke-width: 0;

  /* 移除所有滤镜效果 */
  filter: none;
}

/* 暗色模式下的麦克风图标 - 使用纯白色 */
:where(html.dark) :where(.voice-recording-animation) :where(.icon-1) :where(path) {
  fill: var(--el-bg-color);
  filter: none;
}

/* 暗色模式下取消状态的斜杠 - 使用纯白色 */
:where(html.dark) :where(.voice-recording-animation) .icon-2 .cut,
:where(html.dark) :where(.voice-recording-animation) :where(.wrap) input:not(:checked) + .card .icon-2 .cut {
  stroke: var(--el-bg-color);
}

/* 亮色模式下取消状态的斜杠 - 使用纯黑色 */
.voice-recording-animation .icon-2 .cut,
:where(.voice-recording-animation) :where(.wrap) input:not(:checked) + .card .icon-2 .cut {
  stroke: var(--el-text-color-primary);
}

.voice-recording-animation .icon-2 {
  width: 64px;
  height: 64px;
  position: relative;
  z-index: var(--vra-icon-z-index);
  transform: translateY(80px) scale(0.7) rotateX(90deg);
  filter: blur(2px);
  opacity: 0;
  display: none;
  visibility: hidden;
  mask-image: linear-gradient(to bottom, color-mix(in srgb, var(--el-bg-color) 100%, transparent) 10%, color-mix(in srgb, var(--el-bg-color) 20%, transparent));
  background: transparent; /* 确保没有背景色 */
}

:where(.voice-recording-animation) .icon-2 .cut {
  stroke-dasharray: 732;
  stroke-dashoffset: 732;
  animation: reducePath 0.5s ease forwards;

  /* 亮色模式下取消状态的斜杠使用纯黑色 */
  stroke: var(--el-text-color-primary);
}

:where(html.dark) :where(.voice-recording-animation) .icon-2 .cut {
  /* 暗色模式下取消状态的斜杠使用纯白色 */
  stroke: var(--el-bg-color);
}

.voice-recording-animation .card footer {
  transform: translateZ(10px);
  padding: 0; /* 移除内边距，让内容直接显示 */
  position: absolute;
  bottom: 20px; /* 增加底部间距，避免被遮挡 */
  left: 17px;
  right: 17px;
  transform-style: preserve-3d;
  background: transparent; /* 确保没有背景 */
  z-index: var(--vra-footer-z-index); /* 确保 footer 在所有圆形容器之上 */
  pointer-events: auto; /* 确保可以交互 */
}

.voice-recording-animation .card footer::before {
  /* 完全移除黑色背景容器，直接显示内容 */
  display: none;
  content: none;
  background: none;
  box-shadow: none;
}

.voice-recording-animation .card footer p {
  display: flex;
  flex-wrap: wrap;
  gap: 6px; /* 增加间距，让文字更易读 */
  font-size: 16px; /* 稍微增大字体 */
  font-weight: 600; /* 稍微减轻字重，更现代 */
  font-family: var(--font-family-chinese);
  position: relative;
  z-index: var(--vra-text-z-index); /* 确保文字在圆形容器之上 */
  transform: translateZ(30px); /* 增加 3D 变换，确保在圆形容器之上 */
  line-height: 20px; /* 缩减行高，减少高度 */
  transition: all 0.3s ease;

  /* 亮色模式：使用纯深色，确保最高对比度 - 放弃渐变，使用纯色 */
  color: var(--color-text-dark); /* 使用非常深的颜色，确保高对比度 */
  -webkit-text-fill-color: var(--color-text-dark);
  background: transparent;
  justify-content: center;
  width: 100%;

  /* 移除文本投影 */
  padding: 4px 0; /* 大幅减少内边距，缩减高度 */
  margin: 0;
  border-radius: var(--global-border-radius); /* 更圆润的圆角 */
  border: none;
  letter-spacing: 0.5px; /* 增加字间距，提高可读性 */

  /* 确保文本在所有情况下都清晰可见 */
  opacity: 1;
  filter: contrast(1.2) brightness(0.95); /* 增加对比度，略微降低亮度以增强可读性 */

  /* 完全移除背景色 */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 暗色模式下的 footer 文本 - 高对比度浅色 */
:where(html.dark) :where(.voice-recording-animation) :where(.card) :where(footer) :where(p) {
  /* 使用高对比度的浅色渐变 */
  background: linear-gradient(135deg, var(--color-text-light) 0%, var(--el-text-color-primary) 50%, var(--color-text-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: var(--color-text-light); /* 降级方案 - 高对比度浅灰色 */

  /* 移除文本投影 */
}

.voice-recording-animation .card footer .bold {
  font-weight: 700;
  font-size: 17px; /* 稍微增大加粗文字 */

  /* 亮色模式：使用深灰色纯色，确保高对比度 - 放弃渐变 */
  color: var(--color-dark-bg-3); /* 使用深灰色，确保高对比度 */
  -webkit-text-fill-color: var(--color-dark-bg-3);
  background: transparent;

 /* 扁平化设计：移除文本投影 */
  filter: contrast(1.2) saturate(1.15); /* 增强对比度和饱和度 */
}

/* 暗色模式下的加粗文本 - 使用更亮的灰色 */
:where(html.dark) :where(.voice-recording-animation) .card footer .bold {
  background: linear-gradient(135deg, var(--ai-gray-1) 0%, var(--el-text-color-placeholder) 50%, var(--ai-gray-1) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: var(--ai-gray-1); /* 降级方案 - 更亮的灰色 */
}

/* 暗色模式下 hover 加粗文本 - 使用最亮的灰色 */
:where(html.dark) :where(.voice-recording-animation) .wrap:hover footer .bold {
  background: linear-gradient(135deg, var(--el-text-color-placeholder) 0%, var(--el-fill-color-light) 50%, var(--el-text-color-placeholder) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: var(--el-text-color-placeholder); /* 降级方案 - 最亮的灰色 */
}

.card footer span {
  display: inline-block;
  animation: labels 9s ease calc(1s + var(--i) * 0.05s) infinite;
  opacity: 0;
}

/** STATES */

/* 录音状态（checked）：显示麦克风图标，隐藏取消图标，运行动画 */
:where(.voice-recording-animation) .wrap input:checked + .card .icon-1 {
  display: flex;
  visibility: visible;
  opacity: 1;
  transform: none;
  filter: none;
  z-index: var(--vra-icon-z-index);
}

:where(.voice-recording-animation) .wrap input:checked + .card .icon-1 svg {
  display: block;
  visibility: visible;
  opacity: 1;
  width: var(--vra-icon-size); /* 增大图标尺寸 */
  height: var(--vra-icon-size); /* 增大图标尺寸 */
}

/* 确保录音状态下图标：亮色模式纯黑色，暗色模式纯白色 */
:where(.voice-recording-animation) .wrap input:checked + .card .icon-1 path {
  fill: var(--el-text-color-primary);
  filter: none;
}

:where(html.dark) :where(.voice-recording-animation) .wrap input:checked + .card .icon-1 path {
  fill: var(--el-bg-color);
  filter: none;
}

:where(.voice-recording-animation) .wrap input:checked + .card .icon-2 {
  display: none;
  visibility: hidden;
  opacity: 0;
}

/* 录音状态：运行光芒四射动画 */
:where(.voice-recording-animation) :where(.wrap) input:checked + .card .circle-1 .lines {
  animation-play-state: running;
}

:where(.voice-recording-animation) :where(.wrap) input:checked + .card .circle-1 .lines svg {
  animation-play-state: running;
}

:where(.voice-recording-animation) :where(.wrap) input:checked + .card .circle-1 .lines path {
  opacity: 1;
  visibility: visible;
  animation-play-state: running;
}

:where(.voice-recording-animation) .wrap input:checked + .card .circle-1,
:where(.voice-recording-animation) .wrap input:checked + .card .circle-2,
:where(.voice-recording-animation) :where(.wrap) input:checked + .card .circle-2 .bg {
  animation-play-state: running;
}

.wrap input:checked + .card .outline::before {
  animation-play-state: paused;
}

.wrap input:checked + .card .wave {
  opacity: 0;
}

/* 取消状态（not checked）：隐藏麦克风图标，显示取消图标 */
:where(.voice-recording-animation) .wrap input:not(:checked) + .card .icon-1,
:where(.voice-recording-animation) .card.is-cancelled .icon-1 {
  display: none;
  visibility: hidden;
  opacity: 0;
}

:where(.voice-recording-animation) .wrap input:not(:checked) + .card .icon-1 svg,
:where(.voice-recording-animation) .card.is-cancelled .icon-1 svg {
  display: none;
  visibility: hidden;
  opacity: 0;
}

:where(.voice-recording-animation) .wrap input:not(:checked) + .card .icon-2,
:where(.voice-recording-animation) .card.is-cancelled .icon-2 {
  display: flex;
  visibility: visible;
  opacity: 1;
  transform: translate(-50%, calc(-50% - 20px)) translateZ(50px); /* 与 icon-1 相同的定位 */
  filter: none;
  z-index: var(--vra-icon-z-index);
  position: absolute;
  top: 50%;
  left: 50%;
  align-items: center;
  justify-content: center;
  width: var(--vra-icon-size);
  height: var(--vra-icon-size);
  mask-image: none; /* 移除遮罩，确保图标完全可见 */
  -webkit-mask-image: none;
}

/* 取消状态下的 icon-2 SVG */
:where(.voice-recording-animation) .wrap input:not(:checked) + .card .icon-2 svg,
:where(.voice-recording-animation) .card.is-cancelled .icon-2 svg {
  display: block;
  visibility: visible;
  opacity: 1;
  width: var(--vra-icon-size);
  height: var(--vra-icon-size);
}

:where(.voice-recording-animation) :where(.wrap) input:not(:checked) + .card .icon-2 .cut,
:where(.voice-recording-animation) .card.is-cancelled .icon-2 .cut {
  stroke-dashoffset: 0;
  stroke: var(--el-text-color-primary); /* 亮色模式下取消状态的斜杠使用纯黑色 */
  animation: none; /* 禁用动画，确保斜杠立即显示 */
}

:where(html.dark) :where(.voice-recording-animation) :where(.wrap) input:not(:checked) + .card .icon-2 .cut,
:where(html.dark) :where(.voice-recording-animation) .card.is-cancelled .icon-2 .cut {
  stroke: var(--el-bg-color); /* 暗色模式下取消状态的斜杠使用纯白色 */
}

.wrap:hover .card::before {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: transparent;
}

.wrap:hover .outline::before {
  animation-play-state: running;
}

.wrap:hover input:checked + .card .icon-2 {
  transform: translateY(80px) scale(0.7) rotateX(90deg);
  filter: blur(2px);
  opacity: 0;
}

.wrap:hover input:checked + .card .icon-1 {
  transform: none;
  filter: none;
  opacity: 1;
}

.wrap:hover .icon-1 {
  transform: translateY(-80px) scale(0.7) rotateX(90deg);
  filter: blur(2px);
  opacity: 0;
}

.wrap:hover .icon-2 {
  transform: none;
  filter: none;
  opacity: 0.6;
}

.wrap:hover .icon-2 .cut {
  animation: growPath 0.3s ease 0.6s forwards;
}

.voice-recording-animation .wrap:hover footer p {
  transform: translateY(-4px) translateZ(20px);

  /* hover 时增强文本对比度和可读性 */
  opacity: 1;

  /* 使用更深的颜色，确保对比度 - 纯色 */
  color: var(--el-text-color-primary); /* hover 时使用纯黑色，最高对比度 */
  -webkit-text-fill-color: var(--el-text-color-primary);
  background: transparent;

 /* 扁平化设计：移除文本投影 */
  filter: contrast(1.25) brightness(0.95); /* 增加对比度，略微降低亮度 */
}

.voice-recording-animation .wrap:hover footer .bold {
  /* hover 时使用更深的灰色 */
  color: var(--color-dark-bg-1);
  -webkit-text-fill-color: var(--color-dark-bg-1);
  filter: contrast(1.25) saturate(1.2);
}

/* 暗色模式下 hover footer 文本 - 进一步增强对比度 */
:where(html.dark) :where(.voice-recording-animation) :where(.wrap:hover) :where(footer) :where(p) {
  transform: translateY(-4px) translateZ(20px);

  /* 使用更亮的文本颜色 */
  background: linear-gradient(135deg, var(--el-fill-color-lighter) 0%, var(--el-text-color-primary) 50%, var(--el-fill-color-lighter) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: var(--el-fill-color-lighter); /* 降级方案 - 更亮的浅灰色 */

 /* 扁平化设计：移除文本投影 */
  opacity: 1;
}

.wrap:hover .bg {
  animation-play-state: running;
}

.wrap:hover .wave {
  opacity: 1;
}

.wrap:hover .circle-2 .bg::before {
  opacity: 0.2;
}

.wrap:hover .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(0) scale3d(1.03, 1.03, 1.03);
  border-color: var(--border-unified-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* hover 时稍微增强背景亮度 */
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--el-color-primary) 100%, transparent) 0%,
    var(--color-gradient-fdfdff-99) 50%,
    var(--gradient-white-1) 100%
  );
}

/* 暗色模式下的 hover 效果 */
:where(html.dark) :where(.voice-recording-animation) .wrap:hover .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(0) scale3d(1.02, 1.02, 1.02);
  border-color: var(--border-unified-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(15):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(15deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(14):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(13):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(0) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(12):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(11):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-15deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(10):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(15deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(9):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(8):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(0) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(7):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(-7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(6):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(0) rotateY(-15deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(5):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(15deg) rotateY(15deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(4):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(15deg) rotateY(7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(3):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(15deg) rotateY(0) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(2):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-7deg) scale3d(1, 1, 1);
}

:where(.voice-recording-animation:has(.grid .area:nth-child(1):hover)) :where(.wrap) .card {
  transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-15deg) scale3d(1, 1, 1);
}

@keyframes lines {
  0% {
    transform: scale(0.41);
  }

  15% {
    transform: scale(0.37);
  }

  36% {
    transform: scale(0.41);
  }

  50% {
    transform: scale(0.38);
  }

  65% {
    transform: scale(0.43);
  }

  80% {
    transform: scale(0.39);
  }

  100% {
    transform: scale(0.41);
  }
}

@keyframes line {
  0% {
    stroke-dashoffset: 10;
  }

  50% {
    stroke-dashoffset: 45;
  }

  100% {
    stroke-dashoffset: 10;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes circle1 {
  0% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.97) translateZ(calc(20px + var(--z)));
  }

  15% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1) translateZ(calc(30px + var(--z)));
  }

  30% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.98) translateZ(calc(20px + var(--z)));
  }

  45% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1) translateZ(calc(30px + var(--z)));
  }

  60% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.97) translateZ(calc(20px + var(--z)));
  }

  85% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1) translateZ(calc(30px + var(--z)));
  }

  100% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.97) translateZ(calc(20px + var(--z)));
  }
}

@keyframes circle2 {
  0% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1) translateZ(calc(20px + var(--z)));
  }

  15% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1.03) translateZ(calc(30px + var(--z)));
  }

  30% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.98) translateZ(calc(20px + var(--z)));
  }

  45% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1.04) translateZ(calc(30px + var(--z)));
  }

  60% {
    transform: translate(-50%, calc(-50% - 20px)) scale(0.97) translateZ(calc(20px + var(--z)));
  }

  85% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1.03) translateZ(calc(30px + var(--z)));
  }

  100% {
    transform: translate(-50%, calc(-50% - 20px)) scale(1) translateZ(calc(20px + var(--z)));
  }
}

@keyframes growPath {
  from {
    stroke-dashoffset: 732;
  }

  to {
    stroke-dashoffset: 0;
  }
}

@keyframes reducePath {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: 732;
  }
}

@keyframes bgRotate {
  0% {
    transform: rotate(0deg);
  }

  20% {
    transform: rotate(90deg);
  }

  40% {
    transform: rotate(180deg) scale(0.95, 1);
  }

  60%,
  100% {
    transform: rotate(360deg);
  }
}

@keyframes bg {
  0% {
    opacity: 0.9;
    filter: brightness(1);
  }

  25% {
    opacity: 0.8;
    filter: brightness(0.95);
  }

  50% {
    opacity: 0.7;
    filter: brightness(0.9);
  }

  75% {
    opacity: 0.8;
    filter: brightness(0.95);
  }

  100% {
    opacity: 0.9;
    filter: brightness(1);
  }
}

@keyframes wave {
  0% {
    transform: scale(1);
    opacity: 0;
  }

  35% {
    transform: scale(1.3);
    opacity: 0.6;
  }

  70%,
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

@keyframes footer {
  0%,
  3% {
    transform: scaleY(0);
    filter: blur(15px) brightness(1.5);
  }

  10%,
  82% {
    filter: blur(0);
    transform: scaleY(1);
  }

  86% {
    transform: scaleY(0);
    filter: blur(15px) brightness(1.5);
  }
}

@keyframes labels {
  0% {
    transform: translateY(-30px) rotate(-30deg);
    filter: blur(10px);
  }

  5% {
    transform: translateY(10px);
    filter: blur(0);
  }

  10% {
    transform: translateY(0);
    opacity: 1;
  }

  73% {
    transform: translateY(0);
    opacity: 1;
  }

  76% {
    transform: translateY(-5px);
    filter: blur(0);
  }

  80% {
    transform: translateY(15px);
    opacity: 0;
    filter: blur(5px);
  }
}
</style>

<!-- 全局样式：用于暗色主题 -->
<style lang="scss">
:where(html.dark) .voice-recording-animation {
  /* 暗色模式下使用更深的背景，但保持半透明 */
  --vra-bg-overlay: var(--color-black-40);
  --vra-blur: 8px;

  background: var(--vra-bg-overlay);
  backdrop-filter: blur(var(--vra-blur)) saturate(120%);
  -webkit-backdrop-filter: blur(var(--vra-blur)) saturate(120%);

  .grid::after {
    background: radial-gradient(
      circle at center,
      var(--color-white-8) 0%,
      var(--ai-gray-transparent-4) 50%,
      transparent 100%
    );
  }

  .grid::before {
    background: radial-gradient(
      circle at center,
      var(--ai-gray-transparent-3) 0%,
      var(--ai-gray-transparent-5) 50%,
      transparent 100%
    );
  }

  .card {
    /* 更优雅的暗色模式渐变背景 */
    background: linear-gradient(
      135deg,
      var(--ai-dark-overlay) 0%,
      var(--color-dark-overlay-2) 50%,
      var(--color-dark-overlay-3) 100%
    );
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);

    /* 更精致的边框 */
    border: var(--unified-border);
    border-top: var(--unified-border);
    border-left: var(--unified-border);
  }
  
  .card footer p {
    /* 暗色模式下的 footer 文本 - 高对比度 */
    background: linear-gradient(135deg, var(--color-text-light) 0%, var(--el-text-color-primary) 50%, var(--color-text-light) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--color-text-light);
  }
  
  .card footer .bold {
    /* 暗色模式下的加粗文本 - 更亮的灰色 */
    background: linear-gradient(135deg, var(--ai-gray-1) 0%, var(--el-text-color-placeholder) 50%, var(--ai-gray-1) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--ai-gray-1);
  }

  .card::before {
    /* 暗色模式下的内部光晕效果 */
    background: radial-gradient(
      ellipse at center,
      var(--color-white-8) 0%,
      var(--color-white-4) 30%,
      var(--color-black-10) 70%,
      var(--color-black-20) 100%
    );
  }
  
  /* 暗色模式下的 hover 卡片 */
  .wrap:hover .card {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(0) scale3d(1.02, 1.02, 1.02);

    /* 暗色模式：hover 时的阴影增强效果 */
    border-color: var(--border-unified-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .outline::before {
    /* 更优雅的暗色模式渐变 */
    background: radial-gradient(
      ellipse at center,
      var(--color-white-18) 0%,
      var(--gradient-gray-9) 20%,
      var(--gradient-gray-11) 35%,
      var(--gradient-gray-12) 50%,
      var(--gradient-gray-13) 65%,
      transparent 80%
    );
    opacity: 0.6; /* 提高不透明度 */
  }

  .wave::before,
  .wave::after {
    /* 暗色模式下使用更亮的灰色边框 */
    border-color: var(--border-unified-color);
    opacity: 0.8;
  }

  .circle-1 {
    /* 更优雅的暗色模式渐变背景 */
    background: radial-gradient(
      circle at 30% 30%,
      var(--gradient-dark-1) 0%,
      var(--color-dark-overlay-1) 40%,
      var(--gradient-dark-2) 100%
    );
    border: var(--unified-border);
    border-top: var(--unified-border);
    border-left: var(--unified-border);
  }

  .circle-1::before {
    background: var(--color-gray-transparent-4);
    opacity: 0.5; /* 提高不透明度 */
  }

  .circle-1::after {
    background: var(--color-gray-transparent-6);
    opacity: 0.4; /* 提高不透明度 */
  }

  .circle-1 .lines svg {
    stroke: var(--color-gray-200-80); /* 使用更亮的灰色 */
    opacity: 0.8; /* 提高不透明度 */
  }

  .circle-2 {
    /* 更优雅的暗色模式渐变背景 */
    background: radial-gradient(
      circle at 30% 30%,
      var(--gradient-dark-3) 0%,
      var(--gradient-dark-4) 50%,
      var(--color-dark-overlay-1) 100%
    );

    /* 更精致的暗色模式边框和阴影 */
    border: var(--unified-border);
    border-top: var(--unified-border);
    border-left: var(--unified-border);
    }

  .circle-2::before {
    background: var(--color-gray-transparent-5);
    opacity: 0.6; /* 提高不透明度 */
  }

  .circle-2::after {
    background: var(--color-gray-glow);
    opacity: 0.5; /* 提高不透明度 */
  }
  
  .circle-2 .bg {
    /* 更优雅的暗色模式渐变背景 */
    background: linear-gradient(
      135deg,
      var(--gradient-dark-6) 0%,
      var(--gradient-dark-7) 40%,
      var(--gradient-dark-5) 60%,
      var(--gradient-dark-8) 100%
    );

    /* 使用全局唯一投影 */
    }

  .circle-2 .bg::before {
    background: var(--color-gray-100-20);
  }

  /* 暗色模式下的 footer 文本样式 */
  .card footer {
    background: transparent;
  }

  .card footer p {
    /* 暗色模式下使用白色文字阴影，确保在深色背景下可见 */

   /* 移除文本投影 */
  }
}
</style>
