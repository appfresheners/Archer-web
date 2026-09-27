import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Archer",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
