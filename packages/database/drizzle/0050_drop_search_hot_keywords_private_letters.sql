-- 0050: Drop dead tables with replacements
-- search_hot_keywords → replaced by hot_words (misc-extended-2.ts)
-- private_letter_sessions + private_letter_messages → replaced by message_private_letter (relation-tables.ts)

DROP TABLE IF EXISTS "search_hot_keywords" CASCADE;
DROP TABLE IF EXISTS "private_letter_messages" CASCADE;
DROP TABLE IF EXISTS "private_letter_sessions" CASCADE;
