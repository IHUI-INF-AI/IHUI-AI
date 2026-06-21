
# AudioChatRequest

Audio chat request — voice or text input, returns text + audio.

## Properties

Name | Type
------------ | -------------
`text` | string
`audioBase64` | string
`audioUrl` | string
`botId` | string
`voiceId` | string
`model` | string
`language` | string
`systemPrompt` | string

## Example

```typescript
import type { AudioChatRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "text": null,
  "audioBase64": null,
  "audioUrl": null,
  "botId": null,
  "voiceId": null,
  "model": null,
  "language": null,
  "systemPrompt": null,
} satisfies AudioChatRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AudioChatRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


