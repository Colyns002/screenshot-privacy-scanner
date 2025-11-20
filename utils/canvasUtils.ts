import { RiskItem } from "../types";

export const downloadRedactedImage = (
  imageUrl: string,
  risks: RiskItem[],
  onSuccess: () => void
) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Draw redactions
    risks.forEach((risk) => {
      if (risk.isRedacted && risk.box_2d) {
        const { ymin, xmin, ymax, xmax } = risk.box_2d;
        
        // Convert 0-1000 scale to pixel coordinates
        const x = (xmin / 1000) * canvas.width;
        const y = (ymin / 1000) * canvas.height;
        const w = ((xmax - xmin) / 1000) * canvas.width;
        const h = ((ymax - ymin) / 1000) * canvas.height;

        // Draw black rectangle
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, y, w, h);

        // Optional: Add a "REDACTED" label for large enough areas
        // if (h > 20) {
        //   ctx.fillStyle = "#333";
        //   ctx.font = "bold 12px sans-serif";
        //   ctx.fillText("REDACTED", x + 2, y + h - 5);
        // }
      }
    });

    // Trigger download
    const link = document.createElement("a");
    link.download = `safe-screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    onSuccess();
  };
};
