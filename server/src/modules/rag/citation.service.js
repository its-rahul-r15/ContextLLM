export const buildCitationMap = (chunks) => {
  const map = {};
  chunks.forEach((chunk, idx) => {
    const ref = idx + 1;
    map[ref] = {
      chunkId: chunk._id,
      sourceId: chunk.sourceId,
      location: chunk.location,
      text: chunk.text,
    };
  });
  return map;
};

export const parseCitations = (llmText, citationMap) => {
  const usedRefs = new Set();
  const pattern = /\[(\d+)\]/g;
  let match;
  while ((match = pattern.exec(llmText)) !== null) {
    const ref = parseInt(match[1]);
    if (citationMap[ref]) usedRefs.add(ref);
  }

  return Array.from(usedRefs).map((ref) => ({
    ref,
    ...citationMap[ref],
  }));
};
