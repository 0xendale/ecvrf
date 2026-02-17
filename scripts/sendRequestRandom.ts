// scripts/deploy.ts
import { parseArgs } from "node:util";
import { EnvConfig, getEnvConfig } from "@config/env";
import { requestRandomWords } from "./tests/requestRandom";
import { createVRFComsumerService } from "@integration-services";
import { createClient } from "@utils/viemClient";

const { values } = parseArgs({
  options: {
    testnet: {
      type: "boolean",
      short: "t",
    },
  },
});

const main = async () => {
  try {
    const config: EnvConfig = getEnvConfig(values.testnet);
    const { publicClient, walletClient } = createClient(config);

    const dappContract = createVRFComsumerService(
      process.env.DAPP_CONTRACT_ADDRESS as `0x${string}`,
      publicClient,
      walletClient
    );

    const coordinatorTarget = await dappContract.coordinatorAddress();

    console.log("🔧 Coordinator Target:", coordinatorTarget);

    await requestRandomWords(dappContract);
  } catch (error) {
    throw error;
  }
};

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
