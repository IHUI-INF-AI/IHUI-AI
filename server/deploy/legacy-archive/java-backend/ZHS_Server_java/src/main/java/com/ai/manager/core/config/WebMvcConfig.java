package com.ai.manager.core.config;

import com.ai.manager.core.interceptor.LoginInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LoginInterceptor())
                .addPathPatterns("/**") // 拦截所有请求
                .excludePathPatterns("/static/**",
                        "/error",
                        "/login/login",
                        "/login/getOpenId",
                        "/resource/banner",
                        "/resource/getHomePageResources",
                        "/resource/recharge",
                        "/agent-websocket",
                        "/login/getPhoneNumber"); // 排除静态资源和错误页面
    }
}