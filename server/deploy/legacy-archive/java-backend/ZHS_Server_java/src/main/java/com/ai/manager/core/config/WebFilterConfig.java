package com.ai.manager.core.config;

import com.ai.manager.core.filter.RequestWrapperFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Web过滤器配置类
 */
@Configuration
public class WebFilterConfig {

    /**
     * 注册请求包装过滤器
     */
    @Bean
    public FilterRegistrationBean<RequestWrapperFilter> requestWrapperFilter() {
        FilterRegistrationBean<RequestWrapperFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new RequestWrapperFilter());
        registrationBean.addUrlPatterns("/*"); // 应用到所有URL
        registrationBean.setOrder(1); // 设置为最高优先级
        return registrationBean;
    }
}