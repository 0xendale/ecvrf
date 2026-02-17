import "@nomicfoundation/hardhat-toolbox-viem";
import "tsconfig-paths/register";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { task } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/types";

task("export-abis", "Export contract ABIs to abis folder").setAction(
  async (_, hre) => {
    const abisFolder = path.resolve(__dirname, "abis");
    if (!fs.existsSync(abisFolder)) fs.mkdirSync(abisFolder);

    const artifacts = await hre.artifacts.getAllFullyQualifiedNames();
    for (const artifactPath of artifacts) {
      // Skip test contracts
      const artifact = await hre.artifacts.readArtifact(artifactPath);
      const filePath = path.join(abisFolder, `${artifact.contractName}.json`);

      const exportData = {
        contractName: artifact.contractName,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        deployedBytecode: artifact.deployedBytecode,
      };

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`✅ ABI exported: ${artifact.contractName}`);
    }
  }
);

export const vrfConfig = {
  rpcUrl: process.env.RPC_URL || "",
  privateKey: process.env.PRIVATE_KEY || "",
  vrfContractAddress: process.env.VRF_CONTRACT || "",
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    viction: {
      url: vrfConfig.rpcUrl,
      accounts: [vrfConfig.privateKey],
    },
    hardhat: {
      accounts: [
        {
          privateKey: vrfConfig.privateKey,
          balance: "100000000000000000000000", // 1000 ETH
        },
        ...Array.from({ length: 19 }).map(() => ({
          privateKey:
            "0x" +
            Array.from({ length: 64 })
              .map(() => Math.floor(Math.random() * 16).toString(16))
              .join(""),
          balance: "1000000000000000000000",
        })),
      ],
      allowUnlimitedContractSize: true,
      mining: {
        auto: true,
        interval: 2000,
      },
    },
  },
  paths: {
    artifacts: "./artifacts",
    sources: "./contracts",
    tests: "./tests",
  },
  mocha: {
    timeout: 6000000,
  },
};

export default config;
