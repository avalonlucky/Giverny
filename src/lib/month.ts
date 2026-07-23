export function monthLabelOf(value: string) {
  return `${Number(value.slice(0, 4))} 年 ${Number(value.slice(5, 7))} 月`
}
