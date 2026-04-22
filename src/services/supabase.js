import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('📡 Supabase URL:', supabaseUrl);
console.log('🔑 Supabase Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials missing! Check your .env file');
}

// ✅ NO custom storage - Use Supabase's default
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase client created');

// Test connection immediately
supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
        console.error('❌ Supabase connection test failed:', error);
    } else {
        console.log('✅ Supabase connection test passed. Session:', !!data.session);
    }
}).catch(err => {
    console.error('❌ Supabase connection test threw error:', err);
});