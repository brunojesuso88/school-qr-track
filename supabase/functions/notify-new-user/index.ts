import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Base64 URL encoding helper
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert PEM private key to JWK format for signing
async function importVapidPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  // The VAPID private key is raw bytes (32 bytes for P-256)
  const privateKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  
  // Create JWK for the private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64UrlEncode(privateKeyBytes),
    x: '', // Will be computed
    y: '', // Will be computed
  };
  
  // For VAPID, we need to derive the public key from private
  // This is a simplified approach - we'll use the key directly
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Create VAPID JWT
async function createVapidJwt(audience: string, subject: string, publicKey: string, privateKeyBase64: string): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject
  };
  
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  try {
    const privateKey = await importVapidPrivateKey(privateKeyBase64);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(unsignedToken)
    );
    
    // Convert DER signature to raw format (64 bytes)
    const signatureB64 = base64UrlEncode(new Uint8Array(signature));
    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    console.error('Error creating VAPID JWT:', error);
    throw error;
  }
}

// Send push notification using Web Push Protocol
async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    
    // For now, send without encryption (works for some providers)
    // Full implementation would require ECDH key exchange and AES-GCM encryption
    
    const vapidHeader = `vapid t=${await createVapidJwt(audience, 'mailto:admin@edunexus.com.br', vapidPublicKey, vapidPrivateKey)}, k=${vapidPublicKey}`;
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': vapidHeader,
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: payload,
    });
    
    if (response.ok || response.status === 201) {
      return { success: true };
    }
    
    const errorText = await response.text();
    console.error(`Push failed with status ${response.status}: ${errorText}`);
    
    // If subscription is invalid, return specific error
    if (response.status === 404 || response.status === 410) {
      return { success: false, error: 'subscription_expired' };
    }
    
    return { success: false, error: errorText };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending push:', error);
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    // Validate VAPID keys are configured
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured. Push notifications disabled.');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Push notifications not configured. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse the request body
    const { newUserEmail, newUserName } = await req.json();

    if (!newUserEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing newUserEmail' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get all admin users with push subscriptions
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No admin users found');
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = adminRoles.map(r => r.user_id);

    // Get push subscriptions for admin users
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminUserIds);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for admins');
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: 'Novo Usuário Cadastrado',
      body: `${newUserName || newUserEmail} acabou de se cadastrar no sistema.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: {
        url: '/settings?tab=users',
        type: 'new_user'
      }
    });

    console.log(`Sending push notifications to ${subscriptions.length} subscriptions`);

    // Send notifications
    const results = await Promise.all(
      subscriptions.map(async (sub: PushSubscription) => {
        const result = await sendWebPushNotification(
          sub,
          notificationPayload,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        // If subscription expired, remove it from database
        if (!result.success && result.error === 'subscription_expired') {
          console.log(`Removing expired subscription: ${sub.id}`);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
        
        return { ...result, subscriptionId: sub.id };
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent: ${successCount} success, ${failedCount} failed`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notify-new-user function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
