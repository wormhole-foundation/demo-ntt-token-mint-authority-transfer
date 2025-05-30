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
