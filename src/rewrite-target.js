export function rewriteTarget(text, finding, selection) {
  if (!text.trim()) return null;
  let start = selection?.start,
    end = selection?.end;
  if (
    !(
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      end <= text.length
    )
  ) {
    let pivot = Math.min(
      text.length,
      Math.max(0, finding?.start ?? selection?.start ?? 0),
    );
    if (pivot > 0 && /[.!?\n]/.test(text[pivot - 1])) pivot--;
    start = pivot;
    while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start--;
    end = Math.max(pivot, finding?.end ?? pivot);
    while (end < text.length && !/[.!?\n]/.test(text[end])) end++;
    if (end < text.length && text[end] !== "\n") end++;
  }
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end <= start || end - start > 3000) return null;
  return {
    start,
    end,
    original: text.slice(start, end),
    context: (
      text.slice(Math.max(0, start - 300), start) +
      "\n" +
      text.slice(end, end + 300)
    ).slice(0, 600),
  };
}
