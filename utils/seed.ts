import { keccak256, hexToBytes, toBytes } from "viem";

export type Bytes32 = Uint8Array & { __type: "Bytes32" };
export type Seed = Uint8Array;
export type BlockHash = `0x${string}`;
export type Address = `0x${string}`;

export type PreSeedData = {
  preSeed: Seed;
  blockHash: BlockHash;
};

export type PreSeedDataV2 = PreSeedData & {
  callbackGasLimit: number;
  numWords: number;
  sender: Address;
};

export function bigToSeed(x: bigint): Seed {
  if (x < 0n || x >= 2n ** 256n) {
    throw new Error("Seed too big: exceeds 256-bit unsigned range");
  }

  const bytes = x
    .toString(16)
    .padStart(64, "0")
    .match(/.{2}/g)!
    .map((b) => parseInt(b, 16));
  return new Uint8Array(bytes) as Seed;
}

export function seedToBigInt(seed: Seed): bigint {
  return BigInt(`0x${Buffer.from(seed).toString("hex")}`);
}

function finalSeed(seed: Seed, blockHash: BlockHash): bigint {
  const blockHashBytes = hexToBytes(blockHash);
  const seedBytes = Uint8Array.from(seed);
  const combined = new Uint8Array([...seedBytes, ...blockHashBytes]);
  return BigInt(keccak256(combined));
}

export const computeFinalSeed = {
  v1: (s: PreSeedData): bigint => finalSeed(s.preSeed, s.blockHash),
  v2: (s: PreSeedDataV2): bigint => finalSeed(s.preSeed, s.blockHash),
};
