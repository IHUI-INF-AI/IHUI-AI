
# ImageToVideoBody

Image-to-video generation request body.

## Properties

Name | Type
------------ | -------------
`modelName` | string
`image` | string
`prompt` | string
`negativePrompt` | string
`duration` | string
`mode` | string
`cfgScale` | number

## Example

```typescript
import type { ImageToVideoBody } from ''

// TODO: Update the object below with actual values
const example = {
  "modelName": null,
  "image": null,
  "prompt": null,
  "negativePrompt": null,
  "duration": null,
  "mode": null,
  "cfgScale": null,
} satisfies ImageToVideoBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ImageToVideoBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


