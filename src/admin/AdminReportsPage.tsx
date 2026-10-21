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
  ArrowRight,
  Sparkles,
  Layers,
  ShoppingBag,
  Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Product, ShopSettings } from '../types/index.js';
import { api } from '../services/api.js';
import { useShop } from '../context/ShopContext.js';

type ExportFormat = 'PDF' | 'Excel' | 'CSV';

interface ReportRow {
  slNo: number;
  productId: string;
  productName: string;
  weightSoldFormatted: string;
  weightSoldKg: number;
  quantityPacks: number;
  salesAmount: number;
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
  rows: ReportRow[];
  totalWeightSoldKg: number;
  totalQuantityPacks: number;
  totalSalesAmount: number;
  hasData: boolean;
}

export default function AdminReportsPage() {
  const { settings } = useShop();

  // Products from actual database
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
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

  // Filtered product items for selection
  const displayedProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.toLowerCase().trim();
    return allProducts.filter(p => p.name.toLowerCase().includes(q));
  }, [allProducts, productSearch]);

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

  // Generate Report from database order records
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

      const filterReport = rawReport.filterReport;
      const productBreakdown = filterReport?.productBreakdown || [];

      // Map to spreadsheet table rows
      const rows: ReportRow[] = [];
      let slNo = 1;

      for (const item of productBreakdown) {
        rows.push({
          slNo: slNo++,
          productId: item.productId,
          productName: item.productName,
          weightSoldFormatted: item.displayWeight || (item.totalWeightKg > 0 ? `${item.totalWeightKg.toFixed(2)} kg` : `${item.totalQuantity} packs`),
          weightSoldKg: item.totalWeightKg || 0,
          quantityPacks: item.totalQuantity || 0,
          salesAmount: item.totalSalesValue || 0
        });
      }

      const totalWeight = filterReport?.totalWeightSoldKg || rows.reduce((acc, r) => acc + r.weightSoldKg, 0);
      const totalAmount = filterReport?.totalSalesValue || rows.reduce((acc, r) => acc + r.salesAmount, 0);
      const totalPacks = filterReport?.totalQuantitySold || rows.reduce((acc, r) => acc + r.quantityPacks, 0);

      const selectedNames = isAllProducts
        ? 'All Products'
        : allProducts
            .filter(p => selectedProductIds.includes(p.id))
            .map(p => p.name)
            .join(', ');

      const reportState: GeneratedReportState = {
        title: 'CHANDU CHICKEN CENTER — SALES REPORT',
        shopName: settings?.shopName || 'Chandu Chicken Center',
        shopContact: `${settings?.shopPhone || '+91 98480 22338'} | WhatsApp: ${settings?.shopWhatsApp || '+91 98480 22338'}`,
        shopAddress: settings?.address || 'Near Rythu Bazar, Main Road, Hyderabad, Telangana',
        startDate,
        endDate,
        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
        selectedProductNames: selectedNames,
        rows,
        totalWeightSoldKg: parseFloat(totalWeight.toFixed(2)),
        totalQuantityPacks: totalPacks,
        totalSalesAmount: totalAmount,
        hasData: rows.length > 0
      };

      setGeneratedReport(reportState);

      // Auto-trigger export based on selected radio
      if (exportFormat === 'PDF') {
        downloadPdf(reportState);
      } else if (exportFormat === 'Excel') {
        downloadExcel(reportState);
      } else if (exportFormat === 'CSV') {
        downloadCsv(reportState);
      }

    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setValidationError(err.message || 'Failed to generate report from database');
    } finally {
      setIsGenerating(false);
    }
  };

  // =========================================================================
  // Export Implementations (PDF, Excel, CSV)
  // =========================================================================

  const downloadPdf = (rep = generatedReport) => {
    if (!rep) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(217, 35, 50); // Brand Red
    doc.text('CHANDU CHICKEN CENTER — SALES REPORT', 14, 18);

    // Subheader Shop Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Contact: ${rep.shopContact}`, 14, 25);
    doc.text(`Address: ${rep.shopAddress}`, 14, 30);

    // Reporting Metadata
    doc.setFont('helvetica', 'bold');
    doc.text(`Reporting Period: ${rep.startDate} to ${rep.endDate}`, 14, 37);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${rep.generatedAt} (Local Shop Time)`, 14, 42);
    doc.text(`Products: ${rep.selectedProductNames}`, 14, 47);

    // Table Data
    const tableData = rep.rows.map(r => [
      r.slNo.toString(),
      r.productName,
      r.weightSoldFormatted,
      `Rs. ${r.salesAmount.toLocaleString('en-IN')}`
    ]);

    // Summary row
    const footData = [
      [
        '',
        'TOTALS',
        `${rep.totalWeightSoldKg > 0 ? `${rep.totalWeightSoldKg.toFixed(2)} kg` : ''} (${rep.totalQuantityPacks} packs)`,
        `Rs. ${rep.totalSalesAmount.toLocaleString('en-IN')}`
      ]
    ];

    autoTable(doc, {
      startY: 52,
      head: [['Sl. No.', 'Product Name', 'Weight/Quantity Sold', 'Sales Amount']],
      body: tableData,
      foot: footData,
      theme: 'grid',
      headStyles: {
        fillColor: [56, 37, 31], // #38251F Brand Brown
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left'
      },
      footStyles: {
        fillColor: [254, 243, 199], // Amber-100
        textColor: [56, 37, 31],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 45, halign: 'right' },
        3: { cellWidth: 45, halign: 'right' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      didDrawPage: data => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount} — Chandu Chicken Center Sales Records`,
          14,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.pdf`);
  };

  const downloadExcel = (rep = generatedReport) => {
    if (!rep) return;
    const wb = XLSX.utils.book_new();

    // Spreadsheet Rows
    const wsData = [
      ['CHANDU CHICKEN CENTER — SALES REPORT'],
      [`Shop Name: ${rep.shopName}`],
      [`Contact: ${rep.shopContact}`],
      [`Address: ${rep.shopAddress}`],
      [`Reporting Period: ${rep.startDate} to ${rep.endDate}`],
      [`Generated On: ${rep.generatedAt}`],
      [`Selected Products: ${rep.selectedProductNames}`],
      [], // blank row
      ['Sl. No.', 'Product Name', 'Weight/Quantity Sold', 'Sales Amount (INR)'],
      ...rep.rows.map(r => [r.slNo, r.productName, r.weightSoldFormatted, r.salesAmount]),
      [],
      [
        '',
        'TOTAL WEIGHT SOLD:',
        `${rep.totalWeightSoldKg.toFixed(2)} kg`,
        ''
      ],
      [
        '',
        'TOTAL QUANTITY SOLD:',
        `${rep.totalQuantityPacks} packs`,
        ''
      ],
      [
        '',
        'TOTAL SALES AMOUNT:',
        `INR ${rep.totalSalesAmount.toLocaleString('en-IN')}`,
        rep.totalSalesAmount
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 10 },
      { wch: 45 },
      { wch: 25 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.xlsx`);
  };

  const downloadCsv = (rep = generatedReport) => {
    if (!rep) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `"CHANDU CHICKEN CENTER — SALES REPORT"\r\n`;
    csvContent += `"Reporting Period","${rep.startDate} to ${rep.endDate}"\r\n`;
    csvContent += `"Generated On","${rep.generatedAt}"\r\n`;
    csvContent += `"Selected Products","${rep.selectedProductNames.replace(/"/g, '""')}"\r\n\r\n`;

    csvContent += `"Sl. No.","Product Name","Weight/Quantity Sold","Sales Amount (INR)"\r\n`;
    rep.rows.forEach(r => {
      csvContent += `"${r.slNo}","${r.productName.replace(/"/g, '""')}","${r.weightSoldFormatted}","${r.salesAmount}"\r\n`;
    });

    csvContent += `\r\n"","TOTAL WEIGHT SOLD","${rep.totalWeightSoldKg.toFixed(2)} kg",""\r\n`;
    csvContent += `"","TOTAL QUANTITY SOLD","${rep.totalQuantityPacks} packs",""\r\n`;
    csvContent += `"","TOTAL SALES AMOUNT","INR ${rep.totalSalesAmount}","${rep.totalSalesAmount}"\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chandu-chicken-sales-report-${rep.startDate}-to-${rep.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-full overflow-x-hidden pb-12">
      {/* Page Title & Context */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs">
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
              Generate spreadsheet-style sales reports for custom date ranges, individual poultry cuts, or all products.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Sales Reports — Dedicated Form */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-2xs p-5 sm:p-7 space-y-6">
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
          {/* A. Date Range */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              A. Date Range <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-[11px] text-stone-500 font-semibold mb-1">Start Date</span>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={startDate}
                    max={todayStr}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-stone-500 font-semibold mb-1">End Date</span>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={endDate}
                    max={todayStr}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                  />
                </div>
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

            {/* "All Products" Primary Selector Button */}
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

              {/* Product search box for large catalogs */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Filter product list (e.g. breast, boneless, curry cut)..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-[#38251F] focus:outline-hidden focus:border-[#D92332]"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Individual Selectable Products Grid */}
            <div className="bg-stone-50 p-3 sm:p-4 rounded-2xl border border-stone-200/80 max-h-60 overflow-y-auto space-y-2">
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

          {/* C. Export Format */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              C. Export Format <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'PDF' as ExportFormat, label: 'PDF Document', desc: 'Printable formatted report', icon: FileText },
                { id: 'Excel' as ExportFormat, label: 'Excel (.xlsx)', desc: 'Full spreadsheet table', icon: FileSpreadsheet },
                { id: 'CSV' as ExportFormat, label: 'CSV File', desc: 'Raw tabular values', icon: Download }
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
              className="w-full sm:w-auto px-8 py-3.5 bg-[#D92332] hover:bg-[#b81d2a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Compiling Database Records...</span>
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

      {/* 5. Sales Report Output — Spreadsheet Reference View */}
      {generatedReport && (
        <div className="bg-white rounded-3xl border border-stone-300 shadow-lg p-5 sm:p-8 space-y-6">
          {/* Action Toolbar on Top of the Report */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                ✓ Report Generated Successfully
              </span>
              <p className="text-xs text-stone-500 mt-1">
                Generated from actual shop order-item database records.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadPdf(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                title="Download PDF"
              >
                <FileText className="w-3.5 h-3.5 text-red-600" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => downloadExcel(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                title="Download Excel Spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => downloadCsv(generatedReport)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                title="Download CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-700" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-[#38251F] hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Printable Report Canvas */}
          <div className="p-4 sm:p-6 bg-stone-50/50 rounded-2xl border border-stone-200 space-y-5 print:p-0 print:border-none">
            {/* Header Title Matching Reference */}
            <div className="text-center space-y-1 border-b border-stone-300 pb-4">
              <h2 className="text-lg sm:text-2xl font-black text-[#D92332] tracking-tight">
                {generatedReport.title}
              </h2>
              <div className="text-xs text-stone-700 font-bold">
                {generatedReport.shopName}
              </div>
              <div className="text-[11px] text-stone-500">
                {generatedReport.shopContact} • {generatedReport.shopAddress}
              </div>
            </div>

            {/* Metadata Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-stone-200 text-xs">
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Reporting Period</span>
                <span className="font-extrabold text-[#38251F]">{generatedReport.startDate} to {generatedReport.endDate}</span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Generated On</span>
                <span className="font-extrabold text-[#38251F]">{generatedReport.generatedAt}</span>
              </div>
              <div>
                <span className="text-stone-400 font-semibold block text-[10px] uppercase">Selected Products</span>
                <span className="font-extrabold text-[#38251F] truncate block" title={generatedReport.selectedProductNames}>
                  {generatedReport.selectedProductNames}
                </span>
              </div>
            </div>

            {/* Product-Wise Table */}
            {!generatedReport.hasData ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="font-bold text-stone-700 text-sm">No Sales Records Found</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  No completed orders were found for the selected products between {generatedReport.startDate} and {generatedReport.endDate}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-stone-300 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#38251F] text-white font-bold border-b border-stone-300 text-[11px]">
                      <th className="py-3 px-4 w-16 text-center border-r border-stone-700">Sl. No.</th>
                      <th className="py-3 px-4 border-r border-stone-700">Product Name</th>
                      <th className="py-3 px-4 text-right border-r border-stone-700">Weight/Quantity Sold</th>
                      <th className="py-3 px-4 text-right">Sales Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-800">
                    {generatedReport.rows.map(row => (
                      <tr key={row.productId} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-4 text-center font-bold text-stone-500 border-r border-stone-200">
                          {row.slNo}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#38251F] border-r border-stone-200">
                          {row.productName}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium border-r border-stone-200">
                          {row.weightSoldFormatted}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-[#38251F]">
                          ₹{row.salesAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals at the bottom */}
                  <tfoot>
                    <tr className="bg-[#FFF9F1] border-t-2 border-stone-400 font-black text-xs text-[#38251F]">
                      <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider border-r border-stone-300">
                        Total Summary:
                      </td>
                      <td className="py-3 px-4 text-right border-r border-stone-300">
                        <div className="text-sm font-extrabold text-[#38251F]">
                          {generatedReport.totalWeightSoldKg > 0 ? `${generatedReport.totalWeightSoldKg.toFixed(2)} kg` : ''}
                        </div>
                        <div className="text-[10px] text-stone-500 font-semibold">
                          ({generatedReport.totalQuantityPacks} total packs sold)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-base font-black text-[#D92332]">
                          ₹{generatedReport.totalSalesAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-stone-500 font-normal">
                          Cumulative sales value
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
