
# LipSyncOneShotBody

One-shot lip-sync: auto identify + create + poll.

## Properties

Name | Type
------------ | -------------
`userUuid` | string
`videoId` | string
`videoUrl` | string
`faceId` | string
`audioId` | string
`soundFile` | string
`soundStartTime` | number
`soundEndTime` | number
`soundInsertTime` | number
`soundVolume` | number
`originalAudioVolume` | number
`externalTaskId` | string
`callbackUrl` | string
`chatId` | string

## Example

```typescript
import type { LipSyncOneShotBody } from ''

// TODO: Update the object below with actual values
const example = {
  "userUuid": null,
  "videoId": null,
  "videoUrl": null,
  "faceId": null,
  "audioId": null,
  "soundFile": null,
  "soundStartTime": null,
  "soundEndTime": null,
  "soundInsertTime": null,
  "soundVolume": null,
  "originalAudioVolume": null,
  "externalTaskId": null,
  "callbackUrl": null,
  "chatId": null,
} satisfies LipSyncOneShotBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LipSyncOneShotBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


