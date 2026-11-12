import { createClient } from 'npm:@supabase/supabase-js@2';
import { createOrderTrackingHandler } from '../_shared/order-handlers.ts';
import { getDefaultApiKey } from '../_shared/supabase-api-keys.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
if (!supabaseUrl || !secretKeys) {
  throw new Error('Supabase Edge Function server configuration is incomplete.');
}
const secretKey = getDefaultApiKey(secretKeys);

const serviceClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(createOrderTrackingHandler({
  async getOrderByTrackingHash(hash) {
    const { data, error } = await serviceClient
      .from('orders')
      .select('id, order_number, order_status, status_history, estimated_delivery_time, created_at')
      .eq('tracking_token_hash', hash)
      .maybeSingle();
    if (error) throw new Error('Tracking lookup failed.');
    return data;
  },
  async getLegacyOrderByNumber(orderNumber) {
    const { data, error } = await serviceClient
      .from('orders')
      .select('id, order_number, order_status, status_history, estimated_delivery_time, created_at')
      .eq('order_number', orderNumber)
      .is('tracking_token_hash', null)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      tracking: data
    };
  },
  async verifyLegacyPhone(orderId, phone) {
    const { data, error } = await serviceClient.rpc('allow_legacy_order_tracking_attempt', {
      p_order_id: orderId,
      p_customer_phone: phone
    });
    if (error) throw new Error('Legacy tracking verification failed.');
    return data === true;
  }
}));
