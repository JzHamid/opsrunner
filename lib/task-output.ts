export type EmergencyFallbackContent = {
  title: string;
  body: string;
  nextSteps: string[];
};

export function getEmergencyFallbackContent(): EmergencyFallbackContent {
  return {
    title: "Fallback Result",
    body: "A safe structured fallback result.",
    nextSteps: ["Review the output", "Run again later if needed"],
  };
}
