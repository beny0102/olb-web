import type { ProposalPayload } from "./api";

const PITCH_LABELS: Record<Extract<ProposalPayload, { kind: "pitch" }>["call"], string> = {
  B: "Bola",
  C: "Strike",
  S: "Strike",
  F: "Foul",
  T: "Foul tip",
};

const OUTCOME_LABELS: Record<Extract<ProposalPayload, { kind: "outcome" }>["code"], string> = {
  out: "Out",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  HR: "HR",
  E: "Error",
  FC: "FC",
};

/** The Spanish label the inbox shows for a proposal. */
export function proposalLabel(payload: ProposalPayload): string {
  return payload.kind === "pitch"
    ? PITCH_LABELS[payload.call]
    : OUTCOME_LABELS[payload.code];
}
