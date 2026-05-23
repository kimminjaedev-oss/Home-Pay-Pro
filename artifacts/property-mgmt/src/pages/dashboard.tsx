import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetMyHousehold, useCreateCheckout, useGetPaymentHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CreditCard, DollarSign, History, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { data: household, isLoading: isHouseholdLoading, error: householdError } = useGetMyHousehold({ query: { queryKey: ["/api/households/my"] } });
  const { data: historyRes, isLoading: isHistoryLoading } = useGetPaymentHistory({}, { query: { queryKey: ["/api/payments/history"] } });
  const checkoutMutation = useCreateCheckout();
  const { toast } = useToast();

  const [paymentAmount, setPaymentAmount] = useState<string>("");

  const handleSetDefaultAmount = () => {
    if (household) {
      setPaymentAmount(household.totalDue.toFixed(2));
    }
  };

  const handlePay = () => {
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount greater than $0.",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate(
      { data: { amount: amountNum, description: `Maintenance fee - Unit ${household?.unitNumber}` } },
      {
        onSuccess: (res) => {
          window.location.href = res.url;
        },
        onError: (err: any) => {
          toast({
            title: "Payment Error",
            description: err?.error || "Could not initiate payment. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  if (isHouseholdLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-48 col-span-2" />
            <Skeleton className="h-48 col-span-1" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (householdError || !household) {
    return (
      <AppLayout>
        <div className="p-12 text-center bg-white rounded-xl border border-border shadow-sm">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Household Not Found</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            We couldn't find your household record. Please contact property management to link your account to your unit.
          </p>
        </div>
      </AppLayout>
    );
  }

  const hasBalance = household.totalDue > 0;
  const isOverdue = household.monthsOverdue > 0 && household.lateFee > 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Welcome back, {household.ownerName}</h1>
          <p className="text-slate-500">Unit {household.unitNumber} Dashboard</p>
        </div>

        {/* Overdue Warning Banner */}
        {isOverdue && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Overdue Balance</p>
              <p className="text-red-600 text-sm mt-0.5">
                Your account has been overdue for <strong>{household.monthsOverdue} month{household.monthsOverdue !== 1 ? "s" : ""}</strong> since{" "}
                {household.overdueSince ? format(new Date(household.overdueSince), "MMMM d, yyyy") : "a prior date"}.
                A late fee of <strong>${household.lateFee.toFixed(2)}</strong> has been applied at {(household.interestRate * 100).toFixed(1)}%/month.
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* Main Balance Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Total Due */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Total Due</div>
                  <div className={`text-4xl font-bold tracking-tight ${isOverdue ? "text-red-600" : "text-slate-900"}`}>
                    ${household.totalDue.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Balance Breakdown */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">Unpaid Principal</div>
                  <div className="font-semibold text-slate-900">${household.unpaidBalance.toFixed(2)}</div>
                </div>
                <div className={`px-4 py-3 rounded-lg border ${isOverdue ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                  <div className={`text-xs mb-1 flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-slate-500"}`}>
                    {isOverdue && <TrendingUp className="h-3 w-3" />}
                    Late Fee {isOverdue ? `(${household.monthsOverdue}mo)` : ""}
                  </div>
                  <div className={`font-semibold ${isOverdue ? "text-red-700" : "text-slate-400"}`}>
                    ${household.lateFee.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">Monthly Fee</div>
                  <div className="font-semibold text-slate-900">${household.monthlyFee.toFixed(2)}</div>
                </div>
              </div>

              {/* Payment Form */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h4 className="text-sm font-medium text-slate-900 mb-3">Make a Payment</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      type="number"
                      placeholder="Amount"
                      className="pl-7 bg-white"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      data-testid="input-payment-amount"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSetDefaultAmount} disabled={!hasBalance} data-testid="button-pay-full">
                      Pay Full
                    </Button>
                    <Button onClick={handlePay} disabled={checkoutMutation.isPending || !paymentAmount} data-testid="button-submit-payment" className="min-w-[120px]">
                      {checkoutMutation.isPending ? "Processing..." : (
                        <><CreditCard className="mr-2 h-4 w-4" /> Pay Now</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Household Details Card */}
          <Card className="shadow-sm border-slate-200 bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-primary/90">Household Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between pb-2 border-b border-primary/10">
                <span className="text-slate-500">Unit Number</span>
                <span className="font-medium text-slate-900">{household.unitNumber}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-primary/10">
                <span className="text-slate-500">Owner</span>
                <span className="font-medium text-slate-900">{household.ownerName}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-primary/10">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900 truncate max-w-[180px]">{household.email}</span>
              </div>
              {household.overdueSince && (
                <div className="flex justify-between pb-2 border-b border-primary/10">
                  <span className="text-slate-500">Overdue Since</span>
                  <span className="font-medium text-red-600">{format(new Date(household.overdueSince), "MMM d, yyyy")}</span>
                </div>
              )}
              {isOverdue && (
                <div className="flex justify-between pb-2 border-b border-primary/10">
                  <span className="text-slate-500">Interest Rate</span>
                  <span className="font-medium text-slate-900">{(household.interestRate * 100).toFixed(1)}% / month</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge
                  variant={isOverdue ? "destructive" : hasBalance ? "outline" : "secondary"}
                  className={
                    isOverdue ? "" :
                    hasBalance ? "border-yellow-300 text-yellow-800 bg-yellow-50" :
                    "bg-green-100 text-green-800 hover:bg-green-100"
                  }
                >
                  {isOverdue ? "Overdue" : hasBalance ? "Balance Due" : "Up to Date"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" /> Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !historyRes || historyRes.payments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p>No past payments found.</p>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Transaction ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRes.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-slate-900">
                          {format(new Date(payment.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>${payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={payment.status === "completed" ? "secondary" : payment.status === "failed" ? "destructive" : "outline"}
                            className={
                              payment.status === "completed" ? "bg-green-100 text-green-800 hover:bg-green-100 border-transparent" :
                              payment.status === "pending" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-transparent" : ""
                            }
                          >
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 font-mono text-xs">
                          {payment.stripeSessionId ? payment.stripeSessionId.slice(-8) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
