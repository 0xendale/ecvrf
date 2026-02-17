# ECVRF - Elliptic Curve Verifiable Random Function

A decentralized Verifiable Random Function (VRF) implementation for Ethereum, providing cryptographically secure and verifiable random number generation for smart contracts.

## 🌟 Overview

ECVRF is a production-ready VRF solution that combines:
- **Verifiable Randomness**: Cryptographically provable random number generation
- **Smart Contract Integration**: Seamless integration with Solidity contracts
- **Off-chain Worker**: Automated VRF request processing and fulfillment
- **Dual Framework Support**: Built with both Hardhat and Foundry

## ✨ Features

- 🔐 **Cryptographic Security**: ECVRF-based provable randomness
- 🎯 **Request-Response Model**: Consumer contracts request, coordinator fulfills
- ⚡ **Automated Fulfillment**: Off-chain worker listens and processes requests
- 🔄 **Subscription Model**: Efficient gas management via VRFCoordinatorV2
- 🛠️ **Developer Friendly**: Comprehensive testing and deployment scripts
- 📊 **TypeScript Integration**: Type-safe integration services

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  VRF Consumer   │────────▶│ VRF Coordinator  │◀────────│   VRF Worker    │
│   (Your Dapp)   │         │   (On-chain)     │         │   (Off-chain)   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       │                            │                              │
       │ 1. requestRandomWords()    │                              │
       ├───────────────────────────▶│                              │
       │                            │ 2. RandomWordsRequested      │
       │                            ├─────────────────────────────▶│
       │                            │                              │
       │                            │ 3. fulfillRandomWords()      │
       │                            │◀─────────────────────────────┤
       │ 4. rawFulfillRandomWords() │                              │
       │◀───────────────────────────┤                              │
```

## 📋 Prerequisites

- Node.js >= 18.x
- Yarn or npm
- Foundry (optional, for Forge commands)

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ecvrf.git
cd ecvrf

# Install dependencies
yarn install

# Compile contracts
yarn compile
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Network Configuration
TESTNET_RPC_URL=https://your-testnet-rpc-url
MAINNET_RPC_URL=https://your-mainnet-rpc-url

# Private Keys
DEPLOYER_PRIVATE_KEY=your_deployer_private_key
ORACLE_PRIVATE_KEY=your_oracle_private_key

# Contract Addresses (populated after deployment)
VRF_COORDINATOR_ADDRESS=
DAPP_CONSUMER_ADDRESS=

# VRF Configuration
VRF_PUBLIC_KEY=
VRF_SECRET_KEY=
```

## 📦 Usage

### Deployment

Deploy the VRF Coordinator and Consumer contracts:

```bash
# Deploy to testnet
yarn deploy --testnet

# Deploy to mainnet
yarn deploy
```

### Start VRF Worker

Run the off-chain worker to process VRF requests:

```bash
# Start worker on testnet
yarn start --testnet

# Start worker on mainnet
yarn start

# Development mode with hot reload
yarn dev --testnet
```

### Request Random Numbers

Send a randomness request from your consumer contract:

```bash
yarn send-random
```

### Testing

```bash
# Run all tests
yarn test

# Run Foundry tests
forge test

# Run with gas reporting
forge test --gas-report
```

## 📁 Project Structure

```
ecvrf/
├── contracts/           # Solidity smart contracts
│   ├── VRFCoordinator.sol      # Main coordinator contract
│   ├── VRFConsumer.sol         # Base consumer contract
│   ├── KeeperVRFConsumer.sol   # Automation-compatible consumer
│   └── core/VRF.sol            # Core VRF cryptographic logic
├── integration-services/        # TypeScript integration layer
│   └── services/
│       ├── VRFCoordinator.service.ts
│       └── VRFConsumer.service.ts
├── jobs/               # Off-chain worker services
│   ├── index.ts        # Worker entry point
│   ├── listeners/vrfListener.ts    # Event listener
│   └── handlers/requestRandomness.ts
├── scripts/            # Deployment and utility scripts
│   ├── deploy.ts
│   └── contractDeployment/
├── utils/              # Cryptographic utilities
│   ├── vrfProof.ts     # VRF proof generation
│   ├── crypto.ts       # Cryptographic primitives
│   └── solidityProof.ts # Solidity-compatible proof formatting
├── tests/              # Test suites
├── abis/               # Contract ABIs
└── config/             # Configuration files
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `yarn start` | Start VRF worker (mainnet) |
| `yarn dev` | Start VRF worker with hot reload |
| `yarn build` | Compile TypeScript |
| `yarn compile` | Compile Solidity contracts and export ABIs |
| `yarn test` | Run Hardhat tests |
| `yarn deploy` | Deploy contracts |
| `yarn send-random` | Send a random number request |
| `yarn lint` | Lint TypeScript files |
| `yarn prettier` | Format code |
| `forge build` | Build contracts with Foundry |
| `forge test` | Run Foundry tests |

## 🔨 Development

### Building Contracts

```bash
# Using Hardhat
yarn compile

# Using Foundry
forge build
```

### Running Tests

```bash
# Hardhat tests
yarn test

# Foundry tests
forge test

# With verbosity
forge test -vvv
```

### Code Formatting

```bash
# Format TypeScript
yarn prettier

# Format Solidity
forge fmt
```

## 🎯 How to Integrate

### 1. Inherit VRFConsumerBaseV2

```solidity
import "./VRFConsumer.sol";

contract MyContract is VRFConsumerBaseV2 {
    constructor(address vrfCoordinator) 
        VRFConsumerBaseV2(vrfCoordinator) {}
    
    function requestRandomness() external {
        requestRandomWords(
            keyHash,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }
    
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        // Use your random numbers here
    }
}
```

### 2. Configure Your Consumer

- Set the VRF Coordinator address
- Configure callback gas limit
- Set number of random words needed

### 3. Deploy and Test

- Deploy your consumer contract
- Request random words
- VRF worker automatically fulfills requests

## 🔐 Security Considerations

- Keep private keys secure and never commit them
- Use hardware wallets for mainnet deployments
- Audit callback gas limits to prevent out-of-gas errors
- Validate VRF proofs on-chain before accepting randomness
- Implement access controls for sensitive functions

## 📚 Resources

- [VRF Specification](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-vrf-15)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Hardhat Documentation](https://hardhat.org/docs)

## 👤 Author

**0xEndale**
- Email: endadinh@gmail.com

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

Built with ❤️ using Solidity, TypeScript, Hardhat, and Foundry
