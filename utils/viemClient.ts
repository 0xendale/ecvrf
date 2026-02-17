import {
  defineChain,
  http,
  createPublicClient,
  createWalletClient,
  PublicClient,
  WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EnvConfig } from "config/env";

export type ViemClient = {
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export const createClient = (config: EnvConfig): ViemClient => {
  const chain = defineChain({
    id: config.CHAIN_ID,
    name: config.CHAIN_NAME,
    network: config.CHAIN_NETWORK,
    nativeCurrency: {
      name: config.NATIVE_CURRENCY.NAME,
      symbol: config.NATIVE_CURRENCY.SYMBOL,
      decimals: config.NATIVE_CURRENCY.DECIMALS,
    },
    rpcUrls: {
      default: { http: [config.RPC_URL] },
    },
  });

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ Missing PRIVATE_KEY in environment variables.");
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(config.RPC_URL),
  });

  const walletClient = createWalletClient({
    chain,
    transport: http(config.RPC_URL),
    account: privateKeyToAccount(privateKey as `0x${string}`),
  });

  return { publicClient, walletClient };
};
