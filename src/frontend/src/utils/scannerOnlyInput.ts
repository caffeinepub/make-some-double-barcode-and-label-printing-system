/**
 * Scanner-only input utility
 * Distinguishes hardware barcode scanner input from manual typing
 * by analyzing keystroke timing and patterns
 */

export interface ScannerConfig {
  // Maximum time between keystrokes for scanner input (ms)
  maxInterKeyDelay?: number;
  // Minimum characters for a valid scan
  minLength?: number;
  // Characters to strip from scanned input
  stripChars?: string[];
}

const DEFAULT_CONFIG: Required<ScannerConfig> = {
  maxInterKeyDelay: 50, // Scanner typically types < 50ms between keys
  minLength: 3,
  stripChars: ['\r', '\n', '\t'],
};

export class ScannerOnlyInput {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private config: Required<ScannerConfig>;
  private onScanComplete: (value: string) => void;

  constructor(onScanComplete: (value: string) => void, config: ScannerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onScanComplete = onScanComplete;
  }

  /**
   * Process keyboard event - returns true if event should be prevented
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const now = Date.now();
    const timeSinceLastKey = now - this.lastKeyTime;

    // Block paste operations
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      event.preventDefault();
      return true;
    }

    // Handle Enter key
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.buffer.length >= this.config.minLength) {
        const normalized = this.normalizeScannedText(this.buffer);
        this.onScanComplete(normalized);
      }
      this.buffer = '';
      this.lastKeyTime = 0;
      return true;
    }

    // Reset buffer if too much time has passed (manual typing)
    if (timeSinceLastKey > this.config.maxInterKeyDelay && this.buffer.length > 0) {
      this.buffer = '';
    }

    // Add character to buffer if it's a valid character
    if (event.key.length === 1) {
      this.buffer += event.key;
      this.lastKeyTime = now;
      // Only prevent default for character keys and Enter to avoid blocking navigation
      event.preventDefault();
      return true;
    }

    // Don't prevent default for non-character keys (arrows, tab, etc.)
    return false;
  }

  /**
   * Handle paste event - always block
   */
  handlePaste(event: ClipboardEvent): boolean {
    event.preventDefault();
    return true;
  }

  /**
   * Handle drop event - always block
   */
  handleDrop(event: DragEvent): boolean {
    event.preventDefault();
    return true;
  }

  /**
   * Normalize scanned text by removing control characters and whitespace
   */
  private normalizeScannedText(text: string): string {
    let normalized = text;
    
    // Remove configured strip characters
    for (const char of this.config.stripChars) {
      normalized = normalized.split(char).join('');
    }
    
    // Trim whitespace
    normalized = normalized.trim();
    
    return normalized;
  }

  /**
   * Reset the scanner state
   */
  reset(): void {
    this.buffer = '';
    this.lastKeyTime = 0;
  }

  /**
   * Get current buffer (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }
}

/**
 * Normalize a scanned value (utility function)
 */
export function normalizeScannedValue(value: string): string {
  return value
    .replace(/[\r\n\t]/g, '') // Remove control characters
    .trim(); // Remove leading/trailing whitespace
}
