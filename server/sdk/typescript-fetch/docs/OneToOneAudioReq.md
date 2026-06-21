
# OneToOneAudioReq


## Properties

Name | Type
------------ | -------------
`botId` | string
`userId` | string
`conversationId` | string
`audioData` | string
`voiceId` | string

## Example

```typescript
import type { OneToOneAudioReq } from ''

// TODO: Update the object below with actual values
const example = {
  "botId": null,
  "userId": null,
  "conversationId": null,
  "audioData": null,
  "voiceId": null,
} satisfies OneToOneAudioReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OneToOneAudioReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


