package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.OperateTokenFlow;
import org.apache.ibatis.annotations.Mapper;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface OperateTokenFlowRepository extends JpaRepository<OperateTokenFlow, Long> { // Removed extends
@Mapper
public interface OperateTokenFlowMapper { // Renamed to OperateTokenFlowMapper

    // 插入 token 流水记录 (Service 层调用)
    int insert(OperateTokenFlow flow);

    OperateTokenFlow getById(Long id);

    // Removed method not called by ResourceService:
    // int insertOperateTokenFlow(OperateTokenFlow operateTokenFlow);

    // TODO: Add other methods if needed from PHP analysis (e.g., selectById, selectByUserId, etc.)
} 