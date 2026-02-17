import {
  RequestCommitment,
  VRFCoordinatorService,
} from "@integration-services";
import { KeyStoreManager } from "@config/env";
import { decodeRandomeseEvent } from "tests/shared/decoder";

export const handleRandomnessRequest = async (
  args: any,
  contract: VRFCoordinatorService
) => {
  try {
    const vrfKey = KeyStoreManager();
    const {
      keyHash: decodedKeyHash,
      blockNum,
      requestId,
      preSeed,
      minimumRequestConfirmations,
      callbackGasLimit,
      numWords,
      sender,
    } = decodeRandomeseEvent(args);

    const block = await contract.client.public.getBlock({
      blockNumber: BigInt(blockNum),
    });

    // 2. Build request commitment
    const requestCommitment: RequestCommitment = {
      blockNum: BigInt(blockNum),
      callbackGasLimit,
      numWords,
      sender,
    };

    const proof = await vrfKey.generateProof(preSeed, block.hash);

    // 3. Send proof back to contract
    const receipt = await contract.fulfillRandomWords(proof, requestCommitment);
    console.log("✅ Proof sent to coordinator, receipt:", receipt);
  } catch (err) {
    console.error("❌ Error in handleRandomnessRequest:", err);
  }
};
