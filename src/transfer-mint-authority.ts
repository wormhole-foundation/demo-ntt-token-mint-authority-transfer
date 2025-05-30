import {
  getExplorerLink,
  getKeypairFromFile,
} from "@solana-developers/helpers";
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Cluster,
  Keypair,
} from "@solana/web3.js";
import {
  AccountAddress,
  ChainContext,
  contracts,
  Network,
  Signer,
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
import { getMint, getMultisig, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { bold, parseCommand, parsePublicKey } from "./helpers.js";

/**
 * Keypair Path Config
 */
const PAYER_KEYPAIR_PATH = "../temp.json"; // Path to payer Keypair
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
const NTT_TOKEN_ADDRESS = new PublicKey(
  "xuFfVG99eGnsGUJyjPiLLyQFmXt7C1URExUXt4NPW4i"
); // Address of deployed token mint

/**
 * NTT Config
 */
const VERSION: IdlVersion = "3.0.0"; // Deployed NTT version
const NTT_ADDRESS = new PublicKey(
  "8y2hh2wGnagy8wc8Fe8xsjUtLSHnzFbiPmFNrext4jHm"
); // Address of deployed NTT manager
const WH_TRANSCEIVER_ADDRESS = new PublicKey(
  "z95km6PpYxapTPmTF5costpc7y1J7ZqTSBqggETZcmn"
); // Address of deployed Wormhole transceiver

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
};
main();
