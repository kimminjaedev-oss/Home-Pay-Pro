import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout";

export default function PaymentSuccessPage() {
  return (
    <AppLayout>
      <div className="flex justify-center items-center py-12 md:py-24">
        <Card className="w-full max-w-md border-green-100 shadow-sm">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Payment Successful</CardTitle>
            <CardDescription className="text-slate-500">
              Thank you! Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8">
            <p className="text-sm text-slate-600 mb-6">
              A receipt has been sent to your registered email address. Your balance will be updated momentarily.
            </p>
            <Link href="/dashboard">
              <Button className="w-full" size="lg" data-testid="button-return-dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}