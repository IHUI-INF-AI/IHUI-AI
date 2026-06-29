package com.ai.manager.core.filter;

import com.ai.manager.core.interceptor.CustomHttpServletRequestWrapper;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

/**
 * 请求包装过滤器，用于将原始请求包装成可添加自定义请求头的请求
 */
public class RequestWrapperFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // 初始化过滤器
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest) {
            // 包装原始请求
            CustomHttpServletRequestWrapper wrappedRequest = new CustomHttpServletRequestWrapper((HttpServletRequest) request);
            // 继续过滤器链
            chain.doFilter(wrappedRequest, response);
        } else {
            chain.doFilter(request, response);
        }
    }

    @Override
    public void destroy() {
        // 销毁过滤器
    }
}