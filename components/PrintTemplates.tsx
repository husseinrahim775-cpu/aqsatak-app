"use client";

import React, { useEffect, useState } from "react";
import { InstallmentData, PaymentRecord, getCompanySettings } from "@/services/firestore";
import { auth } from "@/services/firebase";
import defaultLogo from "@/public/logo.png"; // الشعار الافتراضي للنظام في حال عدم رفع شعار خاص

// دالة مساعدة لجلب ownerUid الحقيقي (سواء كان المسجل مديراً أو موظفاً)
const getOwnerUid = () => {
  const activeSession = sessionStorage.getItem("active_session");
  if (activeSession) {
    try {
      const parsed = JSON.parse(activeSession);
      if (parsed.ownerUid) return parsed.ownerUid;
    } catch (e) {}
  }
  return auth.currentUser?.uid || null;
};

// ==========================================
// 📄 1. قالب طباعة عقد التقسيط
// ==========================================
export const ContractPrintTemplate = React.forwardRef<
  HTMLDivElement,
  { installment: InstallmentData; storeName?: string }
>(({ installment }, ref) => {
  const [storeInfo, setStoreInfo] = useState({
    name: "نظام أقساطك للتقسيط والخدمات المالية",
    phone: "",
    address: "",
    logo: defaultLogo.src,
    terms: [] as string[],
  });

  useEffect(() => {
    const fetchStoreSettings = async () => {
      const ownerUid = getOwnerUid();
      const defaultTerms =
        "1. يتعهد الطرف الثاني بتسديد المبالغ المستحقة في مواعيدها المحددة أعلاه دون تأخير.\n2. في حال التأخير عن التسديد، يحق للطرف الأول اتخاذ الإجراءات القانونية المترتبة على ذلك.\n3. يعتبر هذا العقد وثيقة رسمية ملزمة للطرفين وللكفيل الضامن.";

      let savedName = "نظام أقساطك للتقسيط والخدمات المالية";
      let savedPhone = "";
      let savedAddress = "";
      let savedLogo = defaultLogo.src;
      let savedTerms = defaultTerms;

      if (ownerUid) {
        const cached = localStorage.getItem(`company_settings_${ownerUid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.companyName) savedName = parsed.companyName;
            if (parsed.phone) savedPhone = parsed.phone;
            if (parsed.address) savedAddress = parsed.address;
            if (parsed.logoUrl || parsed.logo) savedLogo = parsed.logoUrl || parsed.logo;
            if (parsed.notes) savedTerms = parsed.notes;
          } catch (e) {}
        }

        const settings = await getCompanySettings(ownerUid);
        if (settings) {
          if (settings.companyName) savedName = settings.companyName;
          if (settings.phone) savedPhone = settings.phone;
          if (settings.address) savedAddress = settings.address;
          if ((settings as any).logoUrl || (settings as any).logo) {
            savedLogo = (settings as any).logoUrl || (settings as any).logo;
          }
          if (settings.notes) savedTerms = settings.notes;

          localStorage.setItem(`company_settings_${ownerUid}`, JSON.stringify(settings));
        }
      }

      setStoreInfo({
        name: savedName,
        phone: savedPhone,
        address: savedAddress,
        logo: savedLogo,
        terms: savedTerms.split("\n").filter((t) => t.trim() !== ""),
      });
    };

    fetchStoreSettings();
  }, [installment]);

  const periodLabel =
    installment.paymentPeriod === "daily"
      ? "يومي"
      : installment.paymentPeriod === "weekly"
      ? "أسبوعي"
      : "شهري";

  return (
    <div ref={ref} className="p-8 bg-white text-black font-sans space-y-6 text-right dir-rtl leading-relaxed">
      {/* هيدر العقد مع الشعار الديناميكي */}
      <div className="border-b-2 border-black pb-4 mb-4">
        <div className="flex justify-between items-center">
          <img 
            src={storeInfo.logo} 
            alt="شعار الشركة" 
            className="w-16 h-16 object-contain rounded-lg"
            onError={(e) => { e.currentTarget.src = defaultLogo.src; }}
          />
          <div className="text-center flex-1 space-y-1">
            <h1 className="text-2xl font-black">{storeInfo.name}</h1>
            <h2 className="text-xl font-bold">عقد بيع بالتقسيط والتزام تسديد</h2>
            <p className="text-xs text-gray-600">تاريخ المحرر: {new Date().toLocaleDateString("ar-IQ")}</p>
          </div>
          <div className="w-16"></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg bg-gray-50 border-gray-300">
        <div>
          <p className="font-bold text-gray-900 mb-1">الطرف الأول (الدائن / البائع):</p>
          <p className="font-semibold">{storeInfo.name}</p>
          {storeInfo.phone && <p>الهاتف: <span className="font-bold" dir="ltr">{storeInfo.phone}</span></p>}
          {storeInfo.address && <p>العنوان: {storeInfo.address}</p>}
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">الطرف الثاني (المدين / العميل):</p>
          <p>الاسم: <span className="font-bold">{installment.customerName}</span></p>
          <p>رقم الهاتف: <span className="font-bold" dir="ltr">{installment.phoneNumber}</span></p>
          <p>العنوان: {installment.address || "غير محدد"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-base border-b border-gray-400 pb-1">تفاصيل المباع وخطة التقسيط:</h3>
        <table className="w-full text-sm border-collapse border border-gray-300 text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-2">اسم المادة / المنتج</th>
              <th className="border border-gray-300 p-2">السعر الكلي</th>
              <th className="border border-gray-300 p-2">المقدمة</th>
              <th className="border border-gray-300 p-2">المتبقي للتقسيط</th>
              <th className="border border-gray-300 p-2">نوع القسط</th>
              <th className="border border-gray-300 p-2">مبلغ القسط</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 font-bold">{installment.productName}</td>
              <td className="border border-gray-300 p-2">{Math.round(installment.productPrice).toLocaleString()} د.ع</td>
              <td className="border border-gray-300 p-2">{Math.round(installment.downPayment).toLocaleString()} د.ع</td>
              <td className="border border-gray-300 p-2 font-bold">{Math.round(installment.totalDue).toLocaleString()} د.ع</td>
              <td className="border border-gray-300 p-2">{periodLabel}</td>
              <td className="border border-gray-300 p-2 font-bold text-lg">{Math.round(installment.monthlyInstallment).toLocaleString()} د.ع</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border p-4 rounded-lg border-gray-300 space-y-1 text-sm">
        <p className="font-bold text-gray-900">بيانات الكفيل الضامن:</p>
        <p>اسم الكفيل: <span className="font-bold">{installment.guarantorName || "لا يوجد"}</span></p>
        <p>رقم هاتف الكفيل: <span className="font-bold" dir="ltr">{installment.guarantorPhone || "لا يوجد"}</span></p>
      </div>

      <div className="space-y-1 text-xs text-gray-800 leading-normal border-t pt-3">
        <p className="font-bold">الشروط والتعهدات:</p>
        {storeInfo.terms.map((term, index) => (
          <p key={index}>{term}</p>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs font-bold border-t border-black">
        <div>
          <p className="mb-8">توقيع / بصمة العميل</p>
          <p>............................</p>
        </div>
        <div>
          <p className="mb-8">توقيع / بصمة الكفيل</p>
          <p>............................</p>
        </div>
        <div>
          <p className="mb-8">توقيع وختم البائع</p>
          <p>............................</p>
        </div>
      </div>
    </div>
  );
});
ContractPrintTemplate.displayName = "ContractPrintTemplate";

// ==========================================
// 🧾 2. قالب طباعة وصل استلام مبلغ (إيصال)
// ==========================================
export const PaymentReceiptPrintTemplate = React.forwardRef<
  HTMLDivElement,
  { payment: PaymentRecord; storeName?: string }
>(({ payment }, ref) => {
  const [storeInfo, setStoreInfo] = useState({
    name: "نظام أقساطك",
    logo: defaultLogo.src,
  });

  useEffect(() => {
    const fetchStoreInfo = async () => {
      const ownerUid = getOwnerUid();
      if (ownerUid) {
        let name = "نظام أقساطك";
        let logo = defaultLogo.src;

        const cached = localStorage.getItem(`company_settings_${ownerUid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.companyName) name = parsed.companyName;
            if (parsed.logoUrl || parsed.logo) logo = parsed.logoUrl || parsed.logo;
          } catch (e) {}
        }

        const settings = await getCompanySettings(ownerUid);
        if (settings) {
          if (settings.companyName) name = settings.companyName;
          if ((settings as any).logoUrl || (settings as any).logo) {
            logo = (settings as any).logoUrl || (settings as any).logo;
          }
        }
        setStoreInfo({ name, logo });
      }
    };

    fetchStoreInfo();
  }, [payment]);

  const dateStr = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString("ar-IQ")
    : new Date().toLocaleDateString("ar-IQ");

  return (
    <div ref={ref} className="p-6 bg-white text-black font-sans space-y-4 max-w-sm mx-auto text-right dir-rtl border-2 border-dashed border-gray-400 rounded-xl">
      <div className="text-center border-b pb-3 space-y-1">
        <div className="flex justify-center mb-1">
          <img 
            src={storeInfo.logo} 
            alt="Logo" 
            className="w-12 h-12 object-contain rounded-md"
            onError={(e) => { e.currentTarget.src = defaultLogo.src; }}
          />
        </div>
        <h1 className="text-xl font-extrabold">{storeInfo.name}</h1>
        <p className="text-xs font-bold bg-black text-white py-1 px-3 rounded-full inline-block">وصل إيصال قبض / تسديد</p>
        <p className="text-[10px] text-gray-500 mt-1">تاريخ الوصل: {dateStr}</p>
      </div>

      <div className="space-y-2 text-xs border-b pb-3">
        <div className="flex justify-between">
          <span className="text-gray-600">استلمنا من السيد/ة:</span>
          <span className="font-bold text-sm">{payment.customerName || "العميل"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">عن مادة / قسط:</span>
          <span className="font-bold">{payment.productName || "قسط محدد"}</span>
        </div>
        {payment.targetMonth && (
          <div className="flex justify-between">
            <span className="text-gray-600">عن فترة / شهر:</span>
            <span className="font-bold">{payment.targetMonth}</span>
          </div>
        )}
      </div>

      <div className="bg-gray-100 p-3 rounded-lg text-center border border-gray-300">
        <p className="text-xs text-gray-600">المبلغ المقبوض</p>
        <p className="text-2xl font-black text-black">
          {Math.round(payment.amount).toLocaleString()} د.ع
        </p>
      </div>

      {payment.notes && (
        <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border">
          <span className="font-bold">ملاحظات:</span> {payment.notes}
        </p>
      )}

      <div className="pt-4 text-center text-xs space-y-2">
        <p className="font-bold">شكراً لتسديدكم في الموعد المحدد!</p>
        <div className="flex justify-between text-[10px] text-gray-500 pt-2 border-t">
          <span>توقيع الموظف المستلم</span>
          <span>توقيع المسدد</span>
        </div>
      </div>
    </div>
  );
});
PaymentReceiptPrintTemplate.displayName = "PaymentReceiptPrintTemplate";

// ==========================================
// 📊 3. قالب طباعة كشف حساب عميل (ملخص / تفصيلي)
// ==========================================
export const CustomerStatementPrintTemplate = React.forwardRef<
  HTMLDivElement,
  {
    customer: {
      customerName: string;
      phoneNumber: string;
      address?: string;
      installments: InstallmentData[];
      totalOriginalDue: number;
      totalPaid: number;
      totalRemaining: number;
    };
    payments: PaymentRecord[];
    printType: "summary" | "full";
  }
>(({ customer, payments, printType }, ref) => {
  const [storeInfo, setStoreInfo] = useState({
    name: "نظام أقساطك",
    logo: defaultLogo.src,
  });

  useEffect(() => {
    const fetchStoreSettings = async () => {
      const ownerUid = getOwnerUid();
      if (ownerUid) {
        let name = "نظام أقساطك";
        let logo = defaultLogo.src;

        const cached = localStorage.getItem(`company_settings_${ownerUid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.companyName) name = parsed.companyName;
            if (parsed.logoUrl || parsed.logo) logo = parsed.logoUrl || parsed.logo;
          } catch (e) {}
        }

        const settings = await getCompanySettings(ownerUid);
        if (settings) {
          if (settings.companyName) name = settings.companyName;
          if ((settings as any).logoUrl || (settings as any).logo) {
            logo = (settings as any).logoUrl || (settings as any).logo;
          }
        }
        setStoreInfo({ name, logo });
      }
    };
    fetchStoreSettings();
  }, [customer]);

  return (
    <div ref={ref} className="p-8 bg-white text-black font-sans space-y-6 text-right dir-rtl leading-relaxed">
      {/* 🖼️ هيدر الكشف المحترف بالشعار الديناميكي الخاص بكل عميل */}
      <div className="border-b-2 border-black pb-4 mb-4">
        <div className="flex justify-between items-center">
          <img 
            src={storeInfo.logo} 
            alt="شعار المكتب" 
            className="w-16 h-16 object-contain rounded-lg"
            onError={(e) => { e.currentTarget.src = defaultLogo.src; }}
          />
          <div className="text-center flex-1 space-y-1">
            <h1 className="text-2xl font-black">{storeInfo.name}</h1>
            <h2 className="text-lg font-bold">
              {printType === "full" ? "كشف حساب تفصيلي شامل" : "ملخص موقف مالي للعميل"}
            </h2>
            <p className="text-xs text-gray-600">تاريخ الاستخراج: {new Date().toLocaleDateString("ar-IQ")}</p>
          </div>
          <div className="w-16"></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg bg-gray-50 border-gray-300">
        <div>
          <p className="text-gray-600 text-xs">اسم العميل:</p>
          <p className="font-bold text-base">{customer.customerName}</p>
          <p className="text-gray-600 text-xs mt-1">رقم الهاتف:</p>
          <p className="font-bold" dir="ltr">{customer.phoneNumber}</p>
          {customer.address && <p className="text-xs text-gray-500 mt-1">العنوان: {customer.address}</p>}
        </div>
        <div className="space-y-1 text-left font-mono">
          <p className="text-xs text-gray-600">إجمالي المطلوب للتقسيط:</p>
          <p className="font-bold text-sm">{Math.round(customer.totalOriginalDue).toLocaleString()} د.ع</p>
          <p className="text-xs text-gray-600">المبلغ المسدد فعلياً:</p>
          <p className="font-bold text-sm text-emerald-700">{Math.round(customer.totalPaid).toLocaleString()} د.ع</p>
          <p className="text-xs text-gray-600">المتبقي الذمة الماليّة:</p>
          <p className="font-black text-base text-rose-700">{Math.round(customer.totalRemaining).toLocaleString()} د.ع</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-sm border-b pb-1">المواد والأقساط المسجلة:</h3>
        <table className="w-full text-xs border-collapse border border-gray-300 text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">#</th>
              <th className="border p-2">اسم المادة / المنتج</th>
              <th className="border p-2">السعر الكلي</th>
              <th className="border p-2">المقدمة</th>
              <th className="border p-2">نوع القسط</th>
              <th className="border p-2">مبلغ القسط</th>
            </tr>
          </thead>
          <tbody>
            {customer.installments.map((inst, idx) => (
              <tr key={idx}>
                <td className="border p-2">{idx + 1}</td>
                <td className="border p-2 font-bold">{inst.productName}</td>
                <td className="border p-2">{Math.round(inst.productPrice).toLocaleString()} د.ع</td>
                <td className="border p-2">{Math.round(inst.downPayment).toLocaleString()} د.ع</td>
                <td className="border p-2">{inst.paymentPeriod === "daily" ? "يومي" : inst.paymentPeriod === "weekly" ? "أسبوعي" : "شهري"}</td>
                <td className="border p-2 font-bold">{Math.round(inst.monthlyInstallment).toLocaleString()} د.ع</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {printType === "full" && (
        <div className="space-y-2 pt-2">
          <h3 className="font-bold text-sm border-b pb-1">سجل التسديدات والمقبوضات التفصيلي:</h3>
          {payments.length > 0 ? (
            <table className="w-full text-xs border-collapse border border-gray-300 text-center">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">#</th>
                  <th className="border p-2">تاريخ التسديد</th>
                  <th className="border p-2">المادة</th>
                  <th className="border p-2">المبلغ المقبوض</th>
                  <th className="border p-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">{idx + 1}</td>
                    <td className="border p-2 font-mono">{p.paidAt ? new Date(p.paidAt).toLocaleDateString("ar-IQ") : "-"}</td>
                    <td className="border p-2">{p.productName || "قسط"}</td>
                    <td className="border p-2 font-bold text-emerald-700">{Math.round(p.amount).toLocaleString()} د.ع</td>
                    <td className="border p-2">{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-500 text-center p-3 border border-dashed rounded-lg">لا توجد دفعات مسددة مسجلة لهذا العميل حتى الآن.</p>
          )}
        </div>
      )}

      <div className="flex justify-between items-center text-xs border-t pt-6 mt-8">
        <p>تم استخراج هذا المستند تلقائياً من {storeInfo.name}.</p>
        <p>ختم / توقيع إدارة المكتب: ....................</p>
      </div>
    </div>
  );
});
CustomerStatementPrintTemplate.displayName = "CustomerStatementPrintTemplate";