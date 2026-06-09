import { createClient } from "npm:@supabase/supabase-js@2.57.2"
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { job_id } = await req.json()
    if (!job_id) return new Response(JSON.stringify({ error: 'job_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: job } = await supabase.from('video_generation_jobs').select('status, storage_path, video_url, result_payload').eq('id', job_id).eq('user_id', user.id).single()
    if (!job || job.status !== 'completed') return new Response(JSON.stringify({ error: 'Video not ready', status: job?.status }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (job.storage_path) {
      const { data: signedData } = await supabase.storage.from('media').createSignedUrl(job.storage_path, 3600)
      if (signedData?.signedUrl) return new Response(JSON.stringify({ url: signedData.signedUrl, type: 'signed', expires_in: 3600 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (job.video_url) return new Response(JSON.stringify({ url: job.video_url, type: 'public' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const payload = job.result_payload || {}
    return new Response(JSON.stringify({ url: null, type: 'slideshow', voiceover_url: payload.voiceover_url || null, scene_images: payload.scene_images || [], scene_captions: payload.scene_captions || [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
