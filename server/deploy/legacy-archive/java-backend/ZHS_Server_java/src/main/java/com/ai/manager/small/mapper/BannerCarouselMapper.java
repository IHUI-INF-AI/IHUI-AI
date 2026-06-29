package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.BannerCarousel;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface BannerCarouselRepository extends JpaRepository<BannerCarousel, Long> { // Removed extends
@Mapper
public interface BannerCarouselMapper { // Renamed to BannerCarouselMapper

    // TODO: 将原 BannerCarouselRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 BannerCarouselRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // List<BannerCarousel> findAll();

    // Method required by ResourceService -> getBanner (based on PHP logic)
    List<BannerCarousel> selectByType(@Param("type") Integer type, @Param("position") Integer position);

    // Method required by ResourceService -> getBanner (current implementation in Service)
    List<BannerCarousel> selectAll(); // 获取所有轮播图
    // TODO: 根据实际需求添加其他查询方法 (如按状态查询等)

    // TODO: Add methods for any other BannerCarousel related operations from PHP if needed
} 