import { VRFConsumerService } from "@integration-services";

export async function requestRandomWords(dappContract: VRFConsumerService) {
  const currentState = await dappContract.getContractState();
  console.log("🔧 Consumer state :", currentState);

  console.log("dappContract", dappContract);
  const request = await dappContract.requestRandomWords();
  console.log("request:", request);
}
