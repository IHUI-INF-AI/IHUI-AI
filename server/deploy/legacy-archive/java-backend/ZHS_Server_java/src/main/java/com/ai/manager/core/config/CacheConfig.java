package com.ai.manager.core.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        // 默认缓存配置（过期时间 30 分钟）
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30)) // 过期时间
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer())) // 键序列化
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer())) // 值序列化
                .disableCachingNullValues(); // 不缓存 null 值

        // 自定义缓存配置（针对不同缓存名称设置不同过期时间）
        Map<String, RedisCacheConfiguration> configMap = new HashMap<>();
        configMap.put("userCache", defaultConfig.entryTtl(Duration.ofHours(1))); // userCache 缓存 1 小时
        configMap.put("productCache", defaultConfig.entryTtl(Duration.ofMinutes(10))); // productCache 缓存 10 分钟

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig) // 默认配置
                .withInitialCacheConfigurations(configMap) // 自定义配置
                .build();
    }
}