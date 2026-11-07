// Database workflow and RLS check for QueueBeats. Input on stdin: ["<url>","<anon key>","<service key>"].
// Creates two confirmed synthetic users (no mail is sent), exercises the app workflow and 8 denials,
// then deletes everything it created. Run from a folder where @supabase/supabase-js resolves.

import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
const [url,anon,service]=JSON.parse(await new Promise(r=>{let s='';process.stdin.on('data',d=>s+=d).on('end',()=>r(s))}));
const admin=createClient(url,service,{auth:{persistSession:false}});
const out={};const ok=(k,v)=>{out[k]=v};
const mk=async n=>{const email=`qb-synthetic-${n}-${randomBytes(4).toString('hex')}@example.invalid`,password=randomBytes(18).toString('base64url');
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic '+n}});if(error)throw error;
  const c=createClient(url,anon,{auth:{persistSession:false}});const s=await c.auth.signInWithPassword({email,password});if(s.error)throw s.error;return {id:data.user.id,c}};
const A=await mk('a'),B=await mk('b');
const pa=await A.c.from('profiles').select('id,full_name').eq('id',A.id).single();ok('profile_trigger',!!pa.data&&!pa.error);
const us=await A.c.from('user_settings').select('user_id').eq('user_id',A.id).single();ok('settings_trigger',!!us.data);
const q=await A.c.from('queues').insert({name:'Synthetic queue',creator_id:A.id,active:true,access_code:'123456',settings:{isPublic:true,allowGuestAddSongs:true}}).select().single();ok('queue_create',!q.error);
const join=await B.c.rpc('get_queue_by_access_code',{p_code:'123456'}).single();ok('queue_join_by_code',join.data?.id===q.data.id);
const byIdB=await B.c.rpc('get_queue',{p_id:q.data.id}).single();ok('get_queue_hides_code_from_non_creator',byIdB.data?.id===q.data.id&&byIdB.data?.access_code===null);
const byIdA=await A.c.rpc('get_queue',{p_id:q.data.id}).single();ok('get_queue_shows_code_to_creator',byIdA.data?.access_code==='123456');
const anonList=await createClient(url,anon,{auth:{persistSession:false}}).from('queues').select('id,access_code');ok('DENY_anon_list_queues',!anonList.error&&(anonList.data||[]).length===0);
const bList=await B.c.from('queues').select('id,access_code');ok('DENY_other_user_list_queues',(bList.data||[]).length===0);
const wrongCode=await B.c.rpc('get_queue_by_access_code',{p_code:'000000'});ok('DENY_wrong_code',(wrongCode.data||[]).length===0);
// realtime: B listens for A's song
let rt=false;const ch=B.c.channel('qb-'+q.data.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'songs',filter:`queue_id=eq.${q.data.id}`},()=>{rt=true}).subscribe();
await new Promise(r=>setTimeout(r,3000));
const s1=await A.c.from('songs').insert({queue_id:q.data.id,title:'Synthetic song',artist:'Nobody',duration:1000,added_by:A.id,track_uri:'spotify:track:synthetic'}).select().single();ok('song_add',!s1.error);
const s2=await B.c.from('songs').insert({queue_id:q.data.id,title:'Guest song',artist:'Guest',duration:1000,added_by:B.id}).select().single();ok('guest_song_add',!s2.error);
const v=await B.c.from('votes').insert({song_id:s1.data.id,profile_id:B.id,vote_count:1}).select().single();ok('vote',!v.error);
const v2=await B.c.from('votes').update({vote_count:0}).eq('id',v.data.id).select().single();ok('vote_update',v2.data?.vote_count===0);
const v5=await B.c.from('votes').update({vote_count:5}).eq('id',v.data.id).select();ok('DENY_vote_count_above_1',!!v5.error);
const pos=await A.c.from('songs').update({position:1,played:true}).eq('id',s2.data.id).select().single();ok('creator_reorder_mark_played',!pos.error&&pos.data?.played===true);
const tok=await A.c.from('spotify_tokens').upsert({user_id:A.id,access_token:'x',refresh_token:'y',expires_at:Date.now()},{onConflict:'user_id'});ok('spotify_token_upsert',!tok.error);
const tok2=await A.c.from('spotify_tokens').upsert({user_id:A.id,access_token:'x2',refresh_token:'y',expires_at:Date.now()},{onConflict:'user_id'});ok('spotify_token_upsert_again',!tok2.error);
await new Promise(r=>setTimeout(r,3000));ok('realtime_song_insert_seen',rt);await B.c.removeChannel(ch);
// negative: forged ownership and cross-user writes
const fq=await B.c.from('queues').insert({name:'forged',creator_id:A.id}).select();ok('DENY_forged_queue_creator',!!fq.error);
const fs=await B.c.from('songs').insert({queue_id:q.data.id,title:'f',artist:'f',added_by:A.id}).select();ok('DENY_forged_song_added_by',!!fs.error);
const fv=await B.c.from('votes').insert({song_id:s2.data.id,profile_id:A.id}).select();ok('DENY_forged_vote',!!fv.error);
const xq=await B.c.from('queues').update({name:'hijack'}).eq('id',q.data.id).select();ok('DENY_cross_user_queue_update',(xq.data||[]).length===0);
const xs=await B.c.from('songs').delete().eq('id',s1.data.id).select();ok('DENY_non_creator_song_delete',(xs.data||[]).length===0);
const xt=await B.c.from('spotify_tokens').select('*').eq('user_id',A.id);ok('DENY_read_other_tokens',(xt.data||[]).length===0);
const xp=await B.c.from('profiles').update({full_name:'x'}).eq('id',A.id).select();ok('DENY_cross_profile_update',(xp.data||[]).length===0);
const anonc=createClient(url,anon,{auth:{persistSession:false}});const an=await anonc.from('songs').insert({queue_id:q.data.id,title:'a',artist:'a',added_by:A.id}).select();ok('DENY_anon_song_add',!!an.error);
// cleanup synthetic rows and users
await admin.from('queues').delete().eq('id',q.data.id);for(const u of [A,B])await admin.auth.admin.deleteUser(u.id);
const left=await admin.from('profiles').select('id',{count:'exact',head:true});ok('cleanup_profiles_left',left.count);
console.log(JSON.stringify(out,null,1));process.exit(Object.entries(out).every(([k,v])=>k==='cleanup_profiles_left'?v===0:v===true)?0:1);
