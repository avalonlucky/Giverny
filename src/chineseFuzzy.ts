/**
 * 中文音近容错：基于拼音首字母 + 常见混淆字符组的模糊匹配。
 * 用于任务标题、产品知识检索的 typo 容忍。
 */

// 常见混淆字符组（同音/近音）
const CONFUSABLE_GROUPS: string[][] = [
  ['分', '封', '丰', '风', '峰', '锋', '蜂', '枫'],
  ['套', '淘', '陶', '桃'],
  ['改', '盖', '概', '该'],
  ['修', '休', '秀', '绣'],
  ['产', '缠', '禅'],
  ['品', '拼', '频'],
  ['公', '工', '功', '攻', '供'],
  ['司', '思', '丝', '私'],
  ['时', '十', '实', '食', '识'],
  ['间', '简', '见', '建', '件'],
  ['线', '现', '限', '献', '先'],
  ['链', '连', '联', '练'],
  ['路', '录', '陆', '露'],
  ['任', '认', '仁'],
  ['务', '物', '误', '悟'],
  ['进', '近', '尽', '劲'],
  ['展', '占', '站', '战'],
  ['反', '返', '犯'],
  ['馈', '愧', '溃'],
  ['验', '严', '言', '研'],
  ['收', '手', '首', '守'],
  ['附', '付', '复', '富', '副'],
  ['文', '闻', '纹', '稳'],
  ['图', '途', '涂', '兔'],
  ['标', '表', '彪'],
  ['题', '提', '体', '替'],
  ['需', '须', '虚'],
  ['求', '球', '秋'],
  ['设', '社', '射', '涉'],
  ['计', '记', '纪', '际', '季'],
  ['开', '凯', '慨'],
  ['发', '法', '罚', '伐'],
  ['布', '步', '部', '补'],
  ['版', '板', '办', '半'],
  ['本', '奔', '笨'],
  ['更', '耕', '庚'],
  ['新', '心', '辛', '欣'],
  ['记', '纪', '技', '寄'],
]

// 建立字符 → 组索引的映射
const charToGroup = new Map<string, number>()
CONFUSABLE_GROUPS.forEach((group, index) => {
  for (const char of group) charToGroup.set(char, index)
})

/**
 * 判断两个字符是否音近（同组）
 */
export function isPhoneticallySimilar(a: string, b: string): boolean {
  if (a === b) return true
  const groupA = charToGroup.get(a)
  const groupB = charToGroup.get(b)
  return groupA !== undefined && groupA === groupB
}

/**
 * 计算两个中文字符串的音近编辑距离。
 * 替换同音字符的代价为 0.3，普通替换代价为 1。
 */
export function phoneticEditDistance(source: string, target: string): number {
  const m = source.length
  const n = target.length
  if (m === 0) return n
  if (n === 0) return m
  if (Math.abs(m - n) > 3) return Math.max(m, n) // 长度差太大，直接返回

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        const substitutionCost = isPhoneticallySimilar(source[i - 1], target[j - 1]) ? 0.3 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,       // 删除
          dp[i][j - 1] + 1,       // 插入
          dp[i - 1][j - 1] + substitutionCost, // 替换（音近代价低）
        )
      }
    }
  }
  return dp[m][n]
}

/**
 * 生成一个字符串的音近变体（替换每个字符为同组其他字符）。
 * 只生成距离 1 的变体，避免组合爆炸。
 */
export function phoneticVariants(input: string, maxVariants = 12): string[] {
  const variants: string[] = []
  const chars = [...input]
  for (let i = 0; i < chars.length && variants.length < maxVariants; i++) {
    const groupIndex = charToGroup.get(chars[i])
    if (groupIndex === undefined) continue
    for (const replacement of CONFUSABLE_GROUPS[groupIndex]) {
      if (replacement === chars[i]) continue
      const variant = chars.slice(0, i).join('') + replacement + chars.slice(i + 1).join('')
      variants.push(variant)
      if (variants.length >= maxVariants) break
    }
  }
  return variants
}

/**
 * 在候选列表中查找音近匹配。
 * 返回最佳匹配（距离最小且低于阈值）。
 */
export function findPhoneticMatch(
  query: string,
  candidates: string[],
  threshold = 1.5,
): { match: string; distance: number } | null {
  let best: { match: string; distance: number } | null = null
  for (const candidate of candidates) {
    // 先检查子串包含
    if (candidate.includes(query) || query.includes(candidate)) continue // 精确匹配已覆盖
    const distance = phoneticEditDistance(query, candidate)
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { match: candidate, distance }
    }
  }
  return best
}

/**
 * 判断查询中是否包含可能的错别字（与候选标题音近但不精确匹配）。
 * 用于在搜索结果中附加"你是不是想说"提示。
 */
export function suggestCorrection(
  query: string,
  candidates: string[],
  threshold = 1.5,
): string | null {
  // 提取查询中的关键片段（2-6字）
  const segments = query.match(/[\u4e00-\u9fff]{2,6}/g) || []
  for (const segment of segments) {
    // 如果精确匹配到了就跳过
    if (candidates.some((c) => c.includes(segment))) continue
    // 尝试音近匹配
    for (const candidate of candidates) {
      const candidateSegments = candidate.match(/[\u4e00-\u9fff]{2,6}/g) || []
      for (const cs of candidateSegments) {
        if (Math.abs(cs.length - segment.length) > 1) continue
        const distance = phoneticEditDistance(segment, cs)
        if (distance > 0 && distance <= threshold) {
          return candidate
        }
      }
    }
  }
  return null
}
