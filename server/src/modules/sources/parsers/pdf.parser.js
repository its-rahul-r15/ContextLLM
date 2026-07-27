import { PDFParse } from "pdf-parse";
import axios from "axios";
import fs from "fs";
import path from "path";

export const parsePdf = async (input) => {
  let buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === "string" && input.includes("/uploads/")) {
    const filename = input.substring(input.lastIndexOf("/") + 1);
    const filePath = path.join(process.cwd(), "uploads", filename);
    buffer = fs.readFileSync(filePath);
  } else if (typeof input === "string") {
    const response = await axios.get(input, { responseType: "arraybuffer" });
    buffer = Buffer.from(response.data);
  } else {
    throw new Error("Invalid PDF parser input type");
  }

  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();

  const pageTexts = [];
  data.pages.forEach((page) => {
    const trimmed = page.text.trim();
    if (trimmed.length > 0) {
      pageTexts.push({
        pageNumber: page.num,
        text: trimmed,
      });
    }
  });

  return {
    segments: pageTexts,
    meta: { pageCount: data.total },
  };
};
