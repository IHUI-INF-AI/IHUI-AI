
# DoubaoImageRequest

Request body for doubao image generation (jimeng_t2i_v40 via Volcengine signed API).

## Properties

Name | Type
------------ | -------------
`prompt` | string
`userUuid` | string
`chatId` | string
`zidingyican` | [Array&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;](AppApiV1AiDoubaoRouteCustomParameter.md)

## Example

```typescript
import type { DoubaoImageRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "userUuid": null,
  "chatId": null,
  "zidingyican": null,
} satisfies DoubaoImageRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DoubaoImageRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


