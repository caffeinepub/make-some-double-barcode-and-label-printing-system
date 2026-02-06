import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Printer {
    status: string;
    name: string;
    connectionType: string;
}
export interface ErrorLog {
    errorMessage: string;
    printer?: string;
    timestamp: bigint;
}
export interface LabelConfig {
    height: bigint;
    font: string;
    centerContents: boolean;
    textSize: bigint;
    horizontalSpacing: bigint;
    barcodePositionX: bigint;
    barcodePositionY: bigint;
    textPositionX: bigint;
    textPositionY: bigint;
    barcodeType: string;
    customText: string;
    barcodeWidthScale: bigint;
    margin: bigint;
    barcodeHeight: bigint;
    width: bigint;
}
export interface TitleMapping {
    title: string;
    prefix: string;
}
export interface PrintRecord {
    labelType: string;
    printer: string;
    serialNumber: string;
    timestamp: bigint;
}
export interface UserProfile {
    name: string;
    role: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addErrorLog(errorMessage: string, printer: string | null): Promise<void>;
    addPrintRecord(serialNumber: string, labelType: string, printer: string): Promise<void>;
    addPrinter(name: string, connectionType: string): Promise<void>;
    addSinglePrefix(prefix: string): Promise<void>;
    addTitleMapping(prefix: string, title: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    authenticate(password: string): Promise<boolean>;
    clearErrorLogs(): Promise<void>;
    clearPrintHistory(): Promise<void>;
    getAllErrorLogs(): Promise<Array<ErrorLog>>;
    getAllLabelConfigs(): Promise<Array<LabelConfig>>;
    getAllPrintRecords(): Promise<Array<PrintRecord>>;
    getAllPrinters(): Promise<Array<Printer>>;
    getAllTitleMappings(): Promise<Array<TitleMapping>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLabelConfig(name: string): Promise<LabelConfig>;
    getNewDualLabelCount(): Promise<bigint>;
    getPrefixes(): Promise<Array<string>>;
    getPrinter(name: string): Promise<Printer>;
    getTitleByPrefix(prefix: string): Promise<string | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    health(): Promise<boolean>;
    incrementNewDualLabelCount(): Promise<bigint>;
    initializeDefaultTitles(): Promise<void>;
    isAuthenticatedQuery(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    logout(): Promise<void>;
    removeSpecificPrefix(prefixToRemove: string): Promise<void>;
    removeTitleMapping(prefixToRemove: string): Promise<void>;
    resetAllCounters(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveLabelConfig(name: string, config: LabelConfig): Promise<void>;
    setPrefixes(newPrefixes: Array<string>): Promise<void>;
    updatePrinterStatus(name: string, status: string): Promise<void>;
    validateBarcode(barcode: string): Promise<boolean>;
}
