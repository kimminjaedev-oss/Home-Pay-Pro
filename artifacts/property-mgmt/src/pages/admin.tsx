import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useGetAdminStats, useGetAllPayments, useGetImportedData, useGetMe, useListHouseholds, useUploadExcel } from "@workspace/api-client-react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, DollarSign, Search, TrendingUp, Upload, Users } from "lucide-react";
import React, { useState } from "react";
import { Link } from "wouter";

export default function AdminPage() {
  const { data: me, isLoading: isMeLoading } = useGetMe({ query: { queryKey: ["/api/auth/me"] } });
  const isAdmin = me?.role === "admin";

  const { data: stats, isLoading: isStatsLoading } = useGetAdminStats({
    query: {
      queryKey: ["/api/admin/stats"],
      enabled: isAdmin,
    },
  });

  const [search, setSearch] = useState("");
  const { data: householdsRes, isLoading: isHouseholdsLoading } = useListHouseholds(
    { search, limit: 50 },
    {
      query: {
        queryKey: ["/api/households", { search }],
        enabled: isAdmin,
      },
    },
  );

  const { data: paymentsRes, isLoading: isPaymentsLoading } = useGetAllPayments(
    { limit: 50 },
    {
      query: {
        queryKey: ["/api/payments/all"],
        enabled: isAdmin,
      },
    },
  );

  const uploadExcelMutation = useUploadExcel();
  const { data: importedDataRes, isLoading: isImportedDataLoading, refetch: refetchImportedData } = useGetImportedData({
    query: {
      queryKey: ["/api/admin/imported-data"],
      enabled: isAdmin,
    },
  });
  const { toast } = useToast();

  if (isMeLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-amber-900">Admin access required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-amber-800">
            <p>
              현재 계정 역할이 <strong>{me?.role ?? "unknown"}</strong> 입니다. 관리자 화면은 <strong>admin</strong> 권한이 필요합니다.
            </p>
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadExcelMutation.mutate({ data: { file } }, {
      onSuccess: (res) => {
        void refetchImportedData();
        toast({
          title: "Upload Successful",
          description: `Imported: ${res.imported}, Updated: ${res.updated}, Skipped: ${res.skipped}`,
        });
      },
      onError: () => {
        toast({
          title: "Upload Failed",
          description: "Could not upload/parse the Excel file. Please check the columns and try again.",
          variant: "destructive",
        });
      },
    });

    e.currentTarget.value = "";
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Property Management Admin</h1>
            <p className="text-slate-500">Overview and operations</p>
          </div>
          <div>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="excel-upload"
                onChange={handleFileUpload}
              />
              <label htmlFor="excel-upload">
                <Button asChild data-testid="button-import-excel">
                  <span><Upload className="mr-2 h-4 w-4" /> Import Excel</span>
                </Button>
              </label>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {isStatsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Units</CardTitle>
                <Users className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{stats.totalHouseholds}</div>
                <div className="text-xs text-slate-500 mt-1 flex gap-2">
                  <span className="text-green-600 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> {stats.paidCount} Paid</span>
                  <span className="text-red-600 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> {stats.unpaidCount} Due</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Collected (MTD)</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">${stats.totalCollected ? stats.totalCollected.toFixed(2) : '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Outstanding Balance</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">${stats.totalOutstanding ? stats.totalOutstanding.toFixed(2) : '0.00'}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Tabs defaultValue="households" className="w-full">
          <TabsList className="grid w-135 grid-cols-3 mb-6">
            <TabsTrigger value="households">Households</TabsTrigger>
            <TabsTrigger value="payments">All Payments</TabsTrigger>
            <TabsTrigger value="imports">Imported Data</TabsTrigger>
          </TabsList>

          <TabsContent value="households" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search units or owners..."
                  className="pl-9 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-households"
                />
              </div>
            </div>

            <Card className="shadow-sm border-slate-200">
              <div className="rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Overdue Since</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isHouseholdsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Skeleton className="h-8 w-full max-w-md mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : householdsRes?.households?.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-slate-900">{h.unitNumber}</TableCell>
                        <TableCell>{h.ownerName}</TableCell>
                        <TableCell className="text-slate-500">{h.email}</TableCell>
                        <TableCell className="text-right font-medium">${h.unpaidBalance ? h.unpaidBalance.toFixed(2) : '0.00'}</TableCell>
                        <TableCell className="text-right text-sm">
                          {h.overdueSince ? (
                            <span className="text-red-600 flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {format(new Date(h.overdueSince), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={h.unpaidBalance > 0 ? "destructive" : "secondary"}
                            className={h.unpaidBalance === 0 ? "bg-green-100 text-green-800" : ""}
                          >
                            {h.unpaidBalance > 0 ? "Due" : "Paid"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {householdsRes?.households?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">No households found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="shadow-sm border-slate-200">
              <div className="rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Unit / Owner</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPaymentsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <Skeleton className="h-8 w-full max-w-md mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : paymentsRes?.payments?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-slate-500">
                          {format(new Date(p.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{p.unitNumber || "N/A"}</div>
                          <div className="text-xs text-slate-500">{p.userName || p.userEmail}</div>
                        </TableCell>
                        <TableCell className="font-medium">${p.amount ? p.amount.toFixed(2) : '0.00'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={p.status === "completed" ? "secondary" : p.status === "failed" ? "destructive" : "outline"}
                            className={
                              p.status === "completed" ? "bg-green-100 text-green-800 border-transparent" :
                              p.status === "pending" ? "bg-yellow-100 text-yellow-800 border-transparent" : ""
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="imports">
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">ImportedHouseholdData (Staging)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md overflow-hidden border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Unpaid Balance</TableHead>
                        <TableHead className="text-right">Imported At</TableHead>
                        <TableHead className="text-right">Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isImportedDataLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Skeleton className="h-8 w-full max-w-md mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : importedDataRes?.data?.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-slate-900">{row.unitNumber}</TableCell>
                          <TableCell>{row.ownerName}</TableCell>
                          <TableCell className="text-slate-500">{row.email}</TableCell>
                          <TableCell className="text-right font-medium">${row.unpaidBalance.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-slate-500 text-sm">{format(new Date(row.importedAt), "MMM d, yyyy h:mm a")}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.isMatched ? "secondary" : "outline"} className={row.isMatched ? "bg-green-100 text-green-800" : ""}>
                              {row.isMatched ? `Matched${row.matchedUserId ? ` (#${row.matchedUserId})` : ""}` : "Unmatched"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!isImportedDataLoading && (importedDataRes?.data?.length ?? 0) === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">No imported staging rows yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
