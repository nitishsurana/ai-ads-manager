import { requireTester } from "@/lib/auth";
import { readIntake } from "@/lib/intake/workflow";
import { messages } from "@/lib/messages";

// Placeholder until the Reading screen replaces it.
export default async function Page({ params }: PageProps<"/r/[intakeId]">) {
  const { intakeId } = await params;
  const { userId } = await requireTester();
  const intake = await readIntake(userId, intakeId);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-1.5">
      <span className="font-mono text-xs break-all text-muted-foreground">
        {intake?.url}
      </span>
      <h1 className="m-0 text-2xl font-semibold tracking-tight">
        {intake?.status === "failed" && intake.failureCode
          ? messages[intake.failureCode]
          : "Reading the product"}
      </h1>
    </div>
  );
}
