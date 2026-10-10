"use client";

import React, { useEffect, useState } from "react";
import { InstallmentData, PaymentRecord, getCompanySettings } from "@/services/firestore";
import { auth } from "@/services/firebase";

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
    terms: [] as string[],
  });

  useEffect(() => {
    const fetchStoreSettings = async () => {
      const ownerUid = getOwnerUid();
      
      // الشروط الافتراضية للعقد
      const defaultTerms = 
        "1. يتعهد الطرف الثاني بتسديد المبالغ المستحقة في مواعيدها المحددة أعلاه دون تأخير.\n2. في حال التأخير عن التسديد، يحق للطرف الأول اتخاذ الإجراءات القانونية المترتبة على ذلك.\n3. يعتبر هذا العقد وثيقة رسمية ملزمة للطرفين وللكفيل الضامن.";

      let savedName = "نظام أقساطك للتقسيط والخدمات المالية";
      let savedPhone = "";
      let savedAddress = "";
      let savedTerms = defaultTerms;

      if (ownerUid) {
        // 1. فحص التخزين المحلي السريع الخاص بالشركة
        const cached = localStorage.getItem(`company_settings_${ownerUid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.companyName) savedName = parsed.companyName;
            if (parsed.phone) savedPhone = parsed.phone;
            if (parsed.address) savedAddress = parsed.address;
            if (parsed.notes) savedTerms = parsed.notes;
          } catch (e) {}
        }

        // 2. الجلب المباشر من Firestore لضمان الدقة وتفادي أي تداخل
        const settings = await getCompanySettings(ownerUid);
        if (settings) {
          if (settings.companyName) savedName = settings.companyName;
          if (settings.phone) savedPhone = settings.phone;
          if (settings.address) savedAddress = settings.address;
          if (settings.notes) savedTerms = settings.notes;

          localStorage.setItem(`company_settings_${ownerUid}`, JSON.stringify(settings));
        }
      }

      setStoreInfo({
        name: savedName,
        phone: savedPhone,
        address: savedAddress,
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
      {/* هيدر العقد */}
      <div className="text-center border-b-2 border-black pb-4 space-y-1">
        <h1 className="text-2xl font-black">{storeInfo.name}</h1>
        <h2 className="text-xl font-bold">عقد بيع بالتقسيط والتزام تسديد</h2>
        <p className="text-xs text-gray-600">تاريخ المحرر: {new Date().toLocaleDateString("ar-IQ")}</p>
      </div>

      {/* الطرف الأول والطرف الثاني */}
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

      {/* تفاصيل السلعة والتقسيط */}
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

      {/* بيانات الكفيل الضامن */}
      <div className="border p-4 rounded-lg border-gray-300 space-y-1 text-sm">
        <p className="font-bold text-gray-900">بيانات الكفيل الضامن:</p>
        <p>اسم الكفيل: <span className="font-bold">{installment.guarantorName || "لا يوجد"}</span></p>
        <p>رقم هاتف الكفيل: <span className="font-bold" dir="ltr">{installment.guarantorPhone || "لا يوجد"}</span></p>
      </div>

      {/* الشروط والتعهد القانوني الديناميكي */}
      <div className="space-y-1 text-xs text-gray-800 leading-normal border-t pt-3">
        <p className="font-bold">الشروط والتعهدات:</p>
        {storeInfo.terms.map((term, index) => (
          <p key={index}>{term}</p>
        ))}
      </div>

      {/* التواقيع */}
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
  const [storeName, setStoreName] = useState("نظام أقساطك");

  useEffect(() => {
    const fetchStoreName = async () => {
      const ownerUid = getOwnerUid();
      if (ownerUid) {
        const cached = localStorage.getItem(`company_settings_${ownerUid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.companyName) setStoreName(parsed.companyName);
          } catch (e) {}
        }

        const settings = await getCompanySettings(ownerUid);
        if (settings && settings.companyName) {
          setStoreName(settings.companyName);
        }
      }
    };

    fetchStoreName();
  }, [payment]);

  const dateStr = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString("ar-IQ")
    : new Date().toLocaleDateString("ar-IQ");

  return (
    <div ref={ref} className="p-6 bg-white text-black font-sans space-y-4 max-w-sm mx-auto text-right dir-rtl border-2 border-dashed border-gray-400 rounded-xl">
      {/* الهيدر */}
      <div className="text-center border-b pb-3 space-y-1">
        <h1 className="text-xl font-extrabold">{storeName}</h1>
        <p className="text-xs font-bold bg-black text-white py-1 px-3 rounded-full inline-block">وصل إيصال قبض / تسديد</p>
        <p className="text-[10px] text-gray-500 mt-1">تاريخ الوصل: {dateStr}</p>
      </div>

      {/* تفاصيل القبض */}
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

      {/* المبلغ المقبوض */}
      <div className="bg-gray-100 p-3 rounded-lg text-center border border-gray-300">
        <p className="text-xs text-gray-600">المبلغ المقبوض</p>
        <p className="text-2xl font-black text-black">
          {Math.round(payment.amount).toLocaleString()} د.ع
        </p>
      </div>

      {/* ملاحظات الوصل */}
      {payment.notes && (
        <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border">
          <span className="font-bold">ملاحظات:</span> {payment.notes}
        </p>
      )}

      {/* الذيل والتوقيع */}
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