import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAdminManualOrderHandler } from '../_shared/order-handlers.ts';
import { getDefaultApiKey } from '../_shared/supabase-api-keys.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
if (!supabaseUrl || !publishableKeys || !secretKeys) {
  throw new Error('Supabase Edge Function server configuration is incomplete.');
}
const publishableKey = getDefaultApiKey(publishableKeys);
const secretKey = getDefaultApiKey(secretKeys);

const serviceClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const authClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const handler = createAdminManualOrderHandler({
  async authorizeAdmin(request) {
    const authorization = request.headers.get('Authorization') || '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return null;
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return null;
    const { data: admin, error: adminError } = await serviceClient
      .from('admin_users')
      .select('id')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (adminError || !admin) return null;
    return { id: admin.id };
  },
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
  async insertCustomerOrder() {
    throw new Error('Guest-order operations are unavailable in this function.');
  },
  async insertManualOrder(order, adminUserId, auditMetadata) {
    const { data, error } = await serviceClient.rpc('create_manual_order_with_audit', {
      p_order: order,
      p_admin_user_id: adminUserId,
      p_audit_metadata: auditMetadata
    });
    const saved = Array.isArray(data) ? data[0] : data;
    if (error || !saved) throw new Error('Manual order insert failed.');
    return saved;
  }
});

Deno.serve(handler);
