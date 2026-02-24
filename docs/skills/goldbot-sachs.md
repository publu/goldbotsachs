# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC. Deposit into clawUSDC on Base — an ERC-4626 vault that routes to Beefy's Morpho strategy. Withdraw anytime. No lockup.

## Addresses

- **clawUSDC Vault**: `0xb34Fff5efAb92BE9EA32Fa56C6de9a1C04A62B4d`
- **USDC (Base)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Beefy Vault (underlying)**: `0xF1C55b6E063ee90A33FFE62deBe618962bae021e`
- **Chain**: Base (8453)

## Setup

```bash
mkdir -p /tmp/goldbot-sachs && cd /tmp/goldbot-sachs
npm init -y && npm install viem @cowprotocol/cow-sdk @cowprotocol/sdk-viem-adapter
```

## Deposit USDC

```typescript
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const CLAW_USDC = '0xb34Fff5efAb92BE9EA32Fa56C6de9a1C04A62B4d'

const RPC = 'https://base-mainnet.public.blastapi.io' // public RPC — avoid default (rate-limited)

const account = privateKeyToAccount(YOUR_PRIVATE_KEY)
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) })

const amount = parseUnits('100', 6) // 100 USDC

// 1. Approve clawUSDC to spend USDC
await walletClient.writeContract({
  address: USDC,
  abi: [{ type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
  functionName: 'approve',
  args: [CLAW_USDC, amount]
})

// 2. Deposit (ERC-4626 standard)
await walletClient.writeContract({
  address: CLAW_USDC,
  abi: [{
    type: 'function', name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable'
  }],
  functionName: 'deposit',
  args: [amount, account.address]
})

// 3. Confirm — wait for receipt, then check shares
const publicClient = createPublicClient({ chain: base, transport: http(RPC) })
const shares = await publicClient.readContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'balanceOf',
  args: [account.address]
})
// shares > 0n means deposit succeeded
```

### Deposit with referral

To register a referrer on your first deposit, use the 3-argument `deposit`:

```typescript
const REFERRER = '0x...' // referrer address (set once, permanent)

await walletClient.writeContract({
  address: CLAW_USDC,
  abi: [{
    type: 'function', name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'referrer', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable'
  }],
  functionName: 'deposit',
  args: [amount, account.address, REFERRER]
})
```

## Check balance & yield

```typescript
const RPC = 'https://base-mainnet.public.blastapi.io'
const publicClient = createPublicClient({ chain: base, transport: http(RPC) })

// Shares held
const shares = await publicClient.readContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'balanceOf',
  args: [account.address]
})

// USDC value (increases over time as yield accrues)
const assets = await publicClient.readContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'convertToAssets', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'convertToAssets',
  args: [shares]
})
```

### Check referrer

```typescript
const referrer = await publicClient.readContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'referrerOf', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' }],
  functionName: 'referrerOf',
  args: [account.address]
})
```

### Via Beefy API

```bash
# Current APY
curl -s "https://api.beefy.finance/apy" | jq '.["morpho-base-steakhouse-high-yield-usdc"]'

# Vault TVL
curl -s "https://api.beefy.finance/tvl" | jq '.["8453"]["morpho-base-steakhouse-high-yield-usdc"]'
```

## Withdraw

```typescript
// Redeem all shares for USDC
await walletClient.writeContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'redeem', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }],
  functionName: 'redeem',
  args: [shares, account.address, account.address]
})
```

Instant. No lockup. No penalties.

## Claim referral yield

If other agents deposited with your address as referrer, you earn 5% of their yield. Claim it:

```typescript
// Check pending yield
const pending = await publicClient.readContract({
  address: CLAW_USDC,
  abi: [{ type: 'function', name: 'pendingYield', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'pendingYield',
  args: [account.address]
})

// Claim
if (pending > 0n) {
  await walletClient.writeContract({
    address: CLAW_USDC,
    abi: [{ type: 'function', name: 'claim', inputs: [], outputs: [], stateMutability: 'nonpayable' }],
    functionName: 'claim'
  })
}
```

## Refuel — Gasless ETH via CoW Protocol

When your wallet has **zero ETH** but holds USDC, use CoW Protocol to swap USDC→native ETH without needing gas. The entire flow is off-chain signatures — the solver pays gas and deducts fees from the sold USDC. A USDC EIP-2612 permit is attached as a pre-hook so no prior approval tx is needed either.

```typescript
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import {
  setGlobalAdapter,
  SupportedChainId,
  TradingSdk,
  OrderKind,
} from '@cowprotocol/cow-sdk'
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const COW_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

const RPC = 'https://base-mainnet.public.blastapi.io'

const account = privateKeyToAccount(YOUR_PRIVATE_KEY)
const publicClient = createPublicClient({ chain: base, transport: http(RPC) })
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) })

const sellAmount = BigInt(0.1 * 10 ** 6) // 0.1 USDC — plenty for thousands of Base txs

// 1. Check if we already have allowance — skip permit if so
const allowance = await publicClient.readContract({
  address: USDC,
  abi: [{ type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'allowance',
  args: [account.address, COW_RELAYER]
})

let permitHook = undefined
if (allowance < sellAmount) {
  // 2. Sign a USDC permit off-chain (free, no gas)
  const nonce = await publicClient.readContract({
    address: USDC,
    abi: [{ type: 'function', name: 'nonces', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'nonces',
    args: [account.address]
  })

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  const permitValue = 2n ** 256n - 1n // max approval

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

  const r = permitSig.slice(0, 66)
  const s = '0x' + permitSig.slice(66, 130)
  const v = parseInt(permitSig.slice(130, 132), 16)

  const permitCalldata = encodeFunctionData({
    abi: [{
      type: 'function', name: 'permit',
      inputs: [
        { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
        { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }
      ],
      outputs: [], stateMutability: 'nonpayable'
    }],
    functionName: 'permit',
    args: [account.address, COW_RELAYER, permitValue, deadline, v, r, s]
  })

  permitHook = { target: USDC, callData: permitCalldata, gasLimit: '80000' }
}

// 3. Wire up the viem adapter + SDK
const adapter = new ViemAdapter({ provider: publicClient, signer: account })
setGlobalAdapter(adapter)

const sdk = new TradingSdk({
  chainId: SupportedChainId.BASE,
  signer: account,
  appCode: 'GoldbotSachs-Refuel'
})

// 4. Get quote + post order (with permit pre-hook if needed)
const advancedSettings = permitHook ? {
  appData: { metadata: { hooks: { pre: [permitHook] } } }
} : undefined

const quoteAndPost = await sdk.getQuote({
  kind: OrderKind.SELL,
  sellToken: USDC,
  buyToken: NATIVE_ETH,
  amount: sellAmount.toString(),
  sellTokenDecimals: 6,
  buyTokenDecimals: 18,
  owner: account.address,
  receiver: account.address,
  slippageBps: 100,
}, advancedSettings)

const result = await quoteAndPost.postSwapOrderFromQuote()
const orderId = result.orderId
console.log('Order:', orderId)
console.log('Track: https://explorer.cow.fi/base/orders/' + orderId)
```

**Zero gas required.** The permit is an off-chain signature attached as a CoW pre-hook — the solver executes it before the swap. No approval tx, no ETH needed.

- **MEV-protected** — intent-based swaps can't be front-run
- **Native ETH** — the `0xeee…e` marker delivers spendable ETH, not WETH
- **Idempotent** — if the wallet already has allowance, the permit hook is skipped

## When to use

| Situation | Action |
|-----------|--------|
| Idle USDC > $1 | Deposit into clawUSDC |
| Need USDC for a payment or x402 call | Redeem shares |
| Running low on funds | Redeem all |
| Just received USDC from a job | Deposit idle portion |
| Wallet has USDC but zero ETH for gas | Refuel via CoW swap |
| Have pending referral yield | Claim |

## Source

- Contract: https://basescan.org/address/0xb34Fff5efAb92BE9EA32Fa56C6de9a1C04A62B4d
- GitHub: https://github.com/publu/goldbotsachs
