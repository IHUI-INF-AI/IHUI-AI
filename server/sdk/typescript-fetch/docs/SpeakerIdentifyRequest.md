
# SpeakerIdentifyRequest

Speaker identification request.

## Properties

Name | Type
------------ | -------------
`groupId` | string
`audioUrl` | string
`audioBase64` | string

## Example

```typescript
import type { SpeakerIdentifyRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "groupId": null,
  "audioUrl": null,
  "audioBase64": null,
} satisfies SpeakerIdentifyRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SpeakerIdentifyRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


