self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/api/ai-skills/:path*"
      },
      {
        "source": "/api/publish/:path*"
      },
      {
        "source": "/api/llm/:path*"
      },
      {
        "source": "/api/mcp/:path*"
      },
      {
        "source": "/api/agents/:path*"
      },
      {
        "source": "/api/browser/sessions/:path*"
      },
      {
        "source": "/api/:path*"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()