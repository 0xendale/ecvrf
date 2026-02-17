import { createClient } from "@utils/viemClient";
import {
  createVRFCoordinatorService,
  VRFCoordinatorService,
} from "@integration-services";
import { EnvConfig, KeyStoreManager } from "@config/env";
import VRFCoordinatorABI from "@abis/VRFCoordinator.json";

export async function deployVRFCoordinatorContract(
  config: EnvConfig
): Promise<VRFCoordinatorService> {
  const { publicClient, walletClient } = createClient(config);
  const oracle = KeyStoreManager();
  const deployHash = await walletClient.deployContract({
    abi: VRFCoordinatorABI.abi as any,
    bytecode: VRFCoordinatorABI.bytecode as `0x${string}`,
    args: [],
  } as any);

  console.log("🚀 Deploy tx hash:", deployHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });

  const contractAddress = receipt.contractAddress!;
  console.log("✅ Contract deployed at:", contractAddress);

  const bytecode = await publicClient.getCode({
    address: contractAddress as `0x${string}`,
  });

  if (bytecode === "0x") {
    console.log("❌ Contract not deployed");
  } else {
    console.log("✅ Contract deployed");
  }

  const vrfCoordinatorContract = createVRFCoordinatorService(
    contractAddress,
    publicClient,
    walletClient
  );

  const coordinatorConfig = {
    miminumRequestConfirmations: 1,
    maxGasLimit: 34000000,
    gasAfterPaymentCalculation: 300,
  };

  const txSetConfig = await vrfCoordinatorContract.setConfig(
    coordinatorConfig.miminumRequestConfirmations,
    coordinatorConfig.maxGasLimit,
    coordinatorConfig.gasAfterPaymentCalculation
  );
  console.log("🔧 Tx set config :", txSetConfig);

  const currentConfig = await vrfCoordinatorContract.getConfig();
  console.log("🔧 Coordinator config :", currentConfig);

  const registerProvingKeyTX = await vrfCoordinatorContract.registerProvingKey(
    oracle.account.address,
    oracle.getPublicKeyTuple()
  );
  console.log("🔧 registerProvingKeyTX  :", registerProvingKeyTX);

  return vrfCoordinatorContract;
}
