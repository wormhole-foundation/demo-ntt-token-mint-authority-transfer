import {
  getExplorerLink,
  getKeypairFromFile,
} from "@solana-developers/helpers";
import { getMint, getMultisig, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  ChainContext,
  contracts,
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
const PAYER_KEYPAIR_PATH = "<TODO>"; // Path to payer Keypair
const ADDITIONAL_SIGNER_KEYPAIR_PATHS: string[] = [""]; // Path to Keypairs of additional signers of SPL Multisig

/**
 * Network Config
 */
const NETWORK: Network = "Testnet"; // Wormhole network to use
const CLUSTER: Cluster = "devnet"; // Solana cluster to use
const CONNECTION = new Connection(clusterApiUrl(CLUSTER)); // Solana connection object to use

/**
 * SPL Token Config
 */
const TOKEN_PROGRAM = TOKEN_PROGRAM_ID; // Token Program to use
const NTT_TOKEN_ADDRESS = new PublicKey("<TODO>"); // Address of deployed token mint

/**
 * NTT Config
 */
const VERSION: IdlVersion = "3.0.0"; // Deployed NTT version
const NTT_ADDRESS = new PublicKey("<TODO>"); // Address of deployed NTT manager
const WH_TRANSCEIVER_ADDRESS = new PublicKey("<TODO>"); // Address of deployed Wormhole transceiver

/**
 * Constructs `SolanaNtt` object from the config values defined
 */
const setupSolanaNtt = async (payer: Keypair) => {
  const CORE_BRIDGE_ADDRESS = contracts.coreBridge(NETWORK, "Solana");
  const w = new Wormhole(NETWORK, [SolanaPlatform], {
    chains: { Solana: { contracts: { coreBridge: CORE_BRIDGE_ADDRESS } } },
  });
  const ctx: ChainContext<typeof NETWORK, "Solana"> = w
    .getPlatform("Solana")
    .getChain("Solana", CONNECTION);
  const signer = await getSolanaSignAndSendSigner(CONNECTION, payer, {});
  const sender = Wormhole.parseAddress("Solana", signer.address());
  const ntt = new SolanaNtt(
    NETWORK,
    "Solana",
    CONNECTION,
    {
      ...ctx.config.contracts,
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
  return { ntt, signer, sender };
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
  const { ntt } = await setupSolanaNtt(payer);

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
      await handleTransfer(args, ntt, payer);
      break;
    }
    case "claim": {
      await handleClaim(args, ntt, payer, additionalSigners);
      break;
    }
    // Should be unreachable as parseCommand should early return
    default: {
      console.error(`Unexpected command: ${command}`);
      process.exit(1);
    }
  }
};
main();
