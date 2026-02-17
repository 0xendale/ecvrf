import { sendTxAndConfirm } from "@utils/transactions";
import {
  Address,
  getContract,
  PublicClient,
  TransactionReceipt,
  WalletClient,
} from "viem";
import vrfCoordinatorAbi from "@abis/VRFCoordinatorV2.json";
import {
  VRFCoordinatorService,
  CoordinatorConfig,
  RequestConfigResponse,
  RequestCommitment,
} from "@integration-services";
import { parsePublicKeyXY } from "@utils/keys";
import { VRFProof } from "@integration-services/types/VRF";

export const createVRFCoordinatorService = (
  contractAddress: Address,
  publicClient: PublicClient,
  walletClient: WalletClient
): VRFCoordinatorService => {
  const vrfCoordinatorContract = getContract({
    address: contractAddress as `0x${string}`,
    abi: vrfCoordinatorAbi.abi,
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });

  /**
   * Registers a proving key for the oracle.
   * @param oracleAddress - The address of the oracle.
   * @param publicProvingKey - The public proving key as a tuple of two bigints.
   * @returns A promise that resolves to the transaction hash.
   */
  const registerProvingKey = async (
    oracleAddress: Address,
    publicKey: [bigint, bigint]
  ) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.registerProvingKey([
        oracleAddress,
        publicKey,
      ])
    );
  };

  /**
   * Deregisters a proving key for the oracle.
   * @param publicProvingKey - The public proving key as a tuple of two bigints.
   * @returns A promise that resolves to the transaction hash.
   */
  const deregisterProvingKey = async (publicKeyHex: string) => {
    const pubKey = parsePublicKeyXY(publicKeyHex, true);
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.deregisterProvingKey([pubKey])
    );
  };

  /*
   * Requests randomness from the VRF Coordinator.
   * @returns A promise that resolves to the transaction hash.
   */
  const requestRandomWords = async (
    keyHash: Buffer,
    requestComfirmations: number,
    callbackGasLimit: number,
    numWords: number
  ): Promise<TransactionReceipt> => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.requestRandomWords([
        keyHash,
        requestComfirmations,
        callbackGasLimit,
        numWords,
      ])
    );
  };

  /**
   * Sets the configuration for the VRF Coordinator.
   * @param miminumRequestConfirmations - Minimum number of confirmations for a request.
   * @param maxGasLimit - Maximum gas limit for a request.
   * @param gasAfterPaymentCalculation - Gas used after payment calculation.
   * @returns A promise that resolves to the transaction hash.
   */
  const setConfig = async (
    miminumRequestConfirmations: number,
    maxGasLimit: number,
    gasAfterPaymentCalculation: number
  ) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.setConfig([
        miminumRequestConfirmations,
        maxGasLimit,
        gasAfterPaymentCalculation,
      ])
    );
  };

  const addConsumer = async (consumer: Address) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.addConsumer([consumer])
    );
  };

  const removeConsumer = async (consumer: Address) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.removeConsumer([consumer])
    );
  };

  const fulfillRandomWords = async (
    proof: VRFProof,
    requestCommitment: RequestCommitment
  ) => {
    return await sendTxAndConfirm(publicClient, () =>
      vrfCoordinatorContract.write.fulfillRandomWords([
        proof,
        requestCommitment,
      ])
    );
  };

  /**
   * Retrieves the current configuration of the VRF Coordinator.
   * @returns A promise that resolves to the configuration object.
   */
  const getConfig = async (): Promise<CoordinatorConfig> => {
    try {
      const config = (await vrfCoordinatorContract.read.getConfig()) as [
        number,
        number,
        number
      ];

      return {
        minimumRequestConfirmations: config[0],
        maxGasLimit: config[1],
        gasAfterPaymentCalculation: config[2],
      };
    } catch (err) {
      console.error("❌ Failed to get config:", err);
      throw err;
    }
  };

  const hashOfKey = async (publicKeyHex: string) => {
    try {
      const pubKey = parsePublicKeyXY(publicKeyHex, true);
      const hash = await vrfCoordinatorContract.read.hashOfKey([pubKey]);
      return hash as `0x${string}`;
    } catch (err) {
      console.error("❌ Failed to get hash of key:", err);
      throw err;
    }
  };

  const getRequestConfig = async (): Promise<RequestConfigResponse> => {
    try {
      const requestConfig =
        (await vrfCoordinatorContract.read.getRequestConfig()) as [
          number,
          number,
          Buffer
        ];

      return {
        minimumRequestConfirmations: requestConfig[0],
        maxGasLimit: requestConfig[1],
        provingKeyHash: requestConfig[2],
      };
    } catch (err) {
      console.error("❌ Failed to get hash of key:", err);
      throw err;
    }
  };

  const getCommitment = async (
    requestId: bigint
  ): Promise<RequestCommitment> => {
    try {
      const commitment = await vrfCoordinatorContract.read.getCommitment([
        requestId,
      ] as [bigint]);
      return commitment as RequestCommitment;
    } catch (err) {
      console.error("❌ Failed to get commitment:", err);
      throw err;
    }
  };

  const getConsumer = async (
    consumerAddr: Address
  ): Promise<bigint | undefined> => {
    try {
      const consumer = await vrfCoordinatorContract.read.getConsumer([
        consumerAddr,
      ] as [Address]);
      return consumer as bigint;
    } catch (err) {
      console.error("❌ Failed to get consumer:", err);
      throw err;
    }
  };

  const _devTestHookRead = async (method: string, ...args: any[]) => {
    try {
      const result = await publicClient.readContract({
        address: vrfCoordinatorContract.address,
        abi: vrfCoordinatorAbi.abi,
        functionName: method,
        args,
      });
      return result;
    } catch (err) {
      console.error(`❌ Failed to execute test method ${method}:`, err);
      throw err;
    }
  };

  const _devTestHookWrite = async (method: string, ...args: any[]) => {
    const { request } = await publicClient.simulateContract({
      address: vrfCoordinatorContract.address,
      abi: vrfCoordinatorAbi.abi,
      functionName: method,
      args,
      account: walletClient.account,
    });
    return await walletClient.writeContract(request);
  };
  return {
    address: contractAddress,
    client: {
      public: publicClient,
      wallet: walletClient,
    },

    setConfig,
    addConsumer,
    removeConsumer,
    registerProvingKey,
    fulfillRandomWords,
    deregisterProvingKey,
    requestRandomWords,
    getConfig,
    hashOfKey,
    getRequestConfig,
    getCommitment,
    getConsumer,
    _devTestHookRead,
    _devTestHookWrite,
  };
};
