import { VRFCoordinatorService } from "./../../integration-services/types/Coordinator";
import {
  createVRFComsumerService,
  createVRFCoordinatorService,
  VRFConsumerService,
} from "@integration-services";
import { generateKeyHash, getPublicKeyXYFromPrivateKey } from "@utils/keys";
import { createClient } from "@utils/viemClient";
import { EnvConfig, KeyStoreManager } from "config/env";
import { Address, hexToBytes } from "viem";
import DAppABI from "@abis/DappConsumer.json";
import { VRFKey } from "@utils/vrfProof";

export async function deployDappContract(
  config: EnvConfig,
  VRFCoordinatorAddress: Address
): Promise<VRFConsumerService> {
  const { publicClient, walletClient } = createClient(config);
  const oracleAccount = KeyStoreManager();

  const publicKey = oracleAccount.getPublicKeyTuple();
  const keyHash = generateKeyHash(publicKey);

  const requestConfirmations = 2;
  const upkeepInterval = 0; // 60s

  const deployHash = await walletClient.deployContract({
    abi: DAppABI.abi as any,
    bytecode: DAppABI.bytecode as `0x${string}`,
    args: [
      VRFCoordinatorAddress,
      keyHash,
      requestConfirmations,
      upkeepInterval,
    ],
  } as any);

  console.log("🚀 Deploy tx hash:", deployHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });

  const dAppContractAddress = receipt.contractAddress!;
  console.log("✅ Contract deployed at:", dAppContractAddress);

  const bytecode = await publicClient.getCode({
    address: dAppContractAddress as `0x${string}`,
  });
  if (bytecode === "0x") {
    console.log("❌ Contract not deployed");
  } else {
    console.log("✅ Contract deployed");
  }

  const vrfCoordinatorContract = createVRFCoordinatorService(
    VRFCoordinatorAddress,
    publicClient,
    walletClient
  );
  // Setup consumer
  const setConsumerTx = await vrfCoordinatorContract.addConsumer(
    dAppContractAddress as Address
  );

  console.log("🔧 Tx set consumer:", setConsumerTx);

  const vrfConsumerService = createVRFComsumerService(
    dAppContractAddress,
    publicClient,
    walletClient
  );

  return vrfConsumerService;
}
