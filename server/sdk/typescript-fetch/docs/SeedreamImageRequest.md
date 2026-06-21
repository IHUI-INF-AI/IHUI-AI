
# SeedreamImageRequest

Request body for Seedream image generation (via Doubao Bearer token API).

## Properties

Name | Type
------------ | -------------
`prompt` | string
`userUuid` | string
`chatId` | string
`images` | string
`zidingyican` | [Array&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;](AppApiV1AiDoubaoRouteCustomParameter.md)

## Example

```typescript
import type { SeedreamImageRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "userUuid": null,
  "chatId": null,
  "images": null,
  "zidingyican": null,
} satisfies SeedreamImageRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SeedreamImageRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


