// supabase/functions/delete-account/index.ts
// Supprime définitivement le compte de l'utilisateur authentifié : ses cartes, ses decks,
// ses stats, son avatar (storage) et le compte auth lui-même. Utilise la clé service_role
// (jamais exposée côté client) pour bypasser RLS et pouvoir supprimer l'utilisateur auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client "anon" juste pour vérifier qui appelle, à partir de son propre token
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client admin (service_role) pour effectuer les suppressions
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userId = user.id;

    const { data: decks } = await adminClient.from('decks').select('id').eq('user_id', userId);
    const deckIds = (decks || []).map((d) => d.id);

    if (deckIds.length > 0) {
      const { error: cardsError } = await adminClient.from('cards').delete().in('deck_id', deckIds);
      if (cardsError) throw cardsError;
    }

    const { error: decksError } = await adminClient.from('decks').delete().eq('user_id', userId);
    if (decksError) throw decksError;

    const { error: statsError } = await adminClient.from('user_stats').delete().eq('user_id', userId);
    if (statsError) throw statsError;

    const { data: avatarFiles } = await adminClient.storage.from('avatars').list(userId);
    if (avatarFiles && avatarFiles.length > 0) {
      const paths = avatarFiles.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from('avatars').remove(paths);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Erreur inconnue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
