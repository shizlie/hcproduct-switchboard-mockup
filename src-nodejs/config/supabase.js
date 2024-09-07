const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Client for general use (respects RLS)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Function to get a client for an authenticated user
const getUserSupabase = (jwt) =>
    createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

// Client with service role (use cautiously, bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Note that supabaseAnon, supabaseService is already client instances
module.exports = { supabaseAnon, getUserSupabase, supabaseService };