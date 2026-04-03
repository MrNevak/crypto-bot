// Network configurations - ВСЕ СЕТИ
const networks = {
    BTC: [{ id: "bitcoin", name: "Bitcoin", icon: "₿", description: "Bitcoin Mainnet" }],
    
    ETH: [
        { id: "ethereum", name: "Ethereum", icon: "⟠", description: "ERC-20" },
        { id: "arbitrum", name: "Arbitrum", icon: "🔷", description: "Arbitrum One" },
        { id: "optimism", name: "Optimism", icon: "✨", description: "OP Mainnet" },
        { id: "polygon", name: "Polygon", icon: "🟣", description: "MATIC" },
        { id: "base", name: "Base", icon: "🔵", description: "Base Chain" },
        { id: "avalanche", name: "Avalanche", icon: "🔺", description: "AVAX C-Chain" }
    ],
    
    USDT: [
        { id: "ethereum", name: "Ethereum", icon: "⟠", description: "ERC-20" },
        { id: "bsc", name: "BNB Chain", icon: "🟡", description: "BEP-20" },
        { id: "polygon", name: "Polygon", icon: "🟣", description: "MATIC" },
        { id: "arbitrum", name: "Arbitrum", icon: "🔷", description: "Arbitrum" },
        { id: "optimism", name: "Optimism", icon: "✨", description: "Optimism" },
        { id: "avalanche", name: "Avalanche", icon: "🔺", description: "AVAX" }
    ],
    
    BNB: [
        { id: "bsc", name: "BNB Chain", icon: "🟡", description: "BSC Mainnet" },
        { id: "opbnb", name: "opBNB", icon: "🟠", description: "opBNB Mainnet" }
    ],
    
    SOL: [
        { id: "solana", name: "Solana", icon: "◎", description: "Solana Mainnet" }
    ],
    
    TON: [
        { id: "ton", name: "TON", icon: "⍟", description: "TON Mainnet" }
    ]
};
