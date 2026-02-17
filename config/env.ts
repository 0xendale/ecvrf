import { PrivateKeyAccount } from "viem";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { VRFKey } from "@utils/vrfProof";

export type EnvConfig = {
  CHAIN_ID: number;
  CHAIN_NAME: string;
  CHAIN_NETWORK: string;
  NATIVE_CURRENCY: {
    NAME: string;
    SYMBOL: string;
    DECIMALS: number;
  };
  RPC_URL: string;
  VRF_COORDINATOR_ADDRESS?: string;
  DAPP_CONTRACT_ADDRESS?: string;
};

const configDefault: EnvConfig = {
  CHAIN_ID: Number(process.env.CHAIN_ID),
  CHAIN_NAME: process.env.CHAIN_NAME as string,
  CHAIN_NETWORK: process.env.CHAIN_NETWORK as string,
  NATIVE_CURRENCY: {
    NAME: process.env.CHAIN_NATIVE_CURRENCY_NAME as string,
    SYMBOL: process.env.CHAIN_NATIVE_CURRENCY_SYMBOL as string,
    DECIMALS: Number(process.env.CHAIN_NATIVE_CURRENCY_DECIMALS),
  },
  RPC_URL: process.env.RPC_URL as string,
  VRF_COORDINATOR_ADDRESS: process.env.VRF_COORDINATOR_ADDRESS as string,
  DAPP_CONTRACT_ADDRESS: process.env.DAPP_CONTRACT_ADDRESS as string,
};

const hardhatConfig: EnvConfig = {
  CHAIN_ID: 31337,
  CHAIN_NAME: "hardhat",
  CHAIN_NETWORK: "hardhat",
  NATIVE_CURRENCY: {
    NAME: "Viction",
    SYMBOL: "VIC",
    DECIMALS: 18,
  },
  RPC_URL: "http://127.0.0.1:8545",
};

export function getEnvConfig(testnet: boolean = false): EnvConfig {
  if (testnet) return hardhatConfig;
  else return configDefault;
}

export const oracleAccount = (): PrivateKeyAccount => {
  const oracleAccount = privateKeyToAccount(
    process.env.PRIVATE_KEY as `0x${string}`
  );
  return oracleAccount;
};

export const KeyStoreManager = (): VRFKey => {
  const keystore = process.env.PRIVATE_KEY as `0x${string}`;
  return new VRFKey(keystore);
};
