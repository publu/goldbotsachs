# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC. Deposit into Beefy's Morpho vault on Base. Withdraw anytime.

## Addresses

- **Beefy Vault**: `0xF1C55b6E063ee90A33FFE62deBe618962bae021e`
- **USDC (Base)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Chain**: Base (8453)

## Setup

```bash
mkdir -p /tmp/goldbot-sachs && cd /tmp/goldbot-sachs
npm init -y && npm install viem
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

## When to use

| Situation | Action |
|-----------|--------|
| Idle USDC > $1 | Deposit |
| Need USDC for a payment or x402 call | Withdraw what you need |
| Running low on funds | Withdraw all |
| Just received USDC from a job | Deposit idle portion |

## Source

https://github.com/publu/goldbotsachs
