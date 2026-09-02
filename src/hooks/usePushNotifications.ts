import { useState, useEffect, useCallback } from 'react';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import { NO_ACTIVE_SCHOOL_MESSAGE } from '@/lib/schools/scope';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { detectPushPlatform, readStandaloneFlag, type PushPlatformInfo } from '@/lib/notifications/platform';
import {
  isValidVapidPublicKey,
} from '@/lib/notifications/vapid';
import { ensurePushSubscription, type MinimalPushManager } from '@/lib/notifications/pushSubscribe';


let cachedVapidKey: string | null = null;

/** Busca a chave VAPID pública no servidor (a privada nunca é exposta). */
async function fetchVapidPublicKey(): Promise<string> {
  if (cachedVapidKey !== null) return cachedVapidKey;
  try {
    const { data, error } = await supabase.functions.invoke('push-public-key');
    if (error) throw error;
    const key = (data?.public_key as string | undefined)?.trim() || '';
    // Só cacheia sucesso: falha de rede/servidor não pode travar o app
    // em "não configurado" até um reload completo.
    if (isValidVapidPublicKey(key)) {
      cachedVapidKey = key;
      return key;
    }
  } catch (err) {
    console.error('Erro ao obter chave VAPID pública:', err);
  }
  return '';
}


export const usePushNotifications = () => {
  const activeSchoolId = useActiveSchoolId();
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
  const [keyLoaded, setKeyLoaded] = useState(cachedVapidKey !== null);

  useEffect(() => {
    let active = true;
    fetchVapidPublicKey().then((key) => {
      if (!active) return;
      setVapidKey(key);
      setKeyLoaded(true);
    });
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
      if (!isSupported || !user || !activeSchoolId) {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          setEndpoint(subscription.endpoint);
          // O mesmo device pode estar vinculado a mais de uma escola do usuário:
          // aqui interessa apenas o vínculo da escola ATIVA.
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id, disabled_at')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .eq('school_id', activeSchoolId)
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
  }, [isSupported, user, activeSchoolId]);


  /** Só deve ser chamado a partir de um gesto explícito do usuário. */
  const subscribe = useCallback(async () => {
    if (platform.requiresInstall) {
      return { success: false, error: 'ios_requires_install' };
    }
    const publicKey = vapidKey || await fetchVapidPublicKey();
    if (!isSupported || !user || !publicKey) {
      return { success: false, error: 'Push notifications not available' };
    }
    if (!activeSchoolId) {
      return { success: false, error: NO_ACTIVE_SCHOOL_MESSAGE };
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        return { success: false, error: 'Permission denied' };
      }

      const registration = await navigator.serviceWorker.ready;
      const { subscription } = await ensurePushSubscription(
        registration.pushManager as unknown as MinimalPushManager,
        publicKey,
        async (staleEndpoint) => {
          // Endpoint antigo perde validade em TODAS as escolas do usuário.
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', staleEndpoint);
        },
      );


      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      if (!p256dhKey || !authKey) throw new Error('Failed to get subscription keys');

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)));
      const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)));

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          school_id: activeSchoolId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 400),
          platform: platform.platformLabel,
          last_seen_at: new Date().toISOString(),
          failure_count: 0,
          disabled_at: null,
        }, { onConflict: 'user_id,endpoint,school_id' });

      if (error) throw error;

      setEndpoint(subscription.endpoint);
      setIsSubscribed(true);
      return { success: true };
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      return { success: false, error: error.message };
    }
  }, [isSupported, user, platform, vapidKey, activeSchoolId]);

  const unsubscribe = useCallback(async () => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (!activeSchoolId) return { success: false, error: NO_ACTIVE_SCHOOL_MESSAGE };

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove apenas o vínculo da escola ativa.
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .eq('school_id', activeSchoolId);

        // Só cancela a inscrição do navegador se o device não atender outra escola.
        const { count } = await supabase
          .from('push_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        if (!count) await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return { success: true };
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: error.message };
    }
  }, [user, activeSchoolId]);


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
    isConfigured: !!vapidKey,
    keyLoaded,
  };
};
