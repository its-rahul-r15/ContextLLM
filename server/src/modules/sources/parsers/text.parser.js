export const parseText = (content) => {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const segments = paragraphs.map((text, paragraphIndex) => ({
    paragraphIndex,
    text,
  }));

  return { segments, meta: { charCount: content.length, paragraphCount: segments.length } };
};
