// Origin is supplied by Chromium, never by the page/message payload.
export function isContentSender(sender, extensionId) {
  if (sender.id !== extensionId || !sender.tab) return false;
  if (/^https?:\/\//.test(sender.url || "")) return true;
  return (
    sender.frameId > 0 &&
    /^(?:about:(?:blank|srcdoc)(?:[#?]|$)|blob:)/.test(sender.url || "") &&
    /^https?:\/\//.test(sender.origin || "")
  );
}
