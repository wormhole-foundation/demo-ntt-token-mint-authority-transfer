import {
  getExplorerLink,
  getKeypairFromFile,
} from "@solana-developers/helpers";
import { getMint, getMultisig, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  Network,
  Wormhole,
} from "@wormhole-foundation/sdk";
import {
  getSolanaSignAndSendSigner,
  SolanaPlatform,
} from "@wormhole-foundation/sdk-solana";
import {
  IdlVersion,
  NTT,
  SolanaNtt,
} from "@wormhole-foundation/sdk-solana-ntt";
import { bold, parseCommand, parsePublicKey } from "./helpers.js";

/**
 * Keypair Path Config
 */
const PAYER_KEYPAIR_PATH = "<TODO>"; // Path to payer Keypair (e.g: /whYfLTP5QJTRCyGW2sRePjdgt9D8w7DddYu3L6jC69.json.json)
const ADDITIONAL_SIGNER_KEYPAIR_PATHS: string[] = [""]; // Path to Keypairs of additional signers of SPL Multisig

/**
 * Network & Chain Config
 */
type ChainType = "Solana" | "Fogo";

const CHAIN: ChainType = "Fogo"; // Change to "Solana" or "Fogo"
const NETWORK: Network = "Testnet"; // Wormhole network to use
const CLUSTER: Cluster = "testnet"; // Solana cluster to use - Solana devnet is compatible with Wormhole Testnet cluster!


/**
 * NTT Config
 */
const VERSION: IdlVersion = "3.0.0"; // Deployed NTT version
const NTT_TOKEN_ADDRESS = new PublicKey("<TODO>"); // Address of deployed token mint
const NTT_ADDRESS = new PublicKey("<TODO>"); // Address of deployed NTT manager
const WH_TRANSCEIVER_ADDRESS = new PublicKey("<TODO>"); // Address of deployed Wormhole transceiver

/**
 * Constructs `SolanaNtt` object from the config values defined, using dynamic connection from Wormhole SDK
 */
const setupSolanaNtt = async (payer: Keypair) => {
  const w = new Wormhole(NETWORK, [SolanaPlatform]);
  const ch = w.getChain(CHAIN);
  const connection: Connection = await ch.getRpc();
  const signer = await getSolanaSignAndSendSigner(connection, payer, {});
  const sender = Wormhole.parseAddress(CHAIN, signer.address());
  const ntt = new SolanaNtt(
    NETWORK,
    CHAIN,
    connection,
    {
      ...ch.config.contracts,
      ntt: {
        token: NTT_TOKEN_ADDRESS.toBase58(),
        manager: NTT_ADDRESS.toBase58(),
        transceiver: {
          wormhole: WH_TRANSCEIVER_ADDRESS.toBase58(),
        },
      },
    },
    VERSION
  );
  return { ntt, signer, sender, connection };
};

/**
 * Transfers token mint authority to new authority
 */
const handleTransfer = async (
  args: string[],
  ntt: SolanaNtt<Network, ChainType>,
  payer: Keypair,
  connection: Connection
) => {
  const newAuthority = parsePublicKey(args);
  if (!newAuthority) {
    console.error("No <NEW_AUTHORITY> provided.");
    process.exit(1);
  }

  // Verify version
  const version = await NTT.getVersion(connection, ntt.program.programId);
  const major = Number(version.split(".")[0]);
  if (major < 3) {
    console.error(
      "Token mint authority transfer is only supported for versions >= 3.x.x"
    );
    console.error("Use 'ntt upgrade' to upgrade the NTT contract to a specific version.");
    process.exit(1);
  }

  // Check if current authority is multisig token authority
  const config = await ntt.getConfig();
  let multisigTokenAuthority: PublicKey | undefined;
  const mintInfo = await getMint(
    connection,
    config.mint,
    undefined,
    config.tokenProgram
  );
  if (!mintInfo.mintAuthority?.equals(ntt.pdas.tokenAuthority())) {
    multisigTokenAuthority = mintInfo.mintAuthority ?? undefined;
  }

  console.log(
    `Starting token mint authority transfer to ${newAuthority.toBase58()}...`
  );
  const transaction = new Transaction().add(
    // Step 1 of 2-step mint authority transfer
    await NTT.createSetTokenAuthorityInstruction(ntt.program, config, {
      rentPayer: payer.publicKey,
      owner: payer.publicKey,
      newAuthority,
      multisigTokenAuthority,
    })
  );
  transaction.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  const tx = await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: 'finalized'
  });
  
  console.log(`✅ Transaction finalized, explorer link is: ${getExplorerLink(
    "transaction",
    tx,
    CLUSTER
  )}`);
  console.log(
    `❗ Re-run the script with claim ${newAuthority.toBase58()} to complete the transfer`
  );
};

/**
 * Completes token mint authority transfer to new authority
 */
const handleClaim = async (
  args: string[],
  ntt: SolanaNtt<Network, ChainType>,
  payer: Keypair,
  additionalSigners: Keypair[],
  connection: Connection
) => {
  const newAuthority = parsePublicKey(args);
  if (!newAuthority) {
    console.error("No <NEW_AUTHORITY> provided.");
    process.exit(1);
  }

  // Verify version
  const version = await NTT.getVersion(connection, ntt.program.programId);
  const major = Number(version.split(".")[0]);
  if (major < 3) {
    console.error(
      "Token mint authority transfer is only supported for versions >= 3.x.x"
    );
    console.error("Use 'ntt upgrade' to upgrade the NTT contract to a specific version.");
    process.exit(1);
  }

  // Check if current authority is multisig token authority
  const config = await ntt.getConfig();
  let multisigTokenAuthority: PublicKey | undefined;
  const mintInfo = await getMint(
    connection,
    config.mint,
    undefined,
    config.tokenProgram
  );
  if (!mintInfo.mintAuthority?.equals(ntt.pdas.tokenAuthority())) {
    multisigTokenAuthority = mintInfo.mintAuthority ?? undefined;
  }

  console.log(
    `Claiming token mint authority transfer to ${newAuthority.toBase58()}...`
  );

  // Check if new authority is multisig and has sufficient signers configured
  let isMultisig = false;
  try {
    const multisigInfo = await getMultisig(
      connection,
      newAuthority,
      undefined,
      TOKEN_PROGRAM_ID
    );
    isMultisig = true;
    if (multisigInfo.m > additionalSigners.length + 1) {
      console.error(
        `New authority expects ${multisigInfo.m} required signers but only ${
          additionalSigners.length + 1
        } signer provided. Please verify ${bold(
          "ADDITIONAL_SIGNER_KEYPAIR_PATHS"
        )} is correct and try again`
      );
    }
  } catch {}

  const transaction = new Transaction().add(
    // Step 2 of 2-step mint authority transfer
    isMultisig
      ? await NTT.createClaimTokenAuthorityToMultisigInstruction(
          ntt.program,
          config,
          {
            rentPayer: payer.publicKey,
            newMultisigAuthority: newAuthority,
            additionalSigners: [
              payer.publicKey,
              ...additionalSigners.map((signer) => signer.publicKey),
            ],
            multisigTokenAuthority,
          }
        )
      : await NTT.createClaimTokenAuthorityInstruction(ntt.program, config, {
          rentPayer: payer.publicKey,
          newAuthority,
          multisigTokenAuthority,
        })
  );
  transaction.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  const tx = await sendAndConfirmTransaction(connection, transaction, [
    payer,
    ...additionalSigners,
  ]);
  console.log(
    `✅ Transaction confirmed, explorer link is: ${getExplorerLink(
      "transaction",
      tx,
      CLUSTER
    )}`
  );
  console.log(
    `✅ Mint authority has been transferred successfully: ${getExplorerLink(
      "address",
      NTT_TOKEN_ADDRESS.toBase58(),
      CLUSTER
    )}`
  );
};

const main = async () => {
  // Extract keypair(s) from file
  const payer = await getKeypairFromFile(PAYER_KEYPAIR_PATH);
  const additionalSigners: Keypair[] = [];
  for (const signerPath of ADDITIONAL_SIGNER_KEYPAIR_PATHS) {
    if (signerPath) {
      additionalSigners.push(await getKeypairFromFile(signerPath));
    }
  }
  console.log(
    `🔑 We've loaded the keypair(s) securely! Our payer public key is: ${payer.publicKey.toBase58()}`
  );

  // Setup ntt from config
  const { ntt, connection } = await setupSolanaNtt(payer);

  console.log("NTT setup successfully using config values:");
  console.log("Token Mint:", NTT_TOKEN_ADDRESS.toBase58());
  console.log("NTT Address:", NTT_ADDRESS.toBase58());

  // Ensure ntt is paused
  if (!(await ntt.isPaused())) {
    console.error("Not paused. Please pause NTT and try again.");
    process.exit(1);
  }

  // Extract command
  const { args, command } = parseCommand(process.argv.slice(2));
  console.log(`Command: ${bold(command)}`);

  // Handle command
  switch (command) {
    case "transfer": {
      await handleTransfer(args, ntt, payer, connection);
      break;
    }
    case "claim": {
      await handleClaim(args, ntt, payer, additionalSigners, connection);
      break;
    }
    default: {
      console.error(`Unexpected command: ${command}`);
      process.exit(1);
    }
  }
};
main();
