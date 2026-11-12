import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGuestOrderHandler } from '../_shared/order-handlers.ts';
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

const handler = createGuestOrderHandler({
  async getSettings() {
    const { data, error } = await serviceClient
      .from('shop_settings')
      .select('is_open, delivery_fee, free_delivery_threshold, min_order_amount, delivery_time_estimate_mins')
      .eq('id', 1)
      .single();
    if (error || !data) throw new Error('Shop settings could not be loaded.');
    return data;
  },
  async getProducts(ids) {
    const { data, error } = await serviceClient
      .from('products')
      .select('id, name, is_available, weights, cut_options')
      .in('id', ids);
    if (error || !data) throw new Error('Product catalogue could not be loaded.');
    return data;
  },
  async insertCustomerOrder(order) {
    const { data, error } = await serviceClient.from('orders').insert(order).select('*').single();
    if (error || !data) throw new Error('Order insert failed.');
    return data;
  },
  async insertManualOrder() {
    throw new Error('Manual-order operations are unavailable in this function.');
  },
  async authorizeAdmin() {
    return null;
  }
});

Deno.serve(handler);
