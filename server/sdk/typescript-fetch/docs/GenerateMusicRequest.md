
# GenerateMusicRequest


## Properties

Name | Type
------------ | -------------
`prompt` | string
`mv` | string
`style` | string
`title` | string
`duration` | number
`instrumental` | boolean

## Example

```typescript
import type { GenerateMusicRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "mv": null,
  "style": null,
  "title": null,
  "duration": null,
  "instrumental": null,
} satisfies GenerateMusicRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GenerateMusicRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


