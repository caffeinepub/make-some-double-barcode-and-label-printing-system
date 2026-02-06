import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { LabelConfig, Printer, PrintRecord, ErrorLog, UserProfile, TitleMapping } from '../backend';

const QUERY_KEYS = {
  printers: ['printers'],
  labelConfigs: ['labelConfigs'],
  printHistory: ['printHistory'],
  errorLogs: ['errorLogs'],
  userProfile: ['userProfile'],
  authenticated: ['authenticated'],
  dualLabelCount: ['dualLabelCount'],
  validPrefixes: ['validPrefixes'],
  titleMappings: ['titleMappings'],
  health: ['health'],
};

// Timeout wrapper for backend calls
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Request timeout'
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

// Health check hook - can be called without authentication
export function useHealthCheck() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async () => {
      if (!actor) {
        throw new Error('Actor not initialized');
      }
      
      try {
        const result = await withTimeout(
          actor.health(),
          5000,
          'Health check timeout'
        );
        return result;
      } catch (error: any) {
        throw error;
      }
    },
    retry: false,
  });
}

export function useAuthenticate() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (password: string) => {
      if (!actor) {
        throw new Error('Actor not initialized');
      }
      
      try {
        const result = await withTimeout(
          actor.authenticate(password),
          10000,
          'Connection timeout - unable to reach server'
        );
        return result;
      } catch (error: any) {
        if (error.message?.includes('timeout')) {
          throw new Error('Connection timeout - unable to reach server');
        }
        throw error;
      }
    },
    retry: false,
  });
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: QUERY_KEYS.userProfile,
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
      if (!actor) throw new Error('Actor not initialized');
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userProfile });
    },
  });
}

export function usePrinters() {
  const { actor, isFetching } = useActor();

  return useQuery<Printer[]>({
    queryKey: QUERY_KEYS.printers,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPrinters();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddPrinter() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, connectionType }: { name: string; connectionType: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.addPrinter(name, connectionType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.printers });
    },
  });
}

export function useUpdatePrinterStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, status }: { name: string; status: string }) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.updatePrinterStatus(name, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.printers });
    },
  });
}

export function useLabelConfigs() {
  const { actor, isFetching } = useActor();

  return useQuery<LabelConfig[]>({
    queryKey: QUERY_KEYS.labelConfigs,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllLabelConfigs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveLabelConfig() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, config }: { name: string; config: LabelConfig }) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.saveLabelConfig(name, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.labelConfigs });
    },
  });
}

export function usePrintHistory() {
  const { actor, isFetching } = useActor();

  return useQuery<PrintRecord[]>({
    queryKey: QUERY_KEYS.printHistory,
    queryFn: async () => {
      if (!actor) return [];
      const records = await actor.getAllPrintRecords();
      return records.sort((a, b) => Number(b.timestamp - a.timestamp));
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePrintLabel() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serialNumber,
      labelType,
      printer,
    }: {
      serialNumber: string;
      labelType: string;
      printer: string;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.addPrintRecord(serialNumber, labelType, printer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.printHistory });
    },
  });
}

export function useErrorLogs() {
  const { actor, isFetching } = useActor();

  return useQuery<ErrorLog[]>({
    queryKey: QUERY_KEYS.errorLogs,
    queryFn: async () => {
      if (!actor) return [];
      const logs = await actor.getAllErrorLogs();
      return logs.sort((a, b) => Number(b.timestamp - a.timestamp));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddErrorLog() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ errorMessage, printer }: { errorMessage: string; printer?: string | null }) => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.addErrorLog(errorMessage, printer || null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.errorLogs });
    },
  });
}

export function useGetDualLabelCount() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: QUERY_KEYS.dualLabelCount,
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getNewDualLabelCount();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIncrementDualLabelCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.incrementNewDualLabelCount();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dualLabelCount });
    },
  });
}

// Prefix validation hooks
export function useGetValidPrefixes() {
  const { actor, isFetching } = useActor();

  return useQuery<string[]>({
    queryKey: QUERY_KEYS.validPrefixes,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPrefixes();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddMultiplePrefixes() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefixesText: string) => {
      if (!actor) throw new Error('Actor not initialized');
      
      // Parse comma-separated or multiline prefixes
      const prefixes = prefixesText
        .split(/[,\n]/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      await actor.setPrefixes(prefixes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.validPrefixes });
    },
  });
}

export function useValidateBarcode() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (barcode: string) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.validateBarcode(barcode);
    },
  });
}

// Title mapping hooks
export function useGetTitleMappings() {
  const { actor, isFetching } = useActor();

  return useQuery<TitleMapping[]>({
    queryKey: QUERY_KEYS.titleMappings,
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllTitleMappings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useInitializeDefaultTitles() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not initialized');
      await actor.initializeDefaultTitles();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.titleMappings });
    },
  });
}

export function useGetTitleByPrefix() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (prefix: string) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.getTitleByPrefix(prefix);
    },
  });
}
