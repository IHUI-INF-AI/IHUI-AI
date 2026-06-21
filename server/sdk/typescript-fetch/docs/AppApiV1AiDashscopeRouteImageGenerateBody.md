
# AppApiV1AiDashscopeRouteImageGenerateBody

Image generation request body.

## Properties

Name | Type
------------ | -------------
`prompt` | string
`negativePrompt` | string
`size` | string
`n` | number
`style` | string
`sync` | boolean
`zidingyican` | Array&lt;{ [key: string]: any; }&gt;

## Example

```typescript
import type { AppApiV1AiDashscopeRouteImageGenerateBody } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "negativePrompt": null,
  "size": null,
  "n": null,
  "style": null,
  "sync": null,
  "zidingyican": null,
} satisfies AppApiV1AiDashscopeRouteImageGenerateBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AppApiV1AiDashscopeRouteImageGenerateBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


