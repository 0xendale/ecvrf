import { encodePacked, keccak256 } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { toBytes } from "viem";

// secp256k1 prime field
export const FIELD_SIZE = BigInt(
  "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"
);

const B = BigInt(7);
const HASH_TO_CURVE_HASH_PREFIX = BigInt(1);
const SCALAR_FROM_CURVE_POINTS_HASH_PREFIX = BigInt(2);

// Modular reduction (always positive)
export const mod = (x: bigint, m: bigint = FIELD_SIZE): bigint =>
  ((x % m) + m) % m;

// Modular negation: -x mod m
export const neg = (x: bigint, m: bigint = FIELD_SIZE): bigint => mod(-x, m);

// Modular addition: (a + b) mod m
export const add = (a: bigint, b: bigint, m: bigint = FIELD_SIZE): bigint =>
  mod(a + b, m);

// Modular subtraction: (a - b) mod m
export const sub = (a: bigint, b: bigint, m: bigint = FIELD_SIZE): bigint =>
  mod(a - b, m);

// Modular multiplication: (a * b) mod m
export const mul = (a: bigint, b: bigint, m: bigint = FIELD_SIZE): bigint =>
  mod(a * b, m);

const SQRT_POWER = (FIELD_SIZE + 1n) >> 2n; // same as (FIELD_SIZE + 1n) / 4n

// Big modular exponentiation
export const _bigModExp = (
  base: bigint,
  exp: bigint,
  modp: bigint = FIELD_SIZE
): bigint => {
  let result = 1n;
  base = base % modp;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % modp;
    }
    base = (base * base) % modp;
    exp = exp >> 1n;
  }
  return result;
};

// Compute y² = x³ + 7 mod p
function ySquared(x: bigint): bigint {
  return mod(x ** BigInt(3) + B, FIELD_SIZE);
}

export function modInv(a: bigint): bigint {
  if (a === 0n) throw new Error("Cannot inverse 0");
  return modPow(a, FIELD_SIZE - 2n, FIELD_SIZE);
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  base = base % modulus;
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) result = (result * base) % modulus;
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}
// Check if point is on curve
export function isOnCurve([x, y]: [bigint, bigint]): boolean {
  return mod(y ** BigInt(2) - (x ** BigInt(3) + B), FIELD_SIZE) === BigInt(0);
}

// Same as _squareRoot in Solidity
export const squareRoot = (x: bigint): bigint => _bigModExp(x, SQRT_POWER);

export const fieldHash = (msg: Uint8Array): bigint => {
  let h = BigInt(keccak256(msg));
  while (h >= FIELD_SIZE) {
    h = BigInt(keccak256(toBytes(h)));
  }
  return h;
};

export function projectiveSub(
  x1: bigint,
  z1: bigint,
  x2: bigint,
  z2: bigint
): [bigint, bigint] {
  const num1 = mul(x1, z2);
  const num2 = neg(mul(z1, x2));

  return [mod(add(num1, num2), FIELD_SIZE), mod(mul(z1, z2), FIELD_SIZE)];
}

export function projectiveMul(
  x1: bigint,
  z1: bigint,
  x2: bigint,
  z2: bigint
): [bigint, bigint] {
  return [mul(x1, x2), mul(z1, z2)];
}

// ProjectiveECAdd(px, py, qx, qy) duplicates the calculation in projective
// coordinates of VRF.sol#projectiveECAdd, so we can reliably get the
// denominator (i.e, z)
export function projectiveECAdd(
  p: InstanceType<typeof secp256k1.ProjectivePoint>,
  q: InstanceType<typeof secp256k1.ProjectivePoint>
): [bigint, bigint, bigint] {
  const [px, py] = [p.x, p.y];
  const [qx, qy] = [q.x, q.y];
  const [pz, qz] = [1n, 1n];

  const lx = sub(qy, py);
  const lz = sub(qx, px);

  let [sx, dx] = projectiveMul(lx, lz, lx, lz);
  [sx, dx] = projectiveSub(sx, dx, px, pz);
  [sx, dx] = projectiveSub(sx, dx, qx, qz);

  let [sy, dy] = projectiveSub(px, pz, sx, dx);
  [sy, dy] = projectiveMul(sy, dy, lx, lz);
  [sy, dy] = projectiveSub(sy, dy, py, pz);

  let sz: bigint;
  if (dx != dy) {
    sx = mul(sx, dy);
    sy = mul(sy, dx);
    sz = mul(dx, dy);
  } else {
    sz = dx;
  }

  return [mod(sx, FIELD_SIZE), mod(sy, FIELD_SIZE), mod(sz, FIELD_SIZE)];
}

export function linearCombination(c: bigint, p1: any, s: bigint, p2: any): any {
  const cp1 = p1.multiply(c);
  const sp2 = p2.multiply(s);
  return cp1.add(sp2);
}

export function checkCGammaNotEqualToSHash(
  c: bigint,
  gamma: any,
  s: bigint,
  hash: any
): boolean {
  const cGamma = gamma.multiply(c);
  const sHash = hash.multiply(s);
  return !cGamma.equals(sHash);
}

/**
 * @notice Calculate ethereum address from a point with type secp256k1.ProjectivePoint
 * @param point secp256k1.ProjectivePoint
 * @returns [20]bytes
 */
export function computeEthereumAddressBuffer(
  point: InstanceType<typeof secp256k1.ProjectivePoint>
): Uint8Array {
  const affine = point.toAffine();

  // Encode X & Y with Big-endian 32 bytes each path
  const xBytes = affine.x
    .toString(16)
    .padStart(64, "0")
    .match(/.{2}/g)!
    .map((b) => parseInt(b, 16));
  const yBytes = affine.y
    .toString(16)
    .padStart(64, "0")
    .match(/.{2}/g)!
    .map((b) => parseInt(b, 16));

  const pubkeyBytes = new Uint8Array([...xBytes, ...yBytes]); // LongMarshal
  const hashed = keccak256(pubkeyBytes); // 0x-prefixed hex string

  const addressHex = hashed.slice(-40);
  const addressBytes = new Uint8Array(
    addressHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );

  return addressBytes;
}

export function computeEthereumAddressString(
  point: InstanceType<typeof secp256k1.ProjectivePoint>
): `0x${string}` {
  const affine = point.toAffine();
  const xHex = affine.x.toString(16).padStart(64, "0");
  const yHex = affine.y.toString(16).padStart(64, "0");
  const pubKey = `0x${xHex}${yHex}`;
  const hash = keccak256(pubKey as `0x${string}`);
  return `0x${hash.slice(-40)}` as `0x${string}`;
}

// Generate a candidate point from bytes
export function newCandidateSecp256k1Point(b: Uint8Array): [bigint, bigint] {
  const p0 = fieldHash(b);
  let p1 = squareRoot(ySquared(p0));
  if (p1 % 2n == 1n) {
    p1 = FIELD_SIZE - p1;
  }
  return [p0, p1];
}

export function hashToCurve(
  pubKey: InstanceType<typeof secp256k1.ProjectivePoint>,
  seed: bigint
): [bigint, bigint] {
  const solidityBytes = encodePacked(
    ["uint256", "uint256[2]", "uint256"],
    [
      HASH_TO_CURVE_HASH_PREFIX,
      [pubKey.toAffine().x, pubKey.toAffine().y],
      seed,
    ]
  );
  let rv = newCandidateSecp256k1Point(toBytes(solidityBytes));
  while (!isOnCurve(rv)) {
    const tryHash = encodePacked(["uint256"], [rv[0]]);
    rv = newCandidateSecp256k1Point(toBytes(tryHash));
  }
  return rv;
}

/**
 * Computes scalar challenge `c` = Hash(hash, pk, gamma, v, uWitness)
 */
export function scalarFromCurvePoints(
  hash: InstanceType<typeof secp256k1.ProjectivePoint>,
  pk: InstanceType<typeof secp256k1.ProjectivePoint>,
  gamma: InstanceType<typeof secp256k1.ProjectivePoint>,
  uWitness: `0x${string}`, // 20 bytes
  v: InstanceType<typeof secp256k1.ProjectivePoint>
): bigint {
  const message = encodePacked(
    [
      "uint256",
      "uint256[2]",
      "uint256[2]",
      "uint256[2]",
      "uint256[2]",
      "address",
    ],
    [
      SCALAR_FROM_CURVE_POINTS_HASH_PREFIX,
      [hash.toAffine().x, hash.toAffine().y],
      [pk.toAffine().x, pk.toAffine().y],
      [gamma.toAffine().x, gamma.toAffine().y],
      [v.toAffine().x, v.toAffine().y],
      uWitness,
    ]
  );

  return BigInt(keccak256(message)) % secp256k1.CURVE.n;
}
