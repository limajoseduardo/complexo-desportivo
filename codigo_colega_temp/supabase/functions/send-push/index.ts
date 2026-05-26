import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken() {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKeyString = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKeyString || !projectId) {
      throw new Error(`Faltam variáveis de ambiente no Supabase Edge Function!
Tem de configurar as secrets usando o Supabase CLI:
supabase secrets set FIREBASE_PROJECT_ID="o-teu-projeto-id"
supabase secrets set FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@..."
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."

Valores atuais: 
FIREBASE_PROJECT_ID: ${projectId ? 'Encontrado' : 'Em Falta'}
FIREBASE_CLIENT_EMAIL: ${clientEmail ? 'Encontrado' : 'Em Falta'}
FIREBASE_PRIVATE_KEY: ${privateKeyString ? 'Encontrado' : 'Em Falta'}
`);
  }

  // Handle both literal "\n" strings (from CLI) and real newlines
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
  if (data.error) {
    throw new Error(`Erro OAuth ao buscar token: ${data.error} - ${data.error_description}`);
  }
  return data.access_token;
}

serve(async (req) => {
  // CORS Response for Browser Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // A payload that your React frontend (ou Database Webhook) sends!
    const { fcmToken, targetUserId, title, body, url } = await req.json();

    let finalToken = fcmToken;
    
    // Bypass RLS if token wasn't provided by the client
    if (!finalToken && targetUserId) {
      const supaUrl = Deno.env.get('SUPABASE_URL');
      const supaRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supaUrl && supaRole) {
        const supabase = createClient(supaUrl, supaRole);
        const { data } = await supabase.from('profiles').select('fcm_token, notify_chat').eq('id', targetUserId).single();
        if (data?.notify_chat === false) {
           console.log("User has chat notifications disabled.");
           return new Response(JSON.stringify({ success: true, message: "User has notifications disabled" }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             status: 200,
           });
        }
        if (data?.fcm_token) {
          finalToken = data.fcm_token;
        }
      }
    }

    if (!finalToken) throw new Error("FCM token required. Unable to resolve from payload or database.");

    // 1. Obter token de autenticação seguro (através do Server Key)
    const accessToken = await getAccessToken();
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

    // 2. Chamar a API v1 do do FCM
    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: finalToken,
          // Usar 'data' em vez de 'notification' para controlo total no frontend (Opção B)
          data: {
            title: String(title),
            body: String(body),
            url: String(url || "/"),
          }
        }
      })
    });

    const result = await fcmRes.json();

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: String(error), message: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
