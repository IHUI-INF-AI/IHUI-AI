package com.ai.manager.small.mapper;

// import org.springframework.data.jpa.repository.JpaRepository;

import com.ai.manager.small.domain.UserAgentFreeTimes;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// 将 JpaRepository 替换为标准的 Mapper 接口
// public interface UserAgentFreeTimesRepository extends JpaRepository<UserAgentFreeTimes, Long> { // Removed extends
@Mapper
public interface UserAgentFreeTimesMapper { // Renamed to UserAgentFreeTimesMapper

    // TODO: 将原 UserAgentFreeTimesRepository 中的方法转换为 MyBatis 方法，并实现 SQL
    // 原 UserAgentFreeTimesRepository 中的方法签名 (需要手动转换为 MyBatis 方法)
    // UserAgentFreeTimes save(UserAgentFreeTimes userAgentFreeTimes);

    // 根据 userId 和 agentId 查询记录
    UserAgentFreeTimes selectByUserIdAndAgentId(@Param("userId") Integer userId, @Param("agentId") Long agentId);

    // 更新记录
    int update(UserAgentFreeTimes entry);

    // 插入记录 (与 Service 层调用保持一致) -> PHP 原逻辑是 insert
    int insertUserAgentFreeTimes(UserAgentFreeTimes entry);

    // TODO: Add other methods if needed from PHP analysis
}