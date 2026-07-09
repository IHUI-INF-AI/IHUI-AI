import { describe, it, expect } from 'vitest';
import { parseLine } from '../use-chat';

describe('parseLine SSE 解析器', () => {
  it('空行返回 null', () => {
    expect(parseLine('')).toBeNull();
  });

  it('SSE 注释行(冒号开头)返回 null', () => {
    expect(parseLine(': heartbeat')).toBeNull();
    expect(parseLine(':keep-alive')).toBeNull();
  });

  it('event/id/retry 元信息行返回 null', () => {
    expect(parseLine('event: chunk')).toBeNull();
    expect(parseLine('id: 12345')).toBeNull();
    expect(parseLine('retry: 5000')).toBeNull();
  });

  it('data: [DONE] 返回 null', () => {
    expect(parseLine('data: [DONE]')).toBeNull();
  });

  it('OpenAI 风格 SSE delta content 解析成功', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hello"}}]}';
    expect(parseLine(line)).toBe('hello');
  });

  it('OpenAI 风格 SSE message content 解析成功', () => {
    const line = 'data: {"choices":[{"message":{"content":"world"}}]}';
    expect(parseLine(line)).toBe('world');
  });

  it('ai-service 风格 {"content":"..."} 解析成功', () => {
    const line = 'data: {"type":"chunk","content":"你好"}';
    expect(parseLine(line)).toBe('你好');
  });

  it('Vercel AI SDK 0:"text" 协议解析成功', () => {
    const line = '0:"Vercel token"';
    expect(parseLine(line)).toBe('Vercel token');
  });

  it('Vercel AI SDK 非 0 类型返回 null', () => {
    expect(parseLine('1:{"tool":"search"}')).toBeNull();
    expect(parseLine('2:{"finish":true}')).toBeNull();
  });

  it('非 JSON 裸文本返回内容', () => {
    expect(parseLine('data: 纯文本内容')).toBe('纯文本内容');
    expect(parseLine('裸文本无前缀')).toBe('裸文本无前缀');
  });

  it('SSE error 事件抛出 SSEError(含 message)', () => {
    const line = 'data: {"type":"error","message":"LLM 调用超时"}';
    expect(() => parseLine(line)).toThrow('LLM 调用超时');
  });

  it('LLM gateway error 响应抛出 SSEError(含 error_message)', () => {
    const line = 'data: {"error":true,"error_message":"provider key 未配置"}';
    expect(() => parseLine(line)).toThrow('provider key 未配置');
  });

  it('JSON 含 choices 但无 delta/message 内容返回 null', () => {
    const line = 'data: {"choices":[{"delta":{}}]}';
    expect(parseLine(line)).toBeNull();
  });

  it('JSON 含 delta 字符串字段解析成功', () => {
    const line = 'data: {"delta":"streaming text"}';
    expect(parseLine(line)).toBe('streaming text');
  });

  it('JSON 含 text 字符串字段解析成功', () => {
    const line = 'data: {"text":"plain text"}';
    expect(parseLine(line)).toBe('plain text');
  });

  it('data: 前缀后无空格也能解析', () => {
    const line = 'data:{"content":"no space"}';
    expect(parseLine(line)).toBe('no space');
  });

  it('done 事件(无 content 字符串)返回 null', () => {
    const line = 'data: {"type":"done","model":"step-3.7-flash","usage":{"total_tokens":100}}';
    expect(parseLine(line)).toBeNull();
  });
});
