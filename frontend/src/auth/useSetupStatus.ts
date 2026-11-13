import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// the appliance has no administrator until the first-run setup is done
export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.get<{ needsSetup: boolean }>('/auth/setup-status'),
  });
}