import type { QueryClient } from '@tanstack/react-query';

// the pages depend on each other (a new extension changes the users, the ranges and the
// dashboard), so after any change they are all refreshed
export function refreshPbxData(queryClient: QueryClient) {
  return Promise.all(
    ['extensions', 'users', 'ranges', 'restrictions', 'pbx'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}