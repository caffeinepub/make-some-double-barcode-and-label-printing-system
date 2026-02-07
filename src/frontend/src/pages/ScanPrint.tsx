import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Printer, AlertCircle, AlertTriangle } from 'lucide-react';
import { usePrintLabel, usePrinters, useAddErrorLog, useGetDualBandCount, useGetTriBandCount, useGetNewDualBandCount, useIncrementLabelCounter, useValidateBarcode, useGetTitleByPrefix, useLabelConfigs, useInitializeDefaultTitles, useGetTitleMappings, useGetValidPrefixes } from '../hooks/useQueries';
import { toast } from 'sonner';
import { useUsbPrinter } from '../contexts/UsbPrinterContext';
import { usePrintProtocol } from '../contexts/PrintProtocolContext';
import { generateDualSerialCpcl } from '../utils/cpclTemplates';
import { ScannerOnlyInput, normalizeScannedValue } from '../utils/scannerOnlyInput';
import { isStoppedCanisterError, getOperatorErrorSummary } from '../utils/icErrors';

type ValidationState = 'neutral' | 'valid' | 'invalid';
type ActiveField = 'first' | 'second' | null;

// State machine for two-scan workflow
type ScanState = 
  | { stage: 'idle' }
  | { stage: 'first-validating'; serial: string }
  | { stage: 'first-valid'; serial: string }
  | { stage: 'second-validating'; firstSerial: string; secondSerial: string }
  | { stage: 'both-valid'; firstSerial: string; secondSerial: string }
  | { stage: 'printing'; firstSerial: string; secondSerial: string };

export function ScanPrint() {
  const [firstSerial, setFirstSerial] = useState('');
  const [secondSerial, setSecondSerial] = useState('');
  const [firstSerialState, setFirstSerialState] = useState<ValidationState>('neutral');
  const [secondSerialState, setSecondSerialState] = useState<ValidationState>('neutral');
  const [batchMode, setBatchMode] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [blockingError, setBlockingError] = useState<string>('');
  const [activeField, setActiveField] = useState<ActiveField>('first');

  const firstInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const firstScannerRef = useRef<ScannerOnlyInput | null>(null);
  const secondScannerRef = useRef<ScannerOnlyInput | null>(null);
  
  // State machine ref
  const scanStateRef = useRef<ScanState>({ stage: 'idle' });
  const scannedSerialsRef = useRef<string[]>([]);

  const { data: printers = [] } = usePrinters();
  const { data: dualBandCount = BigInt(0) } = useGetDualBandCount();
  const { data: triBandCount = BigInt(0) } = useGetTriBandCount();
  const { data: newDualBandCount = BigInt(0) } = useGetNewDualBandCount();
  const { data: labelConfigs = [] } = useLabelConfigs();
  const { data: titleMappings = [] } = useGetTitleMappings();
  const { data: prefixes = [] } = useGetValidPrefixes();
  const printMutation = usePrintLabel();
  const addErrorMutation = useAddErrorLog();
  const incrementCounterMutation = useIncrementLabelCounter();
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

  // Strict local prefix validation
  const hasValidPrefix = (serial: string): boolean => {
    if (prefixes.length === 0) {
      // No prefixes configured - cannot validate
      return false;
    }
    
    for (const prefix of prefixes) {
      const trimmedPrefix = prefix.trim();
      if (trimmedPrefix.length > 0 && serial.startsWith(trimmedPrefix)) {
        return true;
      }
    }
    return false;
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

    // Strict prefix validation - local check first
    if (prefixes.length > 0 && !hasValidPrefix(normalized)) {
      return { valid: false, error: 'Invalid barcode prefix - serial does not match configured prefixes' };
    }

    // Validate against backend
    try {
      const isValid = await validateBarcodeMutation.mutateAsync(normalized);
      if (!isValid) {
        return { valid: false, error: 'Invalid barcode prefix - validation failed' };
      }
    } catch (error: any) {
      // Backend validation failed - this is an error condition
      const errorMsg = error?.message || 'Validation could not be performed';
      console.error('Backend validation error:', error);
      
      // Log error to backend (best-effort)
      try {
        await addErrorMutation.mutateAsync({ 
          errorMessage: `Prefix validation error: ${errorMsg}`, 
          printer: null 
        });
      } catch (logError) {
        console.warn('Failed to log validation error:', logError);
      }
      
      return { valid: false, error: 'Validation could not be performed - please check prefix configuration' };
    }

    return { valid: true };
  };

  const handleFirstSerialSubmit = async (serial?: string) => {
    const serialToValidate = serial || firstSerial;
    const normalized = normalizeScannedValue(serialToValidate);
    
    // Update state machine
    scanStateRef.current = { stage: 'first-validating', serial: normalized };
    
    const validation = await validateSerial(normalized);
    
    if (!validation.valid) {
      setFirstSerialState('invalid');
      playSound('error');
      toast.error('Invalid Barcode', { description: validation.error });
      
      // Best-effort error logging
      try {
        await addErrorMutation.mutateAsync({ errorMessage: validation.error || 'Invalid barcode', printer: null });
      } catch (logError) {
        console.warn('Failed to log error:', logError);
      }
      
      setBlockingError(validation.error || 'Invalid barcode');
      scanStateRef.current = { stage: 'idle' };
      return;
    }

    setFirstSerial(normalized);
    setFirstSerialState('valid');
    playSound('success');
    setScannedSerials((prev) => [...prev, normalized]);
    setBlockingError('');
    toast.success('First serial scanned', { description: normalized });
    
    // Update state machine
    scanStateRef.current = { stage: 'first-valid', serial: normalized };
    
    // Switch active field to second
    setActiveField('second');
  };

  const handleSecondSerialSubmit = async (serial?: string) => {
    const serialToValidate = serial || secondSerial;
    const normalized = normalizeScannedValue(serialToValidate);
    
    // Get first serial from state machine
    const currentState = scanStateRef.current;
    if (currentState.stage !== 'first-valid') {
      toast.error('Please scan first serial first');
      return;
    }
    
    const firstSerialValue = currentState.serial;
    
    // Update state machine
    scanStateRef.current = { 
      stage: 'second-validating', 
      firstSerial: firstSerialValue, 
      secondSerial: normalized 
    };
    
    const validation = await validateSerial(normalized);
    
    if (!validation.valid) {
      setSecondSerialState('invalid');
      playSound('error');
      toast.error('Invalid Barcode', { description: validation.error });
      
      // Best-effort error logging
      try {
        await addErrorMutation.mutateAsync({ errorMessage: validation.error || 'Invalid barcode', printer: null });
      } catch (logError) {
        console.warn('Failed to log error:', logError);
      }
      
      setBlockingError(validation.error || 'Invalid barcode');
      // Reset to first-valid state
      scanStateRef.current = { stage: 'first-valid', serial: firstSerialValue };
      return;
    }

    setSecondSerial(normalized);
    setSecondSerialState('valid');
    playSound('success');
    setScannedSerials((prev) => [...prev, normalized]);
    setBlockingError('');
    toast.success('Second serial scanned', { description: normalized });
    
    // Update state machine - both valid
    scanStateRef.current = { 
      stage: 'both-valid', 
      firstSerial: firstSerialValue, 
      secondSerial: normalized 
    };
    
    // Attempt auto-print
    await maybeAutoPrint(firstSerialValue, normalized);
  };

  const maybeAutoPrint = async (firstSerialValue: string, secondSerialValue: string) => {
    const currentState = scanStateRef.current;
    
    // Guard: only auto-print if both serials are valid
    if (currentState.stage !== 'both-valid') {
      return;
    }
    
    // Guard: only auto-print with CPCL protocol
    if (protocol !== 'CPCL') {
      toast.info('Auto-print disabled', { description: 'Auto-print only works with CPCL protocol' });
      return;
    }
    
    // Guard: only auto-print if USB printer is connected
    if (!usbPrinter.isConnected) {
      toast.error('Cannot auto-print', { description: 'Printer not connected. Please connect a printer in the Devices tab.' });
      return;
    }
    
    // Check if already printing (idempotency)
    if (currentState.stage === 'both-valid') {
      // Mark as printing to prevent duplicate calls
      scanStateRef.current = { 
        stage: 'printing', 
        firstSerial: firstSerialValue, 
        secondSerial: secondSerialValue 
      };
      
      await executePrint(firstSerialValue, secondSerialValue);
    }
  };

  const executePrint = async (firstSerialValue: string, secondSerialValue: string) => {
    try {
      // Get title for first serial
      const prefix = firstSerialValue.substring(0, 3);
      const titleResult = await getTitleMutation.mutateAsync(prefix);
      const title = titleResult || 'Dual Band';

      // Get saved config
      const config = labelConfigs.find(() => true) || null;

      // Generate CPCL
      const cpclCommand = generateDualSerialCpcl(firstSerialValue, secondSerialValue, title, { config });

      // Send to printer
      await usbPrinter.sendCpcl(cpclCommand);
      playSound('print');
      toast.success('Label printed successfully!');

      // Increment counter based on prefix
      try {
        await incrementCounterMutation.mutateAsync(prefix);
      } catch (counterError) {
        console.warn('Failed to increment counter:', counterError);
      }

      // Log print record
      try {
        await printMutation.mutateAsync({
          serialNumber: `${firstSerialValue}, ${secondSerialValue}`,
          labelType: title,
          printer: usbPrinter.deviceInfo?.productName || 'USB Printer',
        });
      } catch (logError) {
        console.warn('Failed to log print record:', logError);
      }

      // Reset for next scan
      setFirstSerial('');
      setSecondSerial('');
      setFirstSerialState('neutral');
      setSecondSerialState('neutral');
      setActiveField('first');
      scanStateRef.current = { stage: 'idle' };
    } catch (error: any) {
      console.error('Print error:', error);
      playSound('error');
      
      const errorMessage = error?.message || 'Unknown print error';
      toast.error('Print failed', { description: errorMessage });

      // Best-effort error logging
      try {
        await addErrorMutation.mutateAsync({
          errorMessage: `Print failed: ${errorMessage}`,
          printer: usbPrinter.deviceInfo?.productName || null,
        });
      } catch (logError) {
        console.warn('Failed to log error:', logError);
      }
      
      // Reset state machine to both-valid so user can retry
      scanStateRef.current = { 
        stage: 'both-valid', 
        firstSerial: firstSerialValue, 
        secondSerial: secondSerialValue 
      };
    }
  };

  const handlePrint = async () => {
    // Manual print button - use current state values
    if (!firstSerial || !secondSerial) {
      toast.error('Both serial numbers are required');
      return;
    }

    if (!usbPrinter.isConnected) {
      toast.error('Printer not connected', { description: 'Please connect a printer in the Devices tab' });
      return;
    }

    await executePrint(firstSerial, secondSerial);
  };

  const handleClear = () => {
    setFirstSerial('');
    setSecondSerial('');
    setFirstSerialState('neutral');
    setSecondSerialState('neutral');
    setBlockingError('');
    setActiveField('first');
    scanStateRef.current = { stage: 'idle' };
    toast.info('Cleared all fields');
  };

  const totalScanned = scannedSerials.length;

  return (
    <div className="space-y-6">
      {/* Header with counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader className="pb-3">
            <CardDescription className="text-zinc-400">Printer Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${printerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-2xl font-bold text-white">
                {printerConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader className="pb-3">
            <CardDescription className="text-zinc-400">Dual Band Labels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-blue-500" />
              <span className="text-5xl font-bold text-white">{Number(dualBandCount)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader className="pb-3">
            <CardDescription className="text-zinc-400">Tri Band Labels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-purple-500" />
              <span className="text-5xl font-bold text-white">{Number(triBandCount)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader className="pb-3">
            <CardDescription className="text-zinc-400">New Dual Band Labels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-green-500" />
              <span className="text-5xl font-bold text-white">{Number(newDualBandCount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocking error banner */}
      {blockingError && (
        <Card className="bg-red-950 border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-red-200 font-semibold">Scan Error</p>
                <p className="text-red-300 text-sm">{blockingError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prefix configuration warning */}
      {prefixes.length === 0 && (
        <Card className="bg-yellow-950 border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="text-yellow-200 font-semibold">Configuration Required</p>
                <p className="text-yellow-300 text-sm">No valid prefixes configured. Please configure prefixes in Settings to enable scanning.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`bg-[#0f0f0f] border-2 transition-colors ${
          activeField === 'first' ? 'border-blue-500' : 'border-zinc-800'
        }`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              First Serial Number
              {activeField === 'first' && (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500">
                  Active
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Scan or enter the first barcode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first-serial" className="text-white">Serial Number</Label>
              <Input
                ref={firstInputRef}
                id="first-serial"
                value={firstSerial}
                onChange={(e) => setFirstSerial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFirstSerialSubmit();
                  }
                }}
                placeholder="Scan first barcode..."
                className={`bg-zinc-900 border-zinc-700 text-white text-lg h-14 ${
                  firstSerialState === 'valid' ? 'border-green-500' :
                  firstSerialState === 'invalid' ? 'border-red-500' : ''
                }`}
                disabled={firstSerialState === 'valid'}
              />
            </div>
            {firstSerialState === 'valid' && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm">Valid barcode scanned</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`bg-[#0f0f0f] border-2 transition-colors ${
          activeField === 'second' ? 'border-blue-500' : 'border-zinc-800'
        }`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Second Serial Number
              {activeField === 'second' && (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500">
                  Active
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Scan or enter the second barcode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="second-serial" className="text-white">Serial Number</Label>
              <Input
                ref={secondInputRef}
                id="second-serial"
                value={secondSerial}
                onChange={(e) => setSecondSerial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSecondSerialSubmit();
                  }
                }}
                placeholder="Scan second barcode..."
                className={`bg-zinc-900 border-zinc-700 text-white text-lg h-14 ${
                  secondSerialState === 'valid' ? 'border-green-500' :
                  secondSerialState === 'invalid' ? 'border-red-500' : ''
                }`}
                disabled={secondSerialState === 'valid' || firstSerialState !== 'valid'}
              />
            </div>
            {secondSerialState === 'valid' && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm">Valid barcode scanned</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handlePrint}
          disabled={firstSerialState !== 'valid' || secondSerialState !== 'valid' || !printerConnected}
          className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700"
        >
          <Printer className="mr-2 h-5 w-5" />
          Print Label
        </Button>
        <Button
          onClick={handleClear}
          variant="outline"
          className="h-14 px-8 text-lg border-zinc-700 text-white hover:bg-zinc-800"
        >
          Clear
        </Button>
      </div>

      {/* Statistics */}
      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Session Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-zinc-400 text-sm">Total Scanned</p>
              <p className="text-3xl font-bold text-white">{totalScanned}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Valid Scans</p>
              <p className="text-3xl font-bold text-green-400">{totalScanned}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Protocol</p>
              <p className="text-2xl font-bold text-white">{protocol}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Batch Mode</p>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={batchMode}
                  onCheckedChange={setBatchMode}
                  disabled
                />
                <span className="text-white">{batchMode ? 'On' : 'Off'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
