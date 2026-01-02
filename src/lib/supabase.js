import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase credentials from your project settings
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Add this function to test the connection
export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Using URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    const { data, error } = await supabase.from('notes').select('count').single();
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    console.log('Connection test result:', data);
    console.log('Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}
