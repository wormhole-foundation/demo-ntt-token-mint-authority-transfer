import { PublicKey } from "@solana/web3.js";

const COMMANDS = {
  transfer: {
    usage: "transfer <NEW_AUTHORITY>",
    desc: "Transfers token mint authority to new authority",
  },
  claim: {
    usage: "claim <NEW_AUTHORITY>",
    desc: "Completes token mint authority transfer to new authority",
  },
} as const;
export type COMMAND = keyof typeof COMMANDS;

/**
 * Parses command from args and handles missing/invalid command
 */
export const parseCommand = (args: readonly string[]) => {
  // No command provided
  if (args.length === 0) {
    console.error("Missing option");
    console.log("Please provide one of the following options:");
    Object.values(COMMANDS).forEach(({ usage, desc }) => {
      console.log(` - ${bold(usage)}: ${desc}`);
    });
    process.exit(1);
  }
  // Invalid command
  if (!args[0] || !Object.keys(COMMANDS).includes(args[0])) {
    console.error(`Invalid command provided: ${args[0]}`);
    console.log("Please provide one of the following options:");
    Object.values(COMMANDS).forEach(({ usage, desc }) => {
      console.log(` - ${bold(usage)}: ${desc}`);
    });
    process.exit(1);
  }

  return { args: args.slice(1), command: args[0] as COMMAND };
};

/**
 * Parses PublicKey[] from args
 */
export const parseAdditionalSigners = (_args: readonly string[]) => {
  let args = _args; // Make a copy so it can be consumed
  const additionalSigners: PublicKey[] = [];
  while (args.length) {
    const key = parsePublicKey(args);
    // Skip empty args
    if (key) {
      additionalSigners.push(key);
    }
    args = args.slice(1);
  }
  return additionalSigners;
};

/**
 * Parses PublicKey from args[0]
 */
export const parsePublicKey = (args: readonly string[]) => {
  if (args[0] === undefined) return;
  let key: PublicKey;
  try {
    key = new PublicKey(args[0]);
  } catch (err) {
    console.error(`Invalid key provided: ${args[0]}`);
    console.error(err);
    process.exit(1);
  }
  return key;
};

/**
 * Returns input wrapped in bold SGR ANSI escape sequence
 */
export const bold = (input: string) => {
  return `\x1B[1m${input}\x1B[22m`;
};
