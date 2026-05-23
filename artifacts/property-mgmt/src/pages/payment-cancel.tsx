import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout";

export default function PaymentCancelPage() {
  return (
    <AppLayout>
      <div className="flex justify-center items-center py-12 md:py-24">
        <Card className="w-full max-w-md border-red-100 shadow-sm">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Payment Cancelled</CardTitle>
            <CardDescription className="text-slate-500">
              Your payment process was interrupted.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8">
            <p className="text-sm text-slate-600 mb-6">
              No charges were made to your account. You can try paying again from your dashboard whenever you're ready.
            </p>
            <Link href="/dashboard">
              <Button className="w-full" size="lg" variant="outline" data-testid="button-return-dashboard-cancel">
                <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}