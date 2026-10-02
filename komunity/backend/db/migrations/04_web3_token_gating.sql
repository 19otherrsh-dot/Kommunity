-- 04_web3_token_gating.sql

-- Add Web3 fields to communities
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS token_gate_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS token_contract_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS token_network VARCHAR(50) DEFAULT 'ethereum',
ADD COLUMN IF NOT EXISTS min_token_balance DECIMAL(20, 4) DEFAULT 1;

-- Add Web3 fields to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255) UNIQUE;
