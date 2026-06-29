package com.ai.manager.small.mapper;


import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.*;



@Mapper
@DS("center")
public interface AgentUploadCenterMapper {




    // 查询用户token_quantity
    @Select("SELECT token_quantity FROM user_margin WHERE user_uuid = #{userUuid}")
    Integer selectTokenQuantityByUserUuid(String userUuid);


    // 更新token_quantity
    @Update("UPDATE user_margin SET token_quantity = #{tokenQuantity} WHERE user_uuid = #{userUuid}")
    void updateTokenQuantity(@Param("userUuid") String userUuid, @Param("tokenQuantity") int tokenQuantity);







}