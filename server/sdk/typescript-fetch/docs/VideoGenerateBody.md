
# VideoGenerateBody

Text-to-video generation request body.

## Properties

Name | Type
------------ | -------------
`prompt` | string
`modelName` | string
`duration` | string
`mode` | string
`aspectRatio` | string
`cfgScale` | number
`negativePrompt` | string
`cameraControl` | { [key: string]: any; }

## Example

```typescript
import type { VideoGenerateBody } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "modelName": null,
  "duration": null,
  "mode": null,
  "aspectRatio": null,
  "cfgScale": null,
  "negativePrompt": null,
  "cameraControl": null,
} satisfies VideoGenerateBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VideoGenerateBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


