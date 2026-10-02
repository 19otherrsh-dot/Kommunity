const { ethers } = require('ethers');
const { query } = require('../db');

// Basic public RPC URLs for testing
const RPC_URLS = {
  ethereum: process.env.RPC_URL_ETHEREUM || 'https://cloudflare-eth.com',
  polygon: process.env.RPC_URL_POLYGON || 'https://polygon-rpc.com',
  base: process.env.RPC_URL_BASE || 'https://mainnet.base.org',
};

// Minimal ABI to get ERC-20 / ERC-721 balance
const MINIMAL_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

/**
 * Verify wallet signature and link it to the user
 */
const connectWallet = async (req, res, next) => {
  try {
    const { address, message, signature } = req.body;
    
    if (!address || !message || !signature) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Link wallet to user
    await query(
      `UPDATE users SET wallet_address = $1 WHERE id = $2`,
      [address.toLowerCase(), req.user.id]
    );

    res.json({ success: true, message: 'Wallet connected successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Check token balance and grant access to community
 */
const joinWithTokenGate = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { address, message, signature } = req.body;

    // Verify signature first (in case they are not authenticated yet or just connecting on the fly)
    if (address && message && signature) {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(401).json({ error: 'Signature verification failed' });
      }
      
      // Update their wallet address if they are authenticated
      if (req.user) {
        await query(
          `UPDATE users SET wallet_address = $1 WHERE id = $2`,
          [address.toLowerCase(), req.user.id]
        );
      }
    }

    // Determine the wallet address to check
    let walletToCheck = address;
    if (!walletToCheck && req.user) {
      const userResult = await query(`SELECT wallet_address FROM users WHERE id = $1`, [req.user.id]);
      if (userResult.rows.length && userResult.rows[0].wallet_address) {
        walletToCheck = userResult.rows[0].wallet_address;
      }
    }

    if (!walletToCheck) {
      return res.status(400).json({ error: 'No wallet connected' });
    }

    // Get community token gate settings
    const communityResult = await query(
      `SELECT token_gate_enabled, token_contract_address, token_network, min_token_balance 
       FROM communities WHERE id = $1`,
      [communityId]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const comm = communityResult.rows[0];

    if (!comm.token_gate_enabled || !comm.token_contract_address) {
      return res.status(400).json({ error: 'This community does not have token gating enabled' });
    }

    // Connect to blockchain
    const rpcUrl = RPC_URLS[comm.token_network] || RPC_URLS.ethereum;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Check balance
    const contract = new ethers.Contract(comm.token_contract_address, MINIMAL_ABI, provider);
    const balance = await contract.balanceOf(walletToCheck);
    
    // Convert minimum balance to BigInt (assuming 18 decimals for ERC20, but this is a rough scaffold)
    // For exact ERC20 support, we should query `decimals()`, but for ERC721 it's 0 decimals.
    // We'll do a simple comparison: is balance >= min_token_balance (raw)?
    // Usually, min_token_balance for NFTs is 1.
    const requiredBalance = BigInt(Math.floor(parseFloat(comm.min_token_balance)));

    if (balance >= requiredBalance) {
      // User meets the requirement, add them to community if not already
      if (req.user) {
        await query(
          `INSERT INTO community_members (community_id, user_id, role) 
           VALUES ($1, $2, 'member') 
           ON CONFLICT (community_id, user_id) DO NOTHING`,
          [communityId, req.user.id]
        );
      }
      
      return res.json({ 
        success: true, 
        message: 'Token requirements met! Access granted.',
        hasAccess: true 
      });
    } else {
      return res.status(403).json({ 
        error: 'Insufficient token balance', 
        hasAccess: false,
        balance: balance.toString(),
        required: requiredBalance.toString()
      });
    }
  } catch (err) {
    console.error('Web3 Join Error:', err);
    res.status(500).json({ error: 'Failed to verify token balance. Ensure the contract address and network are correct.' });
  }
};

module.exports = {
  connectWallet,
  joinWithTokenGate
};
