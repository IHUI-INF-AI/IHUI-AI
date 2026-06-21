
# VideoSynthesisRequest

Video synthesis request body (async task).

## Properties

Name | Type
------------ | -------------
`prompt` | string
`imageUrl` | string
`audioUrl` | string
`model` | string
`duration` | number
`resolution` | string
`zidingyican` | Array&lt;{ [key: string]: any; }&gt;

## Example

```typescript
import type { VideoSynthesisRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "imageUrl": null,
  "audioUrl": null,
  "model": null,
  "duration": null,
  "resolution": null,
  "zidingyican": null,
} satisfies VideoSynthesisRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VideoSynthesisRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


