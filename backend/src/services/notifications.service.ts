/** In-app notifications. SMS delivery was removed together with the Twilio
 *  integration; critical events reach the customer through the in-app
 *  notification list shown in the dashboard. */
import { getServiceClient } from './supabase.service';

export async function notify(
  profileId: string,
  type: 'info' | 'success' | 'warning' | 'security',
  title: string,
  body: string,
): Promise<void> {
  const db = getServiceClient();
  await db.from('notifications').insert({ profile_id: profileId, type, title, body });
}

export async function markRead(profileId: string, notificationId: string | 'all'): Promise<void> {
  const db = getServiceClient();
  const q = db.from('notifications').update({ read_at: new Date().toISOString() });
  if (notificationId === 'all') {
    await q.eq('profile_id', profileId).is('read_at', null);
  } else {
    await q.eq('id', notificationId).eq('profile_id', profileId);
  }
}
