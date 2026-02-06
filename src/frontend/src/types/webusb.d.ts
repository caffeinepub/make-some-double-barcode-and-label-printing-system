// WebUSB API type declarations
// Based on https://wicg.github.io/webusb/

interface USBDevice {
  readonly usbVersionMajor: number;
  readonly usbVersionMinor: number;
  readonly usbVersionSubminor: number;
  readonly deviceClass: number;
  readonly deviceSubclass: number;
  readonly deviceProtocol: number;
  readonly vendorId: number;
  readonly productId: number;
  readonly deviceVersionMajor: number;
  readonly deviceVersionMinor: number;
  readonly deviceVersionSubminor: number;
  readonly manufacturerName?: string;
  readonly productName?: string;
  readonly serialNumber?: string;
  readonly configuration?: USBConfiguration;
  readonly configurations: USBConfiguration[];
  readonly opened: boolean;

  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
  controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
  clearHalt(direction: USBDirection, endpointNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
  isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
  reset(): Promise<void>;
}

interface USBConfiguration {
  readonly configurationValue: number;
  readonly configurationName?: string;
  readonly interfaces: USBInterface[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternate: USBAlternateInterface;
  readonly alternates: USBAlternateInterface[];
  readonly claimed: boolean;
}

interface USBAlternateInterface {
  readonly alternateSetting: number;
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly interfaceName?: string;
  readonly endpoints: USBEndpoint[];
}

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: USBDirection;
  readonly type: USBEndpointType;
  readonly packetSize: number;
}

type USBDirection = 'in' | 'out';
type USBEndpointType = 'bulk' | 'interrupt' | 'isochronous';
type USBTransferStatus = 'ok' | 'stall' | 'babble';

interface USBInTransferResult {
  readonly data?: DataView;
  readonly status: USBTransferStatus;
}

interface USBOutTransferResult {
  readonly bytesWritten: number;
  readonly status: USBTransferStatus;
}

interface USBIsochronousInTransferResult {
  readonly data?: DataView;
  readonly packets: USBIsochronousInTransferPacket[];
}

interface USBIsochronousOutTransferResult {
  readonly packets: USBIsochronousOutTransferPacket[];
}

interface USBIsochronousInTransferPacket {
  readonly data?: DataView;
  readonly status: USBTransferStatus;
}

interface USBIsochronousOutTransferPacket {
  readonly bytesWritten: number;
  readonly status: USBTransferStatus;
}

interface USBControlTransferParameters {
  requestType: USBRequestType;
  recipient: USBRecipient;
  request: number;
  value: number;
  index: number;
}

type USBRequestType = 'standard' | 'class' | 'vendor';
type USBRecipient = 'device' | 'interface' | 'endpoint' | 'other';

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USB extends EventTarget {
  onconnect: ((this: USB, ev: USBConnectionEvent) => any) | null;
  ondisconnect: ((this: USB, ev: USBConnectionEvent) => any) | null;
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  addEventListener(type: 'connect', listener: (ev: USBConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'disconnect', listener: (ev: USBConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: 'connect', listener: (ev: USBConnectionEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: 'disconnect', listener: (ev: USBConnectionEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

interface Navigator {
  readonly usb?: USB;
}
