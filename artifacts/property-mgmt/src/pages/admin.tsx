import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetAdminStats, useListHouseholds, useGetAllPayments, useImportHouseholds } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Users, AlertCircle, CheckCircle2, DollarSign, Search, Upload, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ImportRow {
  unitNumber: string;
  ownerName: string;
  email: string;
  unpaidBalance: number;
  overdueSince: string | null;
}

function parseExcelDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    // Excel serial date (days since 1900-01-01, with Excel's leap-year bug offset)
    const d = new Date((raw - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminPage() {
  const { data: stats, isLoading: isStatsLoading } = useGetAdminStats({ query: { queryKey: ["/api/admin/stats"] } });

  const [search, setSearch] = useState("");
  const { data: householdsRes, isLoading: isHouseholdsLoading } = useListHouseholds({ search, limit: 50 }, { query: { queryKey: ["/api/households", { search }] } });

  const { data: paymentsRes, isLoading: isPaymentsLoading } = useGetAllPayments({ limit: 50 }, { query: { queryKey: ["/api/payments/all"] } });

  const importMutation = useImportHouseholds();
  const { toast } = useToast();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: false });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedRows: ImportRow[] = (data as any[]).map((row) => ({
          unitNumber: String(row.Unit || row.unitNumber || row["Unit Number"] || ""),
          ownerName: String(row.Owner || row.Name || row.ownerName || ""),
          email: String(row.Email || row.email || ""),
          unpaidBalance: Number(row.Balance || row.unpaidBalance || row["Unpaid Balance"] || 0),
          overdueSince: parseExcelDate(
            row.OverdueSince ?? row.overdueSince ?? row["Overdue Since"] ?? row["Overdue Date"] ?? null
          ),
        })).filter((row) => row.unitNumber && row.ownerName);

        setParsedRows(mappedRows);
        setIsImportModalOpen(true);
      } catch {
        toast({
          title: "Error parsing file",
          description: "Could not read the Excel file. Please check the format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = () => {
    importMutation.mutate({ data: { rows: parsedRows } }, {
      onSuccess: (res) => {
        setIsImportModalOpen(false);
        setImportFile(null);
        setParsedRows([]);
        toast({
          title: "Import Successful",
          description: `Imported: ${res.imported}, Updated: ${res.updated}, Skipped: ${res.skipped}`,
        });
      },
      onError: () => {
        toast({
          title: "Import Failed",
          description: "An error occurred during import.",
          variant: "destructive",
        });
      },
    });
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
                <div className="text-2xl font-bold text-slate-900">${stats.totalCollected.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Outstanding Balance</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">${stats.totalOutstanding.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Tabs defaultValue="households" className="w-full">
          <TabsList className="grid w-[400px] grid-cols-2 mb-6">
            <TabsTrigger value="households">Households</TabsTrigger>
            <TabsTrigger value="payments">All Payments</TabsTrigger>
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
                    ) : householdsRes?.households.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-slate-900">{h.unitNumber}</TableCell>
                        <TableCell>{h.ownerName}</TableCell>
                        <TableCell className="text-slate-500">{h.email}</TableCell>
                        <TableCell className="text-right font-medium">${h.unpaidBalance.toFixed(2)}</TableCell>
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
                    {householdsRes?.households.length === 0 && (
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
                    ) : paymentsRes?.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-slate-500">
                          {format(new Date(p.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{p.unitNumber || "N/A"}</div>
                          <div className="text-xs text-slate-500">{p.userName || p.userEmail}</div>
                        </TableCell>
                        <TableCell className="font-medium">${p.amount.toFixed(2)}</TableCell>
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
        </Tabs>

        {/* Import Preview Modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Preview Import</DialogTitle>
              <DialogDescription>
                Found {parsedRows.length} valid rows to import. Review before proceeding.
                Columns accepted: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">Unit</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">Owner/Name</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">Email</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">Balance</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">Overdue Since</code> (optional)
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-auto border border-slate-200 rounded-md">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Overdue Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.unitNumber}</TableCell>
                      <TableCell>{r.ownerName}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell className="text-right">${Number(r.unpaidBalance).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.overdueSince ? (
                          <span className="text-red-600">{format(new Date(r.overdueSince), "MMM d, yyyy")}</span>
                        ) : r.unpaidBalance > 0 ? (
                          <span className="text-orange-500 text-xs">Auto-set today</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedRows.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-2 text-sm">
                        ... and {parsedRows.length - 50} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}>Cancel</Button>
              <Button onClick={handleImportSubmit} disabled={importMutation.isPending} data-testid="button-confirm-import">
                {importMutation.isPending ? "Importing..." : "Confirm Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
