
export default function EmployeeInvoicesPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          My Invoices
        </h1>

        <p className="mt-4 text-gray-600">
          The employee invoice section is not available yet.
          Invoice storage and employee access still need to be configured.
        </p>

        <a
          href="/employee"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
        >
          Back to Employee Portal
        </a>
      </div>
    </main>
  );
}
