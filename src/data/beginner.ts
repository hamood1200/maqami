import { MAQAM_BY_ID, type Maqam } from './maqamat'

/** المقامات الثمانية بترتيب التعلّم: من الأقرب للأذن إلى الأصعب */
export const BEGINNER_ORDER = ['rast', 'bayati', 'hijaz', 'nahawand', 'ajam', 'kurd', 'saba', 'sikah']

/** وصف قصير بلا مصطلحات، للمبتدئ */
export const BEGINNER_TEXT: Record<string, string> = {
  rast: 'مقام فخم ومستقر، وهو أساس الموسيقى العربية. فيه نغمة «بين المفتاحين» تعطيه طعمه الشرقي.',
  bayati: 'دافئ وقريب من القلب، وكثير في الأغاني الشعبية. تسمع النغمة الربعية من أول خطوة.',
  hijaz: 'شرقي جداً وفيه شجن. ستسمع قفزة واسعة بين النغمة الثانية والثالثة.',
  nahawand: 'رقيق وعاطفي، يشبه «المينور». كثير في الأغاني الرومانسية، ولا أرباع فيه.',
  ajam: 'مشرق وفرِح، يشبه «الماجور». تسمعه في الأناشيد والأغاني المبهجة.',
  kurd: 'حزين بهدوء، وكثير في الأغاني الحديثة. يبدأ بخطوة صغيرة جداً فوق القرار.',
  saba: 'أكثر المقامات حزناً. نغماته متقاربة كأنها تئن، ولا يعود إلى نفس النغمة في الأعلى.',
  sikah: 'تأملي وروحاني. يبدأ من نغمة ربعية، لذلك يبدو «معلّقاً».',
}

export const BEGINNER_MAQAMAT: Maqam[] = BEGINNER_ORDER.map((id) => MAQAM_BY_ID[id])

export const isBeginnerMaqam = (id: string) => BEGINNER_ORDER.includes(id)

export function nextBeginner(id: string): Maqam | null {
  const i = BEGINNER_ORDER.indexOf(id)
  return i >= 0 && i < BEGINNER_ORDER.length - 1 ? MAQAM_BY_ID[BEGINNER_ORDER[i + 1]] : null
}
