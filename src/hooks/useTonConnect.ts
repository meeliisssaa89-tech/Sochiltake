import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    TonConnectUI: any;
  }
}

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;
const TON_ICON = "https://ton.org/icons/ton_symbol.svg";
const USDT_ICON = "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040";

export interface TonWalletState {
  connected: boolean;
  address: string | null;
  shortAddress: string | null;
  tonBalance: number;
  usdtBalance: number;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

let tonConnectInstance: any = null;

function getTonConnect() {
  if (tonConnectInstance) return tonConnectInstance;
  try {
    const TUIC = window.TonConnectUI?.TonConnectUI || window.TonConnectUI;
    if (!TUIC) return null;
    tonConnectInstance = new TUIC({ manifestUrl: MANIFEST_URL });
    return tonConnectInstance;
  } catch {
    return null;
  }
}

async function fetchOnChainBalance(address: string): Promise<{ ton: number; usdt: number }> {
  try {
    const res = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
    if (!res.ok) return { ton: 0, usdt: 0 };
    const data = await res.json();
    const ton = data.ok ? Number(data.result) / 1e9 : 0;
    return { ton, usdt: 0 };
  } catch {
    return { ton: 0, usdt: 0 };
  }
}

export function useTonConnect(): TonWalletState {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [tonBalance, setTonBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const tc = getTonConnect();
    if (!tc) return;

    const update = (wallet: any) => {
      if (wallet) {
        const addr = wallet.account?.address || null;
        setConnected(true);
        setAddress(addr);
        if (addr) {
          fetchOnChainBalance(addr).then(({ ton, usdt }) => {
            setTonBalance(ton);
            setUsdtBalance(usdt);
          });
        }
      } else {
        setConnected(false);
        setAddress(null);
        setTonBalance(0);
        setUsdtBalance(0);
      }
    };

    try {
      unsubRef.current = tc.onStatusChange(update);
      if (tc.wallet) update(tc.wallet);
    } catch { /* noop */ }

    return () => {
      try { unsubRef.current?.(); } catch { /* noop */ }
    };
  }, []);

  const connect = async () => {
    const tc = getTonConnect();
    if (!tc) return;
    setIsLoading(true);
    try {
      await tc.openModal();
    } catch { /* noop */ }
    setIsLoading(false);
  };

  const disconnect = async () => {
    const tc = getTonConnect();
    if (!tc) return;
    try {
      await tc.disconnect();
    } catch { /* noop */ }
  };

  const refreshBalance = async () => {
    if (!address) return;
    setIsLoading(true);
    const { ton, usdt } = await fetchOnChainBalance(address);
    setTonBalance(ton);
    setUsdtBalance(usdt);
    setIsLoading(false);
  };

  const shortAddress = address
    ? address.slice(0, 6) + "..." + address.slice(-4)
    : null;

  return { connected, address, shortAddress, tonBalance, usdtBalance, isLoading, connect, disconnect, refreshBalance };
}

export { TON_ICON, USDT_ICON };
