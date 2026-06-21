
# AppApiV1ChatKlingImageGenerateBody

Text-to-image generation request body.

## Properties

Name | Type
------------ | -------------
`prompt` | string
`modelName` | string
`n` | number
`aspectRatio` | string
`negativePrompt` | string

## Example

```typescript
import type { AppApiV1ChatKlingImageGenerateBody } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "modelName": null,
  "n": null,
  "aspectRatio": null,
  "negativePrompt": null,
} satisfies AppApiV1ChatKlingImageGenerateBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AppApiV1ChatKlingImageGenerateBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


