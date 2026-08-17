import postgres from 'postgres';

const sql = postgres('postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui');

try {
  // Check all columns
  const cols = await sql`SELECT column_name, data_type, character_maximum_length, column_default FROM information_schema.columns WHERE table_name IN ('chat_conversations', 'chat_messages', 'srs_servers') ORDER BY table_name, ordinal_position`;
  for (const c of cols) {
    console.log(`${c.table_name}.${c.column_name}: ${c.data_type}${c.character_maximum_length ? '('+c.character_maximum_length+')' : ''} default=${c.column_default ?? 'none'}`);
  }

  // Check constraints
  const cons = await sql`SELECT conname, contype FROM pg_constraint WHERE conrelid IN ('chat_conversations'::regclass, 'chat_messages'::regclass, 'srs_servers'::regclass) ORDER BY conrelid::regclass::text, conname`;
  for (const c of cons) {
    console.log(`constraint: ${c.conname} (${c.contype === 'u' ? 'UNIQUE' : c.contype === 'f' ? 'FOREIGN KEY' : c.contype})`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
}
