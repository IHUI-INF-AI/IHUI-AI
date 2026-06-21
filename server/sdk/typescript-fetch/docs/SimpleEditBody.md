
# SimpleEditBody

Simple image editing (background removal, etc.).

## Properties

Name | Type
------------ | -------------
`images` | string
`prompt` | string
`model` | string
`negativePrompt` | string
`promptExtend` | boolean
`watermark` | boolean
`sync` | boolean

## Example

```typescript
import type { SimpleEditBody } from ''

// TODO: Update the object below with actual values
const example = {
  "images": null,
  "prompt": null,
  "model": null,
  "negativePrompt": null,
  "promptExtend": null,
  "watermark": null,
  "sync": null,
} satisfies SimpleEditBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SimpleEditBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


