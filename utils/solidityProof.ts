import { secp256k1 } from "@noble/curves/secp256k1";
import { VRFKeyProof } from "@integration-services/types/VRF";
import {
  computeEthereumAddressString,
  FIELD_SIZE,
  hashToCurve,
  modInv,
  projectiveECAdd,
} from "@utils/crypto";

export interface SolidityProof {
  proof: VRFKeyProof;
  uWitness: `0x${string}`; // 20-byte Ethereum address padded to 32 bytes
  cGammaWitness: [bigint, bigint];
  sHashWitness: [bigint, bigint];
  zInv: bigint;
}

export const generateSolidityProof = (
  proof: VRFKeyProof,
  seed: bigint
): SolidityProof => {
  const G = secp256k1.ProjectivePoint.BASE;
  const c = proof.c;
  const s = proof.s;

  const pk = secp256k1.ProjectivePoint.fromAffine({
    x: proof.publicKey[0],
    y: proof.publicKey[1],
  });
  const gamma = secp256k1.ProjectivePoint.fromAffine({
    x: proof.gamma[0],
    y: proof.gamma[1],
  });

  const hash = hashToCurve(pk, seed);
  const H = secp256k1.ProjectivePoint.fromAffine({
    x: hash[0],
    y: hash[1],
  });

  const u = pk.multiply(c).add(G.multiply(s));
  const uWitness = computeEthereumAddressString(u);
  const cGammaWitness = gamma.multiply(c);

  const sHashWitness = H.multiply(s);

  const [x, y, z] = projectiveECAdd(cGammaWitness, sHashWitness);
  const zInv = modInv(z);

  if ((z * zInv) % FIELD_SIZE !== 1n) {
    throw new Error(
      `Invalid zInv: ${zInv.toString(16)} is not inverse of ${z.toString(16)}`
    );
  }

  return {
    proof,
    uWitness,
    cGammaWitness: [cGammaWitness.toAffine().x, cGammaWitness.toAffine().y],
    sHashWitness: [sHashWitness.toAffine().x, sHashWitness.toAffine().y],
    zInv: zInv,
  };
};
