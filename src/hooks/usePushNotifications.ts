import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { detectPushPlatform, readStandaloneFlag, type PushPlatformInfo } from '@/lib/notifications/platform';

const ENV_VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

let cachedVapidKey: string | null = ENV_VAPID_PUBLIC_KEY || null;

/** Busca a chave VAPID pública no servidor (a privada nunca é exposta). */
async function fetchVapidPublicKey(): Promise<string> {
  if (cachedVapidKey !== null) return cachedVapidKey;
  try {
    const { data, error } = await supabase.functions.invoke('push-public-key');
    if (error) throw error;
    cachedVapidKey = (data?.public_key as string | undefined) || '';
  } catch (err) {
    console.error('Erro ao obter chave VAPID pública:', err);
    cachedVapidKey = '';
  }
  return cachedVapidKey;
}

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

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PushPlatformInfo>(() =>
    detectPushPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : '', false),
  );
  const [vapidKey, setVapidKey] = useState<string>(cachedVapidKey ?? '');

  useEffect(() => {
    let active = true;
    fetchVapidPublicKey().then((key) => { if (active) setVapidKey(key); });
    return () => { active = false; };
  }, []);


  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
    setPlatform(detectPushPlatform(navigator.userAgent, readStandaloneFlag()));
    if (supported) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported || !user) {
        setIsLoading(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          setEndpoint(subscription.endpoint);
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id, disabled_at')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();

          setIsSubscribed(!!data && !data.disabled_at);
        } else {
          setEndpoint(null);
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  /** Só deve ser chamado a partir de um gesto explícito do usuário. */
  const subscribe = useCallback(async () => {
    if (platform.requiresInstall) {
      return { success: false, error: 'ios_requires_install' };
    }
    if (!isSupported || !user || !VAPID_PUBLIC_KEY) {
      return { success: false, error: 'Push notifications not available' };
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        return { success: false, error: 'Permission denied' };
      }

      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      if (!p256dhKey || !authKey) throw new Error('Failed to get subscription keys');

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)));
      const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)));

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 400),
          platform: platform.platformLabel,
          last_seen_at: new Date().toISOString(),
          failure_count: 0,
          disabled_at: null,
        }, { onConflict: 'endpoint' });

      if (error) throw error;

      setEndpoint(subscription.endpoint);
      setIsSubscribed(true);
      return { success: true };
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      return { success: false, error: error.message };
    }
  }, [isSupported, user, platform]);

  const unsubscribe = useCallback(async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }

      setEndpoint(null);
      setIsSubscribed(false);
      return { success: true };
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  const sendTestNotification = useCallback(async () => {
    if (!endpoint) return { success: false, error: 'Nenhum dispositivo registrado' };
    const { data, error } = await supabase.functions.invoke('notify-event', {
      body: { event_type: 'push_test', endpoint },
    });
    if (error) return { success: false, error: error.message };
    if (data && data.success === false) return { success: false, error: data.error };
    return { success: true };
  }, [endpoint]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    platform,
    endpoint,
    subscribe,
    unsubscribe,
    sendTestNotification,
    isConfigured: !!VAPID_PUBLIC_KEY,
  };
};
