
# BroadcastRequest

广播消息体.

## Properties

Name | Type
------------ | -------------
`message` | { [key: string]: any; }
`roomId` | string

## Example

```typescript
import type { BroadcastRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "message": null,
  "roomId": null,
} satisfies BroadcastRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BroadcastRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


