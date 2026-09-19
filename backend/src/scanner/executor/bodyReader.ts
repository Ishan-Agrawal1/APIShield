export async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean; observedBytes: number }> {
  if (!response.body) {
    const text = await response.text();
    const observedBytes = Buffer.byteLength(text);
    if (observedBytes > maxBytes) {
      return { text: text.slice(0, maxBytes), truncated: true, observedBytes };
    }
    return { text, truncated: false, observedBytes };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let observedBytes = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    observedBytes += value.byteLength;
    if (observedBytes > maxBytes) {
      const remaining = maxBytes - (observedBytes - value.byteLength);
      if (remaining > 0) {
        chunks.push(value.slice(0, remaining));
      }
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { text: buffer.toString('utf8'), truncated, observedBytes: truncated ? maxBytes : observedBytes };
}
