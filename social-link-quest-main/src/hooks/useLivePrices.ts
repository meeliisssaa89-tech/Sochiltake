import { useQuery } from "@tanstack/react-query";

export interface LivePrices {
  TON: number;
  USDT: number;
  [symbol: string]: number;
}

async function fetchPrices(): Promise<LivePrices> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,tether&vs_currencies=usd",
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) throw new Error("price fetch failed");
    const json = await res.json();
    return {
      TON: Number(json["the-open-network"]?.usd) || 0,
      USDT: Number(json["tether"]?.usd) || 1,
    };
  } catch {
    return { TON: 0, USDT: 1 };
  }
}

export function useLivePrices() {
  return useQuery<LivePrices>({
    queryKey: ["live-prices"],
    queryFn: fetchPrices,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    initialData: { TON: 0, USDT: 1 },
  });
}

export function getLiveRate(symbol: string | undefined, prices: LivePrices | undefined, fallback: number): number {
  if (!symbol || !prices) return fallback;
  const live = prices[symbol.toUpperCase()];
  if (typeof live === "number" && live > 0) return live;
  return fallback;
}
