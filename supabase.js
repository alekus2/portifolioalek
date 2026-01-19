import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://atjeaedbncwcgkwfnrmr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lXnKm0nBA8HC-6clDXTAYw_f8-xXiNe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
