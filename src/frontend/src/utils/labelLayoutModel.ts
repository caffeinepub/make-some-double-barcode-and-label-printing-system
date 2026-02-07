/**
 * Unified label layout model for both preview and CPCL printing
 * Ensures preview matches printed output exactly
 */

import { LabelConfig } from '../backend';

// Physical label dimensions
export const LABEL_PHYSICAL = {
  WIDTH_MM: 48,
  HEIGHT_MM: 30,
};

// CPCL printer resolution
export const CPCL_DPI = 203;
export const DOTS_PER_MM = CPCL_DPI / 25.4; // ~8 dots per mm

// Label dimensions in dots
export const LABEL_DOTS = {
  WIDTH: Math.round(LABEL_PHYSICAL.WIDTH_MM * DOTS_PER_MM), // 384 dots
  HEIGHT: Math.round(LABEL_PHYSICAL.HEIGHT_MM * DOTS_PER_MM), // 240 dots
};

// Default layout constants (in dots)
export const DEFAULT_LAYOUT = {
  // Title
  TITLE_Y: 5,
  TITLE_FONT_SIZE: 16, // pixels per character at size 1
  
  // Margins
  LEFT_MARGIN: 30,
  TOP_MARGIN: 25,
  
  // Barcode settings
  BARCODE_HEIGHT: 60,
  NARROW_BAR: 1, // module width
  
  // Spacing
  TEXT_GAP: 8, // gap between barcode bottom and text (increased for better spacing)
  BLOCK_SPACING: 95, // vertical space between first and second barcode
  
  // Text settings
  TEXT_FONT_SIZE: 8, // pixels per character at size 0
};

// Minimum safe spacing to prevent overlaps
export const MIN_SAFE = {
  TEXT_GAP: 6, // minimum gap between barcode and text
  BLOCK_SPACING: 70, // minimum spacing between blocks
};

/**
 * Estimate Code128 barcode width in dots
 */
export function estimateCode128Width(text: string, moduleWidth: number): number {
  // Start code (11 modules) + data characters (11 modules each) + checksum (11 modules) + stop code (13 modules)
  const totalModules = 11 + (text.length * 11) + 11 + 13;
  return totalModules * moduleWidth;
}

/**
 * Calculate centered X position for a barcode
 */
export function calculateCenteredBarcodeX(text: string, moduleWidth: number): number {
  const barcodeWidth = estimateCode128Width(text, moduleWidth);
  return Math.max(DEFAULT_LAYOUT.LEFT_MARGIN, Math.floor((LABEL_DOTS.WIDTH - barcodeWidth) / 2));
}

/**
 * Calculate centered X position for text
 */
export function calculateCenteredTextX(text: string, fontSize: number = DEFAULT_LAYOUT.TEXT_FONT_SIZE): number {
  const textWidth = text.length * fontSize;
  return Math.max(DEFAULT_LAYOUT.LEFT_MARGIN, Math.floor((LABEL_DOTS.WIDTH - textWidth) / 2));
}

/**
 * Calculate centered X position for title
 */
export function calculateCenteredTitleX(title: string): number {
  const titleWidth = title.length * DEFAULT_LAYOUT.TITLE_FONT_SIZE;
  return Math.max(10, Math.floor((LABEL_DOTS.WIDTH - titleWidth) / 2));
}

/**
 * Computed layout for dual-serial label with title
 */
export interface DualSerialLayout {
  // Label dimensions
  labelWidth: number;
  labelHeight: number;
  
  // Title
  titleX: number;
  titleY: number;
  
  // First barcode block
  barcode1X: number;
  barcode1Y: number;
  text1X: number;
  text1Y: number;
  
  // Second barcode block
  barcode2X: number;
  barcode2Y: number;
  text2X: number;
  text2Y: number;
  
  // Barcode settings
  barcodeHeight: number;
  moduleWidth: number;
  
  // Text settings
  textSize: number;
  
  // Effective (clamped) values
  effectiveTextGap: number;
  effectiveBlockSpacing: number;
}

/**
 * Compute layout from LabelConfig or defaults
 * Applies guardrails to prevent overlaps
 * Ensures both barcodes and text are centered when centerContents is true
 */
export function computeDualSerialLayout(
  serial1: string,
  serial2: string,
  title: string,
  config?: LabelConfig | null
): DualSerialLayout {
  // Extract config values or use defaults
  const barcodeHeight = config ? Number(config.barcodeHeight) : DEFAULT_LAYOUT.BARCODE_HEIGHT;
  const moduleWidth = config ? Number(config.barcodeWidthScale) : DEFAULT_LAYOUT.NARROW_BAR;
  const centerContents = config ? config.centerContents : true;
  const textSize = config && Number(config.textSize) > 0 ? Number(config.textSize) : DEFAULT_LAYOUT.TEXT_FONT_SIZE;
  
  // Calculate text gap and block spacing from config
  let requestedTextGap = DEFAULT_LAYOUT.TEXT_GAP;
  let requestedBlockSpacing = DEFAULT_LAYOUT.BLOCK_SPACING;
  
  if (config) {
    // Text gap is the distance between barcode bottom and text top
    const configTextGap = Number(config.textPositionY) - Number(config.barcodePositionY) - barcodeHeight;
    if (configTextGap > 0) {
      requestedTextGap = configTextGap;
    }
    
    // Block spacing is stored directly
    requestedBlockSpacing = Number(config.horizontalSpacing);
  }
  
  // Apply guardrails to prevent overlaps
  const effectiveTextGap = Math.max(MIN_SAFE.TEXT_GAP, requestedTextGap);
  const effectiveBlockSpacing = Math.max(MIN_SAFE.BLOCK_SPACING, requestedBlockSpacing);
  
  // Calculate positions
  const titleX = calculateCenteredTitleX(title);
  const titleY = DEFAULT_LAYOUT.TITLE_Y;
  
  const barcode1Y = DEFAULT_LAYOUT.TOP_MARGIN;
  
  // Center both barcodes when centerContents is true
  const barcode1X = centerContents
    ? calculateCenteredBarcodeX(serial1, moduleWidth)
    : (config ? Number(config.barcodePositionX) : DEFAULT_LAYOUT.LEFT_MARGIN);
  
  const text1Y = barcode1Y + barcodeHeight + effectiveTextGap;
  
  // Center text when centerContents is true
  const text1X = centerContents
    ? calculateCenteredTextX(serial1, textSize)
    : (config ? Number(config.textPositionX) : DEFAULT_LAYOUT.LEFT_MARGIN);
  
  const barcode2Y = barcode1Y + effectiveBlockSpacing;
  
  // Center second barcode when centerContents is true
  const barcode2X = centerContents
    ? calculateCenteredBarcodeX(serial2, moduleWidth)
    : (config ? Number(config.barcodePositionX) : DEFAULT_LAYOUT.LEFT_MARGIN);
  
  const text2Y = barcode2Y + barcodeHeight + effectiveTextGap;
  
  // Center second text when centerContents is true
  const text2X = centerContents
    ? calculateCenteredTextX(serial2, textSize)
    : (config ? Number(config.textPositionX) : DEFAULT_LAYOUT.LEFT_MARGIN);
  
  return {
    labelWidth: LABEL_DOTS.WIDTH,
    labelHeight: LABEL_DOTS.HEIGHT,
    titleX,
    titleY,
    barcode1X,
    barcode1Y,
    text1X,
    text1Y,
    barcode2X,
    barcode2Y,
    text2X,
    text2Y,
    barcodeHeight,
    moduleWidth,
    textSize,
    effectiveTextGap,
    effectiveBlockSpacing,
  };
}

/**
 * Convert dots to mm for UI display
 */
export function dotsToMm(dots: number): number {
  return Math.round(dots / DOTS_PER_MM * 10) / 10;
}

/**
 * Convert mm to dots for storage
 */
export function mmToDots(mm: number): number {
  return Math.round(mm * DOTS_PER_MM);
}
