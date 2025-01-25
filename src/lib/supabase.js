import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase credentials from your project settings
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Add this function to test the connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('notes').select('count').single();
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    console.log('Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
} 