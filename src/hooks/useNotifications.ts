import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';
import type { Notification } from '@/types/message.types';

export function useNotifications(userId: string | undefined) {
  // Re-run the fetch/subscribe effect whenever the app returns to the
  // foreground — the OS drops the Realtime socket while backgrounded, so
  // this both refetches anything missed and re-binds the channel on the
  // freshly reconnected socket (AppContext reconnects it on resume).
  const { foregroundTick } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the fetch effect — exposed as `refetch` for the
  // UI's Retry button on the ErrorState. The Realtime channel re-binds
  // with the new effect run too, so a dropped subscription also gets
  // reset (same rationale as useMessages).
  const [refetchTick, setRefetchTick] = useState(0);
  const refetch = useCallback(() => setRefetchTick((n) => n + 1), []);

  /**
   * A per-INSTANCE suffix for the Realtime topic. This is the fix for
   * report 3dfb4ca8, and the reason it is per-instance and not per-user:
   *
   *   cannot add `postgres_changes` callbacks for
   *   realtime:notifications:8402bbe4-… after `subscribe()`
   *
   * `supabase.channel(topic)` RETURNS THE EXISTING CHANNEL when one with that
   * topic is already open — it does not make a second one. The topic used to be
   * `notifications:${userId}`, and this hook has two simultaneous consumers:
   * the bell badge on the profile screen, and the notifications screen itself.
   * The notifications route is pushed as a `card` OVER the tabs, so the profile
   * screen stays mounted underneath. The second mount therefore got back the
   * first one's already-subscribed channel, called `.on()` on it, and threw —
   * during render of the notifications screen, which is why Aidan saw the
   * route's error boundary ("Something went wrong") and reported it as "the
   * notification button goes nowhere". The button was always fine.
   *
   * A ref, not state: it must be stable across re-renders and must NOT cause
   * one. Two channels on the same table is exactly right — each consumer keeps
   * its own subscription and its own state.
   *
   * ⚠️ THE SAME COLLISION IS LATENT IN FIVE OTHER TOPICS. `event-chat:` vs
   * `event-chat-screen:` and `circle-chat:` vs `circle-chat-screen:` are the
   * same bug already worked around by hand, by giving the second consumer a
   * different name. That works until two instances of the SAME consumer mount,
   * which is what happened here. Doing this centrally is the real fix and it is
   * a bigger change than this one.
   */
  const instanceId = useRef<string>('');
  if (!instanceId.current) {
    // Not crypto.randomUUID(): it is absent on older Safari, which is exactly
    // the browser this bug was reported from.
    instanceId.current = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message || 'Failed to load notifications');
        } else if (data) {
          setNotifications(data);
          setUnreadCount(data.filter((n) => !n.is_read).length);
        }
        setIsLoading(false);
      });

    const channel = supabase
      .channel(`notifications:${userId}:${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    // removeChannel, not unsubscribe: `unsubscribe()` closes the socket
    // subscription but LEAVES the channel in the client's registry under its
    // topic, so a later `channel(sameTopic)` hands back the dead one and
    // `.on()` throws again. Removing it is what actually frees the topic.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetchTick, foregroundTick]);

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return { notifications, unreadCount, isLoading, error, refetch, markAllRead };
}
