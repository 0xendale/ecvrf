import { Address, encodeAbiParameters, hexToBytes } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
/**
 * Generate keyHash (bytes32) from uncompressed public key point [x, y]
 * @param publicKey - Tuple of public key (x, y) as bigint
 * @returns keyHash (bytes32)
 */
export function generateKeyHash([x, y]: [bigint, bigint]): `0x${string}` {
  return keccak256(encodePacked(["uint256", "uint256"], [x, y]));
}

/**
 * Parses an uncompressed public key (hex string) into [x, y] coordinates as BigInt.
 * Supports optional strict validation using secp256k1 curve check.
 *
 * @param uncompressedPubKey - Public key as hex string (e.g., "0x04...")
 * @param strictMode - If true, validates the key is on the curve using noble-secp256k1
 * @returns [x, y] BigInt tuple representing the public key coordinates
 */
export function parsePublicKeyXY(
  uncompressedPubKey: string,
  strictMode: boolean = false
): [bigint, bigint] {
  let cleanKey = uncompressedPubKey;

  // Ensure it starts with "04" for uncompressed format
  if (cleanKey.startsWith("0x")) {
    cleanKey = cleanKey.slice(2);
  }
  if (!cleanKey.startsWith("04")) {
    cleanKey = "04" + cleanKey;
  }

  const pubKeyBytes = hexToBytes(`0x${cleanKey}`);

  if (strictMode) {
    const pubKey = secp256k1.ProjectivePoint.fromHex(pubKeyBytes);
    return [pubKey.x, pubKey.y];
  } else {
    // Manual split: 0x04 + 32 bytes X + 32 bytes Y
    const xBytes = pubKeyBytes.slice(1, 33);
    const yBytes = pubKeyBytes.slice(33, 65);
    const x = BigInt(`0x${Buffer.from(xBytes).toString("hex")}`);
    const y = BigInt(`0x${Buffer.from(yBytes).toString("hex")}`);
    return [x, y];
  }
}

/**
 * Derive public key from a private key
 * @param privateKey - hex string without 0x prefix
 * @returns public key [x, y] as bigint tuple
 */
export function getPublicKeyXYFromPrivateKey(
  privateKey: string
): [bigint, bigint] {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const pubKey = account.publicKey; // 130-char hex string with 0x04 prefix (uncompressed)

  const x = BigInt(`0x${pubKey.slice(4, 68)}`);
  const y = BigInt(`0x${pubKey.slice(68)}`);

  return [x, y];
}

export async function computeRequestId(
  keyHash: `0x${string}`,
  sender: Address,
  nonce: bigint
): Promise<[any, any]> {
  const preSeed = BigInt(
    keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32", name: "keyHash" },
          { type: "address", name: "sender" },
          { type: "uint64", name: "nonce" },
        ],
        [keyHash, sender, nonce]
      )
    )
  );

  return [
    BigInt(
      keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32", name: "keyHash" },
            { type: "uint256", name: "preSeed" },
          ],
          [keyHash, preSeed]
        )
      )
    ),
    preSeed,
  ];
}
