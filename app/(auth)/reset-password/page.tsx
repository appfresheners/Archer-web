import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password — Archer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
