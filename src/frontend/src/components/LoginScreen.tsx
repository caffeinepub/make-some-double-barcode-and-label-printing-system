import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, CheckCircle, AlertCircle, RefreshCw, ChevronDown, Copy, CheckCheck } from 'lucide-react';
import { useAuthenticate, useHealthCheck } from '../hooks/useQueries';
import { isStoppedCanisterError, isNetworkError, isAuthenticationError } from '../utils/icErrors';
import { useQueryClient } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

interface ErrorDetails {
  primaryMessage: string;
  rawError: string;
  lastHealthCheck: {
    status: 'success' | 'failure' | 'not-checked';
    timestamp: string;
  };
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBackendStopped, setIsBackendStopped] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const authenticateMutation = useAuthenticate();
  const healthCheckMutation = useHealthCheck();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoRetriedRef = useRef(false);

  // Auto-recovery polling when backend is stopped
  useEffect(() => {
    if (isBackendStopped) {
      // Start polling health check every 3 seconds
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const isHealthy = await healthCheckMutation.mutateAsync();
          if (isHealthy) {
            // Backend is back online
            setIsBackendStopped(false);
            setErrorDetails(null);
            // Clear the interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        } catch (err) {
          // Still offline, continue polling
        }
      }, 3000);
    }

    // Cleanup on unmount or when stopped state changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isBackendStopped, healthCheckMutation]);

  const updateHealthCheckStatus = (status: 'success' | 'failure') => {
    setErrorDetails(prev => prev ? {
      ...prev,
      lastHealthCheck: {
        status,
        timestamp: new Date().toLocaleString()
      }
    } : null);
  };

  const handleLogin = async (isAutoRetry = false) => {
    if (!password) {
      setErrorDetails({
        primaryMessage: 'Please enter a password',
        rawError: 'Empty password field',
        lastHealthCheck: {
          status: 'not-checked',
          timestamp: 'N/A'
        }
      });
      return;
    }

    setErrorDetails(null);
    setIsBackendStopped(false);
    if (isAutoRetry) {
      setIsAutoRetrying(true);
    }

    try {
      // Call backend authenticate function with exact string (no trimming or formatting)
      const result = await authenticateMutation.mutateAsync(password);
      
      if (result === true) {
        // Authentication succeeded - show success state
        setIsSuccess(true);
        hasAutoRetriedRef.current = false;
        
        // Store session and redirect after short delay for better UX
        sessionStorage.setItem('isAuthenticated', 'true');
        setTimeout(() => {
          onAuthenticated();
        }, 800);
      } else {
        // Backend returned false - wrong password
        setErrorDetails({
          primaryMessage: 'Authentication failed. Please check your password.',
          rawError: 'Backend authenticate() returned false',
          lastHealthCheck: {
            status: 'not-checked',
            timestamp: 'N/A'
          }
        });
        setPassword(''); // Clear password only on wrong password
        hasAutoRetriedRef.current = false;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      const rawError = err instanceof Error ? err.message : String(err);
      
      // Classify the error and show appropriate message
      if (isStoppedCanisterError(err)) {
        setErrorDetails({
          primaryMessage: 'The backend canister needs to be restarted. An administrator must start the canister. The system will automatically reconnect when the backend is available.',
          rawError,
          lastHealthCheck: {
            status: 'failure',
            timestamp: new Date().toLocaleString()
          }
        });
        setIsBackendStopped(true);
        hasAutoRetriedRef.current = false;
        // Keep password for automatic retry when backend comes back
      } else if (isAuthenticationError(err)) {
        setErrorDetails({
          primaryMessage: 'Authentication failed. Please check your password.',
          rawError,
          lastHealthCheck: {
            status: 'not-checked',
            timestamp: 'N/A'
          }
        });
        setPassword(''); // Clear password only on wrong password
        hasAutoRetriedRef.current = false;
      } else if (isNetworkError(err)) {
        // Network/connection/actor-initialization error - preserve password and attempt auto-recovery
        setErrorDetails({
          primaryMessage: 'Unable to connect. Attempting automatic recovery...',
          rawError,
          lastHealthCheck: {
            status: 'not-checked',
            timestamp: new Date().toLocaleString()
          }
        });
        
        // Attempt automatic preflight recovery if this is the first attempt
        if (!isAutoRetry && !hasAutoRetriedRef.current) {
          hasAutoRetriedRef.current = true;
          await attemptAutoRecovery();
        } else {
          // Auto-retry already attempted or this is already a retry
          setErrorDetails(prev => prev ? {
            ...prev,
            primaryMessage: 'Unable to connect. Please check your connection and try the manual retry.'
          } : null);
          setIsAutoRetrying(false);
        }
        // Keep password for retry
      } else {
        // Unknown error - default to connection issue, preserve password
        setErrorDetails({
          primaryMessage: 'Unable to connect. Please try again.',
          rawError,
          lastHealthCheck: {
            status: 'not-checked',
            timestamp: new Date().toLocaleString()
          }
        });
        
        // Attempt automatic preflight recovery if this is the first attempt
        if (!isAutoRetry && !hasAutoRetriedRef.current) {
          hasAutoRetriedRef.current = true;
          await attemptAutoRecovery();
        } else {
          setIsAutoRetrying(false);
        }
        // Keep password for retry
      }
    }
  };

  const attemptAutoRecovery = async () => {
    try {
      setIsAutoRetrying(true);
      
      // Step 1: Health check
      const isHealthy = await healthCheckMutation.mutateAsync();
      updateHealthCheckStatus(isHealthy ? 'success' : 'failure');
      
      if (isHealthy) {
        // Step 2: Force actor recreation by invalidating all actor-related queries
        await queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.includes('actor'),
        });
        await queryClient.removeQueries({
          predicate: (query) => query.queryKey.includes('actor'),
        });
        
        // Wait for actor to reinitialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 3: Retry authentication with preserved password
        await handleLogin(true);
      } else {
        setErrorDetails(prev => prev ? {
          ...prev,
          primaryMessage: 'Backend is offline. Please wait or try manual retry.',
          lastHealthCheck: {
            status: 'failure',
            timestamp: new Date().toLocaleString()
          }
        } : null);
        setIsBackendStopped(true);
        setIsAutoRetrying(false);
      }
    } catch (err) {
      console.error('Auto-recovery error:', err);
      const rawError = err instanceof Error ? err.message : String(err);
      setErrorDetails(prev => prev ? {
        ...prev,
        primaryMessage: 'Automatic recovery failed. Please try manual retry.',
        rawError: `${prev.rawError}\n\nAuto-recovery error: ${rawError}`,
        lastHealthCheck: {
          status: 'failure',
          timestamp: new Date().toLocaleString()
        }
      } : null);
      setIsAutoRetrying(false);
    }
  };

  const handleManualRetry = async () => {
    setIsRetrying(true);
    setErrorDetails(null);
    setIsBackendStopped(false);
    hasAutoRetriedRef.current = false;

    try {
      // First check health
      const isHealthy = await healthCheckMutation.mutateAsync();
      updateHealthCheckStatus(isHealthy ? 'success' : 'failure');
      
      if (isHealthy) {
        // Backend is healthy, invalidate actor and retry authentication
        await queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.includes('actor'),
        });
        await queryClient.removeQueries({
          predicate: (query) => query.queryKey.includes('actor'),
        });

        // Wait a moment for actor to reinitialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Retry authentication with preserved password
        await handleLogin();
      } else {
        setErrorDetails({
          primaryMessage: 'Backend is still offline. Please wait...',
          rawError: 'Health check failed',
          lastHealthCheck: {
            status: 'failure',
            timestamp: new Date().toLocaleString()
          }
        });
        setIsBackendStopped(true);
      }
    } catch (err) {
      console.error('Retry error:', err);
      const rawError = err instanceof Error ? err.message : String(err);
      if (isStoppedCanisterError(err)) {
        setErrorDetails({
          primaryMessage: 'The backend canister needs to be restarted. An administrator must start the canister.',
          rawError,
          lastHealthCheck: {
            status: 'failure',
            timestamp: new Date().toLocaleString()
          }
        });
        setIsBackendStopped(true);
      } else {
        setErrorDetails({
          primaryMessage: 'Unable to connect. Please try again.',
          rawError,
          lastHealthCheck: {
            status: 'failure',
            timestamp: new Date().toLocaleString()
          }
        });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const copyDetailsToClipboard = async () => {
    if (!errorDetails) return;
    
    const detailsText = `Error Details:
Primary Message: ${errorDetails.primaryMessage}

Raw Error: ${errorDetails.rawError}

Last Health Check:
  Status: ${errorDetails.lastHealthCheck.status}
  Timestamp: ${errorDetails.lastHealthCheck.timestamp}`;
    
    try {
      await navigator.clipboard.writeText(detailsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isLoading = authenticateMutation.isPending || isRetrying || isAutoRetrying;
  const showRetryButton = errorDetails && !isBackendStopped && !isAutoRetrying;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0f0f0f] border border-zinc-800 rounded-lg p-10 space-y-8">
          <div className="flex flex-col items-center space-y-5">
            <div 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                isSuccess 
                  ? 'bg-green-900/30 scale-110' 
                  : errorDetails
                  ? 'bg-red-900/30'
                  : 'bg-zinc-900'
              }`}
            >
              {isSuccess ? (
                <CheckCircle className="w-12 h-12 text-green-500 animate-in zoom-in duration-300" />
              ) : errorDetails ? (
                <AlertCircle className="w-12 h-12 text-red-500 animate-in zoom-in duration-200" />
              ) : (
                <Lock className="w-12 h-12 text-blue-500" />
              )}
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-3">
                {isSuccess ? 'Access Granted!' : 'Make Some Double!!'}
              </h1>
              <p className="text-zinc-400 text-base">
                {isSuccess ? 'Redirecting to system...' : 'Enter password to access the system'}
              </p>
            </div>
          </div>

          {!isSuccess && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="password" className="text-white text-lg">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    // Store exact value without trimming
                    setPassword(e.target.value);
                    setErrorDetails(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && !isBackendStopped && handleLogin()}
                  placeholder="Enter password"
                  className="bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-14 text-lg"
                  disabled={isLoading}
                  autoFocus
                />
                {errorDetails && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-900/50 rounded-md animate-in fade-in duration-200">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <p className="text-base text-red-400">{errorDetails.primaryMessage}</p>
                        
                        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-red-300 hover:text-red-200 hover:bg-red-950/50"
                            >
                              <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                              {showDetails ? 'Hide' : 'Show'} Details
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            <div className="bg-black/30 rounded p-3 space-y-2 text-xs font-mono">
                              <div>
                                <div className="text-red-300 font-semibold mb-1">Raw Error:</div>
                                <div className="text-red-400/80 break-all">{errorDetails.rawError}</div>
                              </div>
                              <div>
                                <div className="text-red-300 font-semibold mb-1">Last Health Check:</div>
                                <div className="text-red-400/80">
                                  Status: {errorDetails.lastHealthCheck.status}
                                  <br />
                                  Time: {errorDetails.lastHealthCheck.timestamp}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyDetailsToClipboard}
                              className="h-8 text-xs border-red-900/50 bg-red-950/30 hover:bg-red-950/50 text-red-300"
                            >
                              {copied ? (
                                <>
                                  <CheckCheck className="w-3 h-3 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy Details
                                </>
                              )}
                            </Button>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handleLogin()}
                  disabled={isLoading || !password || isBackendStopped}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all h-14 text-lg active:scale-95"
                >
                  {isLoading && !isRetrying ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isAutoRetrying ? 'Auto-recovering...' : 'Unlocking...'}
                    </span>
                  ) : (
                    'Unlock'
                  )}
                </Button>

                {showRetryButton && (
                  <Button
                    onClick={handleManualRetry}
                    disabled={isRetrying}
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all h-14 text-lg active:scale-95"
                  >
                    {isRetrying ? (
                      <span className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Retrying...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5" />
                        Retry Connection
                      </span>
                    )}
                  </Button>
                )}

                {isBackendStopped && (
                  <Button
                    onClick={handleManualRetry}
                    disabled={isRetrying}
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all h-14 text-lg active:scale-95"
                  >
                    {isRetrying ? (
                      <span className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Checking...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5" />
                        Retry Connection
                      </span>
                    )}
                  </Button>
                )}
              </div>

              {isBackendStopped && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-zinc-500">
                    Waiting for backend to restart...
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-xs text-zinc-600">Auto-checking every 3 seconds</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
