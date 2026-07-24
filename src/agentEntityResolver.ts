export function requesterNameFromQuestion(question: string) {
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z·]{2,20})的(?:用户|需求人|合作|客户)?画像/,
    /(?:需求人|合作伙伴|客户|用户)\s*([\u4e00-\u9fa5A-Za-z·]{2,20})\s*(?:画像|特征|偏好)/,
  ]
  for (const pattern of patterns) {
    const match = question.match(pattern)
    if (match?.[1]) {
      return match[1]
        .replace(/^.*(?:帮我|给我|查一下|看一下|分析一下|凭印象)/, '')
        .replace(/^(?:的|一下|下)/, '')
        .trim()
    }
  }
  return ''
}

export function taskTitleFromQuestion(question: string) {
  return question
    .replace(/^(?:请|麻烦|帮我|给我|查一下|看一下|打开|读取|查看)\s*/, '')
    .replace(/(?:这个)?任务\s*#\d+[：:]?\s*/, '')
    .split(/(?:目前|现在|做到|的?详情|的?进展|卡在|为什么|有哪些|，|,)/)[0]
    .replace(/^(?:这个|那个|刚才那个|上述)/, '')
    .trim()
}
