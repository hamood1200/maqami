import { centsToHz } from '../data/notes'

export type Timbre = 'oriental' | 'organ' | 'oud' | 'nay' | 'piano'

export const TIMBRES: { id: Timbre; name: string }[] = [
  { id: 'oriental', name: 'أورغ شرقي' },
  { id: 'organ', name: 'أورغ كلاسيكي' },
  { id: 'oud', name: 'عود' },
  { id: 'nay', name: 'ناي' },
  { id: 'piano', name: 'بيانو' },
]

interface TimbreSpec {
  harmonics: number[]
  /** فرق الضبط بين المذبذبين (سنت) لإحساس الريشة/الأكورديون */
  detune: number
  attack: number
  decay: number
  sustain: number
  release: number
  /** عمق الاهتزاز (سنت) */
  vibrato: number
  vibratoRate: number
  /** سطوع الفلتر كمضاعف للتردد */
  brightness: number
  gain: number
  /** نغمة متلاشية بدون ثبات (بيانو) */
  percussive?: boolean
}

type SynthTimbre = Exclude<Timbre, 'oud'>

const SPECS: Record<SynthTimbre, TimbreSpec> = {
  // صوت ريشة دافئ مع "ميوزيت" خفيف — قريب من صوت الأورغ العربي
  oriental: {
    harmonics: [0, 1, 0.62, 0.48, 0.3, 0.26, 0.16, 0.12, 0.08, 0.06, 0.04, 0.03],
    detune: 5,
    attack: 0.018,
    decay: 0.2,
    sustain: 0.78,
    release: 0.16,
    vibrato: 4,
    vibratoRate: 5.6,
    brightness: 7,
    gain: 0.3,
  },
  organ: {
    harmonics: [0, 1, 0.55, 0.3, 0.32, 0, 0.14, 0, 0.12],
    detune: 1.5,
    attack: 0.01,
    decay: 0.05,
    sustain: 0.92,
    release: 0.09,
    vibrato: 0,
    vibratoRate: 6,
    brightness: 9,
    gain: 0.3,
  },
  nay: {
    harmonics: [0, 1, 0.18, 0.1, 0.04, 0.02],
    detune: 0,
    attack: 0.07,
    decay: 0.2,
    sustain: 0.85,
    release: 0.22,
    vibrato: 9,
    vibratoRate: 5,
    brightness: 4,
    gain: 0.42,
  },
  piano: {
    harmonics: [0, 1, 0.5, 0.32, 0.18, 0.12, 0.08, 0.05, 0.03],
    detune: 0.8,
    attack: 0.004,
    decay: 1.6,
    sustain: 0,
    release: 0.3,
    vibrato: 0,
    vibratoRate: 0,
    brightness: 10,
    gain: 0.38,
    percussive: true,
  },
}

export interface Voice {
  stop: (when?: number) => void
}

export interface SeqEvent {
  cents: number
  /** بداية الحدث بالثواني من لحظة التشغيل */
  t: number
  dur: number
  /** معرّف يُمرَّر إلى onStep (مثلاً رقم الدرجة) */
  tag?: number
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private out!: GainNode
  private master: GainNode | null = null
  private waves = new Map<SynthTimbre, PeriodicWave>()
  private oudBuffers = new Map<number, AudioBuffer>()
  private seqTimers: number[] = []
  private seqVoices: Voice[] = []
  private seqDone: (() => void) | null = null
  private droneVoice: Voice | null = null
  timbre: Timbre = 'oriental'
  volume = 0.8

  /** يجب استدعاؤها من داخل تفاعل المستخدم (نقرة) */
  ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      this.ctx = ctx

      const master = ctx.createGain()
      master.gain.value = this.volume

      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.knee.value = 12
      comp.ratio.value = 3
      comp.attack.value = 0.005
      comp.release.value = 0.2

      // صدى غرفة خفيف يجعل الصوت أقل "إلكترونية"
      const reverb = ctx.createConvolver()
      reverb.buffer = makeImpulse(ctx, 1.9, 3.2)
      const wet = ctx.createGain()
      wet.gain.value = 0.2

      this.out = ctx.createGain()
      this.out.connect(master)
      this.out.connect(reverb)
      reverb.connect(wet)
      wet.connect(master)
      master.connect(comp)
      comp.connect(ctx.destination)
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  private wave(t: SynthTimbre): PeriodicWave {
    const ctx = this.ensure()
    let w = this.waves.get(t)
    if (!w) {
      const h = SPECS[t].harmonics
      const real = new Float32Array(h.length)
      const imag = Float32Array.from(h)
      w = ctx.createPeriodicWave(real, imag)
      this.waves.set(t, w)
    }
    return w
  }

  /** يبدأ نغمة ممسوكة وتعيد كائناً لإيقافها */
  noteOn(cents: number, opts: { when?: number; velocity?: number; timbre?: Timbre; dest?: AudioNode } = {}): Voice {
    const ctx = this.ensure()
    const timbre = opts.timbre ?? this.timbre
    if (timbre === 'oud') return this.pluck(cents, opts)
    const spec = SPECS[timbre]
    const now = opts.when ?? ctx.currentTime
    const freq = centsToHz(cents)
    const vel = opts.velocity ?? 0.85
    // النغمات العالية أهدأ قليلاً للحفاظ على توازن الصوت
    const level = spec.gain * vel * Math.min(1, Math.pow(440 / freq, 0.25))

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(level, now + spec.attack)
    if (spec.percussive) {
      env.gain.setTargetAtTime(level * 0.0001, now + spec.attack, spec.decay / 3)
    } else {
      env.gain.setTargetAtTime(level * spec.sustain, now + spec.attack, spec.decay / 3)
    }

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(9000, freq * spec.brightness)
    filter.Q.value = 0.6

    const oscs: OscillatorNode[] = []
    const voices = spec.detune > 0 ? [-spec.detune, spec.detune] : [0]
    for (const d of voices) {
      const o = ctx.createOscillator()
      o.setPeriodicWave(this.wave(timbre))
      o.frequency.value = freq
      o.detune.value = d
      const g = ctx.createGain()
      g.gain.value = 1 / voices.length
      o.connect(g)
      g.connect(filter)
      oscs.push(o)
    }

    let lfo: OscillatorNode | null = null
    if (spec.vibrato > 0) {
      lfo = ctx.createOscillator()
      lfo.frequency.value = spec.vibratoRate
      const depth = ctx.createGain()
      // الاهتزاز يبدأ بعد لحظة كما يفعل العازف
      depth.gain.setValueAtTime(0, now)
      depth.gain.linearRampToValueAtTime(spec.vibrato, now + 0.35)
      lfo.connect(depth)
      for (const o of oscs) depth.connect(o.detune)
      lfo.start(now)
    }

    filter.connect(env)
    env.connect(opts.dest ?? this.out)
    for (const o of oscs) o.start(now)

    // قد يُطلب الإيقاف مرتين: موعد مجدول مسبقاً (نهاية النغمة)، ثم إيقاف فوري من المستخدم.
    // الطلب الأبكر هو الذي يُطبَّق دائماً.
    let stopAt = Infinity
    return {
      stop: (when?: number) => {
        const cur = ctx.currentTime
        const req = Math.max(when ?? cur, cur)
        if (req >= stopAt) return
        stopAt = req
        // نغمة لم تبدأ بعد: تُلغى كلياً بدل أن تُسمع لحظةً عند موعدها
        if (req <= now && cur < now) {
          env.disconnect()
          for (const o of oscs) safeStop(o)
          if (lfo) safeStop(lfo)
          return
        }
        const t = Math.max(req, now + spec.attack)
        holdAt(env.gain, t)
        env.gain.setTargetAtTime(0, t, spec.release / 3)
        const end = t + spec.release * 2.5
        for (const o of oscs) safeStop(o, end)
        if (lfo) safeStop(lfo, end)
      },
    }
  }

  /** نقرة عود: وتران مزدوجان (كورس) بخوارزمية Karplus-Strong ثم رنين الصندوق */
  private pluck(cents: number, opts: { when?: number; velocity?: number; dest?: AudioNode }): Voice {
    const ctx = this.ensure()
    const now = opts.when ?? ctx.currentTime
    const freq = centsToHz(cents)
    const vel = opts.velocity ?? 0.85

    const src = ctx.createBufferSource()
    src.buffer = this.oudBuffer(ctx, cents)

    // صندوق العود: قاعدة دافئة ورنين خشبي حول 250Hz وقمم حادّة مخففة
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 75
    const body = ctx.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 260
    body.Q.value = 1.1
    body.gain.value = 5
    const air = ctx.createBiquadFilter()
    air.type = 'peaking'
    air.frequency.value = 2600
    air.Q.value = 0.9
    air.gain.value = 2.5
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.min(7500, 2800 + freq * 6)
    lp.Q.value = 0.5

    const env = ctx.createGain()
    const level = 0.62 * vel * Math.min(1.15, Math.pow(330 / freq, 0.18))
    env.gain.value = level

    src.connect(hp)
    hp.connect(body)
    body.connect(air)
    air.connect(lp)
    lp.connect(env)
    env.connect(opts.dest ?? this.out)
    src.start(now)

    let stopAt = Infinity
    return {
      stop: (when?: number) => {
        const cur = ctx.currentTime
        const req = Math.max(when ?? cur, cur)
        if (req >= stopAt) return
        stopAt = req
        // نقرة لم تحن بعد: تُلغى كلياً (وإلا سُمعت نقرة مكتومة عند موعدها)
        if (req <= now && cur < now) {
          env.disconnect()
          safeStop(src)
          return
        }
        // رفع الإصبع/كتم الوتر: تلاشٍ سريع لكن غير مقطوع
        const t = Math.max(req, now + 0.02)
        env.gain.cancelScheduledValues(t)
        env.gain.setValueAtTime(level, t)
        env.gain.setTargetAtTime(0, t, 0.07)
        safeStop(src, t + 0.5)
      },
    }
  }

  private oudBuffer(ctx: AudioContext, cents: number): AudioBuffer {
    const key = Math.round(cents)
    const cached = this.oudBuffers.get(key)
    if (cached) return cached

    const sr = ctx.sampleRate
    const freq = centsToHz(key)
    const seconds = 2.4
    const len = Math.floor(sr * seconds)
    const out = new Float32Array(len)
    // الوتران في الكورس الواحد مختلفان قليلاً في الضبط → "لمعة" العود
    for (const [detune, gain, pickPos] of [
      [-2.5, 0.55, 0.13],
      [2.5, 0.45, 0.17],
    ] as const) {
      const f = freq * Math.pow(2, detune / 1200)
      const string = karplusStrong(sr, f, len, pickPos)
      for (let i = 0; i < len; i++) out[i] += string[i] * gain
    }
    // تلاشٍ في آخر الذيل حتى لا ينقطع الصوت فجأة
    const fade = Math.floor(sr * 0.35)
    for (let i = 0; i < fade; i++) out[len - fade + i] *= 1 - i / fade

    const buf = ctx.createBuffer(1, len, sr)
    buf.copyToChannel(out, 0)
    this.oudBuffers.set(key, buf)
    if (this.oudBuffers.size > 60) {
      const oldest = this.oudBuffers.keys().next().value
      if (oldest !== undefined) this.oudBuffers.delete(oldest)
    }
    return buf
  }

  playNote(cents: number, dur = 0.6) {
    const ctx = this.ensure()
    const v = this.noteOn(cents)
    v.stop(ctx.currentTime + dur)
  }

  /** يشغّل تتابعاً من النغمات ويستدعي onStep عند بداية كل نغمة */
  playSequence(events: SeqEvent[], onStep?: (tag: number | undefined, i: number) => void, onDone?: () => void) {
    this.stopSequence()
    const ctx = this.ensure()
    const t0 = ctx.currentTime + 0.06
    events.forEach((e, i) => {
      const v = this.noteOn(e.cents, { when: t0 + e.t })
      v.stop(t0 + e.t + e.dur * 0.94)
      this.seqVoices.push(v)
      if (onStep) {
        this.seqTimers.push(window.setTimeout(() => onStep(e.tag, i), (e.t + 0.06) * 1000))
      }
    })
    const total = events.length ? Math.max(...events.map((e) => e.t + e.dur)) : 0
    this.seqDone = onDone ?? null
    this.seqTimers.push(
      window.setTimeout(() => {
        this.seqVoices = []
        this.seqTimers = []
        this.seqDone = null
        onDone?.()
      }, (total + 0.1) * 1000),
    )
  }

  stopSequence() {
    for (const id of this.seqTimers) clearTimeout(id)
    this.seqTimers = []
    for (const v of this.seqVoices) v.stop()
    this.seqVoices = []
    // أخبر الصفحة أن التشغيل توقف (مثلاً عند بدء مقطع يوتيوب) حتى لا يبقى الزر على "إيقاف"
    const done = this.seqDone
    this.seqDone = null
    done?.()
  }

  /** نغمة القرار الممتدة (الدرون) تساعد الأذن على الإحساس بالمقام */
  startDrone(cents: number, withFifth = true) {
    this.stopDrone()
    const ctx = this.ensure()
    const g = ctx.createGain()
    g.gain.value = 0.45
    g.connect(this.out)
    const low = this.noteOn(cents - 1200, { timbre: 'organ', velocity: 0.55, dest: g })
    const fifth = withFifth ? this.noteOn(cents - 1200 + 700, { timbre: 'organ', velocity: 0.25, dest: g }) : null
    this.droneVoice = {
      stop: () => {
        low.stop()
        fifth?.stop()
      },
    }
  }

  stopDrone() {
    this.droneVoice?.stop()
    this.droneVoice = null
  }

  get droneOn() {
    return this.droneVoice !== null
  }

  stopAll() {
    this.stopSequence()
    this.stopDrone()
  }
}

/** يوقف مصدر صوت دون أن يرمي خطأ إن كان قد توقف مسبقاً */
function safeStop(node: AudioScheduledSourceNode, when?: number) {
  try {
    node.stop(when)
  } catch {
    /* توقف مسبقاً */
  }
}

/** يثبّت قيمة الغلاف عند اللحظة t ويلغي ما بعدها، تمهيداً للتلاشي */
function holdAt(param: AudioParam, t: number) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(t)
  // بدونها (فايرفوكس) يكفي الإلغاء: setTargetAtTime التالية تبدأ من قيمة المنحنى عند t
  else param.cancelScheduledValues(t)
}

/** وتر مقروص: خط تأخير بطول الدورة مع فلتر متوسط ينعّم الصوت تدريجياً */
function karplusStrong(sr: number, freq: number, len: number, pickPos: number): Float32Array {
  const y = new Float32Array(len)
  const period = sr / freq
  // الأوتار الغليظة ترنّ أطول من الرفيعة
  const t60 = Math.min(3.2, Math.max(0.9, 2.6 * Math.pow(196 / freq, 0.55)))
  const rho = Math.pow(0.001, 1 / (freq * t60))

  // الإثارة: ضربة ريشة = ضجيج قصير مُنعَّم، مع إلغاء الهارمونيات حسب موضع الضرب
  const exLen = Math.max(2, Math.round(period))
  const ex = new Float32Array(exLen)
  let lp = 0
  for (let i = 0; i < exLen; i++) {
    lp += 0.55 * (Math.random() * 2 - 1 - lp)
    ex[i] = lp
  }
  const comb = Math.max(1, Math.round(period * pickPos))
  const exc = new Float32Array(exLen)
  for (let i = 0; i < exLen; i++) exc[i] = ex[i] - (i >= comb ? ex[i - comb] : 0)
  let peak = 0
  for (const v of exc) peak = Math.max(peak, Math.abs(v))
  const norm = peak > 0 ? 0.9 / peak : 1

  const read = (pos: number) => {
    if (pos < 0) return 0
    const i = Math.floor(pos)
    const fr = pos - i
    return y[i] * (1 - fr) + (i + 1 < len ? y[i + 1] : 0) * fr
  }
  for (let n = 0; n < len; n++) {
    const x = n < exLen ? exc[n] * norm : 0
    // متوسط عيّنتين حول (n - period) يعطي تأخيراً كلياً = دورة واحدة بالضبط → درجة صوت دقيقة للأرباع
    const fb = 0.5 * (read(n - period + 0.5) + read(n - period - 0.5))
    y[n] = x + rho * fb
  }
  return y
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / len
      // انعكاسات مبكرة قليلة ثم ذيل متلاشٍ
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.01 ? 0.3 : 1)
    }
  }
  return buf
}

export const engine = new AudioEngine()
