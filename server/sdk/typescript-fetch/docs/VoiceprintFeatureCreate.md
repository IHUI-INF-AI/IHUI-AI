
# VoiceprintFeatureCreate

Add voiceprint feature request.

## Properties

Name | Type
------------ | -------------
`name` | string
`desc` | string
`audioUrl` | string
`audioBase64` | string

## Example

```typescript
import type { VoiceprintFeatureCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "desc": null,
  "audioUrl": null,
  "audioBase64": null,
} satisfies VoiceprintFeatureCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VoiceprintFeatureCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


