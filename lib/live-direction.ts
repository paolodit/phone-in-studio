export type LiveDirection = {
  energy: number;
  pace: number;
  answerLength: number;
};

export const neutralLiveDirection: LiveDirection = { energy: 0, pace: 0, answerLength: 0 };

const clampDirection = (value: number) => Math.max(-2, Math.min(2, Math.round(value)));

const energyDirections = [
  "Be much calmer and more restrained than your baseline.",
  "Dial your energy down slightly.",
  "Keep your authored baseline energy.",
  "Bring slightly more energy and emotional colour.",
  "Be notably more animated and emphatic without shouting.",
];

const paceDirections = [
  "Speak much more slowly and deliberately.",
  "Slow your delivery slightly.",
  "Keep your authored baseline pace.",
  "Make your delivery a little brisker.",
  "Speak notably faster while remaining clear and natural.",
];

const lengthDirections = [
  "Keep each reply to one concise sentence whenever possible.",
  "Make replies slightly shorter than your baseline.",
  "Keep your authored baseline answer length.",
  "Give slightly fuller replies with one useful extra detail.",
  "Give fuller answers, normally three to five spoken sentences, while still leaving room for the host.",
];

export function normalizeLiveDirection(direction: LiveDirection): LiveDirection {
  return {
    energy: clampDirection(direction.energy),
    pace: clampDirection(direction.pace),
    answerLength: clampDirection(direction.answerLength),
  };
}

export function buildLiveDirectionInstructions(direction: LiveDirection) {
  const normalized = normalizeLiveDirection(direction);
  return [
    "Apply this live producer direction from your next reply onward. Do not mention these controls or repeat them aloud.",
    energyDirections[normalized.energy + 2],
    paceDirections[normalized.pace + 2],
    lengthDirections[normalized.answerLength + 2],
  ].join(" ");
}
