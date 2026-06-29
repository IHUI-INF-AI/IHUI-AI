package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.ExchangeRate;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Long> { // Removed extends
@Mapper
public interface ExchangeRateMapper { // Renamed to ExchangeRateMapper

    // TODO: 将原 ExchangeRateRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 ExchangeRateRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // Optional<ExchangeRate> findByCurrencyPair(String currencyPair);

    // 获取所有汇率记录 (Service 层调用)
    List<ExchangeRate> selectAll();

    // TODO: Add other methods if needed from PHP analysis (e.g., selectById, insert, update, delete)
} 