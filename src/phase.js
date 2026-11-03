export const PHASES = ["day", "dusk", "night"];

// Dawn reads as dusk: same half-light, lamp still worth having on.
export function phaseForHour(hour) {
  if (hour >= 8 && hour < 17) return "day";
  if ((hour >= 17 && hour < 20) || (hour >= 6 && hour < 8)) return "dusk";
  return "night";
}

export function resolvePhase({ date, prefersDark, override }) {
  if (PHASES.includes(override)) return override;
  if (prefersDark) return "night";
  return phaseForHour(date.getHours());
}

export const PHASE_LABELS = {
  day: "daylight",
  dusk: "dusk",
  night: "lamplight",
};
