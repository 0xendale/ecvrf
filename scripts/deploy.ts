// scripts/deploy.ts
import { parseArgs } from "node:util";
import { deployVRFCoordinatorContract } from "./contractDeployment/deployVRFCoordinator";
import { EnvConfig, getEnvConfig } from "@config/env";
import { deployDappContract } from "./tests/deployDapp";
import { config as dotenvConfig } from "dotenv";
import { writeFileSync, readFileSync } from "fs";
import path from "node:path";

const { values } = parseArgs({
  options: {
    testnet: {
      type: "boolean",
      short: "t",
    },
  },
});


// Load current .env
const ENV_PATH = path.resolve(__dirname, "../.env");
dotenvConfig({ path: ENV_PATH });

const updateEnv = (key: string, value: string) => {
  const env = readFileSync(ENV_PATH, "utf-8")
    .split("\n")
    .filter((line) => line.trim() !== "");

  const newEnv = env.filter((line) => !line.startsWith(`${key}=`));
  newEnv.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, newEnv.join("\n"));
};

const main = async () => {
  const config: EnvConfig = getEnvConfig(values.testnet);
  console.log("Deploying contracts on", values.testnet ? "Testnet" : "Mainnet");
  console.log("config", config);
  const vrfCoordinatorContract = await deployVRFCoordinatorContract(config);

  const dappContract = await deployDappContract(
    config,
    vrfCoordinatorContract.address
  );

  console.log(
    "🚀 All contracts deployed",
    "VRF Coordinator:",
    vrfCoordinatorContract.address,
    "Dapp:",
    dappContract.address
  );

   // Save to .env
   updateEnv("VRF_COORDINATOR_ADDRESS", vrfCoordinatorContract.address);
   updateEnv("DAPP_CONTRACT_ADDRESS", dappContract.address);

   console.log(`🔐 Saved to .env as VRF_COORDINATOR_ADDRESS, DAPP_CONTRACT_ADDRESS`);
};

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
