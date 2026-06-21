# Document Management API (migrated from client/backend-docs/)

Migrated from the original Java Spring Boot module. The Java sources
(`DocumentController.java`, `Document.java`, `MarkdownConverter.java`,
`document.sql`, `README.md`) lived in `client/backend-docs/` and have
been replaced with FastAPI equivalents in this directory.

## Features

- File upload (Word / Excel / PPT / PDF / TXT / Markdown)
- Automatic conversion to Markdown
- Document list / categories / delete

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/docs/upload` | Upload + convert to Markdown |
| GET | `/api/v1/docs/list` | List documents |
| GET | `/api/v1/docs/{id}` | Get a document |
| DELETE | `/api/v1/docs/{id}` | Delete a document |
| GET | `/api/v1/docs/categories` | List categories |

Legacy path compatibility: `/api/docs/*` is served directly at the original path;
no path rewriting is needed since the router is mounted at `/api/docs`.

## Migration notes

- Java POI / PDFBox logic was rewritten in pure Python (`app.services.markdown_converter`).
- The original `.java` files are preserved at `docs/superpowers/specs/2026-06-18-client-backend-to-server-migration-design.md` for reference.
- DB session is the canonical `app.database.get_session()` in production; this module exposes placeholders.
