export interface WorldMarketData {
  status: string;
  // Placeholder for future implementation
  timestamp: number;
}

export async function getWorldMarketData(): Promise<WorldMarketData> {
  return {
    status: "World Markets tracking coming soon",
    timestamp: Date.now()
  };
}
