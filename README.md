# NTT Token Mint Authority Transfer Demo

A utility script for transferring token mint authority out of NTT.

## Project Setup

1. Clone the Repository:

```bash
git clone https://github.com/wormhole-foundation/demo-ntt-token-mint-authority-transfer
cd demo-ntt-token-mint-authority-transfer
```

2. Install Dependencies:

```bash
npm install
```

3. Replace `<TODO>`s and verify the following in the `transfer-mint-authority.ts` script:

   - Keypair Path Config
   - Network Config
   - SPL Token Config
   - NTT Config

4. Ensure NTT is paused:

   - If using the [NTT CLI](https://github.com/wormhole-foundation/native-token-transfers/tree/main/cli), this can be done as follows:

     - Set `paused` for the `Solana` chain to `true` in the `deployment.json` file:

     ```diff
      {
         "network": "",
         "chains": {
            "Solana": {
            "version": "3.x.x",
      -      "paused": false,
      +      "paused": true,
            ...
         }
      }
     ```

     - Run `ntt push` to sync the changes on-chain.

   - Via TS script, this can be done as follows:
     ```typescript
     const pauseTxs = ntt.pause(sender);
     ```

## Usage:

Transfers token mint authority to new authority:

```bash
npm run transfer <NEW_AUTHORITY>
```

> [!NOTE]
> The above only executes the first step of the transfer. Run `npm run claim <NEW_AUTHORITY>` to complete the transfer and unpause NTT.

Completes token mint authority transfer to new authority:

```bash
npm run claim <NEW_AUTHORITY>
```

> [!NOTE]
> In case of claiming via SPL Multisig with `m > 1`, make sure `ADDITIONAL_SIGNER_KEYPAIR_PATHS` (`Keypair Path Config`) in the `transfer-mint-authority.ts` script is correct.
