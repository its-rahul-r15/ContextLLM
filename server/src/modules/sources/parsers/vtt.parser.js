import axios from "axios";
import { parseSync } from "subtitle";

export const parseVtt = async (cloudinaryUrl) => {
  const response = await axios.get(cloudinaryUrl, { responseType: "text" });
  const nodes = parseSync(response.data);

  const segments = nodes
    .filter((n) => n.type === "cue")
    .map((cue, idx) => ({
      paragraphIndex: idx,
      timestamp: Math.floor(cue.data.start / 1000),
      text: cue.data.text.replace(/<[^>]+>/g, "").trim(),
    }))
    .filter((s) => s.text.length > 0);

  return { segments, meta: { cueCount: segments.length } };
};
