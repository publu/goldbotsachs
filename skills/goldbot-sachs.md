# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC. Deposit into Beefy's Morpho vault on Base. Withdraw anytime.

## Addresses

- **Beefy Vault**: `0xF1C55b6E063ee90A33FFE62deBe618962bae021e`
- **USDC (Base)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
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
const BEEFY_VAULT = '0xF1C55b6E063ee90A33FFE62deBe618962bae021e'

const account = privateKeyToAccount(YOUR_PRIVATE_KEY)
const walletClient = createWalletClient({ account, chain: base, transport: http() })

const amount = parseUnits('100', 6) // 100 USDC

// 1. Approve
await walletClient.writeContract({
  address: USDC,
  abi: [{ type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
  functionName: 'approve',
  args: [BEEFY_VAULT, amount]
})

// 2. Deposit
await walletClient.writeContract({
  address: BEEFY_VAULT,
  abi: [{ type: 'function', name: 'deposit', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
  functionName: 'deposit',
  args: [amount]
})
```

## Check your balance & yield

```typescript
const publicClient = createPublicClient({ chain: base, transport: http() })

const shares = await publicClient.readContract({
  address: BEEFY_VAULT,
  abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'balanceOf',
  args: [YOUR_ADDRESS]
})

const pricePerShare = await publicClient.readContract({
  address: BEEFY_VAULT,
  abi: [{ type: 'function', name: 'getPricePerFullShare', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'getPricePerFullShare'
})

// USDC value = shares * pricePerShare / 1e18
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
await walletClient.writeContract({
  address: BEEFY_VAULT,
  abi: [{ type: 'function', name: 'withdraw', inputs: [{ name: '_shares', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
  functionName: 'withdraw',
  args: [shares] // pass your mooToken balance to withdraw everything
})
```

USDC returned instantly. No lockup. No penalties.

## Refuel — Gasless ETH via CoW Protocol

When your wallet has **zero ETH** but holds USDC, use CoW Protocol to swap USDC→native ETH without needing gas upfront. The swap is intent-based: you sign a message (free), and CoW solvers execute the trade on your behalf, deducting fees from the sold USDC.

**USDC Allowance required:** The wallet must have approved the CoW Vault Relayer (`0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`) to spend USDC, or use Permit2.

```typescript
import { createPublicClient, http } from 'viem'
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
const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

const account = privateKeyToAccount(YOUR_PRIVATE_KEY)
const publicClient = createPublicClient({ chain: base, transport: http() })

// 1. Wire up the viem adapter
const adapter = new ViemAdapter({ provider: publicClient, signer: account })
setGlobalAdapter(adapter)

// 2. Initialize the Trading SDK
const sdk = new TradingSdk({
  chainId: SupportedChainId.BASE,
  signer: account,
  appCode: 'GoldbotSachs-Refuel'
})

// 3. Get a quote for 1 USDC → native ETH
const quoteAndPost = await sdk.getQuote({
  kind: OrderKind.SELL,
  sellToken: USDC,
  buyToken: NATIVE_ETH,
  amount: (1 * 10 ** 6).toString(), // 1 USDC
  sellTokenDecimals: 6,
  buyTokenDecimals: 18,
  owner: account.address,
  receiver: account.address,
  slippageBps: 100, // 1%
})

// 4. Post the signed intent — solvers handle execution
const orderId = await quoteAndPost.postSwapOrderFromQuote()
console.log('Order:', orderId)
console.log('Track: https://explorer.cow.fi/base/orders/' + orderId)
```

**Why CoW Protocol:**
- **Gasless** — fees come from the sold USDC; wallet pays 0 ETH
- **MEV-protected** — intent-based swaps can't be front-run
- **Native ETH** — the `0xeee…e` marker delivers spendable ETH, not WETH

## When to use

| Situation | Action |
|-----------|--------|
| Idle USDC > $1 | Deposit |
| Need USDC for a payment or x402 call | Withdraw what you need |
| Running low on funds | Withdraw all |
| Just received USDC from a job | Deposit idle portion |
| Wallet has USDC but zero ETH for gas | Refuel via CoW swap |

## Source

https://github.com/publu/goldbotsachs
