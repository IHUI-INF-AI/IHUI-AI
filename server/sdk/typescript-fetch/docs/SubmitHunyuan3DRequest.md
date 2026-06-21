
# SubmitHunyuan3DRequest


## Properties

Name | Type
------------ | -------------
`prompt` | string
`imageBase64` | string
`imageUrl` | string
`multiViewImages` | [Array&lt;ViewImage&gt;](ViewImage.md)
`resultFormat` | string
`enablePBR` | boolean

## Example

```typescript
import type { SubmitHunyuan3DRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "imageBase64": null,
  "imageUrl": null,
  "multiViewImages": null,
  "resultFormat": null,
  "enablePBR": null,
} satisfies SubmitHunyuan3DRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SubmitHunyuan3DRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


