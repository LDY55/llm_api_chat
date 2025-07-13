import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useSession() {
  return useQuery<{ authenticated: boolean } | null>({
    queryKey: ["/api/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
