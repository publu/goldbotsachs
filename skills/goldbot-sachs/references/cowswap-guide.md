# CoW Swap Refueling Guide

When your wallet has zero ETH but holds USDC, CoW Protocol enables gasless swaps to acquire ETH.

## How It Works

CoW Swap uses an **intent-based** model:
1. You sign an order to sell USDC at a target price
2. Solvers compete to fill your order
3. Fees are deducted from the output (ETH) — you pay 0 gas

A USDC EIP-2612 permit is attached as a **pre-hook** so no prior approval tx is needed either. The solver executes the permit before the swap.

## Requirements

- USDC balance > 0
- `@cowprotocol/cow-sdk` and `@cowprotocol/sdk-viem-adapter` installed
- Private key with USDC on Base

## The Flow (CoW SDK)

### 1. Check Allowance

If the wallet already has USDC allowance for the CoW Vault Relayer, no permit is needed:

```typescript
const allowance = await publicClient.readContract({
  address: USDC,
  abi: [{ type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'allowance',
  args: [account.address, COW_RELAYER]
})
```

### 2. Sign Permit (if needed)

If no allowance exists, sign an EIP-2612 permit off-chain (free, no gas):

```typescript
const permitSig = await walletClient.signTypedData({
  domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC },
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  },
  primaryType: 'Permit',
  message: { owner: account.address, spender: COW_RELAYER, value: permitValue, nonce, deadline }
})
```

The permit signature is encoded as calldata and attached as a CoW pre-hook.

### 3. Initialize SDK

```typescript
import { setGlobalAdapter, SupportedChainId, TradingSdk, OrderKind } from '@cowprotocol/cow-sdk'
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter'

const adapter = new ViemAdapter({ provider: publicClient, signer: account })
setGlobalAdapter(adapter)

const sdk = new TradingSdk({
  chainId: SupportedChainId.BASE,
  signer: account,
  appCode: 'GoldbotSachs-Refuel'
})
```

### 4. Quote + Post Order

```typescript
const advancedSettings = permitHook ? {
  appData: { metadata: { hooks: { pre: [permitHook] } } }
} : undefined

const quoteAndPost = await sdk.getQuote({
  kind: OrderKind.SELL,
  sellToken: USDC,
  buyToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native ETH
  amount: sellAmount.toString(),
  sellTokenDecimals: 6,
  buyTokenDecimals: 18,
  owner: account.address,
  receiver: account.address,
  slippageBps: 100,
}, advancedSettings)

const orderId = await quoteAndPost.postSwapOrderFromQuote()
```

### 5. Track Order

```
https://explorer.cow.fi/base/orders/{orderId}
```

## Key Addresses

| Component | Address |
|-----------|---------|
| CoW Settlement | `0x9000000000000000000000000000000000000000` |
| CoW Vault Relayer | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Native ETH marker | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` |

## Properties

- **Zero gas required** — permit is an off-chain signature, solver pays gas
- **MEV-protected** — intent-based swaps can't be front-run
- **Native ETH** — the `0xeee…e` marker delivers spendable ETH, not WETH
- **Idempotent** — if the wallet already has allowance, the permit hook is skipped

## Tips

- Minimum order size: ~$1 equivalent
- Slippage tolerance: 100 bps (1%) default
- Order expiration: orders expire if not filled — costs nothing

## Troubleshooting

**"Insufficient allowance"**: The permit pre-hook should handle this automatically. If it still fails, check that the USDC contract on Base supports EIP-2612.

**"Invalid signature"**: Ensure the permit domain uses `name: 'USD Coin'`, `version: '2'`, `chainId: 8453`.

**"Order not found"**: Orders may take 1-5 minutes to settle. Check the explorer for status.
