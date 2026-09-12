/**
 * URL e chave do Supabase, sempre sem espaço em volta.
 *
 * O .trim() não é paranoia: um \n no fim da chave passa despercebido no
 * SSR (vai em header, que o servidor tolera) e só quebra o Realtime, que
 * manda a chave na query string do WebSocket — vira %0A e a conexão é
 * recusada com "HTTP Authentication failed". Foi exatamente o que
 * aconteceu em produção quando a variável foi colada com Enter no fim.
 *
 * As duas são NEXT_PUBLIC_: embutidas no bundle em build time, públicas
 * por definição. Quem protege os dados são as RLS, não o segredo delas.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
