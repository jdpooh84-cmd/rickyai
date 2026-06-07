import Fastify from 'fastify'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'

const app = Fastify({ logger: true })

app.get('/health', async () => ({
  status: 'ok',
  elevenlabs: !!process.env.ELEVENLABS_API_KEY,
  fal: !!process.env.FAL_API_KEY,
  supabase: !!process.env.SUPABASE_URL
}))

app.post('/render', async (request, reply) => {
  const workerSecret = request.headers['x-worker-secret']
  if (process.env.RENDER_WORKER_SECRET && workerSecret !== process.env.RENDER_WORKER_SECRET) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  const { job_id, user_id, business_id, input_schema } = request.body
  if (!job_id) return reply.status(400).send({ error: 'job_id is required' })
  reply.status(200).send({ ok: true, job_id })
  setImmediate(() => runPipeline({ job_id, user_id, business_id, input_schema }))
})

// ── ElevenLabs: generate voiceover audio ─────────────────────────────────────
async function generateVoiceover(text, apiKey) {
  const voiceId = 'pNInz6obpgDQGcFmaJgB' // Adam — clear, professional
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error ${res.status}: ${err}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

// ── fal.ai: submit Wan 2.1 video generation job ──────────────────────────────
async function submitFalJob(prompt, falApiKey) {
  const res = await fetch('https://queue.fal.run/fal-ai/wan/v2.1/t2v-1.3b', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      num_frames: 81,
      fps: 16,
      resolution: '480p',
      num_inference_steps: 20,
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`fal.ai submit error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.request_id
}

// ── fal.ai: poll until done, return video URL ────────────────────────────────
async function pollFalJob(requestId, falApiKey, log) {
  const statusUrl = `https://queue.fal.run/fal-ai/wan/v2.1/t2v-1.3b/requests/${requestId}`
  for (let i = 0; i < 72; i++) { // max 6 min
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`${statusUrl}/status`, {
      headers: { 'Authorization': `Key ${falApiKey}` }
    })
    if (!res.ok) { log(`fal.ai status check ${res.status}, retrying...`); continue }
    const data = await res.json()
    log(`fal.ai scene status: ${data.status}`)
    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${falApiKey}` }
      })
      const result = await resultRes.json()
      return result.video?.url || result.output?.video?.url
    }
    if (data.status === 'FAILED') throw new Error('fal.ai scene generation failed')
  }
  throw new Error('fal.ai scene generation timed out after 6 minutes')
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
async function runPipeline({ job_id, user_id, business_id, input_schema }) {
  const logs = []
  const log = (msg) => { const e = `[${job_id}] ${msg}`; console.log(e); logs.push(e) }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rickyai-'))
  const falApiKey = process.env.FAL_API_KEY
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY

  try {
    const scenes = input_schema?.scenes || []
    if (scenes.length === 0) throw new Error('No scenes provided in input_schema')

    // ── Step 1: Generate voiceover with ElevenLabs ──────────────────────────
    let audioPath = null

    // If edge function already generated and passed voiceover URL, use it
    if (input_schema?.voiceover_url) {
      try {
        const voiceRes = await fetch(input_schema.voiceover_url)
        if (voiceRes.ok) {
          audioPath = path.join(tmpDir, 'voiceover.mp3')
          fs.writeFileSync(audioPath, Buffer.from(await voiceRes.arrayBuffer()))
          log('Voiceover downloaded from provided URL')
        }
      } catch (e) { log(`Voiceover URL download error: ${e.message}`) }
    }

    // Otherwise generate fresh with our ElevenLabs key
    const fullScript = scenes.map(s => s.voiceover_line || s.text_overlay || '').filter(Boolean).join(' ')
    if (!audioPath && fullScript && elevenLabsKey) {
      log('Generating voiceover with ElevenLabs...')
      try {
        const audioBuffer = await generateVoiceover(fullScript, elevenLabsKey)
        audioPath = path.join(tmpDir, 'voiceover.mp3')
        fs.writeFileSync(audioPath, audioBuffer)
        log(`Voiceover generated (${Math.round(audioBuffer.length / 1024)}KB)`)
      } catch (e) { log(`ElevenLabs error: ${e.message} — continuing without audio`) }
    } else {
      log('No ElevenLabs key or script — skipping voiceover')
    }

    // ── Step 2: Submit all Wan 2.1 jobs in parallel ──────────────────────────
    log(`Submitting ${scenes.length} scene(s) to fal.ai Wan 2.1...`)
    const jobIds = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const prompt = scene.visual_prompt || scene.visual_description ||
        `${scene.text_overlay || ''} ${input_schema?.industry || 'local business'} ${input_schema?.location || ''}`.trim() ||
        'professional local business video scene, cinematic'
      log(`Scene ${i}: submitting — "${prompt.slice(0, 60)}..."`)
      const requestId = await submitFalJob(prompt, falApiKey)
      jobIds.push(requestId)
      log(`Scene ${i}: job ID ${requestId}`)
    }

    // ── Step 3: Poll all jobs and download clips ─────────────────────────────
    const sceneFiles = []
    for (let i = 0; i < jobIds.length; i++) {
      log(`Scene ${i}: waiting for Wan 2.1...`)
      const videoUrl = await pollFalJob(jobIds[i], falApiKey, log)
      if (!videoUrl) throw new Error(`Scene ${i}: no video URL returned`)
      log(`Scene ${i}: downloading from ${videoUrl}`)
      const vidRes = await fetch(videoUrl)
      if (!vidRes.ok) throw new Error(`Scene ${i}: download failed ${vidRes.status}`)
      const rawPath = path.join(tmpDir, `raw_${i}.mp4`)
      const scenePath = path.join(tmpDir, `scene_${i}.mp4`)
      fs.writeFileSync(rawPath, Buffer.from(await vidRes.arrayBuffer()))
      // Normalize to 1080x1920 portrait, 10 seconds
      await new Promise((res, rej) =>
        ffmpeg(rawPath)
          .duration(10)
          .videoFilter('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920')
          .videoCodec('libx264')
          .outputOptions(['-pix_fmt yuv420p', '-crf 23', '-preset fast', '-an'])
          .output(scenePath)
          .on('end', res)
          .on('error', rej)
          .run()
      )
      sceneFiles.push(scenePath)
      log(`Scene ${i}: ready`)
    }

    // ── Step 4: Add captions ─────────────────────────────────────────────────
    const captions = input_schema?.scene_captions || scenes.map(s => s.text_overlay || s.voiceover_line || '')
    const srtPath = path.join(tmpDir, 'captions.srt')
    const fmt = (s) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0')
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
      const ss = Math.floor(s % 60).toString().padStart(2, '0')
      return `${h}:${m}:${ss},000`
    }
    if (captions.length > 0) {
      fs.writeFileSync(srtPath, captions.map((c, idx) =>
        `${idx + 1}\n${fmt(idx * 10)} --> ${fmt((idx + 1) * 10 - 0.5)}\n${typeof c === 'string' ? c : c.text || ''}\n`
      ).join('\n'))
    } else {
      fs.writeFileSync(srtPath, '')
    }

    // ── Step 5: Stitch with FFmpeg ───────────────────────────────────────────
    log('Stitching video with FFmpeg...')
    const concatPath = path.join(tmpDir, 'concat.txt')
    fs.writeFileSync(concatPath, sceneFiles.map(f => `file '${f}'`).join('\n'))
    const outputPath = path.join(tmpDir, 'output.mp4')

    await new Promise((resolve, reject) => {
      let cmd = ffmpeg().input(concatPath).inputOptions(['-f concat', '-safe 0'])
      if (audioPath && fs.existsSync(audioPath)) cmd = cmd.input(audioPath)
      if (captions.length > 0) {
        const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        cmd = cmd.videoFilter(`subtitles=${srtPath.replace(/:/g, '\\:')}:force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Outline=2,Alignment=2,MarginV=60'`)
      }
      const noAudio = !audioPath || !fs.existsSync(audioPath)
      cmd
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-shortest', '-movflags +faststart', '-pix_fmt yuv420p', '-crf 23', '-preset fast', ...(noAudio ? ['-an'] : [])])
        .output(outputPath)
        .on('progress', p => log(`FFmpeg: ${Math.round(p.percent || 0)}%`))
        .on('end', () => { log('FFmpeg done'); resolve() })
        .on('error', (e) => { log(`FFmpeg error: ${e.message}`); reject(e) })
        .run()
    })

    // ── Step 6: Upload to Supabase Storage ───────────────────────────────────
    log('Uploading to Supabase Storage...')
    const storagePath = `videos/${user_id}/${job_id}/output.mp4`
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, fs.readFileSync(outputPath), { contentType: 'video/mp4', upsert: true })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)

    await supabase.from('video_generation_jobs').update({
      status: 'completed',
      pipeline_stage: 'complete',
      storage_path: storagePath,
      result_payload: {
        pipeline_logs: logs,
        storage_path: storagePath,
        public_url: publicUrl,
        message: 'Your AI video is ready!',
        powered_by: 'ElevenLabs + Wan 2.1 + FFmpeg'
      },
      updated_at: new Date().toISOString()
    }).eq('id', job_id)

    log('Pipeline complete! ' + publicUrl)

  } catch (err) {
    log(`PIPELINE ERROR: ${err.message}`)
    try {
      await supabase.from('video_generation_jobs').update({
        status: 'failed',
        pipeline_stage: 'render_failed',
        error_message: err.message,
        result_payload: { pipeline_logs: logs, error: err.message },
        updated_at: new Date().toISOString()
      }).eq('id', job_id)
    } catch (e2) {}
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e3) {}
  }
}

const port = parseInt(process.env.PORT || '3001')
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1) }
  console.log(`RickyAI Render Worker (Creatomate + ElevenLabs + Wan 2.1) on port ${port}`)
})
