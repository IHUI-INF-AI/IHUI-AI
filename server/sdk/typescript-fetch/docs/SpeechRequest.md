
# SpeechRequest

TTS request body.

## Properties

Name | Type
------------ | -------------
`text` | string
`voiceId` | string
`responseFormat` | string
`rate` | string
`volume` | string
`pitch` | string

## Example

```typescript
import type { SpeechRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "text": null,
  "voiceId": null,
  "responseFormat": null,
  "rate": null,
  "volume": null,
  "pitch": null,
} satisfies SpeechRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SpeechRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


