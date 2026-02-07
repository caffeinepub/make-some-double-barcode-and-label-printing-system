/**
 * Shared label preview renderer
 * Ensures preview canvas matches CPCL output exactly
 */

import { DualSerialLayout } from './labelLayoutModel';

// CODE128 encoding patterns - each pattern is 11 modules wide
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2],
  [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3],
  [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1],
  [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2],
  [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2],
  [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1],
  [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3],
  [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3],
  [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1],
  [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1],
  [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3],
  [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1],
  [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2],
  [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4],
  [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1],
  [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1],
  [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2],
  [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1],
  [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1],
  [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1],
  [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4],
  [2,1,1,2,3,2], [2,3,3,1,1,1,2]
];

const START_CODE_B = 104;
const STOP_CODE = 106;

function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    let value = charCode - 32;
    if (value < 0 || value > 95) value = 0;
    codes.push(value);
    checksum += value * (i + 1);
  }
  
  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  
  return codes;
}

/**
 * Render a Code128 barcode on canvas
 * Returns the actual width of the rendered barcode
 */
function renderBarcode(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  moduleWidth: number,
  height: number
): number {
  const codes = encodeCode128B(text);
  let currentX = x;
  
  ctx.fillStyle = 'black';
  
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;
    
    for (let i = 0; i < pattern.length; i++) {
      const barWidth = pattern[i] * moduleWidth;
      if (i % 2 === 0) {
        ctx.fillRect(currentX, y, barWidth, height);
      }
      currentX += barWidth;
    }
  }
  
  return currentX - x;
}

/**
 * Render a dual-serial label preview on canvas
 * Uses the unified layout model to ensure 1:1 match with CPCL output
 */
export function renderLabelPreview(
  canvas: HTMLCanvasElement,
  layout: DualSerialLayout,
  serial1: string,
  serial2: string,
  title: string,
  zoom: number = 100,
  textSize?: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Use textSize from layout if not provided
  const effectiveTextSize = textSize !== undefined ? textSize : layout.textSize;

  // Calculate aspect ratio from layout dimensions
  const aspectRatio = layout.labelWidth / layout.labelHeight;
  const dpr = window.devicePixelRatio || 1;
  
  // Base size in CSS pixels (scaled by zoom)
  const baseWidth = 400 * (zoom / 100);
  const baseHeight = baseWidth / aspectRatio;
  
  // Reset canvas transform to avoid accumulated scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  // Set canvas bitmap size
  canvas.width = baseWidth * dpr;
  canvas.height = baseHeight * dpr;
  
  // Set CSS size
  canvas.style.width = `${baseWidth}px`;
  canvas.style.height = `${baseHeight}px`;
  
  // Scale context for device pixel ratio
  ctx.scale(dpr, dpr);
  
  // Calculate scale factor from dots to CSS pixels
  const scale = baseWidth / layout.labelWidth;
  
  // Clear with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Render title
  ctx.fillStyle = 'black';
  ctx.font = `bold ${16 * scale}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, layout.titleX * scale, layout.titleY * scale);

  // Render first barcode
  renderBarcode(
    ctx,
    serial1,
    layout.barcode1X * scale,
    layout.barcode1Y * scale,
    layout.moduleWidth * scale,
    layout.barcodeHeight * scale
  );

  // Render first text with configurable size
  ctx.font = `${effectiveTextSize * scale}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(serial1, layout.text1X * scale, layout.text1Y * scale);

  // Render second barcode
  renderBarcode(
    ctx,
    serial2,
    layout.barcode2X * scale,
    layout.barcode2Y * scale,
    layout.moduleWidth * scale,
    layout.barcodeHeight * scale
  );

  // Render second text with configurable size
  ctx.fillText(serial2, layout.text2X * scale, layout.text2Y * scale);
}
