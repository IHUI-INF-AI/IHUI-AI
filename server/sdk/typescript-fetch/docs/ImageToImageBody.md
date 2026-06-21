
# ImageToImageBody

Image-to-image transformation request body.

## Properties

Name | Type
------------ | -------------
`inputImageUrl` | string
`prompt` | string
`model` | string

## Example

```typescript
import type { ImageToImageBody } from ''

// TODO: Update the object below with actual values
const example = {
  "inputImageUrl": null,
  "prompt": null,
  "model": null,
} satisfies ImageToImageBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ImageToImageBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


