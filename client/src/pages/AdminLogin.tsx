import { useLogin } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AdminLogin() {
  const { mutate: login, isPending } = useLogin();
  const [, setLocation] = useLocation();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    login(data, {
      onSuccess: () => setLocation("/admin")
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
        <h1 className="text-2xl font-serif font-bold text-center mb-2">Admin Access</h1>
        <p className="text-center text-muted-foreground mb-8">Enter credentials to continue</p>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <Input {...form.register("username")} placeholder="admin" />
            {form.formState.errors.username && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.username.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input type="password" {...form.register("password")} placeholder="••••••••" />
            {form.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>
          
          <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800" disabled={isPending}>
            {isPending ? "Authenticating..." : "Login Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
