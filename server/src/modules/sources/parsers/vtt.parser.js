import axios from "axios";
import { parseSync } from "subtitle";
import fs from "fs";
import path from "path";

export const parseVtt = async (input) => {
  let content;
  if (Buffer.isBuffer(input)) {
    content = input.toString("utf-8");
  } else if (typeof input === "string" && input.includes("/uploads/")) {
    const filename = input.substring(input.lastIndexOf("/") + 1);
    const filePath = path.join(process.cwd(), "uploads", filename);
    content = fs.readFileSync(filePath, "utf-8");
  } else if (typeof input === "string") {
    const response = await axios.get(input, { responseType: "text" });
    content = response.data;
  } else {
    throw new Error("Invalid VTT parser input type");
  }
  const nodes = parseSync(content);

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
