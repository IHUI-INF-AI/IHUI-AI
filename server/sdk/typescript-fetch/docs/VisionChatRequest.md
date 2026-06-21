
# VisionChatRequest

Vision multi-modal chat request body.

## Properties

Name | Type
------------ | -------------
`images` | [Array&lt;VisionImageInfo&gt;](VisionImageInfo.md)
`prompt` | string
`model` | string
`maxTokens` | number

## Example

```typescript
import type { VisionChatRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "images": null,
  "prompt": null,
  "model": null,
  "maxTokens": null,
} satisfies VisionChatRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VisionChatRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


