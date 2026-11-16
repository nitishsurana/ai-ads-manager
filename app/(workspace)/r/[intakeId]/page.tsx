export default async function Page({ params }: PageProps<"/r/[intakeId]">) {
  const { intakeId } = await params;

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-tight">
        Reading the product
      </h1>
      <p className="font-mono text-muted-foreground">{intakeId}</p>
    </>
  );
}
