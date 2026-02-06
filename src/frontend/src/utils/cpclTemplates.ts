/**
 * CPCL (Comtec Printer Control Language) template utilities
 * for generating print jobs for label printers
 */

export interface CpclLabelOptions {
  width?: number; // Label width in dots (default: 384 for 48mm label at 203dpi)
  height?: number; // Label height in dots (default: 240 for 30mm label at 203dpi)
  quantity?: number; // Number of labels to print (default: 1)
  barcodeHeight?: number; // Barcode height in dots
  barcodeWidthScale?: number; // Module width (narrow bar width)
  centerContents?: boolean; // Whether to center barcodes and text
  textGap?: number; // Gap between barcode and text in dots
  blockSpacing?: number; // Spacing between barcode blocks in dots
}

// Shared layout constants for 48x30mm labels at 203dpi (384x240 dots)
export const LABEL_LAYOUT = {
  // Label dimensions
  WIDTH: 384,
  HEIGHT: 240,
  
  // Margins and spacing
  LEFT_MARGIN: 30,        // Left margin for barcodes (quiet zone)
  TOP_MARGIN: 25,         // Top margin (reduced to maximize space)
  TITLE_HEIGHT: 20,       // Height reserved for title text
  BARCODE_SPACING: 95,    // Vertical space between first and second barcode (increased for taller barcodes)
  TEXT_GAP: 6,            // Gap between barcode bottom and text (in dots)
  
  // Barcode settings optimized for 203dpi printing and scanner readability
  BARCODE_HEIGHT: 60,     // Barcode height in dots (increased for better scanning)
  NARROW_BAR: 1,          // Narrow bar width (module width) - thinner for better scanning
  WIDE_BAR: 1,            // Wide bar width (same as narrow for Code128)
  
  // Text settings
  TEXT_FONT: 4,           // CPCL font 4 (medium size, readable)
  TEXT_SIZE: 0,           // Font size multiplier (0 = normal)
  TITLE_FONT: 4,          // Title font
  TITLE_SIZE: 1,          // Title font size multiplier (1 = 2x normal)
};

/**
 * Estimate Code128 barcode width in dots
 * Code128 uses 11 modules per character (including start/stop codes)
 */
function estimateCode128Width(text: string, moduleWidth: number): number {
  // Start code (11 modules) + data characters (11 modules each) + checksum (11 modules) + stop code (13 modules)
  const totalModules = 11 + (text.length * 11) + 11 + 13;
  return totalModules * moduleWidth;
}

/**
 * Calculate centered X position for a barcode
 */
function calculateCenteredBarcodeX(text: string, moduleWidth: number, labelWidth: number): number {
  const barcodeWidth = estimateCode128Width(text, moduleWidth);
  return Math.max(LABEL_LAYOUT.LEFT_MARGIN, Math.floor((labelWidth - barcodeWidth) / 2));
}

/**
 * Calculate centered X position for text
 * Font 4 at size 0 is approximately 8 pixels wide per character
 */
function calculateCenteredTextX(text: string, labelWidth: number): number {
  const textWidth = text.length * 8;
  return Math.max(LABEL_LAYOUT.LEFT_MARGIN, Math.floor((labelWidth - textWidth) / 2));
}

/**
 * Generate a simple test CPCL print job
 */
export function generateTestCpcl(options: CpclLabelOptions = {}): string {
  const width = options.width || LABEL_LAYOUT.WIDTH;
  const height = options.height || LABEL_LAYOUT.HEIGHT;
  const quantity = options.quantity || 1;

  // CPCL commands:
  // ! 0 200 200 height quantity - Initialize (offset, dpi-h, dpi-v, height, qty)
  // TEXT font size x y text - Print text
  // BARCODE type size x y data - Print barcode
  // PRINT - Execute print job
  
  return [
    `! 0 200 200 ${height} ${quantity}`,
    'TEXT 4 0 50 50 Test Print',
    'TEXT 4 0 50 100 CPCL Protocol',
    'TEXT 4 0 50 150 Connection OK',
    'BARCODE 128 1 1 50 50 180 TEST123',
    'PRINT',
    '',
  ].join('\r\n');
}

/**
 * Generate a CPCL label for dual serial numbers with title
 * Layout: Title (centered at top), Barcode #1 (centered), Serial #1 (centered below), Barcode #2 (centered), Serial #2 (centered below)
 * Optimized for 48x30mm labels at 203dpi with improved scanner readability
 */
export function generateDualSerialCpcl(
  serial1: string,
  serial2: string,
  title: string = 'Dual Band',
  options: CpclLabelOptions = {}
): string {
  const width = options.width || LABEL_LAYOUT.WIDTH;
  const height = options.height || LABEL_LAYOUT.HEIGHT;
  const quantity = options.quantity || 1;
  const barcodeHeight = options.barcodeHeight || LABEL_LAYOUT.BARCODE_HEIGHT;
  const moduleWidth = options.barcodeWidthScale || LABEL_LAYOUT.NARROW_BAR;
  const textGap = options.textGap !== undefined ? options.textGap : LABEL_LAYOUT.TEXT_GAP;
  const blockSpacing = options.blockSpacing !== undefined ? options.blockSpacing : LABEL_LAYOUT.BARCODE_SPACING;

  // Calculate Y positions for layout with title at top
  const titleY = 5; // Title at very top
  const barcode1Y = LABEL_LAYOUT.TOP_MARGIN;
  const text1Y = barcode1Y + barcodeHeight + textGap;
  const barcode2Y = barcode1Y + blockSpacing;
  const text2Y = barcode2Y + barcodeHeight + textGap;

  // Calculate centered X position for title
  // Font 4 at size 1 is approximately 16 pixels wide per character
  const titleWidth = title.length * 16;
  const titleX = Math.max(10, Math.floor((width - titleWidth) / 2));

  // Calculate centered X positions for barcodes
  const barcode1X = calculateCenteredBarcodeX(serial1, moduleWidth, width);
  const barcode2X = calculateCenteredBarcodeX(serial2, moduleWidth, width);

  // Calculate centered X positions for serial text
  const text1X = calculateCenteredTextX(serial1, width);
  const text2X = calculateCenteredTextX(serial2, width);
  
  return [
    `! 0 200 200 ${height} ${quantity}`,
    `PAGE-WIDTH ${width}`,
    // Title centered at top
    `TEXT ${LABEL_LAYOUT.TITLE_FONT} ${LABEL_LAYOUT.TITLE_SIZE} ${titleX} ${titleY} ${title}`,
    // First barcode centered with improved parameters for scanner readability
    // BARCODE 128 narrow wide height x y data
    `BARCODE 128 ${moduleWidth} ${moduleWidth} ${barcodeHeight} ${barcode1X} ${barcode1Y} ${serial1}`,
    // First serial text centered below barcode
    `TEXT ${LABEL_LAYOUT.TEXT_FONT} ${LABEL_LAYOUT.TEXT_SIZE} ${text1X} ${text1Y} ${serial1}`,
    // Second barcode centered
    `BARCODE 128 ${moduleWidth} ${moduleWidth} ${barcodeHeight} ${barcode2X} ${barcode2Y} ${serial2}`,
    // Second serial text centered below barcode
    `TEXT ${LABEL_LAYOUT.TEXT_FONT} ${LABEL_LAYOUT.TEXT_SIZE} ${text2X} ${text2Y} ${serial2}`,
    'PRINT',
    '',
  ].join('\r\n');
}

/**
 * Parse protocol string to extract protocol type
 */
export function parseProtocolString(protocolString: string): 'CPCL' | 'ZPL' | 'ESC/POS' {
  const upper = protocolString.toUpperCase();
  if (upper.includes('CPCL')) return 'CPCL';
  if (upper.includes('ZPL')) return 'ZPL';
  if (upper.includes('ESC') || upper.includes('POS')) return 'ESC/POS';
  return 'CPCL'; // Default
}

/**
 * Export helper functions for preview consistency
 */
export { estimateCode128Width, calculateCenteredBarcodeX, calculateCenteredTextX };
