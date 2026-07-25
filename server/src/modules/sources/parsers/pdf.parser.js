import { PDFParse } from "pdf-parse";
import axios from "axios";

export const parsePdf = async (cloudinaryUrl) => {
  const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

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
