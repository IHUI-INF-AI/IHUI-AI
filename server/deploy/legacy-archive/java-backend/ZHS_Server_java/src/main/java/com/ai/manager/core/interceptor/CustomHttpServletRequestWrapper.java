package com.ai.manager.core.interceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 自定义请求包装器，用于在请求中添加自定义请求头
 */
public class CustomHttpServletRequestWrapper extends HttpServletRequestWrapper {
    
    private final Map<String, String> customHeaders;
    
    public CustomHttpServletRequestWrapper(HttpServletRequest request) {
        super(request);
        this.customHeaders = new HashMap<>();
    }
    
    public void addHeader(String name, String value) {
        customHeaders.put(name, value);
    }
    
    @Override
    public String getHeader(String name) {
        String headerValue = customHeaders.get(name);
        if (headerValue != null) {
            return headerValue;
        }
        return super.getHeader(name);
    }
    
    @Override
    public Enumeration<String> getHeaderNames() {
        Set<String> set = new HashSet<>(customHeaders.keySet());
        Enumeration<String> e = super.getHeaderNames();
        while (e.hasMoreElements()) {
            set.add(e.nextElement());
        }
        return Collections.enumeration(set);
    }
    
    @Override
    public Enumeration<String> getHeaders(String name) {
        Set<String> set = new HashSet<>();
        Enumeration<String> e = super.getHeaders(name);
        while (e.hasMoreElements()) {
            set.add(e.nextElement());
        }
        
        String customHeader = customHeaders.get(name);
        if (customHeader != null) {
            set.add(customHeader);
        }
        
        return Collections.enumeration(set);
    }
}