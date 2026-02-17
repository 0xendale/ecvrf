import { decodeEventLog, Log, parseAbi } from "viem";

export function decodeRandomeseEvent(logs: Log) {
  const decoded = decodeEventLog({
    abi: parseAbi([
      "event RandomWordsRequested(bytes32 indexed keyHash, uint64 blockNum, uint256 requestId, uint256 preSeed, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)",
    ]),
    data: logs.data,
    topics: logs.topics,
  });

  const {
    keyHash,
    blockNum,
    requestId,
    preSeed,
    minimumRequestConfirmations,
    callbackGasLimit,
    numWords,
    sender,
  } = decoded.args;

  return {
    keyHash,
    blockNum: Number(blockNum),
    requestId: BigInt(requestId),
    preSeed: BigInt(preSeed),
    minimumRequestConfirmations: Number(minimumRequestConfirmations),
    callbackGasLimit: Number(callbackGasLimit),
    numWords: Number(numWords),
    sender,
  };
}

export function randomWordsFulfilled(logs: Log) {
  const decoded = decodeEventLog({
    abi: parseAbi([
      "event RandomWordsFulfilled(uint256 requestId,uint256 randomness,uint256 vrfRequestCounter,uint256 vrfResponseCounter)",
    ]),
    data: logs.data,
    topics: logs.topics,
  });

  const {
    requestId,
    randomness: outputSeed,
    vrfRequestCounter,
    vrfResponseCounter,
  } = decoded.args;

  return {
    requestId: BigInt(requestId),
    randomness: BigInt(outputSeed),
    vrfRequestCounter: BigInt(vrfRequestCounter),
    vrfResponseCounter: BigInt(vrfResponseCounter),
  };
}
