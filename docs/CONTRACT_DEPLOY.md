# PerStreamPaymaster — Deployment Guide

> Deploy the on-chain settlement contract to **Arc testnet**.

## Prerequisites

- Node.js ≥ 18
- A wallet with testnet ETH (for gas on Arc testnet)
- The seller wallet private key in your `.env`

## Get testnet ETH on Arc

Visit the Circle faucet:
- https://faucet.circle.com (select Arc Testnet)
- Or use https://www.alchemy.com/faucets/arc-sepolia

## Deploy with Hardhat (recommended)

```bash
cd contracts
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init    # choose "Create a basic sample project"
```

Edit `hardhat.config.js`:

```js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      accounts: [process.env.ARBITRUM_PRIVATE_KEY],
      chainId: 5042002,
    },
  },
};
```

Create `scripts/deploy.js`:

```js
async function main() {
  const PerStreamPaymaster = await ethers.getContractFactory("PerStreamPaymaster");
  const contract = await PerStreamPaymaster.deploy();
  await contract.waitForDeployment();
  console.log("PerStreamPaymaster deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Deploy:

```bash
npx hardhat run scripts/deploy.js --network arcTestnet
```

## Verify on Arcscan

```bash
npx hardhat verify --network arcTestnet <DEPLOYED_ADDRESS>
```

Or visit https://testnet.arcscan.app/address/<DEPLOYED_ADDRESS>

## Wire deployed contract to backend

In `backend/.env`:

```env
PERSTREAM_PAYMASTER_ADDRESS=0x<deployed_address>
ARC_RPC_URL=https://rpc.testnet.arc.network
```

Restart the backend; tick settlements will now flow through your deployed contract instead of the bundled mock.

## Contract interface

```solidity
contract PerStreamPaymaster {
    event TickPaid(
        address indexed listener,
        address indexed creator,
        uint256 amountUsdc,
        uint256 tickTimestamp
    );

    function tick(address listener, address creator) external payable;
    function settle(address creator, uint256 amount) external;
    function withdraw(address creator) external;
}
```

## Security notes

- The contract uses Circle GatewayMinter for USDC settlement
- Listener signs EIP-3009 TransferWithAuthorization per tick (or per batch)
- Owner is renounced after deployment (no admin keys)
- Reentrancy protection via `nonReentrant` modifier
