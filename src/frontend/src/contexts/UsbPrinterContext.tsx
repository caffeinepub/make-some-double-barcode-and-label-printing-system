import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface UsbPrinterState {
  device: USBDevice | null;
  isConnected: boolean;
  deviceInfo: {
    vendorId?: number;
    productId?: number;
    productName?: string;
    manufacturerName?: string;
  } | null;
  lastError: string | null;
}

export interface UsbPrinterContextValue extends UsbPrinterState {
  isSupported: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCpcl: (cpclCommand: string) => Promise<void>;
  clearError: () => void;
}

const UsbPrinterContext = createContext<UsbPrinterContextValue | null>(null);

export function UsbPrinterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UsbPrinterState>({
    device: null,
    isConnected: false,
    deviceInfo: null,
    lastError: null,
  });

  const endpointRef = useRef<USBEndpoint | null>(null);
  const interfaceNumberRef = useRef<number | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'usb' in navigator && !!navigator.usb;

  // Handle device disconnect events
  useEffect(() => {
    if (!isSupported || !navigator.usb) return;

    const handleDisconnect = (event: USBConnectionEvent) => {
      if (state.device && event.device === state.device) {
        setState({
          device: null,
          isConnected: false,
          deviceInfo: null,
          lastError: 'Printer disconnected',
        });
        endpointRef.current = null;
        interfaceNumberRef.current = null;
      }
    };

    navigator.usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      if (navigator.usb) {
        navigator.usb.removeEventListener('disconnect', handleDisconnect);
      }
    };
  }, [isSupported, state.device]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastError: null }));
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !navigator.usb) {
      setState((prev) => ({
        ...prev,
        lastError: 'WebUSB is not supported in this browser. Please use Chrome or Edge on Android.',
      }));
      return false;
    }

    try {
      // Request device from user
      const device = await navigator.usb.requestDevice({
        filters: [
          // Common printer vendor IDs - add more as needed
          { classCode: 0x07 }, // Printer class
        ],
      });

      // Open the device
      await device.open();

      // Select configuration (usually the first one)
      if (device.configuration === null || device.configuration === undefined) {
        await device.selectConfiguration(1);
      }

      // Find the printer interface (class 0x07 = Printer)
      let printerInterface: USBInterface | null = null;
      let interfaceNumber = 0;

      for (const iface of device.configuration?.interfaces || []) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 0x07) {
            printerInterface = iface;
            interfaceNumber = iface.interfaceNumber;
            break;
          }
        }
        if (printerInterface) break;
      }

      // If no printer interface found, try the first interface
      if (!printerInterface && device.configuration?.interfaces.length) {
        printerInterface = device.configuration.interfaces[0];
        interfaceNumber = printerInterface.interfaceNumber;
      }

      if (!printerInterface) {
        await device.close();
        setState((prev) => ({
          ...prev,
          lastError: 'No suitable printer interface found on this device.',
        }));
        return false;
      }

      // Claim the interface
      await device.claimInterface(interfaceNumber);

      // Find an OUT endpoint for writing
      let outEndpoint: USBEndpoint | null = null;
      for (const alt of printerInterface.alternates) {
        for (const endpoint of alt.endpoints) {
          if (endpoint.direction === 'out') {
            outEndpoint = endpoint;
            break;
          }
        }
        if (outEndpoint) break;
      }

      if (!outEndpoint) {
        await device.close();
        setState((prev) => ({
          ...prev,
          lastError: 'No OUT endpoint found for writing to printer.',
        }));
        return false;
      }

      endpointRef.current = outEndpoint;
      interfaceNumberRef.current = interfaceNumber;

      setState({
        device,
        isConnected: true,
        deviceInfo: {
          vendorId: device.vendorId,
          productId: device.productId,
          productName: device.productName,
          manufacturerName: device.manufacturerName,
        },
        lastError: null,
      });

      return true;
    } catch (error: any) {
      let errorMessage = 'Failed to connect to USB printer';

      if (error.name === 'NotFoundError') {
        errorMessage = 'No device selected';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'USB access denied. Please grant permission to access USB devices.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'This device is not supported or WebUSB is not available.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState((prev) => ({
        ...prev,
        device: null,
        isConnected: false,
        deviceInfo: null,
        lastError: errorMessage,
      }));

      return false;
    }
  }, [isSupported]);

  const disconnect = useCallback(async () => {
    if (!state.device) return;

    try {
      if (interfaceNumberRef.current !== null) {
        await state.device.releaseInterface(interfaceNumberRef.current);
      }
      await state.device.close();
    } catch (error) {
      console.error('Error disconnecting USB device:', error);
    }

    setState({
      device: null,
      isConnected: false,
      deviceInfo: null,
      lastError: null,
    });
    endpointRef.current = null;
    interfaceNumberRef.current = null;
  }, [state.device]);

  const sendCpcl = useCallback(
    async (cpclCommand: string) => {
      if (!state.device || !state.isConnected) {
        throw new Error('No USB printer connected');
      }

      if (!endpointRef.current) {
        throw new Error('No endpoint available for writing');
      }

      try {
        // Convert CPCL string to bytes
        const encoder = new TextEncoder();
        const data = encoder.encode(cpclCommand);

        // Send data to printer
        const result = await state.device.transferOut(endpointRef.current.endpointNumber, data);

        if (result.status !== 'ok') {
          throw new Error(`Transfer failed with status: ${result.status}`);
        }
      } catch (error: any) {
        // Check if device was disconnected
        if (error.name === 'NetworkError' || error.message?.includes('disconnected')) {
          setState((prev) => ({
            ...prev,
            device: null,
            isConnected: false,
            deviceInfo: null,
            lastError: 'Printer disconnected during write',
          }));
          endpointRef.current = null;
          interfaceNumberRef.current = null;
        }

        throw new Error(error.message || 'Failed to send data to printer');
      }
    },
    [state.device, state.isConnected]
  );

  const value: UsbPrinterContextValue = {
    ...state,
    isSupported,
    connect,
    disconnect,
    sendCpcl,
    clearError,
  };

  return <UsbPrinterContext.Provider value={value}>{children}</UsbPrinterContext.Provider>;
}

export function useUsbPrinter() {
  const context = useContext(UsbPrinterContext);
  if (!context) {
    throw new Error('useUsbPrinter must be used within UsbPrinterProvider');
  }
  return context;
}
