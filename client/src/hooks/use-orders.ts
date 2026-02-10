import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertOrderSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Use the full input schema from routes including items array
type CreateOrderInput = z.infer<typeof api.orders.create.input>;

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await fetch(api.orders.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const res = await fetch(api.orders.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to place order");
      return api.orders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
    },
    onError: (err) => {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    }
  });
}
