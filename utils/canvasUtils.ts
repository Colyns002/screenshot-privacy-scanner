import { RiskItem, ImageFilters } from "../types";

export const downloadRedactedImage = (
  imageUrl: string,
  risks: RiskItem[],
  filters: ImageFilters,
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

    // Apply filters
    const filterString = `grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) brightness(${filters.brightness}%) contrast(${filters.contrast}%) blur(${filters.blur}px)`;
    ctx.filter = filterString;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Reset filter for redactions (we want solid black/patterns, not filtered)
    ctx.filter = 'none';

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

        // Draw Custom Text Label if present
        if (risk.customText) {
          ctx.fillStyle = "#ffffff";
          
          // Calculate dynamic font size based on box height, max 24px, min 10px
          const fontSize = Math.max(10, Math.min(h * 0.5, 24)); 
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          // Ensure text fits width-wise approximately
          ctx.fillText(risk.customText, x + w / 2, y + h / 2, w); 
        }
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