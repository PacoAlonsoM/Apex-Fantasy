import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://vfbqhqkcxqxzliudgiop.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_AjDCt_olZnvs56F2lCvRJw_qrB4sCF8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
