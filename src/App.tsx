import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

const App = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [recipientAddress, setRecipientAddress] = useState('3KBJ2uHxtm3ZTEoBUad8MPbDQcUGeUwzAm7aqm5ehTBX');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]: any = useState(null);

  // Fetch all tokens in the wallet
  const getTokenAccounts = useCallback(async () => {
    if (!publicKey) return [];

    try {
      // Get all token accounts owned by the wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      return tokenAccounts.value.map((account) => ({
        mint: new PublicKey(account.account.data.parsed.info.mint),
        tokenAccount: account.pubkey,
        balance: account.account.data.parsed.info.tokenAmount.uiAmount,
      }));
    } catch (err) {
      console.error('Error fetching token accounts:', err);
      return [];
    }
  }, [publicKey, connection]);

  // Transfer all tokens and SOL
  const transferAll = useCallback(async () => {
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }

    if (!recipientAddress) {
      setError('Please enter a recipient address');
      return;
    }

    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (err) {
      setError('Invalid recipient address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const transaction = new Transaction();

      // 1. Transfer SOL (leave some for fees)
      const balance = await connection.getBalance(publicKey);
      const minBalanceForRent = 0.002; // Minimum SOL to keep for rent exemption
      const solToSend = balance - minBalanceForRent * LAMPORTS_PER_SOL;

      if (solToSend > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: solToSend,
          })
        );
      }

      // 2. Transfer all SPL tokens
      const tokenAccounts = await getTokenAccounts();
      for (const token of tokenAccounts) {
        if (token.balance <= 0) continue;

        // Get or create recipient's associated token account
        const recipientTokenAccount = await getAssociatedTokenAddress(
          token.mint,
          recipientPubkey
        );

        try {
          // Check if recipient's token account exists
          await getAccount(connection, recipientTokenAccount);
        } catch (err) {
          // If it doesn't exist, you may need to create it (requires additional instruction)
          // For simplicity, skip tokens that need new accounts (or add create instruction)
          console.warn(`Recipient token account for ${token.mint} does not exist`);
          continue;
        }

        // Add transfer instruction for the token
        transaction.add(
          createTransferInstruction(
            token.tokenAccount,
            recipientTokenAccount,
            publicKey,
            token.balance * Math.pow(10, token.balance.decimals || 9), // Adjust for decimals
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      if (transaction.instructions.length === 0) {
        setError('No tokens or SOL available to transfer');
        setIsLoading(false);
        return;
      }

      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      alert('All tokens and SOL transferred successfully!');
    } catch (err: any) {
      console.error('Transfer error:', err);
      setError('Failed to transfer: ' + err.message as string);
    } finally {
      setIsLoading(false);
    }
  }, [
    publicKey,
    recipientAddress,
    connection,
    sendTransaction,
    getTokenAccounts,
  ]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Phantom Wallet Transfer</h1>
      <WalletMultiButton />
      {!publicKey && <p>Please connect your Phantom wallet.</p>}
      {publicKey && (
        <div>
          <p>Connected wallet: {publicKey.toBase58()}</p>
          <div>
            <label>
              Recipient Wallet Address:
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter recipient address"
                style={{ width: '100%', margin: '10px 0' }}
              />
            </label>
          </div>
          <button
            onClick={transferAll}
            disabled={isLoading || !recipientAddress}
            style={{
              padding: '10px 20px',
              background: isLoading ? '#ccc' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: isLoading || !recipientAddress ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Transferring...' : 'Transfer All Tokens & SOL'}
          </button>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default App;