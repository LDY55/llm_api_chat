import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";

export default function Login() {
  const [, navigate] = useLocation();
  const { data: session, isLoading } = useSession();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isLoading && session) {
      navigate("/");
    }
  }, [isLoading, session, navigate]);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/login", { username, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      navigate("/");
    },
    onError: () =>
      toast({ title: "Login failed", variant: "destructive" }),
  });

  if (isLoading || session) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
