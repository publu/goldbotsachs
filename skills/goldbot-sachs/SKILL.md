---
name: goldbot-sachs
description: Earn yield on idle USDC. Gasless USDC-to-ETH via CoW Swap, deploy a Gnosis Safe, and deposit into Beefy Morpho (~4% APY) on Base.
metadata: {"openclaw":{"emoji":"🏦","homepage":"https://github.com/publu/goldbotsachs","requires":{"bins":["node"],"env":["PRIVATE_KEY"]},"install":[{"id":"npm","kind":"node","packages":["viem","@safe-global/protocol-kit","@cowprotocol/cow-sdk","@cowprotocol/sdk-viem-adapter"],"label":"Install DeFi dependencies (npm)"}]}}
---

# Goldbot Sachs

Earn ~4% APY on idle USDC via Beefy Morpho vaults on Base. Start with just USDC — no ETH needed.

## Addresses (Base, chain ID 8453)

| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Beefy Morpho Steakhouse USDC | `0xF1C55b6E063ee90A33FFE62deBe618962bae021e` |
| CoW Relayer | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` |
| Native ETH (CoW sentinel) | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Always | EOA private key (hex, `0x` prefix) |
| `SAFE_ADDRESS` | After step 2 | Gnosis Safe address. Printed by the deploy step |
| `SELL_AMOUNT` | No | USDC to swap in raw units (default: `1000000` = 1 USDC) |

## Agent Workflow

Follow this sequence when starting from an EOA with USDC and no ETH:

```
1. Refuel ──────── Gasless USDC → ETH via CoW Swap (permit pre-hook)
                   Now the EOA has ETH for gas.

2. Deploy Safe ─── Use ETH to deploy a 1-of-1 Gnosis Safe.
                   Save the SAFE_ADDRESS.

3. Fund Safe ───── Transfer USDC from EOA to Safe (standard ERC-20 transfer).

4. Deposit ─────── Approve + deposit into Beefy Morpho via Safe.
                   EOA pays gas (~$0.001 on Base).

5. Check ──────── Read balances (ETH, USDC, vault shares). No gas needed.
```

To check current state at any point, read balances (step 5). To refuel again later, repeat step 1.

---

## Step 1: Refuel — Gasless USDC → ETH via CoW Swap

This is the most complex operation. An EIP-2612 permit is signed off-chain (free) and attached as a CoW pre-hook so no prior approval transaction is needed. If the wallet already has sufficient allowance, the permit is skipped.

**Non-obvious details an agent must know:**
- USDC on Base permit domain: `name: 'USD Coin'`, `version: '2'`, `chainId: 8453`
- The permit signature must be manually split into r/s/v and encoded as calldata
- **Requires `@cowprotocol/cow-sdk` v7+** — v5 has broken ESM exports and missing `_signTypedData` bridging
- `setGlobalAdapter` is re-exported from `@cowprotocol/cow-sdk` in v7 (in v5 it was only in `@cowprotocol/sdk-common`)
- Pre-hooks attach via `appData.metadata.hooks.pre` in advanced settings

```javascript
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { setGlobalAdapter, SupportedChainId, TradingSdk, OrderKind } from '@cowprotocol/cow-sdk'
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const COW_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const publicClient = createPublicClient({ chain: base, transport: http() })
const walletClient = createWalletClient({ account, chain: base, transport: http() })
const sellAmount = BigInt(process.env.SELL_AMOUNT || '1000000')

// 1. Check existing allowance — skip permit if sufficient
const allowance = await publicClient.readContract({
  address: USDC,
  abi: [{ type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'allowance',
  args: [account.address, COW_RELAYER]
})

let permitHook = undefined
if (allowance < sellAmount) {
  // 2. Sign USDC permit off-chain (free, no gas)
  const nonce = await publicClient.readContract({
    address: USDC,
    abi: [{ type: 'function', name: 'nonces', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'nonces',
    args: [account.address]
  })

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
  const permitValue = 2n ** 256n - 1n // max approval

  const sig = await walletClient.signTypedData({
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC },
    types: {
      Permit: [
        { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    primaryType: 'Permit',
    message: { owner: account.address, spender: COW_RELAYER, value: permitValue, nonce, deadline }
  })

  const r = sig.slice(0, 66)
  const s = '0x' + sig.slice(66, 130)
  const v = parseInt(sig.slice(130, 132), 16)

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

// 3. Init CoW SDK
const adapter = new ViemAdapter({ provider: publicClient, signer: account })
setGlobalAdapter(adapter)
const sdk = new TradingSdk({ chainId: SupportedChainId.BASE, signer: account, appCode: 'GoldbotSachs-Refuel' })

// 4. Get quote and post order (with permit pre-hook if needed)
const advancedSettings = permitHook
  ? { appData: { metadata: { hooks: { pre: [permitHook] } } } }
  : undefined

const quote = await sdk.getQuote({
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

const result = await quote.postSwapOrderFromQuote()
const orderId = result.orderId
// Track at: https://explorer.cow.fi/base/orders/{orderId}
```

---

## Step 2: Deploy Safe

Deploy a 1-of-1 Gnosis Safe controlled by the EOA. Uses the `predictedSafe` pattern for a deterministic address.

```javascript
import Safe from '@safe-global/protocol-kit'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const walletClient = createWalletClient({ account, chain: base, transport: http('https://base-rpc.publicnode.com') })

const protocolKit = await Safe.init({
  provider: 'https://base-rpc.publicnode.com',
  signer: process.env.PRIVATE_KEY,
  predictedSafe: {
    safeAccountConfig: { owners: [account.address], threshold: 1 },
    safeDeploymentConfig: { saltNonce: '1' }
  }
})

const safeAddress = await protocolKit.getAddress()
const isDeployed = await protocolKit.isSafeDeployed()

if (!isDeployed) {
  const deployTx = await protocolKit.createSafeDeploymentTransaction()
  await walletClient.sendTransaction({
    to: deployTx.to,
    value: BigInt(deployTx.value),
    data: deployTx.data
  })
}
// Save safeAddress as SAFE_ADDRESS for subsequent steps
```

---

## Step 3: Fund Safe

Transfer USDC from EOA to Safe. Standard ERC-20 transfer — no code example needed:

```
walletClient.writeContract({ address: USDC, abi: erc20Abi, functionName: 'transfer', args: [SAFE_ADDRESS, amount] })
```

---

## Step 4: Deposit — Beefy Deposit via Safe

Batches `approve` + `deposit` into a single Safe transaction. The EOA pays gas (~$0.001 on Base). Protocol Kit handles signing, MultiSend batching, and submission automatically.

**Non-obvious details:**
- **Beefy vault uses `deposit(uint256)`, NOT ERC-4626's `deposit(uint256, address)`** — wrong signature silently fails and Safe reports GS013
- Multiple transactions are automatically batched via MultiSend DelegateCall by Protocol Kit
- The EOA must have ETH for gas (refuel via step 1 if needed)

```javascript
import Safe from '@safe-global/protocol-kit'
import { encodeFunctionData, parseAbi } from 'viem'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BEEFY_VAULT = '0xF1C55b6E063ee90A33FFE62deBe618962bae021e'

const protocolKit = await Safe.init({
  provider: 'https://base-rpc.publicnode.com',
  signer: process.env.PRIVATE_KEY,
  safeAddress: process.env.SAFE_ADDRESS
})

const amount = BigInt(process.env.DEPOSIT_AMOUNT || '1000000') // 1 USDC

const transactions = [
  {
    to: USDC,
    data: encodeFunctionData({
      abi: parseAbi(['function approve(address spender, uint256 amount)']),
      functionName: 'approve',
      args: [BEEFY_VAULT, amount]
    }),
    value: '0'
  },
  {
    to: BEEFY_VAULT,
    data: encodeFunctionData({
      abi: parseAbi(['function deposit(uint256 _amount)']),
      functionName: 'deposit',
      args: [amount]
    }),
    value: '0'
  }
]

const safeTx = await protocolKit.createTransaction({ transactions })
const result = await protocolKit.executeTransaction(safeTx)
// result.hash is the on-chain transaction hash
// View at: https://basescan.org/tx/{result.hash}
```

---

## Step 5: Check Balances

All read-only, no gas needed. Use `readContract` with `balanceOf` on:
- USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) — 6 decimals
- Beefy vault (`0xF1C55b6E063ee90A33FFE62deBe618962bae021e`) — 18 decimals for shares
- Use `getPricePerFullShare()` on the vault to convert shares to USDC: `usdcValue = shares * pricePerFullShare / 1e18 / 1e12` (divide by 1e12 to convert from 18-decimal share value to 6-decimal USDC)
- ETH balance via `getBalance`

**Note:** The Beefy vault is NOT ERC-4626 — it does not have `convertToAssets`, `totalAssets`, `maxDeposit`, etc. Use the Beefy-specific API: `deposit(uint256)`, `withdrawAll()`, `balanceOf(address)`, `getPricePerFullShare()`.

---

## Limits and Gotchas

- **Beefy vault is NOT ERC-4626**: Use `deposit(uint256)` not `deposit(uint256, address)`. Wrong function signature silently reverts and Safe reports misleading GS013 error.
- **Safe GS013 has two meanings**: (1) signature too short in `checkNSignatures`, (2) inner call failed with `safeTxGas=0` and `gasPrice=0` in `execTransaction`. If you see GS013, check the inner call first.
- **Gas costs on Base**: Safe transactions cost ~$0.001. The EOA needs a small ETH balance — refuel via step 1 if empty.
- **USDC permit domain**: `name: 'USD Coin'`, `version: '2'`, `chainId: 8453`. Getting these wrong silently produces an invalid signature.
- **Decimals**: USDC = 6 decimals, Beefy mooTokens = 18 decimals. Always convert when comparing.
- **CoW order settlement**: Orders may take 1–5 minutes to fill. Check status at `explorer.cow.fi`.
- **RPC rate limits**: Use `base-rpc.publicnode.com` instead of `mainnet.base.org` to avoid 429 errors from the public Base RPC.

## Troubleshooting

**"Safe not deployed"**: Run the deploy step (step 2) first. The Safe address is deterministic — you'll get the same address for the same owner + salt.

**"Insufficient USDC allowance"**: The deposit step batches approve + deposit. If it fails mid-batch, run approve separately then deposit.