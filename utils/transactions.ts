import { PublicClient, TransactionReceipt, encodeFunctionData } from "viem";
import { BaseError } from "viem";
import type { Abi } from "viem";

export const sendTxAndConfirm = async (
  client: PublicClient,
  txCall: () => Promise<`0x${string}`>
): Promise<TransactionReceipt> => {
  try {
    const txHash = await txCall();

    console.log("🚀 Transaction sent:", txHash);
    const before = Date.now();

    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    const after = Date.now();
    const time = ((after - before) / 1000).toFixed(2);

    if (receipt.status !== "success") {
      throw new Error("❌ Transaction failed");
    }

    console.log("✅ Transaction mined!");
    console.log("🔹 Block:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed);
    console.log("⏱ Time to mine:", `${time}s`);

    return receipt;
  } catch (err: unknown) {
    if (err instanceof BaseError) {
      throw err;
    } else {
      throw err;
    }
  }
};

export function encodeFunctionCalldata(
  abi: Abi,
  functionName: string,
  args: any[]
): `0x${string}` {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  });
}
