import Safe, { EthSafeSignature } from '@safe-global/protocol-kit'
import { GelatoRelayPack } from '@safe-global/relay-kit'
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const RPC_URL = 'https://mainnet.base.org'
const PRIVATE_KEY = process.env.PRIVATE_KEY
const SAFE_ADDRESS = process.env.SAFE_ADDRESS
const CLAWUSDC_ADDRESS = process.env.CLAWUSDC_ADDRESS || '0xTBD'
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

if (!PRIVATE_KEY || !SAFE_ADDRESS) {
  console.error('Error: PRIVATE_KEY and SAFE_ADDRESS environment variables required')
  process.exit(1)
}

async function main() {
  console.log('--- Goldbot Sachs Gasless Deposit ---')
  
  const account = privateKeyToAccount(PRIVATE_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })

  // Initialize Safe
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS
  })

  const isDeployed = await protocolKit.isSafeDeployed()
  if (!isDeployed) {
    console.error('Safe not deployed yet. Run activate-safe.js first')
    process.exit(1)
  }

  // Amount to deposit (1.5 USDC)
  const amount = 1500000n

  // Create batched transactions: approve + deposit
  const transactions = [
    {
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: parseAbi(['function approve(address spender, uint256 amount)']),
        functionName: 'approve',
        args: [CLAWUSDC_ADDRESS, amount]
      }),
      value: '0'
    },
    {
      to: CLAWUSDC_ADDRESS,
      data: encodeFunctionData({
        abi: parseAbi(['function deposit(uint256 assets, address receiver) returns (uint256 shares)']),
        functionName: 'deposit',
        args: [amount, SAFE_ADDRESS]
      }),
      value: '0'
    }
  ]

  console.log('Creating relay transaction...')
  
  // Use Gelato relay for gasless execution
  const relayKit = new GelatoRelayPack({
    protocolKit,
    options: { isSponsored: true }
  })

  const safeTx = await relayKit.createTransaction({
    transactions,
    options: { isSponsored: true }
  })

  console.log('Signing transaction...')
  const signed = await protocolKit.signTransaction(safeTx)

  console.log('Executing via Gelato relay...')
  const result = await relayKit.executeTransaction({
    executable: signed,
    options: { isSponsored: true }
  })

  console.log('✅ Transaction submitted!')
  console.log('Task ID:', result.taskId)
  console.log('Track at: https://api.gelato.digital/tasks/status/' + result.taskId)
}

main().catch(console.error)
