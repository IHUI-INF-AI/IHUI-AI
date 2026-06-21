
# ImageEditBody

Image edit request body (standard, with optional mask).

## Properties

Name | Type
------------ | -------------
`baseImageUrl` | string
`maskImageUrl` | string
`prompt` | string
`model` | string

## Example

```typescript
import type { ImageEditBody } from ''

// TODO: Update the object below with actual values
const example = {
  "baseImageUrl": null,
  "maskImageUrl": null,
  "prompt": null,
  "model": null,
} satisfies ImageEditBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ImageEditBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


