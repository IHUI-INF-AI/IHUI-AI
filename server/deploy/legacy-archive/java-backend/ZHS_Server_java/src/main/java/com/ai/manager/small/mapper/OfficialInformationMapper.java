package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.OfficialInformation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface OfficialInformationMapper {

    // 根据 popular_course_id 查询资讯列表 (Service 层调用)
    List<OfficialInformation> selectByPopularCourseId(@Param("popularCourseId") Long popularCourseId);

    // 插入资讯记录 (Service 层调用)
    int insert(OfficialInformation info);

    // TODO: Add other methods if needed from PHP analysis (e.g., selectById, update, delete)
}