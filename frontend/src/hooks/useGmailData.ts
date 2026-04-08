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

export function useGmailMessageLabels(credentialId: string, messageId: string) {
  return useQuery({
    queryKey:  ['gmail-message-labels', credentialId, messageId],
    queryFn:   () => listGmailMessageLabels(credentialId, messageId),
    enabled:   !!credentialId && !!messageId,
    staleTime: 60 * 1000,
    retry:     false,
  });
}
