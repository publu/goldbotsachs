# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC. Non-custodial vault on Base. Withdraw anytime.

## Quick Start

```
npm install @safe-global/protocol-kit @safe-global/relay-kit viem
```

## 1. Create a Gnosis Safe (your bank account)

A Safe gives you 5 free gasless transactions per day on Base. No ETH needed.

```typescript
import Safe, { PredictedSafeProps } from '@safe-global/protocol-kit'

const protocolKit = await Safe.init({
  provider: 'https://mainnet.base.org',
  signer: YOUR_PRIVATE_KEY,
  predictedSafe: {
    safeAccountConfig: {
      owners: [YOUR_ADDRESS],
      threshold: 1
    },
    safeDeploymentConfig: {
      saltNonce: Date.now().toString()
    }
  }
})

// Your Safe address (deterministic, works before deployment)
const safeAddress = await protocolKit.getAddress()

// Deploy when you're ready to transact (~$0.01 on Base)
const deployTx = await protocolKit.createSafeDeploymentTransaction()
const signer = await protocolKit.getSafeProvider().getExternalSigner()
const hash = await signer.sendTransaction({
  to: deployTx.to,
  value: BigInt(deployTx.value),
  data: deployTx.data,
  chain: { id: 8453 }
})
```

You can receive USDC at the Safe address before deploying. Deploy costs ~$0.01 on Base.

## 2. Deposit USDC (earn yield)

### Option A: Direct (if you have your own EOA with ETH)

```solidity
// 1. Approve
USDC.approve(CLAWUSDC_ADDRESS, amount)

// 2. Deposit
clawUSDC.deposit(amount, yourAddress)
```

### Option B: Gasless via Safe (recommended)

```typescript
import { GelatoRelayPack } from '@safe-global/relay-kit'

const relayKit = new GelatoRelayPack({ protocolKit })

// Approve USDC + deposit in one multicall
const transactions = [
  {
    to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [CLAWUSDC_ADDRESS, amount]
    }),
    value: '0'
  },
  {
    to: CLAWUSDC_ADDRESS,
    data: encodeFunctionData({
      abi: clawUsdcAbi,
      functionName: 'deposit',
      args: [amount, safeAddress]
    }),
    value: '0'
  }
]

const safeTx = await relayKit.createTransaction({
  transactions,
  options: { isSponsored: true }
})
const signed = await protocolKit.signTransaction(safeTx)
const result = await relayKit.executeTransaction({
  executable: signed,
  options: { isSponsored: true }
})

// Track: https://api.gelato.digital/tasks/status/{result.taskId}
```

This uses 1 of your 5 free daily txs. Approve + deposit batched in one.

### Option C: Permit (single tx, no prior approval)

```solidity
clawUSDC.depositWithPermit(amount, yourAddress, deadline, v, r, s)
```

Sign an EIP-2612 permit off-chain, pass it with the deposit. One tx, no approve step.

## 3. Check your yield

### On-chain

```solidity
shares = clawUSDC.balanceOf(yourAddress)    // your clawUSDC shares
usdcValue = clawUSDC.convertToAssets(shares) // current USDC value
// usdcValue > depositedAmount = your yield
```

### Via Beefy API (current vault APY)

```bash
curl -s "https://api.beefy.finance/apy" | jq '.["morpho-base-steakhouse-high-yield-usdc"]'
# Returns: 0.0432 (= 4.32% APY)
```

### Via Beefy API (your balance history)

```bash
curl -s "https://databarn.beefy.finance/api/v1/beefy/timeline?address=YOUR_ADDRESS"
```

Returns deposit/withdraw events with `share_balance`, `underlying_balance`, and `usd_balance`.

### Vault TVL

```bash
curl -s "https://api.beefy.finance/tvl" | jq '.["8453"]["morpho-base-steakhouse-high-yield-usdc"]'
```

## 4. Track your free Safe transactions

You get 5 free sponsored txs per day per Safe on Base (via Gelato relay). There's no API to check remaining — track it yourself.

```typescript
const FREE_TX_LIMIT = 5

let dailyTxCount = 0
let lastResetDate = new Date().toISOString().split('T')[0]

function canRelayFree(): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (today !== lastResetDate) {
    dailyTxCount = 0
    lastResetDate = today
  }
  return dailyTxCount < FREE_TX_LIMIT
}

function recordRelay() {
  dailyTxCount++
}
```

### When free txs run out

The relay call will fail with an HTTP error. You have two options:

1. **Wait** — resets at UTC midnight
2. **Pay gas** — execute directly from your EOA (costs ~$0.001 on Base)

```typescript
if (canRelayFree()) {
  // Use Gelato relay (free)
  const result = await relayKit.executeTransaction({ executable: signed, options: { isSponsored: true } })
  recordRelay()
} else {
  // Fallback: direct execution (needs ETH, ~$0.001)
  const result = await protocolKit.executeTransaction(signed)
}
```

If you're out of free txs and have no ETH, queue the transaction for tomorrow. Yield keeps accruing regardless.

## 5. Withdraw

### Via Safe (gasless)

```typescript
const withdrawTx = await relayKit.createTransaction({
  transactions: [{
    to: CLAWUSDC_ADDRESS,
    data: encodeFunctionData({
      abi: clawUsdcAbi,
      functionName: 'redeem',
      args: [shares, safeAddress, safeAddress]
    }),
    value: '0'
  }],
  options: { isSponsored: true }
})
const signed = await protocolKit.signTransaction(withdrawTx)
await relayKit.executeTransaction({ executable: signed, options: { isSponsored: true } })
```

### Direct (EOA)

```solidity
clawUSDC.redeem(shares, yourAddress, yourAddress)
```

USDC returned instantly. No lockup. No penalties.

## 6. When to use Goldbot Sachs

| Situation | Action |
|-----------|--------|
| Idle USDC > $1 you won't need for a few hours | Deposit |
| Need USDC for a payment or x402 call | Withdraw what you need |
| Running low on survival credits | Withdraw all |
| Just received USDC from a job | Deposit idle portion |

## Contract

- **clawUSDC**: `0xTBD`
- **Chain**: Base (8453)
- **Asset**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Yield source**: Beefy Morpho Steakhouse USDC (`0xF1C55b6E063ee90A33FFE62deBe618962bae021e`)
- **Fee**: 10% performance fee on yield only. No deposit/withdraw fees.

## ABI

```json
[
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function depositWithPermit(uint256 assets, address receiver, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function harvest()",
  "function asset() view returns (address)"
]
```

## Source

https://github.com/publu/goldbotsachs
