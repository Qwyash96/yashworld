"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { HelpCircle, Check, ShieldAlert } from "lucide-react"
import type { ConfirmationResult } from "firebase/auth"
import { useStore } from "@/components/store-provider"
import { getSellerApplication, submitSellerApplication } from "@/services/seller.service"
import { sendOtp, confirmOtp } from "@/services/phone-verification.service"
import {
  isValidIndianMobile,
  isValidPan,
  isValidAadhaar,
  isValidIfsc,
  namesRoughlyMatch,
} from "@/lib/kyc-validation"
import { sanitizeIndianMobile, sanitizeDigits, sanitizeOpaqueDigits } from "@/lib/numeric-input"
import type { SellerApplication, SellerKycDocs } from "@/types/seller"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SupportTicketForm } from "@/components/seller/support-ticket-form"
import { KycUploadField } from "@/components/seller/kyc-upload-field"
import { LiveSelfieCapture } from "@/components/seller/live-selfie-capture"

const businessTypes = [
  { value: "individual", label: "Individual" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "private_limited", label: "Private Limited" },
  { value: "llp", label: "LLP" },
]

const steps = [
  "Personal Details",
  "Business Details",
  "Bank Details",
  "Identity",
  "Live Selfie",
  "Documents",
  "Review & Submit",
]

const RECAPTCHA_CONTAINER_ID = "seller-kyc-recaptcha-container"

const initialForm = {
  fullName: "",
  mobile: "",
  panNumber: "",
  aadhaarNumber: "",
  shopName: "",
  businessType: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  bankAccountHolder: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountNumberConfirm: "",
  bankIfsc: "",
}

type OtpPhase = "idle" | "sending" | "sent" | "verifying" | "verified" | "error"

const blockedStatusCopy: Record<string, { title: string; message: string }> = {
  suspended: {
    title: "Your Seller Account Is Suspended",
    message: "Your seller account has been temporarily suspended. Please contact support for details.",
  },
  banned: {
    title: "Your Seller Account Is Banned",
    message: "Your seller account has been permanently banned and cannot be reinstated through this page.",
  },
}

export default function SellerApplicationWizard() {
  const router = useRouter()
  const { user } = useStore()
  const [checked, setChecked] = useState(false)
  const [existing, setExisting] = useState<SellerApplication | null>(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [kyc, setKyc] = useState<Partial<SellerKycDocs>>({})
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const [mobileVerified, setMobileVerified] = useState(false)
  const [otpPhase, setOtpPhase] = useState<OtpPhase>("idle")
  const [otpCode, setOtpCode] = useState("")
  const [otpError, setOtpError] = useState("")
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)

  useEffect(() => {
    if (!user) {
      router.replace("/login")
      return
    }
    getSellerApplication(user.uid).then((application) => {
      if (application?.status === "pending" || application?.status === "approved") {
        router.replace("/seller/products")
        return
      }
      if (application) {
        setExisting(application)
        setForm({
          fullName: application.fullName,
          mobile: application.mobile,
          panNumber: application.panNumber ?? "",
          aadhaarNumber: application.aadhaarNumber ?? "",
          shopName: application.shopName,
          businessType: application.businessType,
          address: application.address,
          city: application.city,
          state: application.state,
          pincode: application.pincode,
          bankAccountHolder: application.payoutInfo.accountHolder,
          bankName: application.payoutInfo.bankName ?? "",
          bankAccountNumber: application.payoutInfo.accountNumber,
          bankAccountNumberConfirm: application.payoutInfo.accountNumber,
          bankIfsc: application.payoutInfo.ifsc,
        })
        setKyc(application.kyc)
        if (application.mobileVerified) {
          setMobileVerified(true)
          setOtpPhase("verified")
        }
      } else {
        setForm((prev) => ({ ...prev, fullName: user.name }))
      }
      setChecked(true)
    })
  }, [user, router])

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === "mobile" && mobileVerified) {
      // Changing the number invalidates the previous OTP verification.
      setMobileVerified(false)
      setOtpPhase("idle")
      setConfirmation(null)
      setOtpCode("")
    }
  }

  async function handleSendOtp() {
    setOtpError("")
    setOtpPhase("sending")
    try {
      const result = await sendOtp(form.mobile.trim(), RECAPTCHA_CONTAINER_ID)
      setConfirmation(result)
      setOtpPhase("sent")
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP.")
      setOtpPhase("error")
    }
  }

  async function handleVerifyOtp() {
    if (!confirmation) return
    setOtpError("")
    setOtpPhase("verifying")
    try {
      await confirmOtp(confirmation, otpCode.trim())
      setMobileVerified(true)
      setOtpPhase("verified")
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid or expired OTP.")
      setOtpPhase("sent")
    }
  }

  const accountsMatch =
    form.bankAccountNumber.trim().length > 0 && form.bankAccountNumber.trim() === form.bankAccountNumberConfirm.trim()
  const accountHolderMismatch =
    form.bankAccountHolder.trim().length > 0 && !namesRoughlyMatch(form.bankAccountHolder, form.fullName)

  function validateStep(current: number): string {
    if (current === 1) {
      if (!form.fullName.trim() || !form.mobile.trim()) return "Please fill in all fields."
      if (!isValidIndianMobile(form.mobile)) return "Enter a valid 10-digit Indian mobile number."
      if (!mobileVerified) return "Please verify your mobile number with the OTP before continuing."
    }
    if (current === 2) {
      if (!form.shopName.trim() || !form.businessType || !form.address.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
        return "Please fill in all fields."
      }
    }
    if (current === 3) {
      if (!form.bankAccountHolder.trim() || !form.bankName.trim() || !form.bankAccountNumber.trim() || !form.bankIfsc.trim()) {
        return "Please fill in all bank details."
      }
      if (!accountsMatch) return "Account numbers do not match."
      if (!isValidIfsc(form.bankIfsc)) return "Enter a valid IFSC code."
    }
    if (current === 4) {
      if (!isValidPan(form.panNumber)) return "Enter a valid PAN number."
      if (!isValidAadhaar(form.aadhaarNumber)) return "Enter a valid 12-digit Aadhaar number."
    }
    if (current === 5) {
      if (!kyc.selfiePath) return "Please capture your live selfie."
    }
    if (current === 6) {
      if (!kyc.aadhaarFrontPath || !kyc.aadhaarBackPath || !kyc.panPath || !kyc.bankProofPath) {
        return "Aadhaar Front, Aadhaar Back, PAN and Bank Proof are all required."
      }
    }
    return ""
  }

  function goNext() {
    const validation = validateStep(step)
    if (validation) {
      setError(validation)
      return
    }
    setError("")
    setStep((s) => Math.min(s + 1, steps.length))
  }

  function goBack() {
    setError("")
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit() {
    if (!user) return
    // Defense in depth — re-check every requirement independently of step gating.
    for (let s = 1; s <= 6; s++) {
      const validation = validateStep(s)
      if (validation) {
        setError(validation)
        setStep(s)
        return
      }
    }

    setSubmitting(true)
    try {
      await submitSellerApplication(
        {
          uid: user.uid,
          fullName: form.fullName.trim(),
          mobile: form.mobile.trim(),
          mobileVerified: true,
          mobileVerifiedAt: new Date().toISOString(),
          panNumber: form.panNumber.trim().toUpperCase(),
          aadhaarNumber: form.aadhaarNumber.trim(),
          shopName: form.shopName.trim(),
          businessType: form.businessType,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          payoutInfo: {
            accountHolder: form.bankAccountHolder.trim(),
            bankName: form.bankName.trim(),
            accountNumber: form.bankAccountNumber.trim(),
            ifsc: form.bankIfsc.trim().toUpperCase(),
          },
          accountHolderNameMismatch: accountHolderMismatch,
        },
        {
          aadhaarFrontPath: kyc.aadhaarFrontPath,
          aadhaarBackPath: kyc.aadhaarBackPath,
          panPath: kyc.panPath,
          selfiePath: kyc.selfiePath,
          bankProofPath: kyc.bankProofPath,
          gstPath: kyc.gstPath,
          submittedAt: new Date().toISOString(),
        },
      )
      router.push("/seller/products")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application.")
      setSubmitting(false)
    }
  }

  if (!checked || !user) return null

  if (existing && (existing.status === "suspended" || existing.status === "banned")) {
    const copy = blockedStatusCopy[existing.status]
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f3f5f2] px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-100">
            <ShieldAlert className="size-7 text-red-600" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-black">{copy.title}</h1>
          <p className="mt-2 text-sm text-[#444444]">{copy.message}</p>
          {existing.rejectionReason && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700">
              <strong>Reason:</strong> {existing.rejectionReason}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-[#f3f5f2] px-4 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-white p-8 shadow-xl sm:p-10">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-2xl font-bold text-green-700">YashWorld</span>
            <h1 className="mt-2 text-2xl font-bold text-black">
              {existing ? "Update Your Seller Application" : "Become a Seller"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
          >
            <HelpCircle className="size-4" />
            Need Help?
          </button>
        </div>

        {existing?.status === "rejected" && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <strong>Previous application rejected:</strong>{" "}
            {existing.rejectionReason || "No reason provided."} Please review and resubmit below.
          </div>
        )}
        {existing?.status === "resubmission_requested" && (
          <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            <strong>Re-upload requested:</strong>{" "}
            {existing.rejectionReason || "The review team requested updated information."} Please review and
            resubmit below.
          </div>
        )}

        {/* Step indicator */}
        <div className="mt-6 flex items-center gap-1.5">
          {steps.map((label, i) => {
            const num = i + 1
            const active = step === num
            const done = step > num
            return (
              <div key={label} className="flex flex-1 items-center gap-1.5">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-green-600 text-white"
                      : active
                        ? "bg-green-100 text-green-700 ring-2 ring-green-600"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : num}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${done ? "bg-green-600" : "bg-gray-200"}`} />
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-sm font-semibold text-green-700">
          Step {step}: {steps[step - 1]}
        </p>

        {/* Step content */}
        <div className="mt-6 flex flex-col gap-4">
          {step === 1 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <div className="flex gap-2">
                  <span className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-[#f3f5f2] px-3 text-sm font-medium text-black">
                    +91
                  </span>
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => update("mobile", sanitizeIndianMobile(e.target.value))}
                    className="h-11 flex-1"
                    disabled={otpPhase === "verified"}
                  />
                  {otpPhase !== "verified" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0"
                      disabled={!isValidIndianMobile(form.mobile) || otpPhase === "sending"}
                      onClick={handleSendOtp}
                    >
                      {otpPhase === "sending" ? "Sending..." : otpPhase === "sent" || otpPhase === "verifying" ? "Resend OTP" : "Send OTP"}
                    </Button>
                  )}
                </div>
                {otpPhase === "verified" && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                    <Check className="size-3.5" />
                    Mobile number verified
                  </p>
                )}
                {(otpPhase === "sent" || otpPhase === "verifying") && (
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(sanitizeOpaqueDigits(e.target.value, 6))}
                      placeholder="Enter 6-digit OTP"
                      inputMode="numeric"
                      maxLength={6}
                      className="h-11"
                    />
                    <Button
                      type="button"
                      className="h-11 shrink-0"
                      disabled={otpCode.trim().length < 4 || otpPhase === "verifying"}
                      onClick={handleVerifyOtp}
                    >
                      {otpPhase === "verifying" ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                )}
                {otpError && <p className="text-xs text-destructive">{otpError}</p>}
                {/* Invisible reCAPTCHA anchor — required by Firebase Phone Auth, not visible to the user. */}
                <div id={RECAPTCHA_CONTAINER_ID} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user.email} disabled className="h-11 bg-[#f3f5f2]" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="shopName">Shop Name</Label>
                <Input
                  id="shopName"
                  value={form.shopName}
                  onChange={(e) => update("shopName", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="businessType">Business Type</Label>
                <Select value={form.businessType} onValueChange={(v) => update("businessType", v ?? "")}>
                  <SelectTrigger id="businessType" className="h-11 w-full">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => update("state", e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(e) => update("pincode", sanitizeDigits(e.target.value, 6))}
                    className="h-11"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bankAccountHolder">Account Holder Name</Label>
                <Input
                  id="bankAccountHolder"
                  value={form.bankAccountHolder}
                  onChange={(e) => update("bankAccountHolder", e.target.value)}
                  className="h-11"
                />
                {accountHolderMismatch && (
                  <p className="text-xs text-yellow-700">
                    This doesn&apos;t match your registered full name (&quot;{form.fullName}&quot;). You can still
                    submit — the review team will verify this manually.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={form.bankName}
                  onChange={(e) => update("bankName", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bankIfsc">IFSC Code</Label>
                <Input
                  id="bankIfsc"
                  value={form.bankIfsc}
                  onChange={(e) => update("bankIfsc", e.target.value.toUpperCase())}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bankAccountNumber">Account Number</Label>
                <Input
                  id="bankAccountNumber"
                  inputMode="numeric"
                  value={form.bankAccountNumber}
                  onChange={(e) => update("bankAccountNumber", sanitizeOpaqueDigits(e.target.value))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bankAccountNumberConfirm">Confirm Account Number</Label>
                <Input
                  id="bankAccountNumberConfirm"
                  inputMode="numeric"
                  value={form.bankAccountNumberConfirm}
                  onChange={(e) => update("bankAccountNumberConfirm", sanitizeOpaqueDigits(e.target.value))}
                  className="h-11"
                />
                {form.bankAccountNumberConfirm.length > 0 && !accountsMatch && (
                  <p className="text-xs text-destructive">Account numbers do not match.</p>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="panNumber">PAN Number</Label>
                <Input
                  id="panNumber"
                  value={form.panNumber}
                  onChange={(e) => update("panNumber", e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="ABCDE1234F"
                  className="h-11"
                />
                {form.panNumber.length > 0 && !isValidPan(form.panNumber) && (
                  <p className="text-xs text-destructive">Enter a valid PAN number (e.g. ABCDE1234F).</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
                <Input
                  id="aadhaarNumber"
                  inputMode="numeric"
                  value={form.aadhaarNumber}
                  onChange={(e) => update("aadhaarNumber", sanitizeOpaqueDigits(e.target.value, 12))}
                  placeholder="12-digit Aadhaar number"
                  className="h-11"
                />
                {form.aadhaarNumber.length > 0 && !isValidAadhaar(form.aadhaarNumber) && (
                  <p className="text-xs text-destructive">Enter a valid 12-digit Aadhaar number.</p>
                )}
              </div>
            </>
          )}

          {step === 5 && (
            <LiveSelfieCapture
              uid={user.uid}
              value={kyc.selfiePath}
              onCaptured={(path) => setKyc((prev) => ({ ...prev, selfiePath: path }))}
            />
          )}

          {step === 6 && (
            <>
              <p className="text-sm text-[#444444]">
                Files are uploaded securely and only visible to you and the review team.
              </p>
              <KycUploadField
                id="aadhaarFront"
                label="Aadhaar Front"
                required
                uid={user.uid}
                docKey="aadhaarFront"
                value={kyc.aadhaarFrontPath}
                onUploaded={(path) => setKyc((prev) => ({ ...prev, aadhaarFrontPath: path }))}
              />
              <KycUploadField
                id="aadhaarBack"
                label="Aadhaar Back"
                required
                uid={user.uid}
                docKey="aadhaarBack"
                value={kyc.aadhaarBackPath}
                onUploaded={(path) => setKyc((prev) => ({ ...prev, aadhaarBackPath: path }))}
              />
              <KycUploadField
                id="pan"
                label="PAN Card"
                required
                uid={user.uid}
                docKey="pan"
                value={kyc.panPath}
                onUploaded={(path) => setKyc((prev) => ({ ...prev, panPath: path }))}
              />
              <KycUploadField
                id="bankProof"
                label="Bank Proof"
                required
                uid={user.uid}
                docKey="bankProof"
                value={kyc.bankProofPath}
                onUploaded={(path) => setKyc((prev) => ({ ...prev, bankProofPath: path }))}
              />
              <KycUploadField
                id="gst"
                label="GST Certificate (optional)"
                uid={user.uid}
                docKey="gst"
                value={kyc.gstPath}
                onUploaded={(path) => setKyc((prev) => ({ ...prev, gstPath: path }))}
              />
            </>
          )}

          {step === 7 && (
            <div className="flex flex-col gap-3">
              <ReviewRow label="Full Name" value={form.fullName} />
              <ReviewRow label="Mobile Number" value={`+91 ${form.mobile} (verified)`} />
              <ReviewRow label="PAN Number" value={form.panNumber} />
              <ReviewRow label="Aadhaar Number" value={form.aadhaarNumber} />
              <ReviewRow label="Shop Name" value={form.shopName} />
              <ReviewRow
                label="Business Type"
                value={businessTypes.find((t) => t.value === form.businessType)?.label ?? ""}
              />
              <ReviewRow label="Address" value={`${form.address}, ${form.city}, ${form.state} - ${form.pincode}`} />
              <ReviewRow
                label="Bank Account"
                value={`${form.bankAccountHolder} · ${form.bankName} · ${form.bankAccountNumber} · ${form.bankIfsc}`}
              />
              <ReviewRow label="Live Selfie" value={kyc.selfiePath ? "Captured" : "Not captured"} />
              <ReviewRow
                label="Documents"
                value={
                  [kyc.aadhaarFrontPath, kyc.aadhaarBackPath, kyc.panPath, kyc.bankProofPath, kyc.gstPath].filter(
                    Boolean,
                  ).length + " uploaded"
                }
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-8 flex gap-3 border-t border-border pt-6">
          {step > 1 && (
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={goBack} disabled={submitting}>
              Back
            </Button>
          )}
          {step < steps.length ? (
            <Button type="button" className="h-11 flex-1" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button type="button" className="h-11 flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </div>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Help &amp; Support</SheetTitle>
          </SheetHeader>
          <div className="p-5">
            <p className="mb-4 text-sm text-[#444444]">
              Having trouble with your seller application? Send us a support request and our team
              will get back to you.
            </p>
            <SupportTicketForm
              sellerId={user.uid}
              sellerName={form.fullName || user.name}
              onSubmitted={() => setHelpOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#444444]">{label}</span>
      <span className="text-sm font-medium text-black">{value || "—"}</span>
    </div>
  )
}
