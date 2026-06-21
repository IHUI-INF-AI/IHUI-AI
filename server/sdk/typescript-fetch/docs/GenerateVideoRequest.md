
# GenerateVideoRequest


## Properties

Name | Type
------------ | -------------
`prompt` | string
`images` | Array&lt;string&gt;
`model` | string
`aspectRatio` | string
`enhancePrompt` | boolean
`enableUpsample` | boolean

## Example

```typescript
import type { GenerateVideoRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "images": null,
  "model": null,
  "aspectRatio": null,
  "enhancePrompt": null,
  "enableUpsample": null,
} satisfies GenerateVideoRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GenerateVideoRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


