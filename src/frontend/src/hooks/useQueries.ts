import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { LabelConfig, Printer, PrintRecord, ErrorLog, UserProfile, TitleMapping } from '../backend';
import { Principal } from '@dfinity/principal';

// Query keys
const QUERY_KEYS = {
  PRINTERS: ['printers'],
  LABEL_CONFIGS: ['labelConfigs'],
  PRINT_RECORDS: ['printRecords'],
  ERROR_LOGS: ['errorLogs'],
  DUAL_BAND_COUNT: ['dualBandCount'],
  TRI_BAND_COUNT: ['triBandCount'],
  NEW_DUAL_BAND_COUNT: ['newDualBandCount'],
  PREFIXES: ['prefixes'],
  TITLE_MAPPINGS: ['titleMappings'],
  USER_PROFILE: ['userProfile'],
  HEALTH: ['health'],
};

// Authentication
export function useAuthenticate() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (password: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.authenticate(password);
    },
  });
}

// Health check mutation (for manual health checks)
export function useHealthCheck() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), 5000);
      });
      
      const healthPromise = actor.health();
      
      return Promise.race([healthPromise, timeoutPromise]);
    },
  });
}

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: QUERY_KEYS.USER_PROFILE,
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_PROFILE });
    },
  });
}

// Printer Queries
export function usePrinters() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Printer[]>({
    queryKey: QUERY_KEYS.PRINTERS,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPrinters();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useAddPrinter() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, connectionType }: { name: string; connectionType: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addPrinter(name, connectionType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRINTERS });
    },
  });
}

export function useUpdatePrinterStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, status }: { name: string; status: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updatePrinterStatus(name, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRINTERS });
    },
  });
}

// Label Config Queries
export function useLabelConfigs() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<LabelConfig[]>({
    queryKey: QUERY_KEYS.LABEL_CONFIGS,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllLabelConfigs();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useSaveLabelConfig() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, config }: { name: string; config: LabelConfig }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveLabelConfig(name, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LABEL_CONFIGS });
    },
  });
}

// Print Record Queries
export function usePrintRecords() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<PrintRecord[]>({
    queryKey: QUERY_KEYS.PRINT_RECORDS,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPrintRecords();
    },
    enabled: !!actor && !actorFetching,
  });
}

// Alias for backward compatibility
export const usePrintHistory = usePrintRecords;

export function usePrintLabel() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serialNumber, labelType, printer }: { serialNumber: string; labelType: string; printer: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addPrintRecord(serialNumber, labelType, printer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRINT_RECORDS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DUAL_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRI_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEW_DUAL_BAND_COUNT });
    },
  });
}

export function useClearPrintHistory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.clearPrintHistory();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRINT_RECORDS });
    },
  });
}

// Error Log Queries
export function useErrorLogs() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ErrorLog[]>({
    queryKey: QUERY_KEYS.ERROR_LOGS,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllErrorLogs();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useAddErrorLog() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ errorMessage, printer }: { errorMessage: string; printer: string | null }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addErrorLog(errorMessage, printer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ERROR_LOGS });
    },
  });
}

export function useClearErrorLogs() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.clearErrorLogs();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ERROR_LOGS });
    },
  });
}

// Counter Queries - Per-prefix counters
export function useGetDualBandCount() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: QUERY_KEYS.DUAL_BAND_COUNT,
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getLabelCount('dualBandCounter');
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetTriBandCount() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: QUERY_KEYS.TRI_BAND_COUNT,
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getLabelCount('triBandCounter');
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetNewDualBandCount() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: QUERY_KEYS.NEW_DUAL_BAND_COUNT,
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getLabelCount('newDualBandCounter');
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useIncrementLabelCounter() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefix: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.incrementLabelCounter(prefix);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DUAL_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRI_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEW_DUAL_BAND_COUNT });
    },
  });
}

export function useResetAllCounters() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.resetAllCounters();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DUAL_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRI_BAND_COUNT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEW_DUAL_BAND_COUNT });
    },
  });
}

// Prefix Validation Queries
export function useGetValidPrefixes() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<string[]>({
    queryKey: QUERY_KEYS.PREFIXES,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPrefixes();
    },
    enabled: !!actor && !actorFetching,
    staleTime: 30000, // Cache for 30 seconds
  });
}

export function useAddMultiplePrefixes() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefixes: string[]) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setPrefixes(prefixes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PREFIXES });
    },
  });
}

export function useValidateBarcode() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (barcode: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.validateBarcode(barcode);
    },
  });
}

// Title Mapping Queries
export function useGetTitleMappings() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TitleMapping[]>({
    queryKey: QUERY_KEYS.TITLE_MAPPINGS,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllTitleMappings();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetTitleByPrefix() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (prefix: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.getTitleByPrefix(prefix);
    },
  });
}

export function useInitializeDefaultTitles() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.initializeDefaultTitles();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TITLE_MAPPINGS });
    },
  });
}
