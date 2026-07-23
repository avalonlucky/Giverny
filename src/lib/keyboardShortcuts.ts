export function isEditableShortcutTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

const monthShortcutByCode: Record<string, number> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  Digit0: 10,
  Minus: 11,
  Equal: 12,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
  Numpad5: 5,
  Numpad6: 6,
  Numpad7: 7,
  Numpad8: 8,
  Numpad9: 9,
  Numpad0: 10,
  NumpadSubtract: 11,
  NumpadAdd: 12,
}

export function monthFromShortcut(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return 0
  return monthShortcutByCode[event.code] ?? 0
}
