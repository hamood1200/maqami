/** أرقام عربية مشرقية: ١٢٣ */
export const arNum = (n: number, pad = 1) => n.toLocaleString('ar-EG', { minimumIntegerDigits: pad, useGrouping: false })
