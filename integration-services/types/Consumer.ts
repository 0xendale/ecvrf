import { Address, TransactionReceipt } from "viem";

export type UpkeepResponse = {
  upKeepNeeded: boolean;
  performData: string;
};

export type requestRecord = {
  requestId: bigint;
  fullfilled: boolean;
  callbackGasLimit: number;
  randomness: bigint;
};

export type ConsumerContractState = {
  lastTimeStamp: bigint;
  vrfREquestCounter: bigint;
  vrfResponseCounter: bigint;
};

export type VRFConsumerService = {
  address: Address;
  keyHash(): Promise<string>;
  coordinatorAddress(): Promise<Address>;
  checkUpkeep(data: Uint8Array): Promise<UpkeepResponse>;
  performUpkeep(data: Uint8Array): Promise<TransactionReceipt>;
  fullfillRandomWords(
    requestId: bigint,
    randomWords: bigint[]
  ): Promise<TransactionReceipt>;

  requestRandomWords(): Promise<any>;

  getContractState(): Promise<ConsumerContractState>;
};
