import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Printer, AlertCircle, AlertTriangle } from 'lucide-react';
import { usePrintLabel, usePrinters, useAddErrorLog, useGetDualLabelCount, useIncrementDualLabelCount, useValidateBarcode, useGetTitleByPrefix, useLabelConfigs, useInitializeDefaultTitles, useGetTitleMappings } from '../hooks/useQueries';
import { toast } from 'sonner';
import { useUsbPrinter } from '../contexts/UsbPrinterContext';
import { usePrintProtocol } from '../contexts/PrintProtocolContext';
import { generateDualSerialCpcl } from '../utils/cpclTemplates';
import { ScannerOnlyInput, normalizeScannedValue } from '../utils/scannerOnlyInput';
import { isStoppedCanisterError, getOperatorErrorSummary } from '../utils/icErrors';

type ValidationState = 'neutral' | 'valid' | 'invalid';
type ActiveField = 'first' | 'second' | null;

export function ScanPrint() {
  const [firstSerial, setFirstSerial] = useState('');
  const [secondSerial, setSecondSerial] = useState('');
  const [firstSerialState, setFirstSerialState] = useState<ValidationState>('neutral');
  const [secondSerialState, setSecondSerialState] = useState<ValidationState>('neutral');
  const [dualLabels, setDualLabels] = useState(0);
  const [triLabels, setTriLabels] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [blockingError, setBlockingError] = useState<string>('');
  const [activeField, setActiveField] = useState<ActiveField>('first');

  const firstInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const firstScannerRef = useRef<ScannerOnlyInput | null>(null);
  const secondScannerRef = useRef<ScannerOnlyInput | null>(null);
  
  // Refs to avoid stale closures
  const firstSerialRef = useRef<string>('');
  const autoPrintInProgressRef = useRef<boolean>(false);
  const scannedSerialsRef = useRef<string[]>([]);
  const printersRef = useRef<any[]>([]);

  const { data: printers = [] } = usePrinters();
  const { data: dualLabelCount = BigInt(0) } = useGetDualLabelCount();
  const { data: labelConfigs = [] } = useLabelConfigs();
  const { data: titleMappings = [] } = useGetTitleMappings();
  const printMutation = usePrintLabel();
  const addErrorMutation = useAddErrorLog();
  const incrementDualLabelMutation = useIncrementDualLabelCount();
  const validateBarcodeMutation = useValidateBarcode();
  const getTitleMutation = useGetTitleByPrefix();
  const initTitlesMutation = useInitializeDefaultTitles();

  const usbPrinter = useUsbPrinter();
  const { protocol } = usePrintProtocol();

  const successAudio = useRef<HTMLAudioElement | null>(null);
  const errorAudio = useRef<HTMLAudioElement | null>(null);
  const printAudio = useRef<HTMLAudioElement | null>(null);

  // Initialize default title mappings if empty
  useEffect(() => {
    if (titleMappings.length === 0) {
      initTitlesMutation.mutate();
    }
  }, [titleMappings.length]);

  // Keep refs in sync with state
  useEffect(() => {
    scannedSerialsRef.current = scannedSerials;
  }, [scannedSerials]);

  useEffect(() => {
    printersRef.current = printers;
  }, [printers]);

  // Check printer connection status (for display only)
  const printerConnected = usbPrinter.isConnected || printers.some((p) => p.status === 'connected');

  useEffect(() => {
    successAudio.current = new Audio();
    errorAudio.current = new Audio();
    printAudio.current = new Audio();
  }, []);

  // Global keydown listener for scanner input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're in the Scan & Print view and not in another input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Route to active scanner
      if (activeField === 'first' && firstScannerRef.current) {
        firstScannerRef.current.handleKeyDown(e);
      } else if (activeField === 'second' && secondScannerRef.current) {
        secondScannerRef.current.handleKeyDown(e);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeField]);

  // Initialize scanner-only input handlers
  useEffect(() => {
    firstScannerRef.current = new ScannerOnlyInput((value) => {
      const normalized = normalizeScannedValue(value);
      setFirstSerial(normalized);
      firstSerialRef.current = normalized;
      handleFirstSerialSubmit(normalized);
    });

    secondScannerRef.current = new ScannerOnlyInput((value) => {
      const normalized = normalizeScannedValue(value);
      setSecondSerial(normalized);
      handleSecondSerialSubmit(normalized);
    });

    return () => {
      firstScannerRef.current = null;
      secondScannerRef.current = null;
    };
  }, []);

  const playSound = (type: 'success' | 'error' | 'print') => {
    const audio = type === 'success' ? successAudio.current : type === 'error' ? errorAudio.current : printAudio.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const validateSerial = async (serial: string): Promise<{ valid: boolean; error?: string }> => {
    const normalized = normalizeScannedValue(serial);
    
    if (!normalized.trim()) {
      return { valid: false, error: 'Serial number cannot be empty' };
    }

    // Check for duplicates using ref
    if (scannedSerialsRef.current.includes(normalized)) {
      return { valid: false, error: 'Duplicate serial number detected' };
    }

    // Validate against backend prefixes
    try {
      const isValid = await validateBarcodeMutation.mutateAsync(normalized);
      if (!isValid) {
        return { valid: false, error: 'Invalid barcode prefix' };
      }
    } catch (error) {
      // If validation fails (e.g., no prefixes configured), allow the scan
      console.warn('Prefix validation skipped:', error);
    }

    return { valid: true };
  };

  const handleFirstSerialSubmit = async (serial?: string) => {
    const serialToValidate = serial || firstSerial;
    const normalized = normalizeScannedValue(serialToValidate);
    
    const validation = await validateSerial(normalized);
    
    if (!validation.valid) {
      setFirstSerialState('invalid');
      playSound('error');
      toast.error('Invalid Barcode', { description: validation.error });
      
      // Best-effort error logging (don't block on failure)
      try {
        await addErrorMutation.mutateAsync({ errorMessage: validation.error || 'Invalid barcode', printer: null });
      } catch (logError) {
        console.warn('Failed to log error:', logError);
      }
      
      setBlockingError(validation.error || 'Invalid barcode');
      return;
    }

    setFirstSerial(normalized);
    firstSerialRef.current = normalized;
    setFirstSerialState('valid');
    playSound('success');
    setScannedSerials((prev) => [...prev, normalized]);
    setBlockingError('');
    toast.success('First serial scanned', { description: normalized });
    
    // Switch active field to second (no focus, just visual indicator)
    setActiveField('second');
  };

  const handleSecondSerialSubmit = async (serial?: string) => {
    // Prevent multiple auto-print triggers
    if (autoPrintInProgressRef.current) {
      return;
    }

    const serialToValidate = serial || secondSerial;
    const normalized = normalizeScannedValue(serialToValidate);
    
    const validation = await validateSerial(normalized);
    
    if (!validation.valid) {
      setSecondSerialState('invalid');
      playSound('error');
      toast.error('Invalid Barcode', { description: validation.error });
      
      // Best-effort error logging (don't block on failure)
      try {
        await addErrorMutation.mutateAsync({ errorMessage: validation.error || 'Invalid barcode', printer: null });
      } catch (logError) {
        console.warn('Failed to log error:', logError);
      }
      
      setBlockingError(validation.error || 'Invalid barcode');
      return;
    }

    // Check printer connection at scan time using latest state
    const isUsbConnected = usbPrinter.isConnected;
    const isBackendConnected = printersRef.current.some((p) => p.status === 'connected');
    const isPrinterConnected = isUsbConnected || isBackendConnected;

    if (!isPrinterConnected) {
      setSecondSerialState('invalid');
      playSound('error');
      const errorMsg = 'Please connect a printer in the Devices tab';
      toast.error('No printer connected', { description: errorMsg });
      setBlockingError(errorMsg);
      return;
    }

    setSecondSerial(normalized);
    setSecondSerialState('valid');
    playSound('success');
    setScannedSerials((prev) => [...prev, normalized]);
    setBlockingError('');
    toast.success('Second serial scanned', { description: normalized });

    // Auto-print after second scan using the ref value for first serial
    autoPrintInProgressRef.current = true;
    try {
      await performPrint(firstSerialRef.current, normalized);
    } finally {
      autoPrintInProgressRef.current = false;
    }
  };

  const performPrint = async (serial1: string, serial2: string) => {
    // Normalize both serials
    const normalizedSerial1 = normalizeScannedValue(serial1);
    const normalizedSerial2 = normalizeScannedValue(serial2);

    // Extract prefix (first 3 characters) for title lookup
    const prefix = normalizedSerial1.substring(0, 3);

    // Get title for the label
    let title = 'Dual Band';
    try {
      const fetchedTitle = await getTitleMutation.mutateAsync(prefix);
      if (fetchedTitle) {
        title = fetchedTitle;
      }
    } catch (error) {
      console.warn('Failed to fetch title, using default:', error);
    }

    // Load persisted label config (if available)
    const defaultConfig = labelConfigs.find(c => true); // Get first config (default)
    const DOTS_TO_MM = 203 / 25.4; // ~8 dots per mm
    const mmToDots = (mm: number) => Math.round(mm * DOTS_TO_MM);

    // Step 1: USB Print (if applicable)
    let usbPrintSuccess = false;
    if (protocol === 'CPCL' && usbPrinter.isConnected) {
      try {
        const cpclCommand = generateDualSerialCpcl(normalizedSerial1, normalizedSerial2, title, {
          width: defaultConfig ? Number(defaultConfig.width) : undefined,
          height: defaultConfig ? Number(defaultConfig.height) : undefined,
          barcodeHeight: defaultConfig ? Number(defaultConfig.barcodeHeight) : undefined,
          barcodeWidthScale: defaultConfig ? Number(defaultConfig.barcodeWidthScale) : undefined,
          centerContents: defaultConfig ? defaultConfig.centerContents : true,
          textGap: defaultConfig ? Number(defaultConfig.textPositionY) - Number(defaultConfig.barcodePositionY) - Number(defaultConfig.barcodeHeight) : undefined,
          blockSpacing: defaultConfig ? Number(defaultConfig.horizontalSpacing) : undefined,
        });
        await usbPrinter.sendCpcl(cpclCommand);
        usbPrintSuccess = true;
      } catch (usbError) {
        // USB print failed - this is a blocking error
        const errorMsg = usbError instanceof Error ? usbError.message : 'USB print failed';
        playSound('error');
        toast.error('USB print failed', { description: errorMsg });
        
        // Best-effort error logging
        try {
          await addErrorMutation.mutateAsync({
            errorMessage: `USB Print Error: ${errorMsg}`,
            printer: 'USB Printer',
          });
        } catch (logError) {
          console.warn('Failed to log USB error:', logError);
        }
        
        setBlockingError(`USB print failed: ${errorMsg}`);
        return; // Don't proceed with backend record if USB failed
      }
    } else {
      // No USB print needed, consider it successful
      usbPrintSuccess = true;
    }

    // Step 2: Backend Recording (non-blocking if USB succeeded)
    if (usbPrintSuccess) {
      try {
        const connectedPrinter = printersRef.current.find((p) => p.status === 'connected');
        const printerName = usbPrinter.isConnected ? 'USB Printer' : (connectedPrinter?.name || 'Unknown');
        
        await printMutation.mutateAsync({
          serialNumber: `${normalizedSerial1},${normalizedSerial2}`,
          labelType: title,
          printer: printerName,
        });
        
        await incrementDualLabelMutation.mutateAsync();
        
        // Full success
        playSound('print');
        toast.success('Label printed successfully!');
        setDualLabels((prev) => prev + 1);
        setBlockingError('');
      } catch (backendError) {
        // Backend recording failed, but USB print succeeded
        const operatorMessage = getOperatorErrorSummary(backendError);
        
        // Show warning (not error) since print succeeded
        playSound('print'); // Still play success sound since label printed
        toast.warning('Label printed', { 
          description: operatorMessage,
          duration: 5000,
        });
        
        // Best-effort error logging
        try {
          await addErrorMutation.mutateAsync({
            errorMessage: `Backend recording failed: ${operatorMessage}`,
            printer: usbPrinter.isConnected ? 'USB Printer' : printersRef.current.find((p) => p.status === 'connected')?.name,
          });
        } catch (logError) {
          console.warn('Failed to log backend error:', logError);
        }
        
        // Don't set blocking error - allow next scan
        console.warn('Backend recording failed but print succeeded:', backendError);
      }
      
      // Reset for next scan (always reset after USB success)
      setFirstSerial('');
      setSecondSerial('');
      firstSerialRef.current = '';
      setFirstSerialState('neutral');
      setSecondSerialState('neutral');
      setActiveField('first');
      firstScannerRef.current?.reset();
      secondScannerRef.current?.reset();
    }
  };

  const handleClearCurrent = () => {
    setFirstSerial('');
    setSecondSerial('');
    firstSerialRef.current = '';
    setFirstSerialState('neutral');
    setSecondSerialState('neutral');
    setBlockingError('');
    setActiveField('first');
    firstScannerRef.current?.reset();
    secondScannerRef.current?.reset();
    toast.info('Current serials cleared');
  };

  const handleTestScan = () => {
    const testSerial1 = `72V${Math.floor(Math.random() * 1000000)}`;
    const testSerial2 = `72V${Math.floor(Math.random() * 1000000)}`;
    setFirstSerial(testSerial1);
    setSecondSerial(testSerial2);
    firstSerialRef.current = testSerial1;
    setFirstSerialState('neutral');
    setSecondSerialState('neutral');
    setBlockingError('');
    toast.info('Test serials generated');
  };

  const handleResetCounters = () => {
    setDualLabels(0);
    setTriLabels(0);
    setScannedSerials([]);
    toast.info('Counters reset');
  };

  const handlePrintLabel = async () => {
    if (!firstSerial || !secondSerial) {
      toast.error('Please scan both serial numbers');
      return;
    }

    // Check printer connection at button click time
    const isUsbConnected = usbPrinter.isConnected;
    const isBackendConnected = printersRef.current.some((p) => p.status === 'connected');
    const isPrinterConnected = isUsbConnected || isBackendConnected;

    if (!isPrinterConnected) {
      toast.error('No printer connected');
      return;
    }

    await performPrint(firstSerial, secondSerial);
  };

  const getInputClassName = (state: ValidationState, isActive: boolean) => {
    const baseClass = "bg-[#1a1a1a] text-white placeholder:text-zinc-500 h-14 text-lg transition-all duration-300";
    
    // Active field gets a subtle highlight
    const activeClass = isActive ? "ring-2 ring-blue-500/30" : "";
    
    switch (state) {
      case 'valid':
        return `${baseClass} ${activeClass} border-2 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]`;
      case 'invalid':
        return `${baseClass} ${activeClass} border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]`;
      default:
        return `${baseClass} ${activeClass} border border-zinc-700`;
    }
  };

  // Scanner-only input handlers (for when inputs are focused)
  const handleFirstInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (firstScannerRef.current) {
      firstScannerRef.current.handleKeyDown(e.nativeEvent);
    }
  };

  const handleSecondInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (secondScannerRef.current) {
      secondScannerRef.current.handleKeyDown(e.nativeEvent);
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  const handleInputDrop = (e: React.DragEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  // Blur inputs immediately if they get focus (prevents keyboard)
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.blur();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${printerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-base text-zinc-400">Printer Status</p>
                  <p className="text-white font-medium text-lg">{printerConnected ? 'Connected' : 'Not Connected'}</p>
                </div>
              </div>
              <Printer className="w-10 h-10 text-zinc-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-zinc-400">Dual Band (55V)</p>
                <p className="text-4xl font-bold text-white">{dualLabels}</p>
              </div>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-base px-4 py-2">
                55V
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-zinc-400">Tri Band (55Y)</p>
                <p className="text-4xl font-bold text-white">{triLabels}</p>
              </div>
              <Badge className="bg-zinc-700 hover:bg-zinc-600 text-white text-base px-4 py-2">
                55Y
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-zinc-400">New Version Dual Band (72V)</p>
                <p className="text-4xl font-bold text-white">{Number(dualLabelCount)}</p>
              </div>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-base px-4 py-2">
                72V
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Scan Serial Numbers</CardTitle>
          <CardDescription className="text-zinc-400 text-base">
            Use barcode scanner only - manual entry is disabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="first-serial" className="text-white text-lg">
              First Serial Number
            </Label>
            <Input
              ref={firstInputRef}
              id="first-serial"
              value={firstSerial}
              onKeyDown={handleFirstInputKeyDown}
              onPaste={handleInputPaste}
              onDrop={handleInputDrop}
              onFocus={handleInputFocus}
              onChange={() => {}} // Controlled but read-only
              placeholder="Scan first barcode..."
              className={getInputClassName(firstSerialState, activeField === 'first')}
              autoComplete="off"
              inputMode="none"
              tabIndex={-1}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="second-serial" className="text-white text-lg">
              Second Serial Number
            </Label>
            <Input
              ref={secondInputRef}
              id="second-serial"
              value={secondSerial}
              onKeyDown={handleSecondInputKeyDown}
              onPaste={handleInputPaste}
              onDrop={handleInputDrop}
              onFocus={handleInputFocus}
              onChange={() => {}} // Controlled but read-only
              placeholder="Scan second barcode..."
              className={getInputClassName(secondSerialState, activeField === 'second')}
              autoComplete="off"
              inputMode="none"
              tabIndex={-1}
            />
          </div>

          {blockingError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-base font-medium">Auto-print blocked</p>
                <p className="text-red-400/80 text-sm mt-1">{blockingError}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-4">
            <Label htmlFor="batch-mode" className="text-white text-lg">
              Batch Mode
            </Label>
            <div className="flex items-center gap-4">
              <span className="text-base text-zinc-400">{batchMode ? 'Enabled' : 'Disabled'}</span>
              <Switch
                id="batch-mode"
                checked={batchMode}
                onCheckedChange={setBatchMode}
                className="data-[state=checked]:bg-blue-600 scale-125"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Button
              onClick={handlePrintLabel}
              disabled={!firstSerial || !secondSerial || !printerConnected || printMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white h-14 text-base active:scale-95 transition-transform"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Label
            </Button>
            <Button
              onClick={handleClearCurrent}
              variant="secondary"
              className="bg-[#1a1a1a] hover:bg-zinc-800 text-white border border-zinc-700 h-14 text-base active:scale-95 transition-transform"
            >
              Clear Current
            </Button>
            <Button
              onClick={handleTestScan}
              variant="secondary"
              className="bg-zinc-700 hover:bg-zinc-600 text-white h-14 text-base active:scale-95 transition-transform"
            >
              Test Scan
            </Button>
            <Button
              onClick={handleResetCounters}
              variant="secondary"
              className="bg-[#1a1a1a] hover:bg-zinc-800 text-white border border-zinc-700 h-14 text-base active:scale-95 transition-transform"
            >
              Reset Counters
            </Button>
          </div>

          {!printerConnected && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-5">
              <p className="text-red-400 text-base font-medium">No printer connected</p>
              <p className="text-red-400/70 text-sm mt-1">
                Please connect a printer in the Devices tab
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
