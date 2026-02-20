#!/usr/bin/env node

// Gasless USDC → ETH refuel via CoW Protocol SDK with permit pre-hook
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

const PRIVATE_KEY = process.env.PRIVATE_KEY
const SELL_AMOUNT = process.env.SELL_AMOUNT || '1000000' // 1 USDC default

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required')
  process.exit(1)
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http() })
  const walletClient = createWalletClient({ account, chain: base, transport: http() })

  const sellAmount = BigInt(SELL_AMOUNT)

  console.log('CoW Swap Refuel (SDK)')
  console.log('=====================')
  console.log('Selling:', Number(sellAmount) / 1e6, 'USDC')
  console.log('Buying: ETH (native)')
  console.log('From:', account.address)
  console.log('')

  // 1. Check if we already have allowance — skip permit if so
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: [{ type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'allowance',
    args: [account.address, COW_RELAYER]
  })

  let permitHook = undefined
  if (allowance < sellAmount) {
    console.log('No existing allowance — signing permit...')

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
    console.log('Permit signed (pre-hook attached)')
  } else {
    console.log('Existing allowance sufficient — skipping permit')
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

  console.log('Getting quote...')
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

  const orderId = await quoteAndPost.postSwapOrderFromQuote()
  console.log('')
  console.log('Order submitted!')
  console.log('Order ID:', orderId)
  console.log('Track: https://explorer.cow.fi/base/orders/' + orderId)
  console.log('')
  console.log('ETH will arrive in your wallet shortly')
}

main().catch(console.error)
