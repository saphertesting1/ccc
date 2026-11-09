import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckSquare, 
  Square, 
  Search, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles,
  Layers,
  ShoppingBag,
  Filter,
  CreditCard,
  TrendingUp,
  Package,
  Clock,
  ChevronDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Product } from '../types/index.js';
import { api, getKolkataDateString } from '../services/api.js';
import { useShop } from '../context/ShopContext.js';

type ExportFormat = 'PDF' | 'Excel' | 'CSV';
type DatePreset = 'today' | 'yesterday' | 'last7days' | 'monthly' | 'custom';

interface ProductReportRow {
  slNo: number;
  productId: string;
  productName: string;
  weightSoldFormatted: string;
  weightSoldKg: number;
  quantityPacks: number;
  salesAmount: number;
}

interface DailyReportRow {
  date: string;
  orderCount: number;
  weightKg: number;
  salesValue: number;
}

interface OrderReportRow {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  itemCount: number;
}

interface GeneratedReportState {
  title: string;
  shopName: string;
  shopContact: string;
  shopAddress: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  selectedProductNames: string;
  productRows: ProductReportRow[];
  dailyRows: DailyReportRow[];
  orderRows: OrderReportRow[];
  totalOrdersCount: number;
  totalWeightSoldKg: number;
  totalQuantityPacks: number;
  totalSalesAmount: number;
  paymentBreakdown: {
    COD: { count: number; amount: number };
    UPI: { count: number; amount: number; paidCount: number; paidAmount: number; pendingCount: number; pendingAmount: number };
    Cash: { count: number; amount: number };
  };
  hasData: boolean;
}

export default function AdminReportsPage() {
  const { settings } = useShop();

  // Products list from actual database
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // Timezone-aware date helpers (Asia/Kolkata)
  const todayKolkata = getKolkataDateString(new Date());
  const yesterdayKolkata = getKolkataDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const sevenDaysAgoKolkata = getKolkataDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgoKolkata = getKolkataDateString(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  
  // First day of current month in Indian timezone
  const startOfMonthKolkata = todayKolkata.slice(0, 8) + '01';

  // Form State
  const [datePreset, setDatePreset] = useState<DatePreset>('last7days');
  const [startDate, setStartDate] = useState(sevenDaysAgoKolkata);
  const [endDate, setEndDate] = useState(todayKolkata);
  const [isAllProducts, setIsAllProducts] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PDF');

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReportState | null>(null);

  // Load actual catalog products from database
  useEffect(() => {
    async function fetchProducts() {
      try {
        setIsProductsLoading(true);
        const prods = await api.getAdminProducts();
        setAllProducts(prods);
        setSelectedProductIds(prods.map(p => p.id));
      } catch (err) {
        console.error('Failed to load products for reports:', err);
      } finally {
        setIsProductsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Filtered product items for selection list
  const displayedProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.toLowerCase().trim();
    return allProducts.filter(p => p.name.toLowerCase().includes(q));
  }, [allProducts, productSearch]);

  // Handle Date Preset Changes (Issue 9)
  const handleApplyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayKolkata);
      setEndDate(todayKolkata);
    } else if (preset === 'yesterday') {
      setStartDate(yesterdayKolkata);
      setEndDate(yesterdayKolkata);
    } else if (preset === 'last7days') {
      setStartDate(sevenDaysAgoKolkata);
      setEndDate(todayKolkata);
    } else if (preset === 'monthly') {
      setStartDate(startOfMonthKolkata);
      setEndDate(todayKolkata);
    }
  };

  // Handle All Products toggle
  const handleToggleAllProducts = () => {
    if (isAllProducts) {
      setIsAllProducts(false);
      setSelectedProductIds([]);
    } else {
      setIsAllProducts(true);
      setSelectedProductIds(allProducts.map(p => p.id));
    }
  };

  // Handle individual product selection
  const handleToggleProduct = (id: string) => {
    let nextIds: string[];
    if (selectedProductIds.includes(id)) {
      nextIds = selectedProductIds.filter(pid => pid !== id);
    } else {
      nextIds = [...selectedProductIds, id];
    }
    setSelectedProductIds(nextIds);
    setIsAllProducts(nextIds.length === allProducts.length && allProducts.length > 0);
  };

  // Validate inputs
  const validateForm = (): boolean => {
    if (!startDate || !endDate) {
      setValidationError('Please select both Start Date and End Date.');
      return false;
    }
    if (endDate < startDate) {
      setValidationError('End Date must be on or after Start Date.');
      return false;
    }
    if (!isAllProducts && selectedProductIds.length === 0) {
      setValidationError('Please select at least one product or choose "All Products".');
      return false;
    }
    setValidationError(null);
    return true;
  };

  // Generate Report from database order records (Issue 9 Fix)
  const handleGenerateReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsGenerating(true);
      setValidationError(null);

      const targetProductIds = isAllProducts ? allProducts.map(p => p.id) : selectedProductIds;

      const rawReport = await api.getReports({
        startDate,
        endDate,
        productIds: targetProductIds
      });

      const filterReport = rawReport.filterReport || {};
      const productBreakdown = filterReport.productBreakdown || [];
      const dailyBreakdown = filterReport.dailyBreakdown || [];
      const orderBreakdown = filterReport.orderBreakdown || [];

      // Map product breakdown rows
      const productRows: ProductReportRow[] = productBreakdown.map((item: any, idx: number) => ({
        slNo: idx + 1,
        productId: item.productId,
        productName: item.productName,
        weightSoldFormatted: item.displayWeight || (item.totalWeightKg > 0 ? `${item.totalWeightKg.toFixed(2)} kg` : `${item.totalQuantity} packs`),
        weightSoldKg: item.totalWeightKg || 0,
        quantityPacks: item.totalQuantity || 0,
        salesAmount: item.totalSalesValue || 0
      }));

      // Map daily breakdown rows
      const dailyRows: DailyReportRow[] = dailyBreakdown.map((item: any) => ({
        date: item.date,
        orderCount: item.orderCount || 0,
        weightKg: Number((item.weightKg || 0).toFixed(2)),
        salesValue: item.salesValue || 0
      }));

      // Map individual orders
      const orderRows: OrderReportRow[] = orderBreakdown.map((item: any) => ({
        orderNumber: item.orderNumber,
        createdAt: item.createdAt,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        totalAmount: item.totalAmount || 0,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        orderStatus: item.orderStatus,
        itemCount: item.itemCount || 0
      }));

      const totalWeight = filterReport.totalWeightSoldKg || productRows.reduce((acc, r) => acc + r.weightSoldKg, 0);
      const totalAmount = filterReport.totalSalesValue || productRows.reduce((acc, r) => acc + r.salesAmount, 0);
      const totalPacks = filterReport.totalQuantitySold || productRows.reduce((acc, r) => acc + r.quantityPacks, 0);
      const totalOrders = filterReport.totalOrdersCount || orderRows.length;

      const paymentBreakdown = filterReport.paymentBreakdown || {
        COD: { count: 0, amount: 0 },
        UPI: { count: 0, amount: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0 },
        Cash: { count: 0, amount: 0 }
      };

      const selectedNames = isAllProducts
        ? 'All Products'
        : allProducts
            .filter(p => selectedProductIds.includes(p.id))
            .map(p => p.name)
            .join(', ');

      const reportState: GeneratedReportState = {
        title: 'CHANDU CHICKEN CENTER — SALES & REVENUE REPORT',
        shopName: settings?.shopName || 'Chandu Chicken Center',
        shopContact: `${settings?.shopPhone || '+91 98480 22338'} | WhatsApp: ${settings?.shopWhatsApp || '+91 98480 22338'}`,
        shopAddress: settings?.address || 'Shop No. 4, Main Road, Market Junction, Near RTC Bus Stand',
        startDate,
        endDate,
        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
        selectedProductNames: selectedNames,
        productRows,
        dailyRows,
        orderRows,
        totalOrdersCount: totalOrders,
        totalWeightSoldKg: parseFloat(totalWeight.toFixed(2)),
        totalQuantityPacks: totalPacks,
        totalSalesAmount: totalAmount,
        paymentBreakdown,
        hasData: productRows.length > 0 || orderRows.length > 0
      };

      setGeneratedReport(reportState);

      // Automatically trigger chosen export format
      if (exportFormat === 'PDF') {
        downloadPdf(reportState);
      } else if (exportFormat === 'Excel') {
        downloadExcel(reportState);
      } else if (exportFormat === 'CSV') {
        downloadCsv(reportState);
      }

    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setValidationError(err.message || 'Failed to compile report records from Supabase database');
    } finally {
      setIsGenerating(false);
    }
  };

  // =========================================================================
  // Document Exports (PDF, Excel, CSV)
  // =========================================================================

  const downloadPdf = (rep = generatedReport) => {
    if (!rep) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(217, 35, 50); // Brand Red
    doc.text('CHANDU CHICKEN CENTER', 14, 16);

    doc.setFontSize(12);
    doc.setTextColor(56, 37, 31);
    doc.text('OFFICIAL SALES & REVENUE AUDIT REPORT', 14, 22);

    // Subheader Shop Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Contact: ${rep.shopContact}`, 14, 28);
    doc.text(`Address: ${rep.shopAddress}`, 14, 32);

    // Reporting Metadata
    doc.setFont('helvetica', 'bold');
    doc.text(`Reporting Period: ${rep.startDate} to ${rep.endDate} (Asia/Kolkata)`, 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${rep.generatedAt} | Total Completed Orders: ${rep.totalOrdersCount}`, 14, 43);

    // 1. Product Breakdown Table
    const productTableData = rep.productRows.map(r => [
      r.slNo.toString(),
      r.productName,
      r.weightSoldFormatted,
      `Rs. ${r.salesAmount.toLocaleString('en-IN')}`
    ]);

    const productFootData = [
      [
        '',
        'TOTAL SALES',
        `${rep.totalWeightSoldKg > 0 ? `${rep.totalWeightSoldKg.toFixed(2)} kg` : ''} (${rep.totalQuantityPacks} packs)`,
        `Rs. ${rep.totalSalesAmount.toLocaleString('en-IN')}`
      ]
    ];

    autoTable(doc, {
      startY: 48,
      head: [['Sl.', 'Product Name', 'Weight / Quantity Sold', 'Sales Amount']],
      body: productTableData,
      foot: productFootData,
      theme: 'grid',
      headStyles: {
        fillColor: [56, 37, 31],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      footStyles: {
        fillColor: [254, 243, 199],
        textColor: [56, 37, 31],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 85 },
        2: { cellWidth: 45, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' }
      },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    // 2. Payment Method Summary Table
    const lastY = (doc as any).lastAutoTable?.finalY || 100;
    const paymentTableData = [
      ['Cash on Delivery (COD)', `${rep.paymentBreakdown.COD.count} orders`, `Rs. ${rep.paymentBreakdown.COD.amount.toLocaleString('en-IN')}`],
      ['UPI (Completed/Paid)', `${rep.paymentBreakdown.UPI.paidCount} orders`, `Rs. ${rep.paymentBreakdown.UPI.paidAmount.toLocaleString('en-IN')}`],
      ['In-Store Cash (Walk-in)', `${rep.paymentBreakdown.Cash.count} orders`, `Rs. ${rep.paymentBreakdown.Cash.amount.toLocaleString('en-IN')}`]
    ];

    autoTable(doc, {
      startY: lastY + 8,
      head: [['Payment Method Breakdown', 'Order Count', 'Settled Value']],
      body: paymentTableData,
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    doc.save(`chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.pdf`);
  };

  const downloadExcel = (rep = generatedReport) => {
    if (!rep) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Product-wise Summary
    const productSheetData = [
      ['CHANDU CHICKEN CENTER — SALES & REVENUE REPORT'],
      [`Shop Name: ${rep.shopName}`],
      [`Contact: ${rep.shopContact}`],
      [`Address: ${rep.shopAddress}`],
      [`Reporting Period: ${rep.startDate} to ${rep.endDate} (Asia/Kolkata)`],
      [`Generated On: ${rep.generatedAt}`],
      [],
      ['PRODUCT-WISE SALES SUMMARY'],
      ['Sl. No.', 'Product Name', 'Weight / Quantity Sold', 'Sales Amount (INR)'],
      ...rep.productRows.map(r => [r.slNo, r.productName, r.weightSoldFormatted, r.salesAmount]),
      [],
      ['', 'TOTAL ORDERS:', rep.totalOrdersCount, ''],
      ['', 'TOTAL WEIGHT SOLD:', `${rep.totalWeightSoldKg.toFixed(2)} kg`, ''],
      ['', 'TOTAL PACKS SOLD:', `${rep.totalQuantityPacks} packs`, ''],
      ['', 'TOTAL SALES VALUE:', `INR ${rep.totalSalesAmount.toLocaleString('en-IN')}`, rep.totalSalesAmount],
      [],
      ['PAYMENT METHOD BREAKDOWN'],
      ['Method', 'Completed Orders', 'Settled Amount (INR)'],
      ['Cash on Delivery (COD)', rep.paymentBreakdown.COD.count, rep.paymentBreakdown.COD.amount],
      ['UPI (Paid)', rep.paymentBreakdown.UPI.paidCount, rep.paymentBreakdown.UPI.paidAmount],
      ['UPI (Pending)', rep.paymentBreakdown.UPI.pendingCount, rep.paymentBreakdown.UPI.pendingAmount],
      ['In-Store Cash', rep.paymentBreakdown.Cash.count, rep.paymentBreakdown.Cash.amount]
    ];

    const wsProduct = XLSX.utils.aoa_to_sheet(productSheetData);
    wsProduct['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsProduct, 'Product Sales Summary');

    // Sheet 2: Order-wise Details
    if (rep.orderRows.length > 0) {
      const orderSheetData = [
        ['ORDER-WISE SALES DETAILS'],
        [`Period: ${rep.startDate} to ${rep.endDate}`],
        [],
        ['Order #', 'Date & Time', 'Customer Name', 'Phone', 'Items', 'Payment Method', 'Payment Status', 'Order Status', 'Total (INR)'],
        ...rep.orderRows.map(o => [
          o.orderNumber,
          new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          o.customerName,
          o.customerPhone,
          o.itemCount,
          o.paymentMethod,
          o.paymentStatus,
          o.orderStatus,
          o.totalAmount
        ])
      ];
      const wsOrders = XLSX.utils.aoa_to_sheet(orderSheetData);
      wsOrders['!cols'] = [
        { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Order Details');
    }

    // Sheet 3: Daily Breakdown
    if (rep.dailyRows.length > 0) {
      const dailySheetData = [
        ['DATE-WISE SALES BREAKDOWN'],
        [`Period: ${rep.startDate} to ${rep.endDate}`],
        [],
        ['Date (YYYY-MM-DD)', 'Orders Count', 'Weight Sold (kg)', 'Sales Amount (INR)'],
        ...rep.dailyRows.map(d => [d.date, d.orderCount, d.weightKg, d.salesValue])
      ];
      const wsDaily = XLSX.utils.aoa_to_sheet(dailySheetData);
      wsDaily['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Breakdown');
    }

    XLSX.writeFile(wb, `chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.xlsx`);
  };

  const downloadCsv = (rep = generatedReport) => {
    if (!rep) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `"CHANDU CHICKEN CENTER — SALES & REVENUE REPORT"\r\n`;
    csvContent += `"Period","${rep.startDate} to ${rep.endDate} (Asia/Kolkata)"\r\n`;
    csvContent += `"Generated On","${rep.generatedAt}"\r\n\r\n`;

    csvContent += `"Sl. No.","Product Name","Weight / Quantity Sold","Sales Amount (INR)"\r\n`;
    rep.productRows.forEach(r => {
      csvContent += `"${r.slNo}","${r.productName.replace(/"/g, '""')}","${r.weightSoldFormatted}","${r.salesAmount}"\r\n`;
    });

    csvContent += `\r\n"","TOTAL ORDERS","${rep.totalOrdersCount}",""\r\n`;
    csvContent += `"","TOTAL WEIGHT SOLD","${rep.totalWeightSoldKg.toFixed(2)} kg",""\r\n`;
    csvContent += `"","TOTAL PACKS SOLD","${rep.totalQuantityPacks} packs",""\r\n`;
    csvContent += `"","TOTAL SALES AMOUNT","INR ${rep.totalSalesAmount}","${rep.totalSalesAmount}"\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe Isolated Print Function (Issue 10)
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Page Title & Context (Hidden during print) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D92332] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Accounting & Reconciliation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#38251F]">
              Sales Reports
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Generate detailed sales audits, product breakdowns, payment reconciliation, and printable A4 statements.
            </p>
          </div>
        </div>
      </div>

      {/* Report Configuration Form (Hidden during print) */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-5 sm:p-7 space-y-6 no-print">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <Filter className="w-4 h-4 text-[#D92332]" />
          <h2 className="font-extrabold text-base text-[#38251F]">
            Report Configuration Form
          </h2>
        </div>

        {validationError && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleGenerateReport} className="space-y-6">
          {/* A. Date Range with Presets (Issue 9) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-stone-700">
                A. Date Range & Period (Asia/Kolkata Timezone) <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-stone-400 font-medium">
                Current Shop Date: {todayKolkata}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'today' as DatePreset, label: 'Today' },
                { id: 'yesterday' as DatePreset, label: 'Yesterday' },
                { id: 'last7days' as DatePreset, label: 'Last 7 Days' },
                { id: 'monthly' as DatePreset, label: 'This Month' },
                { id: 'custom' as DatePreset, label: 'Custom Range' }
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    datePreset === preset.id
                      ? 'bg-[#38251F] text-amber-300 border-[#38251F] shadow-xs'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <span className="block text-[11px] text-stone-500 font-semibold mb-1">Start Date</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  max={todayKolkata}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>

              <div>
                <span className="block text-[11px] text-stone-500 font-semibold mb-1">End Date</span>
                <input
                  type="date"
                  required
                  value={endDate}
                  max={todayKolkata}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
              </div>
            </div>
            {endDate < startDate && (
              <p className="text-[11px] text-red-600 font-medium">
                End date cannot be earlier than start date.
              </p>
            )}
          </div>

          {/* B. Product Selection */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-stone-700">
                B. Product Selection <span className="text-red-500">*</span>
              </label>
              <div className="text-xs text-stone-500 font-medium">
                {isAllProducts ? (
                  <span className="text-emerald-700 font-bold">• All Products Selected ({allProducts.length})</span>
                ) : (
                  <span>{selectedProductIds.length} of {allProducts.length} products selected</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggleAllProducts}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                  isAllProducts
                    ? 'bg-[#38251F] text-amber-300 border-[#38251F] shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                {isAllProducts ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-stone-400" />}
                <span>All Products</span>
              </button>

              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Filter product list (e.g. curry cut, biryani, boneless)..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Individual Products Selection */}
            <div className="bg-stone-50 p-3 sm:p-4 rounded-2xl border border-stone-200/80 max-h-56 overflow-y-auto space-y-2">
              {isProductsLoading ? (
                <div className="text-xs text-stone-400 text-center py-4">Loading catalog products...</div>
              ) : displayedProducts.length === 0 ? (
                <div className="text-xs text-stone-400 text-center py-4">No matching products found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {displayedProducts.map(p => {
                    const isChecked = selectedProductIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleToggleProduct(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 text-xs ${
                          isChecked
                            ? 'bg-white border-[#D92332] text-[#38251F] shadow-2xs font-bold'
                            : 'bg-white/60 border-stone-200 text-stone-600 hover:bg-white'
                        }`}
                      >
                        <div className="shrink-0 text-[#D92332]">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-300" />
                          )}
                        </div>
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-7 h-7 rounded-lg object-cover bg-stone-100 shrink-0 border border-stone-200"
                        />
                        <span className="truncate flex-1">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* C. Export Format Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              C. Export Download Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'PDF' as ExportFormat, label: 'PDF Document', desc: 'A4 formatted PDF', icon: FileText },
                { id: 'Excel' as ExportFormat, label: 'Excel (.xlsx)', desc: 'Multi-sheet workbook', icon: FileSpreadsheet },
                { id: 'CSV' as ExportFormat, label: 'CSV File', desc: 'Raw values table', icon: Download }
              ].map(fmt => (
                <label
                  key={fmt.id}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col sm:flex-row items-center sm:items-start gap-2.5 text-center sm:text-left ${
                    exportFormat === fmt.id
                      ? 'bg-amber-50/60 border-[#D92332] text-[#38251F] shadow-2xs font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value={fmt.id}
                    checked={exportFormat === fmt.id}
                    onChange={() => setExportFormat(fmt.id)}
                    className="sr-only"
                  />
                  <div className={`p-1.5 rounded-lg ${exportFormat === fmt.id ? 'bg-[#D92332] text-white' : 'bg-stone-200 text-stone-600'}`}>
                    <fmt.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{fmt.label}</div>
                    <div className="text-[10px] text-stone-500 hidden sm:block">{fmt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* D. Generate Report Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating || endDate < startDate || (!isAllProducts && selectedProductIds.length === 0)}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#D92332] hover:bg-[#b81d2a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Compiling Supabase Records...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Report Output (Dedicated Printable Container - Issue 10) */}
      {generatedReport && (
        <div id="printable-sales-report" className="printable-report-area space-y-6">
          {/* Action Toolbar on Screen (Hidden on Print) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  ✓ Report Generated Successfully
                </span>
                <span className="text-xs text-stone-500">
                  {generatedReport.totalOrdersCount} Completed Orders
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Period: <strong className="text-[#38251F]">{generatedReport.startDate}</strong> to <strong className="text-[#38251F]">{generatedReport.endDate}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadPdf(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download PDF Document"
              >
                <FileText className="w-3.5 h-3.5 text-red-600" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadExcel(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Excel Workbook"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-700" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="px-4 py-2 bg-[#38251F] hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Print report on A4 paper"
              >
                <Printer className="w-3.5 h-3.5 text-amber-300" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* Actual Report Sheet (Visible on screen and pristine on A4 print) */}
          <div className="bg-white rounded-3xl border border-stone-300 shadow-md p-6 sm:p-10 space-y-7 print:shadow-none print:border-none print:p-0">
            {/* 1. Official Letterhead / Header */}
            <div className="text-center space-y-1.5 border-b-2 border-[#D92332] pb-5">
              <h2 className="text-2xl sm:text-3xl font-black text-[#D92332] tracking-tight font-serif uppercase">
                {generatedReport.shopName}
              </h2>
              <div className="text-xs sm:text-sm font-extrabold text-[#38251F]">
                Official Sales & Revenue Audit Statement
              </div>
              <div className="text-[11px] text-stone-500 max-w-lg mx-auto">
                {generatedReport.shopContact} • {generatedReport.shopAddress}
              </div>
            </div>

            {/* 2. Metadata Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Reporting Period</span>
                <span className="font-extrabold text-[#38251F]">{generatedReport.startDate} to {generatedReport.endDate}</span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Generated At</span>
                <span className="font-extrabold text-[#38251F]">{generatedReport.generatedAt}</span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Timezone</span>
                <span className="font-extrabold text-[#38251F]">Asia/Kolkata (IST)</span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Product Scope</span>
                <span className="font-extrabold text-[#38251F] truncate block" title={generatedReport.selectedProductNames}>
                  {generatedReport.selectedProductNames}
                </span>
              </div>
            </div>

            {/* 3. Key Financial & Quantity Metrics Summary (All 4 core totals) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-red-50/70 rounded-2xl border border-red-200/80">
                <span className="text-[11px] font-bold text-red-900 uppercase">1. Total Sales Amount</span>
                <div className="text-xl sm:text-2xl font-black text-[#D92332] mt-1">
                  ₹{generatedReport.totalSalesAmount.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-stone-500">Excludes cancelled & rejected</span>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-[11px] font-bold text-stone-700 uppercase">2. Completed Orders</span>
                <div className="text-xl sm:text-2xl font-black text-[#38251F] mt-1">
                  {generatedReport.totalOrdersCount}
                </div>
                <span className="text-[10px] text-stone-500">Delivered & active orders</span>
              </div>

              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80">
                <span className="text-[11px] font-bold text-amber-900 uppercase">3. Total Weight Sold</span>
                <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1">
                  {generatedReport.totalWeightSoldKg.toFixed(2)} kg
                </div>
                <span className="text-[10px] text-stone-500">Cleaned net chicken meat</span>
              </div>

              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-900 uppercase">4. Products / Packs Sold</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-1">
                  {generatedReport.totalQuantityPacks}
                </div>
                <span className="text-[10px] text-stone-500">Individual carved packages</span>
              </div>
            </div>

            {/* 4. Payment Method Reconciliation (Requirement 7) */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#D92332]" />
                <span>Payment Settlement Breakdown</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 font-semibold text-[11px]">Cash on Delivery (COD)</div>
                  <div className="text-base font-black text-[#38251F] mt-0.5">
                    ₹{generatedReport.paymentBreakdown.COD.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-stone-400">{generatedReport.paymentBreakdown.COD.count} orders</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 font-semibold text-[11px]">UPI / QR Online</div>
                  <div className="text-base font-black text-emerald-700 mt-0.5">
                    ₹{generatedReport.paymentBreakdown.UPI.paidAmount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {generatedReport.paymentBreakdown.UPI.paidCount} paid
                    {generatedReport.paymentBreakdown.UPI.pendingCount > 0 && ` (${generatedReport.paymentBreakdown.UPI.pendingCount} pending)`}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 font-semibold text-[11px]">In-Store Cash (Walk-in)</div>
                  <div className="text-base font-black text-[#38251F] mt-0.5">
                    ₹{generatedReport.paymentBreakdown.Cash.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-stone-400">{generatedReport.paymentBreakdown.Cash.count} orders</div>
                </div>
              </div>
            </div>

            {/* 5. Product-wise Sales Table (Requirements 5 & 6) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#38251F] flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#D92332]" />
                <span>Product-Wise Sales & Weight Breakdown</span>
              </h3>

              {!generatedReport.hasData ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <AlertCircle className="w-7 h-7 text-amber-500 mx-auto" />
                  <p className="font-bold text-stone-700 text-sm">No Sales Records Found</p>
                  <p className="text-xs text-stone-500">
                    No completed orders matching your product filter between {generatedReport.startDate} and {generatedReport.endDate}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-stone-300 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#38251F] text-white font-bold border-b border-stone-300 text-[11px]">
                        <th className="py-2.5 px-3 w-12 text-center border-r border-stone-700">Sl.</th>
                        <th className="py-2.5 px-3 border-r border-stone-700">Product Name</th>
                        <th className="py-2.5 px-3 text-right border-r border-stone-700">Weight / Quantity Sold</th>
                        <th className="py-2.5 px-3 text-right">Sales Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-800">
                      {generatedReport.productRows.map(row => (
                        <tr key={row.productId} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2 px-3 text-center font-bold text-stone-500 border-r border-stone-200">
                            {row.slNo}
                          </td>
                          <td className="py-2 px-3 font-bold text-[#38251F] border-r border-stone-200">
                            {row.productName}
                          </td>
                          <td className="py-2 px-3 text-right font-medium border-r border-stone-200">
                            {row.weightSoldFormatted}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#38251F]">
                            ₹{row.salesAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#FFF9F1] border-t-2 border-stone-400 font-black text-xs text-[#38251F]">
                        <td colSpan={2} className="py-2.5 px-3 text-right uppercase tracking-wider border-r border-stone-300">
                          Total Summary:
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-stone-300">
                          {generatedReport.totalWeightSoldKg.toFixed(2)} kg ({generatedReport.totalQuantityPacks} packs)
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#D92332] text-sm">
                          ₹{generatedReport.totalSalesAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 6. Date-wise Sales Table (Requirement 9) */}
            {generatedReport.dailyRows.length > 0 && (
              <div className="space-y-2 pt-2 print:page-break">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#38251F] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#D92332]" />
                  <span>Date-Wise Sales Breakdown (Indian Standard Time)</span>
                </h3>
                <div className="overflow-x-auto bg-white rounded-xl border border-stone-300 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-800 text-white font-bold text-[11px]">
                        <th className="py-2 px-3 border-r border-stone-700">Date (YYYY-MM-DD)</th>
                        <th className="py-2 px-3 text-center border-r border-stone-700">Orders Count</th>
                        <th className="py-2 px-3 text-right border-r border-stone-700">Weight Sold (kg)</th>
                        <th className="py-2 px-3 text-right">Daily Revenue (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {generatedReport.dailyRows.map(day => (
                        <tr key={day.date} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-mono font-bold text-stone-700 border-r border-stone-200">
                            {day.date}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-[#38251F] border-r border-stone-200">
                            {day.orderCount}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-stone-600 border-r border-stone-200">
                            {day.weightKg > 0 ? `${day.weightKg.toFixed(2)} kg` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#D92332]">
                            ₹{day.salesValue.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Order-wise Sales Details (Requirement 8) */}
            {generatedReport.orderRows.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#38251F] flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#D92332]" />
                  <span>Order-Wise Completed Records ({generatedReport.orderRows.length})</span>
                </h3>
                <div className="overflow-x-auto bg-white rounded-xl border border-stone-300 shadow-2xs max-h-96 overflow-y-auto print:max-h-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-800 text-white font-bold text-[11px] sticky top-0 print:static">
                        <th className="py-2 px-3 border-r border-stone-700">Order #</th>
                        <th className="py-2 px-3 border-r border-stone-700">Date & Time</th>
                        <th className="py-2 px-3 border-r border-stone-700">Customer & Phone</th>
                        <th className="py-2 px-3 text-center border-r border-stone-700">Items</th>
                        <th className="py-2 px-3 border-r border-stone-700">Payment</th>
                        <th className="py-2 px-3 border-r border-stone-700">Status</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {generatedReport.orderRows.map(o => (
                        <tr key={o.orderNumber} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-mono font-bold text-[#D92332] border-r border-stone-200">
                            {o.orderNumber}
                          </td>
                          <td className="py-2 px-3 text-stone-600 border-r border-stone-200 text-[11px]">
                            {new Date(o.createdAt).toLocaleDateString('en-IN')} {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="py-2 px-3 border-r border-stone-200">
                            <div className="font-bold text-[#38251F]">{o.customerName}</div>
                            <div className="text-[10px] text-stone-500">{o.customerPhone}</div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold border-r border-stone-200">
                            {o.itemCount}
                          </td>
                          <td className="py-2 px-3 border-r border-stone-200 text-[11px]">
                            {o.paymentMethod} • <span className="font-semibold">{o.paymentStatus}</span>
                          </td>
                          <td className="py-2 px-3 border-r border-stone-200 text-[11px]">
                            <span className="font-bold text-emerald-800">{o.orderStatus}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-[#D92332]">
                            ₹{o.totalAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Print Sign-off Footer */}
            <div className="pt-6 border-t border-stone-200 text-center text-[10px] text-stone-400 space-y-1">
              <div>Chandu Chicken Center — Farm Fresh Quality Chicken Products</div>
              <div>Report generated on {generatedReport.generatedAt} (Asia/Kolkata)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
