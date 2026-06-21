
# RecognizeRequest

ASR request body — accepts a URL or base64-encoded audio.

## Properties

Name | Type
------------ | -------------
`audioUrl` | string
`audioBase64` | string
`model` | string
`language` | string
`sampleRate` | number

## Example

```typescript
import type { RecognizeRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "audioUrl": null,
  "audioBase64": null,
  "model": null,
  "language": null,
  "sampleRate": null,
} satisfies RecognizeRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RecognizeRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


