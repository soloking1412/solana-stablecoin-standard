import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  preset: number;
  paused: boolean;
  totalMinted: string;
  totalBurned: string;
}

export function useStablecoin(mintAddress: string) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [config, setConfig] = useState<TokenConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mintAddress) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const mint = new PublicKey(mintAddress);
        const supply = await connection.getTokenSupply(mint);
        setConfig({
          name: "Loaded Token",
          symbol: "TKN",
          decimals: supply.value.decimals,
          preset: 1,
          paused: false,
          totalMinted: supply.value.amount,
          totalBurned: "0",
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
      setLoading(false);
    };

    fetchConfig();
  }, [mintAddress, connection]);

  return { config, loading, error };
}
