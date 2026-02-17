import { parseArgs } from "node:util";
import { startVRFListener } from "jobs/listeners/vrfListener";
import { getEnvConfig } from "@config/env";

const { values } = parseArgs({
  options: {
    testnet: {
      type: "boolean",
      short: "t",
    },
  },
});

const initWorker = async () => {
  const config = getEnvConfig(values.testnet);
  console.log(
    `🚀 VRF Worker Running on ${values.testnet ? "Testnet" : "Mainnet"}...`
  );
  await startVRFListener(config);
};

initWorker().catch((err) => console.error("❌ Worker error:", err));
