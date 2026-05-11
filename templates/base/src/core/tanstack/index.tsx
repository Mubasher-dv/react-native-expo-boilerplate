import type {
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery as useInfiniteQueryHook,
  useMutation as useMutationHook,
  useQueryClient as useQueryClientHook,
  useQuery as useQueryHook,
} from "@tanstack/react-query";
import React from "react";

// Create a singleton QueryClient instance
// This ensures we don't create multiple instances
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: 1,
    },
  },
});

// QueryClientProvider component that wraps the app with the queryClient
export const TanStackQueryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Wrapper for useQuery to ensure single instance pattern
export function useQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  return useQueryHook(options);
}

// Wrapper for useMutation to ensure single instance pattern
export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options?: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  return useMutationHook(options ?? {});
}

// Wrapper for useQueryClient to ensure single instance pattern
export function useQueryClient() {
  return useQueryClientHook();
}

// Wrapper for useInfiniteQuery to ensure single instance pattern
export function useInfiniteQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseInfiniteQueryResult<TData, TError> {
  return useInfiniteQueryHook(options);
}

// Export types for useQuery and useMutation
export type {
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
};
