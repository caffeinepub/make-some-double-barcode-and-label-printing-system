/**
 * CPCL (Comtec Printer Control Language) template utilities
 * for generating print jobs for label printers
 */

import { computeDualSerialLayout, LABEL_DOTS } from './labelLayoutModel';
import { LabelConfig } from '../backend';

export interface CpclLabelOptions {
  width?: number; // Label width in dots (default: 384 for 48mm label at 203dpi)
  height?: number; // Label height in dots (default: 240 for 30mm label at 203dpi)
  quantity?: number; // Number of labels to print (default: 1)
  config?: LabelConfig | null; // Label configuration from backend
}

// Re-export layout constants for backward compatibility
export const LABEL_LAYOUT = {
  WIDTH: LABEL_DOTS.WIDTH,
  HEIGHT: LABEL_DOTS.HEIGHT,
  LEFT_MARGIN: 30,
  TOP_MARGIN: 25,
  TITLE_HEIGHT: 20,
  BARCODE_SPACING: 95,
  TEXT_GAP: 6,
  BARCODE_HEIGHT: 60,
  NARROW_BAR: 1,
  WIDE_BAR: 1,
  TEXT_FONT: 4,
  TEXT_SIZE: 0,
  TITLE_FONT: 4,
  TITLE_SIZE: 1,
};

/**
 * Estimate Code128 barcode width in dots (for backward compatibility)
 */
export function estimateCode128Width(text: string, moduleWidth: number): number {
  const totalModules = 11 + (text.length * 11) + 11 + 13;
  return totalModules * moduleWidth;
}

/**
 * Calculate centered X position for text (for backward compatibility)
 */
export function calculateCenteredTextX(text: string, labelWidth: number): number {
  const textWidth = text.length * 8;
  return Math.max(LABEL_LAYOUT.LEFT_MARGIN, Math.floor((labelWidth - textWidth) / 2));
}

/**
 * Generate a simple test CPCL print job
 */
export function generateTestCpcl(options: CpclLabelOptions = {}): string {
  const width = options.width || LABEL_DOTS.WIDTH;
  const height = options.height || LABEL_DOTS.HEIGHT;
  const quantity = options.quantity || 1;
  
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
 * Uses unified layout model to match preview exactly
 */
export function generateDualSerialCpcl(
  serial1: string,
  serial2: string,
  title: string = 'Dual Band',
  options: CpclLabelOptions = {}
): string {
  const width = options.width || LABEL_DOTS.WIDTH;
  const height = options.height || LABEL_DOTS.HEIGHT;
  const quantity = options.quantity || 1;
  
  // Compute layout using unified model
  const layout = computeDualSerialLayout(serial1, serial2, title, options.config);
  
  return [
    `! 0 200 200 ${height} ${quantity}`,
    `PAGE-WIDTH ${width}`,
    // Title centered at top
    `TEXT ${LABEL_LAYOUT.TITLE_FONT} ${LABEL_LAYOUT.TITLE_SIZE} ${layout.titleX} ${layout.titleY} ${title}`,
    // First barcode
    `BARCODE 128 ${layout.moduleWidth} ${layout.moduleWidth} ${layout.barcodeHeight} ${layout.barcode1X} ${layout.barcode1Y} ${serial1}`,
    // First serial text
    `TEXT ${LABEL_LAYOUT.TEXT_FONT} ${LABEL_LAYOUT.TEXT_SIZE} ${layout.text1X} ${layout.text1Y} ${serial1}`,
    // Second barcode
    `BARCODE 128 ${layout.moduleWidth} ${layout.moduleWidth} ${layout.barcodeHeight} ${layout.barcode2X} ${layout.barcode2Y} ${serial2}`,
    // Second serial text
    `TEXT ${LABEL_LAYOUT.TEXT_FONT} ${LABEL_LAYOUT.TEXT_SIZE} ${layout.text2X} ${layout.text2Y} ${serial2}`,
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
