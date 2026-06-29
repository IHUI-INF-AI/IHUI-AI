package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.ZhsAgent;
import com.ai.manager.small.domain.Resource;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ResourceMapper {

    // 根据ID查询资源 (Service 层调用)
    Resource findById(@Param("id") Long id);

    // 查询所有资源 (Service 层调用)
    List<Resource> findAll();

    // 插入新资源 (Service 层调用)
    int insert(Resource resource);

    // 更新现有资源 (Service 层调用)
    int update(Resource resource);

    // 根据ID删除资源 (Service 层调用)
    int deleteById(@Param("id") Long id);

    List<ZhsAgent> getAgentList(@Param("id") String id);

    // Removed methods not called by ResourceService:
    // List<Resource> findByType(@Param("type") String type);
    // List<Resource> findByNameContaining(@Param("name") String name);

    // TODO: Add other methods if needed
}