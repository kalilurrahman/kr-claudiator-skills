const WATERMARK = `\n\n---\n*Created from KR Claudiator Skills | Built and shared for free by [Kalilur Rahman](https://kalilurrahman.lovable.app)*\n\n*⚠️ Disclaimer: AI-generated outcomes are entirely at the user's own risk.*`;

const WATERMARK_TXT = `\n\n---\nCreated from KR Claudiator Skills | Built and shared for free by Kalilur Rahman — https://kalilurrahman.lovable.app\n\nDisclaimer: AI-generated outcomes are entirely at the user's own risk.`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getFilename(skillName: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `kr-skill-${slugify(skillName)}-${date}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(skillName: string, content: string) {
  const filename = getFilename(skillName, "md");
  const blob = new Blob([content + WATERMARK], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, filename);
  return filename;
}

export function downloadText(skillName: string, content: string) {
  const filename = getFilename(skillName, "txt");
  const blob = new Blob([content + WATERMARK_TXT], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, filename);
  return filename;
}

export async function downloadPdf(skillName: string, content: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const filename = getFilename(skillName, "pdf");

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth() - 2 * margin;
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 10;

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "Created from KR Claudiator Skills | Built and shared for free by Kalilur Rahman — https://kalilurrahman.lovable.app",
      margin,
      footerY
    );
    doc.text(
      "Disclaimer: AI-generated outcomes are entirely at the user's own risk.",
      margin,
      footerY + 3
    );
  };

  // Header
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(`KR Claudiator Skills — ${skillName}`, margin, 20);

  doc.setFontSize(10);
  doc.setTextColor(60);

  const lines = doc.splitTextToSize(content, pageWidth);
  let y = 30;

  for (const line of lines) {
    if (y > footerY - 10) {
      addFooter();
      doc.addPage();
      y = 15;
    }
    doc.text(line, margin, y);
    y += 5;
  }

  addFooter();
  doc.save(filename);
  return filename;
}
