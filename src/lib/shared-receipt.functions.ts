import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export const sharedReceipt=createServerFn({method:'GET'}).inputValidator((data:{token:string})=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.token))throw new Error('Invalid receipt link');return data;}).handler(async({data})=>{
 const url=process.env['SUPABASE_URL'];const key=process.env['SUPABASE_PUBLISHABLE_KEY'];if(!url||!key)throw new Error('Receipt service unavailable');
 const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers});}}});
 const {data:r,error}=await client.rpc('shared_pos_receipt',{_token:data.token});if(error)throw new Error('Receipt unavailable');return r;
});
