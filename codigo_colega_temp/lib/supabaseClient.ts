// Supabase integration disabled.
// Replace these with new service initialization when ready.

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: {}, error: null }),
    signUp: async () => ({ data: {}, error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    updateUser: async () => ({ data: {}, error: null }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({}) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({}) }),
    delete: () => ({ eq: () => ({}) }),
    or: () => ({ order: () => ({}) }),
  })
} as any;
