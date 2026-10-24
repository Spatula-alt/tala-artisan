/* Tala Artisan — site configuration.

   Quote requests are saved to Tala's own Supabase project (see
   supabase/setup.sql). Paste the project URL and its PUBLISHABLE key here --
   never the secret / service_role key, which must not reach a browser.
   Row Level Security lets this key insert a request and nothing else.

   While these are empty the form still validates, but nothing is sent -- it
   tells the customer so, rather than thanking them for a request no one gets. */
window.TALA_CONFIG = {
  supabaseUrl: 'https://roymwsehvvynrbduddit.supabase.co',
  supabaseKey: 'sb_publishable_LBf7nML65x7L2HpZ_Ony0A_QdH9q0hn',
};
