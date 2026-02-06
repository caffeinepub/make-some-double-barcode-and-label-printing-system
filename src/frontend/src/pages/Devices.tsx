import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Printer, Scan, RefreshCw, Usb, CheckCircle2 } from 'lucide-react';
import { usePrinters, useAddPrinter, useUpdatePrinterStatus } from '../hooks/useQueries';
import { toast } from 'sonner';
import { useUsbPrinter } from '../contexts/UsbPrinterContext';
import { usePrintProtocol } from '../contexts/PrintProtocolContext';
import { generateTestCpcl, parseProtocolString } from '../utils/cpclTemplates';

export function Devices() {
  const [protocolString, setProtocolString] = useState('CPCL (PinLeader M4201)');
  const { data: printers = [] } = usePrinters();
  const addPrinterMutation = useAddPrinter();
  const updateStatusMutation = useUpdatePrinterStatus();
  
  const usbPrinter = useUsbPrinter();
  const { setProtocol } = usePrintProtocol();
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // Update protocol context when protocol string changes
  useEffect(() => {
    const protocol = parseProtocolString(protocolString);
    setProtocol(protocol);
  }, [protocolString, setProtocol]);

  const handleConnectUSB = async () => {
    if (!usbPrinter.isSupported) {
      toast.error('USB printing not available', {
        description: 'WebUSB is not supported in this browser. Please use Chrome or Edge on Android.',
      });
      return;
    }

    try {
      const success = await usbPrinter.connect();
      
      if (success) {
        // Update backend printer record
        const printerName = 'USB Printer';
        const existing = printers.find((p) => p.name === printerName);
        
        if (!existing) {
          await addPrinterMutation.mutateAsync({
            name: printerName,
            connectionType: 'USB',
          });
        }
        
        await updateStatusMutation.mutateAsync({
          name: printerName,
          status: 'connected',
        });
        
        toast.success('USB printer connected!', {
          description: usbPrinter.deviceInfo?.productName || 'Device connected successfully',
        });
      } else if (usbPrinter.lastError) {
        toast.error('Failed to connect USB printer', {
          description: usbPrinter.lastError,
        });
      }
    } catch (error) {
      toast.error('Failed to connect USB printer', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDisconnectUSB = async () => {
    try {
      await usbPrinter.disconnect();
      
      // Update backend printer status
      const printerName = 'USB Printer';
      const existing = printers.find((p) => p.name === printerName);
      
      if (existing) {
        await updateStatusMutation.mutateAsync({
          name: printerName,
          status: 'disconnected',
        });
      }
      
      toast.info('USB printer disconnected');
    } catch (error) {
      toast.error('Failed to disconnect USB printer', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleTestPrint = async () => {
    if (!usbPrinter.isConnected) {
      toast.error('No USB printer connected', {
        description: 'Please connect a USB printer first',
      });
      return;
    }

    const protocol = parseProtocolString(protocolString);
    if (protocol !== 'CPCL') {
      toast.error('Test print only available for CPCL', {
        description: 'Please select a CPCL protocol to test print',
      });
      return;
    }

    setIsTestPrinting(true);
    try {
      const cpclCommand = generateTestCpcl();
      await usbPrinter.sendCpcl(cpclCommand);
      
      toast.success('Test print sent successfully!', {
        description: 'Check your printer for output',
      });
    } catch (error) {
      toast.error('Test print failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleConnectBluetooth = async () => {
    toast.info('Bluetooth connection not yet implemented', {
      description: 'This feature will be available in a future update',
    });
  };

  const handleRefresh = () => {
    toast.info('Refreshing devices...');
  };

  const connectedPrinters = printers.filter((p) => p.status === 'connected');

  return (
    <div className="space-y-6">
      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Printer Management</CardTitle>
          <CardDescription className="text-zinc-400 text-base">
            Connect and configure label printers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label htmlFor="protocol" className="text-white text-lg">
              Printer Protocol
            </Label>
            <Select value={protocolString} onValueChange={setProtocolString}>
              <SelectTrigger id="protocol" className="bg-[#1a1a1a] border-zinc-700 text-white h-14 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-zinc-700">
                <SelectItem value="CPCL (PinLeader M4201)" className="text-base">CPCL (PinLeader M4201)</SelectItem>
                <SelectItem value="ZPL" className="text-base">ZPL</SelectItem>
                <SelectItem value="ESC/POS" className="text-base">ESC/POS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* USB Connection Status */}
          {usbPrinter.isConnected && (
            <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Usb className="w-6 h-6 text-green-500" />
                <div className="flex-1">
                  <p className="text-green-400 font-medium text-base">USB Printer Connected</p>
                  {usbPrinter.deviceInfo?.productName && (
                    <p className="text-green-400/70 text-sm">{usbPrinter.deviceInfo.productName}</p>
                  )}
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {!usbPrinter.isConnected ? (
              <Button
                onClick={handleConnectUSB}
                disabled={addPrinterMutation.isPending || updateStatusMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white h-14 text-base active:scale-95 transition-transform"
              >
                <Usb className="w-5 h-5 mr-2" />
                Connect USB Printer
              </Button>
            ) : (
              <Button
                onClick={handleDisconnectUSB}
                disabled={updateStatusMutation.isPending}
                variant="secondary"
                className="bg-zinc-700 hover:bg-zinc-600 text-white h-14 text-base active:scale-95 transition-transform"
              >
                <Usb className="w-5 h-5 mr-2" />
                Disconnect USB
              </Button>
            )}
            <Button
              onClick={handleConnectBluetooth}
              disabled={addPrinterMutation.isPending || updateStatusMutation.isPending}
              variant="secondary"
              className="bg-[#1a1a1a] hover:bg-zinc-800 text-white border border-zinc-700 h-14 text-base active:scale-95 transition-transform"
            >
              Connect Bluetooth
            </Button>
            <Button
              onClick={handleRefresh}
              variant="secondary"
              className="bg-zinc-700 hover:bg-zinc-600 text-white h-14 text-base active:scale-95 transition-transform"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Test Print Button */}
          {usbPrinter.isConnected && parseProtocolString(protocolString) === 'CPCL' && (
            <div className="pt-2">
              <Button
                onClick={handleTestPrint}
                disabled={isTestPrinting}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-base active:scale-95 transition-transform"
              >
                <Printer className="w-5 h-5 mr-2" />
                {isTestPrinting ? 'Sending Test Print...' : 'Test Print (CPCL)'}
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-white text-lg">Connected Printers</Label>
            <div className="bg-[#1a1a1a] border border-zinc-700 rounded-lg p-6 min-h-[140px]">
              {connectedPrinters.length === 0 && !usbPrinter.isConnected ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Printer className="w-14 h-14 text-zinc-600 mb-3" />
                  <p className="text-zinc-400 font-medium text-base">No printers connected</p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Click the buttons above to connect a printer
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usbPrinter.isConnected && (
                    <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg border-2 border-green-500/30">
                      <Usb className="w-7 h-7 text-green-500" />
                      <div className="flex-1">
                        <p className="text-white font-medium text-base">
                          {usbPrinter.deviceInfo?.productName || 'USB Printer'}
                        </p>
                        <p className="text-zinc-400 text-sm">USB (WebUSB)</p>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  )}
                  {connectedPrinters.map((printer) => (
                    <div
                      key={printer.name}
                      className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg"
                    >
                      <Printer className="w-7 h-7 text-blue-500" />
                      <div className="flex-1">
                        <p className="text-white font-medium text-base">{printer.name}</p>
                        <p className="text-zinc-400 text-sm">{printer.connectionType}</p>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Scanner Management</CardTitle>
          <CardDescription className="text-zinc-400 text-base">
            View connected barcode scanners
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-[#1a1a1a] border border-zinc-700 rounded-lg p-6 min-h-[140px]">
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Scan className="w-14 h-14 text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium text-base">No scanners detected</p>
              <p className="text-zinc-500 text-sm mt-1">
                Scanners will appear automatically when connected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
