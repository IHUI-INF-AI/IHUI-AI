import type * as React from 'react';
import type { AgentRuntimeStatus, AgentRuntimePermissionEvent } from '@ihui/types';
export interface UseAgentRuntimeReturn {
    status: AgentRuntimeStatus;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    sessionId: string | null;
    plan: string | null;
    output: string;
    error: string | null;
    permission: AgentRuntimePermissionEvent | null;
    handleSend: () => Promise<void>;
    handleStop: () => void;
    handleClear: () => void;
}
/**
 * Agent 运行时业务逻辑 Hook(跨端共享)。
 *
 * 两端(mobile-rn + miniapp-taro)AgentRuntimePanel 组件原本各自实现
 * 完全相同的 handleSend/handleStop/handleClear + 状态管理逻辑,提取为共享 hook 消除重复。
 *
 * 各端组件只需 import 此 hook + 渲染 UI,无需重复业务逻辑。
 *
 * @param initialSessionId 初始会话 ID(可选)
 */
export declare function useAgentRuntime(initialSessionId?: string): UseAgentRuntimeReturn;
