import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reutilizamos a lógica de autenticação do Firebase (Google Auth)
async function getAccessToken() {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKeyString = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKeyString || !projectId) {
      throw new Error("Configurações do Firebase em falta nas env vars.");
  }

  const privateKey = privateKeyString.replace(/\\n/g, '\n');
  const alg = 'RS256';
  const pkcs8 = await importPKCS8(privateKey, alg);

  const jwt = await new SignJWT({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(pkcs8);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Erro ao obter access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Defense against accidental Supabase Database Webhook triggers:
    // If the request contains a JSON body with a database event (e.g. "type": "INSERT"), it's an errant webhook.
    if (req.method === 'POST') {
      try {
        const clonedReq = req.clone();
        const bodyContent = await clonedReq.text();
        if (bodyContent) {
           const bodyInfo = JSON.parse(bodyContent);
           if (bodyInfo && bodyInfo.type && bodyInfo.table) {
              console.log("Ignorando chamada de Webhook acidental para a tabela:", bodyInfo.table);
              return new Response(JSON.stringify({ message: "Ignored accidental webhook trigger" }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                 status: 200,
              });
           }
        }
      } catch (e) {
        // Not a JSON body or empty, proceed normally
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Usamos Service Role para ler todos os perfis
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar alunos que têm token de push
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .eq('role', 'STUDENT')
      .not('fcm_token', 'is', null);

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum aluno com token encontrado." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Preparar acesso ao FCM
    const accessToken = await getAccessToken();
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    // 3. Enviar em batches para prevenir rate limits da Google e remover tokens inválidos
    const results = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (profile) => {
        try {
          const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: profile.fcm_token,
                data: {
                  title: "Bom dia! ⚖️",
                  body: "Não te esqueças de registar o teu peso hoje para acompanhar a tua evolução!",
                  url: "/"
                }
              }
            })
          });

          if (!fcmRes.ok) {
            const errorText = await fcmRes.text();
            console.error(`Error sending to ${profile.id}:`, errorText);

            // Verifica se o erro está relacionado com token expirado, inválido ou não registado
            if (fcmRes.status === 404 || errorText.includes('UNREGISTERED') || errorText.includes('INVALID_ARGUMENT')) {
               await supabase
                 .from('profiles')
                 .update({ fcm_token: null })
                 .eq('id', profile.id);
               
               return { id: profile.id, status: fcmRes.status, error: "token_removed", details: errorText };
            }
            return { id: profile.id, status: fcmRes.status, error: errorText };
          }

          return { id: profile.id, status: fcmRes.status };
        } catch (err: any) {
          return { id: profile.id, error: err.message };
        }
      })
      );
      results.push(...batchResults);
    }

    return new Response(JSON.stringify({ success: true, processed: profiles.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
