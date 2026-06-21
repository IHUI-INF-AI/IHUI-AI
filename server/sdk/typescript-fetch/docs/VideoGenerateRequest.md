
# VideoGenerateRequest

Request body for doubao video generation.

## Properties

Name | Type
------------ | -------------
`prompt` | string
`images` | Array&lt;any&gt;
`userUuid` | string
`chatId` | string
`zidingyican` | Array&lt;any&gt;

## Example

```typescript
import type { VideoGenerateRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "images": null,
  "userUuid": null,
  "chatId": null,
  "zidingyican": null,
} satisfies VideoGenerateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VideoGenerateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


