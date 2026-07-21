// ================================================================
// services/supabase.js
// Supabase client — loaded after the CDN <script> in index.html.
// window.supabase is the global library from the CDN.
// ================================================================

const SUPABASE_URL  = 'https://bfxxywxhydxvccusjinm.supabase.co';
const SUPABASE_ANON = 'sb_publishable_SUqEFfWRinmwNm1sj_VEHA___3FEuJh';

const zeloSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
