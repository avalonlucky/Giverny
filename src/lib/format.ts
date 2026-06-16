export function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const upperDigits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const upperUnits = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿']

export function toChineseAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) {
    return ''
  }

  const integer = Math.floor(amount)
  const cents = Math.round((amount - integer) * 100)
  if (integer === 0 && cents === 0) {
    return '零元整'
  }

  let text = ''
  if (integer > 0) {
    const str = String(integer)
    let zeroPending = false
    for (let i = 0; i < str.length; i += 1) {
      const digit = Number(str[i])
      const unit = upperUnits[str.length - 1 - i]
      if (digit === 0) {
        zeroPending = true
        if (unit === '万' || unit === '亿') {
          text += unit
          zeroPending = false
        }
      } else {
        if (zeroPending) {
          text += '零'
          zeroPending = false
        }
        text += upperDigits[digit] + unit
      }
    }
    text += '元'
  }

  if (cents === 0) {
    return `${text}整`
  }

  const jiao = Math.floor(cents / 10)
  const fen = cents % 10
  if (jiao > 0) {
    text += `${upperDigits[jiao]}角`
  } else if (integer > 0) {
    text += '零'
  }
  if (fen > 0) {
    text += `${upperDigits[fen]}分`
  }

  return text
}
