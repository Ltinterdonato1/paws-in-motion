
type InvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePage({
  params,
}: InvoicePageProps) {
  await params;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Invoice
        </h1>

        <p className="mt-4 text-gray-600">
          Invoice viewing is not available yet. The invoice database
          and access permissions need to be configured first.
        </p>

        <a
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
        >
          Back to Dashboard
        </a>
      </div>
    </main>
  );
}
