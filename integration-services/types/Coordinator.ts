import { Address, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { VRFProof } from "./VRF";

export type RequestCommitment = {
  blockNum: bigint;
  callbackGasLimit: number;
  numWords: number;
  sender: Address;
};

export type RequestConfigResponse = {
  minimumRequestConfirmations: number;
  maxGasLimit: number;
  provingKeyHash: Buffer;
};

export type CoordinatorConfig = {
  minimumRequestConfirmations: number;
  maxGasLimit: number;
  gasAfterPaymentCalculation: number;
};

export type VRFCoordinatorService = {
  address: Address;

  client: {
    public: PublicClient;
    wallet: WalletClient;
  };

  fulfillRandomWords(
    proof: VRFProof,
    requestCommitment: RequestCommitment
  ): Promise<TransactionReceipt>;

  registerProvingKey(
    oracleAddress: Address,
    publicKeyHex: [bigint, bigint]
  ): Promise<TransactionReceipt>;

  deregisterProvingKey(publicKeyHex: string): Promise<TransactionReceipt>;

  setConfig(
    miminumRequestConfirmations: number,
    maxGasLimit: number,
    gasAfterPaymentCalculation: number
  ): Promise<TransactionReceipt>;

  getCommitment(requestId: bigint): Promise<RequestCommitment>;

  addConsumer(consumerAddress: Address): Promise<TransactionReceipt>;
  removeConsumer(consumerAddress: Address): Promise<TransactionReceipt>;

  requestRandomWords(
    keyHash: Buffer,
    requestComfirmations: number,
    callbackGasLimit: number,
    numWords: number
  ): Promise<TransactionReceipt>;

  getRequestConfig(): Promise<RequestConfigResponse>;

  hashOfKey(publicKeyHex: string): Promise<`0x${string}`>;

  getConfig(): Promise<CoordinatorConfig>;

  getConsumer(consumerAddr: Address): Promise<bigint | undefined>;

  // 👇 Optional test/debug function
  _devTestHookRead?: (...args: any[]) => Promise<any>;
  _devTestHookWrite?: (...args: any[]) => Promise<any>;
};
