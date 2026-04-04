import { z } from "zod/v4";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  DAILY_BUDGET_LIMIT: z.coerce.number().positive().default(5),
  MAX_UPLOADS_PER_HOUR: z.coerce.number().int().positive().default(10),
});

function getConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      result.error.flatten().fieldErrors
    );
    throw new Error("Missing or invalid environment variables. Check .env.example for required values.");
  }
  return result.data;
}

export type Config = z.infer<typeof envSchema>;
export const config = getConfig();
