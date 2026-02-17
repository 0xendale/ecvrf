import { keccak256, Account, toBytes, Hex } from "viem";
import { secp256k1 as secp, secp256k1 } from "@noble/curves/secp256k1";
import { randomBytes } from "crypto";
import { VRFKeyProof, VRFProof } from "@integration-services/types/VRF";
import { privateKeyToAccount } from "viem/accounts";
import { computeFinalSeed, PreSeedData } from "@utils/seed";
import { generateSolidityProof, SolidityProof } from "./solidityProof";
import {
  computeEthereumAddressString,
  hashToCurve,
  mod,
  scalarFromCurvePoints,
} from "./crypto";

export class VRFKey {
  public account: Account;
  private readonly privKey: bigint;
  public readonly pubKey: InstanceType<typeof secp.ProjectivePoint>;

  constructor(privateKeyHex: string) {
    // Step 0: Initialize the VRFKey with a private key.
    // We derive the public key (P = privKey * G) using secp.
    this.privKey = BigInt(privateKeyHex);
    this.account = privateKeyToAccount(privateKeyHex as `0x${string}`);
    this.pubKey = secp.ProjectivePoint.BASE.multiply(this.privKey);
  }

  // hashToCurveHashPrefix is domain-separation tag for initial HashToCurve hash.
  // Corresponds to HASH_TO_CURVE_HASH_PREFIX in VRF.sol.
  private hashToCurveHashPrefix = toBytes(1n, { size: 32 });
  // scalarFromCurveHashPrefix is a domain-separation tag for the hash taken in
  // ScalarFromCurve. Corresponds to SCALAR_FROM_CURVE_POINTS_HASH_PREFIX in
  // VRF.sol.
  private scalarFromCurveHashPrefix = toBytes(2n, { size: 32 });
  private RandomOutputHashPrefix: Uint8Array = toBytes(3n, { size: 32 });

  private checkCGammaNotEqualToSHash(
    c: bigint,
    gamma: InstanceType<typeof secp.ProjectivePoint>,
    s: bigint,
    hash: InstanceType<typeof secp.ProjectivePoint>
  ) {
    const cGamma = gamma.multiply(c);
    const sHash = hash.multiply(s);
    if (cGamma.equals(sHash)) {
      return false;
    }
    return true;
  }

  public computeZInv(gamma: InstanceType<typeof secp.ProjectivePoint>): bigint {
    const gammaBytes = gamma.toRawBytes(false); // uncompressed
    const hashInput = new Uint8Array([
      ...this.RandomOutputHashPrefix,
      ...gammaBytes,
    ]);
    const hash = keccak256(hashInput);
    return BigInt(hash); // zInv: bigint
  }

  // Returns true if point (x, y) lies on secp256k1 curve: y² = x³ + 7
  public validPublicKey(x: bigint, y: bigint): boolean {
    try {
      const { Fp } = secp.CURVE;

      const rhs = Fp.add(Fp.pow(x, 3n), 7n); // x³ + 7
      const maybeY = Fp.sqrt(rhs); // y = sqrt(x³ + 7)

      if (maybeY === undefined) return false; // no square root means not on curve

      // y == maybeY || y == -maybeY
      return y === maybeY || y === Fp.neg(maybeY);
    } catch {
      return false;
    }
  }

  public isValidProjectivePoint(
    point: InstanceType<typeof secp.ProjectivePoint>
  ): boolean {
    const affine = point.toAffine();
    return this.validPublicKey(affine.x, affine.y);
  }

  /**
   * Returns the public key as a tuple [x, y].
   * This is the affine representation of the public key point.
   */
  public getPublicKeyTuple(): [bigint, bigint] {
    const affine = this.pubKey.toAffine();
    return [affine.x, affine.y];
  }

  public computeEthereumAddress(
    point: InstanceType<typeof secp.ProjectivePoint>
  ): `0x${string}` {
    const affine = point.toAffine();
    const xHex = affine.x.toString(16).padStart(64, "0");
    const yHex = affine.y.toString(16).padStart(64, "0");
    const pubKey = `0x${xHex}${yHex}`;
    const hash = keccak256(pubKey as `0x${string}`);
    return `0x${hash.slice(-40)}` as `0x${string}`;
  }

  /**
   * Computes Ethereum address from a linear combination: address(c*pk + s*G)
   * This address is used as a commitment witness (uWitness) in the VRF proof.
   */
  public computeLinearCombinationAddress(
    c: bigint,
    pk: [bigint, bigint],
    s: bigint
  ): `0x${string}` {
    const G = secp.ProjectivePoint.BASE;
    const P = secp.ProjectivePoint.fromAffine({
      x: pk[0],
      y: pk[1],
    });

    // R = c*P + s*G
    const R = P.multiply(c).add(G.multiply(s)).toAffine();

    // Serialize R as uncompressed public key (0x04 || x || y)
    const pubKeyBytes = new Uint8Array([
      0x04,
      ...R.x
        .toString(16)
        .padStart(64, "0")
        .match(/.{2}/g)!
        .map((b) => parseInt(b, 16)),
      ...R.y
        .toString(16)
        .padStart(64, "0")
        .match(/.{2}/g)!
        .map((b) => parseInt(b, 16)),
    ]);

    // keccak256(R) → take last 20 bytes as Ethereum address
    return `0x${keccak256(pubKeyBytes).slice(-40)}`;
  }

  public generateProofWithNonce(seed: bigint, nonce: bigint): VRFKeyProof {
    const G = secp.ProjectivePoint.BASE;
    const n = secp.CURVE.n;

    const valid = this.isValidProjectivePoint(this.pubKey); // Ensure pubKey is valid on secp256k1 curve
    if (!valid) {
      throw new Error("Invalid public key generated from private key");
    }

    const hash = hashToCurve(this.pubKey, seed);
    const H = secp256k1.ProjectivePoint.fromAffine({
      x: hash[0],
      y: hash[1],
    });

    // 4. gamma = privKey * H
    const gamma = H.multiply(this.privKey);

    // u = k * G
    const u = G.multiply(nonce);

    // 7. Compute k·G
    const uComputed = computeEthereumAddressString(u);

    // v = k * H
    const v = H.multiply(nonce);

    // 8. c = hash(H, pubKey, gamma, u, v)
    const c = scalarFromCurvePoints(H, this.pubKey, gamma, uComputed, v);
    // 9. s = (k - c * privKey) mod n
    const s = mod(nonce - c * this.privKey, n);

    const output = this.computeZInv(
      secp.ProjectivePoint.fromAffine({
        x: v.x,
        y: v.y,
      })
    );

    if (this.checkCGammaNotEqualToSHash(c, gamma, s, H) === false) {
      throw new Error("c*gamma == s*hash");
    }

    return {
      publicKey: [this.pubKey.toAffine().x, this.pubKey.toAffine().y],
      gamma: [gamma.toAffine().x, gamma.toAffine().y],
      c,
      s,
      seed,
      output,
    };
  }

  /**
   * Generates a VRF proof from a given preSeed.
   * This follows the ECVRF steps using secp256k1 and matches the IETF draft:
   *
   * Step 1: H = HashToCurve(seed) → simplified as keccak(seed)
   * Step 2: gamma = privKey * H
   * Step 3: Choose random nonce k, then compute:
   *         u = k*G, v = k*H, cGamma = k*gamma
   * Step 4: c = Hash(H, pubKey, gamma, u, v)
   * Step 5: s = (k - c*privKey) mod n
   * Step 6: uWitness = address(c*pk + s*G)
   */

  public generateProof(
    preSeed: bigint,
    blockhash: Hex,
    nonce?: bigint
  ): VRFProof {
    // Step 3: Random nonce k
    const k =
      nonce ?? BigInt("0x" + randomBytes(32).toString("hex")) % secp.CURVE.n;

    const preSeedData: PreSeedData = {
      preSeed: toBytes(preSeed),
      blockHash: blockhash,
    };

    const actualSeed = computeFinalSeed.v1(preSeedData);
    const proof = this.generateProofWithNonce(actualSeed, k);

    const solidityProof: SolidityProof = generateSolidityProof(
      proof,
      actualSeed
    );

    return {
      pk: proof.publicKey,
      gamma: proof.gamma,
      c: proof.c,
      s: proof.s,
      seed: preSeed,
      uWitness: solidityProof.uWitness,
      cGammaWitness: [
        solidityProof.cGammaWitness[0],
        solidityProof.cGammaWitness[1],
      ],
      sHashWitness: [
        solidityProof.sHashWitness[0],
        solidityProof.sHashWitness[1],
      ],
      zInv: solidityProof.zInv, // Placeholder (zInv only needed for optimization on-chain)
    };
  }
}
