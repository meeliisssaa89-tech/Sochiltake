import { useQuery } from "@tanstack/react-query";

export interface LivePrices {
  TON: number;
  USDT: number;
  [symbol: string]: number;
}

async function fetchFromCoingecko(): Promise<Partial<LivePrices> | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,tether&vs_currencies=usd",
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const ton = Number(json["the-open-network"]?.usd) || 0;
    const usdt = Number(json["tether"]?.usd) || 1;
    if (ton > 0) return { TON: ton, USDT: usdt };
    return null;
  } catch {
    return null;
  }
}

async function fetchFromTonapi(): Promise<Partial<LivePrices> | null> {
  try {
    const res = await fetch("https://tonapi.io/v2/rates?tokens=ton&currencies=usd");
    if (!res.ok) return null;
    const json = await res.json();
    const ton = Number(json?.rates?.TON?.prices?.USD) || 0;
    if (ton > 0) return { TON: ton, USDT: 1 };
    return null;
  } catch {
    return null;
  }
}

async function fetchFromBinance(): Promise<Partial<LivePrices> | null> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT");
    if (!res.ok) return null;
    const json = await res.json();
    const ton = Number(json?.price) || 0;
    if (ton > 0) return { TON: ton, USDT: 1 };
    return null;
  } catch {
    return null;
  }
}

async function fetchPrices(): Promise<LivePrices> {
  // Try multiple sources in order — first one with a valid TON price wins
  const sources = [fetchFromTonapi, fetchFromBinance, fetchFromCoingecko];
  for (const fn of sources) {
    const result = await fn();
    if (result?.TON && result.TON > 0) {
      return { TON: result.TON, USDT: result.USDT ?? 1 };
    }
  }
  // Last-resort fallback (avoid showing "0" for TON balance value)
  return { TON: 5, USDT: 1 };
}

export function useLivePrices() {
  return useQuery<LivePrices>({
    queryKey: ["live-prices"],
    queryFn: fetchPrices,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    initialData: { TON: 5, USDT: 1 },
  });
}

export function getLiveRate(symbol: string | undefined, prices: LivePrices | undefined, fallback: number): number {
  if (!symbol) return fallback;
  const sym = symbol.toUpperCase();
  if (sym === "USDT" || sym === "USD") return 1;
  if (!prices) return fallback;
  const live = prices[sym];
  if (typeof live === "number" && live > 0) return live;
  return fallback;
}
