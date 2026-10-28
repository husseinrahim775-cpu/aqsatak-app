"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  getUserPayments, 
  getUserInstallments, 
  getCompanySettings,
  getAvailableInventory,
  getSoldInventory,
  getUserTreasuryTransactions,
  PaymentRecord, 
  InstallmentData,
  InventoryItem,
  TreasuryTransaction
} from "../../services/firestore";
import { 
  FileText, 
  Printer, 
  Loader2, 
  PieChart,
  ShoppingBag,
  User,
  Phone,
  Calendar,
  ChevronRight,
  ChevronLeft,
  X,
  Vault,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Filter,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  CheckSquare,
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

// 🛠️ دالة معالجة آمنة وشاملة للتاريخ لضمان قراءة كافة حركات الخزينة والمخاريج
const parseDateObj = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  try {
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate();
    }
    if (typeof dateVal === "object" && dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
    }
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return dateVal;
    }
    if (typeof dateVal === "number") {
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) ? d : null;
    }
    const parsedDate = new Date(dateVal);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    return null;
  }
  return null;
};

// 🏷️ تنسيق عرض التاريخ بالعربية
const formatDateForDisplay = (dateVal: any): string => {
  const parsed = parseDateObj(dateVal);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
};

interface AggregatedCustomerReport {
  customerKey: string;
  customerName: string;
  phoneNumber: string;
  address?: string;
  installments: InstallmentData[];
  purchasedProductsList: string;
  originalContractValue: number;
  totalPaid: number;
  currentRemaining: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  
  // 🔘 التبويب النشط حالياً
  const [activeTab, setActiveTab] = useState<"installments" | "treasury" | "inventory">("installments");

  // بيانات النظام
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [treasuryLogs, setTreasuryLogs] = useState<(TreasuryTransaction & { bookPeriod?: string; bookPeriods?: string[] })[]>([]);
  const [inventoryItems, setInventoryItems] = useState<(InventoryItem & { bookPeriod?: string; bookPeriods?: string[] })[]>([]);
  const [loading, setLoading] = useState(true);

  // 📖 نظام فصل الدفاتر الشامل لكافة التقارير
  const [isBookMode, setIsBookMode] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(["monthly", "weekly", "daily"]);

  const togglePeriodFilter = (period: string) => {
    if (selectedPeriods.includes(period)) {
      if (selectedPeriods.length === 1) return;
      setSelectedPeriods(selectedPeriods.filter((p) => p !== period));
    } else {
      setSelectedPeriods([...selectedPeriods, period]);
    }
  };

  // 🎯 الفلاتر الرئيسية للأقساط والتواريخ
  const [customerStatusFilter, setCustomerStatusFilter] = useState<"all" | "debtors" | "settled">("all");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // 📅 التقويم التفاعلي المتقدم (سنة - شهر - يوم)
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonthObj, setStartMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [startStep, setStartStep] = useState<"months" | "days">("months");

  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonthObj, setEndMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [endStep, setEndStep] = useState<"months" | "days">("months");

  const monthsList = [
    { num: "01", name: "شهر 1" },
    { num: "02", name: "شهر 2" },
    { num: "03", name: "شهر 3" },
    { num: "04", name: "شهر 4" },
    { num: "05", name: "شهر 5" },
    { num: "06", name: "شهر 6" },
    { num: "07", name: "شهر 7" },
    { num: "08", name: "شهر 8" },
    { num: "09", name: "شهر 9" },
    { num: "10", name: "شهر 10" },
    { num: "11", name: "شهر 11" },
    { num: "12", name: "شهر 12" },
  ];

  const getDaysInMonth = (year: number, monthNumStr?: string) => {
    if (!monthNumStr) return [];
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const daysArr = [];
    for (let i = 1; i <= count; i++) {
      daysArr.push(String(i).padStart(2, "0"));
    }
    return daysArr;
  };

  const daysInStartMonth = useMemo(() => getDaysInMonth(startYear, startMonthObj?.num), [startYear, startMonthObj]);
  const daysInEndMonth = useMemo(() => getDaysInMonth(endYear, endMonthObj?.num), [endYear, endMonthObj]);

  const getOwnerUid = () => {
    const activeSession = sessionStorage.getItem("active_session");
    if (activeSession) {
      try {
        const parsed = JSON.parse(activeSession);
        if (parsed.ownerUid) return parsed.ownerUid;
      } catch (e) {}
    }
    return user?.uid || null;
  };

  useEffect(() => {
    async function fetchAllSystemData() {
      const ownerUid = getOwnerUid();
      if (!ownerUid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [paymentsData, installmentsData, compSettings, availInv, soldInv, manualTreasury] = await Promise.all([
          getUserPayments(ownerUid).catch(() => []),
          getUserInstallments(ownerUid).catch(() => []),
          getCompanySettings(ownerUid).catch(() => null),
          getAvailableInventory().catch(() => []),
          getSoldInventory().catch(() => []),
          getUserTreasuryTransactions(ownerUid).catch(() => []),
        ]);

        setPayments(paymentsData || []);
        setInstallments(installmentsData || []);
        setCompanyData(compSettings || null);
        setInventoryItems([...(availInv || []), ...(soldInv || [])]);

        // 🗺️ ربط معرف العقد بنوع الدفتر (شهر/أسبوع/يوم)
        const instPeriodMap = new Map<string, string>();
        (installmentsData || []).forEach((inst: any) => {
          if (inst.id) {
            instPeriodMap.set(inst.id, inst.paymentPeriod || "monthly");
          }
        });

        const autoInflows: TreasuryTransaction[] = [];

        // 1. تسديدات الأقساط
        (paymentsData || []).forEach((p: any) => {
          const parentPeriod = p.installmentId ? instPeriodMap.get(p.installmentId) : null;
          const assignedPeriod = p.bookPeriod || parentPeriod || "monthly";

          autoInflows.push({
            id: `pay_${p.id}`,
            userId: ownerUid,
            type: "inflow",
            category: "installment_payment",
            amount: Number(p.amount) || 0,
            description: `تسديد قسط: ${p.customerName || "عميل"} (${p.productName || "منتج"})`,
            date: p.paidAt || p.createdAt || p.date || new Date().toISOString(),
            bookPeriod: assignedPeriod,
            bookPeriods: [assignedPeriod],
          } as any);
        });

        // 2. مقبوضات وتكاليف العقود (شراء مباشر ومقدمات)
        (installmentsData || []).forEach((inst: any) => {
          const instDate = inst.createdAt || inst.startDate || inst.date || new Date().toISOString();
          const assignedPeriod = inst.paymentPeriod || "monthly";

          // أ) الدفعات المقدمة
          if (inst.downPayment && Number(inst.downPayment) > 0) {
            autoInflows.push({
              id: `down_${inst.id}`,
              userId: ownerUid,
              type: "inflow",
              category: "down_payment",
              amount: Number(inst.downPayment) || 0,
              description: `دفعة مقدمة عقد: ${inst.customerName} (${inst.productName})`,
              date: instDate,
              bookPeriod: assignedPeriod,
              bookPeriods: [assignedPeriod],
            } as any);
          }

          // ب) ⚡ إضافة تكلفة الشراء والتجهيز المباشر (المصروفات والخروج)
          const cost = Number(inst.costPrice || inst.purchasePrice || inst.originalCost || 0);
          const isFromInventory = inst.fromInventory === true || inst.fromInventory === "true";
          
          if (cost > 0 && !isFromInventory) {
            autoInflows.push({
              id: `cost_${inst.id}`,
              userId: ownerUid,
              type: "outflow",
              category: "inventory_purchase",
              amount: cost,
              description: `تكلفة شراء وتجهيز مباشر: ${inst.productName || "بضاعة"} للعميل (${inst.customerName})`,
              date: instDate,
              bookPeriod: assignedPeriod,
              bookPeriods: [assignedPeriod],
            } as any);
          }
        });

        // 3. دمج كشوفات الخزينة (اليدوية والتلقائية والمصاريف) وترتيبها
        const enrichedManualTreasury = (manualTreasury || []).map((t: any) => {
          if (!t.bookPeriod && (!t.bookPeriods || t.bookPeriods.length === 0)) {
            return {
              ...t,
              bookPeriod: t.category === "inventory_purchase" ? "weekly" : "general",
              bookPeriods: [t.category === "inventory_purchase" ? "weekly" : "general"],
            };
          }
          return t;
        });

        const allTreasury = [...enrichedManualTreasury, ...autoInflows].sort((a, b) => {
          const dateA = parseDateObj((a as any).date || (a as any).createdAt);
          const dateB = parseDateObj((b as any).date || (b as any).createdAt);
          const timeA = dateA ? dateA.getTime() : 0;
          const timeB = dateB ? dateB.getTime() : 0;
          return timeB - timeA;
        });

        setTreasuryLogs(allTreasury);
      } catch (error) {
        console.error("خطأ في جلب بيانات التقارير:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllSystemData();
  }, [user]);

  // 1️⃣ فلترة العقود المتاحة حسب نظام فصل الدفاتر
  const filteredInstallments = useMemo(() => {
    if (!isBookMode) return installments;
    return installments.filter((inst: any) => {
      const p = inst.paymentPeriod || "monthly";
      return selectedPeriods.includes(p);
    });
  }, [installments, isBookMode, selectedPeriods]);

  // تجميع بيانات الأقساط والعملاء الكلية بناءً على العقود المفلترة
  const allGroupedCustomers = useMemo(() => {
    const map = new Map<string, AggregatedCustomerReport>();

    filteredInstallments.forEach((inst) => {
      const key = inst.phoneNumber?.trim() || inst.customerName?.trim();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          customerKey: key,
          customerName: inst.customerName || "عميل بدون اسم",
          phoneNumber: inst.phoneNumber || "-",
          address: inst.address || "",
          installments: [],
          purchasedProductsList: "",
          originalContractValue: 0,
          totalPaid: 0,
          currentRemaining: 0,
        });
      }

      const cust = map.get(key)!;
      cust.installments.push(inst);
    });

    map.forEach((cust) => {
      cust.purchasedProductsList = cust.installments
        .map((i) => i.productName)
        .filter(Boolean)
        .join(" + ");

      cust.currentRemaining = cust.installments.reduce(
        (sum, i) => sum + (Number(i.totalDue) || 0),
        0
      );

      const custInstIds = new Set(cust.installments.map((i) => i.id));
      const custNamesLower = new Set(cust.installments.map((i) => i.customerName?.toLowerCase().trim()));

      cust.totalPaid = payments
        .filter((p) => {
          if (p.installmentId && custInstIds.has(p.installmentId)) return true;
          if (p.customerName && custNamesLower.has(p.customerName.toLowerCase().trim())) return true;
          return false;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      cust.originalContractValue = cust.currentRemaining + cust.totalPaid;
    });

    return Array.from(map.values());
  }, [filteredInstallments, payments]);

  // 🎯 تصفية قائمة العملاء بحسب الفلتر
  const filteredGroupedCustomers = useMemo(() => {
    if (customerStatusFilter === "debtors") {
      return allGroupedCustomers.filter((c) => c.currentRemaining > 0);
    } else if (customerStatusFilter === "settled") {
      return allGroupedCustomers.filter((c) => c.currentRemaining <= 0);
    }
    return allGroupedCustomers;
  }, [allGroupedCustomers, customerStatusFilter]);

  const activeCustomer = useMemo(() => {
    if (selectedCustomerKey === "all") return null;
    return filteredGroupedCustomers.find((c) => c.customerKey === selectedCustomerKey) || null;
  }, [filteredGroupedCustomers, selectedCustomerKey]);

  // 2️⃣ سجل كشف حركة الأقساط
  const ledgerEntries = useMemo(() => {
    let filtered = payments;

    const allowedCustomerNames = new Set(
      filteredGroupedCustomers.map((c) => c.customerName.toLowerCase().trim())
    );
    const allowedInstIds = new Set(
      filteredGroupedCustomers.flatMap((c) => c.installments.map((i) => i.id))
    );

    if (selectedCustomerKey !== "all" && activeCustomer) {
      const validInstIds = new Set(activeCustomer.installments.map((i) => i.id));
      const validName = activeCustomer.customerName.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          (p.installmentId && validInstIds.has(p.installmentId)) ||
          (p.customerName && p.customerName.toLowerCase().trim() === validName)
      );
    } else {
      filtered = filtered.filter((p) => {
        if (p.installmentId && allowedInstIds.has(p.installmentId)) return true;
        if (p.customerName && allowedCustomerNames.has(p.customerName.toLowerCase().trim())) return true;
        return false;
      });
    }

    if (dateFrom) {
      filtered = filtered.filter((p) => {
        const pDate = parseDateObj(p.paidAt || p.createdAt);
        if (!pDate) return false;
        const pStr = pDate.toISOString().slice(0, 10);
        return pStr >= dateFrom;
      });
    }

    if (dateTo) {
      filtered = filtered.filter((p) => {
        const pDate = parseDateObj(p.paidAt || p.createdAt);
        if (!pDate) return false;
        const pStr = pDate.toISOString().slice(0, 10);
        return pStr <= dateTo;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      const timeA = parseDateObj(a.paidAt || a.createdAt)?.getTime() || 0;
      const timeB = parseDateObj(b.paidAt || b.createdAt)?.getTime() || 0;
      return timeA - timeB;
    });

    const customerPaidTracker = new Map<string, number>();

    return sorted.map((entry) => {
      const parentInst = installments.find((i) => i.id === entry.installmentId);

      const actualProductName = entry.productName || parentInst?.productName || "قسط عام";
      const actualCustomerName = entry.customerName || parentInst?.customerName || "عميل غير مسمى";
      const custKey = parentInst?.phoneNumber?.trim() || parentInst?.customerName?.trim() || actualCustomerName;

      const amountPaid = Number(entry.amount) || 0;
      
      const prevPaid = customerPaidTracker.get(custKey) || 0;
      const newPaid = prevPaid + amountPaid;
      customerPaidTracker.set(custKey, newPaid);

      const custInfo = allGroupedCustomers.find(c => c.customerKey === custKey || c.customerName === actualCustomerName);
      const originalVal = custInfo ? custInfo.originalContractValue : (Number(parentInst?.totalDue) || 0) + amountPaid;

      return {
        ...entry,
        customerName: actualCustomerName,
        productName: actualProductName,
        amountPaid,
        cumulativePaid: newPaid,
        remainingBalance: Math.max(0, originalVal - newPaid),
      };
    });
  }, [payments, installments, selectedCustomerKey, activeCustomer, filteredGroupedCustomers, allGroupedCustomers, dateFrom, dateTo]);

  // 3️⃣⚡ تصفية حركات الخزينة والمخاريج بما فيها تكاليف الشراء المباشر
  const filteredTreasuryLogs = useMemo(() => {
    return treasuryLogs.filter((item) => {
      if (isBookMode) {
        const itemPeriods = item.bookPeriods && item.bookPeriods.length > 0
          ? item.bookPeriods
          : item.bookPeriod ? [item.bookPeriod] : ["general"];

        const matchesSelectedPeriod = itemPeriods.some((p) => selectedPeriods.includes(p));
        const isGeneralUnrestricted = itemPeriods.includes("general");

        if (!matchesSelectedPeriod && !isGeneralUnrestricted) return false;
      }

      if (dateFrom || dateTo) {
        const rawDate = (item as any).date || (item as any).createdAt;
        const parsedDate = parseDateObj(rawDate);
        if (!parsedDate) return false;

        const itemIso = parsedDate.toISOString().slice(0, 10);
        if (dateFrom && itemIso < dateFrom) return false;
        if (dateTo && itemIso > dateTo) return false;
      }

      return true;
    });
  }, [treasuryLogs, isBookMode, selectedPeriods, dateFrom, dateTo]);

  // 4️⃣ تصفية بضائع المخزن بحسب نظام الفصل والتاريخ
  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (isBookMode) {
        const itemPeriods = item.bookPeriods && item.bookPeriods.length > 0
          ? item.bookPeriods
          : item.bookPeriod ? [item.bookPeriod] : ["general"];

        const matchesSelectedPeriod = itemPeriods.some((p) => selectedPeriods.includes(p));
        const isGeneralUnrestricted = itemPeriods.includes("general");

        if (!matchesSelectedPeriod && !isGeneralUnrestricted) return false;
      }

      if (dateFrom || dateTo) {
        const itemDate = (item as any).createdAt || (item as any).date;
        const parsedDate = parseDateObj(itemDate);
        if (!parsedDate) return false;

        const itemIso = parsedDate.toISOString().slice(0, 10);
        if (dateFrom && itemIso < dateFrom) return false;
        if (dateTo && itemIso > dateTo) return false;
      }

      return true;
    });
  }, [inventoryItems, isBookMode, selectedPeriods, dateFrom, dateTo]);

  // ملخصات الحسابات المفلترة لتقرير الخزينة والمخاريج
  const treasurySummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    filteredTreasuryLogs.forEach((item) => {
      const val = Number(item.amount) || 0;
      if (item.type === "inflow") {
        totalIn += val;
      } else {
        totalOut += val;
      }
    });

    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredTreasuryLogs]);

  const inventorySummary = useMemo(() => {
    let totalAvailableValue = 0;
    let totalCostValue = 0;
    let totalAvailableCount = 0;
    let totalSoldCount = 0;

    filteredInventoryItems.forEach((item) => {
      if (item.status === "available") {
        totalAvailableCount += 1;
        totalAvailableValue += Number(item.price) || 0;
        totalCostValue += Number(item.costPrice) || 0;
      } else if (item.status === "sold") {
        totalSoldCount += 1;
      }
    });

    return { totalAvailableValue, totalCostValue, totalAvailableCount, totalSoldCount };
  }, [filteredInventoryItems]);

  const summary = useMemo(() => {
    const targetCustomers = activeCustomer ? [activeCustomer] : filteredGroupedCustomers;

    const totalContract = targetCustomers.reduce((acc, c) => acc + c.originalContractValue, 0);
    const totalPaid = targetCustomers.reduce((acc, c) => acc + c.totalPaid, 0);
    const remaining = targetCustomers.reduce((acc, c) => acc + c.currentRemaining, 0);

    const progressPercent = totalContract > 0 ? Math.min(100, Math.round((totalPaid / totalContract) * 100)) : 0;

    return { totalContract, totalPaid, remaining, progressPercent };
  }, [activeCustomer, filteredGroupedCustomers]);

  const getCategoryLabel = (cat: TreasuryTransaction["category"]) => {
    switch (cat) {
      case "installment_payment": return "تسديد قسط";
      case "down_payment": return "دفعة مقدمة";
      case "capital_deposit": return "إيداع رأس مال";
      case "inventory_purchase": return "شراء بضاعة ومخزن";
      case "expense": return "مصاريف ونثريات";
      case "withdrawal": return "مسحوبات شخصية/أرباح";
      default: return "حركة مالية";
    }
  };

  const getBookLabelText = () => {
    if (!isBookMode) return "كافة الدفاتر والعملاء";
    const labels: string[] = [];
    if (selectedPeriods.includes("daily")) labels.push("⚡ يومية");
    if (selectedPeriods.includes("weekly")) labels.push("🗓️ أسبوعية");
    if (selectedPeriods.includes("monthly")) labels.push("🏙️ شهرية");
    return labels.length > 0 ? labels.join(" + ") : "كافة الدفاتر";
  };

  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) return;

    const storeName = companyData?.companyName || "منظومة أقساطك المالية";
    const storePhone = companyData?.phone || "-";
    const storeAddress = companyData?.address || "-";
    const logoUrl = companyData?.logoUrl || companyData?.logo || "";
    const bookStatusHeader = getBookLabelText();
    const dateRangeHeader = dateFrom || dateTo ? `الفترة: من ${dateFrom || "الكل"} إلى ${dateTo || "الكل"}` : "كافة الفترات الزمنية";

    if (activeTab === "installments") {
      let reportScopeTitle = "كشف حساب مالي شامل لجميع العملاء";
      if (activeCustomer) {
        reportScopeTitle = `كشف حساب العميل: ${activeCustomer.customerName}`;
      } else if (customerStatusFilter === "debtors") {
        reportScopeTitle = "كشف حساب العملاء المتبقي عليهم ديون فقط";
      } else if (customerStatusFilter === "settled") {
        reportScopeTitle = "كشف حساب العملاء المسددين بالكامل (المستوفين)";
      }

      const customerDisplayName = activeCustomer 
        ? `${activeCustomer.customerName} (<span dir="ltr">${activeCustomer.phoneNumber}</span>)` 
        : reportScopeTitle;

      const customerProducts = activeCustomer 
        ? activeCustomer.purchasedProductsList 
        : `عقود (${filteredGroupedCustomers.length}) عميل ضمن التقرير`;

      printWindow.document.write(`
        <html dir="rtl" lang="ar">
          <head>
            <title>${reportScopeTitle}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
              body { font-family: 'Cairo', sans-serif; padding: 25px; color: #1e293b; background: #fff; font-size: 12px; }
              .header-table { width: 100%; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
              .logo { max-height: 65px; object-fit: contain; }
              .title { font-size: 18px; font-weight: 900; color: #6366f1; margin: 0; }
              .subtitle { font-size: 11px; color: #64748b; font-weight: 700; }
              .info-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 15px; border-radius: 10px; margin-bottom: 20px; }
              .summary-cards { display: flex; gap: 10px; margin-bottom: 20px; }
              .card { flex: 1; border: 1px solid #cbd5e1; padding: 10px; border-radius: 10px; text-align: center; background: #f8fafc; }
              .card-title { font-size: 10px; color: #64748b; font-weight: 700; }
              .card-value { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px; font-family: monospace; }
              table.ledger { width: 100%; border-collapse: collapse; margin-top: 10px; }
              table.ledger th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; font-weight: 900; }
              table.ledger td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; }
              .footer-stamps { margin-top: 50px; display: flex; justify-between; padding: 0 30px; }
              .stamp-box { text-align: center; font-weight: 900; font-size: 11px; }
              .stamp-line { margin-top: 45px; width: 140px; border-bottom: 1px dashed #94a3b8; margin-left: auto; margin-right: auto; }
              @media print { @page { size: A4; margin: 10mm; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <table class="header-table">
              <tr>
                <td style="width: 20%;">${logoUrl ? `<img src="${logoUrl}" class="logo" />` : `<h2 style="color:#6366f1;margin:0;">أقساطك</h2>`}</td>
                <td style="text-align: center;">
                  <h1 class="title">${storeName}</h1>
                  <p class="subtitle">العنوان: ${storeAddress} | الهاتف: <span dir="ltr">${storePhone}</span></p>
                  <h3 style="margin: 5px 0 0 0; font-size: 14px;">${reportScopeTitle}</h3>
                  <p style="margin:2px 0; font-weight:bold; color:#7c3aed;">[ الدفاتر المحددة: ${bookStatusHeader} ]</p>
                </td>
                <td style="width: 25%; text-align: left; font-size: 10px; font-weight: 700;">
                  <p style="margin:2px 0;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-IQ')}</p>
                  <p style="margin:2px 0;">${dateRangeHeader}</p>
                  <p style="margin:2px 0;">الحالة: ${customerStatusFilter === 'all' ? 'كافة العملاء' : customerStatusFilter === 'debtors' ? 'ديون متبقية' : 'مسددين بالكامل'}</p>
                </td>
              </tr>
            </table>

            <div class="info-box">
              <table style="width: 100%; border: none;">
                <tr>
                  <td style="border: none; padding: 0; text-align: right;"><span style="font-size: 12px; font-weight: 900;">البيان / النطاق:</span> ${customerDisplayName}</td>
                  <td style="border: none; padding: 0; text-align: left;"><span style="font-size: 12px; font-weight: 900;">التفاصيل:</span> ${customerProducts}</td>
                </tr>
              </table>
            </div>

            <div class="summary-cards">
              <div class="card"><div class="card-title">إجمالي قيمة العقود الأصلية</div><div class="card-value">${summary.totalContract.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">إجمالي المقبوضات المسددة</div><div class="card-value" style="color: #16a34a;">+${summary.totalPaid.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">المتبقي الحالي بذمة العملاء</div><div class="card-value" style="color: #dc2626;">${summary.remaining.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">نسبة الوفاء المالية</div><div class="card-value" style="color: #2563eb;">${summary.progressPercent}%</div></div>
            </div>

            <table class="ledger">
              <thead>
                <tr>
                  <th>#</th>
                  <th>تاريخ التحصيل</th>
                  <th>اسم العميل</th>
                  <th>اسم المنتج / المادة المشتراة</th>
                  <th>المبلغ المسدد</th>
                  <th>المجموع المسدد للعميل</th>
                  <th>المتبقي بذمة العميل</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerEntries.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${formatDateForDisplay(item.paidAt || item.createdAt)}</td>
                    <td>${item.customerName}</td>
                    <td><strong>${item.productName}</strong> ${item.targetMonth ? `(فترة: ${item.targetMonth})` : ''}</td>
                    <td style="color: #16a34a; font-family: monospace;">+${item.amountPaid.toLocaleString()} د.ع</td>
                    <td style="font-family: monospace;">${item.cumulativePaid.toLocaleString()} د.ع</td>
                    <td style="font-family: monospace; color: #dc2626;">${item.remainingBalance.toLocaleString()} د.ع</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer-stamps">
              <div class="stamp-box"><p>توقيع المحاسب / التنسيق</p><div class="stamp-line"></div></div>
              <div class="stamp-box"><p>توقيع العميل / المقترض</p><div class="stamp-line"></div></div>
              <div class="stamp-box"><p>ختم الشركة / المكتب</p><div class="stamp-line"></div></div>
            </div>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
    } else if (activeTab === "treasury") {
      printWindow.document.write(`
        <html dir="rtl" lang="ar">
          <head>
            <title>كشف حساب الخزينة والصندوق</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
              body { font-family: 'Cairo', sans-serif; padding: 25px; color: #1e293b; background: #fff; font-size: 12px; }
              .header-table { width: 100%; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
              .title { font-size: 18px; font-weight: 900; color: #6366f1; margin: 0; }
              .summary-cards { display: flex; gap: 10px; margin-bottom: 20px; }
              .card { flex: 1; border: 1px solid #cbd5e1; padding: 10px; border-radius: 10px; text-align: center; background: #f8fafc; }
              .card-title { font-size: 10px; color: #64748b; font-weight: 700; }
              .card-value { font-size: 14px; font-weight: 900; margin-top: 4px; font-family: monospace; }
              table.ledger { width: 100%; border-collapse: collapse; margin-top: 10px; }
              table.ledger th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; font-weight: 900; }
              table.ledger td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; }
              @media print { @page { size: A4; margin: 10mm; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <table class="header-table">
              <tr>
                <td style="text-align: center;">
                  <h1 class="title">${storeName}</h1>
                  <h3 style="margin: 5px 0 0 0; font-size: 14px;">تقرير كشف حركة الصندوق والتصرفات المالية</h3>
                  <p style="margin:2px 0; font-weight:bold; color:#7c3aed;">[ الدفاتر المحددة: ${bookStatusHeader} ]</p>
                </td>
                <td style="width: 25%; text-align: left; font-size: 10px; font-weight: 700;">
                  <p style="margin:2px 0;">التاريخ: ${new Date().toLocaleDateString('ar-IQ')}</p>
                  <p style="margin:2px 0;">${dateRangeHeader}</p>
                </td>
              </tr>
            </table>

            <div class="summary-cards">
              <div class="card"><div class="card-title">إجمالي المقبوضات والداخل</div><div class="card-value" style="color:#16a34a;">+${treasurySummary.totalIn.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">إجمالي المصاريف والخارج</div><div class="card-value" style="color:#dc2626;">-${treasurySummary.totalOut.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">صافي السيولة النقدية</div><div class="card-value" style="color:#2563eb;">${treasurySummary.net.toLocaleString()} د.ع</div></div>
            </div>

            <table class="ledger">
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ والوقت</th>
                  <th>التصنيف</th>
                  <th>البيان / التفاصيل</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTreasuryLogs.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${formatDateForDisplay((item as any).date || (item as any).createdAt)}</td>
                    <td>${getCategoryLabel(item.category)}</td>
                    <td>${item.description || 'حركة سيولة'}</td>
                    <td style="font-family: monospace; color: ${item.type === 'inflow' ? '#16a34a' : '#dc2626'};">
                      ${item.type === 'inflow' ? `+${Number(item.amount).toLocaleString()}` : `-${Number(item.amount).toLocaleString()}`} د.ع
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
    } else if (activeTab === "inventory") {
      printWindow.document.write(`
        <html dir="rtl" lang="ar">
          <head>
            <title>كشف حركة المخزون والسلع</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
              body { font-family: 'Cairo', sans-serif; padding: 25px; color: #1e293b; background: #fff; font-size: 12px; }
              .header-table { width: 100%; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
              .title { font-size: 18px; font-weight: 900; color: #6366f1; margin: 0; }
              .summary-cards { display: flex; gap: 10px; margin-bottom: 20px; }
              .card { flex: 1; border: 1px solid #cbd5e1; padding: 10px; border-radius: 10px; text-align: center; background: #f8fafc; }
              .card-title { font-size: 10px; color: #64748b; font-weight: 700; }
              .card-value { font-size: 14px; font-weight: 900; margin-top: 4px; font-family: monospace; }
              table.ledger { width: 100%; border-collapse: collapse; margin-top: 10px; }
              table.ledger th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; font-weight: 900; }
              table.ledger td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; }
              @media print { @page { size: A4; margin: 10mm; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <table class="header-table">
              <tr>
                <td style="text-align: center;">
                  <h1 class="title">${storeName}</h1>
                  <h3 style="margin: 5px 0 0 0; font-size: 14px;">تقرير كشف البضائع والمخزون المالي</h3>
                  <p style="margin:2px 0; font-weight:bold; color:#7c3aed;">[ الدفاتر المحددة: ${bookStatusHeader} ]</p>
                </td>
                <td style="width: 25%; text-align: left; font-size: 10px; font-weight: 700;">
                  <p style="margin:2px 0;">التاريخ: ${new Date().toLocaleDateString('ar-IQ')}</p>
                  <p style="margin:2px 0;">${dateRangeHeader}</p>
                </td>
              </tr>
            </table>

            <div class="summary-cards">
              <div class="card"><div class="card-title">المنتجات المتوفرة</div><div class="card-value">${inventorySummary.totalAvailableCount} مادة</div></div>
              <div class="card"><div class="card-title">المنتجات المباعة</div><div class="card-value" style="color:#2563eb;">${inventorySummary.totalSoldCount} مادة</div></div>
              <div class="card"><div class="card-title">إجمالي تكلفة المتاح</div><div class="card-value" style="color:#d97706;">${inventorySummary.totalCostValue.toLocaleString()} د.ع</div></div>
              <div class="card"><div class="card-title">إجمالي قيمة بيع المتاح</div><div class="card-value" style="color:#16a34a;">${inventorySummary.totalAvailableValue.toLocaleString()} د.ع</div></div>
            </div>

            <table class="ledger">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم المنتج / المادة</th>
                  <th>التصنيف</th>
                  <th>السيريال / الشاصي</th>
                  <th>سعر التكلفة</th>
                  <th>سعر البيع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${filteredInventoryItems.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.title}</strong></td>
                    <td>${item.category || '-'}</td>
                    <td style="font-family: monospace;">${item.specs?.chassisNumber || '-'}</td>
                    <td style="font-family: monospace;">${(item.costPrice || 0).toLocaleString()} د.ع</td>
                    <td style="font-family: monospace; color: #16a34a;">${(item.price || 0).toLocaleString()} د.ع</td>
                    <td>${item.status === 'sold' ? `مباع (${item.soldToClientName || 'عميل'})` : 'متوفر بالمخزن'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
    }

    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري مطابقة كافة بيانات النظام والتقارير...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right">
      
      {/* 1. الترويسة والطباعة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-primary" />
            <span>التقارير المالية والتشغيلية الشاملة 📊</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">كشوفات دقيقة تربط الأقساط، حركة الخزينة والصندوق، والمخزون.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* ⚡ زر تفعيل/إلغاء نظام الفصل في التقارير */}
          <button
            type="button"
            onClick={() => setIsBookMode(!isBookMode)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-xs md:text-sm border transition-all shadow-sm cursor-pointer ${
              isBookMode 
                ? "bg-purple-600 text-white border-purple-500 shadow-purple-500/20" 
                : "bg-secondary text-foreground hover:bg-secondary/80 border-border"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isBookMode ? "إلغاء نظام الفصل" : "نظام فصل الدفاتر"}</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-xs rounded-2xl py-3 px-5 hover:opacity-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>
              {activeTab === "installments" ? "طباعة كشف الأقساط" : activeTab === "treasury" ? "طباعة كشف الخزينة" : "طباعة كشف المخزن"} (A4)
            </span>
          </button>
        </div>
      </div>

      {/* 📖 شريط التحديد المتعدد لفلترة التقارير حسب نوع الدفتر */}
      <AnimatePresence>
        {isBookMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card/90 backdrop-blur-md p-4 rounded-3xl border border-border shadow-sm print:hidden flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-black text-purple-400">
                <Filter className="w-4 h-4" />
                <span>حدد أنواع الدفاتر المراد تضمينها بالتقارير (تحديد متعدد):</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePeriodFilter("daily")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 cursor-pointer ${
                    selectedPeriods.includes("daily")
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/60 hover:border-emerald-500/30"
                  }`}
                >
                  {selectedPeriods.includes("daily") ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span>⚡ عقود يومية</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePeriodFilter("weekly")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 cursor-pointer ${
                    selectedPeriods.includes("weekly")
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/60 hover:border-amber-500/30"
                  }`}
                >
                  {selectedPeriods.includes("weekly") ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span>🗓️ عقود أسبوعية</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePeriodFilter("monthly")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 cursor-pointer ${
                    selectedPeriods.includes("monthly")
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/60 hover:border-purple-500/30"
                  }`}
                >
                  {selectedPeriods.includes("monthly") ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span>🏙️ عقود شهرية</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. أزرار التنقل بين التبويبات المتناسقة مع الثيم */}
      <div className="flex items-center gap-2 bg-secondary/60 p-1.5 rounded-2xl border border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab("installments")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "installments"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>تقارير الأقساط والعملاء ({filteredInstallments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("treasury")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "treasury"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Vault className="w-4 h-4" />
          <span>تقرير الخزينة والصندوق ({filteredTreasuryLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "inventory"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>تقرير المخزن والبضائع ({filteredInventoryItems.length})</span>
        </button>
      </div>

      {/* 📅 مكون تصفية التاريخ العام لتقرير الخزينة والمخزن */}
      {(activeTab === "treasury" || activeTab === "inventory") && (
        <div className="bg-card border border-border rounded-3xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* من تاريخ */}
            <div className="relative">
              <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>من تاريخ (يوم/شهر/سنة):</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowStartPicker(!showStartPicker);
                  setStartStep("months");
                  setShowEndPicker(false);
                }}
                className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
              >
                <span className={dateFrom ? "text-foreground font-mono" : "text-muted-foreground"}>
                  {dateFrom || "اختر بداية الفترة..."}
                </span>
                <div className="flex items-center gap-1">
                  {dateFrom && (
                    <X 
                      className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateFrom("");
                      }} 
                    />
                  )}
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </button>

              <AnimatePresence>
                {showStartPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute z-[10002] mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <button
                          type="button"
                          onClick={() => setStartYear((y) => y - 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        
                        <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                          <span>{startYear}</span>
                          {startMonthObj && startStep === "days" && (
                            <span>- {startMonthObj.num}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setStartYear((y) => y + 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {startStep === "days" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1 text-[11px]">
                            <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                            <button
                              type="button"
                              onClick={() => setStartStep("months")}
                              className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                            >
                              تغيير الشهر ({startMonthObj?.name || "اختر"})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                            {daysInStartMonth.map((dayNum) => {
                              const dateString = `${startYear}-${startMonthObj?.num || "01"}-${dayNum}`;
                              const isSelected = dateFrom === dateString;
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    setDateFrom(dateString);
                                    setShowStartPicker(false);
                                  }}
                                  className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                      : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {monthsList.map((m) => {
                            const monthString = `${startYear}-${m.num}`;
                            const isSelected = dateFrom === monthString;
                            return (
                              <button
                                key={m.num}
                                type="button"
                                onClick={() => {
                                  setStartMonthObj(m);
                                  setStartStep("days");
                                  setDateFrom(monthString);
                                }}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* إلى تاريخ */}
            <div className="relative">
              <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>إلى تاريخ (يوم/شهر/سنة):</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowEndPicker(!showEndPicker);
                  setEndStep("months");
                  setShowStartPicker(false);
                }}
                className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
              >
                <span className={dateTo ? "text-foreground font-mono" : "text-muted-foreground"}>
                  {dateTo || "اختر نهاية الفترة..."}
                </span>
                <div className="flex items-center gap-1">
                  {dateTo && (
                    <X 
                      className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateTo("");
                      }} 
                    />
                  )}
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </button>

              <AnimatePresence>
                {showEndPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute z-[10002] mt-2 w-72 left-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <button
                          type="button"
                          onClick={() => setEndYear((y) => y - 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        
                        <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                          <span>{endYear}</span>
                          {endMonthObj && endStep === "days" && (
                            <span>- {endMonthObj.num}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setEndYear((y) => y + 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {endStep === "days" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1 text-[11px]">
                            <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                            <button
                              type="button"
                              onClick={() => setEndStep("months")}
                              className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                            >
                              تغيير الشهر ({endMonthObj?.name || "اختر"})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                            {daysInEndMonth.map((dayNum) => {
                              const dateString = `${endYear}-${endMonthObj?.num || "01"}-${dayNum}`;
                              const isSelected = dateTo === dateString;
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    setDateTo(dateString);
                                    setShowEndPicker(false);
                                  }}
                                  className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                      : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {monthsList.map((m) => {
                            const monthString = `${endYear}-${m.num}`;
                            const isSelected = dateTo === monthString;
                            return (
                              <button
                                key={m.num}
                                type="button"
                                onClick={() => {
                                  setEndMonthObj(m);
                                  setEndStep("days");
                                  setDateTo(monthString);
                                }}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 🅰️ التبويب الأول: تقارير الأقساط ----------------- */}
      {activeTab === "installments" && (
        <>
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            
            {/* 🎯 شريط فلاتر تصفية نوع ديون العملاء المحدث */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">فلترة وتصفية حالة العملاء والديون:</h3>
              </div>

              <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-2xl border border-border w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerStatusFilter("all");
                    setSelectedCustomerKey("all");
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    customerStatusFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>جميع العملاء ({allGroupedCustomers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerStatusFilter("debtors");
                    setSelectedCustomerKey("all");
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    customerStatusFilter === "debtors"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>عقود متبقي عليها ديون ({allGroupedCustomers.filter(c => c.currentRemaining > 0).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerStatusFilter("settled");
                    setSelectedCustomerKey("all");
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    customerStatusFilter === "settled"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>المسددين بالكامل ({allGroupedCustomers.filter(c => c.currentRemaining <= 0).length})</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">حدد اسم العميل:</label>
                <select
                  value={selectedCustomerKey}
                  onChange={(e) => setSelectedCustomerKey(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="all">
                    {customerStatusFilter === "all" 
                      ? "-- عرض كافة العملاء (تقرير شامل) --" 
                      : customerStatusFilter === "debtors" 
                      ? "-- كافة العملاء المتبقي عليهم ديون --" 
                      : "-- كافة العملاء المسددين بالكامل --"}
                  </option>
                  {filteredGroupedCustomers.map((cust) => {
                    const formattedPhone = cust.phoneNumber ? `\u202D${cust.phoneNumber}\u202C` : "";
                    const remainingTag = cust.currentRemaining > 0 ? ` (متبقي: ${cust.currentRemaining.toLocaleString()} د.ع)` : " (مسدد بالكامل ✓)";
                    return (
                      <option key={cust.customerKey} value={cust.customerKey}>
                        {cust.customerName} ({formattedPhone}) - {remainingTag}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 📅 من تاريخ (سنة - شهر - يوم) */}
              <div className="relative">
                <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>من تاريخ (يوم/شهر/سنة):</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartPicker(!showStartPicker);
                    setStartStep("months");
                    setShowEndPicker(false);
                  }}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                >
                  <span className={dateFrom ? "text-foreground font-mono" : "text-muted-foreground"}>
                    {dateFrom || "اختر بداية الفترة..."}
                  </span>
                  <div className="flex items-center gap-1">
                    {dateFrom && (
                      <X 
                        className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateFrom("");
                        }} 
                      />
                    )}
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                </button>

                <AnimatePresence>
                  {showStartPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-[10002] mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <button
                            type="button"
                            onClick={() => setStartYear((y) => y - 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                            <span>{startYear}</span>
                            {startMonthObj && startStep === "days" && (
                              <span>- {startMonthObj.num}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setStartYear((y) => y + 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {startStep === "days" ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1 text-[11px]">
                              <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                              <button
                                type="button"
                                onClick={() => setStartStep("months")}
                                className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                              >
                                تغيير الشهر ({startMonthObj?.name || "اختر"})
                              </button>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                              {daysInStartMonth.map((dayNum) => {
                                const dateString = `${startYear}-${startMonthObj?.num || "01"}-${dayNum}`;
                                const isSelected = dateFrom === dateString;
                                return (
                                  <button
                                    key={dayNum}
                                    type="button"
                                    onClick={() => {
                                      setDateFrom(dateString);
                                      setShowStartPicker(false);
                                    }}
                                    className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                        : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                    }`}
                                  >
                                    {dayNum}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {monthsList.map((m) => {
                              const monthString = `${startYear}-${m.num}`;
                              const isSelected = dateFrom === monthString;
                              return (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setStartMonthObj(m);
                                    setStartStep("days");
                                    setDateFrom(monthString);
                                  }}
                                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                      : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                  }`}
                                >
                                  {m.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 📅 إلى تاريخ (سنة - شهر - يوم) */}
              <div className="relative">
                <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>إلى تاريخ (يوم/شهر/سنة):</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowEndPicker(!showEndPicker);
                    setEndStep("months");
                    setShowStartPicker(false);
                  }}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                >
                  <span className={dateTo ? "text-foreground font-mono" : "text-muted-foreground"}>
                    {dateTo || "اختر نهاية الفترة..."}
                  </span>
                  <div className="flex items-center gap-1">
                    {dateTo && (
                      <X 
                        className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateTo("");
                        }} 
                      />
                    )}
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                </button>

                <AnimatePresence>
                  {showEndPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-[10002] mt-2 w-72 left-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <button
                            type="button"
                            onClick={() => setEndYear((y) => y - 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                            <span>{endYear}</span>
                            {endMonthObj && endStep === "days" && (
                              <span>- {endMonthObj.num}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setEndYear((y) => y + 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {endStep === "days" ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1 text-[11px]">
                              <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                              <button
                                type="button"
                                onClick={() => setEndStep("months")}
                                className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                              >
                                تغيير الشهر ({endMonthObj?.name || "اختر"})
                              </button>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                              {daysInEndMonth.map((dayNum) => {
                                const dateString = `${endYear}-${endMonthObj?.num || "01"}-${dayNum}`;
                                const isSelected = dateTo === dateString;
                                return (
                                  <button
                                    key={dayNum}
                                    type="button"
                                    onClick={() => {
                                      setDateTo(dateString);
                                      setShowEndPicker(false);
                                    }}
                                    className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                        : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                    }`}
                                  >
                                    {dayNum}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {monthsList.map((m) => {
                              const monthString = `${endYear}-${m.num}`;
                              const isSelected = dateTo === monthString;
                              return (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setEndMonthObj(m);
                                    setEndStep("days");
                                    setDateTo(monthString);
                                  }}
                                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                      : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                  }`}
                                >
                                  {m.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {activeCustomer && (
              <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl text-xs space-y-1 text-primary font-bold">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>المنتجات المشتراة: <strong>{activeCustomer.purchasedProductsList || "لا يوجد منتجات"}</strong></span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-primary" /> {activeCustomer.customerName}</span>
                  <span className="flex items-center gap-1 font-mono dir-ltr"><Phone className="w-3.5 h-3.5 text-primary shrink-0" /> {activeCustomer.phoneNumber}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground block">إجمالي قيمة العقود الأصلية</span>
              <h2 className="text-xl font-black text-foreground font-mono dir-ltr text-right">{summary.totalContract.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">إجمالي المقبوضات المسددة</span>
              <h2 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono dir-ltr text-right">+{summary.totalPaid.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-rose-500 block">المتبقي بذمة العملاء حالياً</span>
              <h2 className="text-xl font-black text-rose-500 font-mono dir-ltr text-right">{summary.remaining.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-blue-500 block">نسبة الوفاء بالأقساط</span>
              <h2 className="text-xl font-black text-blue-500 font-mono dir-ltr text-right">{summary.progressPercent}%</h2>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-500" />
                <span>سجل كشف الحركة المتراكم (Ledger Statement)</span>
              </h3>
              <span className="text-xs font-bold text-muted-foreground">{ledgerEntries.length} حركة مسجلة</span>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-bold">لا توجد حركات تسديد ضمن النطاق أو الفلتر المحدد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs whitespace-nowrap border-collapse">
                  <thead>
                    <tr className="border-b border-border text-foreground font-bold text-[11px] bg-secondary/40">
                      <th className="p-3">تاريخ الحركة</th>
                      <th className="p-3">اسم العميل</th>
                      <th className="p-3">اسم المنتج / المادة المشتراة</th>
                      <th className="p-3">المبلغ المسدد</th>
                      <th className="p-3">المجموع المسدد للعميل</th>
                      <th className="p-3">الرصيد المتبقي بذمته</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-bold">
                    {ledgerEntries.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-secondary/40 transition-colors">
                        <td className="p-3 font-mono text-muted-foreground">{formatDateForDisplay(item.paidAt || item.createdAt)}</td>
                        <td className="p-3 text-foreground">{item.customerName}</td>
                        <td className="p-3 text-primary font-extrabold">{item.productName}</td>
                        <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{(item.amountPaid || 0).toLocaleString()} د.ع</td>
                        <td className="p-3 font-mono text-foreground">{(item.cumulativePaid || 0).toLocaleString()} د.ع</td>
                        <td className="p-3 font-mono text-rose-500 font-bold">{(item.remainingBalance || 0).toLocaleString()} د.ع</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ----------------- 🅱️ التبويب الثاني: تقرير الخزينة والصندوق ----------------- */}
      {activeTab === "treasury" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 block flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4" /> إجمالي المقبوضات والداخل للصندوق
              </span>
              <h2 className="text-2xl font-black text-emerald-600 font-mono dir-ltr text-right">+{treasurySummary.totalIn.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-rose-500 block flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> إجمالي المصاريف والخارج من الصندوق
              </span>
              <h2 className="text-2xl font-black text-rose-500 font-mono dir-ltr text-right">-{treasurySummary.totalOut.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-blue-500 block">صافي السيولة المتوفرة بالصندوق</span>
              <h2 className="text-2xl font-black text-blue-500 font-mono dir-ltr text-right">{treasurySummary.net.toLocaleString()} د.ع</h2>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Vault className="w-5 h-5 text-primary" />
              <span>كشف حركة الصندوق والتصرفات المالية</span>
            </h3>

            {filteredTreasuryLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-bold">لا توجد حركات خزينة مسجلة ضمن هذا النطاق المحدد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs whitespace-nowrap border-collapse">
                  <thead>
                    <tr className="border-b border-border text-foreground font-bold text-[11px] bg-secondary/40">
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">التصنيف والدفتر</th>
                      <th className="p-3">البيان / التفاصيل</th>
                      <th className="p-3">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-bold">
                    {filteredTreasuryLogs.map((item, idx) => {
                      const itemPeriods = item.bookPeriods && item.bookPeriods.length > 0 
                        ? item.bookPeriods 
                        : item.bookPeriod ? [item.bookPeriod] : ["general"];

                      return (
                        <tr key={item.id || idx} className="hover:bg-secondary/40 transition-colors">
                          <td className="p-3 font-mono text-muted-foreground">{formatDateForDisplay((item as any).date || (item as any).createdAt)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                item.type === "inflow" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                              }`}>
                                {getCategoryLabel(item.category)}
                              </span>

                              {!itemPeriods.includes("general") && itemPeriods.map((p) => (
                                <span key={p} className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  {p === "daily" ? "⚡ يومي" : p === "weekly" ? "🗓️ أسبوعي" : "🏙️ شهري"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-foreground">{item.description || "حركة سيولة"}</td>
                          <td className={`p-3 font-mono font-bold ${item.type === "inflow" ? "text-emerald-600" : "text-rose-500"}`}>
                            {item.type === "inflow" ? `+${Number(item.amount).toLocaleString()}` : `-${Number(item.amount).toLocaleString()}`} د.ع
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- Ⓒ التبويب الثالث: تقرير المخزن ----------------- */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground block">المنتجات المتوفرة بالمخزن</span>
              <h2 className="text-xl font-black text-foreground font-mono text-right">{inventorySummary.totalAvailableCount} مادة</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-blue-500 block">إجمالي المنتجات المباعة</span>
              <h2 className="text-xl font-black text-blue-500 font-mono text-right">{inventorySummary.totalSoldCount} مادة</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-amber-600 block">إجمالي سعر التكلفة للمتاح</span>
              <h2 className="text-xl font-black text-amber-600 font-mono dir-ltr text-right">{inventorySummary.totalCostValue.toLocaleString()} د.ع</h2>
            </div>

            <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 block">إجمالي قيمة البيع للمتاح</span>
              <h2 className="text-xl font-black text-emerald-600 font-mono dir-ltr text-right">{inventorySummary.totalAvailableValue.toLocaleString()} د.ع</h2>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span>تقرير المخزون والسلع المتاحة والمباعة</span>
            </h3>

            {filteredInventoryItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-bold">لا توجد منتجات مسجلة ضمن هذا النطاق المحدد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs whitespace-nowrap border-collapse">
                  <thead>
                    <tr className="border-b border-border text-foreground font-bold text-[11px] bg-secondary/40">
                      <th className="p-3">اسم المنتج / السلعة</th>
                      <th className="p-3">التصنيف والدفتر</th>
                      <th className="p-3">السيريال / الشاصي</th>
                      <th className="p-3">سعر الشراء (التكلفة)</th>
                      <th className="p-3">سعر البيع المطلوب</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-bold">
                    {filteredInventoryItems.map((item, idx) => {
                      const itemPeriods = (item as any).bookPeriods && (item as any).bookPeriods.length > 0 
                        ? (item as any).bookPeriods 
                        : (item as any).bookPeriod ? [(item as any).bookPeriod] : ["general"];

                      return (
                        <tr key={item.id || idx} className="hover:bg-secondary/40 transition-colors">
                          <td className="p-3 text-primary font-extrabold">{item.title}</td>
                          <td className="p-3 text-foreground">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.category || "-"}</span>
                              {!itemPeriods.includes("general") && itemPeriods.map((p: string) => (
                                <span key={p} className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  {p === "daily" ? "⚡ يومي" : p === "weekly" ? "🗓️ أسبوعي" : "🏙️ شهري"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">{item.specs?.chassisNumber || "-"}</td>
                          <td className="p-3 font-mono text-amber-600 font-bold">{(item.costPrice || 0).toLocaleString()} د.ع</td>
                          <td className="p-3 font-mono text-emerald-600 font-bold">{(item.price || 0).toLocaleString()} د.ع</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              item.status === "sold" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
                            }`}>
                              {item.status === "sold" ? `مباع (${item.soldToClientName || "عميل"})` : "متوفر بالمخزن"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}