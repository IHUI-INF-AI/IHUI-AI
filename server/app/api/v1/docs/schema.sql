-- Document management schema (migrated from client/backend-docs/document.sql)
-- Note: server uses SQLite/PostgreSQL via SQLAlchemy; this SQL is the
-- canonical reference for any manual DB inspection.

CREATE TABLE IF NOT EXISTS admin_document (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    content LONGTEXT,
    markdown LONGTEXT,
    size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_document_category (category),
    INDEX idx_document_created_at (created_at)
);
