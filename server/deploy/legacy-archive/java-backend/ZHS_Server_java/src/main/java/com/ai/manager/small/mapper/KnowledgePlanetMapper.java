package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.KnowledgePlanet;
import com.ai.manager.small.domain.dto.KnowledgePlanetCriteria;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface KnowledgePlanetRepository extends JpaRepository<KnowledgePlanet, Long> { // Removed extends
@Mapper
public interface KnowledgePlanetMapper { // Renamed to KnowledgePlanetMapper

    // TODO: 将原 KnowledgePlanetRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 KnowledgePlanetRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // List<KnowledgePlanet> findAll();

    // MyBatis 方法定义
    // List<KnowledgePlanet> selectAll(); // 获取所有知识星球

    // 通用查询方法（Service 层广泛调用）
    List<KnowledgePlanet> selectPlanetsByCriteria(KnowledgePlanetCriteria criteria);

    // 旧的、可以合并或未使用的废弃方法（Service层不再调用）
    // List<KnowledgePlanet> selectByType(@Param("type") Integer type);
    // List<KnowledgePlanet> selectByTypeOrderByNumberOfVisitorsDescLimit(@Param("type") Integer type, @Param("limit") int limit);
    // List<KnowledgePlanet> selectByTypeWithLimit(@Param("type") Integer type, @Param("limit") int limit);
    // List<KnowledgePlanet> selectByTypeAndStatusOrderByLikesDescLimit(@Param("type") Integer type, @Param("status") Integer status, @Param("limit") int limit);
    // List<KnowledgePlanet> selectPageByType(@Param("type") Integer type, @Param("offset") int offset, @Param("limit") int limit);
    // int countByType(@Param("type") Integer type);
    // List<KnowledgePlanet> selectPageAll(@Param("offset") int offset, @Param("limit") int limit);
    // int countAll();

    // 插入知识星球记录 (addSharePlanetPublicBatch 调用)
    int insert(KnowledgePlanet planet);

    // TODO: Add methods for pagination if needed by getKnowledgePlanet
    // List<KnowledgePlanet> selectPageByType(@Param("type") Integer type, @Param("offset") int offset, @Param("limit") int limit);
    // int countByType(@Param("type") Integer type);
    // List<KnowledgePlanet> selectPageAll(@Param("offset") int offset, @Param("limit") int limit);
    // int countAll();

    // TODO: Add methods for any other KnowledgePlanet related operations from PHP if needed
} 