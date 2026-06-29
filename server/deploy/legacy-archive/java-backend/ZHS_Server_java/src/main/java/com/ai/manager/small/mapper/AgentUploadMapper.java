package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.AgentUpload;
import com.ai.manager.small.domain.dto.AgentUploadDTO;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.*;

import java.util.Map;

@Mapper
@DS("master")
public interface AgentUploadMapper {
    int insertIntoAgentsUpload(AgentUploadDTO agentUploadDTO);
    int insertIntoAgents(@Param("dto") AgentUploadDTO agentUploadDTO, @Param("in") String in);
    int insertIntoZhsAgentExamine(AgentUploadDTO agentUploadDTO);


    //Map<String, Object> selectAgentVariablesByAgentId(@Param("agentId") String agentId);

    @Select("SELECT agent_id AS agentId, agent_name AS agentName, agent_description AS agentDescription, agent_avatar AS agentAvatar, agent_variables_in as agentVariablesIn, agent_variables_out as agentVariablesOut, agent_n8n_json AS agentN8nJson, agent_url as agentUrl, publish_status AS publishStatus, counting_unit AS countingUnit FROM agents_upload WHERE agent_id = #{agentId}")
    AgentUpload selectByAgentId(String agentId);

    @Select("SELECT stream_enabled FROM agents_upload WHERE agent_id = #{agentId}")
    Boolean selectStreamEnabled(@Param("agentId") String agentId);

    @Update("UPDATE agents_upload SET stream_enabled = #{streamEnabled} WHERE agent_id = #{agentId}")
    void updateStreamEnabled(@Param("agentId") String agentId, @Param("streamEnabled") Boolean streamEnabled);

    // 查询chat_id
    @Select("SELECT chat_id FROM zhs_user_agent_context WHERE user_uuid = #{userUuid}")
    String selectChatId(@Param("userUuid") String userUuid);

    // 插入视频宽高比
    @Update("INSERT INTO zhs_user_agent_context (agent_id, video_ratio) " +
            "VALUES (#{agentId}, #{videoRatio}) " +
            "ON DUPLICATE KEY UPDATE video_ratio = VALUES(video_ratio)")
    void updateVideoRatioByAgentId(@Param("agentId") String agentId,
                                   @Param("videoRatio") Double videoRatio);


    // 查询所有上下文
    @Select("SELECT * FROM zhs_user_agent_context WHERE chat_id = #{chatId} ORDER BY send_time DESC")
    Map<String, Object> selectAllContext(@Param("chatId") String chatId);

    // 插入一条新对话
    @Insert("INSERT INTO zhs_user_agent_context (id, agent_id, user_uuid, problem, answer, user_url, agent_url, send_time, model_name, chat_id, video_ratio) " +
            "VALUES (#{id}, #{agentId}, #{userUuid}, #{problem}, #{answer}, #{userUrl}, #{agentUrl}, #{sendTime}, #{modelName}, #{chatId}, #{videoRatio})")
    void insertNewContext(
            @Param("id") String id,
            @Param("agentId") String agentId,
            @Param("userUuid") String userUuid,
            @Param("problem") String problem,
            @Param("answer") String answer,
            @Param("userUrl") String userUrl,
            @Param("agentUrl") String agentUrl,
            @Param("sendTime") Long sendTime,
            @Param("modelName") String modelName,
            @Param("chatId") String chatId,
            @Param("videoRatio") String videoRatio
    );

    // 删除旧对话，同一个chatId下，有超过十条context，则删除最早的一条
    @Delete("DELETE u1 FROM zhs_user_agent_context u1 JOIN ( SELECT u2.id FROM zhs_user_agent_context u2 WHERE u2.chat_id = #{chatId} ORDER BY u2.send_time DESC LIMIT 10, 10 ) u3 ON u3.id = u1.id  WHERE u1.chat_id = #{chatId}")
    void deleteOldestContextWhenOverflow(@Param("chatId") String chatId);

}
