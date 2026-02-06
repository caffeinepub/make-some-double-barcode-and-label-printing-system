/**
 * Utility functions for detecting and classifying Internet Computer errors
 */

/**
 * Checks if an error is an IC0508 stopped-canister rejection
 * @param error - The error object or message to check
 * @returns true if the error indicates a stopped canister
 */
export function isStoppedCanisterError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = String(error);

  // Check for IC0508 error code
  if (errorMessage.includes('IC0508') || errorString.includes('IC0508')) {
    return true;
  }

  // Check for reject_code 5 combined with "is stopped" message
  if (
    (errorMessage.includes('reject_code') || errorString.includes('reject_code')) &&
    (errorMessage.includes('5') || errorString.includes('"reject_code": 5')) &&
    (errorMessage.includes('is stopped') || errorString.includes('is stopped'))
  ) {
    return true;
  }

  // Check for explicit "Canister ... is stopped" message
  if (
    errorMessage.includes('Canister') &&
    errorMessage.includes('is stopped')
  ) {
    return true;
  }

  // Check for "canister is stopped" in any form
  if (
    errorMessage.toLowerCase().includes('canister') &&
    errorMessage.toLowerCase().includes('stopped')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an error is a network/connection error
 * @param error - The error object or message to check
 * @returns true if the error indicates a network/connection issue
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = String(error);

  // Don't classify stopped canister as network error
  if (isStoppedCanisterError(error)) {
    return false;
  }

  return (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Actor not initialized') ||
    errorMessage.includes('Actor not available') ||
    errorMessage.includes('Connection timeout') ||
    errorString.includes('fetch') ||
    errorString.includes('network')
  );
}

/**
 * Checks if an error is an authentication failure (wrong password)
 * @param error - The error object or message to check
 * @returns true if the error indicates authentication failure
 */
export function isAuthenticationError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Authentication')
  );
}

/**
 * Checks if an error is a configuration/deployment mismatch
 * @param error - The error object or message to check
 * @returns true if the error indicates a configuration issue
 */
export function isConfigurationError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = String(error);

  return (
    errorMessage.includes('Canister not found') ||
    errorMessage.includes('Invalid canister id') ||
    errorMessage.includes('Failed to create actor') ||
    errorMessage.includes('Agent host mismatch') ||
    errorString.includes('Canister not found') ||
    errorString.includes('Invalid canister id')
  );
}

/**
 * Gets a user-friendly error message for display
 * @param error - The error object or message
 * @returns A user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (isStoppedCanisterError(error)) {
    return 'Backend service unavailable. Label printed but not recorded.';
  }

  if (isConfigurationError(error)) {
    return 'Configuration error: The application may not be properly deployed. Please contact the administrator.';
  }

  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  if (isAuthenticationError(error)) {
    return 'Authentication failed. Please check your password and try again.';
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return `An error occurred: ${errorMessage}`;
}

/**
 * Gets a concise operator-friendly error summary without raw rejection payloads
 * @param error - The error object or message
 * @returns A concise error summary suitable for operators
 */
export function getOperatorErrorSummary(error: unknown): string {
  if (isStoppedCanisterError(error)) {
    return 'Backend service is stopped. Label printed successfully but could not be recorded in the system.';
  }

  if (isConfigurationError(error)) {
    return 'System configuration error. Please contact support.';
  }

  if (isNetworkError(error)) {
    return 'Network connection lost. Please check your connection.';
  }

  if (isAuthenticationError(error)) {
    return 'Authentication failed. Please log in again.';
  }

  // For other errors, extract just the first line or a short summary
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // If it's a long error with rejection details, extract just the key part
  if (errorMessage.includes('rejection error') || errorMessage.includes('Reject code')) {
    if (errorMessage.includes('IC0508')) {
      return 'Backend service stopped. Label printed but not recorded.';
    }
    return 'Backend request failed. Label may have printed successfully.';
  }

  // Return first line or first 100 characters
  const firstLine = errorMessage.split('\n')[0];
  return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
}
