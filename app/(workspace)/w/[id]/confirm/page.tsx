export default async function Page({ params }: PageProps<"/w/[id]/confirm">) {
  const { id } = await params;

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-tight">
        Confirm what we found
      </h1>
      <p className="font-mono text-muted-foreground">{id}</p>
    </>
  );
}
