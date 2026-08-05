import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, // 👈 تمت إضافتها هنا
  serverTimestamp,
  updateDoc,
  deleteDoc 
} from "firebase/firestore";

// واجهة بيانات القسط والعميل
export interface InstallmentData {
  id?: string;
  userId: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  guarantorName: string;
  guarantorPhone: string;
  productName: string;
  productPrice: number;
  downPayment: number;
  profitMargin: number;
  months: number;
  totalDue: number;
  totalProfit: number;
  monthlyInstallment: number;
  startDate?: string;
  createdAt?: any;
  paidMonths?: string[]; // 👈 تمت الإضافة لتتبع الأشهر التي تم تسديدها بنجاح
}

// واجهة تسديد الدفعة
export interface PaymentRecord {
  id?: string;
  installmentId: string;
  userId: string;
  customerName?: string;
  productName?: string;
  amount: number;
  paidAt?: any;
  createdAt?: any;
  targetMonth?: string; 
  notes?: string;   
  isPenalty?: boolean; // 👈 إضافة هذا الحقل لتمييز الغرامة عن الدفعة    
}

// 1. إضافة قسط جديد مرتبط بالمستخدم الحالي
export const addInstallmentRecord = async (data: Omit<InstallmentData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "installments"), {
      ...data,
      paidMonths: [], // 👈 تهيئة مصفوفة الأشهر المدفوعة كفارغة عند إنشاء قسط جديد
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في حفظ القسط:", error);
    return { success: false, id: null, error };
  }
};

// 2. جلب جميع أقساط وعملاء المستخدم الحالي فقط
export const getUserInstallments = async (userId: string) => {
  try {
    const q = query(collection(db, "installments"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const installments: InstallmentData[] = [];
    
    querySnapshot.forEach((docSnap) => {
      installments.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as InstallmentData);
    });
    
    return installments;
  } catch (error) {
    console.error("خطأ في جلب بيانات الأقساط:", error);
    throw error;
  }
};

// 3. جلب تفاصيل قسط/عميل معين بواسطة الـ ID
export const getInstallmentById = async (id: string) => {
  try {
    const docRef = doc(db, "installments", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InstallmentData;
    }
    return null;
  } catch (error) {
    console.error("خطأ في جلب تفاصيل القسط:", error);
    throw error;
  }
};

// 4. تسديد دفعة جديدة وتحديث المتبقي وحالة الشهر تلقائياً
export const addPaymentRecord = async (data: Omit<PaymentRecord, "id">) => {
  try {
    const paymentPayload: any = {
      ...data,
      paidAt: data.paidAt || new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    if (paymentPayload.targetMonth === undefined) delete paymentPayload.targetMonth;
    if (paymentPayload.notes === undefined) delete paymentPayload.notes;

    // 1. إضافة الدفعة لسجل المقبوضات
    const docRef = await addDoc(collection(db, "payments"), paymentPayload);

    // 2. تحديث المبلغ المتبقي (totalDue) والأشهر المدفوعة في القسط نفسه
    if (data.installmentId && data.amount) {
      const instRef = doc(db, "installments", data.installmentId);
      const instSnap = await getDoc(instRef);

      if (instSnap.exists()) {
        const instData = instSnap.data() as InstallmentData;
        const currentTotalDue = instData.totalDue || 0;
        const newTotalDue = Math.max(0, currentTotalDue - data.amount);
        
        // 👈 جلب الأشهر المدفوعة السابقة وإضافة الشهر الجديد إليها
        const currentPaidMonths = instData.paidMonths || [];
        const updatedPaidMonths = [...currentPaidMonths];

        if (data.targetMonth && !updatedPaidMonths.includes(data.targetMonth)) {
          updatedPaidMonths.push(data.targetMonth);
        }
        
        // تحديث المستند في الفايرستور
        await updateDoc(instRef, {
          totalDue: newTotalDue,
          paidMonths: updatedPaidMonths, // 👈 حفظ التحديث
        });
      }
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في إضافة الدفعة وتحديث القسط:", error);
    return { success: false, error };
  }
};

// اسم مستعار للدالة القديمة لضمان عدم حدوث كسر في أجزاء المشروع الأخرى
export const recordPayment = async (installmentId: string, userId: string, amount: number) => {
  return addPaymentRecord({
    installmentId,
    userId,
    amount,
  });
};

// 5. جلب جميع الدفعات المسددة لمستخدم معين
export const getUserPayments = async (userId: string) => {
  try {
    const q = query(collection(db, "payments"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const payments: PaymentRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      payments.push({ id: docSnap.id, ...docSnap.data() } as PaymentRecord);
    });
    return payments;
  } catch (error) {
    console.error("خطأ في جلب السجلات:", error);
    throw error;
  }
};

// 6. جلب جميع أقساط عميل معين برقم الهاتف
export const getInstallmentsByPhone = async (userId: string, phoneNumber: string) => {
  try {
    const q = query(
      collection(db, "installments"),
      where("userId", "==", userId),
      where("phoneNumber", "==", phoneNumber)
    );
    const querySnapshot = await getDocs(q);
    const list: InstallmentData[] = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as InstallmentData);
    });
    return list;
  } catch (error) {
    console.error("خطأ في جلب أقساط العميل:", error);
    return [];
  }
};

// ==========================================
// ====== الدوال الجديدة (التعديل والحذف) ======
// ==========================================

// 7. تحديث بيانات قسط/عميل معين
export const updateInstallment = async (installmentId: string, updatedData: Partial<InstallmentData>) => {
  try {
    const docRef = doc(db, "installments", installmentId);
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("خطأ في تحديث بيانات العميل/القسط:", error);
    throw error;
  }
};

// 8. حذف قسط/عميل بالكامل
export const deleteInstallment = async (installmentId: string) => {
  try {
    const docRef = doc(db, "installments", installmentId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("خطأ في حذف القسط:", error);
    throw error;
  }
};

// 9. تعديل دفعة مسددة (مع تسوية المتبقي للقسط تلقائياً)
export const updatePaymentRecord = async (
  paymentId: string,
  installmentId: string,
  oldAmount: number,
  newAmount: number,
  updatedData: Partial<PaymentRecord>
) => {
  try {
    const cleanData = { ...updatedData };
    if (cleanData.targetMonth === undefined) delete cleanData.targetMonth;
    if (cleanData.notes === undefined) delete cleanData.notes;

    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
    });

    if (oldAmount !== newAmount) {
      const instRef = doc(db, "installments", installmentId);
      const instSnap = await getDoc(instRef);
      if (instSnap.exists()) {
        const currentTotalDue = instSnap.data().totalDue || 0;
        const newTotalDue = Math.max(0, currentTotalDue + oldAmount - newAmount);
        await updateDoc(instRef, { totalDue: newTotalDue });
      }
    }
    return true;
  } catch (error) {
    console.error("خطأ في تعديل الدفعة:", error);
    throw error;
  }
};

// 10. حذف دفعة مسددة أو غرامة (مع معالجة المتبقي بشكل صحيح)
export const deletePaymentRecord = async (paymentId: string, installmentId: string, amount: number) => {
  try {
    // جلب معلومات الدفعة لمعرفة إذا كانت غرامة أو دفعة عادية
    const paymentRef = doc(db, "payments", paymentId);
    const paymentSnap = await getDoc(paymentRef);
    let targetMonthToRemove = "";
    let isPenaltyRecord = false;
    
    if (paymentSnap.exists()) {
      const data = paymentSnap.data();
      targetMonthToRemove = data.targetMonth || "";
      isPenaltyRecord = data.isPenalty || false; // 👈 نتحقق هنا إذا كان السجل عبارة عن غرامة
    }
    
    // 1. حذف السجل
    await deleteDoc(paymentRef);

    // 2. تحديث المتبقي للقسط
    const instRef = doc(db, "installments", installmentId);
    const instSnap = await getDoc(instRef);
    
    if (instSnap.exists()) {
      const instData = instSnap.data() as InstallmentData;
      const currentTotalDue = instData.totalDue || 0;
      
      let updatedPaidMonths = instData.paidMonths || [];
      if (targetMonthToRemove) {
        // إزالة الشهر المحذوف من قائمة الأشهر المدفوعة
        updatedPaidMonths = updatedPaidMonths.filter((month: string) => month !== targetMonthToRemove);
      }

      // 👈 المنطق الذكي هنا:
      // إذا كانت غرامة ومسحناها -> ننقصها من الدين
      // إذا كانت دفعة ومسحناها -> نرجعها للدين
      const newTotalDue = isPenaltyRecord 
        ? Math.max(0, currentTotalDue - amount) 
        : currentTotalDue + amount;

      await updateDoc(instRef, { 
        totalDue: newTotalDue,
        paidMonths: updatedPaidMonths 
      });
    }
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدفعة/الغرامة:", error);
    throw error;
  }
};
export const addPenaltyRecord = async (
  installmentId: string,
  userId: string,
  amount: number,
  notes: string
) => {
  try {
    // 1. حفظ السجل كغرامة
    const docRef = await addDoc(collection(db, "payments"), {
      installmentId,
      userId,
      amount,
      notes,
      isPenalty: true, // 👈 تمييز السجل كغرامة
      paidAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });

    // 2. تحديث المتبقي للقسط (بزيادة المبلغ وليس تنقيصه)
    const instRef = doc(db, "installments", installmentId);
    const instSnap = await getDoc(instRef);
    if (instSnap.exists()) {
      const currentTotalDue = instSnap.data().totalDue || 0;
      await updateDoc(instRef, {
        totalDue: currentTotalDue + amount, // 👈 زيادة الدين
      });
    }
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في تسجيل الغرامة:", error);
    throw error;
  }
};
// ==========================================
// ========== 💰 قسم الديون الحرة 💰 ==========
// ==========================================

export interface DebtData {
  id?: string;
  userId: string;
  customerName: string;
  phoneNumber: string;
  amount: number;
  reason: string;
  isPaid: boolean;
  createdAt: any;
}

// 1. إضافة دين جديد
export const addDebt = async (debtData: Omit<DebtData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "debts"), {
      ...debtData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إضافة الدين:", error);
    throw error;
  }
};

// 2. جلب جميع الديون الخاصة بالمستخدم
export const getUserDebts = async (userId: string) => {
  try {
    const q = query(
      collection(db, "debts"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DebtData[];
  } catch (error) {
    console.error("خطأ في جلب الديون:", error);
    return [];
  }
};

// 3. تغيير حالة الدين (مسدد / غير مسدد)
export const toggleDebtStatus = async (debtId: string, currentStatus: boolean) => {
  try {
    const debtRef = doc(db, "debts", debtId);
    await updateDoc(debtRef, {
      isPaid: !currentStatus
    });
    return true;
  } catch (error) {
    console.error("خطأ في تحديث حالة الدين:", error);
    throw error;
  }
};

// 4. حذف السجل بالكامل
export const deleteDebt = async (debtId: string) => {
  try {
    const debtRef = doc(db, "debts", debtId);
    await deleteDoc(debtRef);
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدين:", error);
    throw error;
  }
};