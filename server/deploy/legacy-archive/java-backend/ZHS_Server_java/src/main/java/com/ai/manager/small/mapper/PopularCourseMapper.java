package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.PopularCourse;
import com.ai.manager.small.domain.dto.PopularCourseCriteria; // Import the new Criteria DTO
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface PopularCourseRepository extends JpaRepository<PopularCourse, Long> { // Removed extends
@Mapper
public interface PopularCourseMapper { // Renamed to PopularCourseMapper

    // TODO: 将原 PopularCourseRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 PopularCourseRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // List<PopularCourse> findAll();

    // MyBatis 方法定义
    List<PopularCourse> selectAll(PopularCourse popularCourse); // 获取所有热门课程

    // 合并后的通用查询方法
    List<PopularCourse> selectCoursesByCriteria(PopularCourseCriteria criteria); // New method

    List<PopularCourse> selectByType(@Param("type") Integer type, @Param("timeOrVisitors") Integer timeOrVisitors, @Param("limit") Integer limit);

    // 旧的、可以合并的方法（已注释）
    // List<PopularCourse> selectByTypeOrderByTimeDescLimit(@Param("type") Integer type, @Param("limit") int limit);
    // List<PopularCourse> selectOrderByNumberOfVisitorsDescLimit(@Param("limit") int limit);
    // List<PopularCourse> selectAllWithLimit(@Param("limit") int limit);
    // List<PopularCourse> selectByTypeWithLimit(@Param("type") Integer type, @Param("limit") int limit);

    // TODO: 根据实际需求添加其他查询方法 (如按人气、分类查询等)

    // TODO: Add methods for pagination if needed by getCoursePlanet
    // List<PopularCourse> selectPage(@Param("offset") int offset, @Param("limit") int limit);
    // int countAll();
    // List<PopularCourse> selectPageByType(@Param("type") Integer type, @Param("offset") int offset, @Param("limit") int limit);
    // int countByType(@Param("type") Integer type);

    // TODO: Add methods for any other PopularCourse related operations from PHP if needed
} 