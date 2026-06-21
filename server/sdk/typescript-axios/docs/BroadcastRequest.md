# BroadcastRequest

广播消息体.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**message** | **{ [key: string]: any; }** | 要广播的消息内容 | [default to undefined]
**room_id** | **string** | 指定房间ID，为空则全局广播 | [optional] [default to undefined]

## Example

```typescript
import { BroadcastRequest } from './api';

const instance: BroadcastRequest = {
    message,
    room_id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
