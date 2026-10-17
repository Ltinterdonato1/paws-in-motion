
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CompleteJobButtonProps = {
  bookingId: string;
};

export default function CompleteJobButton({
  bookingId,
}: CompleteJobButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function completeJob() {
    const confirmed = window.confirm(
      "Are you sure this service has been completed? This will create an invoice for the customer."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `/api/services/${bookingId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            "We couldn't complete this job. Please try again."
        );
      }

      setMessage(
        result.message ||
          "Job completed successfully and the invoice was created."
      );

      // Reload the server-rendered booking details and its new status.
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={completeJob}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl bg-[#193d30] px-5 py-3 font-semibold text-white transition hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Completing job..." : "Complete Job & Create Invoice"}
      </button>

      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 text-sm ${
            isError ? "text-red-700" : "text-green-800"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
