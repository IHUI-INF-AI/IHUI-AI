
# BodyDoubaoImageEdit


## Properties

Name | Type
------------ | -------------
`model` | string
`imageUrl` | string
`imageBase64` | string
`prompt` | string
`seed` | number
`guidanceScale` | number
`watermark` | boolean

## Example

```typescript
import type { BodyDoubaoImageEdit } from ''

// TODO: Update the object below with actual values
const example = {
  "model": null,
  "imageUrl": null,
  "imageBase64": null,
  "prompt": null,
  "seed": null,
  "guidanceScale": null,
  "watermark": null,
} satisfies BodyDoubaoImageEdit

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BodyDoubaoImageEdit
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


