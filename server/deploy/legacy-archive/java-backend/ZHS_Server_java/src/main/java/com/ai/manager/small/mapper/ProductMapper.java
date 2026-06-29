package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// import java.util.Optional;

import java.util.List;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface ProductRepository extends JpaRepository<Product, Long> { // Removed extends
@Mapper
public interface ProductMapper { // Renamed to ProductMapper

    // TODO: 将原 ProductRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 ProductRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // Optional<Product> findById(Long id);

    // MyBatis 方法定义
    Product selectById(Long id);

    // Method required by ResourceService -> selectsGoods
    List<Product> selectByType(@Param("type") Integer type);

    // TODO: Add other methods if needed from PHP analysis (e.g., selectAll, insert, update, delete)
} 