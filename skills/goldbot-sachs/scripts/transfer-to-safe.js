import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const RPC_URL = 'https://mainnet.base.org'
const PRIVATE_KEY = process.env.PRIVATE_KEY
const SAFE_ADDRESS = process.env.SAFE_ADDRESS
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

if (!PRIVATE_KEY || !SAFE_ADDRESS) {
  console.error('Error: PRIVATE_KEY and SAFE_ADDRESS environment variables required')
  process.exit(1)
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY)
  const walletClient = createWalletClient({ 
    account, 
    chain: base, 
    transport: http(RPC_URL) 
  })

  console.log('Transferring USDC from EOA to Safe...')
  console.log('From:', account.address)
  console.log('To:', SAFE_ADDRESS)

  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: parseAbi(['function transfer(address to, uint256 amount)']),
    functionName: 'transfer',
    args: [SAFE_ADDRESS, 1500000n] // 1.5 USDC
  })

  console.log('Transfer Transaction Sent!')
  console.log('Hash:', hash)
  console.log('View on Explorer: https://basescan.org/tx/' + hash)
}

main().catch(console.error)
