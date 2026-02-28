import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfbqhqkcxqxzliudgiop.supabase.co'
const supabaseKey = 'sb_publishable_AjDCt_olZnvs56F2lCvRJw_qrB4sCF8'

export const supabase = createClient(supabaseUrl, supabaseKey)