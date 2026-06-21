
# AudioRecognizeRequest

Audio recognition request body.

## Properties

Name | Type
------------ | -------------
`audioUrl` | string
`model` | string
`language` | string
`enableLid` | boolean
`enableItn` | boolean
`systemPrompt` | string
`userUuid` | string
`userId` | string
`chatId` | string
`conversationId` | string
`asrOptions` | { [key: string]: any; }

## Example

```typescript
import type { AudioRecognizeRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "audioUrl": null,
  "model": null,
  "language": null,
  "enableLid": null,
  "enableItn": null,
  "systemPrompt": null,
  "userUuid": null,
  "userId": null,
  "chatId": null,
  "conversationId": null,
  "asrOptions": null,
} satisfies AudioRecognizeRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AudioRecognizeRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


