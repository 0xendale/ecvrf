import { Address, getContract, PublicClient, WalletClient } from "viem";
import vrfConsumerABI from "@abis/VRFConsumer.json";
import {
  ConsumerContractState,
  UpkeepResponse,
  VRFConsumerService,
} from "@integration-services";

import { sendTxAndConfirm } from "@utils/transactions";

export const createVRFComsumerService = (
  contractAddress: Address,
  publicClient: PublicClient,
  walletClient: WalletClient
): VRFConsumerService => {
  const vrfConsumerContract = getContract({
    address: contractAddress as `0x${string}`,
    abi: vrfConsumerABI.abi,
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });

  const keyHash = async () => {
    try {
      const hash = await vrfConsumerContract.read.KEY_HASH();
      return hash as string;
    } catch (err) {
      console.error("❌ Failed to get hash of key:", err);
      throw err;
    }
  };

  const coordinatorAddress = async () => {
    try {
      const addr = await vrfConsumerContract.read.COORDINATOR();
      return addr as Address;
    } catch (err) {
      console.error("❌ Failed to get coordinator:", err);
      throw err;
    }
  };

  const performUpkeep = async (data: Uint8Array) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfConsumerContract.write.performUpKeep([data])
    );
  };

  const fullfillRandomWords = async (
    requestId: bigint,
    randomWords: bigint[]
  ) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfConsumerContract.write.fulfillRandomWords([requestId, randomWords])
    );
  };

  const requestRandomWords = async () => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfConsumerContract.write.requestRandomWords([])
    );
  };

  const checkUpkeep = async (data: Uint8Array) => {
    try {
      const upkeep = await vrfConsumerContract.read.checkUpKeep([data]);
      return upkeep as UpkeepResponse;
    } catch (err) {
      console.error("❌ Failed to get hash of key:", err);
      throw err;
    }
  };

  const getContractState = async () => {
    try {
      const state = await vrfConsumerContract.read.getContractState([]);
      return state as ConsumerContractState;
    } catch (err) {
      console.error("❌ Failed to get contract state:", err);
      throw err;
    }
  };

  return {
    address: contractAddress,
    keyHash,
    coordinatorAddress,
    checkUpkeep,
    performUpkeep,
    fullfillRandomWords,
    requestRandomWords,
    getContractState,
  };
};
