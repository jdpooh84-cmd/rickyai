import Fastify from 'fastify'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok', pexels: !!process.env.PEXELS_API_KEY, supabase: !!process.env.SUPABASE_URL }))

app.post('/render', async (request, reply) => {
  const workerSecret = request.headers['x-worker-secret']
  if (process.env.RENDER_WORKER_SECRET && workerSecret !== process.env.RENDER_WORKER_SECRET) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  const { job_id, user_id, business_id, input_schema, pexels_key } = request.body
  if (!job_id) return reply.status(400).send({ error: 'job_id is required' })
  reply.status(200).send({ ok: true, job_id })
  setImmediate(() => runPipeline({ job_id, user_id, business_id, input_schema, pexels_key }))
})

async function runPipeline({ job_id, user_id, business_id, input_schema, pexels_key }) {
  const logs = []
  const log = (msg) => { const e = `[${job_id}] ${msg}`; console.log(e); logs.push(e) }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rickyai-'))
  const effectivePexelsKey = pexels_key || process.env.PEXELS_API_KEY

  try {
    let audioPath = null
    if (input_schema?.voiceover_url) {
      try {
        const voiceRes = await fetch(input_schema.voiceover_url)
        if (voiceRes.ok) {
          audioPath = path.join(tmpDir, 'voiceover.mp3')
          fs.writeFileSync(audioPath, Buffer.from(await voiceRes.arrayBuffer()))
          log('Voiceover downloaded')
        }
      } catch (e) { log(`Voiceover error: ${e.message}`) }
    }

    const scenes = input_schema?.scenes || []
    const sceneFiles = []
    const totalScenes = scenes.length || 1

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      let keyword = 'business professional'
      if (i < Math.floor(totalScenes / 3)) keyword = input_schema.industry || 'local business'
      else if (i < Math.floor((totalScenes * 2) / 3)) keyword = input_schema.offer || 'service professional'
      else keyword = input_schema.location || input_schema.industry || 'city business'

      const rawPath = path.join(tmpDir, `raw_${i}.mp4`)
      const scenePath = path.join(tmpDir, `scene_${i}.mp4`)
      const rawText = scene.text_overlay || (scene.voiceover_line || '').split(' ').slice(0, 5).join(' ') || `Scene ${i+1}`
      const textOverlay = rawText.replace(/'/g, '').replace(/:/g, ' ').slice(0, 50)
      let downloaded = false

      if (effectivePexelsKey) {
        try {
          const pexRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&orientation=portrait&size=medium&per_page=3`, { headers: { Authorization: effectivePexelsKey } })
          if (pexRes.ok) {
            const pexData = await pexRes.json()
            const video = pexData.videos?.[0]
            const videoFile = video?.video_files?.find(f => f.file_type === 'video/mp4' && f.width <= 1080) || video?.video_files?.[0]
            if (videoFile?.link) {
              const vidRes = await fetch(videoFile.link)
              if (vidRes.ok) {
                fs.writeFileSync(rawPath, Buffer.from(await vidRes.arrayBuffer()))
                await new Promise((res, rej) => ffmpeg(rawPath).duration(10).videoFilter('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920').videoCodec('libx264').outputOptions(['-pix_fmt yuv420p','-crf 23','-preset fast','-an']).output(scenePath).on('end', res).on('error', rej).run())
                downloaded = true
                log(`Scene ${i}: Pexels OK`)
              }
            }
          }
        } catch (e) { log(`Scene ${i}: Pexels failed - ${e.message}`) }
      }

      if (!downloaded) {
        const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        const drawFilter = `drawtext=text='${textOverlay}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=${fontPath}`
        await new Promise((res, rej) => ffmpeg().input('color=0x0f0f23:size=1080x1920:rate=30').inputOptions(['-f lavfi']).duration(10).videoFilter(drawFilter).videoCodec('libx264').outputOptions(['-pix_fmt yuv420p','-crf 23','-preset fast','-an']).output(scenePath).on('end', res).on('error', rej).run())
        log(`Scene ${i}: fallback used`)
      }
      sceneFiles.push(scenePath)
    }

    if (scenes.length === 0) {
      const defaultPath = path.join(tmpDir, 'scene_0.mp4')
      await new Promise((res, rej) => ffmpeg().input('color=0x0f0f23:size=1080x1920:rate=30').inputOptions(['-f lavfi']).duration(10).videoFilter("drawtext=text='Your Video':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2").videoCodec('libx264').outputOptions(['-pix_fmt yuv420p','-crf 23','-preset fast','-an']).output(defaultPath).on('end', res).on('error', rej).run())
      sceneFiles.push(defaultPath)
    }

    const captions = input_schema?.scene_captions || []
    const srtPath = path.join(tmpDir, 'captions.srt')
    if (captions.length > 0) {
      const fmt = (s) => { const h=Math.floor(s/3600).toString().padStart(2,'0'); const m=Math.floor((s%3600)/60).toString().padStart(2,'0'); const ss=Math.floor(s%60).toString().padStart(2,'0'); return `${h}:${m}:${ss},000` }
      fs.writeFileSync(srtPath, captions.map((c,idx) => `${idx+1}\n${fmt(idx*10)} --> ${fmt((idx+1)*10-0.5)}\n${typeof c==='string'?c:c.text||''}\n`).join('\n'))
    } else { fs.writeFileSync(srtPath, '') }

    const concatPath = path.join(tmpDir, 'concat.txt')
    fs.writeFileSync(concatPath, sceneFiles.map(f => `file '${f}'`).join('\n'))
    const outputPath = path.join(tmpDir, 'output.mp4')

    await new Promise((resolve, reject) => {
      let cmd = ffmpeg().input(concatPath).inputOptions(['-f concat', '-safe 0'])
      if (audioPath && fs.existsSync(audioPath)) cmd = cmd.input(audioPath)
      if (captions.length > 0) cmd = cmd.videoFilter(`subtitles=${srtPath.replace(/:/g,'\\:')}:force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Outline=2,Alignment=2,MarginV=60'`)
      const noAudio = !audioPath || !fs.existsSync(audioPath)
      cmd.videoCodec('libx264').audioCodec('aac').outputOptions(['-shortest','-movflags +faststart','-pix_fmt yuv420p','-crf 23','-preset fast',...(noAudio ? ['-an'] : [])]).output(outputPath).on('progress', p => log(`FFmpeg: ${Math.round(p.percent||0)}%`)).on('end', ()=>{log('FFmpeg done');resolve()}).on('error',(e)=>{log(`FFmpeg error: ${e.message}`);reject(e)}).run()
    })

    const storagePath = `videos/${user_id}/${job_id}/output.mp4`
    const { error: uploadError } = await supabase.storage.from('media').upload(storagePath, fs.readFileSync(outputPath), { contentType: 'video/mp4', upsert: true })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    await supabase.from('video_generation_jobs').update({ status: 'completed', pipeline_stage: 'complete', storage_path: storagePath, result_payload: { pipeline_logs: logs, storage_path: storagePath, message: 'Your video is ready!' }, updated_at: new Date().toISOString() }).eq('id', job_id)
    log('Pipeline complete!')

  } catch (err) {
    log(`PIPELINE ERROR: ${err.message}`)
    try { await supabase.from('video_generation_jobs').update({ status: 'failed', pipeline_stage: 'render_failed', error_message: err.message, result_payload: { pipeline_logs: logs, error: err.message }, updated_at: new Date().toISOString() }).eq('id', job_id) } catch(e2) {}
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch(e3) {}
  }
}

const port = parseInt(process.env.PORT || '3001')
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1) }
  console.log(`RickyAI Render Worker on port ${port}`)
})
