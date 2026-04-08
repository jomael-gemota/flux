import { useQuery } from '@tanstack/react-query';
import { listGmailLabels, listGmailMessageLabels } from '../api/client';

export function useGmailLabels(credentialId: string) {
  return useQuery({
    queryKey:  ['gmail-labels', credentialId],
    queryFn:   () => listGmailLabels(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}

/** Returns true when the value is an unresolved expression like {{nodes.x.y}} */
export function isExpression(value: string): boolean {
  return /\{\{.*?\}\}/.test(value);
}

export function useGmailMessageLabels(credentialId: string, messageId: string) {
  return useQuery({
    queryKey:  ['gmail-message-labels', credentialId, messageId],
    queryFn:   () => listGmailMessageLabels(credentialId, messageId),
    // Never fire with a raw template expression — it can't be resolved here
    enabled:   !!credentialId && !!messageId && !isExpression(messageId),
    staleTime: 60 * 1000,
    retry:     false,
  });
}
