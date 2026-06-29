package com.ai.manager;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication(scanBasePackages = "com.ai.manager.**")
@MapperScan(value = "com.ai.manager.**.mapper")
@EnableCaching // 开启缓存注解支持
public class ZhsServerJavaApplication {
	public static void main(String[] args) {
		SpringApplication.run(ZhsServerJavaApplication.class, args);
	}

//	// 静态内部配置类
//	@Configuration
//	static class WebConfig implements WebMvcConfigurer {
//		@Override
//		public void addInterceptors(InterceptorRegistry registry) {
//			registry.addInterceptor(new LoggingInterceptor())
//					.addPathPatterns("/**")
//					.excludePathPatterns("/public/**", "/login");
//		}
//	}
}
