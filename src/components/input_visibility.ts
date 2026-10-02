type Bounds = { y: number; height: number };

/** Move only enough to expose the focused field inside its scroll viewport. */
export function inputScrollDelta(input: Bounds, viewport: Bounds, keyboardTop?: number) {
  const top = viewport.y + 12;
  const bottom = Math.min(viewport.y + viewport.height, keyboardTop ?? Infinity) - 12;
  if (bottom <= top) return 0;
  if (input.height > bottom - top || input.y < top) return input.y - top;
  return Math.max(0, input.y + input.height - bottom);
}
