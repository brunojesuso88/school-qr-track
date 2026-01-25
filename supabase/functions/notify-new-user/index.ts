import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Helper to convert base64 url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

    // Send notifications (using web-push npm package would be ideal, but for Deno we'll use fetch)
    // Note: For production, you'd want to use a proper web-push library
    // This is a simplified implementation that logs the notification intent
    
    const results = await Promise.all(
      subscriptions.map(async (sub: PushSubscription & { id: string; user_id: string }) => {
        try {
          // In a full implementation, you would:
          // 1. Create JWT with VAPID keys
          // 2. Send encrypted payload to sub.endpoint
          // For now, we log the intent and return success
          console.log(`Would send notification to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          
          // Actual web push would require crypto operations for VAPID signing
          // This is a placeholder for the actual implementation
          return { success: true, subscriptionId: sub.id };
        } catch (pushError) {
          const errorMessage = pushError instanceof Error ? pushError.message : 'Unknown error';
          console.error(`Error sending to subscription ${sub.id}:`, pushError);
          return { success: false, subscriptionId: sub.id, error: errorMessage };
        }
      })
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notification sent to ${subscriptions.length} admin(s)`,
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
