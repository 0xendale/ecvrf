import { Address } from "viem";

export type VRFProof = {
  pk: [bigint, bigint];
  gamma: [bigint, bigint];
  c: bigint;
  s: bigint;
  seed: bigint;
  uWitness: Address;
  cGammaWitness: [bigint, bigint];
  sHashWitness: [bigint, bigint];
  zInv: bigint;
};

export type VRFKeyProof = {
  publicKey: [bigint, bigint];
  gamma: [bigint, bigint];
  c: bigint;
  s: bigint;
  seed: bigint;
  output: bigint;
};
