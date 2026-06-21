
# LipSyncBody

Lip-sync creation request body.

## Properties

Name | Type
------------ | -------------
`userUuid` | string
`sessionId` | string
`videoId` | string
`videoUrl` | string
`faceChoose` | any
`externalTaskId` | string
`callbackUrl` | string
`chatId` | string

## Example

```typescript
import type { LipSyncBody } from ''

// TODO: Update the object below with actual values
const example = {
  "userUuid": null,
  "sessionId": null,
  "videoId": null,
  "videoUrl": null,
  "faceChoose": null,
  "externalTaskId": null,
  "callbackUrl": null,
  "chatId": null,
} satisfies LipSyncBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LipSyncBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


