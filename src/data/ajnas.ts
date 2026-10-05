// الأجناس: اللبنات الصغيرة (3–5 نغمات) التي تُبنى منها المقامات.

export type JinsId =
  | 'rast'
  | 'bayati'
  | 'sikah'
  | 'hijaz'
  | 'saba'
  | 'saba_zamzam'
  | 'nahawand'
  | 'ajam'
  | 'kurd'
  | 'nikriz'

export interface Jins {
  id: JinsId
  name: string
  /** النغمات في موضعها التقليدي */
  notes: string[]
  summary: string
  /** هل يدخل في اختبار الأجناس الأساسي */
  basic: boolean
}

export const AJNAS: Jins[] = [
  {
    id: 'rast',
    name: 'راست',
    notes: ['C4', 'D4', 'Ehb4', 'F4', 'G4'],
    summary: 'تون ثم ¾ تون ثم ¾ تون. الدرجة الثالثة (السيكاه) هي سرّ لونه الشرقي الرصين.',
    basic: true,
  },
  {
    id: 'bayati',
    name: 'بياتي',
    notes: ['D4', 'Ehb4', 'F4', 'G4'],
    summary: 'يبدأ بـ ¾ تون ثم ¾ تون ثم تون. دافئ وقريب من الأذن العربية.',
    basic: true,
  },
  {
    id: 'sikah',
    name: 'سيكاه',
    notes: ['Ehb4', 'F4', 'G4'],
    summary: 'جنس ثلاثي يبدأ من نغمة ربعية: ¾ تون ثم تون. طابعه تأملي.',
    basic: true,
  },
  {
    id: 'hijaz',
    name: 'حجاز',
    notes: ['D4', 'Eb4', 'F#4', 'G4'],
    summary: 'نصف تون ثم تون ونصف ثم نصف تون. المسافة الواسعة في وسطه تعطيه طابعه الشرقي المميز.',
    basic: true,
  },
  {
    id: 'saba',
    name: 'صبا',
    notes: ['D4', 'Ehb4', 'F4', 'Gb4'],
    summary: '¾ تون ثم ¾ تون ثم نصف تون. رابعته منخفضة فتمنحه الشجن والأنين.',
    basic: true,
  },
  {
    id: 'nahawand',
    name: 'نهاوند',
    notes: ['C4', 'D4', 'Eb4', 'F4', 'G4'],
    summary: 'تون ثم نصف تون ثم تون. يشبه بداية السلم الصغير (المينور).',
    basic: true,
  },
  {
    id: 'ajam',
    name: 'عجم',
    notes: ['Bb3', 'C4', 'D4', 'Eb4', 'F4'],
    summary: 'تون ثم تون ثم نصف تون. يشبه بداية السلم الكبير (الماجور)، مشرق وفرِح.',
    basic: true,
  },
  {
    id: 'kurd',
    name: 'كرد',
    notes: ['D4', 'Eb4', 'F4', 'G4'],
    summary: 'نصف تون ثم تون ثم تون. رقيق وحزين بهدوء.',
    basic: true,
  },
  {
    id: 'nikriz',
    name: 'نكريز',
    notes: ['C4', 'D4', 'Eb4', 'F#4', 'G4'],
    summary: 'تون ثم نصف تون ثم تون ونصف ثم نصف تون. فيه مسافة الحجاز لكن في موضع مختلف.',
    basic: false,
  },
  {
    id: 'saba_zamzam',
    name: 'صبا زمزم',
    notes: ['D4', 'Eb4', 'F4', 'Gb4'],
    summary: 'نسخة من الصبا بلا أرباع: نصف تون ثم تون ثم نصف تون.',
    basic: false,
  },
]

export const AJNAS_BY_ID = Object.fromEntries(AJNAS.map((j) => [j.id, j])) as Record<JinsId, Jins>
